import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { frames, PAL_FRAME_INTERVAL_US } from '@sidablist/core';
import { LoopsCuesPanelComponent } from './loops-cues-panel.component';
import { DeckContext } from '../deck-context';
import { DECK_PLAYER_VIEW } from '../deck-player';
import { MarkerCollection } from '../marker-collection';
import type { SavedMarker } from '../marker-collection';
import { TuneIndexService } from '../../analysis/tune-index.service';
import type { DetectedMoment, TuneIndexRecord } from '../../analysis/tune-index.model';
import { createFakeDeckPlayer } from '../../../testing/player-doubles';
import type { FakeDeckPlayer } from '../../../testing/player-doubles';

/** The panel draws nudges in frames and commits them as the real time `MarkerCollection` stores;
 *  these specs state their intent in frames and convert here, at the same PAL rate the default
 *  snapshot reports. */
function committedMs(offsetFrames: number): number {
  return Math.round((offsetFrames * PAL_FRAME_INTERVAL_US) / 1000);
}

function markerWithStart(frame: number): SavedMarker {
  return { startFrame: frames(frame), startOffsetMs: 0, end: null };
}

function markerWithLoop(startFrame: number, endFrame: number): SavedMarker {
  return {
    startFrame: frames(startFrame),
    startOffsetMs: 0,
    end: { frame: frames(endFrame), offsetMs: 0 },
  };
}

/** A `TuneIndexRecord` standing in for the one real field this panel reads — the rest are never
 *  touched by the component, so a full record would only add noise here. */
function recordWithMoments(moments: readonly DetectedMoment[]): TuneIndexRecord {
  return { detectedMoments: moments } as unknown as TuneIndexRecord;
}

interface MockCollection {
  markers: WritableSignal<readonly SavedMarker[]>;
  loopingMarker: WritableSignal<number | null>;
  queuedMarker: WritableSignal<number | null>;
  markerLaunchPending: WritableSignal<boolean>;
  addMarker: ReturnType<typeof vi.fn>;
  triggerMarker: ReturnType<typeof vi.fn>;
  setMarkerEnd: ReturnType<typeof vi.fn>;
  clearMarkerEnd: ReturnType<typeof vi.fn>;
  deleteMarker: ReturnType<typeof vi.fn>;
  stopMarkerLoop: ReturnType<typeof vi.fn>;
  setMarkerStartOffset: ReturnType<typeof vi.fn>;
  setMarkerEndOffset: ReturnType<typeof vi.fn>;
  auditionMarkerStart: ReturnType<typeof vi.fn>;
  auditionMarkerEnd: ReturnType<typeof vi.fn>;
  progressPercentFor: ReturnType<typeof vi.fn>;
}

function makeCollection(): MockCollection {
  return {
    markers: signal<readonly SavedMarker[]>([]),
    loopingMarker: signal<number | null>(null),
    queuedMarker: signal<number | null>(null),
    markerLaunchPending: signal<boolean>(false),
    addMarker: vi.fn(),
    triggerMarker: vi.fn().mockResolvedValue(undefined),
    setMarkerEnd: vi.fn(),
    clearMarkerEnd: vi.fn(),
    deleteMarker: vi.fn(),
    stopMarkerLoop: vi.fn(),
    setMarkerStartOffset: vi.fn(),
    setMarkerEndOffset: vi.fn(),
    auditionMarkerStart: vi.fn().mockResolvedValue(undefined),
    auditionMarkerEnd: vi.fn().mockResolvedValue(undefined),
    progressPercentFor: vi.fn(() => 0),
  };
}

describe('LoopsCuesPanelComponent', () => {
  let fixture: ComponentFixture<LoopsCuesPanelComponent>;
  let collection: MockCollection;
  let player: FakeDeckPlayer;
  let tuneIndex: { record: WritableSignal<TuneIndexRecord | null> };

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    collection = makeCollection();
    player = createFakeDeckPlayer();
    tuneIndex = { record: signal<TuneIndexRecord | null>(null) };

    TestBed.configureTestingModule({
      imports: [LoopsCuesPanelComponent],
      providers: [
        DeckContext,
        { provide: MarkerCollection, useValue: collection as unknown as MarkerCollection },
        { provide: DECK_PLAYER_VIEW, useValue: player.view },
        { provide: TuneIndexService, useValue: tuneIndex as unknown as TuneIndexService },
      ],
    });

    const context = TestBed.inject(DeckContext);
    context.adopt({ id: 'test', label: deckLabel });

    fixture = TestBed.createComponent(LoopsCuesPanelComponent);
    fixture.detectChanges();
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.marker-row'));
  }

  it('maps each row to active, queued or idle from loopingMarker/queuedMarker', () => {
    build('A');
    collection.markers.set([markerWithStart(0), markerWithStart(10), markerWithStart(20)]);
    collection.loopingMarker.set(0);
    collection.queuedMarker.set(1);
    fixture.detectChanges();

    const states = rows().map((row) => row.getAttribute('data-marker-state'));
    expect(states).toEqual(['active', 'queued', 'idle']);
  });

  it('gates Trigger and Delete alike on markerLaunchPending, leaving Set End reachable', () => {
    build('A');
    collection.markers.set([markerWithStart(0)]);
    collection.markerLaunchPending.set(true);
    fixture.detectChanges();

    const row = rows()[0];
    const trigger = row.querySelector('.marker-trigger') as HTMLButtonElement;
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
    const deleteButton = buttons.find(
      (b) => b.textContent?.trim() === 'Delete'
    ) as HTMLButtonElement;
    const setEndButton = buttons.find(
      (b) => b.textContent?.trim() === 'Set End'
    ) as HTMLButtonElement;

    expect(trigger.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);
    expect(setEndButton.disabled).toBe(false);
  });

  it("suffix every control's accessible name with its own deck, distinct from the other deck", () => {
    build('A');
    const addA = (
      fixture.nativeElement.querySelector('.panel-header-actions button') as HTMLButtonElement
    ).getAttribute('aria-label');
    fixture.destroy();

    build('B');
    const addB = (
      fixture.nativeElement.querySelector('.panel-header-actions button') as HTMLButtonElement
    ).getAttribute('aria-label');

    expect(addA).toBe('Add marker deck A');
    expect(addB).toBe('Add marker deck B');
    expect(addA).not.toBe(addB);
  });

  it('shows the Loop Length readout only once a marker holds an end', () => {
    build('A');
    collection.markers.set([markerWithStart(100)]);
    fixture.detectChanges();

    expect(rows()[0].querySelector('.marker-loop-length')).toBeNull();

    collection.markers.set([markerWithLoop(100, 400)]);
    fixture.detectChanges();

    const length = rows()[0].querySelector('.marker-loop-length') as HTMLElement;
    expect(length.textContent?.trim()).toBe('Loop Length: 300 fr');
  });

  it('tracks the end nudge slider live, before the drag commits', () => {
    build('A');
    collection.markers.set([markerWithLoop(100, 400)]);
    fixture.detectChanges();

    const endNudge = rows()[0].querySelector(
      "[aria-label='Nudge marker 1 end deck A']"
    ) as HTMLInputElement;
    endNudge.value = '20';
    endNudge.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const length = rows()[0].querySelector('.marker-loop-length') as HTMLElement;
    expect(length.textContent?.trim()).toBe('Loop Length: 320 fr');
    expect(collection.setMarkerEndOffset).not.toHaveBeenCalled();
  });

  it('disables every snap control on every row with no tune index and with an empty moment list alike', () => {
    build('A');
    collection.markers.set([markerWithLoop(1_000, 2_000)]);
    fixture.detectChanges();

    const snapButtons = (): HTMLButtonElement[] =>
      Array.from(rows()[0].querySelectorAll<HTMLButtonElement>('.marker-snap'));

    expect(snapButtons().every((button) => button.disabled)).toBe(true);

    tuneIndex.record.set(recordWithMoments([]));
    fixture.detectChanges();

    expect(snapButtons().every((button) => button.disabled)).toBe(true);
  });

  it('presses next: commits the pure function result as real time, then auditions, using the displayed (dragged) offset and clearing the drag entry', () => {
    build('A');
    collection.markers.set([markerWithStart(1_000)]);
    // Clustered, irregularly-spaced moments around the captured frame, standing in for a real tune's:
    // a near one just past the offset the drag left the thumb at, a further one still inside the
    // window, and one outside it entirely.
    tuneIndex.record.set(
      recordWithMoments([
        { frame: 1_008, strength: 0.9 },
        { frame: 1_034, strength: 0.6 },
        { frame: 1_240, strength: 0.95 },
      ])
    );
    fixture.detectChanges();

    const startNudge = rows()[0].querySelector(
      "[aria-label='Nudge marker 1 start deck A']"
    ) as HTMLInputElement;
    startNudge.value = '5';
    startNudge.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows()[0].querySelector('.marker-offset')?.textContent?.trim()).toBe('+5 fr');

    const nextButton = rows()[0].querySelector(
      "[aria-label='Snap marker 1 start to next moment deck A']"
    ) as HTMLButtonElement;
    nextButton.click();
    fixture.detectChanges();

    // Reachable window is 1000 ± 50, so the far moment at +240 never qualifies; from a displayed
    // offset of +5 the next reachable one strictly beyond it is +8, not the nearer +34.
    expect(collection.setMarkerStartOffset).toHaveBeenCalledWith(0, committedMs(8));
    expect(collection.auditionMarkerStart).toHaveBeenCalledWith(0);
    expect(collection.setMarkerStartOffset.mock.invocationCallOrder[0]).toBeLessThan(
      collection.auditionMarkerStart.mock.invocationCallOrder[0]
    );

    // The mock collection never writes the offset back onto `markers()`, so the readout reverting to
    // the marker's own (unchanged) offset rather than staying at the stale +5 fr drag value is what
    // shows the drag entry was actually cleared, not merely overwritten by a new drag value.
    expect(rows()[0].querySelector('.marker-offset')?.textContent?.trim()).toBe('+0 fr');
  });

  it('mirrors pressing previous for the end control via setMarkerEndOffset + auditionMarkerEnd', () => {
    build('A');
    collection.markers.set([markerWithLoop(1_000, 5_000)]);
    tuneIndex.record.set(
      recordWithMoments([
        { frame: 4_970, strength: 0.7 },
        { frame: 4_990, strength: 0.5 },
      ])
    );
    fixture.detectChanges();

    const prevButton = rows()[0].querySelector(
      "[aria-label='Snap marker 1 end to previous moment deck A']"
    ) as HTMLButtonElement;
    expect(prevButton.disabled).toBe(false);
    prevButton.click();
    fixture.detectChanges();

    expect(collection.setMarkerEndOffset).toHaveBeenCalledWith(0, committedMs(-10));
    expect(collection.auditionMarkerEnd).toHaveBeenCalledWith(0);
  });

  it('renders one tick per reachable moment, ordered by offset, and none for an out-of-window moment', () => {
    build('A');
    collection.markers.set([markerWithStart(1_000)]);
    tuneIndex.record.set(
      recordWithMoments([
        { frame: 1_034, strength: 0.6 },
        { frame: 1_008, strength: 0.9 },
        { frame: 2_500, strength: 0.95 }, // outside the ±50 window
      ])
    );
    fixture.detectChanges();

    const ticks = rows()[0].querySelectorAll<HTMLElement>('.marker-ticks .marker-tick');
    expect(ticks.length).toBe(2);
    const lefts = Array.from(ticks).map((tick) => parseFloat(tick.style.left));
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  });
});
