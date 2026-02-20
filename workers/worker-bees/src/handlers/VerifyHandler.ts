
import { Job, JobHandler, JobResult } from '../agent';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VerifyHandler implements JobHandler {
    type = 'verify';

    async execute(job: Job): Promise<JobResult> {
        const { title, description } = job.payload;
        console.log(`[VerifyHandler] Verifying: ${title}`);

        // TODO: ideally we extract a specific command from the description or metadata
        // For now, default to 'npm test' or a safe default, or simple connectivity check
        // Or if the description contains a command in backticks, use that?

        // Safer approach: define a set of allowed verification commands in the job payload
        // But for autonomy, we might want it to be flexible.
        // Let's assume for this MVP we run "npm test" if not specified.

        const command = 'npm test'; // Hardcoded for safety in this iteration

        try {
            console.log(`[VerifyHandler] Running: ${command}`);
            const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });

            return {
                success: true,
                data: {
                    status: 'Verification Passed',
                    output: stdout,
                    engineeringLog: `Verification passed.\nCommand: ${command}\nOutput: ${stdout.substring(0, 200)}...`
                }
            };
        } catch (e: any) {
            console.error('[VerifyHandler] Verification failed:', e);
            return {
                success: false,
                data: {
                    status: 'Verification Failed',
                    output: e.stdout + '\n' + e.stderr,
                    engineeringLog: `Verification failed.\nCommand: ${command}\nError: ${e.message}\nStderr: ${e.stderr?.substring(0, 200)}`
                }
                // Note: we return success: true but with status Failed so the swarm task updates to 'failed' 
                // but the job processing itself didn't crash.
                // Wait, if we return success: false, the agent might retry?
                // Let's return success: true so it reports the failure to the Router.
            };
        }
    }
}
