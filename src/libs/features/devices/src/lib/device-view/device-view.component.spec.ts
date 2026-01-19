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
import { signal, computed } from '@angular/core';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DeviceStore } from '@teensyrom-nx/application';
import { vi } from 'vitest';

describe('DevicesComponent', () => {
  let component: DeviceViewComponent;
  let fixture: ComponentFixture<DeviceViewComponent>;

  beforeEach(async () => {
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
    const mockDeviceStore = {
      devices: mockDevices,
      isLoading: signal(false),
      hasEnabledDevices: computed(() => mockDevices().some((device: any) => device.isEnabled)),
      enableDevice: vi.fn(),
      disableDevice: vi.fn(),
    } as Partial<DeviceStore>;

    await TestBed.configureTestingModule({
      imports: [DeviceViewComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
        { provide: DEVICE_LOGS_SERVICE, useValue: mockLogsService },
        { provide: DeviceStore, useValue: mockDeviceStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
