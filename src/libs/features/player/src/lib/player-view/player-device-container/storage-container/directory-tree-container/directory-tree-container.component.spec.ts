import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StorageStore } from '@teensyrom-nx/application';
import { DirectoryTreeNodeType, StorageType, STORAGE_SERVICE } from '@teensyrom-nx/domain';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { createMockStorageService } from '@teensyrom-nx/testing/fixtures';
import { DirectoryTreeContainerComponent } from './directory-tree-container.component';

describe('DirectoryTreeContainerComponent', () => {
  const deviceId = 'test-device-123';

  function render() {
    const result = renderPlayerComponent(DirectoryTreeContainerComponent, {
      inputs: { deviceId },
      providers: [{ provide: STORAGE_SERVICE, useValue: createMockStorageService() }],
    });
    const storageStore = TestBed.inject(StorageStore);
    return { ...result, storageStore };
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  describe('onNodeActivated', () => {
    it('navigates to device level and emits directoryNavigated for a device node with a deviceId', () => {
      const { component, storageStore } = render();
      const navigateToDeviceLevel = vi.spyOn(storageStore, 'navigateToDeviceLevel');
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');
      const emitted = vi.fn();
      component.directoryNavigated.subscribe(emitted);

      component.onNodeActivated({
        id: `device-${deviceId}`,
        name: `Device ${deviceId}`,
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
        deviceId,
      });

      expect(navigateToDeviceLevel).toHaveBeenCalledWith({ deviceId });
      expect(navigateToDirectory).not.toHaveBeenCalled();
      expect(emitted).toHaveBeenCalledOnce();
    });

    it('is a no-op for a device node without a deviceId', () => {
      const { component, storageStore } = render();
      const navigateToDeviceLevel = vi.spyOn(storageStore, 'navigateToDeviceLevel');
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');
      const emitted = vi.fn();
      component.directoryNavigated.subscribe(emitted);

      component.onNodeActivated({
        id: 'device-test',
        name: 'Test Device',
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
      });

      expect(navigateToDeviceLevel).not.toHaveBeenCalled();
      expect(navigateToDirectory).not.toHaveBeenCalled();
      expect(emitted).not.toHaveBeenCalled();
    });

    it('navigates to the directory and emits directoryNavigated for a directory node', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');
      const emitted = vi.fn();
      component.directoryNavigated.subscribe(emitted);

      component.onNodeActivated({
        id: 'test-node',
        name: 'Test Directory',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        path: '/test/path',
      });

      expect(navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        path: '/test/path',
      });
      expect(emitted).toHaveBeenCalledOnce();
    });

    it('navigates to the storage root and emits directoryNavigated for a storage-type node', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');
      const emitted = vi.fn();
      component.directoryNavigated.subscribe(emitted);

      component.onNodeActivated({
        id: `${deviceId}-SD`,
        name: 'SD Storage',
        type: DirectoryTreeNodeType.StorageType,
        icon: 'sd_storage',
        deviceId,
        storageType: StorageType.Sd,
        path: '/',
      });

      expect(navigateToDirectory).toHaveBeenCalledWith({
        deviceId,
        storageType: StorageType.Sd,
        path: '/',
      });
      expect(emitted).toHaveBeenCalledOnce();
    });

    it('is a no-op for a malformed node', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');
      const navigateToDeviceLevel = vi.spyOn(storageStore, 'navigateToDeviceLevel');
      const emitted = vi.fn();
      component.directoryNavigated.subscribe(emitted);

      component.onNodeActivated({
        id: 'invalid-node',
        name: 'Invalid',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
      });

      expect(navigateToDirectory).not.toHaveBeenCalled();
      expect(navigateToDeviceLevel).not.toHaveBeenCalled();
      expect(emitted).not.toHaveBeenCalled();
    });
  });

  describe('onNodeExpansionNeedsData', () => {
    it('lazy-loads a storage node without emitting directoryNavigated', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');
      const emitted = vi.fn();
      component.directoryNavigated.subscribe(emitted);

      component.onNodeExpansionNeedsData({
        id: `${deviceId}-SD`,
        name: 'SD Storage',
        type: DirectoryTreeNodeType.StorageType,
        icon: 'sd_storage',
        deviceId,
        storageType: StorageType.Sd,
        path: '/',
      });

      expect(navigateToDirectory).toHaveBeenCalledWith({
        deviceId,
        storageType: StorageType.Sd,
        path: '/',
      });
      expect(emitted).not.toHaveBeenCalled();
    });

    it('is a no-op for a malformed node', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');

      component.onNodeExpansionNeedsData({
        id: 'invalid-node',
        name: 'Invalid',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
      });

      expect(navigateToDirectory).not.toHaveBeenCalled();
    });

    it('is a no-op for a device node, since devices do not lazy-load', () => {
      const { component, storageStore } = render();
      const navigateToDirectory = vi.spyOn(storageStore, 'navigateToDirectory');

      component.onNodeExpansionNeedsData({
        id: `device-${deviceId}`,
        name: `Device ${deviceId}`,
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
        deviceId,
      });

      expect(navigateToDirectory).not.toHaveBeenCalled();
    });
  });

  describe('selectedNodeId', () => {
    it('resolves to the device node id at device level', () => {
      const { component, storageStore } = render();
      storageStore.navigateToDeviceLevel({ deviceId });

      expect(component.selectedNodeId()).toBe(`device-${deviceId}`);
    });

    it('resolves to the storage node id (no path segment) for a storage-root selection', async () => {
      const { component, storageStore } = render();
      await storageStore.initializeStorage({ deviceId, storageType: StorageType.Sd });

      expect(component.selectedNodeId()).toBe(`${deviceId}-SD`);
    });

    it('resolves to the directory node id for a nested-directory selection', async () => {
      const { component, storageStore } = render();
      await storageStore.initializeStorage({ deviceId, storageType: StorageType.Sd });
      await storageStore.navigateToDirectory({
        deviceId,
        storageType: StorageType.Sd,
        path: '/games',
      });

      expect(component.selectedNodeId()).toBe(`${deviceId}-SD-/games`);
    });
  });
});
