import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentRef, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { VideoCaptureComponent } from './video-capture.component';
import { SettingsStore } from '@teensyrom-nx/application';
import { vi, describe, it, expect, afterEach } from 'vitest';

describe('VideoCaptureComponent', () => {
  let component: VideoCaptureComponent;
  let componentRef: ComponentRef<VideoCaptureComponent>;
  let fixture: ComponentFixture<VideoCaptureComponent>;
  let mockSettingsStore: ReturnType<typeof createMockSettingsStore>;
  let mockDialog: Partial<MatDialog>;
  
  // Track mock function calls
  let enumerateDevicesSpy: ReturnType<typeof vi.fn>;
  let getUserMediaSpy: ReturnType<typeof vi.fn>;
  
  // Store the original navigator.mediaDevices for restoration
  let originalMediaDevices: MediaDevices | undefined;
  
  // Signal to control the stored video device ID per test
  let storedVideoDeviceIdSignal: WritableSignal<string>;

  function createMockSettingsStore() {
    storedVideoDeviceIdSignal = signal('');
    
    return {
      // Return a function that returns the signal (matches real store pattern)
      videoDeviceIdForDevice: vi.fn().mockImplementation(() => storedVideoDeviceIdSignal),
      updateDeviceVideoDeviceId: vi.fn(),
    };
  }

  function createMockMediaDevices(devices: { deviceId: string; label: string }[]) {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{
        label: 'Mock Camera',
        getSettings: () => ({ width: 1920, height: 1080 }),
        enabled: true,
        readyState: 'live',
        stop: vi.fn(),
      }],
    } as unknown as MediaStream;

    enumerateDevicesSpy = vi.fn().mockResolvedValue(
      devices.map(d => ({
        deviceId: d.deviceId,
        label: d.label,
        kind: 'videoinput' as MediaDeviceKind,
        groupId: '',
        toJSON: () => ({}),
      }))
    );

    getUserMediaSpy = vi.fn().mockResolvedValue(mockStream);

    return {
      enumerateDevices: enumerateDevicesSpy,
      getUserMedia: getUserMediaSpy,
    } as unknown as MediaDevices;
  }

  function setupMediaDevices(devices: { deviceId: string; label: string }[]) {
    originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: createMockMediaDevices(devices),
      configurable: true,
      writable: true,
    });
  }

  function restoreMediaDevices() {
    if (originalMediaDevices !== undefined) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
        writable: true,
      });
    }
  }

  afterEach(() => {
    restoreMediaDevices();
    TestBed.resetTestingModule();
  });

  async function setupTestBed(
    devices: { deviceId: string; label: string }[],
    storedVideoDeviceId = ''
  ) {
    // Reset devices mock
    restoreMediaDevices();
    setupMediaDevices(devices);
    
    // Create mock store with configured stored value
    mockSettingsStore = createMockSettingsStore();
    storedVideoDeviceIdSignal.set(storedVideoDeviceId);
    
    mockDialog = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VideoCaptureComponent],
      providers: [
        provideNoopAnimations(),
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();
  }

  async function createComponent(teensyDeviceId: string) {
    fixture = TestBed.createComponent(VideoCaptureComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('deviceId', teensyDeviceId);
    fixture.detectChanges();
    // Allow async enumeration to complete
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('component creation', () => {
    it('should create', async () => {
      await setupTestBed([]);
      await createComponent('teensy-123');
      expect(component).toBeTruthy();
    });

    it('should inject SettingsStore and query for stored device', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-123');
      // Verify the store was used during initialization
      expect(mockSettingsStore.videoDeviceIdForDevice).toHaveBeenCalledWith('teensy-123');
    });
  });

  describe('initial device selection with stored preference', () => {
    it('should use stored device when available in device list', async () => {
      await setupTestBed(
        [
          { deviceId: 'cam-123', label: 'Front Camera' },
          { deviceId: 'cam-456', label: 'Back Camera' },
        ],
        'cam-123'
      );

      await createComponent('teensy-device-1');

      // Should query for stored device
      expect(mockSettingsStore.videoDeviceIdForDevice).toHaveBeenCalledWith('teensy-device-1');
      
      // Should select the stored device (cam-123)
      expect(component.selectedDevice()).toBe('cam-123');
    });

    it('should fall back to first device when stored device not in available list', async () => {
      await setupTestBed(
        [
          { deviceId: 'cam-123', label: 'Front Camera' },
          { deviceId: 'cam-456', label: 'Back Camera' },
        ],
        'cam-xyz' // Non-existent device
      );

      await createComponent('teensy-device-1');

      // Should fall back to first device
      expect(component.selectedDevice()).toBe('cam-123');
    });

    it('should fall back to first device when no stored preference exists', async () => {
      await setupTestBed(
        [
          { deviceId: 'cam-123', label: 'Front Camera' },
          { deviceId: 'cam-456', label: 'Back Camera' },
        ],
        '' // Empty = no stored preference
      );

      await createComponent('teensy-device-1');

      // Should fall back to first device
      expect(component.selectedDevice()).toBe('cam-123');
    });

    it('should not select any device when no devices available', async () => {
      await setupTestBed([], 'cam-123'); // Stored device but no devices available

      await createComponent('teensy-device-1');

      // Should have no selection
      expect(component.selectedDevice()).toBeNull();
    });
  });

  describe('device selection persistence', () => {
    it('should persist selection when user selects a device', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
        { deviceId: 'cam-456', label: 'Back Camera' },
      ]);

      await createComponent('teensy-device-1');

      // Simulate user selecting a different device
      component.onDeviceSelected('cam-456');

      // Should persist the selection
      expect(mockSettingsStore.updateDeviceVideoDeviceId).toHaveBeenCalledWith({
        deviceId: 'teensy-device-1',
        videoDeviceId: 'cam-456',
      });
    });

    it('should update local state when user selects a device', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
        { deviceId: 'cam-456', label: 'Back Camera' },
      ]);

      await createComponent('teensy-device-1');

      // Simulate user selecting a different device
      component.onDeviceSelected('cam-456');

      // Should update local state
      expect(component.selectedDevice()).toBe('cam-456');
    });
  });

  describe('device enumeration', () => {
    it('should enumerate video devices on init', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);

      await createComponent('teensy-device-1');

      expect(enumerateDevicesSpy).toHaveBeenCalled();
    });

    it('should expose available devices', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
        { deviceId: 'cam-456', label: 'Back Camera' },
      ]);

      await createComponent('teensy-device-1');

      expect(component.devices()).toHaveLength(2);
      expect(component.devices()[0]).toEqual({ deviceId: 'cam-123', label: 'Front Camera' });
      expect(component.devices()[1]).toEqual({ deviceId: 'cam-456', label: 'Back Camera' });
    });

    it('should indicate when devices are available', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);

      await createComponent('teensy-device-1');

      expect(component.hasDevices()).toBe(true);
    });

    it('should indicate when no devices are available', async () => {
      await setupTestBed([]);

      await createComponent('teensy-device-1');

      expect(component.hasDevices()).toBe(false);
    });
  });
});
