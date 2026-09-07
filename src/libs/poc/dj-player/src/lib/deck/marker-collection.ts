import { signal, WritableSignal } from '@angular/core';
import { clamp, frames, milliseconds, msToPlayCalls } from '@sidablist/core';
import type { Frames, PlayRate } from '@sidablist/core';

/** The nudge window in real time. An application ergonomic, not a timeline fact, so it lives here
 *  rather than in core: frames are derived from the tune's own rate, so the felt range is the same
 *  on a 1x tune and a 2x-multispeed one. */
export const NUDGE_RANGE_MS = 1000;

/** How much music plays into the seam when a marker's end is auditioned. A feel default — confirm
 *  by ear on hardware. */
export const LOOP_AUDITION_PREROLL_MS = 2000;

/** A loop's bounds — exactly the shape `setActiveLoop` takes and a snapshot's `loop` field reports
 *  back, so a resolved marker loop and the one core is enforcing are always the same type. */
export interface MarkerLoopBounds {
  readonly startFrame: Frames;
  readonly endFrame: Frames;
}

/**
 * What `MarkerCollection` needs from the player: core's seek and active-loop operations, plus enough
 * of its read side to size a nudge in frames and read a loop's progress against the bounds core is
 * actually enforcing. Named narrowly and taken as a constructor argument rather than reaching for a
 * coordinator — and shaped as a structural subset of `SidPlayer`, so a real one satisfies this
 * with no adapter.
 */
export interface MarkerPlayer {
  /** Pulled, not pushed — mirrors `SidPlayer.getSnapshot()`'s own contract for the fields this reads. */
  getSnapshot(): {
    readonly transport: 'stopped' | 'playing' | 'paused' | 'ended' | 'error';
    /** The loop core is presently enforcing — the basis a looping marker's progress reads back
     *  rather than recomputing from its own stored frames. */
    readonly loop: MarkerLoopBounds | null;
    readonly tempo: {
      readonly nominalIntervalUs: number;
      readonly rate: PlayRate;
    };
  };
  /** The playhead, pulled fresh for every read rather than threaded in by a caller. */
  getPosition(): Frames;
  /** Launches (or resumes) playback. `triggerMarker` awaits this when nothing is playing yet. */
  play(): Promise<void>;
  /** Moves the playhead to a frame outright — a cue's trigger and every audition resolve to this. */
  seek(frame: Frames): Promise<void>;
  /** Arms or clears the loop core enforces every frame. */
  setActiveLoop(loop: MarkerLoopBounds | null): void;
}

/** A marker's end: a frame plus its nudge offset in real time. */
export interface SavedMarkerEnd {
  readonly frame: Frames;
  /** −NUDGE_RANGE_MS..+NUDGE_RANGE_MS. */
  readonly offsetMs: number;
}

/**
 * A remembered frame number plus an optional end, each with a nudge offset — what a marker always
 * was underneath, once the machine image and register snapshot core's anchor ring keeps for it are
 * taken out of the picture. A cue is a marker with no end; a loop is one whose end resolves after
 * its start once nudges are applied — see `MarkerCollection`'s private `resolveLoop`. No machine
 * image, no register snapshot: those belong to core's anchor ring and never cross out of it.
 */
export interface SavedMarker {
  readonly startFrame: Frames;
  /** −NUDGE_RANGE_MS..+NUDGE_RANGE_MS. */
  readonly startOffsetMs: number;
  readonly end: SavedMarkerEnd | null;
}

/** The row as the trigger and audition paths need it: the bounds a pass over it actually plays. */
interface ResolvedLoop {
  readonly startFrame: Frames;
  readonly outFrame: Frames;
}

/**
 * The saved cues and loops for one deck: their frame numbers, nudge offsets, pad-adjacent bookkeeping,
 * and which one is queued or looping. Built entirely on `MarkerPlayer`'s seek and active-loop
 * operations — a trigger seeks, a loop arms or clears, and nothing here ever holds a machine image or
 * a register snapshot, so a row costs nothing more than two frame numbers and two small offsets,
 * loop or cue alike.
 *
 * `progressPercentFor` and every trigger/audition path pull the loop core is enforcing and the
 * position it is at fresh from `player` on every call rather than holding a copy of either, so this
 * can never disagree with what is actually playing.
 *
 * Queuing a marker behind one already looping only ever records the intent (`queuedMarker`): nothing
 * here advances it on a lap boundary, since `MarkerPlayer` carries no notification for one — the hand-
 * off a later task adds once core exposes that signal.
 */
export class MarkerCollection {
  constructor(private readonly player: MarkerPlayer) {}

  /** Markers listed side by side, appended and removed freely. */
  readonly markers: WritableSignal<readonly SavedMarker[]> = signal([]);
  /** The marker currently looping, or null. */
  readonly loopingMarker: WritableSignal<number | null> = signal(null);
  /** The marker queued behind the one currently looping, or null. */
  readonly queuedMarker: WritableSignal<number | null> = signal(null);
  /** True for the span of `triggerMarker`'s `play()` await — the view must gate trigger and delete on
   *  this rather than trust an index across that gap. */
  readonly markerLaunchPending: WritableSignal<boolean> = signal(false);

  /** Converts a real-time duration to frames at the tune's own rate, read fresh from the player
   *  rather than held as a copy — shared by the nudge resolution and the loop audition pre-roll. */
  private msToFrames(ms: number): number {
    const { nominalIntervalUs, rate } = this.player.getSnapshot().tempo;
    return msToPlayCalls(milliseconds(ms), nominalIntervalUs, rate);
  }

  /** Where a start or an end actually sits once its nudge is applied — never before the start of the
   *  tune. */
  private resolvedFrame(frame: Frames, offsetMs: number): Frames {
    return frames(Math.max(0, frame + this.msToFrames(offsetMs)));
  }

  /**
   * The row as the trigger and audition paths need it: the bounds a pass over it actually plays. Null
   * unless an end is marked and, with nudges applied, still resolves after the start — an end that
   * has crossed or met the start describes no pass, and a marker in that state is not broken, it is a
   * cue.
   */
  private resolveLoop(marker: SavedMarker): ResolvedLoop | null {
    if (marker.end === null) return null;
    const startFrame = this.resolvedFrame(marker.startFrame, marker.startOffsetMs);
    const outFrame = this.resolvedFrame(marker.end.frame, marker.end.offsetMs);
    return outFrame > startFrame ? { startFrame, outFrame } : null;
  }

  private updateMarker(index: number, next: (current: SavedMarker) => SavedMarker): void {
    this.markers.update((markers) => markers.map((m, i) => (i === index ? next(m) : m)));
  }

  /** Appends a new marker, capturing the current position into its start. Returns the row's index. */
  addMarker(): number {
    const index = this.markers().length;
    const marker: SavedMarker = {
      startFrame: this.player.getPosition(),
      startOffsetMs: 0,
      end: null,
    };
    this.markers.update((markers) => [...markers, marker]);
    return index;
  }

  /**
   * (Re)captures the current position into an existing row's start, resetting its nudge to zero, and
   * leaves whatever end the row already holds untouched.
   */
  captureMarkerStart(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    const startFrame = this.player.getPosition();
    this.updateMarker(index, (current) => ({ ...current, startFrame, startOffsetMs: 0 }));
  }

  /**
   * Marks a row's end at the current frame, which is what turns it into a loop candidate — see
   * `resolveLoop` for when it actually resolves to one.
   */
  setMarkerEnd(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    const end: SavedMarkerEnd = { frame: this.player.getPosition(), offsetMs: 0 };
    this.updateMarker(index, (current) => ({ ...current, end }));
  }

  /** Drops a row's end, which is what turns a loop back into a cue. Leaves the start untouched. */
  clearMarkerEnd(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    this.updateMarker(index, (current) => ({ ...current, end: null }));
  }

  /** Walks a row's start up to ±`NUDGE_RANGE_MS`. Arithmetic alone — nothing is resolved or replayed
   *  until the next trigger or audition. */
  setMarkerStartOffset(index: number, offsetMs: number): void {
    if (index < 0 || index >= this.markers().length || !Number.isFinite(offsetMs)) return;
    const clamped = clamp(offsetMs, -NUDGE_RANGE_MS, NUDGE_RANGE_MS);
    this.updateMarker(index, (current) => ({ ...current, startOffsetMs: clamped }));
  }

  /** Walks a row's end up to ±`NUDGE_RANGE_MS`; a no-op with no end marked. */
  setMarkerEndOffset(index: number, offsetMs: number): void {
    if (index < 0 || index >= this.markers().length || !Number.isFinite(offsetMs)) return;
    const end = this.markers()[index].end;
    if (end === null) return;
    const clamped = clamp(offsetMs, -NUDGE_RANGE_MS, NUDGE_RANGE_MS);
    this.updateMarker(index, (current) => ({ ...current, end: { ...end, offsetMs: clamped } }));
  }

  /**
   * Re-enters `index` at its resolved start and arms (or clears) the loop it resolves to, immediately
   * and bypassing the queue — a setup gesture on a specific row, not a performance trigger.
   */
  async auditionMarkerStart(index: number): Promise<void> {
    await this.engageMarker(index);
  }

  /**
   * Re-enters `index` far enough before its end to hear the loop-back seam, and arms the loop so the
   * wrap actually happens. No-op for a row that does not resolve to a loop. How core gets the
   * playhead there is core's own concern — this only decides where to land and what to arm.
   */
  async auditionMarkerEnd(index: number): Promise<void> {
    if (index < 0 || index >= this.markers().length) return;
    const loop = this.resolveLoop(this.markers()[index]);
    if (loop === null) return;

    const prerollFrames = this.msToFrames(LOOP_AUDITION_PREROLL_MS);
    const target = frames(Math.max(loop.startFrame, loop.outFrame - prerollFrames));

    this.player.setActiveLoop({ startFrame: loop.startFrame, endFrame: loop.outFrame });
    this.loopingMarker.set(index);
    this.queuedMarker.set(null);
    await this.player.seek(target);
  }

  /**
   * Engages `index` now if nothing is looping, or queues it behind the current one if something is.
   * Launches (or resumes) playback first if it is not already running, gating the view's trigger and
   * delete controls on `markerLaunchPending` for exactly that span — a delete racing the await would
   * otherwise reindex the row this re-checks out from under it.
   *
   * A no-op for an out-of-range row. Re-triggering the marker already looping, with nothing queued
   * behind it, restarts its lap rather than queueing behind itself.
   */
  async triggerMarker(index: number): Promise<void> {
    if (index < 0 || index >= this.markers().length) return;

    if (this.player.getSnapshot().transport !== 'playing') {
      this.markerLaunchPending.set(true);
      try {
        await this.player.play();
      } finally {
        this.markerLaunchPending.set(false);
      }
      if (this.player.getSnapshot().transport !== 'playing') return;
      if (index >= this.markers().length) return; // reindexed out from under the await
    }

    const active = this.loopingMarker();
    if (active === null || (active === index && this.queuedMarker() === null)) {
      await this.engageMarker(index);
      return;
    }
    // Newest trigger wins, and playback is left alone to finish its lap.
    this.queuedMarker.set(index);
  }

  /**
   * Drops the loop core is enforcing and whatever was queued behind it. A get-out, not a musical
   * transition: nothing about the playhead moves.
   */
  stopMarkerLoop(): void {
    this.player.setActiveLoop(null);
    this.loopingMarker.set(null);
    this.queuedMarker.set(null);
  }

  /**
   * Removes a row outright, shifting every later index down by one. `loopingMarker` and
   * `queuedMarker` are indices into this same array, so each is cleared if it names the deleted row —
   * clearing core's active loop too, if it was the one enforced, since core has no other signal that
   * the row it was told to loop no longer exists — and decremented if it names one that just shifted.
   */
  deleteMarker(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    this.markers.update((markers) => markers.filter((_, i) => i !== index));

    const active = this.loopingMarker();
    if (active === index) {
      this.player.setActiveLoop(null);
      this.loopingMarker.set(null);
    } else if (active !== null && active > index) {
      this.loopingMarker.set(active - 1);
    }

    const queued = this.queuedMarker();
    if (queued === index) {
      this.queuedMarker.set(null);
    } else if (queued !== null && queued > index) {
      this.queuedMarker.set(queued - 1);
    }
  }

  /**
   * How far the looping marker is through its bounds, 0–100; 0 for every other row. Reads the loop
   * core is presently enforcing and the playhead's current position — never a copy of either.
   */
  progressPercentFor(index: number): number {
    if (index !== this.loopingMarker()) return 0;
    const active = this.player.getSnapshot().loop;
    if (active === null) return 0;
    const span = active.endFrame - active.startFrame;
    if (span <= 0) return 0;
    const position = this.player.getPosition();
    return clamp(((position - active.startFrame) / span) * 100, 0, 100);
  }

  /**
   * Re-enters a row at its resolved start and arms (or clears) the loop it resolves to, dropping
   * whatever was queued behind it. Re-checks the resolved shape at the point of engagement — a
   * queued row's end can be nudged across its start while it waits, so the trigger-time check alone
   * isn't enough.
   */
  private async engageMarker(index: number): Promise<void> {
    if (index < 0 || index >= this.markers().length) return;
    const marker = this.markers()[index];
    const loop = this.resolveLoop(marker);
    const startFrame = this.resolvedFrame(marker.startFrame, marker.startOffsetMs);

    this.player.setActiveLoop(
      loop === null ? null : { startFrame: loop.startFrame, endFrame: loop.outFrame }
    );
    this.loopingMarker.set(loop === null ? null : index);
    this.queuedMarker.set(null);
    await this.player.seek(startFrame);
  }
}
