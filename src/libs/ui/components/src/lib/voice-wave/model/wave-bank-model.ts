import { WAVE_VOICE_COUNT, WAVE_VOICE_FIELDS, WaveField } from '../wave-feed-layout';
import { WaveEnvelope } from './wave-envelope';
import { WAVE_SOURCE_OF, cyclesForFrequency, dutyForPulseWidth, sourceCycles } from './wave-shape';
import type { WaveVoice, WaveVoiceView } from './wave-view';

function emptyView(): WaveVoiceView {
  return {
    amplitude: 0,
    cycles: 0,
    waveform: 0,
    duty: 0.5,
    syncCycles: 0,
    ringCycles: 0,
    sounding: false,
  };
}

/**
 * Follows one bank of three voices from the decoded register entries and says what each window
 * should show. Entries and `step` share one clock (the entries' own `timeMs`); the envelopes move in
 * real time along it and never backward. Everything is allocated in the constructor.
 *
 * Ring and sync read the neighbouring voice (0 from 2, 1 from 0, 2 from 1), which is why the three
 * voices are modelled together.
 */
export class WaveBankModel {
  private readonly envelopes = [new WaveEnvelope(), new WaveEnvelope(), new WaveEnvelope()];
  private readonly views = [emptyView(), emptyView(), emptyView()];
  private readonly frequency = new Float64Array(WAVE_VOICE_COUNT);
  private readonly waveform = new Float64Array(WAVE_VOICE_COUNT);
  private readonly pulseWidth = new Float64Array(WAVE_VOICE_COUNT);
  private readonly ring = new Float64Array(WAVE_VOICE_COUNT);
  private readonly sync = new Float64Array(WAVE_VOICE_COUNT);

  /** NaN until the first entry or step after construction or a restart. */
  private clockMs = Number.NaN;

  /**
   * Takes the entry at `offset` of `data` (read through the feed layout). Lossless and in order:
   * several entries can be ingested between steps, and each moves the envelopes to its own time
   * before its state applies.
   */
  ingestEntry(data: Float64Array, offset: number): void {
    this.advanceTo(data[offset]);
    for (let voice = 0; voice < WAVE_VOICE_COUNT; voice++) {
      const base = offset + 1 + voice * WAVE_VOICE_FIELDS;
      this.frequency[voice] = data[base + WaveField.Frequency];
      this.waveform[voice] = data[base + WaveField.Waveform];
      this.pulseWidth[voice] = data[base + WaveField.PulseWidth];
      this.ring[voice] = data[base + WaveField.Ring];
      this.sync[voice] = data[base + WaveField.Sync];
      this.envelopes[voice].apply(
        data[base + WaveField.Gate],
        data[base + WaveField.Hit],
        data[base + WaveField.Attack],
        data[base + WaveField.Decay],
        data[base + WaveField.Sustain],
        data[base + WaveField.Release]
      );
    }
  }

  /** A discontinuity or loss: every follower goes idle and flat, and nothing is carried over. */
  restart(): void {
    for (let voice = 0; voice < WAVE_VOICE_COUNT; voice++) {
      this.envelopes[voice].reset();
      this.frequency[voice] = 0;
      this.waveform[voice] = 0;
      this.pulseWidth[voice] = 0;
      this.ring[voice] = 0;
      this.sync[voice] = 0;
    }
    this.clockMs = Number.NaN;
    this.refreshViews();
  }

  /** Advances every follower to `nowMs` on the entries' clock (never backward) and updates the views. */
  step(nowMs: number): void {
    this.advanceTo(nowMs);
    this.refreshViews();
  }

  /** The voice's view, a reusable object updated in place by `step` and `restart`. */
  view(voice: WaveVoice): WaveVoiceView {
    return this.views[voice];
  }

  /** How many attacks the voice's follower has started since construction. */
  attackCount(voice: WaveVoice): number {
    return this.envelopes[voice].attacks;
  }

  private advanceTo(timeMs: number): void {
    if (Number.isNaN(this.clockMs)) {
      this.clockMs = timeMs;
    } else if (timeMs > this.clockMs) {
      const dt = timeMs - this.clockMs;
      for (let voice = 0; voice < WAVE_VOICE_COUNT; voice++) this.envelopes[voice].advance(dt);
      this.clockMs = timeMs;
    }
  }

  private refreshViews(): void {
    for (let voice = 0; voice < WAVE_VOICE_COUNT; voice++) {
      const view = this.views[voice];
      const envelope = this.envelopes[voice];
      const frequency = this.frequency[voice];
      const waveform = this.waveform[voice];
      const source = WAVE_SOURCE_OF[voice];

      view.waveform = waveform;
      view.cycles = cyclesForFrequency(frequency);
      view.duty = dutyForPulseWidth(this.pulseWidth[voice]);
      view.sounding = !envelope.idle && frequency > 0 && waveform !== 0;
      view.amplitude = view.sounding ? envelope.level : 0;
      view.syncCycles =
        this.sync[voice] !== 0 ? sourceCycles(this.frequency[source], frequency, view.cycles) : 0;
      view.ringCycles =
        this.ring[voice] !== 0 ? sourceCycles(this.frequency[source], frequency, view.cycles) : 0;
    }
  }
}
