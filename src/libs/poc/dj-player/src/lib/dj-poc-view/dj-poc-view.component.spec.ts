import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DjPocViewComponent } from './dj-poc-view.component';
import {
  CapturedPoint,
  DjPlayerEngine,
  EngineState,
  EngineStats,
  Marker,
} from '../engine/dj-player-engine';
import type { PlayRate } from '../engine/play-rate';
import { MidiAccessState, MidiOutputService, MidiPortOption } from '../midi/midi-output.service';
import type { SidFile } from '../sid/sid-file.model';
import { ANALYSIS_SCANNER } from '../analysis/scan-runner';
import type { AnalysisScanner, ScanResult } from '../analysis/scan-runner';
import { TUNE_INDEX_STORAGE } from '../analysis/tune-index-storage';
import type { ITuneIndexStorage } from '../analysis/tune-index-storage';
import { TuneIndexService } from '../analysis/tune-index.service';

const EMPTY_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  bytesSent: 0,
  suppressedWrites: 0,
  illegalOpcodeCount: 0,
  callsPerFrame: 1,
  effectiveIntervalUs: 0,
  measuredMeanIntervalUs: 0,
  driftMs: 0,
  jitterMs: 0,
  worstGapMs: 0,
  lateCallbacks: 0,
  scheduledFrames: 0,
  lateFrames: 0,
  meanLagMs: 0,
  worstLagMs: 0,
  reorderedFrames: 0,
  clampedFrames: 0,
  cancelSupported: false,
  lastCancelLatencyMs: -1,
};

interface MockMidiOutputService {
  accessState: WritableSignal<MidiAccessState>;
  ports: WritableSignal<readonly MidiPortOption[]>;
  selectedPortId: WritableSignal<string | null>;
  lastError: WritableSignal<string | null>;
  requestAccess: ReturnType<typeof vi.fn>;
  selectPort: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
}

interface MockDjPlayerEngine {
  state: WritableSignal<EngineState>;
  lastError: WritableSignal<string | null>;
  stats: WritableSignal<EngineStats>;
  currentSubtune: WritableSignal<number>;
  subtuneCount: WritableSignal<number>;
  speedMultiplier: WritableSignal<number>;
  nominalIntervalUs: WritableSignal<number>;
  playRate: WritableSignal<PlayRate>;
  scheduleAheadMs: WritableSignal<number>;
  mutedVoices: WritableSignal<readonly boolean[]>;
  heldVoices: WritableSignal<readonly boolean[]>;
  effectiveMutes: WritableSignal<readonly boolean[]>;
  markers: WritableSignal<readonly Marker[]>;
  loopingMarker: WritableSignal<number | null>;
  queuedMarker: WritableSignal<number | null>;
  tuneLoopStartFrame: WritableSignal<number | null>;
  tuneLoopPeriodFrames: WritableSignal<number | null>;
  trackEndFrame: WritableSignal<number | null>;
  repeatTrack: WritableSignal<boolean>;
  setRepeatTrack: ReturnType<typeof vi.fn>;
  markerLaunchPending: WritableSignal<boolean>;
  progressPercentFor: ReturnType<typeof vi.fn>;
  positionPercent: WritableSignal<number>;
  nudgeRangeFrames: WritableSignal<number>;
  ceilingFrames: WritableSignal<number>;
  setTuneIndex: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  previousSubtune: ReturnType<typeof vi.fn>;
  nextSubtune: ReturnType<typeof vi.fn>;
  setSpeed: ReturnType<typeof vi.fn>;
  jumpSpeedUp: ReturnType<typeof vi.fn>;
  jumpSpeedDown: ReturnType<typeof vi.fn>;
  homeSpeed: ReturnType<typeof vi.fn>;
  setNominalIntervalUs: ReturnType<typeof vi.fn>;
  setScheduleAhead: ReturnType<typeof vi.fn>;
  loadTune: ReturnType<typeof vi.fn>;
  setVoiceMuted: ReturnType<typeof vi.fn>;
  setVoiceHeld: ReturnType<typeof vi.fn>;
  clearVoiceMutes: ReturnType<typeof vi.fn>;
  addMarker: ReturnType<typeof vi.fn>;
  captureMarkerStart: ReturnType<typeof vi.fn>;
  setMarkerStartOffset: ReturnType<typeof vi.fn>;
  setMarkerEnd: ReturnType<typeof vi.fn>;
  clearMarkerEnd: ReturnType<typeof vi.fn>;
  setMarkerEndOffset: ReturnType<typeof vi.fn>;
  triggerMarker: ReturnType<typeof vi.fn>;
  auditionMarkerStart: ReturnType<typeof vi.fn>;
  auditionMarkerEnd: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  clearMarker: ReturnType<typeof vi.fn>;
  deleteMarker: ReturnType<typeof vi.fn>;
  scrubTo: ReturnType<typeof vi.fn>;
}

function makeMidiService(): MockMidiOutputService {
  return {
    accessState: signal<MidiAccessState>('idle'),
    ports: signal<readonly MidiPortOption[]>([]),
    selectedPortId: signal<string | null>(null),
    lastError: signal<string | null>(null),
    requestAccess: vi.fn(),
    selectPort: vi.fn(),
    identify: vi.fn(),
  };
}

function makeEngine(): MockDjPlayerEngine {
  return {
    state: signal<EngineState>('stopped'),
    lastError: signal<string | null>(null),
    stats: signal<EngineStats>(EMPTY_STATS),
    currentSubtune: signal(1),
    subtuneCount: signal(1),
    speedMultiplier: signal(1),
    nominalIntervalUs: signal(19950),
    playRate: signal<PlayRate>({
      callsPerFrame: 1,
      exactCallsPerFrame: 1,
      roundedCallsPerFrame: 1,
      mode: 'exact',
    }),
    scheduleAheadMs: signal(0),
    mutedVoices: signal<readonly boolean[]>([false, false, false]),
    heldVoices: signal<readonly boolean[]>([false, false, false]),
    effectiveMutes: signal<readonly boolean[]>([false, false, false]),
    markers: signal<readonly Marker[]>([]),
    loopingMarker: signal<number | null>(null),
    queuedMarker: signal<number | null>(null),
    tuneLoopStartFrame: signal<number | null>(null),
    tuneLoopPeriodFrames: signal<number | null>(null),
    trackEndFrame: signal<number | null>(null),
    repeatTrack: signal<boolean>(true),
    setRepeatTrack: vi.fn(),
    markerLaunchPending: signal<boolean>(false),
    progressPercentFor: vi.fn(() => 0),
    positionPercent: signal(0),
    nudgeRangeFrames: signal(50),
    ceilingFrames: signal(10_000),
    setTuneIndex: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    previousSubtune: vi.fn(),
    nextSubtune: vi.fn(),
    setSpeed: vi.fn(),
    jumpSpeedUp: vi.fn(),
    jumpSpeedDown: vi.fn(),
    homeSpeed: vi.fn(),
    setNominalIntervalUs: vi.fn(),
    setScheduleAhead: vi.fn(),
    loadTune: vi.fn(),
    setVoiceMuted: vi.fn(),
    setVoiceHeld: vi.fn(),
    clearVoiceMutes: vi.fn(),
    addMarker: vi.fn(),
    captureMarkerStart: vi.fn(),
    setMarkerStartOffset: vi.fn(),
    setMarkerEnd: vi.fn(),
    clearMarkerEnd: vi.fn(),
    setMarkerEndOffset: vi.fn(),
    triggerMarker: vi.fn(),
    auditionMarkerStart: vi.fn(),
    auditionMarkerEnd: vi.fn(),
    stopLoop: vi.fn(),
    clearMarker: vi.fn(),
    deleteMarker: vi.fn(),
    scrubTo: vi.fn(),
  };
}

/** A cache that never holds a record and swallows every save — `TuneIndexService` is wired up here
 *  only so its DI graph resolves; nothing under this suite asserts on the index it produces. */
function makeTuneIndexStorage(): ITuneIndexStorage {
  return { load: vi.fn(() => null), save: vi.fn() };
}

/** A scan that never resolves — safe for a suite that never flushes far enough to await it. */
function makeAnalysisScanner(): AnalysisScanner {
  return { scan: vi.fn(() => new Promise<ScanResult>(() => undefined)), dispose: vi.fn() };
}

const PSID_HEADER_SIZE = 0x7c;

/** A minimal well-formed PSID v2 file — enough for `parseSidFile` to accept without throwing. */
function validSidBytes(): Uint8Array {
  const payload = [0xa9, 0x00, 0x60];
  const buffer = new Uint8Array(PSID_HEADER_SIZE + payload.length);
  const view = new DataView(buffer.buffer);
  buffer.set([0x50, 0x53, 0x49, 0x44], 0x00); // 'PSID'
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, PSID_HEADER_SIZE, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1003, false);
  view.setUint16(0x0e, 1, false);
  view.setUint16(0x10, 1, false);
  view.setUint32(0x12, 0, false);
  buffer.set(payload, PSID_HEADER_SIZE);
  return buffer;
}

function fakeSidFile(overrides: Partial<SidFile> = {}): SidFile {
  return {
    format: 'PSID',
    version: 2,
    loadAddress: 0x1000,
    initAddress: 0x1000,
    playAddress: 0x1003,
    songs: 1,
    startSong: 1,
    speedFlags: 0,
    name: 'Test Tune',
    author: 'Test Author',
    released: '2026',
    clock: 'pal',
    model: 'mos6581',
    secondSidAddress: null,
    thirdSidAddress: null,
    data: new Uint8Array([0]),
    ...overrides,
  };
}

/** A captured point the view treats as set. Only `frame` and `offset` are rendered; the snapshots
 * and the anchor are opaque to it. */
function startPoint(frame: number, offset = 0): CapturedPoint {
  return { frame, offset, machine: {}, registers: {}, anchor: {} } as unknown as CapturedPoint;
}

/** A marker with only a start — reads as a cue. */
function markerWithStart(frame: number, offset = 0): Marker {
  return { start: startPoint(frame, offset), end: null };
}

/** A marker with both a start and an end — reads as a loop. */
function markerWithEnd(
  startFrame: number,
  endFrame: number,
  startOffset = 0,
  endOffset = 0
): Marker {
  return {
    start: startPoint(startFrame, startOffset),
    end: { frame: endFrame, offset: endOffset },
  };
}

const EMPTY_MARKER: Marker = { start: null, end: null };

describe('DjPocViewComponent', () => {
  let fixture: ComponentFixture<DjPocViewComponent>;
  let component: DjPocViewComponent;
  let midi: MockMidiOutputService;
  let engine: MockDjPlayerEngine;

  async function setup(): Promise<void> {
    midi = makeMidiService();
    engine = makeEngine();

    await TestBed.configureTestingModule({
      imports: [DjPocViewComponent],
    })
      .overrideComponent(DjPocViewComponent, {
        set: {
          providers: [
            { provide: MidiOutputService, useValue: midi as unknown as MidiOutputService },
            { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
            TuneIndexService,
            { provide: TUNE_INDEX_STORAGE, useValue: makeTuneIndexStorage() },
            { provide: ANALYSIS_SCANNER, useValue: makeAnalysisScanner() },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DjPocViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  describe('MIDI port select', () => {
    it('renders an option per port from the service', () => {
      midi.ports.set([
        { id: 'port-1', name: 'Cart A', manufacturer: 'Acme' },
        { id: 'port-2', name: 'Cart B', manufacturer: 'Acme' },
      ]);
      fixture.detectChanges();

      const options: NodeListOf<HTMLOptionElement> =
        fixture.nativeElement.querySelectorAll('select option');
      const values = Array.from(options).map((option) => option.value);

      expect(values).toContain('port-1');
      expect(values).toContain('port-2');
    });

    it('calls selectPort with the chosen id on change', () => {
      midi.ports.set([{ id: 'port-1', name: 'Cart A', manufacturer: 'Acme' }]);
      fixture.detectChanges();

      const portSelect = fixture.nativeElement.querySelector(
        '[aria-label="MIDI"] select'
      ) as HTMLSelectElement;
      portSelect.value = 'port-1';
      portSelect.dispatchEvent(new Event('change'));

      expect(midi.selectPort).toHaveBeenCalledWith('port-1');
    });
  });

  describe('transport buttons', () => {
    it('calls engine.play, pause and stop', () => {
      midi.selectedPortId.set('port-1');
      component.currentTune.set(fakeSidFile());
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button')
      );
      const playButton = buttons.find((button) => button.textContent?.trim() === 'Play');
      playButton?.click();
      expect(engine.play).toHaveBeenCalled();

      engine.state.set('playing');
      fixture.detectChanges();
      const pauseButton = buttons.find((button) => button.textContent?.trim() === 'Pause');
      pauseButton?.click();
      expect(engine.pause).toHaveBeenCalled();

      const stopButton = buttons.find((button) => button.textContent?.trim() === 'Stop');
      stopButton?.click();
      expect(engine.stop).toHaveBeenCalled();
    });
  });

  describe('speed input', () => {
    function speedFader(): HTMLInputElement {
      return fixture.nativeElement.querySelector('[aria-label="Speed"] input[type="range"]');
    }

    function speedButton(label: '+50%' | '−50%' | 'Home'): HTMLButtonElement {
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Speed"] button')
      );
      return buttons.find((button) => button.textContent?.trim() === label) as HTMLButtonElement;
    }

    it('calls engine.setSpeed with the numeric value', () => {
      const range = speedFader();
      range.value = '0.9';
      range.dispatchEvent(new Event('input'));

      expect(engine.setSpeed).toHaveBeenCalledWith(0.9);
    });

    it('binds the fader to the 0.5–1.5 input span', () => {
      const range = speedFader();

      expect(range.min).toBe('0.5');
      expect(range.max).toBe('1.5');
    });

    it("pins the fader's displayed value to the input span without writing back to the engine", () => {
      engine.speedMultiplier.set(1.65); // beyond the input span, as a jump excursion can leave it
      fixture.detectChanges();

      expect(speedFader().value).toBe('1.5');
      expect(engine.setSpeed).not.toHaveBeenCalled();

      engine.speedMultiplier.set(0.4);
      fixture.detectChanges();

      expect(speedFader().value).toBe('0.5');
      expect(engine.setSpeed).not.toHaveBeenCalled();
    });

    it('calls the jump and home methods from their own buttons', () => {
      speedButton('+50%').click();
      expect(engine.jumpSpeedUp).toHaveBeenCalled();

      speedButton('−50%').click();
      expect(engine.jumpSpeedDown).toHaveBeenCalled();

      speedButton('Home').click();
      expect(engine.homeSpeed).toHaveBeenCalled();
    });
  });

  describe('error states', () => {
    it('renders the MIDI last error', () => {
      midi.lastError.set('MIDI SysEx access was denied: dismissed');
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('MIDI SysEx access was denied: dismissed');
    });

    it('renders the engine last error', () => {
      engine.lastError.set(
        'the play routine did not return within its cycle budget (12345 cycles)'
      );
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('the play routine did not return within its cycle budget');
    });

    it('renders a tune parse error', () => {
      component.selectTune({
        id: 'bad',
        label: 'Bad tune',
        getBytes: () => Uint8Array.from([1, 2, 3]),
      });
      fixture.detectChanges();

      expect(component.tuneError()).toBeTruthy();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain(component.tuneError() ?? '');
    });

    it('renders a no-ports-found error once access is granted with an empty port list', () => {
      midi.accessState.set('granted');
      midi.ports.set([]);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('no output ports were found');
    });
  });

  // Deleted rather than relabelled: the browser can neither set nor read the cartridge's own timer
  // mode or buffer size, so any value shown here would be a hand-kept note that goes stale the next
  // time the operator presses B at the C64.
  it('offers no cartridge timer-mode or buffer-size control, since the browser cannot know either', () => {
    const selects: HTMLSelectElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select')
    );
    const labels: HTMLLabelElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('label.control')
    );

    expect(labels.some((label) => (label.textContent ?? '').includes('Buffer size'))).toBe(false);
    expect(labels.some((label) => (label.textContent ?? '').includes('Timer mode'))).toBe(false);
    expect(selects.some((select) => select.value === 'medium' || select.value === 'tiny')).toBe(
      false
    );
  });

  describe('subtune navigation', () => {
    it('disables previous/next on a single-subtune tune', () => {
      engine.subtuneCount.set(1);
      component.currentTune.set(fakeSidFile({ songs: 1 }));
      fixture.detectChanges();

      const subtuneButtons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.subtune-nav button')
      );
      expect(subtuneButtons).toHaveLength(2);
      for (const button of subtuneButtons) {
        expect(button.disabled).toBe(true);
      }
    });

    it('enables previous/next on a multi-subtune tune', () => {
      engine.subtuneCount.set(3);
      component.currentTune.set(fakeSidFile({ songs: 3 }));
      fixture.detectChanges();

      const subtuneButtons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.subtune-nav button')
      );
      expect(subtuneButtons).toHaveLength(2);
      for (const button of subtuneButtons) {
        expect(button.disabled).toBe(false);
      }

      subtuneButtons[1].click();
      expect(engine.nextSubtune).toHaveBeenCalled();
    });
  });

  describe('auto-play', () => {
    it('plays automatically once a tune is selected', () => {
      component.selectTune({ id: 'auto', label: 'Auto tune', getBytes: validSidBytes });

      expect(engine.loadTune).toHaveBeenCalled();
      expect(engine.play).toHaveBeenCalled();
    });
  });

  describe('tune-index hand-off', () => {
    it('passes the bundled label to the tune-index service on selectTune', () => {
      const setTune = vi.spyOn(component['tuneIndex'], 'setTune');

      component.selectTune({ id: 'auto', label: 'Auto tune', getBytes: validSidBytes });

      expect(setTune).toHaveBeenCalledTimes(1);
      expect(setTune).toHaveBeenCalledWith(engine.loadTune.mock.calls[0][0], 'Auto tune');
    });

    it("passes the picked file's name to the tune-index service on file pick", async () => {
      const setTune = vi.spyOn(component['tuneIndex'], 'setTune');
      // jsdom's File has no working arrayBuffer(); a minimal stand-in is enough since only the
      // hand-off — not File parsing itself — is under test here.
      const pickedFile = {
        name: 'mytune.sid',
        arrayBuffer: () => Promise.resolve(validSidBytes().buffer),
      } as unknown as File;
      const input = { files: [pickedFile], value: '' } as unknown as HTMLInputElement;

      await component.onFilePicked({ target: input } as unknown as Event);

      expect(setTune).toHaveBeenCalledTimes(1);
      expect(setTune).toHaveBeenCalledWith(engine.loadTune.mock.calls[0][0], 'mytune.sid');
    });
  });

  describe('tune index panel placement', () => {
    it('renders the tune index panel in the sidebar, not the stage rail', () => {
      expect(
        fixture.nativeElement.querySelector('aside.sidebar lib-tune-index-panel')
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.stage-rail lib-tune-index-panel')).toBeNull();
    });
  });

  describe('voice mute toggles', () => {
    it('calls engine.setVoiceMuted with the voice index and the checkbox state', () => {
      const checkbox = fixture.nativeElement.querySelector(
        '[aria-label="Voice"] input[type="checkbox"]'
      ) as HTMLInputElement;

      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      expect(engine.setVoiceMuted).toHaveBeenCalledWith(0, true);
    });
  });

  describe('voice momentary hold', () => {
    // jsdom has no native Pointer Events implementation — polyfill the one API surface the
    // handler touches so a real `pointerdown` dispatch exercises the actual template wiring.
    beforeEach(() => {
      if (!('setPointerCapture' in HTMLElement.prototype)) {
        (
          HTMLElement.prototype as unknown as { setPointerCapture: (id: number) => void }
        ).setPointerCapture = vi.fn();
      } else {
        vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(() => undefined);
      }
    });

    function firePointer(el: Element, type: string, pointerId = 1): void {
      const event = new Event(type) as unknown as PointerEvent;
      Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
      el.dispatchEvent(event);
    }

    function holdButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Voice"] .voice-hold'));
    }

    it("flips the hold button's label with the checkbox's latched state", () => {
      expect(holdButtons()[0].textContent?.trim()).toBe('Kill');

      engine.mutedVoices.set([true, false, false]);
      fixture.detectChanges();

      expect(holdButtons()[0].textContent?.trim()).toBe('Punch In');
    });

    it('drives the engine on pointerdown and pointerup', () => {
      const button = holdButtons()[0];

      firePointer(button, 'pointerdown');
      expect(engine.setVoiceHeld).toHaveBeenCalledWith(0, true);

      firePointer(button, 'pointerup');
      expect(engine.setVoiceHeld).toHaveBeenLastCalledWith(0, false);
    });

    it('releases the hold on pointercancel', () => {
      const button = holdButtons()[1];

      firePointer(button, 'pointerdown');
      expect(engine.setVoiceHeld).toHaveBeenCalledWith(1, true);

      firePointer(button, 'pointercancel');
      expect(engine.setVoiceHeld).toHaveBeenLastCalledWith(1, false);
    });

    it('drives the engine on Enter keydown and keyup', () => {
      const button = holdButtons()[0];

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(engine.setVoiceHeld).toHaveBeenCalledWith(0, true);

      button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      expect(engine.setVoiceHeld).toHaveBeenLastCalledWith(0, false);
    });

    it('drives the engine on Space keydown and keyup, ignoring auto-repeat', () => {
      const button = holdButtons()[1];

      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(engine.setVoiceHeld).toHaveBeenCalledWith(1, true);

      engine.setVoiceHeld.mockClear();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, repeat: true }));
      expect(engine.setVoiceHeld).not.toHaveBeenCalled();

      button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      expect(engine.setVoiceHeld).toHaveBeenLastCalledWith(1, false);
    });

    it('calls engine.clearVoiceMutes from the clear-all control', () => {
      // Matched on the accessible name, not the visible text: the rail is narrow enough that the
      // button reads just "Clear", and the spelled-out name lives in aria-label.
      const clearButton = fixture.nativeElement.querySelector(
        '[aria-label="Voice"] button[aria-label="Clear all voice mutes"]'
      ) as HTMLButtonElement | null;

      clearButton?.click();

      expect(engine.clearVoiceMutes).toHaveBeenCalled();
    });
  });

  describe('marker rows', () => {
    function addMarkerButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        '[aria-label="Cues"] .panel-header-actions button'
      );
    }

    function stopButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('[aria-label="Cues"] [aria-label="Stop loop"]');
    }

    function setMarkers(markers: readonly Marker[]): void {
      engine.markers.set(markers);
      fixture.detectChanges();
    }

    function rows(): HTMLElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.marker-row'));
    }

    function triggerOrCaptureButton(index: number): HTMLButtonElement {
      return rows()[index].querySelector('.marker-trigger') as HTMLButtonElement;
    }

    function rowActionButton(index: number, label: 'Clear' | 'Delete'): HTMLButtonElement {
      return rows()[index].querySelector(
        `.row-actions button[aria-label^="${label}"]`
      ) as HTMLButtonElement;
    }

    it('renders only the add control when there are no markers', () => {
      expect(addMarkerButton()).not.toBeNull();
      expect(rows()).toHaveLength(0);
    });

    it('calls engine.addMarker with no arguments from the add control, and a row appears once the collection grows', () => {
      engine.addMarker.mockImplementation(() => {
        engine.markers.set([...engine.markers(), EMPTY_MARKER]);
        return engine.markers().length - 1;
      });

      addMarkerButton().click();

      expect(engine.addMarker).toHaveBeenCalledWith();
      fixture.detectChanges();
      expect(rows()).toHaveLength(1);
    });

    it('renders one row per marker, numbered in order', () => {
      setMarkers([markerWithStart(1234), EMPTY_MARKER]);

      const found = rows();
      expect(found).toHaveLength(2);
      expect(found.map((row) => row.querySelector('.marker-tag')?.textContent?.trim())).toEqual([
        'Cue 1',
        'Cue 2',
      ]);
    });

    it('offers a trigger control for a row with a start, and calls triggerMarker from it', () => {
      setMarkers([markerWithStart(1234)]);

      const button = triggerOrCaptureButton(0);
      expect(button.textContent?.trim()).toBe('Trigger');
      expect(button.getAttribute('aria-label')).toBe('Trigger marker 1');

      button.click();
      expect(engine.triggerMarker).toHaveBeenCalledWith(0);
    });

    it('offers a capture control instead of a trigger for a row with no start, keyed to its own index', () => {
      setMarkers([EMPTY_MARKER, markerWithStart(500)]);

      const button = triggerOrCaptureButton(0);
      expect(button.textContent?.trim()).toBe('Capture');
      expect(button.getAttribute('aria-label')).toBe('Capture cue 1');

      button.click();
      expect(engine.captureMarkerStart).toHaveBeenCalledWith(0);
    });

    it('shows the nudged start frame for a set row and "empty" for a cleared one', () => {
      setMarkers([markerWithStart(1234, 5), EMPTY_MARKER]);

      const found = rows();
      expect(found[0].querySelector('.marker-start .marker-frame')?.textContent).toContain(
        'frame 1239'
      );
      expect(found[1].querySelector('.marker-start .marker-frame')?.textContent?.trim()).toBe(
        'empty'
      );
    });

    it('hides the end controls for a cue and shows them for a loop', () => {
      setMarkers([markerWithStart(1234), markerWithEnd(1234, 2536)]);

      const found = rows();
      expect(found[0].querySelector('.marker-end input[type="range"]')).toBeNull();
      expect(found[1].querySelector('.marker-end input[type="range"]')).not.toBeNull();
      expect(found[1].querySelector('.marker-end .marker-frame')?.textContent).toContain(
        'frame 2536'
      );
    });

    it('always renders the set-end control, whether or not the row already has an end', () => {
      setMarkers([markerWithStart(1234), markerWithEnd(1234, 2536)]);

      const found = rows();
      expect(found[0].querySelector('.marker-end-set')).not.toBeNull();
      expect(found[1].querySelector('.marker-end-set')).not.toBeNull();
    });

    it('renders the Clear-then-Delete action cluster on every row, each named for its own row', () => {
      setMarkers([markerWithStart(1234), EMPTY_MARKER]);

      for (const [index, row] of rows().entries()) {
        const actionButtons: HTMLButtonElement[] = Array.from(
          row.querySelectorAll('.row-actions button')
        );
        expect(actionButtons.map((button) => button.textContent?.trim())).toEqual([
          'Clear',
          'Delete',
        ]);
        expect(actionButtons[0].getAttribute('aria-label')).toBe(`Clear marker ${index + 1}`);
        expect(actionButtons[1].getAttribute('aria-label')).toBe(`Delete marker ${index + 1}`);
      }
    });

    it('clears a row from its own Clear control', () => {
      setMarkers([markerWithStart(1234)]);

      rowActionButton(0, 'Clear').click();
      expect(engine.clearMarker).toHaveBeenCalledWith(0);
    });

    it('deletes a row from its own Delete control, and it disappears once the collection shrinks', () => {
      setMarkers([markerWithStart(1234), markerWithStart(5678)]);
      engine.deleteMarker.mockImplementation((index: number) => {
        engine.markers.set(engine.markers().filter((_, i) => i !== index));
      });

      rowActionButton(1, 'Delete').click();

      expect(engine.deleteMarker).toHaveBeenCalledWith(1);
      fixture.detectChanges();
      expect(rows()).toHaveLength(1);
    });

    it("disables every row's trigger and delete controls while a marker launch is pending", () => {
      setMarkers([markerWithStart(1234), markerWithStart(5678)]);
      engine.markerLaunchPending.set(true);
      fixture.detectChanges();

      for (const [index] of rows().entries()) {
        expect(triggerOrCaptureButton(index).disabled).toBe(true);
        expect(rowActionButton(index, 'Delete').disabled).toBe(true);
      }

      engine.markerLaunchPending.set(false);
      fixture.detectChanges();

      for (const [index] of rows().entries()) {
        expect(triggerOrCaptureButton(index).disabled).toBe(false);
        expect(rowActionButton(index, 'Delete').disabled).toBe(false);
      }
    });

    it('stops the loop from the single panel-level Stop control', () => {
      stopButton().click();
      expect(engine.stopLoop).toHaveBeenCalled();
    });

    it('reflects looping, queued and idle state distinguishably from each other', () => {
      setMarkers([markerWithEnd(100, 200), markerWithEnd(300, 400), EMPTY_MARKER]);
      engine.loopingMarker.set(0);
      engine.queuedMarker.set(1);
      fixture.detectChanges();

      const found = rows();
      const activeState = found[0].getAttribute('data-marker-state');
      const queuedState = found[1].getAttribute('data-marker-state');
      const idleState = found[2].getAttribute('data-marker-state');

      expect(activeState).not.toBe(queuedState);
      expect(activeState).not.toBe(idleState);
      expect(queuedState).not.toBe(idleState);
    });

    it("shows progress only for the engine's looping marker", () => {
      setMarkers([EMPTY_MARKER, EMPTY_MARKER, EMPTY_MARKER, EMPTY_MARKER]);
      // progressPercentFor is only ever non-zero for the looping marker in the real engine, so drive
      // both together — the loopingMarker write is also what marks this OnPush view for re-check.
      engine.progressPercentFor.mockImplementation((index: number) => (index === 2 ? 63 : 0));
      engine.loopingMarker.set(2);
      fixture.detectChanges();

      const fills: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.marker-progress-fill')
      );

      expect(fills[2].style.width).toBe('63%');
      expect(fills[0].style.width).toBe('0%');
      expect(fills[1].style.width).toBe('0%');
      expect(fills[3].style.width).toBe('0%');
    });
  });

  describe('marker end conversion', () => {
    it('reveals the end group in place when an end is set, keeping the row and its index', () => {
      engine.markers.set([markerWithStart(1234), markerWithStart(5678)]);
      fixture.detectChanges();
      engine.setMarkerEnd.mockImplementation((index: number) => {
        const markers = [...engine.markers()];
        markers[index] = { ...markers[index], end: { frame: 5680, offset: 0 } };
        engine.markers.set(markers);
      });

      const before: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.marker-row')
      );
      (before[1].querySelector('.marker-end-set') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(engine.setMarkerEnd).toHaveBeenCalledWith(1);
      const after: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.marker-row')
      );
      expect(after).toHaveLength(2);
      expect(after[1].querySelector('.marker-tag')?.textContent?.trim()).toBe('Cue 2');
      expect(after[1].querySelector('input[aria-label="Nudge marker 2 end"]')).not.toBeNull();
    });

    it('hides the end group and keeps the start when the end is cleared', () => {
      engine.markers.set([markerWithEnd(1234, 2536)]);
      fixture.detectChanges();
      engine.clearMarkerEnd.mockImplementation((index: number) => {
        const markers = [...engine.markers()];
        markers[index] = { ...markers[index], end: null };
        engine.markers.set(markers);
      });

      (
        fixture.nativeElement.querySelector('.marker-end-revert') as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      expect(engine.clearMarkerEnd).toHaveBeenCalledWith(0);
      expect(
        fixture.nativeElement.querySelector('input[aria-label="Nudge marker 1 end"]')
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.marker-start .marker-frame')?.textContent
      ).toContain('frame 1234');
    });
  });

  describe('marker start nudge', () => {
    function nudgeInput(index = 0): HTMLInputElement {
      return fixture.nativeElement.querySelectorAll('.marker-start input[type="range"]')[
        index
      ] as HTMLInputElement;
    }

    function offsetReadout(index = 0): string {
      const found: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.marker-row')
      );
      return found[index].querySelector('.marker-start .marker-offset')?.textContent?.trim() ?? '';
    }

    beforeEach(() => {
      engine.markers.set([markerWithStart(1234), markerWithStart(50), EMPTY_MARKER, EMPTY_MARKER]);
      fixture.detectChanges();
    });

    it('offers a nudge track only for a row that holds a start', () => {
      expect(
        fixture.nativeElement.querySelectorAll('.marker-start input[type="range"]')
      ).toHaveLength(2);
    });

    it('moves the readout on input without committing or auditioning', () => {
      const input = nudgeInput();
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(nudgeInput().value).toBe('-7');
      expect(offsetReadout()).toContain('7');
      // Every re-derivation replays frames on the frame clock's own thread, so the drag must not
      // trigger one.
      expect(engine.setMarkerStartOffset).not.toHaveBeenCalled();
      expect(engine.auditionMarkerStart).not.toHaveBeenCalled();
    });

    it('commits the offset and auditions it — not the trigger — when the drag releases', () => {
      const input = nudgeInput();
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.setMarkerStartOffset).toHaveBeenCalledWith(0, -7);
      expect(engine.auditionMarkerStart).toHaveBeenCalledWith(0);
      // Routing the commit to the trigger is the plausible mistake — it would silently queue the
      // audition to the lap boundary instead of playing it immediately.
      expect(engine.triggerMarker).not.toHaveBeenCalled();
    });

    it("follows the engine's committed offset once the drag has been released", () => {
      const input = nudgeInput();
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
      engine.markers.set([
        markerWithStart(1234, -7),
        markerWithStart(50),
        EMPTY_MARKER,
        EMPTY_MARKER,
      ]);
      fixture.detectChanges();

      expect(nudgeInput().value).toBe('-7');
    });

    it('drives only the dragged row', () => {
      const input = nudgeInput(1);
      input.value = '12';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(nudgeInput(1).value).toBe('12');
      expect(nudgeInput(0).value).toBe('0');

      input.dispatchEvent(new Event('change'));
      expect(engine.setMarkerStartOffset).toHaveBeenCalledWith(1, 12);
    });
  });

  describe('marker end nudge', () => {
    function nudgeInput(index: number): HTMLInputElement | null {
      const found: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.marker-row')
      );
      return found[index].querySelector(`input[aria-label="Nudge marker ${index + 1} end"]`);
    }

    function offsetReadout(index: number): string {
      const found: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.marker-row')
      );
      return found[index].querySelector('.marker-end .marker-offset')?.textContent?.trim() ?? '';
    }

    it('moves the readout on input without committing or auditioning', () => {
      engine.markers.set([markerWithEnd(1234, 2536)]);
      fixture.detectChanges();

      const input = nudgeInput(0) as HTMLInputElement;
      input.value = '-3';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect((nudgeInput(0) as HTMLInputElement).value).toBe('-3');
      expect(offsetReadout(0)).toContain('3');
      // This is the seam that changed: with an audition to run on release, committing every drag
      // tick would put replay-adjacent work on the frame clock's own thread.
      expect(engine.setMarkerEndOffset).not.toHaveBeenCalled();
      expect(engine.auditionMarkerEnd).not.toHaveBeenCalled();
    });

    it('commits the offset and auditions it — not the trigger — when the drag releases', () => {
      engine.markers.set([EMPTY_MARKER, EMPTY_MARKER, markerWithEnd(1234, 2536)]);
      fixture.detectChanges();

      const input = nudgeInput(2) as HTMLInputElement;
      input.value = '-3';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.setMarkerEndOffset).toHaveBeenCalledWith(2, -3);
      expect(engine.auditionMarkerEnd).toHaveBeenCalledWith(2);
      // Routing the commit to the trigger is the plausible mistake — it would silently queue the
      // audition to the lap boundary instead of playing it immediately.
      expect(engine.triggerMarker).not.toHaveBeenCalled();
    });

    it('auditions the commit even while a different row is the looping marker, without queuing a switch', () => {
      engine.loopingMarker.set(0);
      engine.markers.set([markerWithEnd(100, 400), markerWithEnd(2140, 2536)]);
      fixture.detectChanges();

      const input = nudgeInput(1) as HTMLInputElement;
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.auditionMarkerEnd).toHaveBeenCalledWith(1);
      expect(engine.triggerMarker).not.toHaveBeenCalled();
    });
  });

  describe('scrub handler', () => {
    function scrubInput(): HTMLInputElement {
      return fixture.nativeElement.querySelector('.scrub-row input[type="range"]');
    }

    it('does not call engine.scrubTo while dragging', () => {
      const input = scrubInput();
      input.value = '42';
      input.dispatchEvent(new Event('input'));

      expect(engine.scrubTo).not.toHaveBeenCalled();
    });

    it('calls engine.scrubTo with the value once the drag releases', () => {
      const input = scrubInput();
      input.value = '42';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.scrubTo).toHaveBeenCalledWith(42);
    });

    it('follows the engine position while idle', () => {
      engine.positionPercent.set(17);
      fixture.detectChanges();

      expect(scrubInput().value).toBe('17');

      engine.positionPercent.set(63);
      fixture.detectChanges();

      expect(scrubInput().value).toBe('63');
    });

    it('pins the displayed value on input, ignoring further engine position changes mid-drag', () => {
      engine.positionPercent.set(10);
      fixture.detectChanges();

      const input = scrubInput();
      input.value = '42';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(scrubInput().value).toBe('42');

      // The live position moves under the drag — the pin must hold the thumb rather than snap it.
      engine.positionPercent.set(55);
      fixture.detectChanges();

      expect(scrubInput().value).toBe('42');
    });

    it('holds the pin while the scrub is in flight, even as the engine position keeps advancing', async () => {
      let resolveScrub!: () => void;
      engine.scrubTo.mockImplementation(
        () => new Promise<void>((resolve) => (resolveScrub = resolve))
      );
      engine.positionPercent.set(10);
      fixture.detectChanges();

      const input = scrubInput();
      input.value = '42';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      // The live position keeps moving while the replay is still in flight — the pin must hold, or
      // the thumb snaps back to the stale position before the real jump lands.
      engine.positionPercent.set(55);
      fixture.detectChanges();
      expect(scrubInput().value).toBe('42');

      resolveScrub();
      await Promise.resolve();
      fixture.detectChanges();
    });

    it('releases the pin once the scrub settles, letting the engine position resume driving the display', async () => {
      let resolveScrub!: () => void;
      engine.scrubTo.mockImplementation(
        () => new Promise<void>((resolve) => (resolveScrub = resolve))
      );
      engine.positionPercent.set(10);
      fixture.detectChanges();

      const input = scrubInput();
      input.value = '42';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      resolveScrub();
      await Promise.resolve();
      fixture.detectChanges();

      engine.positionPercent.set(77);
      fixture.detectChanges();

      expect(scrubInput().value).toBe('77');
    });
  });

  describe('delivery diagnostics readout', () => {
    function sectionText(label: string): string {
      const section = fixture.nativeElement.querySelector(`[aria-label="${label}"]`) as HTMLElement;
      return section?.textContent ?? '';
    }

    it('makes the live schedule-ahead offset unmistakable', () => {
      engine.scheduleAheadMs.set(40);
      fixture.detectChanges();

      expect(sectionText('Diagnostics')).toContain('40 ms');
    });

    it("binds the delivery numbers to the engine's stats signal", () => {
      engine.stats.set({
        ...EMPTY_STATS,
        scheduledFrames: 321,
        lateFrames: 9,
        reorderedFrames: 2,
        clampedFrames: 4,
        meanLagMs: 5.5,
        worstLagMs: 42.5,
        cancelSupported: true,
        lastCancelLatencyMs: 12.5,
      });
      fixture.detectChanges();

      const text = sectionText('Delivery');
      expect(text).toContain('321');
      expect(text).toContain('5.5 ms');
      expect(text).toContain('42.5 ms');
      expect(text).toContain('yes');
      expect(text).toContain('12.5 ms');
    });

    it('shows an em dash for cancel latency until a cancel has actually happened', () => {
      const text = sectionText('Delivery');
      expect(text).toContain('—');
    });

    it("binds the clock's own figures to the engine's stats signal, kept apart from delivery", () => {
      engine.stats.set({ ...EMPTY_STATS, driftMs: 3.5, lateCallbacks: 6, worstGapMs: 77.5 });
      fixture.detectChanges();

      const text = sectionText('Clock');
      expect(text).toContain('3.5 ms');
      expect(text).toContain('6');
      expect(text).toContain('77.5 ms');
    });
  });

  describe('schedule-ahead range', () => {
    function scheduleAheadSelect(): HTMLSelectElement {
      const labels: HTMLLabelElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Timing"] label.control')
      );
      const label = labels.find((item) => (item.textContent ?? '').trim().startsWith('Schedule ahead'));
      return label?.querySelector('select') as HTMLSelectElement;
    }

    it('widens the offered range past a single frame interval, so a shorter-than-window stall can be demonstrated', () => {
      const values = Array.from(scheduleAheadSelect().options).map((option) => Number(option.value));

      expect(values).toEqual([0, 5, 20, 40, 80, 160]);
    });
  });

  describe('main-thread stall control', () => {
    function stallButton(): HTMLButtonElement {
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Diagnostics"] button')
      );
      return buttons.find((button) => button.textContent?.trim() === 'Stall') as HTMLButtonElement;
    }

    function stallDurationInput(): HTMLInputElement {
      return fixture.nativeElement.querySelector(
        'input[aria-label="Stall duration in milliseconds"]'
      );
    }

    it('updates the configured duration from its own input, reflected back through the bound value', () => {
      const input = stallDurationInput();
      input.value = '300';
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(stallDurationInput().value).toBe('300');
    });

    it('blocks the main thread synchronously for at least the configured duration', () => {
      const input = stallDurationInput();
      input.value = '20'; // short, to keep the test itself fast
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const before = performance.now();
      stallButton().click();
      const elapsed = performance.now() - before;

      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    /**
     * Runs the stall against a virtual clock — one that only advances when the busy-wait reads
     * it — and reports how much virtual time the stall consumed before returning. Real time is no
     * use here: the whole point of the ceiling is that the value being defended against would
     * freeze the tab for minutes.
     */
    function virtualStallElapsedMs(): number {
      const button = stallButton();
      const startMs = 1_000_000;
      let nowMs = startMs;
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => nowMs++);
      try {
        button.click();
      } finally {
        clock.mockRestore();
      }
      return nowMs - 1 - startMs;
    }

    it('caps the stall at the ceiling its own input advertises, however large the typed value', () => {
      const ceilingMs = Number(stallDurationInput().max);
      const input = stallDurationInput();
      input.value = String(ceilingMs * 30); // the mistyped-value case the ceiling exists for
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const elapsed = virtualStallElapsedMs();

      expect(elapsed).toBeGreaterThanOrEqual(ceilingMs);
      expect(elapsed).toBeLessThan(ceilingMs * 2);
    });
  });
});
