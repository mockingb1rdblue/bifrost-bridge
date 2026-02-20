/**
 *
 */
export class EventStoreClient {
  private secret: string;
  private baseUrl: string; // e.g. http://bifrost-events.flycast:8080

  /**
   * Initializes a new instance of the EventStoreClient.
   * @param config - The configuration for the client.
   * @param config.secret - The authorization token for the event store.
   * @param config.baseUrl - The base URL of the event store (e.g., http://bifrost-events.flycast:8080).
   */
  constructor(config: { secret: string; baseUrl: string }) {
    this.secret = config.secret;
    this.baseUrl = config.baseUrl;
  }

  /**
   * Appends a new event to the event store.
   * @param event - The event object to append.
   * @param event.type - The type of event (e.g., 'JOB_CREATED').
   * @param event.source - The service that generated the event.
   * @param event.topic - Optional topic for event grouping/state replay.
   * @param event.correlation_id - Optional correlation ID for tracing across services.
   * @param event.payload - The event data.
   * @param event.meta - Optional metadata.
   * @returns Promise<void>
   */
  /**
   * Performs a fetch with a strict timeout.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = 3000,
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  /**
   *
   */
  async append(event: {
    type: string;
    source: string;
    topic?: string;
    correlation_id?: string;
    payload: any;
    meta?: any;
  }) {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        console.error(`EventStore error: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      console.error('EventStore connection failed (timeout or network):', e);
    }
  }

  /**
   * Retrieves the reconstructed state for a specific topic.
   * @param topic - The topic to replay and reconstruct state for.
   * @returns Promise<any | null> The reconstructed state object or null if failed.
   */
  async getState(topic: string) {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/state/${topic}`,
        {
          headers: { Authorization: `Bearer ${this.secret}` },
        },
        2000, // Shorter timeout for state retrieval
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('EventStore getState failed (timeout or network):', e);
    }
    return null;
  }
}
