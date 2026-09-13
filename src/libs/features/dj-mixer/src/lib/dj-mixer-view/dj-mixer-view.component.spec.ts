import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { DeviceStore, DjStore, StorageStore, type DjFileEntry } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { DjMixerViewComponent } from './dj-mixer-view.component';
import { DjBrowseTreesComponent } from '../browse-trees/dj-browse-trees.component';
import { DjDirectoryListingComponent } from '../directory-listing/dj-directory-listing.component';
import { DjDeckColumnComponent } from '../deck-column/dj-deck-column.component';
import type { DjFileDragPayload } from '../drag/dj-file-drag';

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

function createDjStoreStub(overrides: Record<string, unknown> = {}) {
  return {
    retrieveFile: vi.fn().mockResolvedValue(undefined),
    getFile: vi.fn(() => signal(undefined)),
    ...overrides,
  };
}

function render(
  devices: unknown[],
  storageStoreOverrides: Record<string, unknown> = {},
  djStoreOverrides: Record<string, unknown> = {}
) {
  const storageStore = createStorageStoreStub(storageStoreOverrides);
  const djStore = createDjStoreStub(djStoreOverrides);

  TestBed.configureTestingModule({
    imports: [DjMixerViewComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeviceStore, useValue: { devices: signal(devices) } },
      { provide: StorageStore, useValue: storageStore },
      { provide: DjStore, useValue: djStore },
    ],
  });

  const fixture: ComponentFixture<DjMixerViewComponent> =
    TestBed.createComponent(DjMixerViewComponent);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, storageStore, djStore };
}

function deckLetters(fixture: ComponentFixture<DjMixerViewComponent>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-deck]')).map((el) =>
    (el as HTMLElement).getAttribute('data-deck')
  ) as string[];
}

function mixerGrid(fixture: ComponentFixture<DjMixerViewComponent>): HTMLElement {
  return fixture.nativeElement.querySelector('.mixer-grid');
}

/** Splits a `grid-template-areas` value into its rows, each row into its named cells. */
function parseGridAreaRows(areas: string): string[][] {
  return (areas.match(/"[^"]*"/g) ?? []).map((row) => row.slice(1, -1).split(' '));
}

describe('DjMixerViewComponent', () => {
  it('renders one deck column per enabled device, lettered in store order, plus a mixer card', () => {
    const { fixture, component } = render([
      device({ deviceId: 'a' }),
      device({ deviceId: 'b' }),
      device({ deviceId: 'c' }),
    ]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(3);
    expect(deckLetters(fixture)).toEqual(['A', 'B', 'C']);
    expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    expect(component.showCrossfader()).toBe(true);
    expect(component.isMany()).toBe(true);
  });

  it('filters out disabled devices, keeping the enabled-list positions contiguous', () => {
    const { fixture, component } = render([
      device({ deviceId: 'a' }),
      device({ deviceId: 'b', isEnabled: false }),
      device({ deviceId: 'c' }),
    ]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
    expect(deckLetters(fixture)).toEqual(['A', 'B']);
    expect(component.showCrossfader()).toBe(true);
    expect(component.isMany()).toBe(false);
  });

  it('renders a single column and mixer card with no crossfader when only one device is enabled', () => {
    const { fixture, component } = render([device()]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(1);
    expect(deckLetters(fixture)).toEqual(['A']);
    expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    expect(component.showCrossfader()).toBe(false);
  });

  it('renders the empty state and no mixer grid when no devices are enabled', () => {
    const { fixture } = render([device({ isEnabled: false })]);

    const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
    expect(emptyState).toBeTruthy();
    expect(emptyState.querySelector('.empty-state-title')?.textContent?.trim()).toBe(
      'No Enabled Devices'
    );
    expect(fixture.nativeElement.querySelector('.mixer-grid')).toBeNull();
  });

  describe('grid modifier classes', () => {
    it('carries mixer-grid--one for a single enabled device', () => {
      const { fixture } = render([device()]);
      const classes = mixerGrid(fixture).classList;

      expect(classes.contains('mixer-grid--one')).toBe(true);
      expect(classes.contains('mixer-grid--two')).toBe(false);
      expect(classes.contains('mixer-grid--many')).toBe(false);
    });

    it('carries mixer-grid--two for two enabled devices', () => {
      const { fixture } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);
      const classes = mixerGrid(fixture).classList;

      expect(classes.contains('mixer-grid--one')).toBe(false);
      expect(classes.contains('mixer-grid--two')).toBe(true);
      expect(classes.contains('mixer-grid--many')).toBe(false);
    });

    it('carries mixer-grid--many for three or more enabled devices', () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);
      const classes = mixerGrid(fixture).classList;

      expect(classes.contains('mixer-grid--one')).toBe(false);
      expect(classes.contains('mixer-grid--two')).toBe(false);
      expect(classes.contains('mixer-grid--many')).toBe(true);
    });
  });

  describe('the --many inline grid-template-areas', () => {
    it('leaves no inline grid-template-areas for one deck — the mixin owns that form', () => {
      const { fixture } = render([device()]);

      expect(mixerGrid(fixture).style.gridTemplateAreas).toBe('');
    });

    it('leaves no inline grid-template-areas for two decks — the mixin owns that form', () => {
      const { fixture } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);

      expect(mixerGrid(fixture).style.gridTemplateAreas).toBe('');
    });

    it("gives every deck one stack row beside that deck's own voice/speed column", () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);
      const rows = parseGridAreaRows(mixerGrid(fixture).style.gridTemplateAreas);

      for (let deck = 0; deck < 3; deck++) {
        const matches = rows.filter((row) => row[0] === `d${deck}`);
        expect(matches).toHaveLength(1);
        expect(matches[0][1]).toBe(`vs${deck}`);
      }
    });

    it('places the mixer band in exactly one row, spanning both columns, right after the first deck', () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);
      const rows = parseGridAreaRows(mixerGrid(fixture).style.gridTemplateAreas);

      const mxRows = rows.filter((row) => row[0] === 'mx');
      expect(mxRows).toHaveLength(1);
      expect(mxRows[0]).toEqual(['mx', 'mx']);
      expect(rows.indexOf(mxRows[0])).toBe(1); // after deck 0's single stack row
    });

    it('places the bottom band in exactly one row, as the last row, at three decks', () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);
      const rows = parseGridAreaRows(mixerGrid(fixture).style.gridTemplateAreas);

      const bottomRows = rows.filter((row) => row[0] === 'bottom');
      expect(bottomRows).toHaveLength(1);
      expect(bottomRows[0]).toEqual(['bottom', 'bottom']);
      expect(rows.indexOf(bottomRows[0])).toBe(rows.length - 1);
    });
  });

  describe('the bottom band', () => {
    function expectBrowseAndDirectoryListingContainers(
      fixture: ComponentFixture<DjMixerViewComponent>
    ): void {
      const band = fixture.debugElement.query(By.css('.bottom-band'));

      expect(band.queryAll(By.directive(DjBrowseTreesComponent)).length).toBe(1);
      expect(band.queryAll(By.directive(DjDirectoryListingComponent)).length).toBe(1);
      // The placeholder cards carried headings; the compact cards that replaced them carry none.
      expect(band.nativeElement.querySelector('.card-title, .scaling-card-title')).toBeNull();
    }

    it('renders the browse trees and directory listing containers at one enabled device', () => {
      const { fixture } = render([device()]);
      expectBrowseAndDirectoryListingContainers(fixture);
    });

    it('renders the browse trees and directory listing containers at two enabled devices', () => {
      const { fixture } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);
      expectBrowseAndDirectoryListingContainers(fixture);
    });

    it('renders the browse trees and directory listing containers at three-plus enabled devices', () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);
      expectBrowseAndDirectoryListingContainers(fixture);
    });

    it('passes the enabled devices and the active storage through to the browse trees container', () => {
      const { fixture, component } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);

      const browseTrees = fixture.debugElement.query(By.directive(DjBrowseTreesComponent))
        .componentInstance as DjBrowseTreesComponent;

      expect(browseTrees.devices()).toEqual(component.enabledDevices());
      expect(browseTrees.activeStorage()).toEqual(component.activeStorage());
    });

    it('passes the active storage through to the directory listing container', () => {
      const { fixture, component } = render([device()]);

      const listing = fixture.debugElement.query(By.directive(DjDirectoryListingComponent))
        .componentInstance as DjDirectoryListingComponent;

      expect(listing.activeStorage()).toEqual(component.activeStorage());
    });
  });

  describe('the --many host scroll class', () => {
    it('withholds dj-mixer-view--many below three decks', () => {
      const { fixture } = render([device({ deviceId: 'a' }), device({ deviceId: 'b' })]);

      expect(fixture.nativeElement.classList.contains('dj-mixer-view--many')).toBe(false);
    });

    it('adds dj-mixer-view--many to the host once three or more decks stack permanently', () => {
      const { fixture } = render([
        device({ deviceId: 'a' }),
        device({ deviceId: 'b' }),
        device({ deviceId: 'c' }),
      ]);

      expect(fixture.nativeElement.classList.contains('dj-mixer-view--many')).toBe(true);
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

  describe('the SID drag and drop bridge', () => {
    function fileDragPayload(overrides: Partial<DjFileDragPayload> = {}): DjFileDragPayload {
      return {
        deviceId: 'a',
        storageType: StorageType.Sd,
        path: '/song.sid',
        fileName: 'song.sid',
        ...overrides,
      };
    }

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

    it('dispatches retrieveFile with the dragged key, then alerts a resolved string carrying the filename', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      // A 'failed' entry formats synchronously (no SHA-256 hashing), keeping this test clear of
      // Web Crypto availability in the test environment while still exercising both awaits.
      const entry: DjFileEntry = {
        deviceId: 'a',
        storageType: StorageType.Sd,
        path: '/song.sid',
        fileName: 'song.sid',
        status: 'failed',
        bytes: null,
        byteLength: null,
        error: 'boom',
      };
      const { fixture, djStore } = render([device({ deviceId: 'a' })], {}, {
        getFile: vi.fn(() => signal(entry)),
      });

      const deckColumn = fixture.debugElement.query(By.directive(DjDeckColumnComponent))
        .componentInstance as DjDeckColumnComponent;

      deckColumn.fileDropped.emit(fileDragPayload());

      await vi.waitFor(() => {
        expect(djStore.retrieveFile).toHaveBeenCalledWith({
          deviceId: 'a',
          storageType: StorageType.Sd,
          path: '/song.sid',
        });
      });
      await vi.waitFor(() => expect(alertSpy).toHaveBeenCalled());

      const [alerted] = alertSpy.mock.calls[0];
      expect(typeof alerted).toBe('string');
      expect(alerted).toContain('song.sid');

      alertSpy.mockRestore();
    });
  });
});
