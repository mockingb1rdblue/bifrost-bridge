import { FlyClient, FlyMachineConfig } from './fly-client';

/**
 *
 */
export class SpriteManager {
  private fly: FlyClient;
  private runnerApp = 'bifrost-runner'; // The app where Sprites run
  private region = 'ord'; // Default region

  /**
   *
   */
  constructor(apiToken: string) {
    this.fly = new FlyClient(apiToken);
  }

  /**
   * Spawns or resumes a unique Sprite for a given repository.
   * Logic:
   * 1. Check if a Sprite (Machine) already exists for this repo (via metadata).
   * 2. If exists:
   *    a. If stopped, start it.
   *    b. If running, return it.
   * 3. If not exists:
   *    a. Ensure Volume exists for persistence.
   *    b. Create new Machine mounting that volume.
   */
  async spawnSprite(repoUrl: string) {
    const repoHash = this.hashString(repoUrl);
    const machineName = `sprite-${repoHash}`;
    const volumeName = `vol_${repoHash}`;

    // 1. Check for existing machine
    // Note: Listing all machines might be slow at scale, in production we use KV or metadata filtering
    const machines = (await this.fly.listMachines(this.runnerApp)) as any[];
    const existingMachine = machines.find((m: any) => m.config?.metadata?.repo_url === repoUrl);

    if (existingMachine) {
      console.log(`Found existing Sprite ${existingMachine.id} for ${repoUrl}`);
      if (existingMachine.state === 'stopped') {
        console.log(`Resuming Sprite ${existingMachine.id}...`);
        await this.fly.startMachine(this.runnerApp, existingMachine.id);
        await this.fly.waitForMachineState(this.runnerApp, existingMachine.id, 'started');
      }
      return existingMachine;
    }

    // 2. Create new Sprite
    console.log(`Creating new Sprite for ${repoUrl}...`);

    // a. Ensure Volume
    /*
     * NOTE: Volume creation via API might be idempotent or need check.
     * Listing volumes to check existence.
     */
    const volumes = (await this.fly.listVolumes(this.runnerApp)) as any[];
    let volume = volumes.find((v: any) => v.name === volumeName);

    if (!volume) {
      console.log(`Context volume ${volumeName} not found, creating...`);
      try {
        volume = await this.fly.createVolume(this.runnerApp, volumeName, this.region, 1); // 1GB persistent storage
      } catch (e) {
        console.error(
          `Failed to create volume, proceeding without persistence or handling error: ${e}`,
        );
        // Fallback or re-throw
      }
    }

    // b. Create Machine
    // We use the image currently deployed to bifrost-runner (registry.fly.io/bifrost-runner:latest)
    // Or we can specify specific tag.

    const config: FlyMachineConfig = {
      image: 'registry.fly.io/bifrost-runner:latest', // Assumes image exists
      guest: {
        cpu_kind: 'shared',
        cpus: 1,
        memory_mb: 512,
      },
      auto_destroy: false, // Persistent machine
      mounts: volume
        ? [
            {
              volume: volume.id,
              path: '/workspace',
            },
          ]
        : [],
      env: {
        REPO_URL: repoUrl,
        BIFROST_ROLE: 'sprite',
      },
      metadata: {
        repo_url: repoUrl,
        type: 'sprite',
      },
    };

    const newMachine = await this.fly.createMachine(this.runnerApp, config);
    console.log(`Created Sprite ${newMachine.id}`);

    // Wait for start? createMachine returns immediate state (created), often need to start it?
    // Machines API create usually starts it by default unless configured otherwise.

    return newMachine;
  }

  // Simple string hash for naming (non-crypto is fine for this)
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
