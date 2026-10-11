import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { DeviceSettingsSectionComponent } from './device-settings-section.component';
import { AudioStore } from '@teensyrom-nx/application';
import {
  AUDIO_STREAM_SERVICE,
  IAudioStreamService,
  Device,
  DeviceState,
  DeviceMachine,
  DeviceVideoStandard,
  DeviceHardwareVariant,
  StorageType,
} from '@teensyrom-nx/domain';

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

  const createDevice = (
    deviceId: string,
    name = deviceId,
    overrides: Partial<Device> = {}
  ): Device => ({
    deviceId,
    name,
    comPort: '',
    fwVersion: '',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: false, indexExists: false },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
    machine: DeviceMachine.C64,
    videoStandard: DeviceVideoStandard.Ntsc,
    todClockHz: null,
    hardwareVariant: DeviceHardwareVariant.TeensyRom,
    ...overrides,
  });

  const createDefaultGroup = vi.fn((deviceId: string): FormGroup => {
    const group = createDeviceFormGroup(deviceId);
    group.disable();
    return group;
  });

  /** Sets the section inputs; devices default to one per FormArray entry. */
  const setInputs = (
    knownDevices: FormArray,
    devices: Device[] = knownDevices.controls.map((c) => createDevice(c.get('deviceId')?.value))
  ): void => {
    fixture.componentRef.setInput('knownDevicesArray', knownDevices);
    fixture.componentRef.setInput('devices', devices);
    fixture.componentRef.setInput('createDefaultGroup', createDefaultGroup);
  };

  const cardTitles = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.device-section lib-icon-label .icon-label-text.primary') as NodeListOf<Element>
    ).map((el) => el.textContent?.trim() ?? '');

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
    createDefaultGroup.mockClear();

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
      setInputs(emptyArray);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No devices have been connected');
    });

    it('should show hint text in empty state', () => {
      const emptyArray = fb.array([]);
      setInputs(emptyArray);
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
      setInputs(devicesArray);
      fixture.detectChanges();

      const deviceSections = fixture.nativeElement.querySelectorAll('.device-section');
      expect(deviceSections.length).toBe(2);
    });

    it('should not render empty state when devices exist', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      // The top-level empty state (outside device sections) should not exist
      // Note: audio-settings-section may show its own empty state if no audio devices loaded
      const scalingCard = fixture.nativeElement.querySelector('lib-scaling-card');
      const topLevelEmptyState = scalingCard.querySelector(':scope > .empty-state');
      expect(topLevelEmptyState).toBeNull();
    });

    it('should display video toggle for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const toggles = fixture.nativeElement.querySelectorAll('lib-settings-toggle-item');
      const videoToggle = Array.from(toggles as Element[]).find((t: Element) =>
        t.getAttribute('label')?.includes('Video')
      );
      expect(videoToggle).toBeTruthy();
    });
  });

  describe('Device Cards From Device List', () => {
    it('should title each card by device name with the chip ID as secondary text', () => {
      const devicesArray = fb.array([createDeviceFormGroup('chip-abc')]);
      setInputs(devicesArray, [createDevice('chip-abc', 'Living Room')]);
      fixture.detectChanges();

      expect(cardTitles()).toEqual(['Living Room']);
      const chipId = fixture.nativeElement.querySelector('.device-chip-id');
      expect(chipId.textContent.trim()).toBe('chip-abc');
    });

    it('should render cards from the devices input, not the FormArray', () => {
      const devicesArray = fb.array([createDeviceFormGroup('dev-1')]);
      setInputs(devicesArray, [createDevice('dev-1', 'One'), createDevice('dev-2', 'Two')]);
      fixture.detectChanges();

      expect(cardTitles()).toEqual(['One', 'Two']);
    });

    it('should not render a settings entry that has no matching device', () => {
      const devicesArray = fb.array([
        createDeviceFormGroup('dev-1'),
        createDeviceFormGroup('stale-hash-id'),
      ]);
      setInputs(devicesArray, [createDevice('dev-1', 'One')]);
      fixture.detectChanges();

      expect(cardTitles()).toEqual(['One']);
      expect(fixture.nativeElement.textContent).not.toContain('stale-hash-id');
    });

    it('should show the empty state when there are no devices even if entries exist', () => {
      const devicesArray = fb.array([createDeviceFormGroup('stale-hash-id')]);
      setInputs(devicesArray, []);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelectorAll('.device-section').length).toBe(0);
    });

    it('should order online devices first, then by name', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray, [
        createDevice('d-1', 'Alpha', { deviceState: DeviceState.ConnectionLost }),
        createDevice('d-2', 'Zeta'),
        createDevice('d-3', 'Beta', { deviceState: DeviceState.Busy }),
        createDevice('d-4', 'Aardvark', { deviceState: DeviceState.ConnectionLost }),
      ]);
      fixture.detectChanges();

      expect(cardTitles()).toEqual(['Beta', 'Zeta', 'Aardvark', 'Alpha']);
    });

    it('should order devices with the same name by deviceId', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray, [createDevice('b-id', 'Same'), createDevice('a-id', 'Same')]);
      fixture.detectChanges();

      expect(component.cards().map((c) => c.device.deviceId)).toEqual(['a-id', 'b-id']);
    });

    it('should show the offline indicator only for lost connections', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray, [
        createDevice('d-1', 'Busy One', { deviceState: DeviceState.Busy }),
        createDevice('d-2', 'Lost One', { deviceState: DeviceState.ConnectionLost }),
      ]);
      fixture.detectChanges();

      const headers = fixture.nativeElement.querySelectorAll('.device-header');
      expect(headers[0].querySelector('.offline-indicator')).toBeNull();
      expect(headers[1].querySelector('.offline-indicator')).toBeTruthy();
    });

    it('should join a device to its settings entry by deviceId', () => {
      const entry = createDeviceFormGroup('dev-2', true);
      const devicesArray = fb.array([createDeviceFormGroup('dev-1'), entry]);
      setInputs(devicesArray, [createDevice('dev-2', 'Two')]);
      fixture.detectChanges();

      const [card] = component.cards();
      expect(card.group).toBe(entry);
      expect(card.hasEntry).toBe(true);
      expect(card.group.enabled).toBe(true);
      expect(createDefaultGroup).not.toHaveBeenCalled();
    });

    it('should render a disabled default card for a device with no entry', () => {
      const devicesArray = fb.array([createDeviceFormGroup('dev-1')]);
      setInputs(devicesArray, [createDevice('dev-1', 'One'), createDevice('dev-new', 'Fresh')]);
      fixture.detectChanges();

      const fresh = component.cards().find((c) => c.device.deviceId === 'dev-new');
      expect(fresh?.hasEntry).toBe(false);
      expect(fresh?.group.disabled).toBe(true);
      expect(fresh?.group.get('deviceId')?.value).toBe('dev-new');
      expect(devicesArray.length).toBe(1);
      expect(cardTitles()).toEqual(['Fresh', 'One']);
    });

    it('should show a renamed device title without rebuilding its default group', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray, [createDevice('dev-new', 'Before')]);
      fixture.detectChanges();
      const groupBefore = component.cards()[0].group;
      expect(cardTitles()).toEqual(['Before']);

      fixture.componentRef.setInput('devices', [createDevice('dev-new', 'After')]);
      fixture.detectChanges();

      expect(cardTitles()).toEqual(['After']);
      expect(component.cards()[0].group).toBe(groupBefore);
      expect(createDefaultGroup).toHaveBeenCalledTimes(1);
    });

    it('should drop the card of a forgotten device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('dev-1'), createDeviceFormGroup('dev-2')]);
      setInputs(devicesArray, [createDevice('dev-1', 'One'), createDevice('dev-2', 'Two')]);
      fixture.detectChanges();
      expect(cardTitles()).toEqual(['One', 'Two']);

      fixture.componentRef.setInput('devices', [createDevice('dev-2', 'Two')]);
      fixture.detectChanges();

      expect(cardTitles()).toEqual(['Two']);
    });

    it('should mark a card disabled when its device is not enabled', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray, [createDevice('dev-1', 'One', { isEnabled: false })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.device-section.disabled')).toBeTruthy();
      expect(component.isDeviceDisabled(component.cards()[0])).toBe(true);
    });
  });

  describe('Form Control Helpers', () => {
    it('should get enable video control', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123', true)]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const control = component.getEnableVideoControl(devicesArray.at(0));
      expect(control).toBeTruthy();
      expect(control?.value).toBe(true);
    });
  });

  describe('Audio Settings Helpers', () => {
    it('should get audio settings FormGroup', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const audioSettings = component.getAudioSettings(devicesArray.at(0));
      expect(audioSettings).toBeTruthy();
      expect(audioSettings?.get('audioDeviceIndex')).toBeTruthy();
    });

    it('should get audio device index', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123', false, true, 2)]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const index = component.getAudioDeviceIndex(devicesArray.at(0));
      expect(index).toBe(2);
    });

    it('should return -1 for audio device index when not set', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const index = component.getAudioDeviceIndex(devicesArray.at(0));
      expect(index).toBe(-1);
    });

    it('should get device ID', () => {
      const devicesArray = fb.array([createDeviceFormGroup('test-device-456')]);
      setInputs(devicesArray);
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
      setInputs(devicesArray);
      fixture.detectChanges();

      expect(component.getDeviceIndex(devicesArray.at(0))).toBe(0);
      expect(component.getDeviceIndex(devicesArray.at(1))).toBe(1);
      expect(component.getDeviceIndex(devicesArray.at(2))).toBe(2);
    });
  });

  describe('Audio Settings Section Embedding', () => {
    it('should render audio settings section for each device', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const audioSections = fixture.nativeElement.querySelectorAll('lib-audio-settings-section');
      expect(audioSections.length).toBe(1);
    });

    it('should render audio settings section for multiple devices', () => {
      const devicesArray = fb.array([
        createDeviceFormGroup('device-1'),
        createDeviceFormGroup('device-2'),
      ]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const audioSections = fixture.nativeElement.querySelectorAll('lib-audio-settings-section');
      expect(audioSections.length).toBe(2);
    });

    it('should render audio settings group with separator', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const audioGroup = fixture.nativeElement.querySelector('.audio-section');
      expect(audioGroup).toBeTruthy();
    });

    it('should render Audio Settings group title', () => {
      const devicesArray = fb.array([createDeviceFormGroup('device-123')]);
      setInputs(devicesArray);
      fixture.detectChanges();

      const audioGroupTitle = fixture.nativeElement.querySelector('.audio-section .group-title');
      expect(audioGroupTitle).toBeTruthy();
      expect(audioGroupTitle.textContent).toContain('Audio Settings');
    });
  });

  describe('Animation Trigger', () => {
    it('should default animationTrigger to true', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray);
      fixture.detectChanges();

      expect(component.animationTrigger()).toBe(true);
    });

    it('should accept custom animationTrigger', () => {
      const devicesArray = fb.array([]);
      setInputs(devicesArray);
      fixture.componentRef.setInput('animationTrigger', false);
      fixture.detectChanges();

      expect(component.animationTrigger()).toBe(false);
    });
  });
});
