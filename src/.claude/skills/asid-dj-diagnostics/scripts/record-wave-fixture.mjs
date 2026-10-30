// Regenerates the voice-wave model's recorded stream: a short drum-and-pad tune built from opcodes,
// played through the built @sidablist/core player over FakeSink and FakeClock with the delivery
// history on, drained, and decoded into the wave feed's field layout (the same decode the
// application's collaborator does). Writes the entries and, beside them, the number of
// closed-to-open gate transitions the script itself counted per voice while building the tune.
// Usage: node record-wave-fixture.mjs        (needs sidablist's core built: pnpm build there)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSidablist } from './lib/sidablist.mjs';

const core = await loadSidablist('core');

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(
  here,
  '../../../../libs/ui/components/src/lib/voice-wave/model/__fixtures__/drum-stream.json'
);

const FRAMES = 100;
const FRAME_MS = 20;
const START_MS = 1000;
const HISTORY = 64;
const VOICES = 3;

// --- the tune's register plan: what each frame writes, in order -----------------------------------
const writes = Array.from({ length: FRAMES }, () => []);
const gateOpen = [0, 0, 0];
const hits = [0, 0, 0];
const REG = (voice, offset) => voice * 7 + offset;

function put(frame, register, value) {
  writes[frame].push([register, value]);
}

/** A control-register write; counts a closed-to-open gate transition the moment it is planned. */
function control(frame, voice, byte) {
  put(frame, REG(voice, 4), byte);
  const gate = byte & 1;
  if (!gateOpen[voice] && gate) hits[voice]++;
  gateOpen[voice] = gate;
}

function frequency(frame, voice, value) {
  put(frame, REG(voice, 0), value & 0xff);
  put(frame, REG(voice, 1), value >> 8);
}

function pulseWidth(frame, voice, value) {
  put(frame, REG(voice, 2), value & 0xff);
  put(frame, REG(voice, 3), value >> 8);
}

const envelope = (frame, voice, ad, sr) => {
  put(frame, REG(voice, 5), ad);
  put(frame, REG(voice, 6), sr);
};

const KICK_EVERY = 8;
const KICK_PITCH = [0x1c00, 0x1000, 0x0a00, 0x0600];
const CHORD = [0x1d45, 0x24f3, 0x2c4d];

for (let frame = 0; frame < FRAMES; frame++) {
  const beat = frame % KICK_EVERY;
  const kick = Math.floor(frame / KICK_EVERY);

  // Voice 0, the kick: pulse, gated for one frame; a hard restart (envelope zeroed, gate down) the
  // frame before; every other kick retriggers with a doubled control write in its frame.
  if (beat === KICK_EVERY - 1) {
    envelope(frame, 0, 0x00, 0x00);
    control(frame, 0, 0x40);
  } else if (beat === 0) {
    envelope(frame, 0, 0x08, 0x00);
    pulseWidth(frame, 0, 0x0800);
    frequency(frame, 0, KICK_PITCH[0]);
    if (kick % 2 === 1) control(frame, 0, 0x40);
    control(frame, 0, 0x41);
  } else if (beat === 1) {
    frequency(frame, 0, KICK_PITCH[1]);
    control(frame, 0, 0x40);
  } else if (beat < 4) {
    frequency(frame, 0, KICK_PITCH[beat]);
  }

  // Voice 2, the hi-hat: noise, gated for one frame on every fourth frame from the second.
  if (frame % 4 === 2) {
    envelope(frame, 2, 0x00, 0x09);
    frequency(frame, 2, 0xf000);
    control(frame, 2, 0x81);
  } else if (frame % 4 === 3) {
    control(frame, 2, 0x80);
  }

  // Voice 1, the pad: pulse with a sweeping width, an arpeggio over a chord, gate held open except
  // for one gap that retriggers it.
  if (frame === 0) {
    envelope(frame, 1, 0x88, 0xa8);
    control(frame, 1, 0x41);
  } else if (frame === 56) {
    control(frame, 1, 0x40);
  } else if (frame === 60) {
    control(frame, 1, 0x41);
  }
  frequency(frame, 1, CHORD[frame % CHORD.length]);
  pulseWidth(frame, 1, 0x0200 + ((frame * 0x30) % 0x0c00));
}

// --- the tune: a play routine that replays the plan from a table ----------------------------------
// Table: per frame, a pair count, then (register, value) pairs. init points $FB/$FC at it.
const TABLE = 0x1100;
const table = [];
for (const frame of writes) {
  table.push(frame.length);
  for (const [register, value] of frame) table.push(register, value);
}

const init = [0xa9, TABLE & 0xff, 0x85, 0xfb, 0xa9, TABLE >> 8, 0x85, 0xfc, 0x60];
const play = [
  0xa0,
  0x00, //       LDY #0
  0xb1,
  0xfb, //       LDA ($FB),Y   pair count
  0xaa, //             TAX
  0xe6,
  0xfb, //       INC $FB
  0xd0,
  0x02, //       BNE +2
  0xe6,
  0xfc, //       INC $FC
  0xe0,
  0x00, //       CPX #0
  0xf0,
  0x1d, //       BEQ done
  0xa0,
  0x00, // loop: LDY #0
  0xb1,
  0xfb, //       LDA ($FB),Y   register
  0x85,
  0xfd, //       STA $FD
  0xa0,
  0x01, //       LDY #1
  0xb1,
  0xfb, //       LDA ($FB),Y   value
  0xa4,
  0xfd, //       LDY $FD
  0x99,
  0x00,
  0xd4, // STA $D400,Y
  0x18, //             CLC
  0xa5,
  0xfb, //       LDA $FB
  0x69,
  0x02, //       ADC #2
  0x85,
  0xfb, //       STA $FB
  0x90,
  0x02, //       BCC +2
  0xe6,
  0xfc, //       INC $FC
  0xca, //             DEX
  0xd0,
  0xe3, //       BNE loop
  0x60, // done:       RTS
];

const LOAD = 0x1000;
const data = new Uint8Array(TABLE + table.length - LOAD);
data.set(init, 0);
data.set(play, 0x10);
data.set(table, TABLE - LOAD);

const file = {
  format: 'PSID',
  version: 2,
  loadAddress: LOAD,
  initAddress: LOAD,
  playAddress: 0x1010,
  songs: 1,
  startSong: 1,
  speedFlags: 0,
  name: 'wave fixture',
  author: '',
  released: '',
  clock: 'pal',
  model: 'unknown',
  secondSidAddress: null,
  thirdSidAddress: null,
  data,
};

// --- play it ---------------------------------------------------------------------------------------
const stubRunner = { run: () => new Promise(() => {}), dispose() {} };
const clock = new core.FakeClock();
const sink = new core.FakeSink();
const player = core.createSidPlayer({ sink, clock, replayRunner: stubRunner });
player.loadTune(file);
player.keepDeliveries(HISTORY);
void player.play();
await new Promise((resolveTick) => setTimeout(resolveTick, 0));

const batch = core.createDeliveryBatch(HISTORY);
const entries = [];
const previousGate = [0, 0, 0];

function decode(entry) {
  const registers = batch.registers.subarray(
    entry * core.SID_REGISTER_COUNT,
    (entry + 1) * core.SID_REGISTER_COUNT
  );
  const voices = [];
  for (let voice = 0; voice < VOICES; voice++) {
    const field = (name) => core.readSidField(registers, { name, voice });
    let hit = 0;
    const count = batch.controlCounts[entry * VOICES + voice];
    for (let byte = 0; byte < count; byte++) {
      const gate = batch.controlBytes[(entry * VOICES + voice) * 2 + byte] & 1;
      if (!previousGate[voice] && gate) hit = 1;
      previousGate[voice] = gate;
    }
    const gate = field('gate');
    previousGate[voice] = gate;
    voices.push([
      field('frequency'),
      field('waveform'),
      field('pulseWidth'),
      field('ringMod'),
      field('sync'),
      field('attack'),
      field('decay'),
      field('sustain'),
      field('release'),
      gate,
      hit,
    ]);
  }
  return { timeMs: batch.timesMs[entry], voices };
}

for (let frame = 0; frame < FRAMES; frame++) {
  clock.tick(START_MS + frame * FRAME_MS);
  if ((frame + 1) % 32 === 0 || frame === FRAMES - 1) {
    player.drainDeliveries(batch);
    if (batch.dropped > 0) throw new Error(`the history dropped ${batch.dropped} entries`);
    for (let entry = 0; entry < batch.count; entry++) entries.push(decode(entry));
  }
}
if (entries.length !== FRAMES)
  throw new Error(`expected ${FRAMES} entries, drained ${entries.length}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ attacks: hits, entries }) + '\n');
console.log(
  `wrote ${entries.length} entries to ${OUT}; planned attacks per voice: ${hits.join(', ')}`
);
player.dispose?.();
