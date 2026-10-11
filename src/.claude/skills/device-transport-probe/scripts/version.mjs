// One version exchange: prints each decoded event with its arrival time, then the raw reply as hex
// and as escaped text, for byte-level comparisons between firmware builds.
//   node version.mjs <COM4 | 192.168.1.37[:2112]> [--ms 800]
import { open, decode, tokenBytes, Token, since, sleep } from './lib/wire.mjs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : Number(argv[i + 1]); };
const target = argv[0];
if (!target || target.startsWith('--')) {
  console.error('usage: node version.mjs <COM4 | 192.168.1.37[:2112]> [--ms 800]');
  process.exit(2);
}

const link = await open(target);
const raw = [];
link.onData((chunk) => raw.push(chunk));
const t0 = performance.now();
decode(link, (event) => console.log(`+${since(t0)} ms  ${JSON.stringify(event)}`));

await link.write(tokenBytes(Token.Version));
await sleep(option('--ms', 800));
await link.close();

const all = Buffer.concat(raw);
console.log(`${all.length} bytes from ${link.name}`);
console.log(`HEX: ${[...all].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);
console.log(`TXT: ${JSON.stringify(all.toString('latin1'))}`);
