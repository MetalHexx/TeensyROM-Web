import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { LoopsCuesPanelComponent } from './loops-cues-panel.component';
import { DeckContext } from '../deck-context';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type { CapturedPoint, Marker, MarkerEnd } from '../../engine/dj-player-engine';

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

interface MockEngine {
  markers: WritableSignal<readonly Marker[]>;
  loopingMarker: WritableSignal<number | null>;
  queuedMarker: WritableSignal<number | null>;
  markerLaunchPending: WritableSignal<boolean>;
  nudgeRangeFrames: WritableSignal<number>;
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
});
