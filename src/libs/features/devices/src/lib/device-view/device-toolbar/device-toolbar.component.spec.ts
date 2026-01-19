import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceToolbarComponent } from './device-toolbar.component';
import {
  DEVICE_SERVICE,
  DEVICE_STORAGE_SERVICE,
  DEVICE_LOGS_SERVICE,
  IDeviceService,
  IStorageService,
  IDeviceLogsService,
  StorageDirectory,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '@teensyrom-nx/application';
import { signal, computed, Signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

/**
 * Mock contract for DeviceStore as used by DeviceToolbarComponent
 * Defines only the public interface the component depends on
 */
interface MockDeviceStoreContract {
  findDevices: ReturnType<typeof vi.fn>;
  indexStorageAllStorage: ReturnType<typeof vi.fn>;
  resetAllDevices: ReturnType<typeof vi.fn>;
  pingAllDevices: ReturnType<typeof vi.fn>;
  hasEnabledDevices: Signal<boolean>;
}

describe('DeviceToolbarComponent', () => {
  let component: DeviceToolbarComponent;
  let fixture: ComponentFixture<DeviceToolbarComponent>;
  let mockDeviceStore: MockDeviceStoreContract;
  let enabledDevicesSignal: ReturnType<typeof signal<boolean>>;

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

    // Create a writable signal that we can update in tests
    enabledDevicesSignal = signal(false);

    // Create a mock DeviceStore with spy methods and a computed property based on the signal
    mockDeviceStore = {
      findDevices: vi.fn(),
      indexStorageAllStorage: vi.fn(),
      resetAllDevices: vi.fn(),
      pingAllDevices: vi.fn(),
      hasEnabledDevices: computed(() => enabledDevicesSignal()),
    };

    await TestBed.configureTestingModule({
      imports: [DeviceToolbarComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
        { provide: DEVICE_LOGS_SERVICE, useValue: mockLogsService },
        { provide: DeviceStore, useValue: mockDeviceStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should render toolbar in the DOM', () => {
      const toolbar = fixture.nativeElement.querySelector('[data-testid="device-toolbar"]');
      expect(toolbar).toBeTruthy();
    });
  });

  describe('hasEnabledDevices Selector', () => {
    it('should disable action buttons when no devices are enabled', () => {
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(true);
    });

    it('should enable action buttons when at least one device is enabled', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(false);
    });
  });

  describe('Button Disabled State Bindings', () => {
    it('should disable Index All button when hasEnabledDevices is false', () => {
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(true);
    });

    it('should enable Index All button when hasEnabledDevices is true', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(false);
    });

    it('should disable Reset Devices button when hasEnabledDevices is false', () => {
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      const resetButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-reset-devices"] button'
      );
      expect(resetButton?.disabled).toBe(true);
    });

    it('should enable Reset Devices button when hasEnabledDevices is true', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const resetButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-reset-devices"] button'
      );
      expect(resetButton?.disabled).toBe(false);
    });

    it('should disable Ping Devices button when hasEnabledDevices is false', () => {
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      const pingButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-ping-devices"] button'
      );
      expect(pingButton?.disabled).toBe(true);
    });

    it('should enable Ping Devices button when hasEnabledDevices is true', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const pingButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-ping-devices"] button'
      );
      expect(pingButton?.disabled).toBe(false);
    });

    it('should keep Discover Devices button always enabled regardless of enabled state', () => {
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      const refreshButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-discover-devices"] button'
      );
      expect(refreshButton?.disabled).toBe(false);

      // Change to true and verify still enabled
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      expect(refreshButton?.disabled).toBe(false);
    });
  });

  describe('Button Event Handlers', () => {
    it('should call deviceStore.indexStorageAllStorage when Index All button clicked', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      indexAllButton.click();

      expect(mockDeviceStore.indexStorageAllStorage).toHaveBeenCalled();
    });

    it('should call deviceStore.findDevices with fullScan=true when Discover Devices button clicked', () => {
      const refreshButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-discover-devices"] button'
      );
      refreshButton.click();

      expect(mockDeviceStore.findDevices).toHaveBeenCalledWith(true);
    });

    it('should call deviceStore.resetAllDevices when Reset Devices button clicked', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const resetButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-reset-devices"] button'
      );
      resetButton.click();

      expect(mockDeviceStore.resetAllDevices).toHaveBeenCalled();
    });

    it('should call deviceStore.pingAllDevices when Ping Devices button clicked', () => {
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      const pingButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-ping-devices"] button'
      );
      pingButton.click();

      expect(mockDeviceStore.pingAllDevices).toHaveBeenCalled();
    });
  });

  describe('Button Visibility and Labels', () => {
    it('should render toolbar container with correct data-testid', () => {
      const toolbar = fixture.nativeElement.querySelector('[data-testid="device-toolbar"]');
      expect(toolbar).toBeTruthy();
    });

    it('should render all four buttons with correct data-testid attributes', () => {
      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"]'
      );
      const refreshButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-discover-devices"]'
      );
      const resetButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-reset-devices"]'
      );
      const pingButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-ping-devices"]'
      );

      expect(indexAllButton).toBeTruthy();
      expect(refreshButton).toBeTruthy();
      expect(resetButton).toBeTruthy();
      expect(pingButton).toBeTruthy();
    });

    it('should display correct button labels', () => {
      const indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"]'
      );
      const refreshButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-discover-devices"]'
      );
      const resetButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-reset-devices"]'
      );
      const pingButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-ping-devices"]'
      );

      expect(indexAllButton.textContent).toContain('Index All');
      expect(refreshButton.textContent).toContain('Discover Devices');
      expect(resetButton.textContent).toContain('Reset Devices');
      expect(pingButton.textContent).toContain('Ping Devices');
    });
  });

  describe('Reactive State Changes', () => {
    it('should update button disabled state reactively when hasEnabledDevices changes', () => {
      // Start with no enabled devices
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      let indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(true);

      // Simulate device being enabled
      enabledDevicesSignal.set(true);
      fixture.detectChanges();

      indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(false);

      // Simulate device being disabled
      enabledDevicesSignal.set(false);
      fixture.detectChanges();

      indexAllButton = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-button-index-all"] button'
      );
      expect(indexAllButton?.disabled).toBe(true);
    });
  });
});
