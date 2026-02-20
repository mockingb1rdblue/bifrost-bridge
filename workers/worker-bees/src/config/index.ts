export const config = {
  ROUTER_URL: process.env.ROUTER_URL || 'http://localhost:8787',
  PROXY_API_KEY: process.env.PROXY_API_KEY || 'dev-key',
  // In a Node environment (Fly.io), we can inherit process.env safely here
  // and export it for handlers that need to set child process envs.
  PROCESS_ENV: { ...process.env },
};
