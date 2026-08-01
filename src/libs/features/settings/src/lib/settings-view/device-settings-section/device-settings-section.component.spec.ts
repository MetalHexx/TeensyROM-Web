import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { DeviceSettingsSectionComponent } from './device-settings-section.component';
import { AudioStore } from '@teensyrom-nx/application';
import { AUDIO_STREAM_SERVICE, IAudioStreamService } from '@teensyrom-nx/domain';

describe('DeviceSettingsSectionComponent', () => {
  let component: DeviceSettingsSectionComponent;
  let fixture: ComponentFixture<DeviceSettingsSectionComponent>;
  let fb: FormBuilder;

  const createDeviceFormGroup = (deviceId: string, enableVideo = false, autoConnect = true, audioDeviceIndex = -1): FormGroup => {
    return fb.group({
      deviceId: [deviceId],
      videoSettings: fb.group({
        enableVideo: [enableVideo],
        videoDeviceId: [''],
      }),
      connectionSettings: fb.group({
        autoConnectEnabled: [autoConnect],
      }),
      audioSettings: fb.group({
        audioDeviceIndex: [audioDeviceIndex],
        enableAudioStream: [false],
        audioDeviceName: [''],
        channelCount: [0],
        sampleRate: [0],
      }),
    });
  };

  const mockAudioStore = {
    devices: signal([]),
    selectedDeviceIndex: signal<number | null>(null),
    isLoading: signal(false),
    error: signal<string | null>(null),
    isStreaming: signal(false),
    isConnecting: signal(false),
    loadDevices: vi.fn(),
    selectDevice: vi.fn(),
    startStream: vi.fn(),
    stopStream: vi.fn(),
    clearError: vi.fn(),
    loadChannelConfigs: vi.fn(),
    setChannelVolume: vi.fn(),
    toggleMute: vi.fn(),
    setMasterVolume: vi.fn(),
    hasDevices: computed(() => false),
    selectedDevice: computed(() => null),
    channels: computed(() => []),
    hasChannels: computed(() => false),
    isMuted: signal(false),
    masterVolume: signal(0.75),
  };

  const mockAudioStreamService: Partial<IAudioStreamService> = {
    volumeLevel$: new Subject<number>().asObservable(),
    channelVolumes$: new Subject<Map<number, number>>().asObservable(),
    getPreBufferDuration: vi.fn(() => 0.005),
    getCatchUpPadding: vi.fn(() => 0.001),
    setPreBufferDuration: vi.fn(),
    setCatchUpPadding: vi.fn(),
    setUseOpusEncoding: vi.fn(),
    getUseOpusEncoding: vi.fn(() => true),
  };

  beforeEach(async () => {
    fb = new FormBuilder();

    await TestBed.configureTestingModule({
      imports: [DeviceSettingsSectionComponent, ReactiveFormsModule],
      providers: [
        provideNoopAnimations(),
        { provide: AudioStore, useValue: mockAudioStore },
        { provide: AUDIO_STREAM_SERVICE, useValue: mockAudioStreamService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceSettingsSectionComponent);
    component = fixture.componentInstance;
  });

  describe('Empty State', () => {
    it('should render empty state when no devices', () => {
      const emptyArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', emptyArray);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No devices have been connected');
    });

    it('should show hint text in empty state', () => {
      const emptyArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', emptyArray);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.hint');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('Connect a TeensyROM device');
    });
  });

  describe('Device Cards', () => {
    it('should render device sections when devices exist', () => {
      const devicesArray = fb.array([
        createDeviceFormGroup('device-123'),
        createDeviceFormGroup('device-456'),
      ]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const deviceSections = fixture.nativeElement.querySelectorAll('.device-section');
      expect(deviceSections.length).toBe(2);
    });

    it('should not render empty state when devices exist', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      // The top-level empty state (outside device sections) should not exist
      // Note: audio-settings-section may show its own empty state if no audio devices loaded
      const scalingCard = fixture.nativeElement.querySelector('lib-scaling-card');
      const topLevelEmptyState = scalingCard.querySelector(':scope > .empty-state');
      expect(topLevelEmptyState).toBeNull();
    });

    it('should display video toggle for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const toggles = fixture.nativeElement.querySelectorAll('lib-settings-toggle-item');
      const videoToggle = Array.from(toggles as Element[]).find((t: Element) =>
        t.getAttribute('label')?.includes('Video')
      );
      expect(videoToggle).toBeTruthy();
    });

    // Auto-connect toggle is currently commented out in the template
    it.skip('should display auto-connect toggle for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const toggles = fixture.nativeElement.querySelectorAll('lib-settings-toggle-item');
      const autoConnectToggle = Array.from(toggles as Element[]).find((t: Element) =>
        t.getAttribute('label')?.includes('Auto-connect')
      );
      expect(autoConnectToggle).toBeTruthy();
    });
  });

  describe('Device Title', () => {
    it('should display short device ID as-is', () => {
      const devicesArray = fb.array([createDeviceFormGroup('short-id')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const title = component.getDeviceTitle(devicesArray.at(0));
      expect(title).toBe('Device: short-id');
    });

    it('should truncate long device IDs', () => {
      const longId = 'very-long-device-identifier-123456789';
      const devicesArray = fb.array([createDeviceFormGroup(longId)]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const title = component.getDeviceTitle(devicesArray.at(0));
      expect(title).toBe('Device: very-long-de...');
      expect(title.length).toBeLessThan(longId.length + 8); // "Device: " prefix adds 8 chars
    });

    it('should return "Unknown" for missing device ID', () => {
      const deviceGroup = fb.group({
        videoSettings: fb.group({ enableVideo: [false] }),
        connectionSettings: fb.group({ autoConnectEnabled: [true] }),
        audioSettings: fb.group({ audioDeviceIndex: [-1] }),
      });
      const devicesArray = fb.array([deviceGroup]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const title = component.getDeviceTitle(devicesArray.at(0));
      expect(title).toBe('Device: Unknown');
    });
  });

  describe('Form Control Helpers', () => {
    it('should get enable video control', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123', true)]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const control = component.getEnableVideoControl(devicesArray.at(0));
      expect(control).toBeTruthy();
      expect(control?.value).toBe(true);
    });
  });

  describe('Audio Settings Helpers', () => {
    it('should get audio settings FormGroup', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const audioSettings = component.getAudioSettings(devicesArray.at(0));
      expect(audioSettings).toBeTruthy();
      expect(audioSettings?.get('audioDeviceIndex')).toBeTruthy();
    });

    it('should get audio device index', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123', false, true, 2)]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const index = component.getAudioDeviceIndex(devicesArray.at(0));
      expect(index).toBe(2);
    });

    it('should return -1 for audio device index when not set', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const index = component.getAudioDeviceIndex(devicesArray.at(0));
      expect(index).toBe(-1);
    });

    it('should get device ID', () => {
      const devicesArray = fb.array([createDeviceFormGroup('test-device-456')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const deviceId = component.getDeviceId(devicesArray.at(0));
      expect(deviceId).toBe('test-device-456');
    });

    it('should get device index in FormArray', () => {
      const devicesArray = fb.array([
        createDeviceFormGroup('device-1'),
        createDeviceFormGroup('device-2'),
        createDeviceFormGroup('device-3'),
      ]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      expect(component.getDeviceIndex(devicesArray.at(0))).toBe(0);
      expect(component.getDeviceIndex(devicesArray.at(1))).toBe(1);
      expect(component.getDeviceIndex(devicesArray.at(2))).toBe(2);
    });
  });

  describe('Audio Settings Section Embedding', () => {
    it('should render audio settings section for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const audioSections = fixture.nativeElement.querySelectorAll('lib-audio-settings-section');
      expect(audioSections.length).toBe(1);
    });

    it('should render audio settings section for multiple devices', () => {
      const devicesArray = fb.array([
        createDeviceFormGroup('device-1'),
        createDeviceFormGroup('device-2'),
      ]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const audioSections = fixture.nativeElement.querySelectorAll('lib-audio-settings-section');
      expect(audioSections.length).toBe(2);
    });

    it('should render audio settings group with separator', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const audioGroup = fixture.nativeElement.querySelector('.audio-section');
      expect(audioGroup).toBeTruthy();
    });

    it('should render Audio Settings group title', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      const audioGroupTitle = fixture.nativeElement.querySelector('.audio-section .group-title');
      expect(audioGroupTitle).toBeTruthy();
      expect(audioGroupTitle.textContent).toContain('Audio Settings');
    });
  });

  describe('Animation Trigger', () => {
    it('should default animationTrigger to true', () => {
      const devicesArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.detectChanges();

      expect(component.animationTrigger()).toBe(true);
    });

    it('should accept custom animationTrigger', () => {
      const devicesArray = fb.array([]);
      fixture.componentRef.setInput('knownDevicesArray', devicesArray);
      fixture.componentRef.setInput('animationTrigger', false);
      fixture.detectChanges();

      expect(component.animationTrigger()).toBe(false);
    });
  });
});
