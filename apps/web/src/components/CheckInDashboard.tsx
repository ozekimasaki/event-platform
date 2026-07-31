import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

interface CheckInDashboardProps {
  eventId: string;
  eventSlug: string;
  apiBaseUrl: string;
  accessToken: string;
}

interface CheckInUpdate {
  type: string;
  checkedIn: number;
  total: number;
  latestCheckIn?: {
    name: string;
    timestamp: string;
  };
}

// ============================================
// CHECK-IN DASHBOARD COMPONENT
// ============================================

const CheckInDashboard: React.FC<CheckInDashboardProps> = ({
  eventId,
  eventSlug,
  apiBaseUrl,
  accessToken,
}) => {
  const [checkedIn, setCheckedIn] = useState(0);
  const [total, setTotal] = useState(0);
  const [latestCheckIn, setLatestCheckIn] = useState<{ name: string; timestamp: string } | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<{ name: string; timestamp: string }[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Fetch initial status via REST
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/events/${eventSlug}/check-in/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCheckedIn(json.data.checked_in);
          setTotal(json.data.total);
        }
      }
    } catch (err) {
      console.error('Failed to fetch check-in status:', err);
    }
  }, [apiBaseUrl, eventSlug, accessToken]);

  // Fetch recent check-ins
  const fetchRecentCheckIns = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/events/${eventSlug}/check-in/log`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const items = (json.data as any[]).slice(0, 10).map((entry) => ({
            name: entry.user_id?.substring(0, 8) ?? 'Unknown',
            timestamp: entry.checked_in_at,
          }));
          setRecentCheckIns(items);
        }
      }
    } catch (err) {
      console.error('Failed to fetch check-in log:', err);
    }
  }, [apiBaseUrl, eventSlug, accessToken]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = apiBaseUrl.replace(/^http/, 'ws');
      const ws = new WebSocket(`${wsUrl}/ws/event/${eventId}/checkin`);

      ws.onopen = () => {
        setIsConnected(true);
        // Request current status
        ws.send(JSON.stringify({ type: 'get-status' }));
        // Start ping interval
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
        ws.addEventListener('close', () => clearInterval(pingInterval));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as CheckInUpdate;
          if (msg.type === 'check-in-update') {
            setCheckedIn(msg.checkedIn);
            setTotal(msg.total);
            if (msg.latestCheckIn) {
              setLatestCheckIn(msg.latestCheckIn);
              setRecentCheckIns((prev) => [msg.latestCheckIn!, ...prev].slice(0, 10));
            }
            // Trigger animation
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 600);
          } else if (msg.type === 'status') {
            setCheckedIn(msg.checkedIn ?? 0);
            setTotal(msg.total ?? 0);
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket connection error:', err);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    }
  }, [apiBaseUrl, eventId]);

  useEffect(() => {
    fetchStatus();
    fetchRecentCheckIns();
    connectWebSocket();

    // Poll status every 15 seconds as fallback
    pollIntervalRef.current = setInterval(fetchStatus, 15000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [connectWebSocket, fetchStatus, fetchRecentCheckIns]);

  const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  return (
    <div
      className="flex flex-col gap-6"
      style={{ color: 'var(--color-text-primary)' }}
    >
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: isConnected ? '#22c55e' : '#ef4444',
          }}
        />
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {isConnected ? 'リアルタイム接続中' : '接続切断'}
        </span>
      </div>

      {/* Main counter */}
      <div
        className="flex flex-col items-center justify-center p-8 rounded-sm"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <div
          className="transition-transform duration-300"
          style={{
            transform: isAnimating ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <span
            className="text-6xl font-bold tabular-nums"
            style={{ color: 'var(--color-accent-blue)' }}
          >
            {checkedIn}
          </span>
          <span
            className="text-2xl font-medium mx-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            /
          </span>
          <span
            className="text-4xl font-medium tabular-nums"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {total}
          </span>
        </div>
        <p
          className="mt-3 text-base"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          名チェックイン済み
        </p>

        {/* Progress bar */}
        <div
          className="w-full mt-4 h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface-medium)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${attendanceRate}%`,
              backgroundColor: 'var(--color-accent-blue)',
            }}
          />
        </div>
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          出席率: {attendanceRate}%
        </p>
      </div>

      {/* Latest check-in */}
      {latestCheckIn && (
        <div
          className="flex items-center gap-3 p-4 rounded-sm"
          style={{
            backgroundColor: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22c55e' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              最新のチェックイン
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {latestCheckIn.name} — {new Date(latestCheckIn.timestamp).toLocaleTimeString('ja-JP')}
            </p>
          </div>
        </div>
      )}

      {/* Recent check-ins list */}
      {recentCheckIns.length > 0 && (
        <div
          className="rounded-sm overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <div
            className="px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-surface-medium)',
              borderBottom: '1px solid var(--color-border-default)',
            }}
          >
            最近のチェックイン
          </div>
          <ul>
            {recentCheckIns.map((item, i) => (
              <li
                key={`${item.timestamp}-${i}`}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
                style={{
                  borderBottom: i < recentCheckIns.length - 1 ? '1px solid var(--color-border-default)' : 'none',
                }}
              >
                <span style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(item.timestamp).toLocaleTimeString('ja-JP')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CheckInDashboard;
