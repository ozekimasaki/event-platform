import type { Env } from '../services/supabase.js';

/**
 * CheckInCoordinator Durable Object
 *
 * Coordinates check-in operations for events to prevent race conditions
 * and ensure atomic check-in/check-out operations.
 */
export class CheckInCoordinator {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'POST' && url.pathname.endsWith('/check-in')) {
      return this.handleCheckIn(request);
    }

    if (method === 'POST' && url.pathname.endsWith('/check-out')) {
      return this.handleCheckOut(request);
    }

    if (method === 'GET' && url.pathname.endsWith('/status')) {
      return this.handleGetStatus(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleCheckIn(request: Request): Promise<Response> {
    const { registrationId, staffId } = await request.json() as {
      registrationId: string;
      staffId: string;
    };

    // Use storage for atomic operations
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

    // Store check-in
    await storage.put(key, JSON.stringify({
      registrationId,
      staffId,
      checkedInAt: new Date().toISOString(),
    }));

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

    return new Response(
      JSON.stringify({
        success: true,
        data: { registrationId, checkedOutAt: new Date().toISOString() },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async handleGetStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const registrationId = url.searchParams.get('registrationId');

    if (!registrationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'MISSING_PARAM', message: 'registrationId is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const storage = this.state.storage;
    const key = `checkin:${registrationId}`;
    const data = await storage.get<string>(key);

    return new Response(
      JSON.stringify({
        success: true,
        data: { registrationId, isCheckedIn: !!data, checkInData: data ? JSON.parse(data) : null },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
