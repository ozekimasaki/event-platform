import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

interface EventChatProps {
  eventId: string;
  apiBaseUrl: string;
  accessToken?: string;
  userName?: string;
  userId?: string;
}

interface ChatMessage {
  id?: string;
  userId: string;
  userName: string;
  body: string;
  timestamp: string;
  type?: string;
}

// ============================================
// EVENT CHAT COMPONENT
// ============================================

const EventChat: React.FC<EventChatProps> = ({
  eventId,
  apiBaseUrl,
  accessToken,
  userName = 'Guest',
  userId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const effectiveUserId = userId ?? 'anonymous';

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch chat history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/events/${eventId}/chat/history?limit=100`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const historyMessages = (json.data as any[]).reverse().map((m) => ({
              id: m.id,
              userId: m.user_id,
              userName: m.user_name,
              body: m.body,
              timestamp: m.created_at,
              type: 'chat',
            }));
            setMessages(historyMessages);
          }
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [apiBaseUrl, eventId]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = apiBaseUrl.replace(/^http/, 'ws');
      const params = new URLSearchParams({ userId: effectiveUserId, userName });
      const ws = new WebSocket(`${wsUrl}/ws/event/${eventId}/chat?${params.toString()}`);

      ws.onopen = () => {
        setIsConnected(true);
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
          const msg = JSON.parse(event.data) as ChatMessage & { type: string };
          if (msg.type === 'chat') {
            setMessages((prev) => [...prev, {
              id: undefined,
              userId: msg.userId,
              userName: msg.userName,
              body: msg.body,
              timestamp: msg.timestamp,
              type: 'chat',
            }]);
          } else if (msg.type === 'join') {
            // Optionally show join notification
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
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
  }, [apiBaseUrl, eventId, effectiveUserId, userName]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const sendMessage = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !inputValue.trim()) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'chat',
      userId: effectiveUserId,
      userName,
      body: inputValue.trim(),
    }));

    setInputValue('');
  }, [inputValue, effectiveUserId, userName]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOwnMessage = (msgUserId: string) => msgUserId === effectiveUserId;

  return (
    <div
      className="flex flex-col h-full rounded-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-default)',
        height: '500px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: 'var(--color-surface-medium)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-accent-blue)' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            イベントチャット
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: isConnected ? '#22c55e' : '#ef4444' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {isConnected ? '接続中' : '切断'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              読み込み中...
            </span>
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              まだメッセージがありません。最初のメッセージを送信しましょう！
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={`${msg.timestamp}-${i}`}
            className={`flex flex-col ${isOwnMessage(msg.userId) ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {!isOwnMessage(msg.userId) && (
                <span className="text-xs font-medium" style={{ color: 'var(--color-accent-blue)' }}>
                  {msg.userName}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div
              className="px-3 py-2 rounded-sm max-w-[80%] text-sm break-words"
              style={{
                backgroundColor: isOwnMessage(msg.userId)
                  ? 'var(--color-accent-blue)'
                  : 'var(--color-surface-medium)',
                color: isOwnMessage(msg.userId)
                  ? '#ffffff'
                  : 'var(--color-text-primary)',
              }}
            >
              {msg.body}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3"
        style={{
          borderTop: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-surface-medium)',
        }}
      >
        {!accessToken ? (
          <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
            チャットに参加するにはログインが必要です
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="メッセージを入力..."
              className="flex-1 px-3 py-2 text-sm rounded-sm outline-none"
              style={{
                backgroundColor: 'var(--color-surface-base)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
              disabled={!isConnected}
              maxLength={500}
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected || !inputValue.trim()}
              className="px-4 py-2 text-sm font-medium rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-accent-blue)',
                color: '#ffffff',
              }}
            >
              送信
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventChat;
