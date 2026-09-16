import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  DeckService,
  DeviceStore,
  DjStore,
  StorageStore,
  type DeckBindingSummary,
  type DeckTransportSummary,
} from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { DjMixerViewComponent } from './dj-mixer-view.component';
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
    portOptions: [],
    selectedPortId: null,
    portPlaceholder: '— MIDI not enabled —',
    portsEnabled: false,
    enableDisabled: false,
    identifyDisabled: true,
    errors: [],
  };
}

function createDjStoreStub() {
  return {
    transportSummary: () => signal(idleTransportSummary()),
    bindingSummary: () => signal(idleBindingSummary()),
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
    bindPort: vi.fn(),
    enableMidi: vi.fn(),
    identify: vi.fn(),
  };
}

function render(devices: unknown[], storageStoreOverrides: Record<string, unknown> = {}) {
  const storageStore = createStorageStoreStub(storageStoreOverrides);

  TestBed.configureTestingModule({
    imports: [DjMixerViewComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeviceStore, useValue: { devices: signal(devices) } },
      { provide: StorageStore, useValue: storageStore },
      { provide: DjStore, useValue: createDjStoreStub() },
      { provide: DeckService, useValue: createDeckServiceStub() },
    ],
  });

  const fixture: ComponentFixture<DjMixerViewComponent> =
    TestBed.createComponent(DjMixerViewComponent);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, storageStore };
}

function deckLetters(fixture: ComponentFixture<DjMixerViewComponent>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-deck]')).map((el) =>
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
      const { fixture, component } = render([]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
      expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
      expect(component.showCrossfader()).toBe(true);
    }, 10000);

    it('still renders exactly two deck columns with one enabled device', () => {
      const { fixture, component } = render([device()]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
      expect(component.showCrossfader()).toBe(true);
    });

    it('still renders exactly two deck columns with three enabled devices', () => {
      const { fixture, component } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);

      expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
      expect(deckLetters(fixture)).toEqual(['A', 'B']);
      expect(component.showCrossfader()).toBe(true);
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
});
