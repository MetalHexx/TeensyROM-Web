import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { nextMomentOffset, reachableMomentOffsets } from '../../analysis/marker-moments';
import type { DetectedMoment } from '../../analysis/tune-index.model';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import { DeckContext } from '../deck-context';

/**
 * Retitled from Cues: a marker is a cue with an optional end, so this panel is the whole of what a
 * deck can capture, loop and trigger. Every row is stacked — number/trigger, then Start, then End,
 * then a per-marker progress strip — and never wraps into a second column, however narrow the panel
 * gets.
 *
 * Reads every collaborator from the deck injector it renders inside (`DeckHostComponent`'s
 * `providers`) — no inputs, because the injector already resolves per deck.
 */
@Component({
  selector: 'lib-loops-cues-panel',
  templateUrl: './loops-cues-panel.component.html',
  styleUrl: './loops-cues-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoopsCuesPanelComponent {
  private readonly engine = inject(DjPlayerEngine);
  private readonly context = inject(DeckContext);

  protected readonly label = this.context.label;

  protected readonly markers = this.engine.markers;
  protected readonly loopingMarker = this.engine.loopingMarker;
  protected readonly queuedMarker = this.engine.queuedMarker;
  /** True while a `triggerMarker` launch is awaiting `play()` — trigger and delete are disabled on
   *  every row for that span, since a delete racing the await would reindex out from under it. */
  protected readonly markerLaunchPending = this.engine.markerLaunchPending;
  protected readonly nudgeRange = this.engine.nudgeRangeFrames;

  /** Read off the engine's own tune index rather than injecting `TuneIndexService` as a second
   *  source for the same fact — the engine is the one thing every write to that service also calls,
   *  so the two can never disagree. Empty between loads and for a tune with no stored moments. */
  private readonly moments = computed<readonly DetectedMoment[]>(
    () => this.engine.tuneIndex()?.detectedMoments ?? []
  );

  /** 0–100, non-zero only for the marker currently looping — the engine does the arithmetic. */
  protected progressPercentFor(index: number): number {
    return this.engine.progressPercentFor(index);
  }

  /** Which of the three states a marker's row is in — drives the visual distinction between active,
   * queued and idle without relying on a text label. Every marker can be queued now that a cue and
   * a loop are the same kind of row. */
  protected markerState(index: number): 'active' | 'queued' | 'idle' {
    if (this.loopingMarker() === index) return 'active';
    if (this.queuedMarker() === index) return 'queued';
    return 'idle';
  }

  // Marker index → the start offset being dragged right now. Absent means "not dragging that
  // marker's start". Re-deriving a captured point replays frames, so the commit has to wait for the
  // release rather than following every drag tick.
  private readonly startDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  // Marker index → the end offset being dragged right now. Kept purely so the readout tracks the
  // thumb; the commit itself waits for release, because it also auditions the seam.
  private readonly endDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  protected onAddMarker(): void {
    this.engine.addMarker();
  }

  protected onCaptureMarkerStart(index: number): void {
    this.engine.captureMarkerStart(index);
  }

  protected onTriggerMarker(index: number): void {
    void this.engine.triggerMarker(index);
  }

  protected onSetMarkerEnd(index: number): void {
    this.engine.setMarkerEnd(index);
  }

  protected onClearMarkerEnd(index: number): void {
    this.engine.clearMarkerEnd(index);
  }

  protected onClearMarker(index: number): void {
    this.engine.clearMarker(index);
  }

  protected onDeleteMarker(index: number): void {
    this.engine.deleteMarker(index);
  }

  protected onStopLoop(): void {
    this.engine.stopLoop();
  }

  /** The start offset a marker's row shows: the live drag while one is in flight, the committed
   * value otherwise. */
  protected displayedMarkerStartOffset(index: number): number {
    return this.startDragOffsets().get(index) ?? this.markers()[index]?.start?.offset ?? 0;
  }

  /** The end offset a marker's row shows — mirrors `displayedMarkerStartOffset`. */
  protected displayedMarkerEndOffset(index: number): number {
    return this.endDragOffsets().get(index) ?? this.markers()[index]?.end?.offset ?? 0;
  }

  /** The start's frame readout: the captured frame plus whichever offset is currently displayed —
   * the nudged frame, since that is where the marker actually lands. */
  protected markerStartFrame(index: number): number | null {
    const point = this.markers()[index]?.start ?? null;
    return point === null ? null : point.frame + this.displayedMarkerStartOffset(index);
  }

  /** The end's frame readout — mirrors `markerStartFrame`. */
  protected markerEndFrame(index: number): number | null {
    const end = this.markers()[index]?.end ?? null;
    return end === null ? null : end.frame + this.displayedMarkerEndOffset(index);
  }

  /** The row's loop length in frames — resolved end minus resolved start, tracking whichever
   * nudge is currently being dragged. Null with no end marked, matching when the row has nothing
   * to show. */
  protected loopLengthFrames(index: number): number | null {
    const end = this.markerEndFrame(index);
    if (end === null) return null;
    const start = this.markerStartFrame(index);
    return start === null ? null : end - start;
  }

  protected markerStartOffsetLabel(index: number): string {
    return offsetLabel(this.displayedMarkerStartOffset(index));
  }

  protected markerEndOffsetLabel(index: number): string {
    return offsetLabel(this.displayedMarkerEndOffset(index));
  }

  // Moves the readout only. Every re-derivation replays up to ~50 frames of emulation on the thread
  // the frame clock rides, so running one per drag tick would put steady replay load beside the
  // audio callback.
  protected onMarkerStartNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.startDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // point now lands. Auditions bypass the queue by design — a setup gesture, not a performance
  // trigger — and must stay immediate even while a loop is already running.
  protected onMarkerStartNudgeChange(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setMarkerStartOffset(index, value);
    this.engine.auditionMarkerStart(index);
    this.startDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  // Moves the readout only, same as the start drag.
  protected onMarkerEndNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.endDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // seam now lands — see `onMarkerStartNudgeChange`.
  protected onMarkerEndNudgeChange(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setMarkerEndOffset(index, value);
    this.engine.auditionMarkerEnd(index);
    this.endDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  /** Every stored moment the start nudge can reach, as offsets — one tick per entry, positioned by
   *  `tickLeftPercent`. Empty for an uncaptured slot, matching `.marker-nudge--empty` rendering no
   *  ticks either. */
  protected startTickOffsets(index: number): readonly number[] {
    const point = this.markers()[index]?.start ?? null;
    return point === null
      ? []
      : reachableMomentOffsets(this.moments(), point.frame, this.nudgeRange());
  }

  /** The end nudge's reachable moments — mirrors `startTickOffsets`. */
  protected endTickOffsets(index: number): readonly number[] {
    const end = this.markers()[index]?.end ?? null;
    return end === null ? [] : reachableMomentOffsets(this.moments(), end.frame, this.nudgeRange());
  }

  /** Left-percent for a tick or the nudge centre inside `.marker-nudge` — offset `0` sits at 50%,
   *  ±`nudgeRange()` sit at the two edges. */
  protected tickLeftPercent(offset: number): number {
    const range = this.nudgeRange();
    return range === 0 ? 50 : ((offset + range) / (2 * range)) * 100;
  }

  protected snapMarkerStartDisabled(index: number, direction: -1 | 1): boolean {
    return this.nextStartMomentOffset(index, direction) === null;
  }

  protected snapMarkerEndDisabled(index: number, direction: -1 | 1): boolean {
    return this.nextEndMomentOffset(index, direction) === null;
  }

  // Routes through the same two engine calls `onMarkerStartNudgeChange` makes on slider release, in
  // the same order: `setMarkerStartOffset` is what keeps a snapped start's machine-image handling
  // byte-identical to a hand-nudged one, and clearing the drag-offset entry matters just as much — a
  // stale entry there would otherwise win over the committed value in `displayedMarkerStartOffset`.
  protected onSnapMarkerStart(index: number, direction: -1 | 1): void {
    const next = this.nextStartMomentOffset(index, direction);
    if (next === null) return;
    this.engine.setMarkerStartOffset(index, next);
    this.engine.auditionMarkerStart(index);
    this.startDragOffsets.update((offsets) => {
      const nextOffsets = new Map(offsets);
      nextOffsets.delete(index);
      return nextOffsets;
    });
  }

  // Mirrors `onSnapMarkerStart` via `setMarkerEndOffset` + `auditionMarkerEnd`.
  protected onSnapMarkerEnd(index: number, direction: -1 | 1): void {
    const next = this.nextEndMomentOffset(index, direction);
    if (next === null) return;
    this.engine.setMarkerEndOffset(index, next);
    this.engine.auditionMarkerEnd(index);
    this.endDragOffsets.update((offsets) => {
      const nextOffsets = new Map(offsets);
      nextOffsets.delete(index);
      return nextOffsets;
    });
  }

  private nextStartMomentOffset(index: number, direction: -1 | 1): number | null {
    const point = this.markers()[index]?.start ?? null;
    if (point === null) return null;
    return nextMomentOffset(
      this.moments(),
      point.frame,
      this.displayedMarkerStartOffset(index),
      this.nudgeRange(),
      direction
    );
  }

  private nextEndMomentOffset(index: number, direction: -1 | 1): number | null {
    const end = this.markers()[index]?.end ?? null;
    if (end === null) return null;
    return nextMomentOffset(
      this.moments(),
      end.frame,
      this.displayedMarkerEndOffset(index),
      this.nudgeRange(),
      direction
    );
  }
}

/** Signed and unit-suffixed, as a nudge row reads it: `+0 fr`, `−7 fr`. */
function offsetLabel(offset: number): string {
  return `${offset < 0 ? '−' : '+'}${Math.abs(offset)} fr`;
}
