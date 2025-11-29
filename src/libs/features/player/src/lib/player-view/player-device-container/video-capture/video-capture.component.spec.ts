import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { VideoCaptureComponent } from './video-capture.component';
import { SETTINGS_SERVICE, ISettingsService } from '@teensyrom-nx/domain';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { of } from 'rxjs';

/**
 * VideoCaptureComponent Tests
 * 
 * Note: This component uses the SettingsStore (providedIn: 'root') signal store which
 * is difficult to mock in tests. The store integration is tested via the logs showing
 * the correct behavior. These tests focus on:
 * 1. Component creation and basic structure
 * 2. Device enumeration mechanics (mocked navigator.mediaDevices)
 * 3. Device selection UI behavior
 * 4. CRT effect state management
 * 5. Composed component integration
 * 
 * The store persistence behavior is verified via:
 * - Action unit tests in settings/actions/update-device-video-device-id.spec.ts
 * - Selector unit tests in settings/selectors/select-video-device-for-device.spec.ts
 */
describe('VideoCaptureComponent', () => {
  let component: VideoCaptureComponent;
  let componentRef: ComponentRef<VideoCaptureComponent>;
  let fixture: ComponentFixture<VideoCaptureComponent>;
  let mockDialog: Partial<MatDialog>;
  let mockSettingsService: Partial<ISettingsService>;
  
  // Track mock function calls
  let enumerateDevicesSpy: ReturnType<typeof vi.fn>;
  let getUserMediaSpy: ReturnType<typeof vi.fn>;
  
  // Store the original navigator.mediaDevices for restoration
  let originalMediaDevices: MediaDevices | undefined;

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
    devices: { deviceId: string; label: string }[]
  ) {
    // Reset devices mock
    restoreMediaDevices();
    setupMediaDevices(devices);
    
    mockDialog = {
      open: vi.fn(),
    };
    
    // Mock the settings service required by SettingsStore
    mockSettingsService = {
      getSettings: vi.fn().mockReturnValue(of({
        playerSettings: {
          startPath: '/',
          filterType: 'All',
          scopeType: 'All',
        },
        searchSettings: {
          searchPath: '/',
        },
        fileTransferSettings: {
          targetPath: '/',
        },
        appSettings: {
          playTimerEnabled: false,
          playTimerSeconds: 60,
        },
        knownDevices: [],
      })),
      saveSettings: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [VideoCaptureComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialog, useValue: mockDialog },
        { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA], // For shallow testing of composed components
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

    it('should have required deviceId input', async () => {
      await setupTestBed([]);
      await createComponent('teensy-device-1');
      // The deviceId input should be set
      expect(component.deviceId()).toBe('teensy-device-1');
    });
  });

  describe('device selection behavior', () => {
    it('should update selectedDevice when onDeviceSelected is called', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
        { deviceId: 'cam-456', label: 'Back Camera' },
      ]);
      await createComponent('teensy-device-1');

      // Simulate user selecting a device
      component.onDeviceSelected('cam-456');

      // Should update local state
      expect(component.selectedDevice()).toBe('cam-456');
    });

    it('should request media stream when device is selected', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
        { deviceId: 'cam-456', label: 'Back Camera' },
      ]);
      await createComponent('teensy-device-1');

      // Reset the spy to clear initial calls
      getUserMediaSpy.mockClear();

      // Simulate user selecting a device
      component.onDeviceSelected('cam-456');

      // Allow async operations
      await fixture.whenStable();

      // Should request the selected device
      expect(getUserMediaSpy).toHaveBeenCalledWith({
        video: { deviceId: { exact: 'cam-456' } },
        audio: false,
      });
    });
  });

  describe('device enumeration', () => {
    it('should request user media permission on init', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      // Should have requested permission via getUserMedia
      expect(getUserMediaSpy).toHaveBeenCalled();
    });

    it('should call enumerateDevices after getting permission', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      expect(enumerateDevicesSpy).toHaveBeenCalled();
    });

    it('should indicate when no devices are available', async () => {
      await setupTestBed([]);
      await createComponent('teensy-device-1');

      expect(component.hasDevices()).toBe(false);
    });
  });

  describe('stream management', () => {
    it('should initially have no stream', async () => {
      await setupTestBed([]);
      
      // Create component but don't wait for async operations
      fixture = TestBed.createComponent(VideoCaptureComponent);
      component = fixture.componentInstance;
      componentRef = fixture.componentRef;
      componentRef.setInput('deviceId', 'teensy-123');
      
      // Before any async operations, hasStream should be false
      expect(component.hasStream()).toBe(false);
    });
  });

  describe('CRT effects', () => {
    it('should have CRT enabled by default', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      expect(component['isCrtEnabled']()).toBe(true);
    });

    it('should toggle CRT effect when toggleCrtEffect is called', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      const initialState = component['isCrtEnabled']();
      component.toggleCrtEffect();
      expect(component['isCrtEnabled']()).toBe(!initialState);
    });

    it('should toggle CRT controls panel visibility', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      expect(component['showCrtControls']()).toBe(false);
      component.toggleCrtControls();
      expect(component['showCrtControls']()).toBe(true);
    });

    it('should update CRT settings when onCrtSettingsChange is called', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      const newSettings = {
        scanlineIntensity: 0.7,
        scanlineThickness: 4,
        scanlineSpacing: 3,
        vignetteStrength: 1.5,
        screenCurvature: 0,
        contrast: 1.2,
        brightness: 1.6,
        saturation: 1.4,
      };

      component.onCrtSettingsChange(newSettings);
      expect(component['crtSettings']()).toEqual(newSettings);
    });

    it('should reset CRT settings to standard preset', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      // Change settings first
      component.onCrtSettingsChange({
        scanlineIntensity: 0.9,
        scanlineThickness: 5,
        scanlineSpacing: 4,
        vignetteStrength: 2.0,
        screenCurvature: 0,
        contrast: 1.5,
        brightness: 2.0,
        saturation: 2.0,
      });

      // Reset should restore small preset (current default)
      component.onCrtReset();
      const settings = component['crtSettings']();
      expect(settings.scanlineIntensity).toBe(0.5);
      expect(settings.vignetteStrength).toBe(1.5);
    });
  });

  describe('composed components', () => {
    it('should use standard CRT config', async () => {
      await setupTestBed([
        { deviceId: 'cam-123', label: 'Front Camera' },
      ]);
      await createComponent('teensy-device-1');

      expect(component.crtConfig).toBeDefined();
      expect(component.crtConfig.showScanlines).toBe(true);
      expect(component.crtConfig.showVignette).toBe(true);
      expect(component.crtConfig.showCurvature).toBe(false);
    });
  });
});
