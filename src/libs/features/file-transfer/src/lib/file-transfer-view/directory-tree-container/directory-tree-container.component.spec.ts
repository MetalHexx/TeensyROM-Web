import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentRef } from '@angular/core';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { StorageStore } from '@teensyrom-nx/application';
import { DirectoryTreeNodeType, StorageType } from '@teensyrom-nx/domain';
import { DirectoryTreeContainerComponent } from './directory-tree-container.component';

interface MockStorageStore {
  getDeviceDirectories: ReturnType<typeof vi.fn>;
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

  function createComponent(deviceId = 'test-device-123') {
    fixture = TestBed.createComponent(DirectoryTreeContainerComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('deviceId', deviceId);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockStorageStore = {
      getDeviceDirectories: vi.fn().mockReturnValue(() => []),
      navigateToDirectory: vi.fn(),
      navigateToDeviceLevel: vi.fn(),
      isDeviceLevelView: vi.fn().mockReturnValue(() => false),
      getDeviceStorageEntries: vi.fn().mockReturnValue(() => ({})),
      getSelectedDirectoryState: vi.fn().mockReturnValue(() => null),
    };

    await TestBed.configureTestingModule({
      imports: [DirectoryTreeContainerComponent],
      providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
    }).compileComponents();

    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
});
