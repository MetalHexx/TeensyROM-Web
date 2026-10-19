// Tap the API's SignalR log hub and append every line to a file, timestamped.
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const signalR = require('@microsoft/signalr');

const out = process.argv[2];
const base = 'http://localhost:10213';
const ts = () => new Date().toISOString().slice(11, 23);

const conn = new signalR.HubConnectionBuilder()
  .withUrl(`${base}/api/logHub`)
  .withAutomaticReconnect()
  .configureLogging(signalR.LogLevel.Warning)
  .build();

conn.on('LogProduced', (msg) => {
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  appendFileSync(out, `${ts()} ${text.replace(/\r?\n$/, '')}\n`);
});
conn.onreconnected(async () => {
  // A reconnect is a new connection id: it lost its group membership.
  const resubscribed = await conn.invoke('Subscribe').then(() => 'resubscribed', (e) => `resubscribe failed ${e}`);
  appendFileSync(out, `${ts()} [tap] reconnected, ${resubscribed}\n`);
});
conn.onclose((e) => appendFileSync(out, `${ts()} [tap] closed ${e ?? ''}\n`));

await conn.start();
appendFileSync(out, `${ts()} [tap] connected to ${base}/api/logHub\n`);
await conn.invoke('Subscribe');
appendFileSync(out, `${ts()} [tap] subscribed\n`);
setInterval(() => {}, 1 << 30); // keep alive
