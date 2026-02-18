
import { DurableObject } from "cloudflare:workers";

interface GovernanceState {
    requestsToday: number;
    lastReset: number;
    blocked: boolean;
}

export class GovernanceDO extends DurableObject {
    private state: GovernanceState;
    private readonly LIMIT = 10000;

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        this.state = {
            requestsToday: 0,
            lastReset: Date.now(),
            blocked: false,
        };

        // Resume state from storage
        this.ctx.blockConcurrencyWhile(async () => {
            const stored = await this.ctx.storage.get<GovernanceState>("state");
            if (stored) {
                this.state = stored;
                // Check if we need to reset (if alarm missed or logic drift)
                const lastResetDate = new Date(this.state.lastReset).getUTCDate();
                const currentDate = new Date().getUTCDate();
                if (lastResetDate !== currentDate) {
                    this.resetCounter();
                }
            } else {
                // First run, schedule alarm for midnight
                this.scheduleNextReset();
            }
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === "/check") {
            return this.handleCheck(request);
        }

        if (path === "/metrics") {
            return new Response(JSON.stringify(this.state), { headers: { "Content-Type": "application/json" } });
        }

        return new Response("Not Found", { status: 404 });
    }

    async alarm() {
        console.log("[GovernanceDO] 🕛 Midnight Alarm: Resetting counters.");
        this.resetCounter();
        this.scheduleNextReset();
    }

    private async handleCheck(request: Request): Promise<Response> {
        if (this.state.blocked) {
            return new Response(JSON.stringify({ allowed: false, reason: "Daily limit exceeded" }), { status: 429 });
        }

        // Auto-increment on check
        this.state.requestsToday++;
        await this.ctx.storage.put("state", this.state);

        if (this.state.requestsToday > this.LIMIT) {
            this.state.blocked = true;
            await this.ctx.storage.put("state", this.state);

            // Tattle!
            await this.tattle();

            return new Response(JSON.stringify({ allowed: false, reason: "Daily limit exceeded" }), { status: 429 });
        }

        return new Response(JSON.stringify({ allowed: true, count: this.state.requestsToday }), { status: 200 });
    }

    private resetCounter() {
        this.state.requestsToday = 0;
        this.state.lastReset = Date.now();
        this.state.blocked = false;
        this.ctx.storage.put("state", this.state);
    }

    private scheduleNextReset() {
        // Calculate time until next midnight UTC
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(now.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        const timeUntil = tomorrow.getTime() - now.getTime();
        this.ctx.storage.setAlarm(Date.now() + timeUntil);
        console.log(`[GovernanceDO] ⏰ Next reset scheduled in ${Math.floor(timeUntil / 1000 / 60)} minutes.`);
    }

    private async tattle() {
        console.error("[GovernanceDO] 🚨 DAILY LIMIT EXCEEDED! Tattling to Linear...");

        const webhookUrl = "https://crypt-core.mock1ng.workers.dev/webhooks/linear"; // Self-reference or direct Linear API
        // Ideally, we post to the Linear webhook handler or use the LinearClient directly.
        // Given we are in the same worker, we can't easily import LinearClient if not passed in.
        // For now, we will just log a special error that the Router might pick up, 
        // OR we trigger an event if we had an event bus.

        // Simplest: Just Log. The Router will see the 429 and handle the user notification.
    }
}
