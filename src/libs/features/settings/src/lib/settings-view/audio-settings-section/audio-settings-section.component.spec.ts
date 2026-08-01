import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, WritableSignal, computed } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { FormControl, FormGroup } from '@angular/forms';
import { AudioSettingsSectionComponent } from './audio-settings-section.component';
import { AudioStore } from '@teensyrom-nx/application';
import { AudioDevice, AUDIO_STREAM_SERVICE, IAudioStreamService, ChannelConfig } from '@teensyrom-nx/domain';
import { SettingsFormService } from '../settings-form.service';

const createMockDevices = (): AudioDevice[] => [
  { index: 0, name: 'Built-in Microphone', maxInputChannels: 2, defaultSampleRate: 48000 },
  { index: 1, name: 'USB Audio Interface', maxInputChannels: 4, defaultSampleRate: 44100 },
  { index: 2, name: 'Mono Headset', maxInputChannels: 1, defaultSampleRate: 16000 },
];

const createAudioFormGroup = (overrides?: Partial<Record<string, unknown>>): FormGroup =>
  new FormGroup({
    enableAudioStream: new FormControl<boolean>((overrides?.['enableAudioStream'] as boolean) ?? false, {
      nonNullable: true,
    }),
    audioDeviceIndex: new FormControl<number>((overrides?.['audioDeviceIndex'] as number) ?? -1, {
      nonNullable: true,
    }),
    audioDeviceName: new FormControl<string>((overrides?.['audioDeviceName'] as string) ?? '', {
      nonNullable: true,
    }),
    captureChannelCount: new FormControl<number>((overrides?.['captureChannelCount'] as number) ?? 1, {
      nonNullable: true,
    }),
    sampleRate: new FormControl<number>((overrides?.['sampleRate'] as number) ?? 48000, {
      nonNullable: true,
    }),
    channels: new FormControl<unknown[]>((overrides?.['channels'] as unknown[]) ?? [], {
      nonNullable: true,
    }),
    useOpusEncoding: new FormControl<boolean>((overrides?.['useOpusEncoding'] as boolean) ?? true, {
      nonNullable: true,
    }),
  });

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
  let mockSettingsFormService: Pick<SettingsFormService, 'saveSettings'>;
  let audioFormGroup: FormGroup;
  let startStreamSpy: ReturnType<typeof vi.fn>;
  let stopStreamSpy: ReturnType<typeof vi.fn>;

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
      getPreBufferDuration: vi.fn(() => 0.005),
      getCatchUpPadding: vi.fn(() => 0.001),
      setPreBufferDuration: vi.fn(),
      setCatchUpPadding: vi.fn(),
      setUseOpusEncoding: vi.fn(),
      getUseOpusEncoding: vi.fn(() => true),
    };

    mockSettingsFormService = {
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };

    audioFormGroup = createAudioFormGroup();

    startStreamSpy = vi.fn().mockResolvedValue(undefined);
    stopStreamSpy = vi.fn().mockResolvedValue(undefined);

    mockAudioStore = {
      devices: mockDevices,
      selectedDeviceIndex: mockSelectedDeviceIndex,
      isLoading: mockIsLoading,
      error: mockError,
      isStreaming: mockIsStreaming,
      isConnecting: mockIsConnecting,
      loadDevices: vi.fn(),
      selectDevice: vi.fn((index: number) => mockSelectedDeviceIndex.set(index)),
      startStream: startStreamSpy,
      stopStream: stopStreamSpy,
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
        { provide: SettingsFormService, useValue: mockSettingsFormService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioSettingsSectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('audioFormGroup', audioFormGroup);
  });

  const flushUi = async (): Promise<void> => {
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  };

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
    it('should compute sample rate for selected device', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.detectChanges();

      expect(component.formattedSampleRate()).toBe('48,000 Hz');
    });

    it('should return placeholder sample rate when no device is selected', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(null);
      fixture.detectChanges();

      expect(component.formattedSampleRate()).toBe('—');
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

  describe('Live Streaming Toggle / Reconnect Behavior', () => {
    it('should not render the legacy test audio button', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Test Audio');
      expect(fixture.nativeElement.querySelector('lib-action-button')).toBeNull();
    });

    it('should save settings and start stream when enableAudioStream is turned on', async () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      audioFormGroup.get('enableAudioStream')?.setValue(true);
      await flushUi();

      expect(mockSettingsFormService.saveSettings).toHaveBeenCalled();
      expect(mockAudioStore['startStream']).toHaveBeenCalledWith('test-device-id');
      expect(mockAudioStore['stopStream']).not.toHaveBeenCalled();
    });

    it('should save settings and stop stream when enableAudioStream is turned off', async () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      audioFormGroup.get('enableAudioStream')?.setValue(true);
      await flushUi();
      vi.mocked(mockSettingsFormService.saveSettings).mockClear();
      startStreamSpy.mockClear();

      audioFormGroup.get('enableAudioStream')?.setValue(false);
      await flushUi();

      expect(mockSettingsFormService.saveSettings).toHaveBeenCalled();
      expect(mockAudioStore['stopStream']).toHaveBeenCalled();
    });

    it('should save settings then reconnect when Opus compression changes while enabled', async () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      mockIsStreaming.set(true);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      audioFormGroup.get('enableAudioStream')?.setValue(true, { emitEvent: false });
      fixture.detectChanges();

      vi.mocked(mockSettingsFormService.saveSettings).mockClear();
      stopStreamSpy.mockClear();
      startStreamSpy.mockClear();

      audioFormGroup.get('useOpusEncoding')?.setValue(false);
      await flushUi();

      expect(mockSettingsFormService.saveSettings).toHaveBeenCalledTimes(1);
      expect(mockAudioStore['stopStream']).toHaveBeenCalledTimes(1);
      expect(mockAudioStreamService.setUseOpusEncoding).toHaveBeenCalledWith(false);
      expect(mockAudioStore['startStream']).toHaveBeenCalledWith('test-device-id');
      const saveOrder = vi.mocked(mockSettingsFormService.saveSettings).mock.invocationCallOrder[0];
      const stopOrder = stopStreamSpy.mock.invocationCallOrder[0];
      const startOrder = startStreamSpy.mock.invocationCallOrder[0];
      expect(saveOrder).toBeLessThan(stopOrder);
      expect(stopOrder).toBeLessThan(startOrder);
    });

    it('should save settings then reconnect when input device changes while enabled', async () => {
      const devices = createMockDevices();
      mockDevices.set(devices);
      mockSelectedDeviceIndex.set(0);
      mockIsStreaming.set(true);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      audioFormGroup.patchValue({ enableAudioStream: true }, { emitEvent: false });
      fixture.detectChanges();

      vi.mocked(mockSettingsFormService.saveSettings).mockClear();
      stopStreamSpy.mockClear();
      startStreamSpy.mockClear();

      component.onSelectDevice(devices[1]);
      await flushUi();

      expect(mockSettingsFormService.saveSettings).toHaveBeenCalled();
      expect(mockAudioStore['stopStream']).toHaveBeenCalled();
      expect(mockAudioStore['startStream']).toHaveBeenCalledWith('test-device-id');
    });

    it('should save settings then reconnect when channel selection changes while enabled', async () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(1);
      mockIsStreaming.set(true);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      audioFormGroup.patchValue({ enableAudioStream: true }, { emitEvent: false });
      fixture.detectChanges();

      (component as unknown as { channelConfigs: WritableSignal<ChannelConfig[]> }).channelConfigs.set([
        { sourceChannel: 0, enabled: true },
        { sourceChannel: 1, enabled: true },
      ]);

      vi.mocked(mockSettingsFormService.saveSettings).mockClear();
      stopStreamSpy.mockClear();
      startStreamSpy.mockClear();

      component.onChannelConfigChanged(1, { sourceChannel: 1, enabled: false });
      await flushUi();

      expect(mockSettingsFormService.saveSettings).toHaveBeenCalled();
      expect(mockAudioStore['stopStream']).toHaveBeenCalled();
      expect(mockAudioStore['startStream']).toHaveBeenCalledWith('test-device-id');
    });
  });

  describe('VU Meter', () => {
    it('should be visible for mono device when audio streaming is enabled', () => {
      mockDevices.set(createMockDevices());
      // Use device 2 (Mono Headset) which is NOT multi-channel
      mockSelectedDeviceIndex.set(2);
      audioFormGroup.get('enableAudioStream')?.setValue(true, { emitEvent: false });
      fixture.detectChanges();

      const vuMeter = fixture.nativeElement.querySelector('lib-vu-meter');
      expect(vuMeter).toBeTruthy();
    });

    it('should not be visible when audio streaming is disabled', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(2);
      audioFormGroup.get('enableAudioStream')?.setValue(false, { emitEvent: false });
      fixture.detectChanges();

      const vuMeter = fixture.nativeElement.querySelector('lib-vu-meter');
      expect(vuMeter).toBeNull();
    });

    it('should receive volume level updates', () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(2);
      audioFormGroup.get('enableAudioStream')?.setValue(true, { emitEvent: false });
      fixture.detectChanges();

      volumeLevel$.next(0.75);
      fixture.detectChanges();

      expect(component.volumeLevel()).toBe(0.75);
    });

    it('should reset volume level when audio stream is disabled', async () => {
      mockDevices.set(createMockDevices());
      mockSelectedDeviceIndex.set(0);
      fixture.componentRef.setInput('deviceId', 'test-device-id');
      fixture.detectChanges();

      audioFormGroup.get('enableAudioStream')?.setValue(true);
      await flushUi();
      volumeLevel$.next(0.5);
      fixture.detectChanges();

      audioFormGroup.get('enableAudioStream')?.setValue(false);
      await flushUi();

      expect(component.volumeLevel()).toBe(0);
    });
  });
});
