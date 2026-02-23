import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, WritableSignal, computed } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { AudioSettingsSectionComponent } from './audio-settings-section.component';
import { AudioStore } from '@teensyrom-nx/application';
import { AudioDevice, AUDIO_STREAM_SERVICE, IAudioStreamService } from '@teensyrom-nx/domain';

const createMockDevices = (): AudioDevice[] => [
  { index: 0, name: 'Built-in Microphone', maxInputChannels: 2, defaultSampleRate: 48000 },
  { index: 1, name: 'USB Audio Interface', maxInputChannels: 4, defaultSampleRate: 44100 },
  { index: 2, name: 'Mono Headset', maxInputChannels: 1, defaultSampleRate: 16000 },
];

describe('AudioSettingsSectionComponent', () => {
  let component: AudioSettingsSectionComponent;
  let fixture: ComponentFixture<AudioSettingsSectionComponent>;
  let mockDevices: WritableSignal<AudioDevice[]>;
  let mockSelectedDeviceIndex: WritableSignal<number | null>;
  let mockIsLoading: WritableSignal<boolean>;
  let mockError: WritableSignal<string | null>;
  let mockIsStreaming: WritableSignal<boolean>;
  let mockIsConnecting: WritableSignal<boolean>;
  let mockAudioStore: Record<string, unknown>;
  let volumeLevel$: Subject<number>;
  let channelVolumes$: BehaviorSubject<Map<number, number>>;
  let mockAudioStreamService: Partial<IAudioStreamService>;

  beforeEach(async () => {
    mockDevices = signal<AudioDevice[]>([]);
    mockSelectedDeviceIndex = signal<number | null>(null);
    mockIsLoading = signal(false);
    mockError = signal<string | null>(null);
    mockIsStreaming = signal(false);
    mockIsConnecting = signal(false);
    volumeLevel$ = new Subject<number>();
    channelVolumes$ = new BehaviorSubject<Map<number, number>>(new Map());

    mockAudioStreamService = {
      volumeLevel$: volumeLevel$.asObservable(),
      channelVolumes$: channelVolumes$.asObservable(),
    };

    mockAudioStore = {
      devices: mockDevices,
      selectedDeviceIndex: mockSelectedDeviceIndex,
      isLoading: mockIsLoading,
      error: mockError,
      isStreaming: mockIsStreaming,
      isConnecting: mockIsConnecting,
      loadDevices: vi.fn(),
      selectDevice: vi.fn((index: number) => mockSelectedDeviceIndex.set(index)),
      startStream: vi.fn(),
      stopStream: vi.fn(),
      hasDevices: computed(() => mockDevices().length > 0),
      selectedDevice: computed(() => {
        const devices = mockDevices();
        const idx = mockSelectedDeviceIndex();
        if (idx === null || idx < 0 || idx >= devices.length) return null;
        return devices[idx];
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AudioSettingsSectionComponent],
      providers: [
        { provide: AudioStore, useValue: mockAudioStore },
        { provide: AUDIO_STREAM_SERVICE, useValue: mockAudioStreamService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioSettingsSectionComponent);
    component = fixture.componentInstance;
  });

  describe('Device Loading', () => {
    it('should call loadDevices when loadOnInit is true', () => {
      fixture.componentRef.setInput('loadOnInit', true);
      fixture.detectChanges();

      expect(mockAudioStore['loadDevices']).toHaveBeenCalled();
    });

    it('should not call loadDevices when loadOnInit is false', () => {
      fixture.componentRef.setInput('loadOnInit', false);
      fixture.detectChanges();

      expect(mockAudioStore['loadDevices']).not.toHaveBeenCalled();
    });

    it('should only call loadDevices once even if loadOnInit toggles', () => {
      fixture.componentRef.setInput('loadOnInit', true);
      fixture.detectChanges();

      fixture.componentRef.setInput('loadOnInit', false);
      fixture.detectChanges();

      fixture.componentRef.setInput('loadOnInit', true);
      fixture.detectChanges();

      expect(mockAudioStore['loadDevices']).toHaveBeenCalledTimes(1);
    });

    it('should default loadOnInit to true', () => {
      fixture.detectChanges();
      expect(component.loadOnInit()).toBe(true);
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when isLoading is true', () => {
      mockIsLoading.set(true);
      fixture.detectChanges();

      const loadingState = fixture.nativeElement.querySelector('.loading-state');
      expect(loadingState).toBeTruthy();
      expect(loadingState.textContent).toContain('Loading audio devices');
    });

    it('should not show loading indicator when isLoading is false', () => {
      mockIsLoading.set(false);
      fixture.detectChanges();

      const loadingState = fixture.nativeElement.querySelector('.loading-state');
      expect(loadingState).toBeNull();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no devices and not loading', () => {
      mockIsLoading.set(false);
      mockDevices.set([]);
      mockError.set(null);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No audio input devices found');
    });

    it('should show hint text in empty state', () => {
      mockIsLoading.set(false);
      mockDevices.set([]);
      mockError.set(null);
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.hint');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('Connect an audio input device');
    });
  });

  describe('Error State', () => {
    it('should display error message when error is set and no devices', () => {
      mockError.set('Failed to enumerate audio devices');
      mockDevices.set([]);
      fixture.detectChanges();

      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Failed to enumerate audio devices');
    });

    it('should not show error state when devices are present', () => {
      mockError.set('Some warning');
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeNull();
    });
  });

  describe('Device List', () => {
    it('should render all devices when loaded', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      const deviceItems = fixture.nativeElement.querySelectorAll('.device-item');
      expect(deviceItems.length).toBe(3);
    });

    it('should display device name and channel info', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      const deviceItems = fixture.nativeElement.querySelectorAll('.device-item');
      const firstDeviceText = deviceItems[0].textContent;
      expect(firstDeviceText).toContain('Built-in Microphone');
      expect(firstDeviceText).toContain('2 ch');
      expect(firstDeviceText).toContain('48,000');
    });
  });

  describe('Device Selection', () => {
    it('should call selectDevice when a device is clicked', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      const deviceItems = fixture.nativeElement.querySelectorAll('.device-item');
      deviceItems[1].click();
      fixture.detectChanges();

      expect(mockAudioStore['selectDevice']).toHaveBeenCalledWith(1);
    });

    it('should highlight the selected device', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.detectChanges();

      const deviceItems = fixture.nativeElement.querySelectorAll('.device-item');
      expect(deviceItems[0].classList.contains('selected')).toBe(true);
      expect(deviceItems[1].classList.contains('selected')).toBe(false);
    });

    it('should show check icon for the selected device', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.detectChanges();

      const selectedIndicator = fixture.nativeElement.querySelector('.device-item.selected .selected-indicator');
      expect(selectedIndicator).toBeTruthy();
    });
  });

  describe('Saved Device Pre-selection', () => {
    it('should pre-select the saved device when devices load', () => {
      fixture.componentRef.setInput('savedDeviceIndex', 1);
      fixture.detectChanges();

      // Simulate devices loading
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      expect(mockAudioStore['selectDevice']).toHaveBeenCalledWith(1);
    });
  });

  describe('Sample Rate Display', () => {
    it('should display sample rate for selected device', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.detectChanges();

      const sampleRateDisplay = fixture.nativeElement.querySelector('.sample-rate-display');
      expect(sampleRateDisplay).toBeTruthy();
      expect(sampleRateDisplay.textContent).toContain('48,000 Hz');
    });

    it('should not show sample rate when no device is selected', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(null);
      fixture.detectChanges();

      const sampleRateDisplay = fixture.nativeElement.querySelector('.sample-rate-display');
      expect(sampleRateDisplay).toBeNull();
    });
  });

  describe('Embedded Component', () => {
    it('should render without lib-scaling-card wrapper', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      const scalingCard = fixture.nativeElement.querySelector('lib-scaling-card');
      expect(scalingCard).toBeNull();
    });

    it('should render with audio-settings-embedded wrapper', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      const embeddedWrapper = fixture.nativeElement.querySelector('.audio-settings-embedded');
      expect(embeddedWrapper).toBeTruthy();
    });

    it('should accept deviceIndex input', () => {
      fixture.componentRef.setInput('deviceIndex', 2);
      fixture.detectChanges();
      expect(component.deviceIndex()).toBe(2);
    });

    it('should default deviceIndex to 0', () => {
      fixture.detectChanges();
      expect(component.deviceIndex()).toBe(0);
    });
  });

  describe('Test Audio Button', () => {
    it('should be disabled when no device is selected', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(null);
      fixture.detectChanges();

      expect(component.isTestButtonDisabled()).toBe(true);
    });

    it('should be enabled when a device is selected and deviceId is set', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      expect(component.isTestButtonDisabled()).toBe(false);
    });

    it('should be disabled when deviceId is empty', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.detectChanges();

      expect(component.isTestButtonDisabled()).toBe(true);
    });

    it('should be disabled while connecting', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      mockIsConnecting.set(true);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      expect(component.isTestButtonDisabled()).toBe(true);
    });

    it('should show "Test Audio" label when idle', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.detectChanges();

      expect(component.testButtonLabel()).toBe('Test Audio');
    });

    it('should show "Connecting..." label while connecting', () => {
      mockIsConnecting.set(true);
      fixture.detectChanges();

      expect(component.testButtonLabel()).toBe('Connecting...');
    });

    it('should show "Stop Test" label while testing', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      component.onToggleTest();
      fixture.detectChanges();

      expect(component.testButtonLabel()).toBe('Stop Test');
    });

    it('should call startStream with the TeensyROM device ID when test starts', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      component.onToggleTest();

      expect(mockAudioStore['startStream']).toHaveBeenCalledWith('test-device-id');
    });

    it('should call stopStream when test stops', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      // Start test
      component.onToggleTest();
      fixture.detectChanges();

      // Stop test
      component.onToggleTest();

      expect(mockAudioStore['stopStream']).toHaveBeenCalled();
    });
  });

  describe('VU Meter', () => {
    it('should be visible when testing', () => {
      mockDevices.set(createMockDevices());
      // Use device 2 (Mono Headset) which is NOT multi-channel
      mockSelectedDeviceIndex.set(2);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      component.onToggleTest();
      fixture.detectChanges();

      const vuMeter = fixture.nativeElement.querySelector('lib-vu-meter');
      expect(vuMeter).toBeTruthy();
    });

    it('should not be visible when idle', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(2);
      fixture.detectChanges();

      const vuMeter = fixture.nativeElement.querySelector('lib-vu-meter');
      expect(vuMeter).toBeNull();
    });

    it('should receive volume level updates', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(2);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      component.onToggleTest();
      fixture.detectChanges();

      volumeLevel$.next(0.75);
      fixture.detectChanges();

      expect(component.volumeLevel()).toBe(0.75);
    });

    it('should reset volume level when test stops', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(2);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      component.onToggleTest();
      volumeLevel$.next(0.5);
      fixture.detectChanges();

      component.onToggleTest(); // stop
      fixture.detectChanges();

      expect(component.volumeLevel()).toBe(0);
    });
  });
});
