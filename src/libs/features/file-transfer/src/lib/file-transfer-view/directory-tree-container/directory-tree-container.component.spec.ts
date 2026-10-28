import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentRef, signal, type WritableSignal } from '@angular/core';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { DeviceStore, StorageStore } from '@teensyrom-nx/application';
import { DirectoryTreeNodeType, StorageType, type Device } from '@teensyrom-nx/domain';
import { DirectoryTreeContainerComponent } from './directory-tree-container.component';

interface MockStorageStore {
  navigateToDirectory: ReturnType<typeof vi.fn>;
  navigateToDeviceLevel: ReturnType<typeof vi.fn>;
  isDeviceLevelView: ReturnType<typeof vi.fn>;
  getDeviceStorageEntries: ReturnType<typeof vi.fn>;
  getSelectedDirectoryState: ReturnType<typeof vi.fn>;
}

describe('DirectoryTreeContainerComponent', () => {
  let component: DirectoryTreeContainerComponent;
  let fixture: ComponentFixture<DirectoryTreeContainerComponent>;
  let componentRef: ComponentRef<DirectoryTreeContainerComponent>;
  let mockStorageStore: MockStorageStore;
  let devices: WritableSignal<Device[]>;

  function createComponent(deviceId = 'test-device-123') {
    fixture = TestBed.createComponent(DirectoryTreeContainerComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('deviceId', deviceId);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    devices = signal<Device[]>([{ deviceId: 'test-device-123', name: 'TR-1' } as Device]);
    mockStorageStore = {
      navigateToDirectory: vi.fn(),
      navigateToDeviceLevel: vi.fn(),
      isDeviceLevelView: vi.fn().mockReturnValue(() => false),
      getDeviceStorageEntries: vi.fn().mockReturnValue(() => ({})),
      getSelectedDirectoryState: vi.fn().mockReturnValue(() => null),
    };

    await TestBed.configureTestingModule({
      imports: [DirectoryTreeContainerComponent],
      providers: [
        provideNoopAnimations(),
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: DeviceStore, useValue: { devices } },
      ],
    }).compileComponents();

    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('nodes', () => {
    it('should label the device node with the device name and keep the id-derived node id', () => {
      expect(component.nodes()[0]).toMatchObject({ id: 'device-test-device-123', name: 'TR-1' });
    });

    it('should fall back to the device id while the device is not in the store', () => {
      devices.set([]);

      expect(component.nodes()[0].name).toBe('test-device-123');
    });

    it('should relabel the device node when the store renames the device', () => {
      devices.set([{ deviceId: 'test-device-123', name: 'Living Room' } as Device]);

      expect(component.nodes()[0].name).toBe('Living Room');
      expect(component.nodes()[0].id).toBe('device-test-device-123');
    });

    describe('when the storage was left inside a subfolder', () => {
      function useEntryInSubfolder() {
        mockStorageStore.getDeviceStorageEntries = vi.fn().mockReturnValue(() => ({
          'test-device-123-SD': {
            deviceId: 'test-device-123',
            storageType: StorageType.Sd,
            currentPath: '/games',
            directoryListings: {
              '/': [{ name: 'games', path: '/games' }],
              '/games': [{ name: 'demos', path: '/games/demos' }],
            },
          },
        }));
      }

      it('shows the root folders under the storage node instead of a placeholder', () => {
        useEntryInSubfolder();
        createComponent();

        const storageNode = component.nodes()[0].children?.[0];

        expect(storageNode?.children?.map((n) => n.name)).toEqual(['games']);
        expect(storageNode?.children?.[0].children?.map((n) => n.name)).toEqual(['demos']);
      });

      it('builds the same tree for a freshly created container as for the one it replaces', () => {
        useEntryInSubfolder();
        createComponent();
        const before = component.nodes();
        fixture.destroy();

        createComponent();

        expect(component.nodes()).toEqual(before);
      });
    });
  });

  describe('onNodeActivated', () => {
    it('should navigate to device level for a device node with deviceId', () => {
      component.onNodeActivated({
        id: 'device-test-device-123',
        name: 'Device test-device-123',
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
        deviceId: 'test-device-123',
      });

      expect(mockStorageStore.navigateToDeviceLevel).toHaveBeenCalledWith({
        deviceId: 'test-device-123',
      });
      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });

    it('should not navigate when a device node lacks deviceId', () => {
      component.onNodeActivated({
        id: 'device-test',
        name: 'Test Device',
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
      });

      expect(mockStorageStore.navigateToDeviceLevel).not.toHaveBeenCalled();
      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });

    it('should navigate to directory for a directory node', () => {
      component.onNodeActivated({
        id: 'test-node',
        name: 'Test Directory',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        path: '/test/path',
      });

      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        path: '/test/path',
      });
    });

    it('should navigate to directory for a storage node', () => {
      component.onNodeActivated({
        id: 'test-device-123-SD',
        name: 'SD Storage',
        type: DirectoryTreeNodeType.StorageType,
        icon: 'sd_storage',
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        path: '/',
      });

      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        path: '/',
      });
    });

    it('should not call the store for a malformed node', () => {
      component.onNodeActivated({
        id: 'invalid-node',
        name: 'Invalid',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
      });

      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
      expect(mockStorageStore.navigateToDeviceLevel).not.toHaveBeenCalled();
    });
  });

  describe('nodeActivated output', () => {
    const emitted = () => {
      const spy = vi.fn();
      component.nodeActivated.subscribe(spy);
      return spy;
    };

    it('emits the device id when the device node is activated', () => {
      const spy = emitted();

      component.onNodeActivated({
        id: 'device-test-device-123',
        name: 'TR-1',
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
        deviceId: 'test-device-123',
      });

      expect(spy).toHaveBeenCalledWith('test-device-123');
    });

    it('emits the device id when a folder node is activated', () => {
      const spy = emitted();

      component.onNodeActivated({
        id: 'n',
        name: 'games',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        path: '/games',
      });

      expect(spy).toHaveBeenCalledWith('test-device-123');
    });

    it('does not emit when a node is only expanded', () => {
      const spy = emitted();

      component.onNodeExpansionNeedsData({
        id: 'n',
        name: 'games',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        path: '/games',
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('onNodeExpansionNeedsData', () => {
    it('should navigate to directory for a storage node', () => {
      component.onNodeExpansionNeedsData({
        id: 'test-device-123-SD',
        name: 'SD Storage',
        type: DirectoryTreeNodeType.StorageType,
        icon: 'sd_storage',
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        path: '/',
      });

      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        path: '/',
      });
    });

    it('should not call the store for a malformed node', () => {
      component.onNodeExpansionNeedsData({
        id: 'invalid-node',
        name: 'Invalid',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
      });

      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });

    it('should not call the store for a device node', () => {
      component.onNodeExpansionNeedsData({
        id: 'device-test-123',
        name: 'Test Device',
        type: DirectoryTreeNodeType.Device,
        icon: 'desktop_windows',
        deviceId: 'test-device-123',
      });

      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });
  });

  describe('selectedNodeId', () => {
    it('should resolve to the device node id at device level', () => {
      mockStorageStore.isDeviceLevelView = vi.fn().mockReturnValue(() => true);
      createComponent('test-device-123');

      expect(component.selectedNodeId()).toBe('device-test-device-123');
    });

    it('should resolve to the storage node id (no path segment) for storage-root selection', () => {
      mockStorageStore.isDeviceLevelView = vi.fn().mockReturnValue(() => false);
      mockStorageStore.getSelectedDirectoryState = vi.fn().mockReturnValue(() => ({
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        currentPath: '/',
      }));
      createComponent('test-device-123');

      expect(component.selectedNodeId()).toBe('test-device-123-SD');
    });

    it('should resolve to the directory node id for a nested-directory selection', () => {
      mockStorageStore.isDeviceLevelView = vi.fn().mockReturnValue(() => false);
      mockStorageStore.getSelectedDirectoryState = vi.fn().mockReturnValue(() => ({
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        currentPath: '/games',
      }));
      createComponent('test-device-123');

      expect(component.selectedNodeId()).toBe('test-device-123-SD-/games');
    });
  });

  describe('showSelection', () => {
    it('leaves no node selected while off', () => {
      mockStorageStore.getSelectedDirectoryState = vi.fn().mockReturnValue(() => ({
        deviceId: 'test-device-123',
        storageType: StorageType.Sd,
        currentPath: '/',
      }));
      createComponent('test-device-123');
      componentRef.setInput('showSelection', false);

      expect(component.selectedNodeId()).toBeNull();
    });
  });
});
