import crypto from 'crypto';

/**
 * Authentication Helper for Sluagh Swarm Worker Bees
 */
export class AuthManager {
    private static readonly FALLBACK_KEY = 'ZqM8pQom487qZ@2e%qHdcCuTiGk!#XNq';

    static getApiKey(): string {
        const key = process.env.WORKER_API_KEY;
        const isDev = process.env.NODE_ENV === 'development' ||
            process.env.DEV_MODE === 'true' ||
            process.env.npm_lifecycle_event === 'dev';

        if (!key) {
            if (isDev) {
                console.warn('⚠️  WORKER_API_KEY not found. Using hardcoded fallback for local development.');
                return this.FALLBACK_KEY;
            } else {
                this.printDeathBanner('CRITICAL ERROR: WORKER_API_KEY environment variable is missing.');
                process.exit(1);
            }
        }

        return key;
    }

    static getKeyHash(key: string): string {
        // We now use the full SHA-256 hash for handshake verification
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    static printDeathBanner(reason: string, details?: any) {
        const banner = `
################################################################################
#                                                                              #
#                      🚨 SWARM AUTHENTICATION FAILURE 🚨                      #
#                                                                              #
################################################################################

REASON: ${reason}

${details ? JSON.stringify(details, null, 2) : ''}

INSTRUCTIONS:
1. Verify Fly.io secrets: 'fly secrets list --app bifrost-worker-bees'
2. Verify Cloudflare secrets: 'wrangler secret list' in workers/crypt-core
3. Run 'scripts/validate-auth-sync.sh' to check synchronization.

POLLING HAS BEEN PERMANENTLY DISABLED TO PREVENT 401 LOOP OF DEATH.
THE WORKER MUST BE RESTARTED AFTER FIXING THE SECRETS.

################################################################################
`;
        console.error(banner);
    }
}
