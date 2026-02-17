import { AuthManager } from './auth';

export interface FetchOptions extends RequestInit {
    timeout?: number;
    workerId?: string;
}

export class NetworkDriver {
    private static readonly BASE_DELAY = 5000;
    private static readonly MAX_DELAY = 300000; // 5 minutes
    private static readonly MAX_TOTAL_FAILURES = 5; // User rule: Halt after 5 failures

    private consecutiveFailures = 0;
    private totalFailures = 0;
    private currentDelay = NetworkDriver.BASE_DELAY;
    private isHalted = false;

    constructor(
        private workerId: string,
        private apiKey?: string
    ) { }

    /**
     * Executes a fetch with enhanced resilience and diagnostics
     */
    async robustFetch(url: string, options: FetchOptions = {}): Promise<Response> {
        if (this.isHalted) {
            throw new Error('Network driver is HALTED due to persistent failures.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

        try {
            const headers = new Headers(options.headers || {});
            headers.set('X-Swarm-Version', '1.1.1');
            headers.set('X-Bee-Id', this.workerId);

            // AUTO-AUTH: Inject Authorization header if missing and apiKey exists
            if (!headers.has('Authorization') && this.apiKey) {
                headers.set('Authorization', `Bearer ${this.apiKey}`);
            }

            // Normalize localhost to 127.0.0.1 to avoid long DNS lookups/IPv6 issues in some Node envs
            const normalizedUrl = url.replace('localhost', '127.0.0.1');

            const response = await fetch(normalizedUrl, {
                ...options,
                headers,
                signal: controller.signal
            });

            if (!response.ok) {
                // KILL SWITCH: 401 means the key is wrong or missing. Hard exit.
                if (response.status === 401) {
                    const keyHash = this.apiKey ? this.apiKey.substring(0, 4) + '...' + this.apiKey.substring(this.apiKey.length - 4) : 'none';
                    console.error(`\n################################################################################`);
                    console.error(`#                                                                              #`);
                    console.error(`#                     🛑 FATAL AUTHENTICATION ERROR 🛑                     #`);
                    console.error(`#                                                                              #`);
                    console.error(`################################################################################\n`);
                    console.error(`[FATAL] 401 Unauthorized from ${normalizedUrl}`);
                    console.error(`[FATAL] Key Hint: ${keyHash}`);
                    console.error(`[FATAL] Check secrets sync and environment flags.`);
                    console.error(`[FATAL] KILLING PROCESS TO PREVENT 401 LOOP OF DEATH.\n`);
                    process.exit(1);
                }

                // Consider 429s and 5xx as "failures" that should trigger backoff
                if (response.status === 429 || response.status >= 500) {
                    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    (error as any).status = response.status;
                    (error as any).response = response;
                    throw error;
                }
            }

            this.resetBackoff();
            return response;

        } catch (error: any) {
            this.handleError(url, error);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Calculates the next delay with exponential backoff + jitter
     */
    getNextDelay(): number {
        this.consecutiveFailures++;
        this.totalFailures++;

        if (this.totalFailures >= NetworkDriver.MAX_TOTAL_FAILURES) {
            this.halt('Maximum network failures reached. Swarm agent is being "stupid" and will stop trying.');
            return NetworkDriver.MAX_DELAY;
        }

        const expBackoff = NetworkDriver.BASE_DELAY * Math.pow(2, Math.min(this.consecutiveFailures, 6));
        const jitter = Math.random() * 1000; // Small jitter for base
        const fullJitter = Math.random() * expBackoff * 0.2; // 20% jitter

        this.currentDelay = Math.min(NetworkDriver.MAX_DELAY, expBackoff + fullJitter + jitter);
        return this.currentDelay;
    }

    resetBackoff() {
        this.consecutiveFailures = 0;
        this.totalFailures = 0; // Reset total on success
        this.currentDelay = NetworkDriver.BASE_DELAY;
    }

    private halt(reason: string) {
        this.isHalted = true;
        const banner = `
################################################################################
#                                                                              #
#                      🚧 SWARM CIRCUIT BREAKER TRIPPED 🚧                     #
#                                                                              #
################################################################################

REASON: ${reason}
TOTAL FAILURES: ${this.totalFailures}

THE DRIVER HAS STOPPED ALL NETWORK REQUESTS TO PREVENT BLIND REPETITION.
INVESTIGATION REQUIRED: Check logs, router status, and network connectivity.

################################################################################
`;
        console.error(banner);
    }

    private handleError(url: string, error: any) {
        const message = error.message;
        const cause = error.cause;
        const code = cause?.code || 'UNKNOWN';

        console.error(`\n[${this.workerId}] 🌊 Network Failure Detected`);
        console.error(`Target: ${url}`);

        if (code === 'ECONNREFUSED') {
            console.error(`Reason: Connection refused. Is the router running on that port?`);
        } else if (code === 'ETIMEDOUT') {
            console.error(`Reason: Request timed out. Router might be overloaded.`);
        } else if (code === 'ENOTFOUND') {
            console.error(`Reason: DNS lookup failed. Check your ROUTER_URL.`);
        } else if (error.name === 'AbortError') {
            console.error(`Reason: Request aborted due to timeout.`);
        } else {
            console.error(`Reason: ${message}`);
            if (cause) console.error(`Cause: ${JSON.stringify(cause)}`);
        }

        console.error(`Status: Increased backoff to ${Math.round(this.currentDelay / 1000)}s\n`);
    }
}
