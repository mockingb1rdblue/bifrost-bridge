
import { Job, JobResult, JobHandler } from '../agent';

interface FetchUrlPayload {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
}

export class FetchUrlHandler implements JobHandler {
    type = 'fetch_url';

    async execute(job: Job): Promise<JobResult> {
        const payload = job.payload as FetchUrlPayload;
        const { url, method, headers = {}, body, timeout = 30000 } = payload;

        // 1. Secret Injection (Security)
        // Replaces values starting with '$' with process.env values
        const secureHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            if (value.startsWith('$')) {
                const envKey = value.slice(1);
                const envValue = process.env[envKey];
                if (!envValue) {
                    return { success: false, error: `Missing secure environment variable: ${envKey}` };
                }
                secureHeaders[key] = envValue;
            } else {
                secureHeaders[key] = value;
            }
        }

        console.log(`[FetchUrl] ${method} ${url}`);

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...secureHeaders
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });

            clearTimeout(id);

            const responseData = await response.text();
            let parsedData;
            try {
                parsedData = JSON.parse(responseData);
            } catch {
                parsedData = responseData;
            }

            return {
                success: response.ok,
                data: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    data: parsedData
                },
                error: !response.ok ? `Request failed: ${response.status} ${response.statusText}` : undefined
            };

        } catch (error: any) {
            return {
                success: false,
                error: `Network error: ${error.message}`
            };
        }
    }
}
