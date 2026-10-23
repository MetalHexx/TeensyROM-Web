import { Injectable, computed, effect, inject } from '@angular/core';
import { SID_REGISTER_COUNT, readSidField } from '@sidablist/core';
import type { SidField } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { DECK_SLOTS, type Slot } from './slot';
import type { DeckPanelTargets, PanelLevelTarget, PanelLightTarget } from './sid-panel-targets';

const VOICE_COUNT = 3;
const WAVEFORM_BITS = 4;
const FILTER_MODE_BITS = 3;

const LEVELS_PER_VOICE = 7;
const LEVEL_CUTOFF = 0;
const LEVEL_RESONANCE = 1;
const LEVEL_VOICES = 2;
const LEVEL_COUNT = LEVEL_VOICES + VOICE_COUNT * LEVELS_PER_VOICE;
const LEVEL_PULSE_WIDTH = 2;
const LEVEL_ATTACK = 3;
const LEVEL_DECAY = 4;
const LEVEL_SUSTAIN = 5;
const LEVEL_RELEASE = 6;

const LIGHTS_PER_VOICE = 7;
const LIGHT_FILTER_MODES = 0;
const LIGHT_VOICES = FILTER_MODE_BITS;
const LIGHT_COUNT = LIGHT_VOICES + VOICE_COUNT * LIGHTS_PER_VOICE;
const LIGHT_RING = 4;
const LIGHT_SYNC = 5;
const LIGHT_FILTER = 6;

/** Marks a ring or light as never painted, so the first paint writes everything. */
const LEVEL_UNPAINTED = -1;
const LIGHT_UNPAINTED = 0xff;

/** Rings move in thousandths; a smaller change is not a visible one. */
const LEVEL_STEPS = 1000;

const FREQUENCY_BITS = 16;
const PULSE_WIDTH_MAX = 4095;
const ENVELOPE_MAX = 15;
const CUTOFF_MAX = 2047;
const RESONANCE_MAX = 15;

type VoiceFieldName = Extract<SidField, { voice: number }>['name'];

function voiceFields(name: VoiceFieldName): readonly SidField[] {
  return [0, 1, 2].map((voice) => ({ name, voice }));
}

// Field descriptors are built once, so a paint never creates one.
const FREQUENCY = voiceFields('frequency');
const PULSE_WIDTH = voiceFields('pulseWidth');
const WAVEFORM = voiceFields('waveform');
const ATTACK = voiceFields('attack');
const DECAY = voiceFields('decay');
const SUSTAIN = voiceFields('sustain');
const RELEASE = voiceFields('release');
const RING_MOD = voiceFields('ringMod');
const SYNC = voiceFields('sync');
const FILTERED = voiceFields('filtered');
const CUTOFF: SidField = { name: 'cutoff' };
const RESONANCE: SidField = { name: 'resonance' };
const FILTER_TYPE: SidField = { name: 'filterType' };

/** An octave scale: 0 for silence, otherwise log2 of the 16-bit frequency over 16. */
function pitchLevel(frequency: number): number {
  return frequency === 0 ? 0 : Math.log2(frequency) / FREQUENCY_BITS;
}

/** Everything the painter keeps per deck. The buffers and caches are allocated once and reused by
 *  every paint. */
interface SlotPaint {
  readonly written: Uint8Array;
  readonly sent: Uint8Array;
  readonly levels: Int16Array;
  /** `lit | ghost << 1` per light. */
  readonly lights: Uint8Array;
  targets: DeckPanelTargets | null;
  stillPaintScheduled: boolean;
  faultWarned: boolean;
}

function createSlotPaint(): SlotPaint {
  return {
    written: new Uint8Array(SID_REGISTER_COUNT),
    sent: new Uint8Array(SID_REGISTER_COUNT),
    levels: new Int16Array(LEVEL_COUNT).fill(LEVEL_UNPAINTED),
    lights: new Uint8Array(LIGHT_COUNT).fill(LIGHT_UNPAINTED),
    targets: null,
    stillPaintScheduled: false,
    faultWarned: false,
  };
}

/**
 * Paints a deck's live SID registers straight into the panel's indicators, bypassing the store and
 * change detection. The deck's animation-frame loop calls `paint` whenever the engine has built a
 * new frame; each call reads the registers once and writes only the rings and lights whose value
 * changed. While the deck is not playing that loop is stopped, so one extra paint is scheduled for
 * anything that changes in the meantime (a lock press, a stop re-init, a load). Never writes the
 * store.
 */
@Injectable({ providedIn: 'root' })
export class SidPanelPainter {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly slots: Record<Slot, SlotPaint> = { A: createSlotPaint(), B: createSlotPaint() };

  constructor() {
    for (const slot of DECK_SLOTS) {
      // Narrow on purpose: `deck(slot)` also carries `positionFrames`, rewritten every animation
      // frame while playing, and an effect reading it would rerun at that rate.
      const status = computed(() => this.store.deck(slot)().status);
      const loaded = computed(() => this.store.deck(slot)().loaded);
      const panel = this.store.deckPanel(slot);
      effect(() => {
        const current = status();
        loaded();
        panel();
        if (current !== 'playing') {
          this.scheduleStillPaint(slot);
        }
      });
    }
  }

  /** Registers a deck's indicators, forgets what was last painted, and paints once now.
   *  Returns the detach; detaching a target set that has since been replaced does nothing. */
  attach(slot: Slot, targets: DeckPanelTargets): () => void {
    const state = this.slots[slot];
    state.targets = targets;
    state.levels.fill(LEVEL_UNPAINTED);
    state.lights.fill(LIGHT_UNPAINTED);
    this.paint(slot);
    return () => {
      if (state.targets === targets) {
        state.targets = null;
      }
    };
  }

  /** One read and a paint of whatever changed. Called by the deck's animation-frame loop only when
   *  the engine has built a new frame. A no-op with nothing attached; a failed read warns once per
   *  deck and skips the paint. */
  paint(slot: Slot): void {
    const state = this.slots[slot];
    const targets = state.targets;
    if (targets === null) {
      return;
    }
    try {
      this.runtime.readRegisters(slot, state.written, state.sent);
    } catch (error) {
      if (!state.faultWarned) {
        state.faultWarned = true;
        const message = error instanceof Error ? error.message : String(error);
        logWarn(`SidPanelPainter: deck ${slot} could not be painted — ${message}`);
      }
      return;
    }

    // Nothing below allocates: index loops over fixed caches and descriptors built at module load.
    const { written, sent, levels, lights } = state;

    this.paintLevel(targets.cutoff, levels, LEVEL_CUTOFF, readSidField(sent, CUTOFF) / CUTOFF_MAX);
    this.paintLevel(targets.resonance, levels, LEVEL_RESONANCE, readSidField(sent, RESONANCE) / RESONANCE_MAX);

    const filterSent = readSidField(sent, FILTER_TYPE);
    const filterWritten = readSidField(written, FILTER_TYPE);
    for (let bit = 0; bit < FILTER_MODE_BITS; bit++) {
      this.paintBit(targets.filterModes[bit], lights, LIGHT_FILTER_MODES + bit, filterSent, filterWritten, 1 << bit);
    }

    for (let voice = 0; voice < VOICE_COUNT; voice++) {
      const strip = targets.voices[voice];
      const levelBase = LEVEL_VOICES + voice * LEVELS_PER_VOICE;
      const lightBase = LIGHT_VOICES + voice * LIGHTS_PER_VOICE;

      const pitch = pitchLevel(readSidField(sent, FREQUENCY[voice]));
      this.paintLevel(strip.coarse, levels, levelBase, pitch);
      this.paintLevel(strip.fine, levels, levelBase + 1, pitch);
      this.paintLevel(strip.pulseWidth, levels, levelBase + LEVEL_PULSE_WIDTH, readSidField(sent, PULSE_WIDTH[voice]) / PULSE_WIDTH_MAX);
      this.paintLevel(strip.attack, levels, levelBase + LEVEL_ATTACK, readSidField(sent, ATTACK[voice]) / ENVELOPE_MAX);
      this.paintLevel(strip.decay, levels, levelBase + LEVEL_DECAY, readSidField(sent, DECAY[voice]) / ENVELOPE_MAX);
      this.paintLevel(strip.sustain, levels, levelBase + LEVEL_SUSTAIN, readSidField(sent, SUSTAIN[voice]) / ENVELOPE_MAX);
      this.paintLevel(strip.release, levels, levelBase + LEVEL_RELEASE, readSidField(sent, RELEASE[voice]) / ENVELOPE_MAX);

      const waveSent = readSidField(sent, WAVEFORM[voice]);
      const waveWritten = readSidField(written, WAVEFORM[voice]);
      for (let bit = 0; bit < WAVEFORM_BITS; bit++) {
        this.paintBit(strip.waveforms[bit], lights, lightBase + bit, waveSent, waveWritten, 1 << bit);
      }

      this.paintLight(strip.ring, lights, lightBase + LIGHT_RING, readSidField(sent, RING_MOD[voice]) !== 0, false);
      this.paintLight(strip.sync, lights, lightBase + LIGHT_SYNC, readSidField(sent, SYNC[voice]) !== 0, false);
      this.paintLight(strip.filter, lights, lightBase + LIGHT_FILTER, readSidField(sent, FILTERED[voice]) !== 0, false);
    }
  }

  private paintLevel(target: PanelLevelTarget, cache: Int16Array, index: number, level: number): void {
    const step = Math.round(level * LEVEL_STEPS);
    if (cache[index] !== step) {
      cache[index] = step;
      target.setLiveLevel(step / LEVEL_STEPS);
    }
  }

  private paintLight(target: PanelLightTarget, cache: Uint8Array, index: number, lit: boolean, ghost: boolean): void {
    const code = (lit ? 1 : 0) | (ghost ? 2 : 0);
    if (cache[index] !== code) {
      cache[index] = code;
      target.setLiveLight(lit, ghost);
    }
  }

  /** A light for one bit of a field: lit when the sent value has it, a ghost when the tune wrote it
   *  and the sent value does not — which is what a lock overriding the tune looks like. */
  private paintBit(
    target: PanelLightTarget,
    cache: Uint8Array,
    index: number,
    sent: number,
    written: number,
    bit: number
  ): void {
    const lit = (sent & bit) !== 0;
    this.paintLight(target, cache, index, lit, !lit && (written & bit) !== 0);
  }

  /** Schedules one paint on the next animation frame, at most one pending per deck. */
  private scheduleStillPaint(slot: Slot): void {
    const state = this.slots[slot];
    if (state.stillPaintScheduled) {
      return;
    }
    state.stillPaintScheduled = true;
    requestAnimationFrame(() => {
      state.stillPaintScheduled = false;
      this.paint(slot);
    });
  }
}
