import { TestBed } from '@angular/core/testing';
import { DeviceStore } from './device-store';
import {
  DEVICE_STORAGE_SERVICE,
  DEVICE_SERVICE,
  IStorageService,
  IDeviceService,
} from '@teensyrom-nx/domain';
import { of, throwError } from 'rxjs';
import { StorageType, Device, DeviceState } from '@teensyrom-nx/domain';

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DeviceStore - indexStorage state updates', () => {
  let store: InstanceType<typeof DeviceStore>;
  let mockStorageService: IStorageService;
  let mockDeviceService: IDeviceService;

  const createMockDevice = (deviceId: string, overrides?: Partial<Device>): Device => ({
    deviceId,
    comPort: 'COM3',
    name: `Test Device ${deviceId}`,
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    ipAddress: undefined,
    tcpPort: undefined,
    usbStorage: {
      deviceId,
      type: StorageType.Usb,
      available: true,
      indexExists: false,
    },
    sdStorage: {
      deviceId,
      type: StorageType.Sd,
      available: true,
      indexExists: false,
    },
    ...overrides,
  });

  beforeEach(() => {
    mockStorageService = {
      index: vi.fn(),
      getDirectory: vi.fn(),
      indexAll: vi.fn(),
      search: vi.fn(),
      saveFavorite: vi.fn(),
      removeFavorite: vi.fn(),
      getFavorites: vi.fn(),
    } as unknown as IStorageService;

    mockDeviceService = {
      findDevices: vi.fn().mockReturnValue(of([])),
      resetDevice: vi.fn().mockReturnValue(of(void 0)),
      pingDevice: vi.fn().mockReturnValue(of(void 0)),
    };

    TestBed.configureTestingModule({
      providers: [
        DeviceStore,
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
      ],
    });

    store = TestBed.inject(DeviceStore);
  });

  describe('SD Storage Updates', () => {
    it('should update sdStorage.indexExists to true after successful SD indexing', async () => {
      // Setup initial state with index missing
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      // Mock successful indexing
      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      // Trigger indexing
      await store.indexStorage('device-1', StorageType.Sd);

      // Verify state updated
      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.sdStorage?.indexExists).toBe(true);
      expect(store.isIndexing()).toBe(false);
    });

    it('should not update indexExists when SD indexing fails', async () => {
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      // Mock indexing failure
      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error('Indexing failed')));

      // Trigger indexing
      await store.indexStorage('device-1', StorageType.Sd);

      // Verify indexExists still false
      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.sdStorage?.indexExists).toBe(false);
      expect(store.isIndexing()).toBe(false);
      expect(store.error()).toBe('Error: Indexing failed');
    });
  });

  describe('USB Storage Updates', () => {
    it('should update usbStorage.indexExists to true after successful USB indexing', async () => {
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Usb);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.usbStorage?.indexExists).toBe(true);
      expect(store.isIndexing()).toBe(false);
    });

    it('should not update indexExists when USB indexing fails', async () => {
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error('USB indexing failed')));

      await store.indexStorage('device-1', StorageType.Usb);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.usbStorage?.indexExists).toBe(false);
      expect(store.isIndexing()).toBe(false);
    });
  });

  describe('Multi-Device Scenarios', () => {
    it('should only update the indexed device, not others', async () => {
      const device1 = createMockDevice('device-1');
      const device2 = createMockDevice('device-2');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1, device2]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Sd);

      const updatedDevice1 = store.devices().find(d => d.deviceId === 'device-1');
      const updatedDevice2 = store.devices().find(d => d.deviceId === 'device-2');

      expect(updatedDevice1?.sdStorage?.indexExists).toBe(true);
      expect(updatedDevice2?.sdStorage?.indexExists).toBe(false); // Unchanged
    });

    it('should handle indexing different storage types on same device', async () => {
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      // Index SD storage
      await store.indexStorage('device-1', StorageType.Sd);
      let updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.sdStorage?.indexExists).toBe(true);
      expect(updatedDevice?.usbStorage?.indexExists).toBe(false);

      // Index USB storage
      await store.indexStorage('device-1', StorageType.Usb);
      updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.sdStorage?.indexExists).toBe(true); // Still true
      expect(updatedDevice?.usbStorage?.indexExists).toBe(true); // Now true
    });
  });

  describe('Property Preservation', () => {
    it('should preserve all device properties during update', async () => {
      const mockDevice = createMockDevice('device-1', {
        name: 'Test Device',
        fwVersion: '1.2.3',
        isCompatible: true,
        sdStorage: {
          deviceId: 'device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: false,
        },
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Sd);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');

      expect(updatedDevice?.name).toBe('Test Device');
      expect(updatedDevice?.fwVersion).toBe('1.2.3');
      expect(updatedDevice?.isCompatible).toBe(true);
      expect(updatedDevice?.sdStorage?.indexExists).toBe(true); // Only this changed
    });

    it('should not affect USB storage when indexing SD', async () => {
      const mockDevice = createMockDevice('device-1', {
        usbStorage: {
          deviceId: 'device-1',
          type: StorageType.Usb,
          available: true,
          indexExists: true, // Already indexed
        },
        sdStorage: {
          deviceId: 'device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: false,
        },
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Sd);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.usbStorage?.indexExists).toBe(true); // Unchanged
      expect(updatedDevice?.sdStorage?.indexExists).toBe(true); // Updated
    });

    it('should not affect SD storage when indexing USB', async () => {
      const mockDevice = createMockDevice('device-1', {
        usbStorage: {
          deviceId: 'device-1',
          type: StorageType.Usb,
          available: true,
          indexExists: false,
        },
        sdStorage: {
          deviceId: 'device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: true, // Already indexed
        },
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Usb);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.usbStorage?.indexExists).toBe(true); // Updated
      expect(updatedDevice?.sdStorage?.indexExists).toBe(true); // Unchanged
    });
  });

  describe('Undefined Storage Handling', () => {
    it('should handle device with undefined sdStorage', async () => {
      const mockDevice = createMockDevice('device-1', {
        sdStorage: undefined,
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Sd);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.sdStorage).toBeUndefined();
      expect(store.isIndexing()).toBe(false);
    });

    it('should handle device with undefined usbStorage', async () => {
      const mockDevice = createMockDevice('device-1', {
        usbStorage: undefined,
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorage('device-1', StorageType.Usb);

      const updatedDevice = store.devices().find(d => d.deviceId === 'device-1');
      expect(updatedDevice?.usbStorage).toBeUndefined();
      expect(store.isIndexing()).toBe(false);
    });
  });

  describe('isIndexing Flag', () => {
    it('should set isIndexing to true during indexing and false after success', async () => {
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      let resolveIndex: ((value: void) => void) | undefined;
      const indexPromise = new Promise<void>(resolve => {
        resolveIndex = resolve;
      });
      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(indexPromise);

      // Start indexing
      const indexingPromise = store.indexStorage('device-1', StorageType.Sd);
      
      // Should be true during indexing
      expect(store.isIndexing()).toBe(true);

      // Complete indexing
      if (resolveIndex) {
        resolveIndex(void 0);
      }
      await indexingPromise;

      // Should be false after completion
      expect(store.isIndexing()).toBe(false);
    });

    it('should set isIndexing to false after error', async () => {
      const mockDevice = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([mockDevice]));
      await store.findDevices();

      (mockStorageService.index as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error('Failed')));

      await store.indexStorage('device-1', StorageType.Sd);

      expect(store.isIndexing()).toBe(false);
    });
  });
});

describe('DeviceStore - indexStorageAllStorage', () => {
  let store: InstanceType<typeof DeviceStore>;
  let mockStorageService: IStorageService;
  let mockDeviceService: IDeviceService;

  const createMockDevice = (deviceId: string, overrides?: Partial<Device>): Device => ({
    deviceId,
    comPort: 'COM3',
    name: `Test Device ${deviceId}`,
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    ipAddress: undefined,
    tcpPort: undefined,
    usbStorage: {
      deviceId,
      type: StorageType.Usb,
      available: true,
      indexExists: false,
    },
    sdStorage: {
      deviceId,
      type: StorageType.Sd,
      available: true,
      indexExists: false,
    },
    ...overrides,
  });

  beforeEach(() => {
    mockStorageService = {
      index: vi.fn(),
      getDirectory: vi.fn(),
      indexAll: vi.fn(),
      search: vi.fn(),
      saveFavorite: vi.fn(),
      removeFavorite: vi.fn(),
      getFavorites: vi.fn(),
    } as unknown as IStorageService;

    mockDeviceService = {
      findDevices: vi.fn().mockReturnValue(of([])),
      resetDevice: vi.fn().mockReturnValue(of(void 0)),
      pingDevice: vi.fn().mockReturnValue(of(void 0)),
    };

    TestBed.configureTestingModule({
      providers: [
        DeviceStore,
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
      ],
    });

    store = TestBed.inject(DeviceStore);
  });

  describe('Successful Index All', () => {
    it('should update indexExists for all available storage on all devices', async () => {
      const device1 = createMockDevice('device-1');
      const device2 = createMockDevice('device-2');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1, device2]));
      await store.findDevices();

      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorageAllStorage();

      const devices = store.devices();
      expect(devices[0].sdStorage?.indexExists).toBe(true);
      expect(devices[0].usbStorage?.indexExists).toBe(true);
      expect(devices[1].sdStorage?.indexExists).toBe(true);
      expect(devices[1].usbStorage?.indexExists).toBe(true);
      expect(store.isIndexing()).toBe(false);
    });

    it('should only update available storage, not unavailable storage', async () => {
      const device1 = createMockDevice('device-1', {
        sdStorage: {
          deviceId: 'device-1',
          type: StorageType.Sd,
          available: true,
          indexExists: false,
        },
        usbStorage: {
          deviceId: 'device-1',
          type: StorageType.Usb,
          available: false, // Not available
          indexExists: false,
        },
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1]));
      await store.findDevices();

      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorageAllStorage();

      const device = store.devices()[0];
      expect(device.sdStorage?.indexExists).toBe(true); // Available - updated
      expect(device.usbStorage?.indexExists).toBe(false); // Not available - unchanged
    });

    it('should handle devices with undefined storage', async () => {
      const device1 = createMockDevice('device-1', {
        sdStorage: undefined,
        usbStorage: undefined,
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1]));
      await store.findDevices();

      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorageAllStorage();

      const device = store.devices()[0];
      expect(device.sdStorage).toBeUndefined();
      expect(device.usbStorage).toBeUndefined();
      expect(store.isIndexing()).toBe(false);
    });

    it('should preserve all other device properties', async () => {
      const device1 = createMockDevice('device-1', {
        name: 'Custom Name',
        fwVersion: '2.0.0',
        isCompatible: true,
        comPort: 'COM5',
      });
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1]));
      await store.findDevices();

      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(of(void 0));

      await store.indexStorageAllStorage();

      const device = store.devices()[0];
      expect(device.name).toBe('Custom Name');
      expect(device.fwVersion).toBe('2.0.0');
      expect(device.isCompatible).toBe(true);
      expect(device.comPort).toBe('COM5');
    });
  });

  describe('Error Handling', () => {
    it('should not update indexExists when indexAll fails', async () => {
      const device1 = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1]));
      await store.findDevices();

      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('Index all failed'))
      );

      await store.indexStorageAllStorage();

      const device = store.devices()[0];
      expect(device.sdStorage?.indexExists).toBe(false);
      expect(device.usbStorage?.indexExists).toBe(false);
      expect(store.isIndexing()).toBe(false);
      expect(store.error()).toBe('Error: Index all failed');
    });

    it('should set isIndexing to false after error', async () => {
      const device1 = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1]));
      await store.findDevices();

      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('Failed'))
      );

      await store.indexStorageAllStorage();

      expect(store.isIndexing()).toBe(false);
    });
  });

  describe('isIndexing Flag', () => {
    it('should set isIndexing to true during indexing and false after success', async () => {
      const device1 = createMockDevice('device-1');
      mockDeviceService.findDevices = vi.fn().mockReturnValue(of([device1]));
      await store.findDevices();

      let resolveIndexAll: ((value: void) => void) | undefined;
      const indexAllPromise = new Promise<void>(resolve => {
        resolveIndexAll = resolve;
      });
      (mockStorageService.indexAll as ReturnType<typeof vi.fn>).mockReturnValue(indexAllPromise);

      const indexingPromise = store.indexStorageAllStorage();

      expect(store.isIndexing()).toBe(true);

      if (resolveIndexAll) {
        resolveIndexAll(void 0);
      }
      await indexingPromise;

      expect(store.isIndexing()).toBe(false);
    });
  });
});
