import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DeviceStore, StorageStore } from '@teensyrom-nx/application';
import {
  DirectoryTreeNodeType,
  StorageType,
  STORAGE_SERVICE,
  type Device,
  type StorageDirectory,
} from '@teensyrom-nx/domain';
import { of } from 'rxjs';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { createMockStorageService } from '@teensyrom-nx/testing/fixtures';
import { DirectoryTreeContainerComponent } from './directory-tree-container.component';

describe('DirectoryTreeContainerComponent', () => {
  const deviceId = 'test-device-123';

  function render(
    devices: Device[] = [{ deviceId, name: 'TR-1' } as Device],
    storageService = createMockStorageService()
  ) {
    const devicesSignal = signal<Device[]>(devices);
    const result = renderPlayerComponent(DirectoryTreeContainerComponent, {
      inputs: { deviceId },
      providers: [
        { provide: STORAGE_SERVICE, useValue: storageService },
        { provide: DeviceStore, useValue: { devices: devicesSignal } },
      ],
    });
    const storageStore = TestBed.inject(StorageStore);
    return { ...result, storageStore, devicesSignal };
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  describe('nodes', () => {
    it('labels the device node with the device name and keeps the id-derived node id', () => {
      const { component } = render();

      expect(component.nodes()[0]).toMatchObject({ id: `device-${deviceId}`, name: 'TR-1' });
    });

    it('falls back to the device id while the device is not in the store', () => {
      const { component } = render([]);

      expect(component.nodes()[0].name).toBe(deviceId);
    });

    it('relabels the device node when the store renames the device, leaving the selection alone', () => {
      const { component, storageStore, devicesSignal } = render();
      storageStore.navigateToDeviceLevel({ deviceId });
      const selectedBefore = component.selectedNodeId();

      devicesSignal.set([{ deviceId, name: 'Living Room' } as Device]);

      expect(component.nodes()[0].name).toBe('Living Room');
      expect(component.selectedNodeId()).toBe(selectedBefore);
    });

    it('still shows the root folders after the view is left and re-entered inside a subfolder', async () => {
      const listing = (path: string, names: string[]): StorageDirectory => ({
        path,
        directories: names.map((name) => ({ name, path: `${path === '/' ? '' : path}/${name}` })),
        files: [],
      });
      const getDirectory = vi
        .fn()
        .mockReturnValueOnce(of(listing('/', ['games'])))
        .mockReturnValueOnce(of(listing('/games', ['demos'])));
      const { fixture, storageStore } = render(
        undefined,
        createMockStorageService({ getDirectory })
      );
      await storageStore.initializeStorage({ deviceId, storageType: StorageType.Sd });
      await storageStore.navigateToDirectory({
        deviceId,
        storageType: StorageType.Sd,
        path: '/games',
      });

      fixture.destroy();
      const reentered = TestBed.createComponent(DirectoryTreeContainerComponent);
      reentered.componentRef.setInput('deviceId', deviceId);
      reentered.detectChanges();

      const storageNode = reentered.componentInstance.nodes()[0].children?.[0];
      expect(storageNode?.children?.map((n) => n.name)).toEqual(['games']);
      expect(storageNode?.children?.[0].children?.map((n) => n.name)).toEqual(['demos']);
    });
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
