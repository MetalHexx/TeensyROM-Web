import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { DeviceStore, TransferStore } from '@teensyrom-nx/application';
import { Device, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { DeviceSelectorComponent } from './device-selector.component';

function createDevice(overrides: Partial<Device> = {}): Device {
  const deviceId = overrides.deviceId ?? 'device-1';
  return {
    deviceId,
    comPort: 'COM3',
    name: 'Test Device',
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
    ...overrides,
  };
}

describe('DeviceSelectorComponent', () => {
  let fixture: ComponentFixture<DeviceSelectorComponent>;
  let devicesSignal: ReturnType<typeof signal<Device[]>>;
  let transferStore: InstanceType<typeof TransferStore>;

  const setup = async (devices: Device[]) => {
    devicesSignal = signal(devices);

    await TestBed.configureTestingModule({
      imports: [DeviceSelectorComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: devicesSignal } },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
    fixture = TestBed.createComponent(DeviceSelectorComponent);
    fixture.detectChanges();
  };

  it('should create', async () => {
    await setup([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('offers only enabled devices', async () => {
    const enabled = createDevice({ deviceId: 'enabled-1' });
    const disabled = createDevice({ deviceId: 'disabled-1', isEnabled: false });
    await setup([enabled, disabled]);

    expect(fixture.componentInstance.enabledDevices()).toEqual([enabled]);
  });

  it('resolves targetDevice from the stored target id among enabled devices', async () => {
    const device = createDevice({ deviceId: 'device-2' });
    await setup([device]);

    expect(fixture.componentInstance.targetDevice()).toBeNull();

    transferStore.setTargetDevice({ deviceId: 'device-2' });
    fixture.detectChanges();

    expect(fixture.componentInstance.targetDevice()).toEqual(device);
  });

  it('writes the selected device to TransferStore on selection', async () => {
    const deviceA = createDevice({ deviceId: 'device-a' });
    const deviceB = createDevice({ deviceId: 'device-b' });
    await setup([deviceA, deviceB]);

    fixture.componentInstance.onSelect(deviceB);

    expect(transferStore.getTargetDeviceId()()).toBe('device-b');
  });

  it('resolves targetDevice to the newly selected device once TransferStore reflects it', async () => {
    const deviceA = createDevice({ deviceId: 'device-a' });
    const deviceB = createDevice({ deviceId: 'device-b' });
    await setup([deviceA, deviceB]);

    transferStore.setTargetDevice({ deviceId: 'device-b' });
    fixture.detectChanges();

    expect(fixture.componentInstance.targetDevice()?.deviceId).toBe('device-b');
  });
});
