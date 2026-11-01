import { Injectable, inject } from '@angular/core';
import { fitBeatGrid } from '@sidablist/analysis';
import type { BeatGrid, DetectedBeatGrid } from '@sidablist/analysis';
import type { TuneIdentity } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DjStore, type DeckBeatGrid } from './dj-store';
import { beatAt, bpmOf, inGridSpan } from './grid/beat-math';
import { BEAT_GRID_STORE, type StoredBeatGrid } from './ports';
import { otherSlot, type Slot } from './slot';

/** A pause this long (ms) between taps starts a new tap sequence, and ends the running one. */
export const TAP_IDLE_MS = 2000;

/** The fewest taps of a sequence that fit a grid. */
export const TAP_MIN_TAPS = 4;

/** What one deck's current tap sequence holds. */
interface TapSequence {
  readonly frames: number[];
  readonly identity: TuneIdentity;
  lastTapAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** The latest grid the taps fitted, if any. */
  fitted: BeatGrid | null;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function tappedGrid(grid: BeatGrid): DeckBeatGrid {
  return {
    beatFrames: grid.beatFrames,
    beatOneFrame: grid.beatOneFrame,
    startFrame: 0,
    endFrame: null,
    source: 'tap',
  };
}

/**
 * Each deck's beat grid: the scan's at load, replaced by the tune's stored correction, and set by
 * Tap from the deck's register stream. A correction is a fact about the tune, so it goes only
 * through the `BeatGridStore` — never into tune memory, a set row or a marker.
 */
@Injectable({ providedIn: 'root' })
export class DeckGrid {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly beatGrids = inject(BEAT_GRID_STORE);

  /** The tune each deck's grid belongs to; null with nothing attached. */
  private readonly identities: Record<Slot, TuneIdentity | null> = { A: null, B: null };

  /** Bumped by every `attach` and `detach`: a stored-grid load that resolves after a newer one has
   *  started drops its result. */
  private readonly attachTokens: Record<Slot, number> = { A: 0, B: 0 };

  private readonly sequences: Record<Slot, TapSequence | null> = { A: null, B: null };

  /** Puts the scan's grid on the deck at once, then replaces it with the tune's stored correction
   *  for this subtune, if there is one. A failed read keeps the scan's grid. */
  attach(slot: Slot, identity: TuneIdentity, scan: DetectedBeatGrid | null): void {
    const token = ++this.attachTokens[slot];
    this.dropSequence(slot);
    this.identities[slot] = identity;
    this.store.setDeckBeatGrid({
      slot,
      beatGrid:
        scan === null
          ? null
          : {
              beatFrames: scan.beatFrames,
              beatOneFrame: scan.beatOneFrame,
              startFrame: scan.startFrame,
              endFrame: scan.endFrame,
              source: 'scan',
            },
    });

    this.beatGrids
      .load(identity.sidHash)
      .then((grids) => {
        if (this.attachTokens[slot] !== token) {
          return;
        }
        const stored = grids?.subtunes.find((entry) => entry.subtune === identity.subtune);
        if (stored !== undefined) {
          this.store.setDeckBeatGrid({ slot, beatGrid: tappedGrid(stored) });
        }
      })
      .catch((error: unknown) =>
        logWarn(`DeckGrid: deck ${slot} stored grid failed to load — ${describeError(error)}`)
      );
  }

  /** Clears the deck's grid and taps, and cancels a stored-grid load still in flight. */
  detach(slot: Slot): void {
    this.attachTokens[slot]++;
    this.identities[slot] = null;
    this.dropSequence(slot);
    this.store.setDeckBeatGrid({ slot, beatGrid: null });
  }

  /** One tap on a playing deck. Four or more taps in a sequence fit a grid snapped to the tune's
   *  note starts; it replaces the deck's grid at once, and is shared with the other deck holding
   *  the same tune and saved when the taps stop. Does nothing until the tune's note starts exist. */
  tap(slot: Slot): void {
    const identity = this.identities[slot];
    if (identity === null || this.store.decks()[slot].status !== 'playing') {
      return;
    }
    const starts = this.runtime.noteStarts(slot);
    if (starts === null) {
      return;
    }

    const now = Date.now();
    let sequence = this.sequences[slot];
    if (sequence !== null && now - sequence.lastTapAt >= TAP_IDLE_MS) {
      this.endSequence(slot);
      sequence = null;
    }
    if (sequence === null) {
      sequence = { frames: [], identity, lastTapAt: now, timer: null, fitted: null };
      this.sequences[slot] = sequence;
      this.store.setDeckTapping({ slot, tapping: true });
    }

    sequence.frames.push(Number(this.runtime.position(slot)));
    sequence.lastTapAt = now;
    if (sequence.timer !== null) {
      clearTimeout(sequence.timer);
    }
    sequence.timer = setTimeout(() => this.endSequence(slot), TAP_IDLE_MS);

    if (sequence.frames.length >= TAP_MIN_TAPS) {
      const fitted = fitBeatGrid(sequence.frames, starts);
      if (fitted !== null) {
        sequence.fitted = fitted;
        this.store.setDeckBeatGrid({ slot, beatGrid: tappedGrid(fitted) });
      }
    }
  }

  /** Where the deck is in its beat, read now from the engine's position: the beat counted from beat
   *  one, how far through it, and the tempo it sounds at. Null with no grid or outside its span. */
  beatPosition(slot: Slot): { beat: number; phase: number; bpm: number } | null {
    const { beatGrid, playCallIntervalUs, speed } = this.store.decks()[slot];
    if (beatGrid === null || playCallIntervalUs === null) {
      return null;
    }
    const frame = Number(this.runtime.position(slot));
    if (!inGridSpan(beatGrid, frame)) {
      return null;
    }
    return {
      ...beatAt(beatGrid, frame),
      bpm: bpmOf(beatGrid.beatFrames, playCallIntervalUs, speed),
    };
  }

  /** The taps have stopped: the deck stops tapping, and a grid the sequence fitted goes to the
   *  other deck if it holds the same tune and subtune, then is saved. */
  private endSequence(slot: Slot): void {
    const sequence = this.dropSequence(slot);
    if (sequence === null || sequence.fitted === null) {
      return;
    }
    const { fitted, identity } = sequence;

    const other = otherSlot(slot);
    const otherIdentity = this.identities[other];
    if (
      otherIdentity !== null &&
      otherIdentity.sidHash === identity.sidHash &&
      otherIdentity.subtune === identity.subtune
    ) {
      this.store.setDeckBeatGrid({ slot: other, beatGrid: tappedGrid(fitted) });
    }

    this.save(identity, fitted).catch((error: unknown) =>
      logError(`DeckGrid: the grid tapped on deck ${slot} was not saved — ${describeError(error)}`)
    );
  }

  /** Writes this subtune's grid into the tune's document, keeping the other subtunes'. */
  private async save(identity: TuneIdentity, grid: BeatGrid): Promise<void> {
    const existing = await this.beatGrids.load(identity.sidHash);
    const entry: StoredBeatGrid = {
      subtune: identity.subtune,
      beatFrames: grid.beatFrames,
      beatOneFrame: grid.beatOneFrame,
    };
    await this.beatGrids.save({
      sidHash: identity.sidHash,
      subtunes: [
        ...(existing?.subtunes ?? []).filter((stored) => stored.subtune !== identity.subtune),
        entry,
      ],
      updated: new Date().toISOString(),
    });
  }

  /** Forgets the deck's tap sequence and its timer, and clears `tapping`. Returns the sequence. */
  private dropSequence(slot: Slot): TapSequence | null {
    const sequence = this.sequences[slot];
    if (sequence === null) {
      return null;
    }
    if (sequence.timer !== null) {
      clearTimeout(sequence.timer);
    }
    this.sequences[slot] = null;
    this.store.setDeckTapping({ slot, tapping: false });
    return sequence;
  }
}
