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
  };
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
});
