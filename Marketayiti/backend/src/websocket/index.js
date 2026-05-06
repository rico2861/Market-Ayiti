const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');

/**
 * WebSocket server with channel-based pub/sub.
 *
 * Client subscribes:  { type: 'subscribe',   channel: 'markets' }
 * Client subscribes:  { type: 'subscribe',   channel: 'market:<id>' }
 * Client unsubs:      { type: 'unsubscribe', channel: '...' }
 * Server broadcasts:  { type: 'market:update', market_id, yes_prob, ... }
 *
 * Each broadcast goes to all clients subscribed to either:
 *   - 'markets' (global channel)
 *   - 'market:<market_id>' (specific market)
 */
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // ws → Set<channel>
  const subscriptions = new Map();

  wss.on('connection', (ws, req) => {
    subscriptions.set(ws, new Set(['markets']));
    logger.info(`WS connected: ${req.socket.remoteAddress}`);

    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));

    // Keep-alive ping
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString().slice(0, 500));
        const channels = subscriptions.get(ws);

        if (msg.type === 'subscribe' && typeof msg.channel === 'string') {
          channels.add(msg.channel);
          ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        } else if (msg.type === 'unsubscribe' && typeof msg.channel === 'string') {
          channels.delete(msg.channel);
          ws.send(JSON.stringify({ type: 'unsubscribed', channel: msg.channel }));
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      subscriptions.delete(ws);
    });

    ws.on('error', (e) => {
      logger.error('WS error: ' + e.message);
      subscriptions.delete(ws);
    });
  });

  // Periodic heartbeat to clean dead connections
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        subscriptions.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  /**
   * Broadcast a payload to all clients subscribed to relevant channels.
   * Determines target channels from the payload type.
   */
  function broadcast(payload) {
    const data = JSON.stringify(payload);
    const targetChannels = ['markets']; // always broadcast to global

    if (payload.market_id) {
      targetChannels.push(`market:${payload.market_id}`);
    }

    for (const [ws, channels] of subscriptions.entries()) {
      if (ws.readyState !== ws.OPEN) continue;
      const isSubscribed = targetChannels.some(c => channels.has(c));
      if (isSubscribed) {
        try { ws.send(data); } catch {}
      }
    }
  }

  return { wss, broadcast };
}

module.exports = { setupWebSocket };
