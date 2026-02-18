// Env is global
import { RouterDO } from './router-do';
import { DASHBOARD_HTML } from './dashboard';

export { RouterDO };

export default {
    async fetch(request: Request, env: any): Promise<Response> {
        const url = new URL(request.url);

        // 1. CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        // 2. Admin Dashboard
        if (url.pathname === '/admin') {
            return new Response(DASHBOARD_HTML, {
                headers: { 'Content-Type': 'text/html' },
            });
        }

        // 3. Webhook paths (publicly reachable, but signature verified in DO)
        if (url.pathname === '/webhooks/linear' || url.pathname === '/webhooks/github') {
            if (!env.ROUTER_DO) return new Response('Router DO not configured', { status: 500 });
            const id = env.ROUTER_DO.idFromName('global-router');
            const obj = env.ROUTER_DO.get(id);
            return await obj.fetch(request);
        }

        // 4. Authentication for other paths
        const authHeader = request.headers.get('Authorization');
        const path = url.pathname;

        let isValidAuth = false;
        if (authHeader) {
            if (path.startsWith('/jules/') && authHeader === `Bearer ${env.JULES_API_KEY}`) {
                isValidAuth = true;
            } else if (authHeader === `Bearer ${env.PROXY_API_KEY}`) {
                isValidAuth = true;
            }
        }

        if (!isValidAuth) {
            return new Response('Unauthorized', { status: 401 });
        }

        // 5. Route to Durable Object
        if (!env.ROUTER_DO) return new Response('Router DO not configured', { status: 500 });
        const id = env.ROUTER_DO.idFromName('global-router');
        const obj = env.ROUTER_DO.get(id);

        const response = await obj.fetch(request);

        // Add CORS headers to all DO responses
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        return newResponse;
    },

    // CRON TRIGGER HANDLER
    async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
        console.log('[Cron] 💓 Pulse Check Initiated...');

        // Wake up the Sluagh Swarm (Fly.io Scale-to-Zero)
        // We just need to hit the endpoint to wake the machine.
        // It will auto-poll on boot.
        const flyUrl = 'https://sluagh-swarm.fly.dev/health'; // Replace with actual health check URL if different

        ctx.waitUntil((async () => {
            try {
                console.log(`[Cron] Pinging Swarm at ${flyUrl}...`);
                const response = await fetch(flyUrl);
                console.log(`[Cron] Swarm Ping Result: ${response.status} ${response.statusText}`);
            } catch (e: any) {
                console.error(`[Cron] Failed to ping Swarm: ${e.message}`);
                // Verify if it's reachable or just a 404 (which still wakes it up)
            }
        })());
    },
};
