import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DjPocViewComponent } from './dj-poc-view.component';
import { DjPlayerEngine, EngineState, EngineStats, SpeedMode } from '../engine/dj-player-engine';
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
  nominalIntervalUs: WritableSignal<number>;
  scheduleAheadMs: WritableSignal<number>;
  mutedVoices: WritableSignal<readonly boolean[]>;
  cueFrames: WritableSignal<readonly (number | null)[]>;
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
  addCue: ReturnType<typeof vi.fn>;
  hopToCue: ReturnType<typeof vi.fn>;
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
    nominalIntervalUs: signal(19950),
    scheduleAheadMs: signal(0),
    mutedVoices: signal<readonly boolean[]>([false, false, false]),
    cueFrames: signal<readonly (number | null)[]>([null, null, null, null]),
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
    addCue: vi.fn(),
    hopToCue: vi.fn(),
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

  describe('timer mode / buffer size record', () => {
    function selectByLabel(labelText: string): HTMLSelectElement {
      const labels: HTMLLabelElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('label.control')
      );
      const label = labels.find((candidate) => candidate.textContent?.includes(labelText));
      const select = label?.querySelector('select');
      if (!select) {
        throw new Error(`no select found under label "${labelText}"`);
      }
      return select;
    }

    it('defaults to off / Tiny and updates the diagnostics readout on change', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('off / Tiny (256 B)');

      const timerSelect = selectByLabel('Timer mode (C64)');
      timerSelect.value = 'fixed-50hz';
      timerSelect.dispatchEvent(new Event('change'));

      const bufferSelect = selectByLabel('Buffer size (C64)');
      bufferSelect.value = 'xxl';
      bufferSelect.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const updatedText = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(updatedText).toContain('fixed 50 Hz / XXL (8192 B)');
    });

    it('renders both selects as enabled, real controls', () => {
      expect(selectByLabel('Timer mode (C64)').disabled).toBe(false);
      expect(selectByLabel('Buffer size (C64)').disabled).toBe(false);
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

  describe('cue slots', () => {
    function cueButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Cues"] button'));
    }

    it('adds a cue for an empty slot, then hops once the slot is set', () => {
      cueButtons()[0].click();
      expect(engine.addCue).toHaveBeenCalledWith(0);

      engine.cueFrames.set([1234, null, null, null]);
      fixture.detectChanges();

      cueButtons()[0].click();
      expect(engine.hopToCue).toHaveBeenCalledWith(0);
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
