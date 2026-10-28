import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DeviceStore, StorageStore, TransferStore } from '@teensyrom-nx/application';
import {
  Device,
  DeviceState,
  DeviceMachine,
  DeviceVideoStandard,
  DeviceHardwareVariant,
  DirectoryTreeNodeType,
  IStorageService,
  STORAGE_SERVICE,
  StorageType,
} from '@teensyrom-nx/domain';
import { DevicesTreeCardComponent } from './devices-tree-card.component';
import { DirectoryTreeContainerComponent } from '../directory-tree-container/directory-tree-container.component';

function createDevice(deviceId: string): Device {
  return {
    deviceId,
    comPort: 'COM3',
    name: `Device ${deviceId}`,
    fwVersion: '1.0.0',
    machine: DeviceMachine.C64,
    videoStandard: DeviceVideoStandard.Ntsc,
    todClockHz: null,
    hardwareVariant: DeviceHardwareVariant.TeensyRom,
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
  };
}

describe('DevicesTreeCardComponent', () => {
  let fixture: ComponentFixture<DevicesTreeCardComponent>;
  let transferStore: InstanceType<typeof TransferStore>;
  let storageStore: InstanceType<typeof StorageStore>;

  const trees = () =>
    fixture.debugElement
      .queryAll(By.directive(DirectoryTreeContainerComponent))
      .map((el) => el.componentInstance as DirectoryTreeContainerComponent);

  const folderNode = (deviceId: string) => ({
    id: `${deviceId}-SD-/games`,
    name: 'games',
    type: DirectoryTreeNodeType.Directory,
    icon: 'folder',
    deviceId,
    storageType: StorageType.Sd,
    path: '/games',
  });

  beforeEach(async () => {
    const devices = [createDevice('device-a'), createDevice('device-b')];
    const mockStorageService: Partial<IStorageService> = {
      getDirectory: vi.fn().mockReturnValue(of({ path: '/', directories: [], files: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [DevicesTreeCardComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: signal(devices) } },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
    storageStore = TestBed.inject(StorageStore);
    await storageStore.initializeStorage({ deviceId: 'device-a', storageType: StorageType.Sd });
    await storageStore.initializeStorage({ deviceId: 'device-b', storageType: StorageType.Sd });
    transferStore.setTargetDevice({ deviceId: 'device-a' });

    fixture = TestBed.createComponent(DevicesTreeCardComponent);
    fixture.componentRef.setInput('devices', devices);
    fixture.detectChanges();
  });

  it('draws one tree per device in one compact card with no nested cards', () => {
    expect(trees().map((tree) => tree.deviceId())).toEqual(['device-a', 'device-b']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('lib-scaling-card')
    ).toHaveLength(0);
  });

  it('makes a device the target when its device node is activated', () => {
    const tree = trees()[1];

    tree.onNodeActivated({
      id: 'device-device-b',
      name: 'Device device-b',
      type: DirectoryTreeNodeType.Device,
      icon: 'desktop_windows',
      deviceId: 'device-b',
    });

    expect(transferStore.getTargetDeviceId()()).toBe('device-b');
  });

  it('makes a device the target when a folder in its tree is activated', () => {
    trees()[1].onNodeActivated(folderNode('device-b'));

    expect(transferStore.getTargetDeviceId()()).toBe('device-b');
  });

  it('leaves the target alone when a node in another tree is only expanded', () => {
    trees()[1].onNodeExpansionNeedsData(folderNode('device-b'));

    expect(transferStore.getTargetDeviceId()()).toBe('device-a');
  });

  it('shows a selected node only in the target device tree', () => {
    expect(trees().map((tree) => tree.selectedNodeId() !== null)).toEqual([true, false]);

    transferStore.setTargetDevice({ deviceId: 'device-b' });
    fixture.detectChanges();

    expect(trees().map((tree) => tree.selectedNodeId() !== null)).toEqual([false, true]);
  });
});
