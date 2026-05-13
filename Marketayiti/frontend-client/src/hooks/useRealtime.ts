import { useEffect, useRef, useCallback } from 'react';

type WSMessage =
  | { type: 'connected'; timestamp: number }
  | { type: 'subscribed' | 'unsubscribed'; channel: string }
  | { type: 'pong'; timestamp: number }
  | {
      type: 'market:update';
      market_id: string;
      slug: string;
      yes_prob: number;
      no_prob: number;
      local_volume: number;
      bet_count: number;
    }
  | { type: 'market:resolved'; market_id: string; resolution: 'yes' | 'no' }
  | { type: 'market:new'; data: { polymarket_id: string; title: string; category: string } }
  | { type: 'polymarket:sync'; data: { created: number; updated: number; resolved: number } };

interface UseWebSocketOptions {
  channels?: string[];
  onMessage?: (msg: WSMessage) => void;
  enabled?: boolean;
}

/**
 * Real-time WebSocket with exponential backoff.
 * Retries: 2s → 4s → 8s → 16s → 30s (cap, stays at 30s)
 * Stops cleanly on component unmount.
 */
export function useWebSocket({
  channels = ['markets'],
  onMessage,
  enabled = true
}: UseWebSocketOptions = {}) {
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCount   = useRef(0);
  const unmounted    = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Stable key: sorted channels joined, only re-connects when channels change
  const channelsKey = [...channels].sort().join(',');

  const connect = useCallback(() => {
    if (!enabled || unmounted.current) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url   = `${proto}//${window.location.host}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      // Browser blocks WS (HTTPS-only context, etc.) — give up silently
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      // Connected — reset backoff counter
      retryCount.current = 0;
      channelsKey.split(',').filter(Boolean).forEach(ch => {
        ws.send(JSON.stringify({ type: 'subscribe', channel: ch }));
      });
    };

    ws.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data);
        onMessageRef.current?.(msg);
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!enabled || unmounted.current) return;
      // Exponential backoff starting at 2s, capped at 30s
      // 2s, 4s, 8s, 16s, 30s, 30s, 30s...
      const delay = Math.min(2000 * Math.pow(2, retryCount.current), 30_000);
      retryCount.current = Math.min(retryCount.current + 1, 10); // cap counter
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => { /* onclose handles retry */ };
  }, [enabled, channelsKey]);

  useEffect(() => {
    unmounted.current = false;
    retryCount.current = 0;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent retry on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}

/**
 * Subscribe to live price updates for a specific market.
 */
export function useMarketRealtime(
  marketId: string,
  onUpdate: (data: {
    yes_prob: number;
    no_prob: number;
    local_volume: number;
    bet_count: number;
  }) => void
) {
  useWebSocket({
    channels: ['markets', `market:${marketId}`],
    onMessage: (msg) => {
      if (msg.type === 'market:update' && msg.market_id === marketId) {
        onUpdate({
          yes_prob:     msg.yes_prob,
          no_prob:      msg.no_prob,
          local_volume: msg.local_volume,
          bet_count:    msg.bet_count
        });
      }
    }
  });
}
