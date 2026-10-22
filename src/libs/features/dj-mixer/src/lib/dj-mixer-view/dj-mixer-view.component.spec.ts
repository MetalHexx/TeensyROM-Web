import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  DECK_CONTROL_IDS,
  DECK_SLOTS,
  DeckService,
  DeviceStore,
  DjStore,
  HOME_DECK_PANEL,
  MappableControls,
  MidiControllers,
  MidiLearn,
  MidiMappings,
  MidiMappingStore,
  MixerService,
  StorageStore,
  controlKey,
  type ControlIdentity,
  type DeckBindingSummary,
  type DeckTransportSummary,
  type MappableControl,
} from '@teensyrom-nx/application';
import {
  MappingOverlayLayerComponent,
  SlidingContainerComponent,
} from '@teensyrom-nx/ui/components';
import { StorageType } from '@teensyrom-nx/domain';
import { DjMixerViewComponent } from './dj-mixer-view.component';
import { anchorFor } from '../mapping/control-anchors';
import { DjBindingsPanelComponent } from '../bindings-panel/dj-bindings-panel.component';
import { DjBrowseTreesComponent } from '../browse-trees/dj-browse-trees.component';
import { DjDirectoryListingComponent } from '../directory-listing/dj-directory-listing.component';

interface DeviceFixtureOptions {
  deviceId?: string;
  isEnabled?: boolean;
  sdAvailable?: boolean;
  usbAvailable?: boolean;
}

function device({
  deviceId = 'device-a',
  isEnabled = true,
  sdAvailable = true,
  usbAvailable = true,
}: DeviceFixtureOptions = {}) {
  return {
    deviceId,
    name: `TeensyROM ${deviceId}`,
    isEnabled,
    sdStorage: { deviceId, type: StorageType.Sd, available: sdAvailable, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: usbAvailable, indexExists: true },
  };
}

function createStorageStoreStub(overrides: Record<string, unknown> = {}) {
  return {
    storageEntries: signal<Record<string, { currentPath: string }>>({}),
    selectedDirectories: signal<
      Record<string, { deviceId: string; storageType: StorageType | null; path: string }>
    >({}),
    navigationHistory: signal<
      Record<
        string,
        { history: { path: string; storageType: StorageType | null }[]; currentIndex: number }
      >
    >({}),
    getSelectedDirectoryState: vi.fn(() => signal(null)),
    initializeStorage: vi.fn().mockResolvedValue(undefined),
    navigateToDirectory: vi.fn().mockResolvedValue(undefined),
    navigateDirectoryBackward: vi.fn().mockResolvedValue(undefined),
    navigateDirectoryForward: vi.fn().mockResolvedValue(undefined),
    navigateUpOneDirectory: vi.fn().mockResolvedValue(undefined),
    refreshDirectory: vi.fn().mockResolvedValue(undefined),
    setNavigationPin: vi.fn(),
    clearNavigationPin: vi.fn(),
    ...overrides,
  };
}

/** An idle deck: nothing loaded, nothing bound — everything `DjDeckColumnComponent` needs to
 *  render its lifted panels, but nothing this view's own spec asserts on (see the deck column's
 *  own spec for the wiring behavior). */
function idleTransportSummary(): DeckTransportSummary {
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
  };
}

function idleBindingSummary(): DeckBindingSummary {
  return {
    selectedDeviceId: null,
    present: false,
    placeholder: '— select a cartridge —',
    enableVisible: true,
    enableDisabled: false,
    identifyDisabled: true,
    errors: [],
  };
}

function createDjStoreStub() {
  return {
    transportSummary: () => signal(idleTransportSummary()),
    bindingSummary: () => signal(idleBindingSummary()),
    bindings: signal({
      A: { device: null, portId: null, present: false, error: null },
      B: { device: null, portId: null, present: false, error: null },
    }),
    midi: signal({ accessState: 'idle', ports: [], lastError: null }),
    deck: () =>
      signal({
        speed: 1,
        voices: [
          { muted: false, held: false },
          { muted: false, held: false },
          { muted: false, held: false },
        ],
      }),
    deckPanel: () => signal(HOME_DECK_PANEL),
    canShape: () => signal(false),
    keyReadout: () => signal('0'),
    keyDisplayFormat: signal('camelot'),
  };
}

function createMixerServiceStub() {
  return {
    setKeySemitones: vi.fn(),
    setKeyDisplayFormat: vi.fn(),
  };
}

function createDeckServiceStub() {
  return {
    load: vi.fn(),
    togglePlayPause: vi.fn(),
    stop: vi.fn(),
    setRepeat: vi.fn(),
    selectSubtune: vi.fn(),
    seek: vi.fn(),
    bindDevice: vi.fn(),
    enableMidi: vi.fn(),
    identify: vi.fn(),
  };
}

const SPEED_A: ControlIdentity = { owner: 'A', control: 'speed' };
const STOP_B: ControlIdentity = { owner: 'B', control: 'stop' };

const STUB_CONTROLS: readonly MappableControl[] = [
  {
    identity: SPEED_A,
    name: 'Speed',
    nature: 'value',
    min: 0.5,
    max: 1.5,
    home: 1,
    step: null,
    defaults: { ccStyle: 'relative-offset', sensitivity: 0.01, stepAmount: 0.05 },
    read: () => 1,
    set: () => undefined,
  },
  { identity: STOP_B, name: 'Stop', nature: 'trigger', fire: () => undefined },
];

function createMidiStubs() {
  return {
    controls: {
      all: STUB_CONTROLS,
      find: (identity: ControlIdentity) =>
        STUB_CONTROLS.find(
          (c) => c.identity.owner === identity.owner && c.identity.control === identity.control
        ) ?? null,
    },
    controllers: {
      connectedInputs: signal<{ id: string; name: string }[]>([]),
      setMappingMode: vi.fn().mockResolvedValue(undefined),
      setListening: vi.fn(),
      pointAt: vi.fn(),
    },
    learn: { select: vi.fn(), cancel: vi.fn(), relearn: vi.fn() },
    mappings: { setStyle: vi.fn(), remove: vi.fn() },
  };
}

function render(
  devices: unknown[],
  storageStoreOverrides: Record<string, unknown> = {},
  { reducedMotion = false } = {}
) {
  const storageStore = createStorageStoreStub(storageStoreOverrides);
  const midi = createMidiStubs();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usableDevices = signal(devices.filter((d: any) => d.isEnabled));

  TestBed.configureTestingModule({
    imports: [DjMixerViewComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeviceStore, useValue: { devices: signal(devices), usableDevices } },
      { provide: StorageStore, useValue: storageStore },
      { provide: DjStore, useValue: createDjStoreStub() },
      { provide: DeckService, useValue: createDeckServiceStub() },
      { provide: MixerService, useValue: createMixerServiceStub() },
      { provide: MappableControls, useValue: midi.controls },
      { provide: MidiControllers, useValue: midi.controllers },
      { provide: MidiLearn, useValue: midi.learn },
      { provide: MidiMappings, useValue: midi.mappings },
      {
        provide: BreakpointObserver,
        useValue: {
          observe: (query: string) =>
            of({ matches: reducedMotion && query.includes('reduced-motion'), breakpoints: {} }),
        },
      },
    ],
  });

  const fixture: ComponentFixture<DjMixerViewComponent> =
    TestBed.createComponent(DjMixerViewComponent);
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    storageStore,
    midi,
    midiStore: TestBed.inject(MidiMappingStore),
  };
}

function deckLetters(fixture: ComponentFixture<DjMixerViewComponent>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('lib-dj-deck-column')).map((el) =>
    (el as HTMLElement).getAttribute('data-deck')
  ) as string[];
}

describe('DjMixerViewComponent', () => {
  describe('the two fixed deck columns', () => {
    // First test in the file to hit TestBed.createComponent, which pays the one-time cost of
    // JIT-compiling this component and its deck columns' lifted panels. That cold compile can
    // exceed the project's tight 2000ms testTimeout under CI load; every later test here reuses
    // the compiled TestBed and stays fast, so only this test needs the extra headroom.
    it('renders exactly two deck columns, lettered A and B, and one mixer card with no enabled devices', () => {
      const { fixture } = render([]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
      expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    }, 10000);

    it('still renders exactly two deck columns with one enabled device', () => {
      const { fixture } = render([device()]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
    });

    it('still renders exactly two deck columns with three enabled devices', () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
    });
  });

  describe('the bottom band', () => {
    /** The band's own empty state, not the directory listing's unrelated "Empty Directory" one —
     *  scoped to a direct child of `.bottom-band` via the native DOM's own `:scope` support,
     *  which Angular's `DebugElement` matcher does not implement. */
    function bandEmptyState(fixture: ComponentFixture<DjMixerViewComponent>): Element | null {
      return fixture.nativeElement
        .querySelector('.bottom-band')
        .querySelector(':scope > lib-empty-state-message');
    }

    it('shows the empty state and hides browse/listing when no devices are enabled', () => {
      const { fixture } = render([device({ isEnabled: false })]);
      const band = fixture.debugElement.query(By.css('.bottom-band'));

      expect(bandEmptyState(fixture)).toBeTruthy();
      expect(band.queryAll(By.directive(DjBrowseTreesComponent)).length).toBe(0);
      expect(band.queryAll(By.directive(DjDirectoryListingComponent)).length).toBe(0);
      // The decks and the mixer always render, even with the bottom band in its empty state.
      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(fixture.nativeElement.querySelector('.mixer-grid')).toBeTruthy();
    });

    it('hides the empty state and shows browse/listing once a device is enabled', () => {
      const { fixture, component } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);
      const band = fixture.debugElement.query(By.css('.bottom-band'));

      expect(bandEmptyState(fixture)).toBeNull();

      const browseTrees = band.query(By.directive(DjBrowseTreesComponent))
        .componentInstance as DjBrowseTreesComponent;
      const listing = band.query(By.directive(DjDirectoryListingComponent))
        .componentInstance as DjDirectoryListingComponent;

      expect(browseTrees.devices()).toEqual(component.enabledDevices());
      expect(browseTrees.activeStorage()).toEqual(component.activeStorage());
      expect(listing.activeStorage()).toEqual(component.activeStorage());
    });
  });

  describe('active storage', () => {
    it("defaults to the first enabled device's first available storage", () => {
      const { component } = render([device({ deviceId: 'a' })]);

      expect(component.activeStorage()).toEqual({ deviceId: 'a', storageType: StorageType.Sd });
    });

    it('defaults to USB when SD is unavailable on the first device', () => {
      const { component } = render([device({ deviceId: 'a', sdAvailable: false })]);

      expect(component.activeStorage()).toEqual({ deviceId: 'a', storageType: StorageType.Usb });
    });

    it('falls through to the next device when the first has no available storage', () => {
      const { component } = render([
        device({ deviceId: 'a', sdAvailable: false, usbAvailable: false }),
        device({ deviceId: 'b' }),
      ]);

      expect(component.activeStorage()).toEqual({ deviceId: 'b', storageType: StorageType.Sd });
    });

    it("seeds every enabled device's available storage on mount", async () => {
      const { storageStore } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b', sdAvailable: false }),
      ]);

      // initializeStorage() is async; each device's storages seed across microtask
      // continuations, so wait for the full set rather than asserting synchronously.
      await vi.waitFor(() => {
        expect(storageStore.initializeStorage).toHaveBeenCalledWith({
          deviceId: 'a',
          storageType: StorageType.Sd,
        });
        expect(storageStore.initializeStorage).toHaveBeenCalledWith({
          deviceId: 'a',
          storageType: StorageType.Usb,
        });
        expect(storageStore.initializeStorage).toHaveBeenCalledWith({
          deviceId: 'b',
          storageType: StorageType.Usb,
        });
      });
      expect(storageStore.initializeStorage).not.toHaveBeenCalledWith({
        deviceId: 'b',
        storageType: StorageType.Sd,
      });
    });

    it('does not seed a disabled device', () => {
      const { storageStore } = render([device({ deviceId: 'a', isEnabled: false })]);

      expect(storageStore.initializeStorage).not.toHaveBeenCalled();
    });

    it("sets the active storage and dispatches navigateToDirectory with the entry's current path on a storage select", () => {
      const { fixture, component, storageStore } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
      ]);
      storageStore.storageEntries.set({ 'b-USB': { currentPath: '/games' } });

      const browseTrees = fixture.debugElement.query(By.directive(DjBrowseTreesComponent))
        .componentInstance as DjBrowseTreesComponent;
      browseTrees.storageSelect.emit({ deviceId: 'b', storageType: StorageType.Usb });

      expect(component.activeStorage()).toEqual({ deviceId: 'b', storageType: StorageType.Usb });
      expect(storageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'b',
        storageType: StorageType.Usb,
        path: '/games',
      });
    });

    it('dispatches navigateToDirectory with the storage root when the entry has not loaded yet', () => {
      const { fixture, storageStore } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
      ]);

      const browseTrees = fixture.debugElement.query(By.directive(DjBrowseTreesComponent))
        .componentInstance as DjBrowseTreesComponent;
      browseTrees.storageSelect.emit({ deviceId: 'b', storageType: StorageType.Usb });

      expect(storageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'b',
        storageType: StorageType.Usb,
        path: '/',
      });
    });

    it("follows the store when the active device's selection moves to its other storage", () => {
      const { fixture, component, storageStore } = render([device({ deviceId: 'a' })]);

      expect(component.activeStorage()).toEqual({ deviceId: 'a', storageType: StorageType.Sd });

      storageStore.selectedDirectories.set({
        a: { deviceId: 'a', storageType: StorageType.Usb, path: '/' },
      });
      fixture.detectChanges();

      expect(component.activeStorage()).toEqual({ deviceId: 'a', storageType: StorageType.Usb });
    });

    it('ignores a null storage type from the store — the DJ view has no device level', () => {
      const { fixture, component, storageStore } = render([device({ deviceId: 'a' })]);

      storageStore.selectedDirectories.set({
        a: { deviceId: 'a', storageType: null, path: '/' },
      });
      fixture.detectChanges();

      expect(component.activeStorage()).toEqual({ deviceId: 'a', storageType: StorageType.Sd });
    });

    it('holds a navigation pin on the active device while mounted', () => {
      const { storageStore } = render([device({ deviceId: 'a' })]);

      expect(storageStore.setNavigationPin).toHaveBeenCalledWith({ deviceId: 'a' });
    });

    it('releases the pin on destroy', () => {
      const { fixture, storageStore } = render([device({ deviceId: 'a' })]);

      fixture.destroy();

      expect(storageStore.clearNavigationPin).toHaveBeenCalledWith({ deviceId: 'a' });
    });
  });

  describe('the SID drag bridge', () => {
    it('lights every deck overlay while a drag is in flight and clears them on drag end', () => {
      const { fixture } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);

      const listing = fixture.debugElement.query(By.directive(DjDirectoryListingComponent))
        .componentInstance as DjDirectoryListingComponent;

      listing.dragStarted.emit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.drop-overlay').length).toBe(2);

      listing.dragEnded.emit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.drop-overlay').length).toBe(0);
    });
  });

  describe('the bindings panel', () => {
    function bindingsButton(fixture: ComponentFixture<DjMixerViewComponent>): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        'lib-dj-mixer-card button[aria-label$="bindings panel"]'
      );
    }

    function press(fixture: ComponentFixture<DjMixerViewComponent>): void {
      bindingsButton(fixture).click();
      fixture.detectChanges();
    }

    function slot(fixture: ComponentFixture<DjMixerViewComponent>): SlidingContainerComponent {
      return fixture.debugElement.query(By.directive(SlidingContainerComponent))
        .componentInstance as SlidingContainerComponent;
    }

    it('shows neither the panel nor its container before it is first opened', () => {
      const { fixture, component } = render([]);

      expect(component.panelOpen()).toBe(false);
      expect(fixture.nativeElement.querySelector('lib-sliding-container')).toBeNull();
      expect(fixture.nativeElement.querySelector('lib-dj-bindings-panel')).toBeNull();
      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Open bindings panel');
    });

    it('opens the panel from the mixer card and closes it from the same button', () => {
      const { fixture } = render([]);

      press(fixture);
      expect(fixture.debugElement.query(By.directive(DjBindingsPanelComponent))).toBeTruthy();
      expect(slot(fixture).animationTrigger()).toBe(true);
      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Close bindings panel');

      press(fixture);
      expect(slot(fixture).animationTrigger()).toBe(false);
      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Open bindings panel');
    });

    it("closes from the panel's own close button", () => {
      const { fixture, component } = render([]);
      press(fixture);

      fixture.debugElement
        .query(By.directive(DjBindingsPanelComponent))
        .componentInstance.closePanel.emit();
      fixture.detectChanges();

      expect(component.panelOpen()).toBe(false);
    });

    it('turns mapping mode off when the panel closes', () => {
      const { fixture, midi } = render([]);
      press(fixture);
      expect(midi.controllers.setMappingMode).not.toHaveBeenCalled();

      press(fixture);

      expect(midi.controllers.setMappingMode).toHaveBeenCalledWith(false);
    });

    it('turns mapping mode off when the view is destroyed with the panel still open', () => {
      const { fixture, midi } = render([]);
      press(fixture);
      expect(midi.controllers.setMappingMode).not.toHaveBeenCalled();

      fixture.destroy();

      expect(midi.controllers.setMappingMode).toHaveBeenCalledWith(false);
    });

    it('slides the panel in at 22.5rem, and with no duration for reduced motion', () => {
      const panel = (fixture: ComponentFixture<DjMixerViewComponent>) =>
        fixture.debugElement.query(By.directive(DjBindingsPanelComponent))
          .componentInstance as DjBindingsPanelComponent;

      const normal = render([]);
      press(normal.fixture);
      expect(slot(normal.fixture).containerWidth()).toBe('22.5rem');
      expect(slot(normal.fixture).animationDuration()).toBe(400);
      expect(panel(normal.fixture).animationDuration()).toBe(400);
      TestBed.resetTestingModule();

      const reduced = render([], {}, { reducedMotion: true });
      press(reduced.fixture);
      expect(slot(reduced.fixture).animationDuration()).toBe(0);
      expect(panel(reduced.fixture).animationDuration()).toBe(0);
    });

    it('moves focus to the mapping mode switch when the panel opens', () => {
      const { fixture } = render([]);

      press(fixture);

      const toggle = fixture.nativeElement.querySelector('lib-dj-bindings-panel mat-slide-toggle');
      expect(toggle.contains(document.activeElement)).toBe(true);
    });

    it("returns focus to the Bindings button when the panel's own close button closes it", () => {
      const { fixture } = render([]);
      press(fixture);
      const close: HTMLButtonElement = fixture.nativeElement.querySelector(
        'lib-dj-bindings-panel button[aria-label="Close panel"]'
      );
      close.focus();

      close.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(bindingsButton(fixture));
    });
  });

  describe('the control anchors', () => {
    const ALL_IDENTITIES: readonly ControlIdentity[] = DECK_SLOTS.flatMap((owner) =>
      DECK_CONTROL_IDS.map((control): ControlIdentity => ({ owner, control }))
    );

    it('finds every mappable control as exactly one element in the rendered grid', () => {
      const { fixture } = render([]);
      const grid: HTMLElement = fixture.nativeElement.querySelector('.mixer-grid');

      const mismatched = ALL_IDENTITIES.map((identity) => ({
        identity: controlKey(identity),
        matches: grid.querySelectorAll(anchorFor(identity)).length,
      })).filter(({ matches }) => matches !== 1);

      expect(ALL_IDENTITIES).toHaveLength(36);
      expect(mismatched).toEqual([]);
    });
  });

  describe('the mapping overlays', () => {
    function layer(fixture: ComponentFixture<DjMixerViewComponent>) {
      return fixture.debugElement.query(By.directive(MappingOverlayLayerComponent));
    }

    it('renders no overlay layer outside mapping mode', () => {
      const { fixture } = render([]);

      expect(layer(fixture)).toBeNull();
    });

    it('renders the layer over the grid, one target per control in the store state, in mapping mode', () => {
      const { fixture, midiStore } = render([]);
      midiStore.setMappingMode({ on: true });
      midiStore.setLearn({
        learn: { control: SPEED_A, phase: 'waiting', replacing: null, source: null },
      });
      fixture.detectChanges();

      const instance = layer(fixture).componentInstance as MappingOverlayLayerComponent;
      expect(instance.scope()).toBe(fixture.nativeElement.querySelector('.mixer-grid'));
      expect(instance.targets().map((t) => [t.id, t.state])).toEqual([
        ['A:speed', 'selected'],
        ['B:stop', 'selectable'],
      ]);
    });

    it('starts learning for the selected control and cancels learning on dismiss', () => {
      const { fixture, midi, midiStore } = render([]);
      midiStore.setMappingMode({ on: true });
      fixture.detectChanges();
      const instance = layer(fixture).componentInstance as MappingOverlayLayerComponent;

      instance.targetSelect.emit('B:stop');
      instance.dismiss.emit();

      expect(midi.learn.select).toHaveBeenCalledWith(STOP_B);
      expect(midi.learn.cancel).toHaveBeenCalledTimes(1);
    });

    it('ignores a target it does not know', () => {
      const { fixture, midi, midiStore } = render([]);
      midiStore.setMappingMode({ on: true });
      fixture.detectChanges();

      (layer(fixture).componentInstance as MappingOverlayLayerComponent).targetSelect.emit(
        'A:gone'
      );

      expect(midi.learn.select).not.toHaveBeenCalled();
    });
  });
});
