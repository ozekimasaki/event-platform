import type { Env } from '../services/supabase.js';

/**
 * CheckInCoordinator Durable Object
 *
 * Coordinates check-in operations for events using WebSocket Hibernation API.
 * Tracks connected clients per event and broadcasts real-time check-in updates.
 */
export class CheckInCoordinator {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // WebSocket upgrade request
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      this.state.acceptWebSocket(server);

      // Track connection metadata
      const eventId = url.searchParams.get('eventId') ?? 'unknown';
      await this.state.storage.put(`ws:${server.serializeAttachment({ eventId, connectedAt: new Date().toISOString() })}`, true);

      return new Response(null, { status: 101, webSocket: client });
    }

    // REST endpoints for direct operations
    if (method === 'POST' && url.pathname.endsWith('/check-in')) {
      return this.handleCheckIn(request);
    }

    if (method === 'POST' && url.pathname.endsWith('/check-out')) {
      return this.handleCheckOut(request);
    }

    if (method === 'GET' && url.pathname.endsWith('/status')) {
      return this.handleGetStatus(request);
    }

    // Broadcast endpoint for check-in events
    if (method === 'POST' && url.pathname.endsWith('/check-in-broadcast')) {
      return this.handleBroadcast(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  // ============================================
  // WEBSOCKET HIBERNATION HANDLERS
  // ============================================

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const msg = JSON.parse(msgStr) as { type: string; [key: string]: unknown };

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        return;
      }

      if (msg.type === 'get-status') {
        // Return current check-in stats from storage
        const stats = await this.getStatsFromStorage();
        ws.send(JSON.stringify({ type: 'status', ...stats }));
        return;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Clean up: remove any connection-specific data
    // The Durable Object automatically removes the WebSocket from the list
    console.log(`WebSocket closed: code=${code}, clean=${wasClean}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  // ============================================
  // BROADCAST HELPER
  // ============================================

  private async handleBroadcast(request: Request): Promise<Response> {
    const body = await request.json() as {
      type: string;
      checkedInAt: string;
      userId: string;
    };

    // Update persistent count
    const currentCount = (await this.state.storage.get<number>('checkedInCount')) ?? 0;
    const newCount = currentCount + 1;
    await this.state.storage.put('checkedInCount', newCount);

    // Get total from storage
    const total = (await this.state.storage.get<number>('totalRegistrations')) ?? 0;

    // Broadcast to all connected WebSockets
    const message = JSON.stringify({
      type: 'check-in-update',
      checkedIn: newCount,
      total,
      latestCheckIn: {
        name: body.userId.substring(0, 8),
        timestamp: body.checkedInAt,
      },
    });

    const webSockets = this.state.getWebSockets();
    for (const ws of webSockets) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('Failed to send to WebSocket:', err);
      }
    }

    return new Response(JSON.stringify({ success: true, checkedIn: newCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============================================
  // STORAGE-BASED STATS
  // ============================================

  private async getStatsFromStorage(): Promise<{ checkedIn: number; total: number }> {
    const checkedIn = (await this.state.storage.get<number>('checkedInCount')) ?? 0;
    const total = (await this.state.storage.get<number>('totalRegistrations')) ?? 0;
    return { checkedIn, total };
  }

  // ============================================
  // REST HANDLERS (existing functionality)
  // ============================================

  private async handleCheckIn(request: Request): Promise<Response> {
    const { registrationId, staffId } = await request.json() as {
      registrationId: string;
      staffId: string;
    };

    const storage = this.state.storage;
    const key = `checkin:${registrationId}`;
    const existing = await storage.get<string>(key);

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'ALREADY_CHECKED_IN', message: 'Registration already checked in' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await storage.put(key, JSON.stringify({
      registrationId,
      staffId,
      checkedInAt: new Date().toISOString(),
    }));

    // Update count
    const currentCount = (await storage.get<number>('checkedInCount')) ?? 0;
    await storage.put('checkedInCount', currentCount + 1);

    return new Response(
      JSON.stringify({
        success: true,
        data: { registrationId, checkedInAt: new Date().toISOString() },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async handleCheckOut(request: Request): Promise<Response> {
    const { registrationId } = await request.json() as { registrationId: string };

    const storage = this.state.storage;
    const key = `checkin:${registrationId}`;
    await storage.delete(key);

    // Update count
    const currentCount = (await storage.get<number>('checkedInCount')) ?? 0;
    await storage.put('checkedInCount', Math.max(0, currentCount - 1));

    return new Response(
      JSON.stringify({
        success: true,
        data: { registrationId, checkedOutAt: new Date().toISOString() },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async handleGetStatus(_request: Request): Promise<Response> {
    const stats = await this.getStatsFromStorage();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          checkedIn: stats.checkedIn,
          total: stats.total,
          pending: Math.max(0, stats.total - stats.checkedIn),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
