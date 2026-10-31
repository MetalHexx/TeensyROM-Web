import { Injectable, computed, effect, inject, isDevMode, untracked } from '@angular/core';
import { SID_REGISTER_COUNT, VOICE_COUNT, createDeliveryBatch, readSidField } from '@sidablist/core';
import type { DeliveryBatch, SidField } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { DECK_SLOTS, type Slot } from './slot';
import { WAVE_HISTORY_CAPACITY } from './wave-feed-targets';
import type { DeckWaveTarget, WaveDeckState, WaveFeedWriter, WaveVoiceFields } from './wave-feed-targets';

type VoiceFieldName = Extract<SidField, { voice: number }>['name'];

function voiceFields(name: VoiceFieldName): readonly SidField[] {
  return Array.from({ length: VOICE_COUNT }, (_, voice) => ({ name, voice }));
}

// Field descriptors are built once, so a paint never creates one.
const FREQUENCY = voiceFields('frequency');
const WAVEFORM = voiceFields('waveform');
const PULSE_WIDTH = voiceFields('pulseWidth');
const RING_MOD = voiceFields('ringMod');
const SYNC = voiceFields('sync');
const ATTACK = voiceFields('attack');
const DECAY = voiceFields('decay');
const SUSTAIN = voiceFields('sustain');
const RELEASE = voiceFields('release');

/** Each voice owns seven registers; its control register is the fifth. */
const REGISTERS_PER_VOICE = 7;
const CONTROL_OFFSET = 4;
const GATE_BIT = 1;
/** An entry carries at most two control bytes per voice. */
const CONTROL_BYTES_PER_VOICE = 2;

/** Everything the feed keeps per deck. The buffers are allocated once and reused by every paint. */
interface SlotFeed {
  target: DeckWaveTarget | null;
  readonly batch: DeliveryBatch;
  readonly scratch: Uint8Array;
  readonly fields: WaveVoiceFields;
  /** The gate each voice ended the previous entry with: 1 open, 0 closed. */
  readonly previousGates: Uint8Array;
  /** The slot's history was turned off because its renderer failed. */
  historyOff: boolean;
  faultWarned: boolean;
}

function createSlotFeed(): SlotFeed {
  return {
    target: null,
    batch: createDeliveryBatch(WAVE_HISTORY_CAPACITY),
    scratch: new Uint8Array(SID_REGISTER_COUNT),
    fields: {
      frequency: 0,
      waveform: 0,
      pulseWidth: 0,
      ring: 0,
      sync: 0,
      attack: 0,
      decay: 0,
      sustain: 0,
      release: 0,
      gate: 0,
      hit: 0,
    },
    previousGates: new Uint8Array(VOICE_COUNT),
    historyOff: false,
    faultWarned: false,
  };
}

/**
 * Feeds each deck's waveform renderer from the engine's delivery history, straight to the target
 * and outside the store and change detection. The decks' animation-frame loop calls `paint` on the
 * frames it paints on; each paint drains the deck's history, decodes every entry's three voices and
 * hands the renderer one message. The deck's state (playing, held, flat) follows its status and is
 * sent when it changes, with one paint so the entries the loop no longer paints — a pause's gate-off,
 * a stop's re-init — still reach the renderer. Never writes the store.
 */
@Injectable({ providedIn: 'root' })
export class SidWaveFeed {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly slots: Record<Slot, SlotFeed> = { A: createSlotFeed(), B: createSlotFeed() };
  private suppressed = false;
  private measuring = false;

  private paints = 0;
  private entries = 0;
  private dropped = 0;
  private poolMisses = 0;
  private handOffs = 0;
  private handOffTotalMs = 0;
  private handOffMaxMs = 0;

  constructor() {
    for (const slot of DECK_SLOTS) {
      // Narrow on purpose, as the panel painter's effect is: `deck(slot)` carries every deck field.
      const status = computed(() => this.store.deck(slot)().status);
      const varispeed = computed(() => this.store.deck(slot)().varispeed);
      effect(() => {
        const state = stateOf(status(), varispeed());
        untracked(() => {
          this.slots[slot].target?.setState(state);
          this.paint(slot);
        });
      });
    }
    if (isDevMode()) {
      this.installBenchCommands();
    }
  }

  /** Registers a deck's renderer, asks the engine for history and sends the deck's current state.
   *  Returns the detach, which turns the history off; detaching a target that has since been
   *  replaced does nothing. */
  attach(slot: Slot, target: DeckWaveTarget): () => void {
    const state = this.slots[slot];
    state.target = target;
    state.historyOff = false;
    state.previousGates.fill(0);
    if (this.suppressed) {
      target.setSuppressed(true);
    } else {
      this.setHistory(slot, WAVE_HISTORY_CAPACITY);
    }
    const deck = this.store.deck(slot)();
    target.setState(stateOf(deck.status, deck.varispeed));
    return () => {
      if (state.target === target) {
        state.target = null;
        this.setHistory(slot, 0);
      }
    };
  }

  /** One drain, decode and hand-off. A no-op with nothing attached or while suppressed; a fault
   *  warns once per deck and skips the paint. */
  paint(slot: Slot): void {
    const state = this.slots[slot];
    const target = state.target;
    if (target === null || this.suppressed) {
      return;
    }
    let writer: WaveFeedWriter | null = null;
    try {
      if (target.isFailed()) {
        if (!state.historyOff) {
          state.historyOff = true;
          this.runtime.keepDeliveries(slot, 0);
        }
        return;
      }
      writer = target.acquire();
      if (writer === null) {
        this.poolMisses++;
        return;
      }
      const startMs = this.measuring ? performance.now() : 0;
      const { batch } = state;
      this.runtime.drainDeliveries(slot, batch);
      if (batch.count === 0 && !batch.restarted && batch.dropped === 0) {
        writer = null;
        target.discard();
        return;
      }
      if (batch.restarted || batch.dropped > 0) {
        state.previousGates.fill(0);
      }
      for (let entry = 0; entry < batch.count; entry++) {
        this.writeEntry(state, writer, entry);
      }
      writer.finish(batch.restarted, batch.dropped);
      writer = null;
      target.submit();

      this.paints++;
      this.entries += batch.count;
      this.dropped += batch.dropped;
      if (this.measuring) {
        const elapsedMs = performance.now() - startMs;
        this.handOffs++;
        this.handOffTotalMs += elapsedMs;
        this.handOffMaxMs = Math.max(this.handOffMaxMs, elapsedMs);
      }
    } catch (error) {
      if (writer !== null) {
        try {
          target.discard();
        } catch {
          // The renderer is already misbehaving; the fault below is the one worth reporting.
        }
      }
      if (!state.faultWarned) {
        state.faultWarned = true;
        const message = error instanceof Error ? error.message : String(error);
        logWarn(`SidWaveFeed: deck ${slot} could not be fed — ${message}`);
      }
    }
  }

  /** Bench only: turns every attached deck's history off and the paints into no-ops, or back on. */
  setSuppressed(suppressed: boolean): void {
    if (this.suppressed === suppressed) {
      return;
    }
    this.suppressed = suppressed;
    for (const slot of DECK_SLOTS) {
      const state = this.slots[slot];
      if (state.target === null) {
        continue;
      }
      state.historyOff = false;
      state.previousGates.fill(0);
      this.setHistory(slot, suppressed ? 0 : WAVE_HISTORY_CAPACITY);
      state.target.setSuppressed(suppressed);
    }
  }

  /** Bench only: times each paint's hand-off while on. */
  setMeasuring(on: boolean): void {
    this.measuring = on;
  }

  /** Bench only: paints, entries and drops handed over, pool misses, and the hand-off's mean and
   *  longest time in ms (zero unless measuring). */
  stats(): Record<string, number> {
    return {
      paints: this.paints,
      entries: this.entries,
      dropped: this.dropped,
      poolMisses: this.poolMisses,
      handOffMeanMs: this.handOffs === 0 ? 0 : this.handOffTotalMs / this.handOffs,
      handOffMaxMs: this.handOffMaxMs,
    };
  }

  /** Dev builds only: adds the wave commands to the `djBench` handle the runtime installed. The
   *  feed is created after the runtime, so the handle exists by now; without it (a production
   *  build, or a runtime that never installed one) nothing is added. */
  private installBenchCommands(): void {
    const bench = (globalThis as { djBench?: Record<string, unknown> }).djBench;
    if (!bench) {
      return;
    }
    bench['waves'] = (on: boolean): boolean => {
      this.setSuppressed(!on);
      this.setMeasuring(on);
      return on;
    };
    bench['history'] = (on: boolean): boolean => {
      for (const slot of DECK_SLOTS) {
        try {
          this.runtime.keepDeliveries(slot, on ? WAVE_HISTORY_CAPACITY : 0);
        } catch {
          // A slot that is not built has no history to switch.
        }
      }
      return on;
    };
    bench['waveReport'] = async (): Promise<Record<string, number>> => {
      const target = DECK_SLOTS.map((slot) => this.slots[slot].target).find((attached) => attached !== null);
      const result = { ...this.stats(), ...(target ? await target.readStats() : {}) };
      // eslint-disable-next-line no-console -- the bench is a console tool; printing is its output
      console.log(JSON.stringify(result, null, 2));
      return result;
    };
  }

  /** Decodes one history entry into the writer: each voice's fields from the entry's registers,
   *  with the gate as the entry ends and whether it opened within the entry. */
  private writeEntry(state: SlotFeed, writer: WaveFeedWriter, entry: number): void {
    const { batch, scratch, fields, previousGates } = state;
    const base = entry * SID_REGISTER_COUNT;
    for (let i = 0; i < SID_REGISTER_COUNT; i++) {
      scratch[i] = batch.registers[base + i];
    }
    writer.beginEntry(batch.timesMs[entry]);
    for (let voice = 0; voice < VOICE_COUNT; voice++) {
      fields.frequency = readSidField(scratch, FREQUENCY[voice]);
      fields.waveform = readSidField(scratch, WAVEFORM[voice]);
      fields.pulseWidth = readSidField(scratch, PULSE_WIDTH[voice]);
      fields.ring = readSidField(scratch, RING_MOD[voice]);
      fields.sync = readSidField(scratch, SYNC[voice]);
      fields.attack = readSidField(scratch, ATTACK[voice]);
      fields.decay = readSidField(scratch, DECAY[voice]);
      fields.sustain = readSidField(scratch, SUSTAIN[voice]);
      fields.release = readSidField(scratch, RELEASE[voice]);

      const gate = scratch[voice * REGISTERS_PER_VOICE + CONTROL_OFFSET] & GATE_BIT;
      const controlIndex = entry * VOICE_COUNT + voice;
      const controlCount = batch.controlCounts[controlIndex];
      let walking = previousGates[voice];
      let hit = 0;
      for (let step = 0; step < controlCount; step++) {
        const open = batch.controlBytes[controlIndex * CONTROL_BYTES_PER_VOICE + step] & GATE_BIT;
        if (walking === 0 && open === 1) {
          hit = 1;
        }
        walking = open;
      }
      fields.gate = gate;
      fields.hit = hit;
      writer.setVoice(voice, fields);
      previousGates[voice] = gate;
    }
  }

  /** Asks the slot's engine for `capacity` entries of history (0 is off). An unbuilt slot throws;
   *  that warns once per deck instead. */
  private setHistory(slot: Slot, capacity: number): void {
    try {
      this.runtime.keepDeliveries(slot, capacity);
    } catch (error) {
      const state = this.slots[slot];
      if (!state.faultWarned) {
        state.faultWarned = true;
        const message = error instanceof Error ? error.message : String(error);
        logWarn(`SidWaveFeed: deck ${slot} could not keep its history — ${message}`);
      }
    }
  }
}

function stateOf(status: string, varispeed: boolean): WaveDeckState {
  if (varispeed || status === 'playing') {
    return 'playing';
  }
  return status === 'paused' ? 'held' : 'flat';
}
