import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentRef } from '@angular/core';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { DirectoryTreeNode, DirectoryTreeNodeType, StorageType } from '@teensyrom-nx/domain';
import { DirectoryTreeComponent } from './directory-tree.component';

interface MockMatTree {
  isExpanded: (node: unknown) => boolean;
  expand?: (node: unknown) => void;
}

describe('DirectoryTreeComponent', () => {
  let component: DirectoryTreeComponent;
  let fixture: ComponentFixture<DirectoryTreeComponent>;
  let componentRef: ComponentRef<DirectoryTreeComponent>;

  const sdStorageNode: DirectoryTreeNode = {
    id: 'test-device-123-SD',
    name: 'SD Storage',
    type: DirectoryTreeNodeType.StorageType,
    icon: 'sd_storage',
    deviceId: 'test-device-123',
    storageType: StorageType.Sd,
    path: '/',
  };

  const usbStorageNode: DirectoryTreeNode = {
    id: 'test-device-123-USB',
    name: 'USB Storage',
    type: DirectoryTreeNodeType.StorageType,
    icon: 'usb',
    deviceId: 'test-device-123',
    storageType: StorageType.Usb,
    path: '/',
  };

  const deviceNode: DirectoryTreeNode = {
    id: 'device-test-device-123',
    name: 'Device test-device-123',
    type: DirectoryTreeNodeType.Device,
    icon: 'desktop_windows',
    deviceId: 'test-device-123',
    children: [sdStorageNode, usbStorageNode],
  };

  const singleStorageDeviceNode: DirectoryTreeNode = {
    ...deviceNode,
    children: [sdStorageNode],
  };

  function mockTree(mock: MockMatTree) {
    Object.defineProperty(component, 'tree', {
      value: () => mock,
      writable: true,
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DirectoryTreeComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectoryTreeComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    componentRef.setInput('nodes', [deviceNode]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Placeholder identification', () => {
    it('should identify placeholder nodes', () => {
      const placeholder: DirectoryTreeNode = {
        id: 'placeholder-1',
        name: 'Loading...',
        type: DirectoryTreeNodeType.Placeholder,
        icon: 'hourglass_empty',
      };

      expect(component.isPlaceholder(0, placeholder)).toBeTruthy();
    });

    it('should not identify a directory node as a placeholder', () => {
      const directoryNode: DirectoryTreeNode = {
        id: 'dir-1',
        name: 'Games',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
      };

      expect(component.isPlaceholder(0, directoryNode)).toBeFalsy();
    });

    it('should not identify the device node itself as a placeholder', () => {
      expect(component.isPlaceholder(0, deviceNode)).toBeFalsy();
    });
  });

  describe('hasChild / shouldShowExpansionButton', () => {
    const leafNode: DirectoryTreeNode = {
      id: 'leaf',
      name: 'Leaf',
      type: DirectoryTreeNodeType.Directory,
      icon: 'folder',
    };

    it('should report hasChild true for a node with children', () => {
      expect(component.hasChild(0, deviceNode)).toBeTruthy();
    });

    it('should report hasChild false for a node without children', () => {
      expect(component.hasChild(0, leafNode)).toBeFalsy();
    });

    it('should show the expansion button for a node with children', () => {
      expect(component.shouldShowExpansionButton(deviceNode)).toBeTruthy();
    });

    it('should not show the expansion button for a node without children', () => {
      expect(component.shouldShowExpansionButton(leafNode)).toBeFalsy();
    });
  });

  describe('Selection marking by id', () => {
    it('should mark a node selected when its id matches selectedNodeId', () => {
      componentRef.setInput('selectedNodeId', deviceNode.id);
      fixture.detectChanges();

      expect(component.isNodeSelected(deviceNode)).toBeTruthy();
    });

    it('should not mark a node selected when its id differs from selectedNodeId', () => {
      componentRef.setInput('selectedNodeId', 'some-other-id');
      fixture.detectChanges();

      expect(component.isNodeSelected(deviceNode)).toBeFalsy();
    });

    it('should not mark any node selected when selectedNodeId is null', () => {
      componentRef.setInput('selectedNodeId', null);
      fixture.detectChanges();

      expect(component.isNodeSelected(deviceNode)).toBeFalsy();
    });
  });

  describe('nodeActivated emission', () => {
    it('should emit nodeActivated on click', () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeActivated.subscribe(emitSpy);

      component.onDirectoryClick(deviceNode);

      expect(emitSpy).toHaveBeenCalledWith(deviceNode);
    });

    it('should emit nodeActivated on Enter key and stop the event', () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeActivated.subscribe(emitSpy);

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      component.onNodeKeyDown(event, deviceNode);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith(deviceNode);
    });

    it('should emit nodeActivated on Space key', () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeActivated.subscribe(emitSpy);

      const event = new KeyboardEvent('keydown', { key: ' ' });

      component.onNodeKeyDown(event, deviceNode);

      expect(emitSpy).toHaveBeenCalledWith(deviceNode);
    });

    it('should not emit nodeActivated for other keys', () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeActivated.subscribe(emitSpy);

      const event = new KeyboardEvent('keydown', { key: 'Tab' });

      component.onNodeKeyDown(event, deviceNode);

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Deferred auto-expand behavior', () => {
    it('should auto-expand the device node after view init', async () => {
      const mockTreeComponent = {
        isExpanded: vi.fn().mockReturnValue(true),
        expand: vi.fn(),
      };
      mockTree(mockTreeComponent);

      component.ngAfterViewInit();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTreeComponent.expand).toHaveBeenCalledWith(deviceNode);
    });

    it('should not auto-expand storage nodes when multiple exist', async () => {
      const mockTreeComponent = {
        isExpanded: vi.fn().mockReturnValue(true),
        expand: vi.fn(),
      };
      mockTree(mockTreeComponent);

      component.ngAfterViewInit();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTreeComponent.expand).toHaveBeenCalledWith(deviceNode);
      expect(mockTreeComponent.expand).not.toHaveBeenCalledWith(sdStorageNode);
      expect(mockTreeComponent.expand).not.toHaveBeenCalledWith(usbStorageNode);
    });

    it('should auto-expand a lone storage child', async () => {
      componentRef.setInput('nodes', [singleStorageDeviceNode]);
      fixture.detectChanges();

      const mockTreeComponent = {
        isExpanded: vi.fn().mockReturnValue(true),
        expand: vi.fn(),
      };
      mockTree(mockTreeComponent);

      component.ngAfterViewInit();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTreeComponent.expand).toHaveBeenCalledWith(singleStorageDeviceNode);
      expect(mockTreeComponent.expand).toHaveBeenCalledWith(sdStorageNode);
      expect(mockTreeComponent.expand).toHaveBeenCalledTimes(2);
    });
  });

  describe('onToggleClick', () => {
    const storageNodeWithPlaceholder: DirectoryTreeNode = {
      id: 'test-storage-node',
      name: 'SD Storage',
      type: DirectoryTreeNodeType.StorageType,
      icon: 'sd_storage',
      deviceId: 'device-123',
      storageType: StorageType.Sd,
      path: '/',
      children: [
        {
          id: 'test-storage-node-placeholder',
          name: 'Loading...',
          type: DirectoryTreeNodeType.Placeholder,
          icon: 'hourglass_empty',
        },
      ],
    };

    it('should emit nodeExpansionNeedsData when expanded and its only child is a placeholder', async () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeExpansionNeedsData.subscribe(emitSpy);
      mockTree({ isExpanded: vi.fn().mockReturnValue(true) });

      component.onToggleClick(storageNodeWithPlaceholder);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emitSpy).toHaveBeenCalledWith(storageNodeWithPlaceholder);
    });

    it('should stay silent when the node is collapsed', async () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeExpansionNeedsData.subscribe(emitSpy);
      mockTree({ isExpanded: vi.fn().mockReturnValue(false) });

      component.onToggleClick(storageNodeWithPlaceholder);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should stay silent when the children are real (not a placeholder)', async () => {
      const emitSpy = vi.fn();
      componentRef.instance.nodeExpansionNeedsData.subscribe(emitSpy);
      mockTree({ isExpanded: vi.fn().mockReturnValue(true) });

      const nodeWithRealChildren: DirectoryTreeNode = {
        ...storageNodeWithPlaceholder,
        children: [
          {
            id: 'test-real-directory',
            name: 'Games',
            type: DirectoryTreeNodeType.Directory,
            icon: 'folder',
          },
        ],
      };

      component.onToggleClick(nodeWithRealChildren);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // Regression test: device node must always be expandable even before storage entries are loaded
  describe('Empty Storage Entries (Bug 2 Regression)', () => {
    const deviceNodeWithPlaceholder: DirectoryTreeNode = {
      id: 'device-test-device-123',
      name: 'Device test-device-123',
      type: DirectoryTreeNodeType.Device,
      icon: 'desktop_windows',
      deviceId: 'test-device-123',
      children: [
        {
          id: 'device-test-device-123-placeholder',
          name: 'Loading...',
          type: DirectoryTreeNodeType.Placeholder,
          icon: 'hourglass_empty',
        },
      ],
    };

    it('should satisfy hasChild predicate for device node when storage entries are empty', () => {
      expect(component.hasChild(0, deviceNodeWithPlaceholder)).toBeTruthy();
    });

    it('should not satisfy isPlaceholder predicate for the device node itself', () => {
      expect(component.isPlaceholder(0, deviceNodeWithPlaceholder)).toBeFalsy();
    });
  });
});
