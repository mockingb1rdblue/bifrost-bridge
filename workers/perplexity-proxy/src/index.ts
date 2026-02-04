export interface Env {
    PERPLEXITY_API_KEY: string;
    PROXY_API_KEY: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // 1. Authenticate the caller (Client -> Proxy)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.includes(env.PROXY_API_KEY)) {
            return new Response('Unauthorized: Invalid Proxy Key', { status: 401 });
        }

        // 2. Prepare the upstream request (Proxy -> Perplexity)
        const url = new URL(request.url);
        // Forward path and search params
        const perplexityUrl = `https://api.perplexity.ai${url.pathname}${url.search}`;

        // Clone headers to filter strictly? Or just pass through relevant ones?
        // Safer to construct a clean request to avoid leaking proxy headers.
        const proxyHeaders = new Headers();
        proxyHeaders.set('Authorization', `Bearer ${env.PERPLEXITY_API_KEY}`);
        proxyHeaders.set('Content-Type', 'application/json');
        if (request.headers.get('Accept')) {
            proxyHeaders.set('Accept', request.headers.get('Accept')!);
        }

        const proxyRequest = new Request(perplexityUrl, {
            method: request.method,
            headers: proxyHeaders,
            body: request.body
        });

        try {
            const response = await fetch(proxyRequest);

            // 3. Handle specific response types (like SSE/Streaming)
            if (response.headers.get('content-type')?.includes('text/event-stream')) {
                return new Response(response.body, {
                    status: response.status,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        // CORS headers if accessed from browser directly
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            }

            // Standard response
            const responseBody = await response.blob();
            return new Response(responseBody, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    'Content-Type': response.headers.get('content-type') || 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } catch (e) {
            return new Response(`Proxy Error: ${e instanceof Error ? e.message : String(e)}`, { status: 502 });
        }
    }
};
