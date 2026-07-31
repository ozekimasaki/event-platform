import type { Env } from '../services/supabase.js';
import { getAdminClient } from '../services/supabase.js';
import { saveChatMessage } from '../services/chat.js';

/**
 * EventChatRoom Durable Object
 *
 * Real-time chat room for events using WebSocket Hibernation API.
 * Tracks connected clients, persists messages to Supabase, and broadcasts to all clients.
 */
export class EventChatRoom {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade request
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      this.state.acceptWebSocket(server);

      // Track connection metadata
      const userId = url.searchParams.get('userId') ?? 'anonymous';
      const userName = url.searchParams.get('userName') ?? 'Guest';
      await this.state.storage.put(`ws:${userId}:${Date.now()}`, { userId, userName, connectedAt: new Date().toISOString() });

      // Send join event to all connected clients
      const joinMsg = JSON.stringify({
        type: 'join',
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });
      this.broadcast(joinMsg);

      return new Response(null, { status: 101, webSocket: client });
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

      // Ping/Pong for keepalive
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        return;
      }

      // Chat message
      if (msg.type === 'chat') {
        const { userId, userName, body } = msg as { type: string; userId: string; userName: string; body: string };

        if (!body || typeof body !== 'string' || body.trim().length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'Message body is required' }));
          return;
        }

        // Persist to Supabase
        const eventId = this.state.id.toString();
        try {
          const supabase = getAdminClient(this.env);
          await saveChatMessage(eventId, userId, userName, body.trim(), supabase);
        } catch (err) {
          console.error('Failed to persist chat message:', err);
        }

        // Broadcast to all connected clients
        const chatMsg = JSON.stringify({
          type: 'chat',
          userId,
          userName,
          body: body.trim(),
          timestamp: new Date().toISOString(),
        });
        this.broadcast(chatMsg);
        return;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    console.log(`WebSocket closed: code=${code}, clean=${wasClean}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  // ============================================
  // BROADCAST HELPER
  // ============================================

  private broadcast(message: string): void {
    const webSockets = this.state.getWebSockets();
    for (const ws of webSockets) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('Failed to send to WebSocket:', err);
      }
    }
  }
}
