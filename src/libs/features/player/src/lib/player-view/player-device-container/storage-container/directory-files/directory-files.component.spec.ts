import { vi } from 'vitest';
import { of } from 'rxjs';
import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { StorageStore } from '@teensyrom-nx/application';
import type { IPlayerContext, LaunchedFile, PlayerFileContext } from '@teensyrom-nx/application';
import {
  STORAGE_SERVICE,
  StorageType,
  LaunchMode,
  type DirectoryItem,
  type FileItem,
} from '@teensyrom-nx/domain';
import { StorageItemComponent } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { createMockStorageService, createTestFileItem, createTestStorageDirectory } from '@teensyrom-nx/testing/fixtures';
import { DirectoryFilesComponent } from './directory-files.component';
import { FileItemComponent } from './file-item/file-item.component';

describe('DirectoryFilesComponent', () => {
  const deviceId = 'device-1';
  const directoryItem: DirectoryItem = { name: 'Games', path: '/games' };
  const fileItem: FileItem = createTestFileItem({
    name: 'test-file.sid',
    path: '/test-file.sid',
    storageType: StorageType.Sd,
  });

  beforeEach(() => {
    // The virtual scroll viewport calls Element.scrollTo internally; jsdom doesn't implement it.
    Element.prototype.scrollTo = vi.fn();
  });

  interface RenderOverrides {
    realChildren?: Type<unknown>[];
    /**
     * Full real-tree escape hatch, needed only for the auto-select-playing-file effect: it
     * gates on `this.viewport()`, a viewChild query for the real CdkVirtualScrollViewport, and
     * that directive needs its full real `*cdkVirtualFor` wiring (not just the class present)
     * to avoid throwing on its own internal scroll-position timers.
     */
    stubChildren?: boolean;
  }

  function render(playerContext: Partial<IPlayerContext> = {}, overrides: RenderOverrides = {}) {
    const result = renderPlayerComponent(DirectoryFilesComponent, {
      inputs: { deviceId },
      playerContext,
      realChildren: overrides.realChildren,
      stubChildren: overrides.stubChildren,
      providers: [
        {
          provide: STORAGE_SERVICE,
          useValue: createMockStorageService({
            getDirectory: vi
              .fn()
              .mockReturnValue(
                of(createTestStorageDirectory({ directories: [directoryItem], files: [fileItem] }))
              ),
          }),
        },
      ],
    });
    const storageStore = TestBed.inject(StorageStore);
    return { ...result, storageStore };
  }

  async function renderWithStorageLevelContent(
    playerContext: Partial<IPlayerContext> = {},
    overrides: RenderOverrides = {}
  ) {
    const rendered = render(playerContext, overrides);
    await rendered.storageStore.initializeStorage({ deviceId, storageType: StorageType.Sd });
    rendered.fixture.detectChanges();
    return rendered;
  }

  async function renderAtDeviceLevel() {
    const rendered = render();
    await rendered.storageStore.initializeStorage({ deviceId, storageType: StorageType.Sd });
    await rendered.storageStore.initializeStorage({ deviceId, storageType: StorageType.Usb });
    rendered.storageStore.navigateToDeviceLevel({ deviceId });
    rendered.fixture.detectChanges();
    return rendered;
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('combines directories and files into one tagged data source', async () => {
    const { component } = await renderWithStorageLevelContent();
    const combined = component.directoriesAndFiles();

    expect(combined).toHaveLength(2);
    expect(combined[0]).toHaveProperty('itemType', 'directory');
    expect(combined[1]).toHaveProperty('itemType', 'file');
  });

  it('discriminates directories from files with the type guard', async () => {
    const { component } = await renderWithStorageLevelContent();
    const [directory, file] = component.directoriesAndFiles();

    expect(component.isDirectory(directory)).toBe(true);
    expect(component.isDirectory(file)).toBe(false);
  });

  it('updates the selection when an item is clicked', async () => {
    const { component } = await renderWithStorageLevelContent();
    const [directory] = component.directoriesAndFiles();

    component.onItemSelected(directory);

    expect(component.selectedItem()).toEqual(directory);
  });

  it('navigates into a directory on double-click', async () => {
    const { component, storageStore } = await renderWithStorageLevelContent();
    const [directory] = component.directoriesAndFiles();
    const navigateToDirectory = vi
      .spyOn(storageStore, 'navigateToDirectory')
      .mockImplementation(async () => undefined);

    component.onDirectoryDoubleClick(directory as DirectoryItem);

    expect(navigateToDirectory).toHaveBeenCalledWith({
      deviceId,
      storageType: StorageType.Sd,
      path: directory.path,
    });
  });

  it('clears the selection when navigating into a directory', async () => {
    const { component, storageStore } = await renderWithStorageLevelContent();
    vi.spyOn(storageStore, 'navigateToDirectory').mockImplementation(async () => undefined);
    const [directory] = component.directoriesAndFiles();
    component.onItemSelected(directory);
    expect(component.selectedItem()).toBeTruthy();

    component.onDirectoryDoubleClick(directory as DirectoryItem);

    expect(component.selectedItem()).toBeNull();
  });

  it('launches a file via the player context on double-click', async () => {
    const launchFileWithContext = vi.fn().mockResolvedValue(undefined);
    const { component } = await renderWithStorageLevelContent({ launchFileWithContext });
    const [, file] = component.directoriesAndFiles();

    component.onFileDoubleClick(file as FileItem);

    expect(launchFileWithContext).toHaveBeenCalledWith({
      deviceId,
      storageType: StorageType.Sd,
      file,
      directoryPath: '/',
      files: expect.arrayContaining([fileItem]),
      launchMode: LaunchMode.Directory,
    });
  });

  it('launches a file when a real dblclick DOM event fires on the rendered file item', async () => {
    const launchFileWithContext = vi.fn().mockResolvedValue(undefined);
    const { fixture } = await renderWithStorageLevelContent(
      { launchFileWithContext },
      // Files are only rendered via the real `*cdkVirtualFor` directive.
      { realChildren: [ScrollingModule, FileItemComponent, StorageItemComponent] }
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('lib-storage-item')
      .dispatchEvent(new MouseEvent('dblclick'));

    expect(launchFileWithContext).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId, file: expect.objectContaining({ path: fileItem.path }) })
    );
  });

  it('reports selection state per item', async () => {
    const { component } = await renderWithStorageLevelContent();
    const [directory, file] = component.directoriesAndFiles();
    component.onItemSelected(directory);

    expect(component.isSelected(directory)).toBe(true);
    expect(component.isSelected(file)).toBe(false);
  });

  it('reflects the currently playing file from the player context', async () => {
    const currentFile = signal<LaunchedFile | null>(null);
    const { component, fixture } = await renderWithStorageLevelContent({
      getCurrentFile: vi.fn(() => currentFile.asReadonly()),
    });
    const [, file] = component.directoriesAndFiles() as [unknown, FileItem];

    expect(component.isCurrentlyPlaying(file)).toBe(false);

    currentFile.set({
      storageKey: 'device-1-SD',
      file,
      parentPath: '/',
      launchedAt: Date.now(),
      isCompatible: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCurrentlyPlaying(file)).toBe(true);
  });

  it('auto-selects the currently playing file once directory context is available', async () => {
    const currentFile = signal<LaunchedFile | null>(null);
    const fileContext = signal<PlayerFileContext | null>(null);
    const { component, fixture } = await renderWithStorageLevelContent(
      {
        getCurrentFile: vi.fn(() => currentFile.asReadonly()),
        getFileContext: vi.fn(() => fileContext.asReadonly()),
      },
      { stubChildren: false }
    );
    const [, file] = component.directoriesAndFiles() as [unknown, FileItem];

    currentFile.set({
      storageKey: 'device-1-SD',
      file,
      parentPath: '/',
      launchedAt: Date.now(),
      isCompatible: true,
    });
    fileContext.set({
      storageKey: 'device-1-SD',
      directoryPath: '/',
      files: [file],
      currentIndex: 0,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedItem()?.path).toBe(file.path);
  });

  describe('current-file error state', () => {
    it('reports no error by default', async () => {
      const { component } = await renderWithStorageLevelContent();
      expect(component.hasCurrentFileError()).toBe(false);
    });

    it('reports true when the player context has an error', async () => {
      const error = signal<string | null>('Launch failed: incompatible file');
      const { component } = await renderWithStorageLevelContent({
        getError: vi.fn(() => error.asReadonly()),
      });

      expect(component.hasCurrentFileError()).toBe(true);
    });
  });

  it('initializes the virtual scroll viewport with the configured item size', async () => {
    const { fixture } = await renderWithStorageLevelContent();
    const viewport = fixture.nativeElement.querySelector('cdk-virtual-scroll-viewport');

    expect(viewport.getAttribute('itemsize')).toBe('42');
  });

  describe('header slot', () => {
    it('renders the directory trail in the header slot at storage level', async () => {
      const { fixture } = await renderWithStorageLevelContent();

      const trail = fixture.nativeElement.querySelector('lib-directory-trail-container');
      expect(trail).toBeTruthy();
      expect(trail.closest('.header-toolbar')?.getAttribute('slot')).toBe('header');
    });

    it('omits the directory trail at device level', async () => {
      const { fixture } = await renderAtDeviceLevel();

      expect(fixture.nativeElement.querySelector('lib-directory-trail-container')).toBeNull();
    });

    it('shows a Storage Devices title at device level', async () => {
      const { fixture } = await renderAtDeviceLevel();

      expect(fixture.nativeElement.querySelector('.header-title')).toBeTruthy();
    });

    it('omits the title at storage level, since the trail replaces it', async () => {
      const { fixture } = await renderWithStorageLevelContent();

      expect(fixture.nativeElement.querySelector('.header-title')).toBeNull();
    });

    it('carries slot="header" on the header toolbar wrapper', async () => {
      const { fixture } = await renderWithStorageLevelContent();

      expect(fixture.nativeElement.querySelector('.header-toolbar[slot="header"]')).toBeTruthy();
    });

    it('renders the search toolbar at storage level', async () => {
      const { fixture } = await renderWithStorageLevelContent();

      expect(fixture.nativeElement.querySelector('lib-search-toolbar')).toBeTruthy();
    });

    it('renders the search toolbar at device level too', async () => {
      const { fixture } = await renderAtDeviceLevel();

      expect(fixture.nativeElement.querySelector('lib-search-toolbar')).toBeTruthy();
    });
  });

  describe('device-level view', () => {
    it('detects device-level view', async () => {
      const { component } = await renderAtDeviceLevel();
      expect(component.isDeviceLevelView()).toBe(true);
    });

    it('lists SD and USB storage devices', async () => {
      const { component } = await renderAtDeviceLevel();
      const devices = component.storageDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toMatchObject({
        name: 'SD Storage',
        storageType: StorageType.Sd,
        icon: 'sd_storage',
        deviceId,
        itemType: 'storage-device',
      });
      expect(devices[1]).toMatchObject({
        name: 'USB Storage',
        storageType: StorageType.Usb,
        icon: 'usb',
        deviceId,
        itemType: 'storage-device',
      });
    });

    it('is empty when not at device level', async () => {
      const { component } = await renderWithStorageLevelContent();
      expect(component.storageDevices()).toHaveLength(0);
    });

    it('selects a storage device on click', async () => {
      const { component } = await renderAtDeviceLevel();
      const [device] = component.storageDevices();

      component.onStorageDeviceSelected(device);

      const selected = component.selectedItem() as unknown as { storageType: StorageType };
      expect(selected?.storageType).toBe(StorageType.Sd);
    });

    it('navigates to the storage root and clears the selection on double-click', async () => {
      const { component, storageStore } = await renderAtDeviceLevel();
      const [device] = component.storageDevices();
      const navigateToDirectory = vi
        .spyOn(storageStore, 'navigateToDirectory')
        .mockImplementation(async () => undefined);

      component.onStorageDeviceDoubleClick(device);

      expect(navigateToDirectory).toHaveBeenCalledWith({
        deviceId,
        storageType: StorageType.Sd,
        path: '/',
      });
      expect(component.selectedItem()).toBeNull();
    });

    it('identifies the selected storage device', async () => {
      const { component } = await renderAtDeviceLevel();
      const devices = component.storageDevices();
      component.onStorageDeviceSelected(devices[0]);

      expect(component.isStorageDeviceSelected(devices[0])).toBe(true);
      expect(component.isStorageDeviceSelected(devices[1])).toBe(false);
    });
  });
});
