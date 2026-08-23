import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DjPocViewComponent } from './dj-poc-view.component';
import {
  CueSlot,
  DjPlayerEngine,
  EngineState,
  EngineStats,
  SpeedMode,
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
  recipeEnabled: WritableSignal<boolean>;
  recipeSent: WritableSignal<boolean>;
  nominalIntervalUs: WritableSignal<number>;
  scheduleAheadMs: WritableSignal<number>;
  mutedVoices: WritableSignal<readonly boolean[]>;
  heldVoices: WritableSignal<readonly boolean[]>;
  effectiveMutes: WritableSignal<readonly boolean[]>;
  cues: WritableSignal<readonly (CueSlot | null)[]>;
  loopInPercent: WritableSignal<number>;
  loopOutPercent: WritableSignal<number>;
  loopEnabled: WritableSignal<boolean>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  previousSubtune: ReturnType<typeof vi.fn>;
  nextSubtune: ReturnType<typeof vi.fn>;
  setSpeed: ReturnType<typeof vi.fn>;
  setSpeedMode: ReturnType<typeof vi.fn>;
  setRecipeEnabled: ReturnType<typeof vi.fn>;
  setNominalIntervalUs: ReturnType<typeof vi.fn>;
  setScheduleAhead: ReturnType<typeof vi.fn>;
  loadTune: ReturnType<typeof vi.fn>;
  setVoiceMuted: ReturnType<typeof vi.fn>;
  setVoiceHeld: ReturnType<typeof vi.fn>;
  clearVoiceMutes: ReturnType<typeof vi.fn>;
  addCue: ReturnType<typeof vi.fn>;
  hopToCue: ReturnType<typeof vi.fn>;
  clearCue: ReturnType<typeof vi.fn>;
  setLoopRange: ReturnType<typeof vi.fn>;
  setLoopEnabled: ReturnType<typeof vi.fn>;
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
    recipeEnabled: signal(true),
    recipeSent: signal(false),
    nominalIntervalUs: signal(19950),
    scheduleAheadMs: signal(0),
    mutedVoices: signal<readonly boolean[]>([false, false, false]),
    heldVoices: signal<readonly boolean[]>([false, false, false]),
    effectiveMutes: signal<readonly boolean[]>([false, false, false]),
    cues: signal<readonly (CueSlot | null)[]>([null, null, null, null]),
    loopInPercent: signal(0),
    loopOutPercent: signal(100),
    loopEnabled: signal(false),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    previousSubtune: vi.fn(),
    nextSubtune: vi.fn(),
    setSpeed: vi.fn(),
    setSpeedMode: vi.fn(),
    setRecipeEnabled: vi.fn(),
    setNominalIntervalUs: vi.fn(),
    setScheduleAhead: vi.fn(),
    loadTune: vi.fn(),
    setVoiceMuted: vi.fn(),
    setVoiceHeld: vi.fn(),
    clearVoiceMutes: vi.fn(),
    addCue: vi.fn(),
    hopToCue: vi.fn(),
    clearCue: vi.fn(),
    setLoopRange: vi.fn(),
    setLoopEnabled: vi.fn(),
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

      // The port select is the first <select> in the panel — MIDI is the first control group.
      const portSelect = fixture.nativeElement.querySelectorAll('select')[0] as HTMLSelectElement;
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
    it('calls engine.setSpeed with the numeric value', () => {
      const range: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');
      range.value = '0.9';
      range.dispatchEvent(new Event('input'));

      expect(engine.setSpeed).toHaveBeenCalledWith(0.9);
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
      engine.lastError.set('the play routine did not return within its cycle budget (12345 cycles)');
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

    it('reports the timer as unset by this browser before any recipe has gone out', () => {
      engine.recipeSent.set(false);
      fixture.detectChanges();

      expect(panelText()).toContain('not set by this browser');
    });

    it('reports the timer as forced, at the effective interval, once a recipe has gone out', () => {
      engine.recipeSent.set(true);
      engine.stats.set({ ...EMPTY_STATS, effectiveIntervalUs: 9975 });
      fixture.detectChanges();

      const text = panelText();
      expect(text).toContain('forced by the recipe packet at 9975');
      // The two traps this status exists to make visible: un-checking the box does not clear the
      // cartridge's flag, and the C64's own menu never learns the host overrode it.
      expect(text).toContain('exited and re-entered');
      expect(text).toContain('disagree with this');
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
        (HTMLElement.prototype as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture =
          vi.fn();
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

    it('calls engine.clearVoiceMutes from the clear-all control', () => {
      const clearButton = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Voice"] button')
      ).find((button) => (button as HTMLButtonElement).textContent?.trim() === 'Clear All Mutes') as
        | HTMLButtonElement
        | undefined;

      clearButton?.click();

      expect(engine.clearVoiceMutes).toHaveBeenCalled();
    });
  });

  describe('cue slots', () => {
    function cueButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Cues"] button'));
    }

    /** A slot the view treats as set. Only `frame` is rendered; the snapshots are opaque to it. */
    function cueAt(frame: number): CueSlot {
      return { frame, machine: {}, registers: {} } as unknown as CueSlot;
    }

    it('adds a cue for an empty slot, then hops once the slot is set', () => {
      cueButtons()[0].click();
      expect(engine.addCue).toHaveBeenCalledWith(0);

      engine.cues.set([cueAt(1234), null, null, null]);
      fixture.detectChanges();

      cueButtons()[0].click();
      expect(engine.hopToCue).toHaveBeenCalledWith(0);
    });

    it('shows a Clear button alongside Hop once a slot is set, and clears it on click', () => {
      engine.cues.set([cueAt(1234), null, null, null]);
      fixture.detectChanges();

      const buttons = cueButtons();
      expect(buttons[0].textContent).toContain('Hop 1');
      expect(buttons[1].textContent).toContain('Clear 1');

      buttons[1].click();
      expect(engine.clearCue).toHaveBeenCalledWith(0);
    });

    it('shows the captured frame for a set slot', () => {
      engine.cues.set([cueAt(1234), null, null, null]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[aria-label="Cues"] .cue-slot').textContent).toContain(
        'frame 1234'
      );
    });

  });

  describe('loop handlers', () => {
    function dualRangeInputs(): HTMLInputElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.dual-range input[type="range"]'));
    }

    it('clamps the in-handle so it never drags past the out-handle', () => {
      engine.loopOutPercent.set(50);
      fixture.detectChanges();

      const [inHandle] = dualRangeInputs();
      inHandle.value = '80';
      inHandle.dispatchEvent(new Event('input'));

      expect(engine.setLoopRange).toHaveBeenCalledWith(49, 50);
    });

    it('clamps the out-handle so it never drags past the in-handle', () => {
      engine.loopInPercent.set(50);
      fixture.detectChanges();

      const [, outHandle] = dualRangeInputs();
      outHandle.value = '20';
      outHandle.dispatchEvent(new Event('input'));

      expect(engine.setLoopRange).toHaveBeenCalledWith(50, 51);
    });
  });

  describe('scrub handler', () => {
    function scrubInput(): HTMLInputElement {
      const rangesInSection: HTMLInputElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Loop / Scrub"] input[type="range"]')
      );
      return rangesInSection[rangesInSection.length - 1];
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
  });
});
