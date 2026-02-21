export const config = {
  PORT: process.env.PORT || 8080,
  ROUTER_URL: process.env.ROUTER_URL || 'http://localhost:8787',
  PROXY_API_KEY: process.env.PROXY_API_KEY || 'dev-key',
  LINEAR_API_KEY: process.env.LINEAR_API_KEY,
  // In a Node environment (Fly.io), we can inherit process.env safely here
  // and export it for handlers that need to set child process envs.
  PROCESS_ENV: { ...process.env },
};

// Debug: confirm key loaded
// Debug: confirm key loaded
console.log(`[Config] PROXY_API_KEY loaded: ${config.PROXY_API_KEY ? '✅ from config' : '❌ using fallback dev-key'}`);
