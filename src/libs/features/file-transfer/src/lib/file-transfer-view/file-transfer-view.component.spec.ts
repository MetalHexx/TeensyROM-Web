import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, computed, Provider } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import {
  DeviceStore,
  PlayerStore,
  PLAYER_CONTEXT,
  StorageStore,
  TransferStore,
  TRANSFER_CONTEXT,
  ITransferContext,
} from '@teensyrom-nx/application';
import {
  Device,
  DeviceState,
  DeviceMachine,
  DeviceVideoStandard,
  DeviceHardwareVariant,
  StorageDirectory,
  StorageType,
  STORAGE_SERVICE,
  IStorageService,
  SETTINGS_SERVICE,
  WATCH_FOLDER_SERVICE,
} from '@teensyrom-nx/domain';
import { FileTransferViewComponent } from './file-transfer-view.component';
import { TransferToolbarComponent } from './transfer-toolbar/transfer-toolbar.component';

function createDevice(overrides: Partial<Device> = {}): Device {
  const deviceId = overrides.deviceId ?? 'device-1';
  return {
    deviceId,
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
  let mockTransferContext: ITransferContext;
  let searchMock: ReturnType<typeof vi.fn>;

  const setup = async (devices: Device[], extraProviders: Provider[] = []) => {
    devicesSignal = signal(devices);
    const usableDevicesSignal = computed(() =>
      devicesSignal().filter((d) => d.isEnabled && d.deviceState !== DeviceState.ConnectionLost)
    );
    getDirectoryMock = vi.fn().mockReturnValue(of(createMockDirectory()));
    searchMock = vi.fn().mockReturnValue(of([]));

    const mockStorageService: Partial<IStorageService> = {
      getDirectory: getDirectoryMock,
      index: vi.fn().mockResolvedValue({}),
      indexAll: vi.fn().mockResolvedValue({}),
      search: searchMock,
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

    mockTransferContext = {
      startTransfer: vi.fn().mockResolvedValue(undefined),
      retryCreate: vi.fn().mockResolvedValue(undefined),
      cancelTransfer: vi.fn().mockResolvedValue(undefined),
      closeTransfer: vi.fn().mockResolvedValue(undefined),
      showDetails: vi.fn().mockResolvedValue(undefined),
      hideDetails: vi.fn().mockResolvedValue(undefined),
      releaseOwnRecords: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [FileTransferViewComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: devicesSignal, usableDevices: usableDevicesSignal } },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: PlayerStore, useValue: mockPlayerStore },
        { provide: TRANSFER_CONTEXT, useValue: mockTransferContext },
        { provide: SETTINGS_SERVICE, useValue: { getSettings: () => of(null), saveSettings: () => of(undefined) } },
        { provide: WATCH_FOLDER_SERVICE, useValue: { list: vi.fn().mockResolvedValue([]) } },
        ...extraProviders,
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
    // First test in the file to hit TestBed.createComponent, which pays the one-time cost
    // of JIT-compiling this component. That cold compile can exceed the project's tight
    // 2000ms testTimeout under CI load; every later test here reuses the compiled TestBed
    // and stays fast, so only this test needs the extra headroom.
    it(
      'should create',
      async () => {
        await setup([createDevice()]);
        createFixture();
        expect(fixture.componentInstance).toBeTruthy();
      },
      10000,
    );

    it('should render the transfer header and content row when there are enabled devices', async () => {
      await setup([createDevice()]);
      createFixture();
      const native = fixture.nativeElement as HTMLElement;

      expect(native.querySelector('[data-testid="transfer-header"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="content-row"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="left-container"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="right-container"]')).toBeTruthy();
      expect(native.querySelector('lib-dropzone-card')).toBeTruthy();
      expect(native.querySelector('lib-transfer-toolbar')).toBeTruthy();
    });

    it('places the drop zone and the transfers card side by side, ahead of the toolbar', async () => {
      await setup([createDevice()]);
      createFixture();
      const native = fixture.nativeElement as HTMLElement;

      const row = native.querySelector('[data-testid="transfer-header-row"]');
      expect(row?.querySelector('lib-dropzone-card')).toBeTruthy();
      expect(row?.querySelector('lib-transfers-card')).toBeTruthy();
      expect(row?.querySelector('lib-transfer-toolbar')).toBeFalsy();
      expect(native.querySelector('lib-transfer-toolbar')).toBeTruthy();
    });

    it('renders the Devices card with a tree per enabled device in the left column', async () => {
      await setup([createDevice({ deviceId: 'a' }), createDevice({ deviceId: 'b' })]);
      createFixture();
      const native = fixture.nativeElement as HTMLElement;

      const left = native.querySelector('[data-testid="left-container"]');
      expect(left?.querySelector('lib-devices-tree-card')).toBeTruthy();
      expect(left?.querySelectorAll('lib-directory-tree-container').length).toBe(2);
      expect(native.querySelector('lib-device-selector')).toBeNull();
    });

    it('should render the empty-state message instead of the rows when there are no enabled devices', async () => {
      await setup([createDevice({ isEnabled: false })]);
      createFixture();
      const native = fixture.nativeElement as HTMLElement;

      expect(native.querySelector('[data-testid="no-devices-empty-state"]')).toBeTruthy();
      expect(native.querySelector('[data-testid="transfer-header"]')).toBeFalsy();
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

    it('seeds every enabled device, not just the target', async () => {
      const target = createDevice({ deviceId: 'target-device' });
      const other = createDevice({ deviceId: 'other-device' });
      await setup([target, other]);

      createFixture();

      expect(getDirectoryMock).toHaveBeenCalledWith('target-device', StorageType.Sd, '/');
      expect(getDirectoryMock).toHaveBeenCalledWith('other-device', StorageType.Sd, '/');
    });

    it('does not seed a disabled device', async () => {
      await setup([createDevice({ deviceId: 'on' }), createDevice({ deviceId: 'off', isEnabled: false })]);

      createFixture();

      expect(getDirectoryMock).not.toHaveBeenCalledWith('off', expect.anything(), expect.anything());
    });

    it('holds back a busy device and seeds it once its transfer ends', async () => {
      await setup([createDevice({ deviceId: 'idle-device' }), createDevice({ deviceId: 'busy-device' })]);
      transferStore.setActiveForeignJob({ deviceId: 'busy-device', activeForeignJobId: 'foreign-job' });

      createFixture();

      expect(getDirectoryMock).toHaveBeenCalledWith('idle-device', StorageType.Sd, '/');
      expect(getDirectoryMock).not.toHaveBeenCalledWith('busy-device', expect.anything(), expect.anything());

      transferStore.setActiveForeignJob({ deviceId: 'busy-device', activeForeignJobId: null });
      fixture.detectChanges();

      await vi.waitFor(() =>
        expect(getDirectoryMock).toHaveBeenCalledWith('busy-device', StorageType.Sd, '/')
      );
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

  describe('drop-target isolation', () => {
    const makeDropEvent = (items: unknown[]): DragEvent => {
      const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(event, 'dataTransfer', { value: { items }, configurable: true });
      return event;
    };

    it('registers no drop handler on the listing, and a drop with search active still reaches the dropzone card', async () => {
      const device = createDevice({ deviceId: 'device-a' });
      await setup([device]);
      createFixture();

      await vi.waitFor(() => expect(getDirectoryMock).toHaveBeenCalled());

      await storageStore.searchFiles({ deviceId: device.deviceId, searchText: 'aces high' });
      fixture.detectChanges();

      expect(storageStore.getSearchState(device.deviceId)()?.hasSearched).toBe(true);

      const native = fixture.nativeElement as HTMLElement;
      const listingContainer = native.querySelector('[data-testid="right-container"]') as HTMLElement;
      const dropzoneEl = native.querySelector('[data-testid="dropzone-card"]') as HTMLElement;
      expect(listingContainer).toBeTruthy();
      expect(dropzoneEl).toBeTruthy();

      // The listing has no drop handler of its own; a drop over it starts no transfer.
      listingContainer.dispatchEvent(makeDropEvent([{ webkitGetAsEntry: () => null }]));
      fixture.detectChanges();
      expect(mockTransferContext.startTransfer).not.toHaveBeenCalled();

      // The dropzone card is still the only drop target, and search being active does not
      // change the transfer's destination.
      const items = [{ webkitGetAsEntry: () => null }];
      dropzoneEl.dispatchEvent(makeDropEvent(items));
      fixture.detectChanges();

      expect(mockTransferContext.startTransfer).toHaveBeenCalledWith(device.deviceId, items);
    });
  });
  describe('transfer settings panel', () => {
    const gear = () =>
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="transfer-settings-button"] button'
      ) as HTMLButtonElement;
    const panel = () =>
      (fixture.nativeElement as HTMLElement).querySelector('lib-transfer-settings-panel');
    const slot = () => (fixture.nativeElement as HTMLElement).querySelector('lib-sliding-container.panel-slot');

    it('keeps the panel out of the view until the gear first opens it', async () => {
      await setup([createDevice()]);
      createFixture();

      expect(panel()).toBeNull();
      expect(gear().getAttribute('aria-expanded')).toBe('false');
    });

    it('opens and closes the panel from the gear, reflecting the state on the gear', async () => {
      await setup([createDevice()]);
      createFixture();

      gear().click();
      fixture.detectChanges();

      expect(fixture.componentInstance.panelOpen()).toBe(true);
      expect(panel()).toBeTruthy();
      expect(slot()?.classList.contains('panel-slot--open')).toBe(true);
      expect(gear().getAttribute('aria-expanded')).toBe('true');
      expect(gear().getAttribute('aria-label')).toBe('Close transfer settings');

      gear().click();
      fixture.detectChanges();

      expect(fixture.componentInstance.panelOpen()).toBe(false);
      expect(slot()?.classList.contains('panel-slot--open')).toBe(false);
      expect(gear().getAttribute('aria-expanded')).toBe('false');
    });

    it('moves focus into the panel when it opens', async () => {
      await setup([createDevice()]);
      createFixture();

      gear().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(slot()?.contains(document.activeElement)).toBe(true);
    });

    it('returns focus to the gear when the panel closes with focus inside it', async () => {
      await setup([createDevice()]);
      createFixture();
      gear().click();
      fixture.detectChanges();
      await fixture.whenStable();
      const toolbar = fixture.debugElement.query(By.directive(TransferToolbarComponent))
        .componentInstance as TransferToolbarComponent;
      const refocus = vi.spyOn(toolbar, 'focusSettingsButton');

      fixture.componentInstance.closePanel();

      expect(refocus).toHaveBeenCalled();
    });

    it('does not steal focus when the panel closes with focus elsewhere', async () => {
      await setup([createDevice()]);
      createFixture();
      gear().click();
      fixture.detectChanges();
      await fixture.whenStable();
      (document.activeElement as HTMLElement | null)?.blur();
      const toolbar = fixture.debugElement.query(By.directive(TransferToolbarComponent))
        .componentInstance as TransferToolbarComponent;
      const refocus = vi.spyOn(toolbar, 'focusSettingsButton');

      gear().click();

      expect(refocus).not.toHaveBeenCalled();
    });

    it('slides over 400ms, or instantly when the user prefers reduced motion', async () => {
      await setup([createDevice()]);
      createFixture();
      expect(fixture.componentInstance.panelAnimationDuration()).toBe(400);
      fixture.destroy();
      TestBed.resetTestingModule();

      await setup([createDevice()], [
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: true }) } },
      ]);
      createFixture();

      expect(fixture.componentInstance.panelAnimationDuration()).toBe(0);
    });
  });
});
