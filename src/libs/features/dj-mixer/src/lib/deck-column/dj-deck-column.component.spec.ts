import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { StorageType, type Device } from '@teensyrom-nx/domain';
import {
  DeckService,
  DeviceStore,
  DjStore,
  type DeckBindingState,
  type DeckBindingSummary,
  type DeckTransportSummary,
  type MidiPortOption,
  type Slot,
} from '@teensyrom-nx/application';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import { DjDeckColumnComponent } from './dj-deck-column.component';
import { DJ_FILE_DRAG_TYPE, type DjFileDragPayload } from '../drag/dj-file-drag';
import type { DeckRef } from '../deck-ref';

// Loops/Cues stays on the inert placeholder; Transport, Voice, Speed and the binding card are
// wired live and covered by their own describe blocks below.
const INERT_PANEL_TYPES = [LoopsCuesPanelComponent] as const;

type Store = InstanceType<typeof DjStore>;
type TuneReference = Parameters<Store['setDeckLoaded']>[0]['reference'];

function idleTransportSummary(overrides: Partial<DeckTransportSummary> = {}): DeckTransportSummary {
  return {
    status: 'empty',
    led: 'stopped',
    label: 'Stopped',
    showing: 'play',
    controlsDisabled: true,
    canStop: false,
    scrubPercent: 0,
    bar: { kind: 'unknown' },
    frameLabel: 'frame 0',
    title: null,
    author: null,
    elapsedText: '00:00.0',
    totalText: '--:--',
    subtuneText: 'Subtune 0 of 0',
    subtuneCompact: '–/–',
    subtuneDisabled: true,
    repeat: true,
    errors: [],
    ...overrides,
  };
}

function idleBindingSummary(overrides: Partial<DeckBindingSummary> = {}): DeckBindingSummary {
  return {
    selectedDeviceId: null,
    present: false,
    placeholder: '— select a cartridge —',
    enableVisible: true,
    enableDisabled: false,
    identifyDisabled: true,
    errors: [],
    ...overrides,
  };
}

function createDeckServiceStub() {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    togglePlayPause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    setRepeat: vi.fn(),
    previousSubtune: vi.fn().mockResolvedValue(undefined),
    nextSubtune: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    bindDevice: vi.fn(),
    enableMidi: vi.fn().mockResolvedValue(undefined),
    identify: vi.fn(),
    setSpeed: vi.fn(),
    jumpSpeed: vi.fn(),
    setVoiceMuted: vi.fn(),
    setVoiceHeld: vi.fn(),
  };
}

interface RenderOptions {
  dropActive?: boolean;
  transport?: Partial<DeckTransportSummary>;
  binding?: Partial<DeckBindingSummary>;
  subtune?: number;
  devices?: Device[];
  outputs?: MidiPortOption[];
  bindings?: Partial<Record<Slot, DeckBindingState>>;
}

const UNBOUND: DeckBindingState = { device: null, portId: null, present: false, error: null };

function boundTo(id: string, name: string): DeckBindingState {
  return { device: { id, name }, portId: null, present: false, error: null };
}

function render(deck: DeckRef, options: RenderOptions = {}) {
  const transportSummary = signal(idleTransportSummary(options.transport));
  const bindingSummary = signal(idleBindingSummary(options.binding));
  const deckState = signal({
    subtune: options.subtune ?? 0,
    speed: 1,
    voices: [
      { muted: false, held: false },
      { muted: false, held: false },
      { muted: false, held: false },
    ],
  });
  const devices = signal<Device[]>(options.devices ?? []);
  const bindings = signal<Record<Slot, DeckBindingState>>({
    A: UNBOUND,
    B: UNBOUND,
    ...options.bindings,
  });
  const midi = signal({
    accessState: 'granted',
    ports: options.outputs ?? [],
    lastError: null,
  });
  const deckService = createDeckServiceStub();

  TestBed.configureTestingModule({
    imports: [DjDeckColumnComponent],
    providers: [
      provideNoopAnimations(),
      {
        provide: DjStore,
        useValue: {
          transportSummary: () => transportSummary,
          bindingSummary: () => bindingSummary,
          deck: () => deckState,
          canShape: () => signal(false),
          bindings,
          midi,
        },
      },
      { provide: DeckService, useValue: deckService },
      { provide: DeviceStore, useValue: { devices } },
    ],
  });

  const fixture = TestBed.createComponent(DjDeckColumnComponent);
  fixture.componentRef.setInput('deck', deck);
  fixture.componentRef.setInput('dropActive', options.dropActive ?? false);
  fixture.detectChanges();

  return { fixture, transportSummary, bindingSummary, deckService, devices, bindings, midi };
}

/** Renders the column against a real `DjStore`, so the speed and voice models are built from
 *  genuine store state and the real `canShape` gate. */
function renderLive(deck: DeckRef) {
  const deckService = createDeckServiceStub();

  TestBed.configureTestingModule({
    imports: [DjDeckColumnComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeckService, useValue: deckService },
      { provide: DeviceStore, useValue: { devices: signal<Device[]>([]) } },
    ],
  });

  const store = TestBed.inject(DjStore);
  const fixture = TestBed.createComponent(DjDeckColumnComponent);
  fixture.componentRef.setInput('deck', deck);
  fixture.detectChanges();

  return { fixture, store, deckService };
}

/** Puts a settled, shapeable tune on the deck, so its tune-shaping controls are live. */
function makeShapeable(store: Store, slot: Slot): void {
  const reference = {
    identity: { sidHash: `hash-${slot}`, subtune: 1 },
    title: 'Test Tune',
    author: 'Test Author',
    released: '2024 Test',
    subtuneCount: 1,
    byteLength: 1024,
  } as TuneReference;
  store.setDeckLoaded({ slot, reference });
  store.setDeckStatus({ slot, status: 'playing' });
}

/** A `DragEvent` carrying only the `types` list — enough for `isDjFileDrag`'s `dragenter`/`dragover`/`dragleave` check. */
function dragEventWithTypes(type: string, types: string[]): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  const dataTransfer = { types, dropEffect: 'none' } as unknown as DataTransfer;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  return event;
}

/** A `drop` `DragEvent` carrying the JSON-encoded payload under `DJ_FILE_DRAG_TYPE`, or none. */
function dropEventWithPayload(payload: DjFileDragPayload | null): DragEvent {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  const dataTransfer = {
    types: payload ? [DJ_FILE_DRAG_TYPE] : [],
    getData: (type: string) => (payload && type === DJ_FILE_DRAG_TYPE ? JSON.stringify(payload) : ''),
  } as unknown as DataTransfer;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  return event;
}

function gridAreas(fixture: ComponentFixture<DjDeckColumnComponent>): string[] {
  return Array.from(fixture.nativeElement.children).map(
    (el) => (el as HTMLElement).style.gridArea
  );
}

/** Every output on a component instance, found by duck-typing Angular's `OutputEmitterRef`. */
function outputsOf(instance: object): { emit: (value: unknown) => void }[] {
  return Object.values(instance as Record<string, unknown>).filter(
    (value): value is { emit: (value: unknown) => void } =>
      !!value && typeof value === 'object' && typeof (value as { emit?: unknown }).emit === 'function'
  );
}

function transportPanel(
  fixture: ComponentFixture<DjDeckColumnComponent>
): TransportPanelComponent {
  return fixture.debugElement.query(By.directive(TransportPanelComponent))
    .componentInstance as TransportPanelComponent;
}

function speedPanel(fixture: ComponentFixture<DjDeckColumnComponent>): SpeedPanelComponent {
  return fixture.debugElement.query(By.directive(SpeedPanelComponent))
    .componentInstance as SpeedPanelComponent;
}

function voicePanel(fixture: ComponentFixture<DjDeckColumnComponent>): VoicePanelComponent {
  return fixture.debugElement.query(By.directive(VoicePanelComponent))
    .componentInstance as VoicePanelComponent;
}

function bindingCard(fixture: ComponentFixture<DjDeckColumnComponent>): BindingCardComponent {
  return fixture.debugElement.query(By.directive(BindingCardComponent))
    .componentInstance as BindingCardComponent;
}

describe('DjDeckColumnComponent', () => {
  it('contributes a deck stack and a voice/speed column to the view grid for deck index 0', () => {
    const { fixture } = render({ slot: 'A', letter: 'A', index: 0 });
    expect(gridAreas(fixture)).toEqual(['d0', 'vs0']);

    expect(fixture.nativeElement.querySelectorAll('lib-scaling-compact-card').length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('lib-scaling-card').length).toBe(0);
  });

  it('contributes a deck stack and a voice/speed column to the view grid for deck index 1', () => {
    const { fixture } = render({ slot: 'B', letter: 'B', index: 1 });
    expect(gridAreas(fixture)).toEqual(['d1', 'vs1']);
  });

  it('stacks the transport, Loops/Cues and the binding card in that order inside the deck stack', () => {
    const { fixture } = render({ slot: 'A', letter: 'A', index: 0 });
    const stack = fixture.nativeElement.querySelector('.deck-stack') as HTMLElement;
    const slots = ['.transport-slot', '.loops-card', '.binding-card-slot'].map((selector) =>
      stack.querySelector(`:scope > ${selector}`)
    );

    expect(slots.every(Boolean)).toBe(true);
    expect(Array.from(stack.children)).toEqual(slots);
  });

  it('feeds the inert Loops/Cues panel from the deck placeholders, letter-scoped', () => {
    const { fixture } = render({ slot: 'B', letter: 'B', index: 1 });
    const loopsCues = fixture.debugElement.query(By.directive(LoopsCuesPanelComponent))
      .componentInstance as LoopsCuesPanelComponent;

    expect(loopsCues.model().accessibleName).toBe('Loops/Cues deck B');
  });

  it('lays the binding card out inline — one line at the bottom of the deck stack', () => {
    const { fixture } = render({ slot: 'A', letter: 'A', index: 0 });

    expect(bindingCard(fixture).layout()).toBe('inline');
  });

  it('binds no output handlers on the inert Loops/Cues panel', () => {
    const { fixture } = render({ slot: 'A', letter: 'A', index: 0 });
    const before = fixture.nativeElement.textContent;

    expect(() => {
      INERT_PANEL_TYPES.forEach((type) => {
        const instance = fixture.debugElement.query(By.directive(type)).componentInstance;
        outputsOf(instance).forEach((output) => output.emit(undefined));
      });
    }).not.toThrow();

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe(before);
  });

  describe('the transport panel', () => {
    it('builds accessible names from the deck letter and passes the summary through', () => {
      const { fixture } = render(
        { slot: 'B', letter: 'B', index: 1 },
        { transport: { bar: { kind: 'loop', introPercent: 12 }, label: 'Playing', led: 'playing' } }
      );
      const model = fixture.componentInstance.transportModel();

      expect(model.accessibleName).toBe('Transport deck B');
      expect(model.scrubAccessibleName).toBe('Position deck B');
      expect(model.subtune.previousAccessibleName).toBe('Previous subtune deck B');
      expect(model.subtune.nextAccessibleName).toBe('Next subtune deck B');
      expect(model.actionAccessibleNames).toEqual({
        play: 'Play deck B',
        pause: 'Pause deck B',
        stop: 'Stop deck B',
        repeat: 'Repeat track deck B',
      });
      expect(model.bar).toEqual({ kind: 'loop', introPercent: 12 });
      expect(model.transport).toEqual({ state: 'playing', label: 'Playing' });
    });

    it("the toggle's showing follows the summary", () => {
      const { fixture } = render({ slot: 'A', letter: 'A', index: 0 }, { transport: { showing: 'pause' } });

      expect(fixture.componentInstance.transportModel().playPause.showing).toBe('pause');
      expect(transportPanel(fixture).model().playPause.showing).toBe('pause');
    });

    it('disables the transport controls when the summary says so', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { transport: { controlsDisabled: true } }
      );
      expect(fixture.componentInstance.transportModel().playPause.disabled).toBe(true);
    });

    it('enables the transport controls when the summary says so', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { transport: { controlsDisabled: false } }
      );
      expect(fixture.componentInstance.transportModel().playPause.disabled).toBe(false);
    });

    it('uses the drag pin for positionPercent while held, falling back to the summary otherwise', () => {
      const { fixture } = render({ slot: 'A', letter: 'A', index: 0 }, { transport: { scrubPercent: 33 } });

      expect(fixture.componentInstance.positionPercent()).toBe(33);

      transportPanel(fixture).scrubInput.emit(80);
      fixture.detectChanges();

      expect(fixture.componentInstance.positionPercent()).toBe(80);
    });

    it('dispatches togglePlayPause, stop and setRepeat with this deck\'s slot', () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 });

      transportPanel(fixture).playPauseClick.emit();
      expect(deckService.togglePlayPause).toHaveBeenCalledWith('B');

      transportPanel(fixture).stopClick.emit();
      expect(deckService.stop).toHaveBeenCalledWith('B');

      transportPanel(fixture).repeatTrackChange.emit(false);
      expect(deckService.setRepeat).toHaveBeenCalledWith('B', false);
    });

    it('dispatches previousSubtune and nextSubtune with this deck\'s slot', () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 });

      transportPanel(fixture).previousSubtune.emit();
      expect(deckService.previousSubtune).toHaveBeenCalledWith('B');

      transportPanel(fixture).nextSubtune.emit();
      expect(deckService.nextSubtune).toHaveBeenCalledWith('B');
    });

    it('pins the position on scrubCommit, dispatches seek, and releases the pin once it lands', async () => {
      const { fixture, deckService } = render({ slot: 'A', letter: 'A', index: 0 }, { transport: { scrubPercent: 0 } });
      let landSeek: () => void = () => undefined;
      deckService.seek.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            landSeek = resolve;
          })
      );

      transportPanel(fixture).scrubCommit.emit(64);
      fixture.detectChanges();

      expect(deckService.seek).toHaveBeenCalledWith('A', 64);
      expect(fixture.componentInstance.positionPercent()).toBe(64); // pinned mid-seek

      landSeek();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.positionPercent()).toBe(0); // released back to the summary
    });
  });

  describe('the speed panel', () => {
    const DECK_B: DeckRef = { slot: 'B', letter: 'B', index: 1 };

    it('shows the live multiplier and builds its names from the deck letter', () => {
      const { fixture, store } = renderLive(DECK_B);
      store.setDeckEngineControls({
        slot: 'B',
        speed: 0.75,
        faderSpeed: 0.75,
        nudging: false,
        voices: store.decks().B.voices,
      });
      fixture.detectChanges();
      const model = speedPanel(fixture).model();

      expect(model.valueText).toBe('0.750x');
      expect(model.faderValue).toBe(0.75);
      expect([model.min, model.max, model.step]).toEqual([0.5, 1.5, 0.001]);
      expect(model.accessibleName).toBe('Speed deck B');
      expect(model.faderAccessibleName).toBe('Speed multiplier deck B');
      expect(model.jumpButtons.map((b) => b.id)).toEqual(['up', 'home', 'down']);
      expect(model.jumpButtons.map((b) => b.accessibleName)).toEqual([
        'Speed up 50% deck B',
        'Speed home deck B',
        'Speed down 50% deck B',
      ]);
    });

    it('pins the thumb at the edge of its range while the readout keeps the true multiplier', () => {
      const { fixture, store, deckService } = renderLive(DECK_B);
      const voices = store.decks().B.voices;

      store.setDeckEngineControls({ slot: 'B', speed: 1.7, faderSpeed: 1.7, nudging: false, voices });
      fixture.detectChanges();
      expect(speedPanel(fixture).model().faderValue).toBe(1.5);
      expect(speedPanel(fixture).model().valueText).toBe('1.700x');

      store.setDeckEngineControls({ slot: 'B', speed: 0.3, faderSpeed: 0.3, nudging: false, voices });
      fixture.detectChanges();
      expect(speedPanel(fixture).model().faderValue).toBe(0.5);
      expect(speedPanel(fixture).model().valueText).toBe('0.300x');

      expect(deckService.setSpeed).not.toHaveBeenCalled();
    });

    it("dispatches the fader value to setSpeed with this deck's slot", () => {
      const { fixture, deckService } = renderLive(DECK_B);

      speedPanel(fixture).faderChange.emit(1.234);

      expect(deckService.setSpeed).toHaveBeenCalledWith('B', 1.234);
    });

    it("dispatches each jump button to jumpSpeed with this deck's slot", () => {
      const { fixture, deckService } = renderLive(DECK_B);

      (['up', 'home', 'down'] as const).forEach((id) => speedPanel(fixture).jump.emit(id));

      expect(deckService.jumpSpeed.mock.calls).toEqual([
        ['B', 'up'],
        ['B', 'home'],
        ['B', 'down'],
      ]);
    });

    it('ignores a jump id that is not one of the three buttons', () => {
      const { fixture, deckService } = renderLive(DECK_B);

      speedPanel(fixture).jump.emit('sideways');

      expect(deckService.jumpSpeed).not.toHaveBeenCalled();
    });

    it('renders disabled on an empty deck and enabled once a tune is loaded', () => {
      const { fixture, store } = renderLive(DECK_B);
      const fader = () =>
        fixture.nativeElement.querySelector(
          '[aria-label="Speed multiplier deck B"]'
        ) as HTMLInputElement;

      expect(speedPanel(fixture).model().disabled).toBe(true);
      expect(fader().disabled).toBe(true);

      makeShapeable(store, 'B');
      fixture.detectChanges();

      expect(speedPanel(fixture).model().disabled).toBe(false);
      expect(fader().disabled).toBe(false);
    });
  });

  describe('the voice panel', () => {
    const DECK_B: DeckRef = { slot: 'B', letter: 'B', index: 1 };

    it('renders one row per voice with deck-scoped ids and names', () => {
      const { fixture } = renderLive(DECK_B);
      const model = voicePanel(fixture).model();

      expect(model.accessibleName).toBe('Voice deck B');
      expect(model.clearAccessibleName).toBe('Clear all voice mutes deck B');
      expect(model.rows.map((r) => r.label)).toEqual(['V1', 'V2', 'V3']);
      expect(model.rows.map((r) => r.checkboxId)).toEqual(['voice-B-1', 'voice-B-2', 'voice-B-3']);
      expect(model.rows.map((r) => r.muteAccessibleName)).toEqual([
        'Mute voice 1 deck B',
        'Mute voice 2 deck B',
        'Mute voice 3 deck B',
      ]);
    });

    it('labels the hold Punch for a muted voice and Kill otherwise, following the store', () => {
      const { fixture, store } = renderLive(DECK_B);
      const rows = () => voicePanel(fixture).model().rows;

      expect(rows().map((r) => r.holdLabel)).toEqual(['Kill', 'Kill', 'Kill']);
      expect(rows()[0].holdAccessibleName).toBe('Kill voice 1 deck B');

      store.setDeckEngineControls({
        slot: 'B',
        speed: 1,
        faderSpeed: 1,
        nudging: false,
        voices: [
          { muted: true, held: false },
          { muted: false, held: false },
          { muted: false, held: false },
        ],
      });
      fixture.detectChanges();

      expect(rows().map((r) => r.muted)).toEqual([true, false, false]);
      expect(rows().map((r) => r.holdLabel)).toEqual(['Punch', 'Kill', 'Kill']);
      expect(rows()[0].holdAccessibleName).toBe('Punch voice 1 deck B');
      expect(rows()[1].holdAccessibleName).toBe('Kill voice 2 deck B');
    });

    it("dispatches mute, hold and clear with this deck's slot", () => {
      const { fixture, deckService } = renderLive(DECK_B);

      voicePanel(fixture).mutedChange.emit({ index: 1, muted: true });
      expect(deckService.setVoiceMuted).toHaveBeenCalledWith('B', 1, true);

      voicePanel(fixture).heldChange.emit({ index: 2, held: true });
      expect(deckService.setVoiceHeld).toHaveBeenCalledWith('B', 2, true);

      voicePanel(fixture).heldChange.emit({ index: 2, held: false });
      expect(deckService.setVoiceHeld).toHaveBeenCalledWith('B', 2, false);
    });

    it('renders disabled on an empty deck and enabled once a tune is loaded', () => {
      const { fixture, store } = renderLive(DECK_B);
      const mute = () =>
        fixture.nativeElement.querySelector(
          'input[aria-label="Mute voice 1 deck B"]'
        ) as HTMLInputElement;

      expect(voicePanel(fixture).model().disabled).toBe(true);
      expect(mute().disabled).toBe(true);

      makeShapeable(store, 'B');
      fixture.detectChanges();

      expect(voicePanel(fixture).model().disabled).toBe(false);
      expect(mute().disabled).toBe(false);
    });

    it("reads only its own deck's state", () => {
      const { fixture, store } = renderLive(DECK_B);
      store.setDeckEngineControls({
        slot: 'A',
        speed: 1.2,
        faderSpeed: 1.2,
        nudging: false,
        voices: [
          { muted: true, held: false },
          { muted: true, held: false },
          { muted: true, held: false },
        ],
      });
      makeShapeable(store, 'A');
      fixture.detectChanges();

      const { rows, disabled } = voicePanel(fixture).model();
      expect(rows.map((r) => r.muted)).toEqual([false, false, false]);
      expect(disabled).toBe(true);
      expect(speedPanel(fixture).model().valueText).toBe('1.000x');
    });
  });

  describe('the binding card', () => {
    const TR_1 = { deviceId: '14470230', name: 'TR-1' } as Device;
    const TR_2 = { deviceId: '19277260', name: 'TR-2' } as Device;
    const PORT_1: MidiPortOption = {
      id: 'port-1',
      name: 'TeensyROM-14470230',
      manufacturer: 'Microsoft Corporation',
    };

    it('builds accessible names from the deck letter and passes the summary through', () => {
      const { fixture } = render(
        { slot: 'B', letter: 'B', index: 1 },
        { binding: { selectedDeviceId: '14470230', enableVisible: false } }
      );
      const model = fixture.componentInstance.bindingModel();

      expect(model.accessibleName).toBe('MIDI binding deck B');
      expect(model.heading).toBe('Deck B');
      expect(model.selectAccessibleName).toBe('Cartridge deck B');
      expect(model.enableAccessibleName).toBe('Enable MIDI deck B');
      expect(model.identifyAccessibleName).toBe('Identify deck B');
      expect(model.selectedPortId).toBe('14470230');
      expect(model.portPlaceholder).toBe('— select a cartridge —');
      expect(model.enableVisible).toBe(false);
    });

    it('lists the cartridges, a present one with its port and an absent one flagged', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { devices: [TR_1, TR_2], outputs: [PORT_1] }
      );

      expect(fixture.componentInstance.bindingModel().ports).toEqual([
        {
          id: '14470230',
          label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)',
          takenBy: undefined,
        },
        {
          id: '19277260',
          label: 'TR-2: TeensyROM-19277260 · absent',
          takenBy: undefined,
          absent: true,
        },
      ]);
    });

    it('maps the other deck holding a cartridge to takenBy', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { devices: [TR_1, TR_2], bindings: { B: boundTo('19277260', 'TR-2') } }
      );

      expect(fixture.componentInstance.bindingModel().ports.map((p) => p.takenBy)).toEqual([
        undefined,
        'B',
      ]);
    });

    it('does not list an output that is not a cartridge', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { outputs: [{ id: 'synth', name: 'Wavetable Synth', manufacturer: 'Acme' }] }
      );

      expect(fixture.componentInstance.bindingModel().ports).toEqual([]);
    });

    it('relabels the options when the store renames the device', () => {
      const { fixture, devices } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { devices: [TR_1], outputs: [PORT_1] }
      );

      devices.set([{ deviceId: '14470230', name: 'Living Room' } as Device]);

      expect(fixture.componentInstance.bindingModel().ports[0].label).toBe(
        'Living Room: TeensyROM-14470230 (Microsoft Corporation)'
      );
    });

    it('enables the selector when there is a cartridge to choose, MIDI enabled or not', () => {
      const { fixture } = render({ slot: 'A', letter: 'A', index: 0 }, { devices: [TR_1] });
      expect(fixture.componentInstance.bindingModel().portsEnabled).toBe(true);

      TestBed.resetTestingModule();
      const empty = render({ slot: 'A', letter: 'A', index: 0 });
      expect(empty.fixture.componentInstance.bindingModel().portsEnabled).toBe(false);
    });

    it('renders a taken option disabled', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        { devices: [TR_1], bindings: { B: boundTo('14470230', 'TR-1') } }
      );

      const option = fixture.nativeElement.querySelector(
        '[aria-label="Cartridge deck A"] option[value="14470230"]'
      ) as HTMLOptionElement;

      expect(option.disabled).toBe(true);
    });

    it("dispatches bindDevice with this deck's slot, mapping the placeholder to null", () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 });

      bindingCard(fixture).portSelect.emit('19277260');
      expect(deckService.bindDevice).toHaveBeenCalledWith('B', '19277260');

      bindingCard(fixture).portSelect.emit('');
      expect(deckService.bindDevice).toHaveBeenCalledWith('B', null);
    });

    it('dispatches enableMidi and identify with this deck\'s slot', () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 });

      bindingCard(fixture).enableMidi.emit();
      expect(deckService.enableMidi).toHaveBeenCalled();

      bindingCard(fixture).identify.emit();
      expect(deckService.identify).toHaveBeenCalledWith('B');
    });
  });

  describe('the drop overlay', () => {
    function overlay(fixture: ComponentFixture<DjDeckColumnComponent>): HTMLElement | null {
      return fixture.nativeElement.querySelector('.drop-overlay');
    }

    it('renders no overlay when dropActive is false', () => {
      const { fixture } = render({ slot: 'B', letter: 'B', index: 1 }, { dropActive: false });

      expect(overlay(fixture)).toBeNull();
    });

    it('renders exactly one overlay labelled for the deck when dropActive is true', () => {
      const { fixture } = render({ slot: 'B', letter: 'B', index: 1 }, { dropActive: true });

      expect(fixture.nativeElement.querySelectorAll('.drop-overlay').length).toBe(1);
      expect(overlay(fixture)?.textContent?.trim()).toBe('Drop to load — Deck B');
    });

    it('sets --hot on dragenter with the custom type and clears it on the matching dragleave', () => {
      const { fixture } = render({ slot: 'B', letter: 'B', index: 1 }, { dropActive: true });
      const el = overlay(fixture) as HTMLElement;

      el.dispatchEvent(dragEventWithTypes('dragenter', [DJ_FILE_DRAG_TYPE]));
      fixture.detectChanges();
      expect(el.classList.contains('drop-overlay--hot')).toBe(true);

      el.dispatchEvent(dragEventWithTypes('dragleave', [DJ_FILE_DRAG_TYPE]));
      fixture.detectChanges();
      expect(el.classList.contains('drop-overlay--hot')).toBe(false);
    });

    it('ignores a dragenter that does not carry the DJ file type', () => {
      const { fixture } = render({ slot: 'B', letter: 'B', index: 1 }, { dropActive: true });
      const el = overlay(fixture) as HTMLElement;

      el.dispatchEvent(dragEventWithTypes('dragenter', ['Files']));
      fixture.detectChanges();

      expect(el.classList.contains('drop-overlay--hot')).toBe(false);
    });

    it('dispatches load with this deck\'s slot and the dropped payload', () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 }, { dropActive: true });
      const el = overlay(fixture) as HTMLElement;
      const payload: DjFileDragPayload = {
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/song.sid',
        fileName: 'song.sid',
      };

      el.dispatchEvent(dropEventWithPayload(payload));

      expect(deckService.load).toHaveBeenCalledWith('B', payload);
    });

    it('dispatches nothing on a drop without the DJ file type', () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 }, { dropActive: true });
      const el = overlay(fixture) as HTMLElement;

      el.dispatchEvent(dropEventWithPayload(null));

      expect(deckService.load).not.toHaveBeenCalled();
    });
  });
});
