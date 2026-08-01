import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, WritableSignal, computed } from '@angular/core';
import { AudioInputDeviceListComponent } from './audio-input-device-list.component';
import { AudioStore } from '@teensyrom-nx/application';
import { AudioDevice } from '@teensyrom-nx/domain';

const createMockDevices = (): AudioDevice[] => [
  { index: 0, name: 'Built-in Microphone', maxInputChannels: 2, defaultSampleRate: 48000 },
  { index: 1, name: 'USB Audio Interface', maxInputChannels: 4, defaultSampleRate: 44100 },
  { index: 2, name: 'Mono Headset', maxInputChannels: 1, defaultSampleRate: 16000 },
];

describe('AudioInputDeviceListComponent', () => {
  let component: AudioInputDeviceListComponent;
  let fixture: ComponentFixture<AudioInputDeviceListComponent>;
  let mockDevices: WritableSignal<AudioDevice[]>;
  let mockSelectedDeviceIndex: WritableSignal<number | null>;
  let mockIsLoading: WritableSignal<boolean>;
  let mockError: WritableSignal<string | null>;
  let mockAudioStore: Record<string, unknown>;

  beforeEach(async () => {
    mockDevices = signal<AudioDevice[]>([]);
    mockSelectedDeviceIndex = signal<number | null>(null);
    mockIsLoading = signal(false);
    mockError = signal<string | null>(null);

    mockAudioStore = {
      devices: mockDevices,
      selectedDeviceIndex: mockSelectedDeviceIndex,
      isLoading: mockIsLoading,
      error: mockError,
      selectDevice: vi.fn((index: number) => mockSelectedDeviceIndex.set(index)),
      hasDevices: computed(() => mockDevices().length > 0),
      selectedDevice: computed(() => {
        const devices = mockDevices();
        const idx = mockSelectedDeviceIndex();
        if (idx === null || idx < 0 || idx >= devices.length) return null;
        return devices[idx];
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AudioInputDeviceListComponent],
      providers: [{ provide: AudioStore, useValue: mockAudioStore }, provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioInputDeviceListComponent);
    component = fixture.componentInstance;
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
    it('should emit deviceSelected when a device is clicked', () => {
      mockDevices.set(createMockDevices());
      fixture.detectChanges();
      const devices = mockDevices();
      const emitted: AudioDevice[] = [];
      component.deviceSelected.subscribe((device) => emitted.push(device));

      const deviceItems = fixture.nativeElement.querySelectorAll('.device-item');
      deviceItems[1].click();
      fixture.detectChanges();

      expect(emitted).toEqual([devices[1]]);
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

  describe('Disabled State', () => {
    it('should apply audio-disabled class when disabled is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.device-list-wrapper');
      expect(wrapper.classList.contains('audio-disabled')).toBe(true);
    });

    it('should not apply audio-disabled class by default', () => {
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.device-list-wrapper');
      expect(wrapper.classList.contains('audio-disabled')).toBe(false);
    });
  });
});
