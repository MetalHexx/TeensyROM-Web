import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ScalingCardComponent, StatusIconLabelComponent } from '@teensyrom-nx/ui/components';
import { DeviceStore, TransferStore } from '@teensyrom-nx/application';
import { Device, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { DestinationCardComponent } from './destination-card.component';
import { DeviceSelectorComponent } from './device-selector/device-selector.component';
import { DropzonePlaceholderComponent } from './dropzone-placeholder/dropzone-placeholder.component';

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

describe('DestinationCardComponent', () => {
  let fixture: ComponentFixture<DestinationCardComponent>;
  let devicesSignal: ReturnType<typeof signal<Device[]>>;
  let transferStore: InstanceType<typeof TransferStore>;

  const setup = async (devices: Device[]) => {
    devicesSignal = signal(devices);

    await TestBed.configureTestingModule({
      imports: [DestinationCardComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: devicesSignal } },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
    fixture = TestBed.createComponent(DestinationCardComponent);
    fixture.detectChanges();
  };

  it('should create', async () => {
    await setup([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render as a scaling card titled Destination', async () => {
    await setup([]);
    const card = fixture.debugElement.query(By.directive(ScalingCardComponent));
    expect(card).toBeTruthy();
    expect(card.componentInstance.title()).toBe('Destination');
  });

  it('should render the device selector, status indicator, and dropzone placeholder', async () => {
    await setup([]);
    expect(fixture.debugElement.query(By.directive(DeviceSelectorComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(StatusIconLabelComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(DropzonePlaceholderComponent))).toBeTruthy();
  });

  describe('isIdle', () => {
    it('is undefined when there is no target device', async () => {
      await setup([]);
      expect(fixture.componentInstance.isIdle()).toBeUndefined();
    });

    it.each([
      [DeviceState.Connected, true],
      [DeviceState.Connectable, true],
      [DeviceState.Busy, false],
      [DeviceState.ConnectionLost, false],
      [DeviceState.Unknown, false],
    ])('reflects deviceState %s as idle=%s', async (deviceState, expected) => {
      const device = createDevice({ deviceState });
      await setup([device]);
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      expect(fixture.componentInstance.isIdle()).toBe(expected);
    });

    it('issues no API call or device command — it only reads deviceState', async () => {
      const device = createDevice({ deviceState: DeviceState.Connected });
      const enableSpy = vi.fn();
      const disableSpy = vi.fn();

      await setup([device]);
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      expect(fixture.componentInstance.isIdle()).toBe(true);
      expect(enableSpy).not.toHaveBeenCalled();
      expect(disableSpy).not.toHaveBeenCalled();
    });
  });

  describe('targetDevice', () => {
    it('only considers enabled devices even if the stored target id matches a disabled one', async () => {
      const disabledDevice = createDevice({ deviceId: 'device-1', isEnabled: false });
      await setup([disabledDevice]);
      transferStore.setTargetDevice({ deviceId: 'device-1' });
      fixture.detectChanges();

      expect(fixture.componentInstance.targetDevice()).toBeNull();
    });
  });
});
