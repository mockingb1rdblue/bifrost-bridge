export class EventStoreClient {
  private secret: string;
  private baseUrl: string; // e.g. http://bifrost-events.flycast:8080

  constructor(config: { secret: string; baseUrl: string }) {
    this.secret = config.secret;
    this.baseUrl = config.baseUrl;
  }

  async append(event: { type: string; source: string; payload: any; meta?: any }) {
    try {
      const res = await fetch(`${this.baseUrl}/events`, {
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
      console.error('EventStore connection failed:', e);
    }
  }
}
