const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');

/**
 * WebSocket server with channel-based pub/sub and connection tracking.
 *
 * Client subscribes:  { type: 'subscribe',   channel: 'markets' }
 * Client subscribes:  { type: 'subscribe',   channel: 'market:<id>' }
 * Client subscribes:  { type: 'subscribe',   channel: 'categories' }
 * Client unsubs:      { type: 'unsubscribe', channel: '...' }
 * Server broadcasts:  { type: 'market:update', market_id, yes_prob, ... }
 * Server broadcasts:  { type: 'categories:update', categories: [...] }
 *
 * Each broadcast goes to all clients subscribed to either:
 *   - 'markets'           (global market channel)
 *   - 'market:<market_id>'(specific market)
 *   - 'categories'        (category metadata channel)
 */
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // ws → Set<channel>
  const subscriptions = new Map();

  // Running message version — increments on every broadcast so clients can detect gaps
  let broadcastVersion = 0;

  wss.on('connection', (ws, req) => {
    subscriptions.set(ws, new Set(['markets']));
    logger.info(`WS connected (${subscriptions.size} total): ${req.socket.remoteAddress}`);

    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now(),
      connections: subscriptions.size,
    }));

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
      logger.info(`WS disconnected (${subscriptions.size} remaining)`);
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
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  /**
   * Broadcast a payload to all clients subscribed to relevant channels.
   * Automatically attaches the current version number.
   */
  function broadcast(payload) {
    broadcastVersion++;
    const enriched = { ...payload, version: broadcastVersion, timestamp: Date.now() };
    const data = JSON.stringify(enriched);

    // Determine target channels from the payload type
    const targetChannels = [];
    const USER_SPECIFIC = ['notification:new', 'user:balance_update'];
    if (USER_SPECIFIC.includes(payload.type)) {
      // User-specific: only send to the target user's channel
      if (payload.user_id) targetChannels.push(`user:${payload.user_id}`);
    } else {
      targetChannels.push('markets'); // global market channel
      if (payload.market_id) targetChannels.push(`market:${payload.market_id}`);
      if (payload.type === 'categories:update') targetChannels.push('categories');
    }

    let sent = 0;
    for (const [ws, channels] of subscriptions.entries()) {
      if (ws.readyState !== ws.OPEN) continue;
      if (targetChannels.some(c => channels.has(c))) {
        try { ws.send(data); sent++; } catch {}
      }
    }

    logger.debug(`WS broadcast v${broadcastVersion} type="${payload.type}" → ${sent} clients`);
    return broadcastVersion;
  }

  /**
   * Number of currently open connections.
   */
  function getConnectionCount() {
    return subscriptions.size;
  }

  return { wss, broadcast, getConnectionCount };
}

module.exports = { setupWebSocket };
