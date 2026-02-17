export class FlyClient {
  private token: string;
  private organizationId: string; // Optional if we just use app name
  private appName: string;

  constructor(config: { token: string; appName: string; organizationId?: string }) {
    this.token = config.token;
    this.appName = config.appName;
    this.organizationId = config.organizationId || '';
  }

  async spawnMachine(region = 'sea', metadata: Record<string, string> = {}) {
    // 1. Get Image (Optional, or assume latest)
    // 2. Create Machine
    const url = `https://api.machines.dev/v1/apps/${this.appName}/machines`;

    // Config for the machine
    const body = {
      region,
      config: {
        image: 'registry.fly.io/bifrost-runner:latest', // Ensure this image exists! Or use local image?
        // Actually we deployed bifrost-runner via 'fly deploy', so it has an image.
        // We can just rely on defaults or specify image if we know it.
        // Better: Clones an existing machine or uses the release image.
        // Simplest for now: Use the app's current release image if possible, or just specify the app and let Fly handle it?
        // Fly Machines API requires 'image'.
        // Workaround: We can fetch the latest machine config or just use a known tag.
        // For now, I'll assume registry.fly.io/<app>:latest works if we pushed it.
        // But 'fly deploy' might use a hash.
        // Let's try to list machines and clone one? Or just use 'auto' check?
        // Let's keep it simple: generic config.
        auto_destroy: true, // If supported, or we rely on the agent's idle timeout.
        env: {
          ...metadata,
        },
        guest: {
          cpu_kind: 'shared',
          cpus: 1,
          memory_mb: 256,
        },
      },
    };

    // To get the latest image, we might need to query the app info.
    // However, if we just want to spawn a machine, we can provide just image if we know it.
    // If not, we might fail.
    // PREFERRED: If we can't easily get the image, we can assume it's the one currently running?
    // Actually, if we use `fly deploy`, it creates machines.
    // Maybe we don't need to spawn?
    // Ah, the Implementation Plan says "Worker spawns Machine".
    // This allows scaling to 0.
    // If we scale to 0, there are no machines.
    // We need to CREATE a new machine using the release image.
    // Hack: We can just use the config of a "standby" machine or fetch the latest release.
    // Let's assume we can pass `image: registry.fly.io/bifrost-runner:latest` if we are tagging.
    // If not, we might need to look up the image.
    // Simple V1: Hardcoded or Env var for image.
  }

  // REVISION: 'spawnMachine' via API is complex if we don't know the image hash.
  // Alternative: Use `fly machines start <id>` if we keep stopped machines?
  // "Scale to Zero" usually means Fly stops them, and we start them.
  // So we can:
  // 1. List machines with status='stopped'.
  // 2. Start one.
  // 3. If none, create one (harder).

  // Let's try "Start Stopped Machine" first.
  async startRunner(): Promise<string | null> {
    const listUrl = `https://api.machines.dev/v1/apps/${this.appName}/machines?state=stopped`;
    try {
      const listRes = await fetch(listUrl, { headers: this.headers() });
      const machines = (await listRes.json()) as any[];

      if (machines && machines.length > 0) {
        const m = machines[0];
        const startUrl = `https://api.machines.dev/v1/apps/${this.appName}/machines/${m.id}/start`;
        await fetch(startUrl, { method: 'POST', headers: this.headers() });
        return m.id;
      }
      return null; // No stopped machines
    } catch (e) {
      console.error('FlyClient Error:', e);
      return null;
    }
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }
}
