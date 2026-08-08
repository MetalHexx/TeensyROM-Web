import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  DeviceStore,
  PlayerStore,
  PLAYER_CONTEXT,
  StorageStore,
  TransferStore,
} from '@teensyrom-nx/application';
import {
  Device,
  DeviceState,
  StorageDirectory,
  StorageType,
  STORAGE_SERVICE,
  IStorageService,
} from '@teensyrom-nx/domain';
import { FileTransferViewComponent } from './file-transfer-view.component';

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

const createMockDirectory = (path = '/'): StorageDirectory => ({
  path,
  directories: [],
  files: [],
});

describe('FileTransferViewComponent', () => {
  let fixture: ComponentFixture<FileTransferViewComponent>;
  let devicesSignal: ReturnType<typeof signal<Device[]>>;
  let transferStore: InstanceType<typeof TransferStore>;
  let storageStore: InstanceType<typeof StorageStore>;
  let getDirectoryMock: ReturnType<typeof vi.fn>;
  let mockPlayerContext: Record<string, ReturnType<typeof vi.fn>>;
  let mockPlayerStore: Record<string, ReturnType<typeof vi.fn>>;

  const setup = async (devices: Device[]) => {
    devicesSignal = signal(devices);
    getDirectoryMock = vi.fn().mockReturnValue(of(createMockDirectory()));

    const mockStorageService: Partial<IStorageService> = {
      getDirectory: getDirectoryMock,
      index: vi.fn().mockResolvedValue({}),
      indexAll: vi.fn().mockResolvedValue({}),
      search: vi.fn(),
      saveFavorite: vi.fn(),
      removeFavorite: vi.fn(),
    };

    mockPlayerContext = {
      initializePlayer: vi.fn(),
      launchFileWithContext: vi.fn(),
      launchRandomFile: vi.fn(),
      play: vi.fn(),
    };

    mockPlayerStore = {
      setCurrentFile: vi.fn(),
      launch: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [FileTransferViewComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: devicesSignal } },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: PlayerStore, useValue: mockPlayerStore },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
    storageStore = TestBed.inject(StorageStore);
  };

  const createFixture = () => {
    fixture = TestBed.createComponent(FileTransferViewComponent);
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
  });

  describe('rendering', () => {
    it('should create', async () => {
      await setup([createDevice()]);
      createFixture();
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render the top row and content row when there are enabled devices', async () => {
      await setup([createDevice()]);
      createFixture();
      const native = fixture.nativeElement as HTMLElement;

      expect(native.querySelector('[data-testid="top-row"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="content-row"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="left-container"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="right-container"]')).toBeTruthy();
      expect(native.querySelector('lib-destination-card')).toBeTruthy();
      expect(native.querySelector('lib-transfer-status-card')).toBeTruthy();
    });

    it('should render the empty-state message instead of the rows when there are no enabled devices', async () => {
      await setup([createDevice({ isEnabled: false })]);
      createFixture();
      const native = fixture.nativeElement as HTMLElement;

      expect(native.querySelector('[data-testid="no-devices-empty-state"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="top-row"]')).toBeFalsy();
      expect(native.querySelector('[data-testid="content-row"]')).toBeFalsy();
    });
  });

  describe('target resolution', () => {
    it('keeps a stored target that is still an enabled device', async () => {
      const deviceA = createDevice({ deviceId: 'device-a' });
      const deviceB = createDevice({ deviceId: 'device-b' });
      await setup([deviceA, deviceB]);
      transferStore.setTargetDevice({ deviceId: 'device-b' });

      createFixture();

      expect(fixture.componentInstance.targetDevice()?.deviceId).toBe('device-b');
      expect(transferStore.getTargetDeviceId()()).toBe('device-b');
    });

    it('falls back to the first enabled device when the stored target is no longer enabled', async () => {
      const deviceA = createDevice({ deviceId: 'device-a' });
      const deviceB = createDevice({ deviceId: 'device-b' });
      await setup([deviceA, deviceB]);
      transferStore.setTargetDevice({ deviceId: 'now-disabled-device' });

      createFixture();

      expect(fixture.componentInstance.targetDevice()?.deviceId).toBe('device-a');
      expect(transferStore.getTargetDeviceId()()).toBe('device-a');
    });

    it('leaves the target null and renders the empty state when there are no enabled devices', async () => {
      await setup([]);

      createFixture();

      expect(fixture.componentInstance.targetDevice()).toBeNull();
    });
  });

  describe('storage seeding', () => {
    it('seeds only the available storages of the target device', async () => {
      const device = createDevice({
        deviceId: 'device-a',
        sdStorage: { deviceId: 'device-a', type: StorageType.Sd, available: true, indexExists: false },
        usbStorage: { deviceId: 'device-a', type: StorageType.Usb, available: false, indexExists: false },
      });
      await setup([device]);

      createFixture();

      expect(getDirectoryMock).toHaveBeenCalledWith('device-a', StorageType.Sd, '/');
      expect(getDirectoryMock).not.toHaveBeenCalledWith('device-a', StorageType.Usb, '/');
    });

    it('seeds both storages when both are available', async () => {
      const device = createDevice({
        deviceId: 'device-a',
        sdStorage: { deviceId: 'device-a', type: StorageType.Sd, available: true, indexExists: false },
        usbStorage: { deviceId: 'device-a', type: StorageType.Usb, available: true, indexExists: false },
      });
      await setup([device]);

      createFixture();

      expect(getDirectoryMock).toHaveBeenCalledWith('device-a', StorageType.Sd, '/');
      await vi.waitFor(() =>
        expect(getDirectoryMock).toHaveBeenCalledWith('device-a', StorageType.Usb, '/')
      );
    });

    it('does not seed a non-target enabled device', async () => {
      const target = createDevice({ deviceId: 'target-device' });
      const other = createDevice({ deviceId: 'other-device' });
      await setup([target, other]);

      createFixture();

      expect(getDirectoryMock).not.toHaveBeenCalledWith('other-device', expect.anything(), expect.anything());
    });
  });

  describe('navigation pin lifecycle', () => {
    it('sets the pin for the resolved target on mount', async () => {
      const device = createDevice({ deviceId: 'device-a' });
      await setup([device]);
      const setPinSpy = vi.spyOn(storageStore, 'setNavigationPin');

      createFixture();

      expect(setPinSpy).toHaveBeenCalledWith({ deviceId: 'device-a' });
      expect(storageStore.navigationPin()).toBe('device-a');
    });

    it('releases the old pin before taking the new one when the target changes', async () => {
      const deviceA = createDevice({ deviceId: 'device-a' });
      const deviceB = createDevice({ deviceId: 'device-b' });
      await setup([deviceA, deviceB]);
      createFixture();

      const clearPinSpy = vi.spyOn(storageStore, 'clearNavigationPin');
      const setPinSpy = vi.spyOn(storageStore, 'setNavigationPin');

      transferStore.setTargetDevice({ deviceId: 'device-b' });
      fixture.detectChanges();

      expect(clearPinSpy).toHaveBeenCalledWith({ deviceId: 'device-a' });
      expect(setPinSpy).toHaveBeenCalledWith({ deviceId: 'device-b' });
      expect(clearPinSpy.mock.invocationCallOrder[0]).toBeLessThan(
        setPinSpy.mock.invocationCallOrder[0]
      );
      expect(storageStore.navigationPin()).toBe('device-b');
    });

    it('clears the pin on destroy', async () => {
      const device = createDevice({ deviceId: 'device-a' });
      await setup([device]);
      createFixture();

      const clearPinSpy = vi.spyOn(storageStore, 'clearNavigationPin');
      fixture.destroy();

      expect(clearPinSpy).toHaveBeenCalledWith({ deviceId: 'device-a' });
      expect(storageStore.navigationPin()).toBeNull();
    });

    it('releases the pin it actually holds on destroy, not a recomputed target', async () => {
      const deviceA = createDevice({ deviceId: 'device-a' });
      const deviceB = createDevice({ deviceId: 'device-b' });
      await setup([deviceA]);
      createFixture();

      const clearPinSpy = vi.spyOn(storageStore, 'clearNavigationPin');

      // Change the enabled device list without an intervening change-detection cycle, so the
      // pin-take effect has not re-run before destroy fires: the view still holds device-a's pin
      // even though the recomputed target is now device-b.
      devicesSignal.set([deviceB]);
      transferStore.setTargetDevice({ deviceId: 'device-b' });
      fixture.destroy();

      expect(clearPinSpy).toHaveBeenCalledWith({ deviceId: 'device-a' });
      expect(storageStore.navigationPin()).toBeNull();
    });
  });

  describe('player isolation', () => {
    it('invokes no player store or player context method when a target is selected', async () => {
      const deviceA = createDevice({ deviceId: 'device-a' });
      const deviceB = createDevice({ deviceId: 'device-b' });
      await setup([deviceA, deviceB]);
      createFixture();

      transferStore.setTargetDevice({ deviceId: 'device-b' });
      fixture.detectChanges();

      Object.values(mockPlayerContext).forEach((fn) => expect(fn).not.toHaveBeenCalled());
      Object.values(mockPlayerStore).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    });
  });
});
