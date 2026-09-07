import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { milliseconds, msToPlayCalls, playCallIntervalUs } from '@sidablist/core';
import { nextMomentOffset, reachableMomentOffsets } from '../../analysis/marker-moments';
import { TuneIndexService } from '../../analysis/tune-index.service';
import type { DetectedMoment } from '../../analysis/tune-index.model';
import { DeckContext } from '../deck-context';
import { DECK_PLAYER_VIEW } from '../deck-player';
import { MarkerCollection, NUDGE_RANGE_MS } from '../marker-collection';

const MICROSECONDS_PER_MILLISECOND = 1000;

/**
 * Retitled from Cues: a marker is a cue with an optional end, so this panel is the whole of what a
 * deck can capture, loop and trigger. Every row is stacked — number/trigger, then Start, then End,
 * then a per-marker progress strip — and never wraps into a second column, however narrow the panel
 * gets.
 *
 * Nudges are drawn in frames and stored in real time. The slider, its ticks and its readout are all
 * frame counts, because a stored moment is a frame number and a tick has to land on one;
 * `MarkerCollection` holds the committed offset in milliseconds so a row's felt range is the same on
 * a 1x tune and a 2x-multispeed one. This component is the one place the two meet — see
 * `msToFrames`/`framesToMs`.
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
  private readonly collection = inject(MarkerCollection);
  private readonly view = inject(DECK_PLAYER_VIEW);
  private readonly tuneIndex = inject(TuneIndexService);
  private readonly context = inject(DeckContext);

  protected readonly label = this.context.label;

  protected readonly markers = this.collection.markers;
  protected readonly loopingMarker = this.collection.loopingMarker;
  protected readonly queuedMarker = this.collection.queuedMarker;
  /** True while a `triggerMarker` launch is awaiting `play()` — trigger and delete are disabled on
   *  every row for that span, since a delete racing the await would reindex out from under it. */
  protected readonly markerLaunchPending = this.collection.markerLaunchPending;

  /** The nudge range in the slider's own frames. Derived from the stored real-time range at the
   *  tune's own rate, so the felt window is the same on a 1x tune and a 2x-multispeed one. */
  protected readonly nudgeRange = computed<number>(() => this.msToFrames(NUDGE_RANGE_MS));

  /** Empty between loads and for a tune with no stored moments. */
  private readonly moments = computed<readonly DetectedMoment[]>(
    () => this.tuneIndex.record()?.detectedMoments ?? []
  );

  /** A real-time nudge in frames — the same conversion `MarkerCollection` applies when it resolves a
   *  row, so what a readout draws and the frame actually played agree. */
  private msToFrames(ms: number): number {
    const { nominalIntervalUs, rate } = this.view.snapshot().tempo;
    return msToPlayCalls(milliseconds(ms), nominalIntervalUs, rate);
  }

  /** The inverse, applied once at the commit: the collection stores real time, the slider works in
   *  frames. */
  private framesToMs(frameCount: number): number {
    const { nominalIntervalUs, rate } = this.view.snapshot().tempo;
    return Math.round(
      (frameCount * playCallIntervalUs(nominalIntervalUs, rate)) / MICROSECONDS_PER_MILLISECOND
    );
  }

  /** 0–100, non-zero only for the marker currently looping. Reads the polled playhead so the strip
   *  re-renders as the lap advances — the collection pulls the position again for the arithmetic. */
  protected progressPercentFor(index: number): number {
    this.view.position();
    return this.collection.progressPercentFor(index);
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
  // marker's start". Re-entering a point seeks and re-arms, so the commit has to wait for the
  // release rather than following every drag tick.
  private readonly startDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  // Marker index → the end offset being dragged right now. Kept purely so the readout tracks the
  // thumb; the commit itself waits for release, because it also auditions the seam.
  private readonly endDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  protected onAddMarker(): void {
    this.collection.addMarker();
  }

  protected onTriggerMarker(index: number): void {
    void this.collection.triggerMarker(index);
  }

  protected onSetMarkerEnd(index: number): void {
    this.collection.setMarkerEnd(index);
  }

  protected onClearMarkerEnd(index: number): void {
    this.collection.clearMarkerEnd(index);
  }

  protected onDeleteMarker(index: number): void {
    this.collection.deleteMarker(index);
  }

  protected onStopLoop(): void {
    this.collection.stopMarkerLoop();
  }

  /** The start offset a marker's row shows, in frames: the live drag while one is in flight, the
   * committed value otherwise. */
  protected displayedMarkerStartOffset(index: number): number {
    const committed = this.markers()[index]?.startOffsetMs ?? 0;
    return this.startDragOffsets().get(index) ?? this.msToFrames(committed);
  }

  /** The end offset a marker's row shows — mirrors `displayedMarkerStartOffset`. */
  protected displayedMarkerEndOffset(index: number): number {
    const committed = this.markers()[index]?.end?.offsetMs ?? 0;
    return this.endDragOffsets().get(index) ?? this.msToFrames(committed);
  }

  /** The start's frame readout: the captured frame plus whichever offset is currently displayed —
   * the nudged frame, since that is where the marker actually lands. */
  protected markerStartFrame(index: number): number | null {
    const marker = this.markers()[index] ?? null;
    if (marker === null) return null;
    return marker.startFrame + this.displayedMarkerStartOffset(index);
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

  // Moves the readout only. Committing seeks and re-arms the loop, so running one per drag tick
  // would put a steady stream of jumps beside the audio callback.
  protected onMarkerStartNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.startDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // point now lands. Auditions bypass the queue by design — a setup gesture, not a performance
  // trigger — and must stay immediate even while a loop is already running.
  protected onMarkerStartNudgeChange(index: number, event: Event): void {
    this.commitStartOffset(index, Number((event.target as HTMLInputElement).value));
  }

  /** Every stored moment the start nudge can reach, as frame offsets — one tick per entry,
   *  positioned by `tickLeftPercent`. */
  protected startTickOffsets(index: number): readonly number[] {
    const marker = this.markers()[index] ?? null;
    if (marker === null) return [];
    return reachableMomentOffsets(this.moments(), marker.startFrame, this.nudgeRange());
  }

  /** The end nudge's reachable moments — mirrors `startTickOffsets`. */
  protected endTickOffsets(index: number): readonly number[] {
    const end = this.markers()[index]?.end ?? null;
    return end === null ? [] : reachableMomentOffsets(this.moments(), end.frame, this.nudgeRange());
  }

  // Moves the readout only, same as the start drag.
  protected onMarkerEndNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.endDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // seam now lands — see `onMarkerStartNudgeChange`.
  protected onMarkerEndNudgeChange(index: number, event: Event): void {
    this.commitEndOffset(index, Number((event.target as HTMLInputElement).value));
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

  // Routes through the same commit `onMarkerStartNudgeChange` makes on slider release: clearing the
  // drag-offset entry matters just as much as the offset itself — a stale entry there would
  // otherwise win over the committed value in `displayedMarkerStartOffset`.
  protected onSnapMarkerStart(index: number, direction: -1 | 1): void {
    const next = this.nextStartMomentOffset(index, direction);
    if (next === null) return;
    this.commitStartOffset(index, next);
  }

  // Mirrors `onSnapMarkerStart`.
  protected onSnapMarkerEnd(index: number, direction: -1 | 1): void {
    const next = this.nextEndMomentOffset(index, direction);
    if (next === null) return;
    this.commitEndOffset(index, next);
  }

  /** Commits a frame offset as the real time the collection stores, then auditions. Clearing the
   *  drag entry matters as much as the commit — a stale entry there would otherwise win over the
   *  committed value in `displayedMarkerStartOffset`. */
  private commitStartOffset(index: number, offsetFrames: number): void {
    this.collection.setMarkerStartOffset(index, this.framesToMs(offsetFrames));
    void this.collection.auditionMarkerStart(index);
    this.startDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  /** Mirrors `commitStartOffset`. */
  private commitEndOffset(index: number, offsetFrames: number): void {
    this.collection.setMarkerEndOffset(index, this.framesToMs(offsetFrames));
    void this.collection.auditionMarkerEnd(index);
    this.endDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  private nextStartMomentOffset(index: number, direction: -1 | 1): number | null {
    const marker = this.markers()[index] ?? null;
    if (marker === null) return null;
    return nextMomentOffset(
      this.moments(),
      marker.startFrame,
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
