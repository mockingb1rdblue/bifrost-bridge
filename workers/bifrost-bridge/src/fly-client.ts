export interface FlyMachineConfig {
  image: string;
  guest?: {
    cpu_kind: string;
    cpus: number;
    memory_mb: number;
  };
  auto_destroy?: boolean;
  restart?: {
    policy: 'no' | 'on-failure' | 'always';
  };
  mounts?: {
    volume: string;
    path: string;
  }[];
  env?: Record<string, string>;
  metadata?: Record<string, string>;
}

/**
 *
 */
export class FlyClient {
  private apiToken: string;
  private baseUrl = 'https://api.machines.dev/v1/apps';

  /**
   *
   */
  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fly API Error ${response.status}: ${errorText}`);
    }
    return response.json();
  }

  /**
   *
   */
  async listMachines(appName: string) {
    return this.request(`/${appName}/machines`);
  }

  /**
   *
   */
  async getMachine(appName: string, machineId: string) {
    return this.request(`/${appName}/machines/${machineId}`);
  }

  /**
   *
   */
  async createMachine(appName: string, config: FlyMachineConfig) {
    return this.request(`/${appName}/machines`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
  }

  /**
   *
   */
  async startMachine(appName: string, machineId: string) {
    return this.request(`/${appName}/machines/${machineId}/start`, {
      method: 'POST',
    });
  }

  /**
   *
   */
  async stopMachine(appName: string, machineId: string) {
    return this.request(`/${appName}/machines/${machineId}/stop`, {
      method: 'POST',
    });
  }

  /**
   *
   */
  async destroyMachine(appName: string, machineId: string, force = false) {
    return this.request(`/${appName}/machines/${machineId}?force=${force}`, {
      method: 'DELETE',
    });
  }

  /**
   *
   */
  async waitForMachineState(
    appName: string,
    machineId: string,
    targetState: string,
    timeoutMs = 60000,
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const machine = (await this.getMachine(appName, machineId)) as any; // Cast to any for quick access
      if (machine.state === targetState) {
        return machine;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timeout waiting for machine ${machineId} to reach state ${targetState}`);
  }

  // Volume Management
  /**
   *
   */
  async listVolumes(appName: string) {
    return this.request(`/${appName}/volumes`);
  }

  /**
   *
   */
  async createVolume(appName: string, name: string, region: string, sizeGb: number) {
    return this.request(`/${appName}/volumes`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        region,
        size_gb: sizeGb,
        encrypted: true,
      }),
    });
  }
}
