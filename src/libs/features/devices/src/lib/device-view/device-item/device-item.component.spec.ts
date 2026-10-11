import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DeviceItemComponent } from './device-item.component';
import {
  Device,
  DeviceStorage,
  DeviceState,
  StorageType,
  DeviceMachine,
  DeviceVideoStandard,
  DeviceHardwareVariant,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '@teensyrom-nx/application';
import { By } from '@angular/platform-browser';
import { StorageStatusComponent } from '../storage-item/storage-item.component';
import { vi } from 'vitest';

describe('DeviceItemComponent', () => {
  let component: DeviceItemComponent;
  let fixture: ComponentFixture<DeviceItemComponent>;
  let mockDeviceStore: Partial<InstanceType<typeof DeviceStore>>;

  const mockDevice: Device = {
    deviceId: 'test-device-1',
    comPort: 'COM3',
    name: 'Test Device',
    fwVersion: '1.0.0',
    machine: DeviceMachine.C64,
    videoStandard: DeviceVideoStandard.Ntsc,
    todClockHz: null,
    hardwareVariant: DeviceHardwareVariant.TeensyRom,
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    ipAddress: '192.168.1.100',
    tcpPort: 8080,
    usbStorage: {
      deviceId: 'test-device-1',
      type: StorageType.Usb,
      available: true,
      indexExists: true,
    },
    sdStorage: {
      deviceId: 'test-device-1',
      type: StorageType.Sd,
      available: true,
      indexExists: true,
    },
  };

  beforeEach(async () => {
    mockDeviceStore = {
      indexStorage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DeviceItemComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DeviceStore, useValue: mockDeviceStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceItemComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });
  });

  describe('Computed Properties', () => {
    it('should compute usbStatus from device USB storage availability', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      expect(component.usbStatus()).toBe(true);
    });

    it('should compute sdStatus from device SD storage availability', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      expect(component.sdStatus()).toBe(true);
    });

    it('should compute usbIndexExists from device USB storage indexExists', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(true);
    });

    it('should compute sdIndexExists from device SD storage indexExists', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      expect(component.sdIndexExists()).toBe(true);
    });
  });

  describe('Index Status - USB Storage', () => {
    it('should pass indexExists false to USB storage when index missing', () => {
      const deviceWithMissingIndex: Device = {
        ...mockDevice,
        usbStorage: {
          deviceId: 'test-device-1',
          type: StorageType.Usb,
          available: true,
          indexExists: false,
        },
      };
      
      fixture.componentRef.setInput('device', deviceWithMissingIndex);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(false);
      
      const usbStorage = fixture.debugElement.queryAll(By.directive(StorageStatusComponent))[0];
      expect(usbStorage.componentInstance.indexExists()).toBe(false);
    });

    it('should pass indexExists true to USB storage when indexed', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(true);
      
      const usbStorage = fixture.debugElement.queryAll(By.directive(StorageStatusComponent))[0];
      expect(usbStorage.componentInstance.indexExists()).toBe(true);
    });
  });

  describe('Index Status - SD Storage', () => {
    it('should pass indexExists false to SD storage when index missing', () => {
      const deviceWithMissingIndex: Device = {
        ...mockDevice,
        sdStorage: {
          deviceId: 'test-device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: false,
        },
      };
      
      fixture.componentRef.setInput('device', deviceWithMissingIndex);
      fixture.detectChanges();
      
      expect(component.sdIndexExists()).toBe(false);
      
      const sdStorage = fixture.debugElement.queryAll(By.directive(StorageStatusComponent))[1];
      expect(sdStorage.componentInstance.indexExists()).toBe(false);
    });

    it('should pass indexExists true to SD storage when indexed', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      expect(component.sdIndexExists()).toBe(true);
      
      const sdStorage = fixture.debugElement.queryAll(By.directive(StorageStatusComponent))[1];
      expect(sdStorage.componentInstance.indexExists()).toBe(true);
    });
  });

  describe('Mixed Index States', () => {
    it('should handle USB indexed and SD not indexed', () => {
      const mixedDevice: Device = {
        ...mockDevice,
        usbStorage: {
          deviceId: 'test-device-1',
          type: StorageType.Usb,
          available: true,
          indexExists: true,
        },
        sdStorage: {
          deviceId: 'test-device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: false,
        },
      };
      
      fixture.componentRef.setInput('device', mixedDevice);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(true);
      expect(component.sdIndexExists()).toBe(false);
      
      const storages = fixture.debugElement.queryAll(By.directive(StorageStatusComponent));
      expect(storages[0].componentInstance.indexExists()).toBe(true); // USB
      expect(storages[1].componentInstance.indexExists()).toBe(false); // SD
    });

    it('should handle USB not indexed and SD indexed', () => {
      const mixedDevice: Device = {
        ...mockDevice,
        usbStorage: {
          deviceId: 'test-device-1',
          type: StorageType.Usb,
          available: true,
          indexExists: false,
        },
        sdStorage: {
          deviceId: 'test-device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: true,
        },
      };
      
      fixture.componentRef.setInput('device', mixedDevice);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(false);
      expect(component.sdIndexExists()).toBe(true);
      
      const storages = fixture.debugElement.queryAll(By.directive(StorageStatusComponent));
      expect(storages[0].componentInstance.indexExists()).toBe(false); // USB
      expect(storages[1].componentInstance.indexExists()).toBe(true); // SD
    });
  });

  describe('Undefined Device Handling', () => {
    it('should default usbIndexExists to true when device is undefined', () => {
      fixture.componentRef.setInput('device', undefined);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(true);
    });

    it('should default sdIndexExists to true when device is undefined', () => {
      fixture.componentRef.setInput('device', undefined);
      fixture.detectChanges();
      
      expect(component.sdIndexExists()).toBe(true);
    });

    it('should default usbIndexExists to true when usbStorage is undefined', () => {
      const deviceWithoutUsbStorage: Device = {
        ...mockDevice,
        usbStorage: undefined as unknown as DeviceStorage,
      };
      
      fixture.componentRef.setInput('device', deviceWithoutUsbStorage);
      fixture.detectChanges();
      
      expect(component.usbIndexExists()).toBe(true);
    });

    it('should default sdIndexExists to true when sdStorage is undefined', () => {
      const deviceWithoutSdStorage: Device = {
        ...mockDevice,
        sdStorage: undefined as unknown as DeviceStorage,
      };
      
      fixture.componentRef.setInput('device', deviceWithoutSdStorage);
      fixture.detectChanges();
      
      expect(component.sdIndexExists()).toBe(true);
    });
  });

  describe('Enable/Disable Functionality', () => {
    it('should emit disable event when device is enabled and toggle button clicked', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      let disabledDeviceId = '';
      component.disable.subscribe((deviceId) => {
        disabledDeviceId = deviceId;
      });
      
      component.onToggleEnabled();
      
      expect(disabledDeviceId).toBe('test-device-1');
    });

    it('should emit enable event when device is disabled and toggle button clicked', () => {
      const disabledDevice: Device = {
        ...mockDevice,
        isEnabled: false,
      };
      
      fixture.componentRef.setInput('device', disabledDevice);
      fixture.detectChanges();
      
      let enabledDeviceId = '';
      component.enable.subscribe((deviceId) => {
        enabledDeviceId = deviceId;
      });
      
      component.onToggleEnabled();
      
      expect(enabledDeviceId).toBe('test-device-1');
    });
  });

  describe('Indexing Functionality', () => {
    it('should call deviceStore.indexStorage with correct parameters for USB', async () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      await component.onIndex(StorageType.Usb);
      
      expect(mockDeviceStore.indexStorage).toHaveBeenCalledWith('test-device-1', StorageType.Usb);
    });

    it('should call deviceStore.indexStorage with correct parameters for SD', async () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
      
      await component.onIndex(StorageType.Sd);
      
      expect(mockDeviceStore.indexStorage).toHaveBeenCalledWith('test-device-1', StorageType.Sd);
    });
  });

  describe('Template Rendering', () => {
    it('should render device name', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Test Device');
    });

    it('should render both storage status components', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      const storages = fixture.debugElement.queryAll(By.directive(StorageStatusComponent));
      expect(storages.length).toBe(2);
    });

    it('should render USB storage first, SD storage second', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      const storages = fixture.debugElement.queryAll(By.directive(StorageStatusComponent));
      expect(storages[0].componentInstance.icon()).toBe('usb');
      expect(storages[1].componentInstance.icon()).toBe('sd_card');
    });
  });

  describe('Rename', () => {
    const openEditor = (): HTMLInputElement => {
      fixture.nativeElement.querySelector('[data-testid="device-name"] button').click();
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('[data-testid="device-name"] input');
    };

    const typeAndPress = (input: HTMLInputElement, text: string, key: string): void => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();
    };

    beforeEach(() => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();
    });

    it('shows the device name on an edit button', () => {
      const button = fixture.nativeElement.querySelector('[data-testid="device-name"] button');

      expect(button.textContent).toContain('Test Device');
      expect(button.getAttribute('aria-label')).toBe('Rename Test Device');
    });

    it('emits rename with the device id and the trimmed name', () => {
      let renamed: { deviceId: string; name: string } | undefined;
      component.rename.subscribe((request) => (renamed = request));

      typeAndPress(openEditor(), '  Studio TR  ', 'Enter');

      expect(renamed).toEqual({ deviceId: 'test-device-1', name: 'Studio TR' });
    });

    it('emits nothing when the name is unchanged', () => {
      const renameSpy = vi.fn();
      component.rename.subscribe(renameSpy);

      typeAndPress(openEditor(), 'Test Device', 'Enter');

      expect(renameSpy).not.toHaveBeenCalled();
    });

    it('keeps the editor open and emits nothing for an invalid name', () => {
      const renameSpy = vi.fn();
      component.rename.subscribe(renameSpy);

      const input = openEditor();
      typeAndPress(input, '   ', 'Enter');

      expect(renameSpy).not.toHaveBeenCalled();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('maxlength')).toBe('24');
    });

    it('keeps the editor open and locked from the commit until the rename is saved', () => {
      component.rename.subscribe(() => fixture.componentRef.setInput('saving', true));

      const input = openEditor();
      typeAndPress(input, 'Studio TR', 'Enter');

      expect(input.isConnected).toBe(true);
      expect(input.disabled).toBe(true);
      expect(input.value).toBe('Studio TR');

      fixture.componentRef.setInput('saving', false);
      fixture.detectChanges();

      expect(input.isConnected).toBe(false);
    });

    it('still allows renaming an offline device', () => {
      fixture.componentRef.setInput('device', { ...mockDevice, deviceState: DeviceState.ConnectionLost });
      fixture.detectChanges();
      let renamed: { deviceId: string; name: string } | undefined;
      component.rename.subscribe((request) => (renamed = request));

      typeAndPress(openEditor(), 'Offline Rename', 'Enter');

      expect(renamed?.name).toBe('Offline Rename');
    });
  });

  describe('Device facts', () => {
    const fact = (testId: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

    it('shows machine, video, clock and hardware once known', () => {
      fixture.componentRef.setInput('device', {
        ...mockDevice,
        machine: DeviceMachine.C128,
        videoStandard: DeviceVideoStandard.Pal,
        todClockHz: 50,
        hardwareVariant: DeviceHardwareVariant.TeensyRomPlus,
      });
      fixture.detectChanges();

      expect(fact('device-machine-label')?.textContent).toContain('Machine: C128');
      expect(fact('device-video-label')?.textContent).toContain('Video: PAL');
      expect(fact('device-clock-label')?.textContent).toContain('TOD Clock: 50 Hz');
      expect(fact('device-hardware-label')?.textContent).toContain('Hardware: TeensyROM+');
    });

    it('names the original hardware without a plus', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      expect(fact('device-hardware-label')?.textContent).toContain('Hardware: TeensyROM');
      expect(fact('device-hardware-label')?.textContent).not.toContain('+');
    });

    it('hides a fact whose value is unknown', () => {
      fixture.componentRef.setInput('device', {
        ...mockDevice,
        machine: DeviceMachine.Unknown,
        videoStandard: DeviceVideoStandard.Unknown,
        todClockHz: null,
        hardwareVariant: DeviceHardwareVariant.Unknown,
      });
      fixture.detectChanges();

      expect(fact('device-machine-label')).toBeNull();
      expect(fact('device-video-label')).toBeNull();
      expect(fact('device-clock-label')).toBeNull();
      expect(fact('device-hardware-label')).toBeNull();
    });

    it('shows only the cartridge facts among the facts while offline', () => {
      fixture.componentRef.setInput('device', {
        ...mockDevice,
        deviceState: DeviceState.ConnectionLost,
        todClockHz: 60,
      });
      fixture.detectChanges();

      expect(fact('device-firmware-label')).toBeTruthy();
      expect(fact('device-hardware-label')).toBeTruthy();
      expect(fact('device-compatible-label')).toBeTruthy();
      expect(fact('device-machine-label')).toBeNull();
      expect(fact('device-video-label')).toBeNull();
      expect(fact('device-clock-label')).toBeNull();
    });
  });

  describe('Card layout', () => {
    const fact = (testId: string): HTMLElement =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
    const column = (testId: string): HTMLElement => fact(testId).parentElement as HTMLElement;
    const testIds = (container: HTMLElement): (string | null)[] =>
      Array.from(container.children).map((child) => child.getAttribute('data-testid'));

    it('lists the cartridge facts in the left column, with FW Compatible directly under Firmware', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      expect(testIds(column('device-id-label'))).toEqual([
        'device-id-label',
        'device-hardware-label',
        'device-firmware-label',
        'device-compatible-label',
      ]);
      expect(fact('device-compatible-label').textContent).toContain('FW Compatible: Yes');
    });

    it('lists the host and link in the right column', () => {
      fixture.componentRef.setInput('device', {
        ...mockDevice,
        todClockHz: 60,
      });
      fixture.detectChanges();

      expect(testIds(column('device-machine-label'))).toEqual([
        'device-machine-label',
        'device-video-label',
        'device-clock-label',
        'device-address-label',
      ]);
    });

    it('shows a USB-connected device by its port at the end of the right column', () => {
      fixture.componentRef.setInput('device', {
        ...mockDevice,
        todClockHz: 60,
        ipAddress: undefined,
      });
      fixture.detectChanges();

      expect(testIds(column('device-port-label'))).toEqual([
        'device-machine-label',
        'device-video-label',
        'device-clock-label',
        'device-port-label',
      ]);
      expect(fact('device-port-label').textContent).toContain('Port: COM3');
    });

    it('leaves only the Offline row in the right column while offline', () => {
      fixture.componentRef.setInput('device', {
        ...mockDevice,
        deviceState: DeviceState.ConnectionLost,
      });
      fixture.detectChanges();

      expect(testIds(column('device-offline-label'))).toEqual(['device-offline-label']);
      expect(column('device-offline-label')).not.toBe(column('device-id-label'));
    });

    it('keeps the storage tiles in their own container outside the facts', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      const storage = fixture.nativeElement.querySelector('[data-testid="device-storage"]');
      const info = fixture.nativeElement.querySelector('[data-testid="device-info"]');

      expect(testIds(storage)).toEqual(['usb-storage-status', 'sd-storage-status']);
      expect(info.contains(storage)).toBe(false);
    });
  });

  describe('Offline Functionality', () => {
    const offlineDevice: Device = {
      ...mockDevice,
      deviceState: DeviceState.ConnectionLost,
    };

    it('renders the offline label and forget button when offline', () => {
      fixture.componentRef.setInput('device', offlineDevice);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="device-offline-label"]')
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector('[data-testid="device-forget-button"]')
      ).toBeTruthy();
    });

    it('renders neither the offline label nor the forget button when online', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="device-offline-label"]')
      ).toBeFalsy();
      expect(
        fixture.nativeElement.querySelector('[data-testid="device-forget-button"]')
      ).toBeFalsy();
    });

    it('passes unknown to both storage tiles when offline', () => {
      fixture.componentRef.setInput('device', offlineDevice);
      fixture.detectChanges();

      const storages = fixture.debugElement.queryAll(By.directive(StorageStatusComponent));
      expect(storages[0].componentInstance.unknown()).toBe(true);
      expect(storages[1].componentInstance.unknown()).toBe(true);
    });

    it('shows "Reconnecting…" instead of "Offline" while reconnecting', () => {
      fixture.componentRef.setInput('device', offlineDevice);
      fixture.componentRef.setInput('reconnecting', true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Reconnecting…');
      expect(fixture.nativeElement.textContent).not.toContain('Offline');
    });

    it('emits reconnect with the device id when the power button is clicked while offline', () => {
      fixture.componentRef.setInput('device', offlineDevice);
      fixture.detectChanges();

      let reconnectedId = '';
      component.reconnect.subscribe((deviceId) => {
        reconnectedId = deviceId;
      });

      component.onPowerClick();

      expect(reconnectedId).toBe('test-device-1');
    });

    it('toggles enable/disable instead of reconnecting when the power button is clicked online', () => {
      fixture.componentRef.setInput('device', mockDevice);
      fixture.detectChanges();

      let disabledId = '';
      component.disable.subscribe((deviceId) => {
        disabledId = deviceId;
      });

      component.onPowerClick();

      expect(disabledId).toBe('test-device-1');
    });

    it('emits forget with the device id when the forget button is clicked', () => {
      fixture.componentRef.setInput('device', offlineDevice);
      fixture.detectChanges();

      let forgottenId = '';
      component.forget.subscribe((deviceId) => {
        forgottenId = deviceId;
      });

      component.onForget();

      expect(forgottenId).toBe('test-device-1');
    });

    it('disables the power button while reconnecting', () => {
      fixture.componentRef.setInput('device', offlineDevice);
      fixture.componentRef.setInput('reconnecting', true);
      fixture.detectChanges();

      const powerButton = fixture.nativeElement.querySelector(
        '[data-testid="device-power-button"] button'
      );
      expect(powerButton.disabled).toBe(true);
    });
  });
});
