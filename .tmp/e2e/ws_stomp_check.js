const WebSocket = require('ws');

const url = process.env.WS_URL || 'ws://localhost:18080/ws/live';
const token = process.env.ACCESS_TOKEN;
const viewport = process.env.VIEWPORT || '{"north":22.0,"south":20.0,"east":106.0,"west":105.0}';
const subscribeDest = process.env.SUB_DEST || '/user/topic/flights';
const timeoutMs = Number(process.env.TIMEOUT_MS || 20000);
const debugWs = process.env.DEBUG_WS === '1';

if (!token) {
  console.error('ACCESS_TOKEN is required');
  process.exit(2);
}

let done = false;
const ws = new WebSocket(url, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const fail = (msg) => {
  if (done) return;
  done = true;
  console.error(msg);
  try { ws.close(); } catch (_) {}
  process.exit(1);
};

const succeed = (payload) => {
  if (done) return;
  done = true;
  console.log(payload);
  try { ws.close(); } catch (_) {}
  process.exit(0);
};

const sendFrame = (frame) => ws.send(frame + '\u0000');

const timer = setTimeout(() => fail('timeout waiting for STOMP MESSAGE'), timeoutMs);

ws.on('open', () => {
  sendFrame(`CONNECT\naccept-version:1.2\nhost:localhost\nAuthorization:Bearer ${token}\n\n`);
});

ws.on('message', (data) => {
  const text = data.toString('utf8');
  if (debugWs) {
    console.error(`WS_FRAME=${JSON.stringify(text)}`);
  }
  const frames = text.split('\u0000').map((f) => f.trim()).filter(Boolean);
  for (const frame of frames) {
    if (frame.startsWith('ERROR')) {
      clearTimeout(timer);
      return fail(`stomp error: ${frame}`);
    }

    if (frame.startsWith('CONNECTED')) {
      sendFrame(`SUBSCRIBE\nid:sub-0\ndestination:${subscribeDest}\nack:auto\n\n`);
      sendFrame(`SEND\ndestination:/app/viewport\ncontent-type:application/json\n\n${viewport}`);
      continue;
    }

    if (frame.startsWith('MESSAGE')) {
      const parts = frame.split('\n\n');
      const body = parts.length > 1 ? parts.slice(1).join('\n\n').trim() : '';
      clearTimeout(timer);
      return succeed(body);
    }
  }
});

ws.on('error', (err) => fail(`websocket error: ${err.message}`));
ws.on('close', () => {
  if (!done) {
    clearTimeout(timer);
    fail('websocket closed before receiving message');
  }
});
