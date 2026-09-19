/** A minimal RESP2 server — just enough to prove the real client speaks to it. */
import { createServer } from 'node:net';

const hashes = new Map();
const enc = {
  simple: (s) => `+${s}\r\n`,
  int: (n) => `:${n}\r\n`,
  err: (s) => `-ERR ${s}\r\n`,
  bulk: (s) => (s === null ? '$-1\r\n' : `$${Buffer.byteLength(s)}\r\n${s}\r\n`),
  array: (items) => `*${items.length}\r\n` + items.map(enc.bulk).join(''),
  /** RESP3 map, which is what HGETALL returns once HELLO 3 is negotiated. */
  map: (obj) => {
    const entries = Object.entries(obj);
    return `%${entries.length}\r\n` + entries.map(([k, v]) => enc.bulk(k) + enc.bulk(v)).join('');
  },
};

function parse(buffer) {
  // Only inline arrays of bulk strings arrive from a client.
  const parts = buffer.toString().split('\r\n');
  const out = [];
  let i = 0;
  while (i < parts.length) {
    if (parts[i].startsWith('*')) {
      const n = Number(parts[i].slice(1));
      const args = [];
      let j = i + 1;
      for (let k = 0; k < n; k++) { args.push(parts[j + 1]); j += 2; }
      out.push(args);
      i = j;
    } else i++;
  }
  return out;
}

export function startFakeRedis(port = 6399) {
  const server = createServer((socket) => {
    socket.on('data', (chunk) => {
      for (const args of parse(chunk)) {
        if (!args[0]) continue;
        const cmd = String(args[0]).toUpperCase();
        if (cmd === 'HELLO') {
          // node-redis v6 negotiates RESP3; refusing HELLO just makes it retry.
          socket.write(enc.map({ server: 'fake', version: '7.0.0', proto: '3', id: '1', mode: 'standalone', role: 'master' }));
          continue;
        }
        if (cmd === 'CLIENT' || cmd === 'INFO') { socket.write(enc.simple('OK')); continue; }
        if (cmd === 'PING') { socket.write(enc.simple('PONG')); continue; }
        if (cmd === 'HSET') {
          const h = hashes.get(args[1]) ?? {};
          h[args[2]] = args[3];
          hashes.set(args[1], h);
          socket.write(enc.int(1));
          continue;
        }
        if (cmd === 'HGETALL') {
          socket.write(enc.map(hashes.get(args[1]) ?? {}));
          continue;
        }
        if (cmd === 'HINCRBY') {
          const h = hashes.get(args[1]) ?? {};
          h[args[2]] = String(Number(h[args[2]] ?? 0) + Number(args[3]));
          hashes.set(args[1], h);
          socket.write(enc.int(Number(h[args[2]])));
          continue;
        }
        socket.write(enc.err(`unsupported ${cmd}`));
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
