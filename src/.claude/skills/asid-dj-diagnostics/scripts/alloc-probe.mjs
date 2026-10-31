// Bytes allocated per frame by sidablist's hot path, layer by layer, on one real tune.
// Run with a young generation big enough that no GC fires inside a batch:
//   node --expose-gc --max-semi-space-size=512 alloc-probe.mjs <file.sid> [frames]
import { readFileSync } from 'node:fs';
import { loadSidablist } from './lib/sidablist.mjs';

const core = await loadSidablist('core');
const asid = await loadSidablist('asid');

const [, , path, framesArg] = process.argv;
const bytes = new Uint8Array(readFileSync(path));
const N = framesArg ? Number(framesArg) : 3000;

function measure(label, setup, step) {
  const ctx = setup();
  for (let i = 0; i < 300; i++) step(ctx, i); // warm the JIT
  global.gc();
  const h0 = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) step(ctx, 300 + i);
  const ms = performance.now() - t0;
  const h1 = process.memoryUsage().heapUsed;
  console.log(`${label.padEnd(34)} ${((h1 - h0) / N).toFixed(0).padStart(8)} B/frame  ${(ms / N).toFixed(3)} ms/frame`);
}

const file = core.parseSidFile(bytes);
const sub = file.startSong ?? 1;

measure('machine.runFrame', () => {
  const m = core.createC64Machine(file, { onSidWrite() {} });
  m.initSubtune(sub);
  return m;
}, (m) => m.runFrame());

// The full player tick, through the real ASID sink onto a port that drops the bytes.
const port = { portId: 'probe', supportsCancel: false, send() {}, cancelPending: () => false };
const stubRunner = { run: () => new Promise(() => {}), dispose() {} };
for (const aheadMs of [0, 30]) {
  measure(`player tick + asid sink (ahead ${aheadMs})`, () => {
    const clock = new core.FakeClock();
    const sink = asid.createAsidSink(port, { scheduleAheadMs: aheadMs });
    const player = core.createSidPlayer({ sink, clock, replayRunner: stubRunner });
    player.loadTune(file);
    player.selectSubtune(sub);
    void player.play();
    return { clock, player };
  }, ({ clock }, i) => clock.tick(performance.now() - 1));
}

measure('player tick + FakeSink', () => {
  const clock = new core.FakeClock();
  const sink = new core.FakeSink();
  const player = core.createSidPlayer({ sink, clock, replayRunner: stubRunner });
  player.loadTune(file);
  player.selectSubtune(sub);
  void player.play();
  return { clock, player, sink };
}, ({ clock }) => clock.tick(performance.now() - 1));

// The engine's delivery history (what the voice waves read), on the same player. Compare both lines
// with the one above: the first is the cost of keeping the history, the second adds a drain every
// second tick into one reused batch, as a 30 Hz paint does.
const HISTORY_CAPACITY = 64;
measure('player tick + FakeSink + history', () => {
  const clock = new core.FakeClock();
  const sink = new core.FakeSink();
  const player = core.createSidPlayer({ sink, clock, replayRunner: stubRunner });
  player.loadTune(file);
  player.selectSubtune(sub);
  player.keepDeliveries(HISTORY_CAPACITY);
  void player.play();
  return { clock, player };
}, ({ clock }) => clock.tick(performance.now() - 1));

measure('  ... + drain every 2nd tick', () => {
  const clock = new core.FakeClock();
  const sink = new core.FakeSink();
  const player = core.createSidPlayer({ sink, clock, replayRunner: stubRunner });
  player.loadTune(file);
  player.selectSubtune(sub);
  player.keepDeliveries(HISTORY_CAPACITY);
  void player.play();
  return { clock, player, batch: core.createDeliveryBatch(HISTORY_CAPACITY) };
}, ({ clock, player, batch }, i) => {
  clock.tick(performance.now() - 1);
  if (i % 2 === 1) player.drainDeliveries(batch);
});
