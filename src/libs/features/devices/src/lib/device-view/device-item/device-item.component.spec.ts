import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DeviceItemComponent } from './device-item.component';
import { Device, DeviceStorage, DeviceState, StorageType } from '@teensyrom-nx/domain';
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
});
