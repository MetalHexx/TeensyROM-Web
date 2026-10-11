import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceViewComponent } from './device-view.component';
import {
  DEVICE_SERVICE,
  DEVICE_STORAGE_SERVICE,
  DEVICE_LOGS_SERVICE,
  IDeviceService,
  IStorageService,
  IDeviceLogsService,
  StorageDirectory,
} from '@teensyrom-nx/domain';
import { signal, computed, WritableSignal, Signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { DeviceStore } from '@teensyrom-nx/application';
import { vi } from 'vitest';

describe('DevicesComponent', () => {
  let component: DeviceViewComponent;
  let fixture: ComponentFixture<DeviceViewComponent>;
  let mockDeviceStore: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    devices: WritableSignal<any[]>;
    isLoading: WritableSignal<boolean>;
    reconnectingDeviceIds: WritableSignal<string[]>;
    hasEnabledDevices: Signal<boolean>;
    enableDevice: ReturnType<typeof vi.fn>;
    disableDevice: ReturnType<typeof vi.fn>;
    reconnectDevice: ReturnType<typeof vi.fn>;
    forgetDevice: ReturnType<typeof vi.fn>;
    renameDevice: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const setup = async () => {
    const mockDeviceService: Partial<IDeviceService> = {
      findDevices: () => of([]),
      resetDevice: () => of(undefined),
      pingDevice: () => of(undefined),
    };

    const mockStorageService: Partial<IStorageService> = {
      getDirectory: () => of({} as StorageDirectory),
      index: () => of({}),
      indexAll: () => of({}),
    };

    const mockLogsService: Partial<IDeviceLogsService> = {
      isConnected: signal(false),
      logs: signal([]),
      connect: () => {
        /* mock implementation */
      },
      disconnect: () => {
        /* mock implementation */
      },
      clear: () => {
        /* mock implementation */
      },
    };

    const mockDevices = signal([]);
    mockDeviceStore = {
      devices: mockDevices,
      isLoading: signal(false),
      reconnectingDeviceIds: signal<string[]>([]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hasEnabledDevices: computed(() => mockDevices().some((device: any) => device.isEnabled)),
      enableDevice: vi.fn(),
      disableDevice: vi.fn(),
      reconnectDevice: vi.fn(),
      forgetDevice: vi.fn(),
      renameDevice: vi.fn().mockResolvedValue(true),
    };

    mockDialog = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DeviceViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
        { provide: DEVICE_LOGS_SERVICE, useValue: mockLogsService },
        { provide: DeviceStore, useValue: mockDeviceStore },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('reconnect', () => {
    it('calls deviceStore.reconnectDevice with the device id', () => {
      component.onReconnect('device-1');

      expect(mockDeviceStore.reconnectDevice).toHaveBeenCalledWith('device-1');
    });

    it('reports a device as reconnecting when its id is in reconnectingDeviceIds', () => {
      mockDeviceStore.reconnectingDeviceIds.set(['device-1']);

      expect(component.isReconnecting('device-1')).toBe(true);
      expect(component.isReconnecting('device-2')).toBe(false);
    });
  });

  describe('rename', () => {
    it('calls deviceStore.renameDevice with the device id and the new name', async () => {
      await component.onRename({ deviceId: 'device-1', name: 'Studio TR' });

      expect(mockDeviceStore.renameDevice).toHaveBeenCalledWith('device-1', 'Studio TR');
    });

    it('marks the device as renaming until the store call settles', async () => {
      let finish: (renamed: boolean) => void = () => undefined;
      mockDeviceStore.renameDevice.mockReturnValueOnce(
        new Promise<boolean>((resolve) => (finish = resolve))
      );

      const pending = component.onRename({ deviceId: 'device-1', name: 'Studio TR' });

      expect(component.isRenaming('device-1')).toBe(true);
      expect(component.isRenaming('device-2')).toBe(false);

      finish(true);
      await pending;

      expect(component.isRenaming('device-1')).toBe(false);
    });

    it('clears the renaming mark when the store reports the rename failed', async () => {
      mockDeviceStore.renameDevice.mockResolvedValueOnce(false);

      await component.onRename({ deviceId: 'device-1', name: 'Studio TR' });

      expect(component.isRenaming('device-1')).toBe(false);
    });
  });

  describe('forget', () => {
    it('opens the house confirmation dialog with the expected inputs', () => {
      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const confirmRef = {
        close: vi.fn(),
        componentInstance: { confirmed, cancelled },
        componentRef: { setInput: vi.fn() },
      };
      mockDialog.open.mockReturnValue(confirmRef);

      component.onForget('device-1');

      expect(mockDialog.open).toHaveBeenCalledWith(expect.anything(), {
        disableClose: true,
        panelClass: 'glassy-dialog',
        backdropClass: 'busy-dialog-backdrop',
      });
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('title', 'Forget device?');
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith(
        'message',
        "device-1 will be removed from the list.\nDiscover Devices finds it again when it's connected."
      );
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('confirmLabel', 'Forget');
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('cancelLabel', 'Cancel');
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('showLabels', true);
    });

    it('calls forgetDevice and closes the dialog on confirmation', () => {
      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const confirmRef = {
        close: vi.fn(),
        componentInstance: { confirmed, cancelled },
        componentRef: { setInput: vi.fn() },
      };
      mockDialog.open.mockReturnValue(confirmRef);

      component.onForget('device-1');
      confirmed.next();

      expect(mockDeviceStore.forgetDevice).toHaveBeenCalledWith('device-1');
      expect(confirmRef.close).toHaveBeenCalled();
    });

    it('does nothing but close the dialog on cancellation', () => {
      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const confirmRef = {
        close: vi.fn(),
        componentInstance: { confirmed, cancelled },
        componentRef: { setInput: vi.fn() },
      };
      mockDialog.open.mockReturnValue(confirmRef);

      component.onForget('device-1');
      cancelled.next();

      expect(mockDeviceStore.forgetDevice).not.toHaveBeenCalled();
      expect(confirmRef.close).toHaveBeenCalled();
    });
  });
});
