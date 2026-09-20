// Tap the API's SignalR log hub and append every line to a file, timestamped.
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/dev/src/TeensyROM-Web/src/package.json');
const signalR = require('@microsoft/signalr');

const out = process.argv[2];
const base = 'http://localhost:213';
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
conn.onreconnected(() => appendFileSync(out, `${ts()} [tap] reconnected\n`));
conn.onclose((e) => appendFileSync(out, `${ts()} [tap] closed ${e ?? ''}\n`));

await conn.start();
appendFileSync(out, `${ts()} [tap] connected to ${base}/api/logHub\n`);
const r = await fetch(`${base}/api/logs`, { method: 'POST' });
appendFileSync(out, `${ts()} [tap] StartLogs -> ${r.status}\n`);
setInterval(() => {}, 1 << 30); // keep alive
