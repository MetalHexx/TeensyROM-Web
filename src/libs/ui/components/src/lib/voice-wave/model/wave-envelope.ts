/** Milliseconds from 0 to full for attack settings 0…15 (the SID's published times, approximated). */
export const ATTACK_MS = [
  2, 8, 16, 24, 38, 56, 68, 80, 100, 250, 500, 800, 1000, 3000, 5000, 8000,
] as const;

/** Milliseconds from full to 0 for decay and release settings 0…15. */
export const DECAY_RELEASE_MS = [
  6, 24, 48, 72, 114, 168, 204, 240, 300, 750, 1500, 2400, 3000, 9000, 15000, 24000,
] as const;

/** A decay or release falls exponentially; its published time is how long it takes to reach the floor. */
const TIME_CONSTANTS_PER_FALL = 4.6;
/** Within this of the sustain level a decay is over and the level snaps to it. */
const SUSTAIN_SNAP = 0.004;
/** Below this a release is over and the follower is idle. */
const SILENCE = 0.004;
/** A gap longer than this between two times is a stall, not music; the envelope moves this far at most. */
const MAX_ADVANCE_MS = 1000;
/** A hit whose gate is already closed again in the same entry still sounds for about a frame. */
const HIT_PULSE_MS = 20;

const SETTING_MAX = 15;

const IDLE = 0;
const ATTACK = 1;
const DECAY = 2;
const SUSTAIN = 3;
const RELEASE = 4;

/**
 * Follows one voice's ADSR from the register data, in real time from the entries' own clock, since
 * the chip's envelope rates do not change with the deck's speed. Allocates nothing after construction.
 *
 * A hit restarts the attack from the current height; the open gate holds at the sustain level once
 * the decay ends; the gate closing starts the release. An open gate with no hit on an idle follower
 * adopts the sustain level at once, so a pad that was already sounding shows without waiting for its
 * next note.
 */
export class WaveEnvelope {
  private height = 0;
  private phase = IDLE;
  private attackMs = ATTACK_MS[0] as number;
  private decayMs = DECAY_RELEASE_MS[0] as number;
  private releaseMs = DECAY_RELEASE_MS[0] as number;
  private sustainLevel = 0;
  private attackCount = 0;

  /** The envelope height, 0…1. */
  get level(): number {
    return this.height;
  }

  get idle(): boolean {
    return this.phase === IDLE;
  }

  /** How many attacks have started since construction; survives `reset`. */
  get attacks(): number {
    return this.attackCount;
  }

  /** Back to idle and flat, forgetting any note in progress. */
  reset(): void {
    this.height = 0;
    this.phase = IDLE;
  }

  /** Moves the envelope on by `dtMs` of the entries' clock; a negative gap counts as 0. */
  advance(dtMs: number): void {
    let remaining = dtMs > MAX_ADVANCE_MS ? MAX_ADVANCE_MS : dtMs;
    while (remaining > 0 && this.phase !== IDLE && this.phase !== SUSTAIN) {
      if (this.phase === ATTACK) {
        const toFull = (1 - this.height) * this.attackMs;
        if (remaining < toFull) {
          this.height += remaining / this.attackMs;
          return;
        }
        remaining -= toFull;
        this.height = 1;
        this.phase = DECAY;
      } else if (this.phase === DECAY) {
        this.fall(remaining, this.decayMs, this.sustainLevel);
        if (this.height - this.sustainLevel > SUSTAIN_SNAP) return;
        this.height = this.sustainLevel;
        this.phase = SUSTAIN;
        return;
      } else {
        this.fall(remaining, this.releaseMs, 0);
        if (this.height > SILENCE) return;
        this.height = 0;
        this.phase = IDLE;
        return;
      }
    }
  }

  /**
   * Takes the voice's state as one entry leaves it: the gate, whether it opened within the entry, and
   * the four 4-bit envelope settings. Call after `advance` has brought the envelope to the entry's time.
   */
  apply(
    gate: number,
    hit: number,
    attack: number,
    decay: number,
    sustain: number,
    release: number
  ): void {
    this.attackMs = ATTACK_MS[settingIndex(attack)];
    this.decayMs = DECAY_RELEASE_MS[settingIndex(decay)];
    this.releaseMs = DECAY_RELEASE_MS[settingIndex(release)];
    this.sustainLevel = settingIndex(sustain) / SETTING_MAX;

    if (hit !== 0) {
      this.attackCount++;
      this.phase = ATTACK;
      if (gate === 0) {
        this.height += HIT_PULSE_MS / this.attackMs;
        if (this.height > 1) this.height = 1;
        this.phase = RELEASE;
      }
      return;
    }

    if (gate !== 0) {
      if (this.phase === IDLE) {
        this.height = this.sustainLevel;
        this.phase = SUSTAIN;
      } else if (this.phase === SUSTAIN) {
        this.height = this.sustainLevel;
      }
    } else if (this.phase !== IDLE && this.phase !== RELEASE) {
      this.phase = RELEASE;
    }
  }

  private fall(dtMs: number, fullFallMs: number, floor: number): void {
    const decay = Math.exp((-dtMs * TIME_CONSTANTS_PER_FALL) / fullFallMs);
    this.height = floor + (this.height - floor) * decay;
  }
}

function settingIndex(setting: number): number {
  const index = setting | 0;
  return index < 0 ? 0 : index > SETTING_MAX ? SETTING_MAX : index;
}
