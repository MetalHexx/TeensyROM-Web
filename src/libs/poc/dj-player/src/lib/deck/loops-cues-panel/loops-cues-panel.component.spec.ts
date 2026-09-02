import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { LoopsCuesPanelComponent } from './loops-cues-panel.component';
import { DeckContext } from '../deck-context';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type { CapturedPoint, Marker, MarkerEnd } from '../../engine/dj-player-engine';
import type { DetectedMoment, TuneIndexRecord } from '../../analysis/tune-index.model';

function startPoint(frame: number): CapturedPoint {
  return { frame, offset: 0, machine: {}, registers: {}, anchor: {} } as unknown as CapturedPoint;
}

function markerWithStart(frame: number): Marker {
  return { start: startPoint(frame), end: null };
}

function markerWithLoop(startFrame: number, endFrame: number): Marker {
  const end: MarkerEnd = { frame: endFrame, offset: 0 };
  return { start: startPoint(startFrame), end };
}

function emptyMarker(): Marker {
  return { start: null, end: null };
}

/** A `TuneIndexRecord` standing in for the one real field this panel reads — the rest are never
 *  touched by the component, so a full record would only add noise here. */
function recordWithMoments(moments: readonly DetectedMoment[]): TuneIndexRecord {
  return { detectedMoments: moments } as unknown as TuneIndexRecord;
}

interface MockEngine {
  markers: WritableSignal<readonly Marker[]>;
  loopingMarker: WritableSignal<number | null>;
  queuedMarker: WritableSignal<number | null>;
  markerLaunchPending: WritableSignal<boolean>;
  nudgeRangeFrames: WritableSignal<number>;
  tuneIndex: WritableSignal<TuneIndexRecord | null>;
  addMarker: ReturnType<typeof vi.fn>;
  captureMarkerStart: ReturnType<typeof vi.fn>;
  triggerMarker: ReturnType<typeof vi.fn>;
  setMarkerEnd: ReturnType<typeof vi.fn>;
  clearMarkerEnd: ReturnType<typeof vi.fn>;
  clearMarker: ReturnType<typeof vi.fn>;
  deleteMarker: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  setMarkerStartOffset: ReturnType<typeof vi.fn>;
  setMarkerEndOffset: ReturnType<typeof vi.fn>;
  auditionMarkerStart: ReturnType<typeof vi.fn>;
  auditionMarkerEnd: ReturnType<typeof vi.fn>;
  progressPercentFor: ReturnType<typeof vi.fn>;
}

function makeEngine(): MockEngine {
  return {
    markers: signal<readonly Marker[]>([]),
    loopingMarker: signal<number | null>(null),
    queuedMarker: signal<number | null>(null),
    markerLaunchPending: signal<boolean>(false),
    nudgeRangeFrames: signal(50),
    tuneIndex: signal<TuneIndexRecord | null>(null),
    addMarker: vi.fn(),
    captureMarkerStart: vi.fn(),
    triggerMarker: vi.fn(),
    setMarkerEnd: vi.fn(),
    clearMarkerEnd: vi.fn(),
    clearMarker: vi.fn(),
    deleteMarker: vi.fn(),
    stopLoop: vi.fn(),
    setMarkerStartOffset: vi.fn(),
    setMarkerEndOffset: vi.fn(),
    auditionMarkerStart: vi.fn(),
    auditionMarkerEnd: vi.fn(),
    progressPercentFor: vi.fn(() => 0),
  };
}

describe('LoopsCuesPanelComponent', () => {
  let fixture: ComponentFixture<LoopsCuesPanelComponent>;
  let engine: MockEngine;

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    engine = makeEngine();

    TestBed.configureTestingModule({
      imports: [LoopsCuesPanelComponent],
      providers: [
        DeckContext,
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
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

  it("reads 'Capture' for an empty marker and 'Trigger' once it holds a start", () => {
    build('A');
    engine.markers.set([emptyMarker()]);
    fixture.detectChanges();

    const trigger = rows()[0].querySelector('.marker-trigger') as HTMLButtonElement;
    expect(trigger.textContent?.trim()).toBe('Capture');

    engine.markers.set([markerWithStart(0)]);
    fixture.detectChanges();

    const triggerAfter = rows()[0].querySelector('.marker-trigger') as HTMLButtonElement;
    expect(triggerAfter.textContent?.trim()).toBe('Trigger');
  });

  it('maps each row to active, queued or idle from loopingMarker/queuedMarker', () => {
    build('A');
    engine.markers.set([markerWithStart(0), markerWithStart(10), markerWithStart(20)]);
    engine.loopingMarker.set(0);
    engine.queuedMarker.set(1);
    fixture.detectChanges();

    const states = rows().map((row) => row.getAttribute('data-marker-state'));
    expect(states).toEqual(['active', 'queued', 'idle']);
  });

  it('gates Trigger and Delete alike on markerLaunchPending, leaving Clear reachable', () => {
    build('A');
    engine.markers.set([markerWithStart(0)]);
    engine.markerLaunchPending.set(true);
    fixture.detectChanges();

    const row = rows()[0];
    const trigger = row.querySelector('.marker-trigger') as HTMLButtonElement;
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
    const deleteButton = buttons.find((b) => b.textContent?.trim() === 'Delete') as HTMLButtonElement;
    const clearButton = buttons.find((b) => b.textContent?.trim() === 'Clear') as HTMLButtonElement;

    expect(trigger.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);
    expect(clearButton.disabled).toBe(false);
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
    engine.markers.set([markerWithStart(100)]);
    fixture.detectChanges();

    expect(rows()[0].querySelector('.marker-loop-length')).toBeNull();

    engine.markers.set([markerWithLoop(100, 400)]);
    fixture.detectChanges();

    const length = rows()[0].querySelector('.marker-loop-length') as HTMLElement;
    expect(length.textContent?.trim()).toBe('Loop Length: 300 fr');
  });

  it('tracks the end nudge slider live, before the drag commits', () => {
    build('A');
    engine.markers.set([markerWithLoop(100, 400)]);
    fixture.detectChanges();

    const endNudge = rows()[0].querySelector(
      "[aria-label='Nudge marker 1 end deck A']"
    ) as HTMLInputElement;
    endNudge.value = '20';
    endNudge.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const length = rows()[0].querySelector('.marker-loop-length') as HTMLElement;
    expect(length.textContent?.trim()).toBe('Loop Length: 320 fr');
    expect(engine.setMarkerEndOffset).not.toHaveBeenCalled();
  });

  it('disables every snap control on every row with no tune index and with an empty moment list alike', () => {
    build('A');
    engine.markers.set([markerWithLoop(1_000, 2_000)]);
    fixture.detectChanges();

    const snapButtons = (): HTMLButtonElement[] =>
      Array.from(rows()[0].querySelectorAll<HTMLButtonElement>('.marker-snap'));

    expect(snapButtons().every((button) => button.disabled)).toBe(true);

    engine.tuneIndex.set(recordWithMoments([]));
    fixture.detectChanges();

    expect(snapButtons().every((button) => button.disabled)).toBe(true);
  });

  it('presses next: calls setMarkerStartOffset with the pure function result, then auditions, using the displayed (dragged) offset and clearing the drag entry', () => {
    build('A');
    engine.markers.set([markerWithStart(1_000)]);
    // Clustered, irregularly-spaced moments around the captured frame, standing in for a real tune's:
    // a near one just past the offset the drag left the thumb at, a further one still inside the
    // window, and one outside it entirely.
    engine.tuneIndex.set(
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
    expect(engine.setMarkerStartOffset).toHaveBeenCalledWith(0, 8);
    expect(engine.auditionMarkerStart).toHaveBeenCalledWith(0);
    expect(
      engine.setMarkerStartOffset.mock.invocationCallOrder[0]
    ).toBeLessThan(engine.auditionMarkerStart.mock.invocationCallOrder[0]);

    // The mock engine never writes the offset back onto `markers()`, so the readout reverting to the
    // marker's own (unchanged) offset rather than staying at the stale +5 fr drag value is what shows
    // the drag entry was actually cleared, not merely overwritten by a new drag value.
    expect(rows()[0].querySelector('.marker-offset')?.textContent?.trim()).toBe('+0 fr');
  });

  it('mirrors pressing previous for the end control via setMarkerEndOffset + auditionMarkerEnd', () => {
    build('A');
    engine.markers.set([markerWithLoop(1_000, 5_000)]);
    engine.tuneIndex.set(
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

    expect(engine.setMarkerEndOffset).toHaveBeenCalledWith(0, -10);
    expect(engine.auditionMarkerEnd).toHaveBeenCalledWith(0);
  });

  it('renders one tick per reachable moment, ordered by offset, and none for an out-of-window moment', () => {
    build('A');
    engine.markers.set([markerWithStart(1_000)]);
    engine.tuneIndex.set(
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
