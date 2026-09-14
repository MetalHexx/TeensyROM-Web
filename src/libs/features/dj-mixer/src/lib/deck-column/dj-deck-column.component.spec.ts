import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { StorageType } from '@teensyrom-nx/domain';
import {
  DeckService,
  DjStore,
  type DeckBindingSummary,
  type DeckTransportSummary,
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

// Voice, Speed and Loops/Cues stay on the inert placeholders; Transport and the binding card are
// wired live and covered by their own describe blocks below.
const INERT_PANEL_TYPES = [VoicePanelComponent, SpeedPanelComponent, LoopsCuesPanelComponent] as const;

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
    subtuneText: 'Subtune 0 of 0',
    subtuneDisabled: true,
    repeat: true,
    errors: [],
    ...overrides,
  };
}

function idleBindingSummary(overrides: Partial<DeckBindingSummary> = {}): DeckBindingSummary {
  return {
    portOptions: [],
    selectedPortId: null,
    portPlaceholder: '— MIDI not enabled —',
    deviceOptions: [],
    selectedDeviceId: null,
    devicePlaceholder: '— select a device —',
    portsEnabled: false,
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
    selectSubtune: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    bindPort: vi.fn().mockResolvedValue(undefined),
    bindDevice: vi.fn().mockResolvedValue(undefined),
    enableMidi: vi.fn().mockResolvedValue(undefined),
    identify: vi.fn(),
  };
}

interface RenderOptions {
  dropActive?: boolean;
  transport?: Partial<DeckTransportSummary>;
  binding?: Partial<DeckBindingSummary>;
  subtune?: number;
}

function render(deck: DeckRef, options: RenderOptions = {}) {
  const transportSummary = signal(idleTransportSummary(options.transport));
  const bindingSummary = signal(idleBindingSummary(options.binding));
  const deckState = signal({ subtune: options.subtune ?? 0 });
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
        },
      },
      { provide: DeckService, useValue: deckService },
    ],
  });

  const fixture = TestBed.createComponent(DjDeckColumnComponent);
  fixture.componentRef.setInput('deck', deck);
  fixture.componentRef.setInput('dropActive', options.dropActive ?? false);
  fixture.detectChanges();

  return { fixture, transportSummary, bindingSummary, deckService };
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

  it('feeds every inert lifted panel from the deck placeholders, letter-scoped', () => {
    const { fixture } = render({ slot: 'B', letter: 'B', index: 1 });
    const voice = fixture.debugElement.query(By.directive(VoicePanelComponent))
      .componentInstance as VoicePanelComponent;

    expect(voice.model().accessibleName).toBe('Voice deck B');
  });

  it('lays the binding card out inline — one line at the bottom of the deck stack', () => {
    const { fixture } = render({ slot: 'A', letter: 'A', index: 0 });

    expect(bindingCard(fixture).layout()).toBe('inline');
  });

  it('binds no output handlers on the inert lifted panels', () => {
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

    it('dispatches selectSubtune one below/above the store\'s current subtune on previous/next', () => {
      const { fixture, deckService } = render({ slot: 'A', letter: 'A', index: 0 }, { subtune: 3 });

      transportPanel(fixture).previousSubtune.emit();
      expect(deckService.selectSubtune).toHaveBeenCalledWith('A', 2);

      transportPanel(fixture).nextSubtune.emit();
      expect(deckService.selectSubtune).toHaveBeenCalledWith('A', 4);
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

  describe('the binding card', () => {
    it('builds accessible names from the deck letter and passes the summary through', () => {
      const { fixture } = render(
        { slot: 'B', letter: 'B', index: 1 },
        {
          binding: {
            selectedPortId: 'port-1',
            portsEnabled: true,
            selectedDeviceId: 'device-1',
          },
        }
      );
      const model = fixture.componentInstance.bindingModel();

      expect(model.accessibleName).toBe('MIDI binding deck B');
      expect(model.heading).toBe('Deck B');
      expect(model.selectAccessibleName).toBe('Output port deck B');
      expect(model.deviceSelectAccessibleName).toBe('Device deck B');
      expect(model.enableAccessibleName).toBe('Enable MIDI deck B');
      expect(model.identifyAccessibleName).toBe('Identify deck B');
      expect(model.selectedPortId).toBe('port-1');
      expect(model.selectedDeviceId).toBe('device-1');
    });

    it('maps a null takenBy to undefined and a bound slot through as-is', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        {
          binding: {
            portOptions: [{ id: 'p1', label: 'Port 1', takenBy: null }],
            deviceOptions: [{ id: 'd1', label: 'Device 1', takenBy: 'B' }],
          },
        }
      );
      const model = fixture.componentInstance.bindingModel();

      expect(model.ports).toEqual([{ id: 'p1', label: 'Port 1', takenBy: undefined }]);
      expect(model.devices).toEqual([{ id: 'd1', label: 'Device 1', takenBy: 'B' }]);
    });

    it('renders a taken option disabled', () => {
      const { fixture } = render(
        { slot: 'A', letter: 'A', index: 0 },
        {
          binding: {
            portsEnabled: true,
            portOptions: [{ id: 'p1', label: 'Port 1', takenBy: 'B' }],
          },
        }
      );

      const option = fixture.nativeElement.querySelector(
        '[aria-label="Output port deck A"] option[value="p1"]'
      ) as HTMLOptionElement;

      expect(option.disabled).toBe(true);
    });

    it('dispatches bindPort and bindDevice with this deck\'s slot, mapping the placeholder to null', () => {
      const { fixture, deckService } = render({ slot: 'B', letter: 'B', index: 1 });

      bindingCard(fixture).portSelect.emit('port-9');
      expect(deckService.bindPort).toHaveBeenCalledWith('B', 'port-9');

      bindingCard(fixture).portSelect.emit('');
      expect(deckService.bindPort).toHaveBeenCalledWith('B', null);

      bindingCard(fixture).deviceSelect.emit('device-9');
      expect(deckService.bindDevice).toHaveBeenCalledWith('B', 'device-9');

      bindingCard(fixture).deviceSelect.emit('');
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
