import { Job, JobHandler, JobResult } from '../agent';
import { LLMClient, LLMMessage } from '../llm-client';

export class ReviewHandler implements JobHandler {
    type = 'review';
    private llmClient: LLMClient;

    constructor(routerUrl: string, apiKey: string) {
        this.llmClient = new LLMClient(routerUrl, apiKey);
    }

    async execute(job: Job): Promise<JobResult> {
        const { prNumber, repository, issueId } = job.payload;

        if (!repository || !repository.token) {
            return { success: false, error: 'Repository information and token required for review' };
        }

        const { owner, name, token } = repository;

        try {
            console.log(`[ReviewHandler] Starting smart review for PR #${prNumber} in ${owner}/${name}`);

            // 1. Fetch PR Diff
            const diffUrl = `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`;
            const diffResponse = await fetch(diffUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3.diff',
                    'User-Agent': 'Sluagh-Swarm-Worker'
                }
            });

            if (!diffResponse.ok) {
                throw new Error(`Failed to fetch PR diff: ${diffResponse.statusText}`);
            }

            const diffText = await diffResponse.text();

            if (!diffText || diffText.length < 10) {
                return { success: true, data: { status: 'Skipped', message: 'Empty diff, nothing to review.', reviewDecision: 'APPROVE' } };
            }

            // 2. Analyze with LLM (Enhanced Prompt)
            const prompt = `
            You are an expert Senior Software Engineer and Tech Lead.
            Review the following Git Diff for a Pull Request.

            CRITERIA:
            1. **Correctness**: Bugs, logical errors, edge cases.
            2. **Security**: Vulnerabilities (injection, auth, secrets).
            3. **Tech Debt & Clean Code**: Readability, naming, modularity.
            4. **Efficiency**: Speed, cost, minimum code needed. Is there a simpler way?
            
            OUTPUT FORMAT:
            You must provide your response in XML format as follows:
            <review>
                <body>
                (Markdown formatted review content. Start with a summary. List high-priority issues. List efficiency/tech debt observations. End with nitpicks.)
                </body>
                <decision>APPROVE | REQUEST_CHANGES</decision>
            </review>

            DECISION RULES:
            - **APPROVE**: If the code is correct, secure, and has acceptable tech debt/efficiency.
            - **REQUEST_CHANGES**: If there are bugs, security flaws, or MAJOR efficiency/tech debt issues that must be fixed before merging.

            DIFF:
            \`\`\`diff
            ${diffText.substring(0, 50000)} // Truncate to avoid context limit
            \`\`\`
            `;

            const systemPrompt: LLMMessage = {
                role: 'system',
                content: prompt
            };
            const userPrompt: LLMMessage = {
                role: 'user',
                content: 'Review the diff and provide your decision.'
            };

            const llmResponse = await this.llmClient.chat([systemPrompt, userPrompt], 'coding', { model: 'gemini-flash-latest' });

            // 3. Parse XML Output
            const bodyMatch = llmResponse.match(/<body>([\s\S]*?)<\/body>/);
            const decisionMatch = llmResponse.match(/<decision>(.*?)<\/decision>/);

            const body = bodyMatch ? bodyMatch[1].trim() : llmResponse; // Fallback to raw response if parsing fails
            const decision = decisionMatch ? decisionMatch[1].trim().toUpperCase() : 'COMMENT';

            const finalDecision = (decision === 'APPROVE' || decision === 'REQUEST_CHANGES') ? decision : 'COMMENT';

            // 4. Post Review to GitHub
            const reviewUrl = `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/reviews`;
            const reviewResponse = await fetch(reviewUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Sluagh-Swarm-Worker',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: body,
                    event: finalDecision === 'APPROVE' ? 'APPROVE' : (finalDecision === 'REQUEST_CHANGES' ? 'REQUEST_CHANGES' : 'COMMENT')
                })
            });

            if (!reviewResponse.ok) {
                throw new Error(`Failed to post review: ${reviewResponse.statusText}`);
            }

            const reviewData = await reviewResponse.json() as any;

            return {
                success: true,
                data: {
                    status: 'Review Posted',
                    url: reviewData.html_url,
                    reviewDecision: finalDecision,
                    engineeringLog: `Posted review for PR #${prNumber}. Decision: ${finalDecision}. URL: ${reviewData.html_url}`
                }
            };

        } catch (e: any) {
            console.error('[ReviewHandler] Error:', e);
            return {
                success: false,
                data: {
                    status: 'Failed',
                    engineeringLog: `Review failed: ${e.message}`
                },
                error: e.message
            };
        }
    }
}
