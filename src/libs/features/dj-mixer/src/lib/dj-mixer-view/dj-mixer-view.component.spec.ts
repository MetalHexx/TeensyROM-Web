import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { computed, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  AsidPlayerLauncher,
  DECK_CONTROL_IDS,
  DECK_SLOTS,
  SET_CONTROL_IDS,
  DeckService,
  DeviceStore,
  DjSets,
  DjStore,
  HOME_DECK_PANEL,
  MappableControls,
  MidiControllers,
  MidiLearn,
  MidiMappings,
  MidiMappingStore,
  MixerService,
  PlayheadPainter,
  SidPanelPainter,
  StorageStore,
  controlKey,
  type ControlIdentity,
  type DeckBindingSummary,
  type DeckLoopsSummary,
  type DeckSetSummary,
  type SetCardSummary,
  type SetTreeSummary,
  type DeckTransportSummary,
  type MappableControl,
} from '@teensyrom-nx/application';
import {
  MappingOverlayLayerComponent,
  ScalingCompactCardComponent,
  SlidingContainerComponent,
} from '@teensyrom-nx/ui/components';
import { FoldHandleComponent } from '@teensyrom-nx/ui/components/dj';
import { StorageType } from '@teensyrom-nx/domain';
import { DjMixerViewComponent } from './dj-mixer-view.component';
import { anchorFor } from '../mapping/control-anchors';
import { DjBindingsPanelComponent } from '../bindings-panel/dj-bindings-panel.component';
import { DjBrowseTreesComponent } from '../browse-trees/dj-browse-trees.component';
import { DjDirectoryListingComponent } from '../directory-listing/dj-directory-listing.component';
import { DjSetCardComponent } from '../set-card/dj-set-card.component';

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
    getSearchState: vi.fn(() => signal(null)),
    searchFiles: vi.fn().mockResolvedValue(undefined),
    clearSearch: vi.fn(),
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
    bar: { kind: 'unknown' },
    title: null,
    author: null,
    totalText: '--:--',
    subtuneText: 'Subtune 0 of 0',
    subtuneCompact: '–/–',
    subtuneDisabled: true,
    repeat: true,
    held: false,
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

const NO_LOOPS: DeckLoopsSummary = {
  hasTune: false,
  canAdd: false,
  canStop: false,
  items: [],
  selected: null,
};

/** A deck with one cue, selected: the only state that renders the Set End key. */
const SELECTED_CUE: DeckLoopsSummary = {
  hasTune: true,
  canAdd: true,
  canStop: false,
  items: [
    {
      id: 'm1',
      name: 'Item 1',
      kind: 'cue',
      lengthText: '',
      activity: 'idle',
      selected: true,
      ready: true,
      ownSettings: false,
      startPercent: 10,
      endPercent: null,
    },
  ],
  selected: {
    id: 'm1',
    name: 'Item 1',
    kind: 'cue',
    activity: 'idle',
    ready: true,
    sharesGlobal: true,
    wraps: false,
    spanText: '00:01.0',
    start: {
      offsetFrames: 0,
      rangeFrames: 0,
      tickPercents: [],
      canSnapPrevious: false,
      canSnapNext: false,
    },
    end: null,
  },
};

const NO_DECK_SET: DeckSetSummary = {
  available: false,
  positionText: '— / —',
  setName: '',
  canPrevious: false,
  canNext: false,
};

const EMPTY_SET: SetCardSummary = {
  ready: true,
  name: 'Set 1',
  placeholder: 'Set 1',
  rowCount: 0,
  save: 'saved',
  rows: [],
  selectedIndex: null,
  positionText: '— / —',
  realRowCount: 0,
  selectedRowIndex: null,
  selectedTitle: null,
  selectedAuthor: null,
  announcement: null,
};

const SAVED_SETS: SetTreeSummary = {
  sets: [
    { id: 's2', name: 'Friday', loaded: true },
    { id: 's1', name: 'Saturday', loaded: false },
  ],
};

function createDjStoreStub(
  loops: DeckLoopsSummary = NO_LOOPS,
  selectTurns = signal(0),
  save = signal<'saved' | 'saving' | 'failed'>('saved'),
  asidLaunching = signal(false)
) {
  return {
    sets: computed(() => ({ selectTurns: selectTurns(), save: save() })),
    setCardSummary: () => signal(EMPTY_SET),
    setTreeSummary: () => signal(SAVED_SETS),
    deckSetSummary: () => signal(NO_DECK_SET),
    transportSummary: () => signal(idleTransportSummary()),
    bindingSummary: () => signal(idleBindingSummary()),
    loopsSummary: () => signal(loops),
    settingsInPlay: () => signal({ markerId: null, name: 'Main' }),
    asidLaunching,
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
    keyMatch: () => signal('none'),
  };
}

function createMixerServiceStub() {
  return {
    setVoiceKnob: vi.fn(),
    setFilterKnob: vi.fn(),
    setKeySemitones: vi.fn(),
    pressWaveform: vi.fn(),
    pressSwitch: vi.fn(),
    pressFilterMode: vi.fn(),
    panic: vi.fn(),
    setKeyDisplayFormat: vi.fn(),
  };
}

function createSidPanelPainterStub() {
  return { attach: vi.fn(() => () => undefined) };
}

function createPlayheadPainterStub() {
  return { attach: vi.fn(() => () => undefined), pin: vi.fn() };
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
    loadSelected: vi.fn(),
    previousRow: vi.fn(),
    nextRow: vi.fn(),
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
  {
    reducedMotion = false,
    stacked = false,
    loops = NO_LOOPS,
  }: { reducedMotion?: boolean; stacked?: boolean; loops?: DeckLoopsSummary } = {}
) {
  const storageStore = createStorageStoreStub(storageStoreOverrides);
  const selectTurns = signal(0);
  const save = signal<'saved' | 'saving' | 'failed'>('saved');
  const djSets = { openSet: vi.fn().mockResolvedValue(undefined) };
  const launcher = { launch: vi.fn().mockResolvedValue(undefined) };
  const asidLaunching = signal(false);
  const midi = createMidiStubs();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usableDevices = signal(devices.filter((d: any) => d.isEnabled));

  TestBed.configureTestingModule({
    imports: [DjMixerViewComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeviceStore, useValue: { devices: signal(devices), usableDevices } },
      { provide: StorageStore, useValue: storageStore },
      { provide: DjStore, useValue: createDjStoreStub(loops, selectTurns, save, asidLaunching) },
      { provide: DeckService, useValue: createDeckServiceStub() },
      { provide: DjSets, useValue: djSets },
      { provide: AsidPlayerLauncher, useValue: launcher },
      { provide: MixerService, useValue: createMixerServiceStub() },
      { provide: SidPanelPainter, useValue: createSidPanelPainterStub() },
      { provide: PlayheadPainter, useValue: createPlayheadPainterStub() },
      { provide: MappableControls, useValue: midi.controls },
      { provide: MidiControllers, useValue: midi.controllers },
      { provide: MidiLearn, useValue: midi.learn },
      { provide: MidiMappings, useValue: midi.mappings },
      {
        provide: BreakpointObserver,
        useValue: {
          observe: (query: string) =>
            of({
              matches: query.includes('reduced-motion')
                ? reducedMotion
                : query.includes('max-width') && stacked,
              breakpoints: {},
            }),
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
    djSets,
    launcher,
    asidLaunching,
    selectTurns,
    save,
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
    it('renders exactly two deck columns, lettered A and B, and one SID panel with no enabled devices', () => {
      const { fixture } = render([]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
      expect(fixture.nativeElement.querySelectorAll('lib-dj-sid-panel').length).toBe(1);
    });

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

    it('shows the empty state in the listing slot only, keeping the tree and the set card, when no devices are enabled', () => {
      const { fixture } = render([device({ isEnabled: false })]);
      const band = fixture.debugElement.query(By.css('.bottom-band'));

      expect(bandEmptyState(fixture)).toBeTruthy();
      expect(band.queryAll(By.directive(DjDirectoryListingComponent)).length).toBe(0);
      expect(band.queryAll(By.directive(DjBrowseTreesComponent)).length).toBe(1);
      expect(band.queryAll(By.directive(DjSetCardComponent)).length).toBe(1);
      // The decks and the mixer always render, even with the listing slot in its empty state.
      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(fixture.nativeElement.querySelector('.mixer-grid')).toBeTruthy();
    });

    it('hides the empty state and shows tree, listing and set card once a device is enabled', () => {
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
      expect(band.queryAll(By.directive(DjSetCardComponent)).length).toBe(1);
    });

    it('orders the tree, the listing and the set card', () => {
      const { fixture } = render([device()]);

      const order = Array.from(
        fixture.nativeElement.querySelector('.bottom-band').children as HTMLCollection
      ).map((el) => el.className.split(' ')[0]);

      expect(order).toEqual(['browse-card', 'directory-listing-card', 'set-card']);
    });

    it('has the tree, the listing and the set card wait for the band to finish sliding in', () => {
      const { fixture } = render([device()]);
      const cards = fixture.debugElement
        .query(By.css('.bottom-band'))
        .queryAll(By.directive(ScalingCompactCardComponent))
        .map((el) => el.componentInstance as ScalingCompactCardComponent);

      expect(cards.length).toBe(3);
      expect(cards.map((card) => card.animationParent())).toEqual(['auto', 'auto', 'auto']);
    });
  });

  describe('the Sets branch', () => {
    function trees(fixture: ComponentFixture<DjMixerViewComponent>): DjBrowseTreesComponent {
      return fixture.debugElement.query(By.directive(DjBrowseTreesComponent))
        .componentInstance as DjBrowseTreesComponent;
    }

    it('passes the saved sets, the loaded one lit in its name', () => {
      const { fixture } = render([]);

      expect(trees(fixture).sets()).toEqual({
        label: 'Sets',
        sets: [
          { id: 's2', name: 'Friday', loaded: true, accessibleName: 'Set Friday, loaded' },
          { id: 's1', name: 'Saturday', loaded: false, accessibleName: 'Set Saturday' },
        ],
      });
    });

    it('opens the chosen set', () => {
      const { fixture, djSets } = render([]);

      trees(fixture).setSelect.emit('s1');

      expect(djSets.openSet).toHaveBeenCalledWith('s1');
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

    it('lets the set card accept a listing drag only while one is in flight', () => {
      const { fixture } = render([device({ deviceId: 'a' })]);
      const listing = fixture.debugElement.query(By.directive(DjDirectoryListingComponent))
        .componentInstance as DjDirectoryListingComponent;
      const card = () =>
        fixture.debugElement.query(By.directive(DjSetCardComponent))
          .componentInstance as DjSetCardComponent;

      expect(card().listingDragActive()).toBe(false);

      listing.dragStarted.emit();
      fixture.detectChanges();
      expect(card().listingDragActive()).toBe(true);

      listing.dragEnded.emit();
      fixture.detectChanges();
      expect(card().listingDragActive()).toBe(false);
    });
  });

  describe('the set row drag bridge', () => {
    function cards(fixture: ComponentFixture<DjMixerViewComponent>): DjSetCardComponent[] {
      return fixture.debugElement
        .queryAll(By.directive(DjSetCardComponent))
        .map((el) => el.componentInstance as DjSetCardComponent);
    }

    function overlays(fixture: ComponentFixture<DjMixerViewComponent>): number {
      return fixture.nativeElement.querySelectorAll('.drop-overlay').length;
    }

    it('lights every deck overlay while a row is dragged and clears them when it ends', () => {
      const { fixture, component } = render([device()]);

      cards(fixture)[0].rowDragStart.emit();
      fixture.detectChanges();
      expect(component.rowDragging()).toBe(true);
      expect(overlays(fixture)).toBe(2);

      cards(fixture)[0].rowDragEnd.emit();
      fixture.detectChanges();
      expect(component.rowDragging()).toBe(false);
      expect(overlays(fixture)).toBe(0);
    });

    it("does not light the set card's listing drop state, nor does a listing drag raise rowDragging", () => {
      const { fixture, component } = render([device()]);
      const listing = fixture.debugElement.query(By.directive(DjDirectoryListingComponent))
        .componentInstance as DjDirectoryListingComponent;

      cards(fixture)[0].rowDragStart.emit();
      fixture.detectChanges();
      expect(component.dragging()).toBe(false);
      expect(cards(fixture)[0].listingDragActive()).toBe(false);

      cards(fixture)[0].rowDragEnd.emit();
      listing.dragStarted.emit();
      fixture.detectChanges();
      expect(component.rowDragging()).toBe(false);
    });

    it('clears rowDragging when the browser is toggled mid-drag, either way', () => {
      const { fixture, component } = render([device()]);

      component.onRowDragStart();
      component.toggleBrowser();
      expect(component.rowDragging()).toBe(false);

      component.onRowDragStart();
      component.toggleBrowser();
      fixture.detectChanges();
      expect(component.rowDragging()).toBe(false);
    });
  });

  describe('the ASID launch button', () => {
    const asidButton = (fixture: ComponentFixture<DjMixerViewComponent>): HTMLButtonElement =>
      fixture.nativeElement.querySelector('lib-dj-sid-panel .asid-button button');

    it('calls the launcher when pressed', () => {
      const { fixture, launcher } = render([]);

      asidButton(fixture).click();

      expect(launcher.launch).toHaveBeenCalledTimes(1);
    });

    it("disables the button while the store's launching flag is set", () => {
      const { fixture, asidLaunching } = render([]);
      expect(asidButton(fixture).disabled).toBe(false);

      asidLaunching.set(true);
      fixture.detectChanges();

      expect(asidButton(fixture).disabled).toBe(true);
    });
  });

  describe('hiding the browser', () => {
    function browserButton(fixture: ComponentFixture<DjMixerViewComponent>): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        'lib-dj-sid-panel button[aria-label$="the browser"]'
      );
    }

    function press(fixture: ComponentFixture<DjMixerViewComponent>): void {
      browserButton(fixture).click();
      fixture.detectChanges();
    }

    function slot(fixture: ComponentFixture<DjMixerViewComponent>): SlidingContainerComponent {
      return fixture.debugElement.query(By.css('.bottom-slot'))
        .componentInstance as SlidingContainerComponent;
    }

    const grid = (fixture: ComponentFixture<DjMixerViewComponent>): HTMLElement =>
      fixture.nativeElement.querySelector('.mixer-grid');

    it('shows the browser at first, with the button lit and offering to hide it', () => {
      const { fixture, component } = render([device()]);

      expect(component.browserShown()).toBe(true);
      expect(slot(fixture).animationTrigger()).toBe(true);
      expect(fixture.nativeElement.querySelector('.bottom-band')).toBeTruthy();
      expect(browserButton(fixture).getAttribute('aria-label')).toBe('Hide the browser');
    });

    it('slides the band out from the button', () => {
      const { fixture } = render([device()]);

      press(fixture);

      expect(slot(fixture).animationTrigger()).toBe(false);
      expect(browserButton(fixture).getAttribute('aria-label')).toBe('Show the browser');
    });

    it('drops the band from the grid once the exit has finished', async () => {
      const { fixture } = render([device()]);

      press(fixture);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.bottom-band')).toBeNull();
      expect(grid(fixture).classList).toContain('mixer-grid--no-browser');
    });

    it('restores the grid before the entry begins, and does not drop it again after the entry', async () => {
      const { fixture, component } = render([device()]);
      press(fixture);
      await fixture.whenStable();
      fixture.detectChanges();

      browserButton(fixture).click();

      expect(component.browserCollapsed()).toBe(false);
      expect(component.browserShown()).toBe(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(grid(fixture).classList).not.toContain('mixer-grid--no-browser');
      expect(fixture.nativeElement.querySelector('.bottom-band')).toBeTruthy();
    });

    it('ignores the finish of an entry', () => {
      const { component } = render([device()]);

      component.onBandAnimationComplete();

      expect(component.browserCollapsed()).toBe(false);
    });

    it('slides for 400ms, and not at all for reduced motion', () => {
      const normal = render([device()]);
      expect(slot(normal.fixture).animationDuration()).toBe(400);
      expect(slot(normal.fixture).containerHeight()).toBe('100%');
      TestBed.resetTestingModule();

      const reduced = render([device()], {}, { reducedMotion: true });
      expect(slot(reduced.fixture).animationDuration()).toBe(0);
    });
  });

  describe('folding the file listing', () => {
    const card = (fixture: ComponentFixture<DjMixerViewComponent>): HTMLElement =>
      fixture.nativeElement.querySelector('.directory-listing-card');
    const body = (fixture: ComponentFixture<DjMixerViewComponent>): HTMLElement =>
      fixture.nativeElement.querySelector('.listing-body');
    const handle = (fixture: ComponentFixture<DjMixerViewComponent>): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector('lib-fold-handle button');
    const bandStyle = (fixture: ComponentFixture<DjMixerViewComponent>, name: string): string =>
      fixture.nativeElement.querySelector('.bottom-band').style.getPropertyValue(name);

    /** jsdom has no TransitionEvent, so the one property the view reads is put on a plain event. */
    const transitionEnd = (propertyName: string, bubbles = false): Event =>
      Object.assign(new Event('transitionend', { bubbles }), { propertyName });

    function finishFold(fixture: ComponentFixture<DjMixerViewComponent>): void {
      card(fixture).dispatchEvent(transitionEnd('flex-basis'));
      fixture.detectChanges();
    }

    it('offers a handle named for the state once a device is enabled, first inside the card', () => {
      const { fixture } = render([device()]);

      expect(handle(fixture)?.getAttribute('aria-label')).toBe('Collapse the file listing');
      expect(card(fixture).querySelector('lib-fold-handle')?.nextElementSibling).toBe(
        body(fixture)
      );
    });

    it('offers no handle without a device', () => {
      const { fixture } = render([]);

      expect(fixture.nativeElement.querySelector('lib-fold-handle')).toBeNull();
    });

    it('folds the card and makes the listing inert, and unfolds both again', () => {
      const { fixture, component } = render([device()]);

      handle(fixture)?.click();
      fixture.detectChanges();

      expect(component.listingFolded()).toBe(true);
      expect(card(fixture).classList).toContain('directory-listing-card--folded');
      expect(body(fixture).hasAttribute('inert')).toBe(true);
      expect(handle(fixture)?.getAttribute('aria-label')).toBe('Expand the file listing');
      expect(handle(fixture)?.getAttribute('aria-expanded')).toBe('false');

      component.foldListing(false);
      fixture.detectChanges();

      expect(card(fixture).classList).not.toContain('directory-listing-card--folded');
      expect(body(fixture).hasAttribute('inert')).toBe(false);
      expect(handle(fixture)?.getAttribute('aria-expanded')).toBe('true');
    });

    it('keeps the listing instance alive across a fold', () => {
      const { fixture, component } = render([device()]);
      const before = fixture.debugElement.query(By.directive(DjDirectoryListingComponent));

      component.foldListing(true);
      fixture.detectChanges();
      component.foldListing(false);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(DjDirectoryListingComponent))).toBe(before);
    });

    it('is not folded, hidden or inert when stacked, whatever was chosen, and has no handle', () => {
      const { fixture, component } = render([device()], {}, { stacked: true });

      component.foldListing(true);
      fixture.detectChanges();

      expect(component.listingFolded()).toBe(true);
      expect(component.listingFoldedEffective()).toBe(false);
      expect(card(fixture).classList).not.toContain('directory-listing-card--folded');
      expect(body(fixture).hasAttribute('inert')).toBe(false);
      expect(body(fixture).style.width).toBe('');
      expect(fixture.nativeElement.querySelector('lib-fold-handle')).toBeNull();
    });

    it('opens on choosing a storage, but not on choosing a set', () => {
      const { fixture, component } = render([device()]);
      component.foldListing(true);

      component.onSetSelect('s1');
      expect(component.listingFolded()).toBe(true);

      component.onStorageSelect({ deviceId: 'device-a', storageType: StorageType.Usb });
      fixture.detectChanges();

      expect(component.listingFolded()).toBe(false);
      expect(card(fixture).classList).not.toContain('directory-listing-card--folded');
    });

    it('survives hiding and showing the browser', () => {
      const { component } = render([device()]);
      component.foldListing(true);

      component.toggleBrowser();
      component.toggleBrowser();

      expect(component.listingFolded()).toBe(true);
    });

    it('hands the handle and the band the fold duration, none for reduced motion', () => {
      const handleOf = (fixture: ComponentFixture<DjMixerViewComponent>) =>
        fixture.debugElement.query(By.directive(FoldHandleComponent))
          .componentInstance as FoldHandleComponent;
      const normal = render([device()]);
      expect(handleOf(normal.fixture).animationDuration()).toBe(400);
      expect(bandStyle(normal.fixture, '--fold-duration')).toBe('400ms');
      TestBed.resetTestingModule();

      const reduced = render([device()], {}, { reducedMotion: true });
      expect(handleOf(reduced.fixture).animationDuration()).toBe(0);
      expect(bandStyle(reduced.fixture, '--fold-duration')).toBe('0ms');
    });

    describe('the mapping overlays', () => {
      function targets(fixture: ComponentFixture<DjMixerViewComponent>) {
        return (
          fixture.debugElement.query(By.directive(MappingOverlayLayerComponent))
            .componentInstance as MappingOverlayLayerComponent
        ).targets();
      }

      it('measure again when the card finishes its own width transition, and not before', async () => {
        const { fixture, component, midiStore } = render([device()]);
        midiStore.setMappingMode({ on: true });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const before = targets(fixture);

        component.foldListing(true);
        fixture.detectChanges();
        expect(targets(fixture)).toBe(before);

        body(fixture).dispatchEvent(transitionEnd('flex-basis', true));
        fixture.detectChanges();
        expect(targets(fixture)).toBe(before);

        finishFold(fixture);
        expect(targets(fixture)).not.toBe(before);
      });

      it('measure again at once when there is no motion to wait for', async () => {
        const { fixture, component, midiStore } = render([device()], {}, { reducedMotion: true });
        midiStore.setMappingMode({ on: true });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const before = targets(fixture);

        component.foldListing(true);
        fixture.detectChanges();

        expect(targets(fixture)).not.toBe(before);
      });
    });
  });

  describe('the set peek', () => {
    function peek(fixture: ComponentFixture<DjMixerViewComponent>): Element | null {
      return fixture.nativeElement.querySelector('.mixer-grid > .set-peek');
    }

    function peekSlot(fixture: ComponentFixture<DjMixerViewComponent>): SlidingContainerComponent {
      return fixture.debugElement.query(By.css('.set-peek lib-sliding-container'))
        .componentInstance as SlidingContainerComponent;
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function selectWhile(hidden: boolean, ctx: ReturnType<typeof render>, turns: number): void {
      if (hidden && ctx.component.browserShown()) ctx.component.toggleBrowser();
      ctx.selectTurns.set(turns);
      ctx.fixture.detectChanges();
    }

    it('is not created until a Select press while the browser is hidden', () => {
      const ctx = render([device()]);

      selectWhile(false, ctx, 1);

      expect(peek(ctx.fixture)).toBeNull();
      expect(ctx.component.peekShown()).toBe(false);
    });

    it('slides up inside the grid when Select is pressed while the browser is hidden', () => {
      const ctx = render([device()]);

      selectWhile(true, ctx, 1);

      expect(ctx.component.peekShown()).toBe(true);
      expect(peek(ctx.fixture)).toBeTruthy();
      expect(peekSlot(ctx.fixture).animationTrigger()).toBe(true);
      expect(peekSlot(ctx.fixture).containerHeight()).toBe('100%');
      expect(peek(ctx.fixture)?.querySelector('lib-dj-set-card')).toBeTruthy();
    });

    it('leaves 1.5s after the last press, each press restarting the wait', () => {
      const ctx = render([device()]);
      selectWhile(true, ctx, 1);

      vi.advanceTimersByTime(1000);
      selectWhile(true, ctx, 2);
      vi.advanceTimersByTime(1000);
      expect(ctx.component.peekShown()).toBe(true);

      vi.advanceTimersByTime(500);
      expect(ctx.component.peekShown()).toBe(false);
    });

    it('holds while a row is dragged from it and goes 1.5s after the drag ends', () => {
      const ctx = render([device()]);
      selectWhile(true, ctx, 1);
      const peekCard = ctx.fixture.debugElement.query(By.css('.set-peek lib-dj-set-card'))
        .componentInstance as DjSetCardComponent;

      peekCard.rowDragStart.emit();
      vi.advanceTimersByTime(5000);
      expect(ctx.component.peekShown()).toBe(true);

      peekCard.rowDragEnd.emit();
      vi.advanceTimersByTime(1400);
      expect(ctx.component.peekShown()).toBe(true);
      vi.advanceTimersByTime(100);
      expect(ctx.component.peekShown()).toBe(false);
    });

    it('holds through a Select press during a row drag and goes 1.5s after the drag ends', () => {
      const ctx = render([device()]);
      selectWhile(true, ctx, 1);

      ctx.component.onRowDragStart();
      selectWhile(true, ctx, 2);
      vi.advanceTimersByTime(5000);
      expect(ctx.component.peekShown()).toBe(true);

      ctx.component.onRowDragEnd();
      vi.advanceTimersByTime(1400);
      expect(ctx.component.peekShown()).toBe(true);
      vi.advanceTimersByTime(100);
      expect(ctx.component.peekShown()).toBe(false);
    });

    it('is not raised by a row drag that ends while it is down', () => {
      const ctx = render([device()]);

      ctx.component.onRowDragStart();
      ctx.component.onRowDragEnd();

      expect(ctx.component.peekShown()).toBe(false);
    });

    it('is raised by a save that fails while the browser is hidden, and says so', () => {
      const ctx = render([device()]);
      ctx.component.toggleBrowser();

      ctx.save.set('failed');
      ctx.fixture.detectChanges();

      expect(ctx.component.peekShown()).toBe(true);
      expect(ctx.fixture.nativeElement.querySelector('.hidden-save-notice').textContent).toContain(
        'not saved'
      );
    });

    it('is not raised by a save that fails while the browser is shown', () => {
      const ctx = render([device()]);

      ctx.save.set('failed');
      ctx.fixture.detectChanges();

      expect(ctx.component.peekShown()).toBe(false);
      expect(
        ctx.fixture.nativeElement.querySelector('.hidden-save-notice').textContent.trim()
      ).toBe('');
    });

    it('is put away at once when the browser is shown', () => {
      const ctx = render([device()]);
      selectWhile(true, ctx, 1);

      ctx.component.toggleBrowser();

      expect(ctx.component.peekShown()).toBe(false);
    });

    it('does not show for a press made while the browser was shown', () => {
      const ctx = render([device()]);
      selectWhile(false, ctx, 1);

      ctx.component.toggleBrowser();
      ctx.fixture.detectChanges();

      expect(ctx.component.peekShown()).toBe(false);
    });

    it('slides for no time under reduced motion', () => {
      const ctx = render([device()], {}, { reducedMotion: true });
      selectWhile(true, ctx, 1);

      expect(peekSlot(ctx.fixture).animationDuration()).toBe(0);
    });
  });

  describe('the bindings panel', () => {
    function bindingsButton(fixture: ComponentFixture<DjMixerViewComponent>): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        'lib-dj-sid-panel button[aria-label$="bindings panel"]'
      );
    }

    function press(fixture: ComponentFixture<DjMixerViewComponent>): void {
      bindingsButton(fixture).click();
      fixture.detectChanges();
    }

    function slot(fixture: ComponentFixture<DjMixerViewComponent>): SlidingContainerComponent {
      return fixture.debugElement.query(By.css('.panel-slot'))
        .componentInstance as SlidingContainerComponent;
    }

    it('shows neither the panel nor its container before it is first opened', () => {
      const { fixture, component } = render([]);

      expect(component.panelOpen()).toBe(false);
      expect(fixture.nativeElement.querySelector('.panel-slot')).toBeNull();
      expect(fixture.nativeElement.querySelector('lib-dj-bindings-panel')).toBeNull();
      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Open bindings panel');
    });

    it('opens the panel from the SID panel and closes it from the same button', () => {
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
    // Set End lives in a selected cue's End slot, so no element exists with nothing or a loop selected.
    const ONLY_WITH_A_CUE: readonly string[] = ['loop-set-end'];
    const ALL_IDENTITIES: readonly ControlIdentity[] = DECK_SLOTS.flatMap((owner) =>
      DECK_CONTROL_IDS.filter((control) => !ONLY_WITH_A_CUE.includes(control)).map(
        (control): ControlIdentity => ({ owner, control })
      )
    );

    it('finds every mappable control as exactly one element in the rendered grid', () => {
      const { fixture } = render([]);
      const grid: HTMLElement = fixture.nativeElement.querySelector('.mixer-grid');

      const mismatched = ALL_IDENTITIES.map((identity) => ({
        identity: controlKey(identity),
        matches: grid.querySelectorAll(anchorFor(identity)).length,
      }))
        .filter(({ matches }) => matches !== 1)
        .map(({ identity, matches }) => ({ identity, matches }));

      expect(ALL_IDENTITIES).toHaveLength(162);
      expect(mismatched).toEqual([]);
    });

    it('finds each set control as exactly one element, with or without devices', () => {
      for (const devices of [[], [device()]]) {
        const { fixture } = render(devices);
        const grid: HTMLElement = fixture.nativeElement.querySelector('.mixer-grid');

        const matches = SET_CONTROL_IDS.map(
          (control) => grid.querySelectorAll(anchorFor({ owner: 'set', control })).length
        );

        expect(matches).toEqual([1, 1, 1]);
        TestBed.resetTestingModule();
      }
    });

    it("finds each deck's Set End key as exactly one element once a cue is selected", () => {
      const { fixture } = render([], {}, { loops: SELECTED_CUE });
      const grid: HTMLElement = fixture.nativeElement.querySelector('.mixer-grid');

      const matches = DECK_SLOTS.map(
        (owner) => grid.querySelectorAll(anchorFor({ owner, control: 'loop-set-end' })).length
      );

      expect(matches).toEqual([1, 1]);
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

    it('asks the layer to measure again once the band has finished sliding', () => {
      const { fixture, component, midiStore } = render([]);
      midiStore.setMappingMode({ on: true });
      fixture.detectChanges();
      const instance = layer(fixture).componentInstance as MappingOverlayLayerComponent;
      const before = instance.targets();

      component.onBandAnimationComplete();
      fixture.detectChanges();

      expect(instance.targets()).not.toBe(before);
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
