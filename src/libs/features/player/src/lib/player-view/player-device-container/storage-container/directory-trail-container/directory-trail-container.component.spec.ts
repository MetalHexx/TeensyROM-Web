import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StorageStore } from '@teensyrom-nx/application';
import { StorageType, STORAGE_SERVICE } from '@teensyrom-nx/domain';
import { DirectoryTrailComponent } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { createMockStorageService } from '@teensyrom-nx/testing/fixtures';
import { DirectoryTrailContainerComponent } from './directory-trail-container.component';

describe('DirectoryTrailContainerComponent', () => {
  const deviceId = 'test-device';

  function render(options: { realChildren?: (typeof DirectoryTrailComponent)[] } = {}) {
    const result = renderPlayerComponent(DirectoryTrailContainerComponent, {
      inputs: { deviceId },
      providers: [{ provide: STORAGE_SERVICE, useValue: createMockStorageService() }],
      realChildren: options.realChildren,
    });
    const storageStore = TestBed.inject(StorageStore);
    return { ...result, storageStore };
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('reads the selected directory state straight from the store', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });

    expect(component.selectedDirectoryState()).toEqual(
      storageStore.getSelectedDirectoryState(deviceId)()
    );
  });

  it('computes currentPath from the selected directory state', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });

    expect(component.currentPath()).toBe('/games/arcade');
  });

  it('labels SD storage as SD Card', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });

    expect(component.storageTypeLabel()).toBe('SD Card');
  });

  it('labels USB storage as USB Drive', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Usb, path: '/files' });

    expect(component.storageTypeLabel()).toBe('USB Drive');
  });

  it('allows navigating up once a storage type is selected', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });

    expect(component.canNavigateUp()).toBe(true);
  });

  it('allows navigating up from the storage root, since that goes to device level', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/' });

    expect(component.canNavigateUp()).toBe(true);
  });

  it('reflects a resolved load as not loading', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });

    expect(component.isLoading()).toBe(false);
  });

  it('reflects an in-progress load as loading', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });

    void storageStore.refreshDirectory({ deviceId, storageType: StorageType.Sd });

    expect(component.isLoading()).toBe(true);
  });

  it('passes the loading state through to the trail component', async () => {
    const { fixture, storageStore } = render({ realChildren: [DirectoryTrailComponent] });
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    fixture.detectChanges();

    void storageStore.refreshDirectory({ deviceId, storageType: StorageType.Sd });
    fixture.detectChanges();

    const trail = fixture.debugElement.query(
      (el) => el.componentInstance instanceof DirectoryTrailComponent
    )?.componentInstance as DirectoryTrailComponent;

    expect(trail.isLoading()).toBe(true);
  });

  it('calls navigateUpOneDirectory with the device and storage type on up click', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    const navigateUpOneDirectory = vi
      .spyOn(storageStore, 'navigateUpOneDirectory')
      .mockImplementation(async () => undefined);

    component.onUpClick();

    expect(navigateUpOneDirectory).toHaveBeenCalledWith({ deviceId, storageType: StorageType.Sd });
  });

  it('calls refreshDirectory on refresh click', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    const refreshDirectory = vi
      .spyOn(storageStore, 'refreshDirectory')
      .mockImplementation(async () => undefined);

    component.onRefreshClick();

    expect(refreshDirectory).toHaveBeenCalledWith({ deviceId, storageType: StorageType.Sd });
  });

  it('calls navigateToDirectory with the requested path on navigation request', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    const navigateToDirectory = vi
      .spyOn(storageStore, 'navigateToDirectory')
      .mockImplementation(async () => undefined);

    component.onNavigationRequested('/games/arcade');

    expect(navigateToDirectory).toHaveBeenCalledWith({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });
  });

  it('calls navigateDirectoryBackward on back click when back navigation is possible', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });
    const navigateDirectoryBackward = vi
      .spyOn(storageStore, 'navigateDirectoryBackward')
      .mockImplementation(async () => undefined);

    component.onBackClick();

    expect(navigateDirectoryBackward).toHaveBeenCalledWith({ deviceId });
  });

  it('calls navigateDirectoryForward on forward click when forward navigation is possible', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });
    await storageStore.navigateDirectoryBackward({ deviceId });
    const navigateDirectoryForward = vi
      .spyOn(storageStore, 'navigateDirectoryForward')
      .mockImplementation(async () => undefined);

    component.onForwardClick();

    expect(navigateDirectoryForward).toHaveBeenCalledWith({ deviceId });
  });

  it('reports canNavigateBack true mid-history', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });

    expect(component.canNavigateBack()).toBe(true);
  });

  it('reports canNavigateForward false at the end of history', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });

    expect(component.canNavigateForward()).toBe(false);
  });

  it('reports canNavigateForward true mid-history', async () => {
    const { component, storageStore } = render();
    await storageStore.navigateToDirectory({ deviceId, storageType: StorageType.Sd, path: '/games' });
    await storageStore.navigateToDirectory({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });
    await storageStore.navigateDirectoryBackward({ deviceId });

    expect(component.canNavigateForward()).toBe(true);
  });

  describe('with no selected directory', () => {
    it('defaults currentPath to root', () => {
      const { component } = render();
      expect(component.currentPath()).toBe('/');
    });

    it('defaults storageTypeLabel to Storage', () => {
      const { component } = render();
      expect(component.storageTypeLabel()).toBe('Storage');
    });

    it('defaults isLoading to false', () => {
      const { component } = render();
      expect(component.isLoading()).toBe(false);
    });

    it('is a no-op on up click', () => {
      const { component, storageStore } = render();
      const navigateUpOneDirectory = vi.spyOn(storageStore, 'navigateUpOneDirectory');

      component.onUpClick();

      expect(navigateUpOneDirectory).not.toHaveBeenCalled();
    });

    it('is a no-op on refresh click', () => {
      const { component, storageStore } = render();
      const refreshDirectory = vi.spyOn(storageStore, 'refreshDirectory');

      component.onRefreshClick();

      expect(refreshDirectory).not.toHaveBeenCalled();
    });

    it('is a no-op on navigation request', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');

      component.onNavigationRequested('/games');

      expect(navigateToDirectory).not.toHaveBeenCalled();
    });

    it('reports canNavigateBack false with no navigation history', () => {
      const { component } = render();
      expect(component.canNavigateBack()).toBe(false);
    });

    it('reports canNavigateForward false with no navigation history', () => {
      const { component } = render();
      expect(component.canNavigateForward()).toBe(false);
    });

    it('is a no-op on back click', () => {
      const { component, storageStore } = render();
      const navigateDirectoryBackward = vi.spyOn(storageStore, 'navigateDirectoryBackward');

      component.onBackClick();

      expect(navigateDirectoryBackward).not.toHaveBeenCalled();
    });

    it('is a no-op on forward click', () => {
      const { component, storageStore } = render();
      const navigateDirectoryForward = vi.spyOn(storageStore, 'navigateDirectoryForward');

      component.onForwardClick();

      expect(navigateDirectoryForward).not.toHaveBeenCalled();
    });
  });

  describe('at device level', () => {
    it('does not allow navigating up', () => {
      const { component, storageStore } = render();
      storageStore.navigateToDeviceLevel({ deviceId });

      expect(component.canNavigateUp()).toBe(false);
    });

    it('reports isDeviceLevelView as true', () => {
      const { component, storageStore } = render();
      storageStore.navigateToDeviceLevel({ deviceId });

      expect(component.isDeviceLevelView()).toBe(true);
    });
  });
});
