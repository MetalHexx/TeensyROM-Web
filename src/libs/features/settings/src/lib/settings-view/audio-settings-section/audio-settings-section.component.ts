import { Component, input, effect, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { AbstractControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { IconLabelComponent } from '@teensyrom-nx/ui/components';
import { AudioStore } from '@teensyrom-nx/application';
import { AudioDevice, AUDIO_STREAM_SERVICE, ChannelConfig } from '@teensyrom-nx/domain';
import { VuMeterComponent } from './vu-meter/vu-meter.component';
import { ChannelConfigComponent } from './channel-config/channel-config.component';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';
import { SettingsFormService } from '../settings-form.service';

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
    VuMeterComponent,
    ChannelConfigComponent,
    SettingsToggleItemComponent,
  ],
  templateUrl: './audio-settings-section.component.html',
  styleUrl: './audio-settings-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioSettingsSectionComponent {
  readonly audioStore = inject(AudioStore);
  private readonly audioStreamService = inject(AUDIO_STREAM_SERVICE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsFormService = inject(SettingsFormService, { optional: true });
  private applyAudioChangeQueue: Promise<void> = Promise.resolve();

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

  /** Whether audio streaming is enabled for this device */
  readonly isAudioStreamEnabled = signal(false);

  /** Gets the enableAudioStream form control */
  getEnableAudioStreamControl(): AbstractControl | null {
    return this.audioFormGroup()?.get('enableAudioStream') ?? null;
  }

  // ── Multi-channel state ───────────────────────────────────────────────
  /** Channel configurations for the selected device */
  readonly channelConfigs = signal<ChannelConfig[]>([]);

  /** Per-channel volume levels (keyed by channel index) */
  readonly channelVolumes = signal<Map<number, number>>(new Map());

  /** Real-time volume level (0–1) fed to the VU meter while audio streaming is enabled */
  readonly volumeLevel = signal<number>(0);

  /** Audio meter subscriptions */
  private volumeSubscription: Subscription | null = null;
  private channelVolumesSubscription: Subscription | null = null;

  // ── Latency tuning state ──────────────────────────────────────────────
  /** Pre-buffer duration in ms (controls initial playback delay) */
  readonly preBufferMs = signal(this.audioStreamService.getPreBufferDuration() * 1000);

  /** Catch-up padding in ms (added when playback falls behind) */
  readonly catchUpPaddingMs = signal(this.audioStreamService.getCatchUpPadding() * 1000);

  // ── Opus encoding toggle ──────────────────────────────────────────────
  /** Whether Opus encoding is enabled (default: true for compression) */
  readonly useOpusEncoding = signal(true);

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

  /** VU meters are visible whenever audio streaming is enabled for this device */
  readonly showVuMeters = computed(() => this.isAudioStreamEnabled());

  constructor() {
    // Track enableAudioStream value from form group
    effect(() => {
      const fg = this.audioFormGroup();
      if (!fg) return;
      const ctrl = fg.get('enableAudioStream');
      if (ctrl) {
        this.isAudioStreamEnabled.set(ctrl.value === true);
        ctrl.valueChanges
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((value: boolean) => {
            this.isAudioStreamEnabled.set(value);
            this.enqueueAudioChange(async () => {
              await this.saveSettingsNow();
              if (value) {
                await this.startAudioStreaming();
              } else {
                await this.stopAudioStreaming();
              }
            });
          });
      }
    });

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

    // Initialize useOpusEncoding from form group and subscribe to changes
    effect(() => {
      const fg = this.audioFormGroup();
      if (!fg) return;

      const savedValue = fg.get('useOpusEncoding')?.value;
      if (savedValue !== null && savedValue !== undefined) {
        this.useOpusEncoding.set(savedValue);
        this.audioStreamService.setUseOpusEncoding(savedValue);
      }

      // Watch for subsequent toggle changes to keep service in sync and prevent
      // codec mismatch (Opus bytes interpreted as raw PCM = squealing noise)
      fg.get('useOpusEncoding')?.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((value: boolean) => {
          this.useOpusEncoding.set(value);
          this.enqueueAudioChange(async () => {
            await this.saveSettingsNow();
            // Reconfigure the backend first, then switch client decode mode during reconnect
            if (this.shouldMaintainLiveConnection()) {
              await this.stopAudioStreaming();
            }
            this.audioStreamService.setUseOpusEncoding(value);
            if (this.shouldMaintainLiveConnection()) {
              await this.startAudioStreaming();
            }
          });
        });
    });

    this.subscribeToAudioMeters();
    this.destroyRef.onDestroy(() => this.cleanupMeterSubscriptions());
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

    this.enqueueAudioChange(async () => {
      await this.saveSettingsNow();
      if (this.shouldMaintainLiveConnection()) {
        await this.restartAudioStreaming();
      }
    });
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

    this.enqueueAudioChange(async () => {
      await this.saveSettingsNow();
      if (this.shouldMaintainLiveConnection()) {
        await this.restartAudioStreaming();
      }
    });
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
   * Returns the form control for the Opus encoding toggle, or null if the form group is not set.
   * Used to bind the toggle to the settings form via lib-settings-toggle-item.
   */
  getUseOpusEncodingControl(): AbstractControl | null {
    return this.audioFormGroup()?.get('useOpusEncoding') ?? null;
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

  private enqueueAudioChange(operation: () => Promise<void>): void {
    this.applyAudioChangeQueue = this.applyAudioChangeQueue
      .then(operation)
      .catch((error) => console.error('Audio settings apply failed:', error));
  }

  private async saveSettingsNow(): Promise<void> {
    await this.settingsFormService?.saveSettings();
  }

  private shouldMaintainLiveConnection(): boolean {
    return this.isAudioStreamEnabled();
  }

  private canStartAudioStreaming(): boolean {
    return this.audioStore.selectedDeviceIndex() !== null && this.deviceId().trim().length > 0;
  }

  private async startAudioStreaming(): Promise<void> {
    if (!this.canStartAudioStreaming()) {
      return;
    }

    const configs = this.channelConfigs();
    if (configs.length > 0) {
      this.audioStore.loadChannelConfigs(configs);
    }

    this.audioStreamService.setUseOpusEncoding(this.useOpusEncoding());
    await Promise.resolve(this.audioStore.startStream(this.deviceId()));
  }

  private async stopAudioStreaming(): Promise<void> {
    await Promise.resolve(this.audioStore.stopStream());
    this.volumeLevel.set(0);
    this.channelVolumes.set(new Map());
  }

  private async restartAudioStreaming(): Promise<void> {
    await this.stopAudioStreaming();
    await this.startAudioStreaming();
  }

  private subscribeToAudioMeters(): void {
    if (!this.volumeSubscription) {
      this.volumeSubscription = this.audioStreamService.volumeLevel$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((level) => this.volumeLevel.set(level));
    }

    if (!this.channelVolumesSubscription) {
      this.channelVolumesSubscription = this.audioStreamService.channelVolumes$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((volumes) => this.channelVolumes.set(volumes));
    }
  }

  private cleanupMeterSubscriptions(): void {
    if (this.volumeSubscription) {
      this.volumeSubscription.unsubscribe();
      this.volumeSubscription = null;
    }
    if (this.channelVolumesSubscription) {
      this.channelVolumesSubscription.unsubscribe();
      this.channelVolumesSubscription = null;
    }
  }
}
