import { Component, input, effect, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { IconLabelComponent, ActionButtonComponent } from '@teensyrom-nx/ui/components';
import { AudioStore } from '@teensyrom-nx/application';
import { AudioDevice, AUDIO_STREAM_SERVICE, ChannelConfig } from '@teensyrom-nx/domain';
import { VuMeterComponent } from './vu-meter/vu-meter.component';
import { ChannelConfigComponent } from './channel-config/channel-config.component';

/**
 * Embeddable component that displays available audio input devices, allows device
 * selection, provides channel configuration, and shows sample rate information.
 *
 * Designed to be embedded within device settings cards. Audio devices are host-level
 * and shared across all TeensyROM devices.
 *
 * @example
 * ```html
 * <lib-audio-settings-section
 *   [audioFormGroup]="getAudioSettings(deviceGroup)"
 *   [savedDeviceIndex]="getAudioDeviceIndex(deviceGroup)"
 *   [deviceId]="getDeviceId(deviceGroup)"
 *   [deviceIndex]="0"
 *   [loadOnInit]="true" />
 * ```
 */
@Component({
  selector: 'lib-audio-settings-section',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSliderModule,
    ReactiveFormsModule,
    FormsModule,
    IconLabelComponent,
    ActionButtonComponent,
    VuMeterComponent,
    ChannelConfigComponent,
  ],
  templateUrl: './audio-settings-section.component.html',
  styleUrl: './audio-settings-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioSettingsSectionComponent {
  readonly audioStore = inject(AudioStore);
  private readonly audioStreamService = inject(AUDIO_STREAM_SERVICE);
  private readonly destroyRef = inject(DestroyRef);

  /** Index of this device in the knownDevices FormArray */
  deviceIndex = input<number>(0);

  /** Reactive form group for audio settings persistence */
  audioFormGroup = input<FormGroup | null>(null);

  /** Pre-configured audio device index from saved settings (-1 = none) */
  savedDeviceIndex = input<number>(-1);

  /** TeensyROM device ID for streaming operations */
  deviceId = input<string>('');

  /** Whether to load devices on component init (default: true) */
  loadOnInit = input<boolean>(true);

  /** Whether devices have been loaded at least once */
  private readonly devicesLoaded = signal(false);

  // ── Multi-channel state ───────────────────────────────────────────────
  /** Channel configurations for the selected device */
  readonly channelConfigs = signal<ChannelConfig[]>([]);

  /** Per-channel volume levels (keyed by channel index) */
  readonly channelVolumes = signal<Map<number, number>>(new Map());

  // ── Test lifecycle state ──────────────────────────────────────────────
  /** Whether an audio test capture is currently active */
  readonly isTesting = signal(false);

  /** Real-time volume level (0–1) fed to the VU meter during a test */
  readonly volumeLevel = signal<number>(0);

  /** Volume level subscription active during a test */
  private volumeSubscription: Subscription | null = null;
  private channelVolumesSubscription: Subscription | null = null;

  /** Button label reflecting the current test state */
  readonly testButtonLabel = computed(() => {
    if (this.audioStore.isConnecting()) return 'Connecting...';
    if (this.isTesting()) return 'Stop Test';
    return 'Test Audio';
  });

  /** Button icon reflecting the current test state */
  readonly testButtonIcon = computed(() => {
    if (this.audioStore.isConnecting()) return 'hourglass_empty';
    if (this.isTesting()) return 'stop';
    return 'mic';
  });

  // ── Latency tuning state ──────────────────────────────────────────────
  /** Pre-buffer duration in ms (controls initial playback delay) */
  readonly preBufferMs = signal(this.audioStreamService.getPreBufferDuration() * 1000);

  /** Catch-up padding in ms (added when playback falls behind) */
  readonly catchUpPaddingMs = signal(this.audioStreamService.getCatchUpPadding() * 1000);

  /** Whether the test button should be disabled */
  readonly isTestButtonDisabled = computed(() => {
    return this.audioStore.selectedDeviceIndex() === null || this.audioStore.isConnecting() || !this.deviceId();
  });

  /** The currently selected device based on the store's selectedDeviceIndex */
  readonly selectedDevice = computed<AudioDevice | null>(() => {
    const devices = this.audioStore.devices();
    const selectedIndex = this.audioStore.selectedDeviceIndex();
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= devices.length) {
      return null;
    }
    return devices[selectedIndex];
  });

  /** Formatted sample rate for display (e.g., "48,000 Hz") */
  readonly formattedSampleRate = computed(() => {
    const device = this.selectedDevice();
    if (!device) return '—';
    return `${device.defaultSampleRate.toLocaleString()} Hz`;
  });

  /** Whether the selected device supports multiple channels */
  readonly isMultiChannel = computed(() => {
    const device = this.selectedDevice();
    return device !== null && device.maxInputChannels > 1;
  });

  constructor() {
    // Load devices on init if loadOnInit is true (first embedded component should load)
    effect(() => {
      if (this.loadOnInit() && !this.devicesLoaded()) {
        this.devicesLoaded.set(true);
        this.audioStore.loadDevices();
      }
    });

    // Pre-select saved device when devices are loaded
    effect(() => {
      const devices = this.audioStore.devices();
      const savedIndex = this.savedDeviceIndex();
      if (devices.length > 0 && savedIndex >= 0) {
        const matchingDevice = devices.find((d) => d.index === savedIndex);
        if (matchingDevice) {
          this.audioStore.selectDevice(matchingDevice.index);

          // Load or generate channel configs for multi-channel devices
          if (matchingDevice.maxInputChannels > 1) {
            this.loadOrGenerateChannelConfigs(matchingDevice);
          }
        }
      }
    });

    // Clean up test resources when component is destroyed
    this.destroyRef.onDestroy(() => this.cleanupTest());
  }

  /**
   * Loads channel configs from saved form settings, or generates defaults if none exist.
   */
  private loadOrGenerateChannelConfigs(device: AudioDevice): void {
    const fg = this.audioFormGroup();
    if (fg) {
      const savedChannels = fg.get('channels')?.value as ChannelConfig[] | null;
      if (savedChannels && savedChannels.length > 0) {
        // Use saved channel configs
        this.channelConfigs.set(savedChannels);
        return;
      }
    }
    // No saved configs - generate defaults
    this.generateDefaultChannelConfigs(device.maxInputChannels);
  }

  /**
   * Handles device selection from the list.
   * Updates both the AudioStore (runtime state) and the form group (persistence).
   * Auto-generates channel configs for multi-channel devices.
   */
  onSelectDevice(device: AudioDevice): void {
    this.audioStore.selectDevice(device.index);
    this.patchFormGroup({
      audioDeviceIndex: device.index,
      audioDeviceName: device.name,
      sampleRate: device.defaultSampleRate,
    });

    // Auto-generate channel configs for multi-channel devices
    if (device.maxInputChannels > 1) {
      this.generateDefaultChannelConfigs(device.maxInputChannels);
    }
  }

  /**
   * Generates default channel configurations for a multi-channel device.
   * @param channelCount - Number of input channels on the device
   */
  private generateDefaultChannelConfigs(channelCount: number): void {
    const configs: ChannelConfig[] = [];
    for (let i = 0; i < channelCount; i++) {
      configs.push({
        sourceChannel: i,
        enabled: true,
      });
    }
    this.channelConfigs.set(configs);
    this.patchFormGroup({
      channels: configs,
      captureChannelCount: channelCount,
    });
  }

  /**
   * Checks if a device is currently selected.
   */
  isSelected(device: AudioDevice): boolean {
    return this.audioStore.selectedDeviceIndex() === device.index;
  }

  // ── Channel configuration ──────────────────────────────────────────────

  /**
   * Gets the VU level for a specific channel.
   */
  getChannelVuLevel(channelIndex: number): number {
    return this.channelVolumes().get(channelIndex) ?? 0;
  }

  /**
   * Handles channel configuration changes from the dumb component.
   */
  onChannelConfigChanged(index: number, config: ChannelConfig): void {
    const configs = [...this.channelConfigs()];
    configs[index] = config;
    this.channelConfigs.set(configs);
    this.patchFormGroup({ channels: configs });
  }

  // ── Test Audio lifecycle ──────────────────────────────────────────────

  /**
   * Toggles the audio test on or off.
   * When starting, begins a capture on the selected device and subscribes
   * to volume levels.  When stopping (or after auto-stop timeout), releases
   * all capture resources.
   */
  onToggleTest(): void {
    if (this.isTesting()) {
      this.stopTest();
    } else {
      this.startTest();
    }
  }

  private startTest(): void {
    const deviceIndex = this.audioStore.selectedDeviceIndex();
    const teensyDeviceId = this.deviceId();
    if (deviceIndex === null || !teensyDeviceId) return;

    this.isTesting.set(true);
    this.volumeLevel.set(0);
    this.channelVolumes.set(new Map());

    // Load channel configs into the store
    const configs = this.channelConfigs();
    if (configs.length > 0) {
      this.audioStore.loadChannelConfigs(configs);
    }

    // Start capture via the store using the TeensyROM device ID
    this.audioStore.startStream(teensyDeviceId);

    // Subscribe to aggregate volume levels
    this.volumeSubscription = this.audioStreamService.volumeLevel$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((level) => this.volumeLevel.set(level));

    // Subscribe to per-channel volume levels
    this.channelVolumesSubscription = this.audioStreamService.channelVolumes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((volumes) => this.channelVolumes.set(volumes));
  }

  private stopTest(): void {
    this.cleanupTest();
    this.audioStore.stopStream();
    this.isTesting.set(false);
    this.volumeLevel.set(0);
    this.channelVolumes.set(new Map());
  }

  private cleanupTest(): void {
    if (this.volumeSubscription) {
      this.volumeSubscription.unsubscribe();
      this.volumeSubscription = null;
    }
    if (this.channelVolumesSubscription) {
      this.channelVolumesSubscription.unsubscribe();
      this.channelVolumesSubscription = null;
    }
  }

  // ── Form integration helpers ──────────────────────────────────────────

  /**
   * Updates the pre-buffer duration in real time.
   * Takes milliseconds from the slider, converts to seconds for the service.
   */
  onPreBufferChange(ms: number): void {
    this.preBufferMs.set(ms);
    this.audioStreamService.setPreBufferDuration(ms / 1000);
  }

  /**
   * Updates the catch-up padding in real time.
   * Takes milliseconds from the slider, converts to seconds for the service.
   */
  onCatchUpPaddingChange(ms: number): void {
    this.catchUpPaddingMs.set(ms);
    this.audioStreamService.setCatchUpPadding(ms / 1000);
  }

  /**
   * Patches the audio form group with partial values if it exists.
   */
  private patchFormGroup(values: Record<string, unknown>): void {
    const fg = this.audioFormGroup();
    if (fg) {
      fg.patchValue(values);
    }
  }
}
