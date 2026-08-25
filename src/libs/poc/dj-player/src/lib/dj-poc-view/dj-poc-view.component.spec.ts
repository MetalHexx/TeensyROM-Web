import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DjPocViewComponent } from './dj-poc-view.component';
import {
  CapturedPoint,
  CueSlot,
  DjPlayerEngine,
  EngineState,
  EngineStats,
  LoopSlot,
  SpeedMode,
  TimingMode,
} from '../engine/dj-player-engine';
import { MidiAccessState, MidiOutputService, MidiPortOption } from '../midi/midi-output.service';
import type { SidFile } from '../sid/sid-file.model';

const EMPTY_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  bytesSent: 0,
  recipeResends: 0,
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
  speedMode: WritableSignal<SpeedMode>;
  timingMode: WritableSignal<TimingMode>;
  recipeEnabled: WritableSignal<boolean>;
  recipeSent: WritableSignal<boolean>;
  nominalIntervalUs: WritableSignal<number>;
  scheduleAheadMs: WritableSignal<number>;
  mutedVoices: WritableSignal<readonly boolean[]>;
  heldVoices: WritableSignal<readonly boolean[]>;
  effectiveMutes: WritableSignal<readonly boolean[]>;
  cues: WritableSignal<readonly (CueSlot | null)[]>;
  loopSlots: WritableSignal<readonly LoopSlot[]>;
  activeLoopSlot: WritableSignal<number | null>;
  queuedLoopSlot: WritableSignal<number | null>;
  progressPercentFor: ReturnType<typeof vi.fn>;
  positionPercent: WritableSignal<number>;
  nudgeRangeFrames: WritableSignal<number>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  previousSubtune: ReturnType<typeof vi.fn>;
  nextSubtune: ReturnType<typeof vi.fn>;
  setSpeed: ReturnType<typeof vi.fn>;
  jumpSpeedUp: ReturnType<typeof vi.fn>;
  jumpSpeedDown: ReturnType<typeof vi.fn>;
  homeSpeed: ReturnType<typeof vi.fn>;
  setSpeedMode: ReturnType<typeof vi.fn>;
  setTimingMode: ReturnType<typeof vi.fn>;
  setRecipeEnabled: ReturnType<typeof vi.fn>;
  setNominalIntervalUs: ReturnType<typeof vi.fn>;
  setScheduleAhead: ReturnType<typeof vi.fn>;
  loadTune: ReturnType<typeof vi.fn>;
  setVoiceMuted: ReturnType<typeof vi.fn>;
  setVoiceHeld: ReturnType<typeof vi.fn>;
  clearVoiceMutes: ReturnType<typeof vi.fn>;
  addCue: ReturnType<typeof vi.fn>;
  captureCue: ReturnType<typeof vi.fn>;
  hopToCue: ReturnType<typeof vi.fn>;
  clearCue: ReturnType<typeof vi.fn>;
  deleteCue: ReturnType<typeof vi.fn>;
  setCueOffset: ReturnType<typeof vi.fn>;
  tapLoopIn: ReturnType<typeof vi.fn>;
  tapLoopOut: ReturnType<typeof vi.fn>;
  setLoopInOffset: ReturnType<typeof vi.fn>;
  setLoopOutOffset: ReturnType<typeof vi.fn>;
  clearLoopSlot: ReturnType<typeof vi.fn>;
  addLoop: ReturnType<typeof vi.fn>;
  deleteLoop: ReturnType<typeof vi.fn>;
  punchLoop: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  auditionLoopIn: ReturnType<typeof vi.fn>;
  auditionLoopOut: ReturnType<typeof vi.fn>;
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
    speedMode: signal<SpeedMode>('clock-only'),
    timingMode: signal<TimingMode>('cartridge-timed'),
    recipeEnabled: signal(true),
    recipeSent: signal(false),
    nominalIntervalUs: signal(19950),
    scheduleAheadMs: signal(0),
    mutedVoices: signal<readonly boolean[]>([false, false, false]),
    heldVoices: signal<readonly boolean[]>([false, false, false]),
    effectiveMutes: signal<readonly boolean[]>([false, false, false]),
    cues: signal<readonly (CueSlot | null)[]>([]),
    loopSlots: signal<readonly LoopSlot[]>([]),
    activeLoopSlot: signal<number | null>(null),
    queuedLoopSlot: signal<number | null>(null),
    progressPercentFor: vi.fn(() => 0),
    positionPercent: signal(0),
    nudgeRangeFrames: signal(50),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    previousSubtune: vi.fn(),
    nextSubtune: vi.fn(),
    setSpeed: vi.fn(),
    jumpSpeedUp: vi.fn(),
    jumpSpeedDown: vi.fn(),
    homeSpeed: vi.fn(),
    setSpeedMode: vi.fn(),
    setTimingMode: vi.fn(),
    setRecipeEnabled: vi.fn(),
    setNominalIntervalUs: vi.fn(),
    setScheduleAhead: vi.fn(),
    loadTune: vi.fn(),
    setVoiceMuted: vi.fn(),
    setVoiceHeld: vi.fn(),
    clearVoiceMutes: vi.fn(),
    addCue: vi.fn(),
    captureCue: vi.fn(),
    hopToCue: vi.fn(),
    clearCue: vi.fn(),
    deleteCue: vi.fn(),
    setCueOffset: vi.fn(),
    tapLoopIn: vi.fn(),
    tapLoopOut: vi.fn(),
    setLoopInOffset: vi.fn(),
    setLoopOutOffset: vi.fn(),
    clearLoopSlot: vi.fn(),
    addLoop: vi.fn(),
    deleteLoop: vi.fn(),
    punchLoop: vi.fn(),
    stopLoop: vi.fn(),
    auditionLoopIn: vi.fn(),
    auditionLoopOut: vi.fn(),
    scrubTo: vi.fn(),
  };
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

/** A slot the view treats as set. Only `frame` and `offset` are rendered; the snapshots and the
 * anchor are opaque to it. */
function cueAt(frame: number, offset = 0): CueSlot {
  return { frame, offset, machine: {}, registers: {}, anchor: {} } as unknown as CueSlot;
}

/** The loop's in-point, captured the same way a cue is. */
function loopInPoint(frame: number, offset = 0): CapturedPoint {
  return cueAt(frame, offset);
}

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

  describe('cartridge frame timer status', () => {
    function panelText(): string {
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    it('reports the timer as not set before any recipe has gone out', () => {
      engine.recipeSent.set(false);
      fixture.detectChanges();

      expect(panelText()).toContain('not set');
    });

    it('reports the timer as on, at the effective interval, once a recipe has gone out', () => {
      engine.recipeSent.set(true);
      engine.stats.set({ ...EMPTY_STATS, effectiveIntervalUs: 9975 });
      fixture.detectChanges();

      expect(panelText()).toContain('on at 9975');
    });

    // Deleted rather than relabelled: the browser can neither set nor read the buffer size, so any
    // value shown here would be a hand-kept note that goes stale the next time B is pressed.
    it('offers no buffer-size control, since the browser cannot know it', () => {
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
  });

  describe('timing mode', () => {
    function timingModeSelect(): HTMLSelectElement {
      return fixture.nativeElement.querySelector('[aria-label="Timing"] select.timing-mode');
    }

    function recipeCheckbox(): HTMLInputElement {
      return fixture.nativeElement.querySelector('[aria-label="Timing"] input[type="checkbox"]');
    }

    function speedModeSelect(): HTMLSelectElement {
      return fixture.nativeElement.querySelector('[aria-label="Speed"] select.speed-mode');
    }

    it('calls engine.setTimingMode with the chosen mode', () => {
      const select = timingModeSelect();
      select.value = 'host-scheduled';
      select.dispatchEvent(new Event('change'));

      expect(engine.setTimingMode).toHaveBeenCalledWith('host-scheduled');
    });

    it('shows which mode is live', () => {
      engine.timingMode.set('host-scheduled');
      fixture.detectChanges();
      expect(timingModeSelect().value).toBe('host-scheduled');

      engine.timingMode.set('cartridge-timed');
      fixture.detectChanges();
      expect(timingModeSelect().value).toBe('cartridge-timed');
    });

    it('disables the recipe checkbox and the speed-mode select once host-scheduled is live', () => {
      engine.timingMode.set('host-scheduled');
      fixture.detectChanges();

      expect(recipeCheckbox().disabled).toBe(true);
      expect(speedModeSelect().disabled).toBe(true);
    });

    it('leaves the recipe checkbox and the speed-mode select enabled in cartridge-timed', () => {
      engine.timingMode.set('cartridge-timed');
      fixture.detectChanges();

      expect(recipeCheckbox().disabled).toBe(false);
      expect(speedModeSelect().disabled).toBe(false);
    });
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

  describe('cue slots', () => {
    function addCueButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('[aria-label="Cues"] .panel-header button');
    }

    function cueRows(): HTMLElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Cues"] .cue-row'));
    }

    function rowActionButton(row: HTMLElement, label: 'Clear' | 'Delete'): HTMLButtonElement {
      return row.querySelector(`.row-actions button[aria-label^="${label}"]`) as HTMLButtonElement;
    }

    it('renders only the add control when there are no cues', () => {
      expect(addCueButton()).not.toBeNull();
      expect(cueRows()).toHaveLength(0);
    });

    it('calls engine.addCue with no arguments from the add control, and a row appears once the collection grows', () => {
      engine.addCue.mockImplementation(() => {
        engine.cues.set([...engine.cues(), null]);
        return engine.cues().length - 1;
      });

      addCueButton().click();

      expect(engine.addCue).toHaveBeenCalledWith();
      fixture.detectChanges();
      expect(cueRows()).toHaveLength(1);
    });

    it('renders one row per cue, and hops from a set row', () => {
      engine.cues.set([cueAt(1234), null]);
      fixture.detectChanges();

      const rows = cueRows();
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.querySelector('.cue-tag')?.textContent?.trim())).toEqual([
        'Cue 1',
        'Cue 2',
      ]);

      const hopButton = rows[0].querySelector('.cue-btns button') as HTMLButtonElement;
      expect(hopButton.textContent?.trim()).toBe('Hop');
      hopButton.click();
      expect(engine.hopToCue).toHaveBeenCalledWith(0);
    });

    it('offers a capture control instead of Hop for a row with no point, keyed to its own index', () => {
      engine.cues.set([null, cueAt(500)]);
      fixture.detectChanges();

      const rows = cueRows();
      const captureButton = rows[0].querySelector('.cue-btns button') as HTMLButtonElement;
      expect(captureButton.textContent?.trim()).toBe('Capture');
      expect(captureButton.getAttribute('aria-label')).toBe('Capture cue 1');

      captureButton.click();
      expect(engine.captureCue).toHaveBeenCalledWith(0);
    });

    it('shows the captured frame for a set row and "empty" for a cleared one', () => {
      engine.cues.set([cueAt(1234), null]);
      fixture.detectChanges();

      const rows = cueRows();
      expect(rows[0].querySelector('.cue-frame')?.textContent).toContain('frame 1234');
      expect(rows[1].querySelector('.cue-frame')?.textContent?.trim()).toBe('empty');
    });

    it('renders the Clear-then-Delete action cluster on every row, each named for its own row', () => {
      engine.cues.set([cueAt(1234), null]);
      fixture.detectChanges();

      const rows = cueRows();
      for (const [index, row] of rows.entries()) {
        const actionButtons: HTMLButtonElement[] = Array.from(
          row.querySelectorAll('.row-actions button')
        );
        expect(actionButtons.map((button) => button.textContent?.trim())).toEqual([
          'Clear',
          'Delete',
        ]);
        expect(actionButtons[0].getAttribute('aria-label')).toBe(`Clear cue ${index + 1}`);
        expect(actionButtons[1].getAttribute('aria-label')).toBe(`Delete cue ${index + 1}`);
      }
    });

    it('clears a row from its own Clear control', () => {
      engine.cues.set([cueAt(1234)]);
      fixture.detectChanges();

      rowActionButton(cueRows()[0], 'Clear').click();
      expect(engine.clearCue).toHaveBeenCalledWith(0);
    });

    it('deletes a row from its own Delete control, and it disappears once the collection shrinks', () => {
      engine.cues.set([cueAt(1234), cueAt(5678)]);
      fixture.detectChanges();
      engine.deleteCue.mockImplementation((index: number) => {
        engine.cues.set(engine.cues().filter((_, i) => i !== index));
      });

      rowActionButton(cueRows()[1], 'Delete').click();

      expect(engine.deleteCue).toHaveBeenCalledWith(1);
      fixture.detectChanges();
      expect(cueRows()).toHaveLength(1);
    });
  });

  describe('cue nudge', () => {
    function nudgeInput(slot = 0): HTMLInputElement {
      return fixture.nativeElement.querySelectorAll('[aria-label="Cues"] .cue-nudge input')[
        slot
      ] as HTMLInputElement;
    }

    function offsetReadout(slot = 0): string {
      const rows: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Cues"] .cue-row')
      );
      return rows[slot].querySelector('.cue-offset')?.textContent?.trim() ?? '';
    }

    beforeEach(() => {
      engine.cues.set([cueAt(1234), cueAt(50), null, null]);
      fixture.detectChanges();
    });

    it('offers a nudge track only for a slot that holds a point', () => {
      expect(
        fixture.nativeElement.querySelectorAll('[aria-label="Cues"] .cue-nudge input')
      ).toHaveLength(2);
    });

    it('moves the readout on input without auditioning', () => {
      const input = nudgeInput();
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(nudgeInput().value).toBe('-7');
      expect(offsetReadout()).toContain('7');
      // Every re-derivation replays frames on the frame clock's own thread, so the drag must not
      // trigger one.
      expect(engine.setCueOffset).not.toHaveBeenCalled();
      expect(engine.hopToCue).not.toHaveBeenCalled();
    });

    it('commits the offset and auditions it when the drag releases', () => {
      const input = nudgeInput();
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.setCueOffset).toHaveBeenCalledWith(0, -7);
      expect(engine.hopToCue).toHaveBeenCalledWith(0);
    });

    it("follows the engine's committed offset once the drag has been released", () => {
      const input = nudgeInput();
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
      engine.cues.set([cueAt(1234, -7), cueAt(50), null, null]);
      fixture.detectChanges();

      expect(nudgeInput().value).toBe('-7');

      engine.cues.set([cueAt(1234, 3), cueAt(50), null, null]);
      fixture.detectChanges();

      expect(nudgeInput().value).toBe('3');
    });

    it('drives only the dragged slot', () => {
      const input = nudgeInput(1);
      input.value = '12';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(nudgeInput(1).value).toBe('12');
      expect(nudgeInput(0).value).toBe('0');

      input.dispatchEvent(new Event('change'));
      expect(engine.setCueOffset).toHaveBeenCalledWith(1, 12);
    });
  });

  describe('loop slots', () => {
    const EMPTY_SLOT: LoopSlot = { in: null, out: null };

    function setSlots(slots: readonly LoopSlot[]): void {
      engine.loopSlots.set(slots);
      fixture.detectChanges();
    }

    function addLoopButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        '[aria-label="Loops"] .panel-header-actions button'
      );
    }

    function slotRows(): HTMLElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.loop-slot-row'));
    }

    function punchButton(slot: number): HTMLButtonElement {
      return slotRows()[slot].querySelector('.loop-slot-punch') as HTMLButtonElement;
    }

    function stopButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('[aria-label="Loops"] [aria-label="Stop loop"]');
    }

    function tapButton(slot: number, label: 'Tap In' | 'Tap Out'): HTMLButtonElement {
      const buttons: HTMLButtonElement[] = Array.from(slotRows()[slot].querySelectorAll('button'));
      return buttons.find((button) => button.textContent?.trim() === label) as HTMLButtonElement;
    }

    function rowActionButton(slot: number, label: 'Clear' | 'Delete'): HTMLButtonElement {
      return slotRows()[slot].querySelector(
        `.row-actions button[aria-label^="${label}"]`
      ) as HTMLButtonElement;
    }

    function nudgeInput(slot: number, which: 'in' | 'out'): HTMLInputElement | null {
      return slotRows()[slot].querySelector(`input[aria-label="Nudge loop ${slot + 1} ${which}"]`);
    }

    function offsetReadout(slot: number, which: 'in' | 'out'): string {
      const ends: HTMLElement[] = Array.from(slotRows()[slot].querySelectorAll('.loop-end'));
      const end = which === 'in' ? ends[0] : ends[1];
      return end.querySelector('.loop-offset')?.textContent?.trim() ?? '';
    }

    it('renders only the add control when there are no loops', () => {
      expect(addLoopButton()).not.toBeNull();
      expect(slotRows()).toHaveLength(0);
    });

    it('calls engine.addLoop with no arguments from the add control, and a row appears once the collection grows', () => {
      engine.addLoop.mockImplementation(() => {
        engine.loopSlots.set([...engine.loopSlots(), EMPTY_SLOT]);
        return engine.loopSlots().length - 1;
      });

      addLoopButton().click();

      expect(engine.addLoop).toHaveBeenCalledWith();
      fixture.detectChanges();
      expect(slotRows()).toHaveLength(1);
    });

    it('renders one row per loop slot', () => {
      setSlots([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
      expect(slotRows()).toHaveLength(4);
    });

    it('punches the tapped slot from its own punch target', () => {
      setSlots([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
      punchButton(2).click();
      expect(engine.punchLoop).toHaveBeenCalledWith(2);
    });

    it('stops the loop from the single panel-level Stop control', () => {
      stopButton().click();
      expect(engine.stopLoop).toHaveBeenCalled();
    });

    it('taps each end of the right slot from its own button', () => {
      setSlots([EMPTY_SLOT, EMPTY_SLOT]);
      tapButton(1, 'Tap In').click();
      expect(engine.tapLoopIn).toHaveBeenCalledWith(1);

      tapButton(1, 'Tap Out').click();
      expect(engine.tapLoopOut).toHaveBeenCalledWith(1);
    });

    it('renders the Clear-then-Delete action cluster on every row, whether or not it is set', () => {
      setSlots([{ in: loopInPoint(2140), out: null }, EMPTY_SLOT]);

      for (const [index, row] of slotRows().entries()) {
        const actionButtons: HTMLButtonElement[] = Array.from(
          row.querySelectorAll('.row-actions button')
        );
        expect(actionButtons.map((button) => button.textContent?.trim())).toEqual([
          'Clear',
          'Delete',
        ]);
        expect(actionButtons[0].getAttribute('aria-label')).toBe(`Clear slot ${index + 1}`);
        expect(actionButtons[1].getAttribute('aria-label')).toBe(`Delete slot ${index + 1}`);
      }
    });

    it('clears the right slot from its own Clear control', () => {
      setSlots([{ in: loopInPoint(2140), out: null }, EMPTY_SLOT]);

      rowActionButton(0, 'Clear').click();
      expect(engine.clearLoopSlot).toHaveBeenCalledWith(0);
    });

    it('deletes the right slot from its own Delete control, and it disappears once the collection shrinks', () => {
      setSlots([EMPTY_SLOT, { in: loopInPoint(2140), out: null }]);
      engine.deleteLoop.mockImplementation((index: number) => {
        engine.loopSlots.set(engine.loopSlots().filter((_, i) => i !== index));
      });

      rowActionButton(1, 'Delete').click();

      expect(engine.deleteLoop).toHaveBeenCalledWith(1);
      fixture.detectChanges();
      expect(slotRows()).toHaveLength(1);
    });

    it('offers a nudge track only for an end that has been marked, on the right slot', () => {
      setSlots([EMPTY_SLOT, { in: loopInPoint(2140), out: { frame: 2536, offset: 0 } }]);

      expect(nudgeInput(1, 'in')).not.toBeNull();
      expect(nudgeInput(1, 'out')).not.toBeNull();
      expect(nudgeInput(0, 'in')).toBeNull();
      expect(slotRows()[1].querySelector('.loop-frame')?.textContent).toContain('frame 2140');
    });

    it('moves the in-point readout on input without re-deriving or committing', () => {
      setSlots([{ in: loopInPoint(2140), out: null }]);

      const input = nudgeInput(0, 'in') as HTMLInputElement;
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect((nudgeInput(0, 'in') as HTMLInputElement).value).toBe('-7');
      expect(offsetReadout(0, 'in')).toContain('7');
      // Re-deriving the in-point replays frames on the frame clock's own thread, so the drag must
      // not trigger one.
      expect(engine.setLoopInOffset).not.toHaveBeenCalled();
      expect(engine.auditionLoopIn).not.toHaveBeenCalled();
    });

    it('commits the in-point offset and auditions it when the drag releases', () => {
      setSlots([EMPTY_SLOT, { in: loopInPoint(2140), out: null }]);

      const input = nudgeInput(1, 'in') as HTMLInputElement;
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.setLoopInOffset).toHaveBeenCalledWith(1, -7);
      expect(engine.auditionLoopIn).toHaveBeenCalledWith(1);
      expect(engine.punchLoop).not.toHaveBeenCalled();
    });

    it('auditions the in-point commit even while a different slot is the active loop, without queuing a switch', () => {
      engine.activeLoopSlot.set(0);
      setSlots([
        { in: loopInPoint(100), out: { frame: 400, offset: 0 } },
        { in: loopInPoint(2140), out: null },
      ]);

      const input = nudgeInput(1, 'in') as HTMLInputElement;
      input.value = '-7';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.auditionLoopIn).toHaveBeenCalledWith(1);
      expect(engine.punchLoop).not.toHaveBeenCalled();
    });

    it('moves the out-point readout on input without committing or auditioning', () => {
      setSlots([{ in: null, out: { frame: 2536, offset: 0 } }]);

      const input = nudgeInput(0, 'out') as HTMLInputElement;
      input.value = '-3';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect((nudgeInput(0, 'out') as HTMLInputElement).value).toBe('-3');
      expect(offsetReadout(0, 'out')).toContain('3');
      // This is the seam that changed: with an audition to run on release, committing every drag
      // tick would put replay-adjacent work on the frame clock's own thread.
      expect(engine.setLoopOutOffset).not.toHaveBeenCalled();
      expect(engine.auditionLoopOut).not.toHaveBeenCalled();
    });

    it('commits the out-point offset and auditions it when the drag releases', () => {
      setSlots([EMPTY_SLOT, EMPTY_SLOT, { in: null, out: { frame: 2536, offset: 0 } }]);

      const input = nudgeInput(2, 'out') as HTMLInputElement;
      input.value = '-3';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));

      expect(engine.setLoopOutOffset).toHaveBeenCalledWith(2, -3);
      expect(engine.auditionLoopOut).toHaveBeenCalledWith(2);
      expect(engine.punchLoop).not.toHaveBeenCalled();
    });

    it('renders the active and queued slots distinguishably from each other and from idle slots', () => {
      setSlots([
        { in: loopInPoint(100), out: { frame: 200, offset: 0 } },
        { in: loopInPoint(300), out: { frame: 400, offset: 0 } },
        EMPTY_SLOT,
      ]);
      engine.activeLoopSlot.set(0);
      engine.queuedLoopSlot.set(1);
      fixture.detectChanges();

      const rows = slotRows();
      const activeState = rows[0].getAttribute('data-loop-state');
      const queuedState = rows[1].getAttribute('data-loop-state');
      const idleState = rows[2].getAttribute('data-loop-state');

      expect(activeState).not.toBe(queuedState);
      expect(activeState).not.toBe(idleState);
      expect(queuedState).not.toBe(idleState);
    });

    it("shows progress only for the engine's active slot", () => {
      setSlots([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
      // progressPercentFor is only ever non-zero for the active slot in the real engine, so drive
      // both together — the activeLoopSlot write is also what marks this OnPush view for re-check.
      engine.progressPercentFor.mockImplementation((slot: number) => (slot === 2 ? 63 : 0));
      engine.activeLoopSlot.set(2);
      fixture.detectChanges();

      const fills: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.loop-slot-progress-fill')
      );

      expect(fills[2].style.width).toBe('63%');
      expect(fills[0].style.width).toBe('0%');
      expect(fills[1].style.width).toBe('0%');
      expect(fills[3].style.width).toBe('0%');
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

    it('makes the live timing mode and schedule-ahead offset unmistakable', () => {
      engine.timingMode.set('host-scheduled');
      engine.scheduleAheadMs.set(40);
      fixture.detectChanges();

      const text = sectionText('Diagnostics');
      expect(text).toContain('host-scheduled');
      expect(text).toContain('40 ms');
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
  });
});
