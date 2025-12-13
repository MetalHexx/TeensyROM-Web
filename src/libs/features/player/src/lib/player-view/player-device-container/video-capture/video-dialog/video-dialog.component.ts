import { Component, Inject, ChangeDetectionStrategy, signal, viewChild, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  IconButtonComponent,
  VideoStreamComponent,
  CrtEffectWrapperComponent,
  ContentOverlayContainerComponent,
  CrtSettingsPanelComponent,
  CrtSettingsConfig,
  CRT_PRESETS,
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  VideoDeviceSelectorComponent,
  VideoControlsToolbarComponent,
  AnyPresetName,
  isBuiltInPreset,
} from '@teensyrom-nx/ui/components';
import { CrtSettings, CRT_STORAGE } from '@teensyrom-nx/domain';
import { validatePresetName } from '@teensyrom-nx/infrastructure';
import { PlayerToolbarComponent } from '../../player-toolbar/player-toolbar.component';
import { FilterToolbarComponent } from '../../storage-container/filter-toolbar/filter-toolbar.component';

export interface VideoDevice {
  deviceId: string;
  label: string;
}

export interface VideoDialogData {
  stream: MediaStream;
  deviceLabel: string;
  deviceId: string;
  devices: VideoDevice[];
  selectedDeviceId: string;
}

@Component({
  selector: 'lib-video-dialog',
  standalone: true,
  imports: [
    CommonModule,
    IconButtonComponent,
    VideoStreamComponent,
    CrtEffectWrapperComponent,
    ContentOverlayContainerComponent,
    CrtSettingsPanelComponent,
    VideoDeviceSelectorComponent,
    VideoControlsToolbarComponent,
    PlayerToolbarComponent,
    FilterToolbarComponent,
  ],
  templateUrl: './video-dialog.component.html',
  styleUrl: './video-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoDialogComponent implements OnDestroy {
  private readonly crtStorage = inject(CRT_STORAGE);

  /** Reference to overlay container for fullscreen control */
  protected readonly overlayContainer = viewChild<ContentOverlayContainerComponent>('overlayContainer');

  /** Whether CRT effects are enabled */
  protected readonly isCrtEnabled = signal<boolean>(true);

  /** Whether CRT settings panel is visible */
  protected readonly showCrtControls = signal<boolean>(false);

  /** Whether device selector is visible */
  protected readonly showDeviceSelector = signal<boolean>(false);

  /** Whether device selector dropdown is currently open (pauses overlay hover) */
  protected readonly isDeviceSelectorOpen = signal<boolean>(false);

  /** Current stream - can be updated when device changes */
  protected readonly currentStream = signal<MediaStream | null>(null);

  /** Currently selected device ID */
  protected readonly selectedDeviceId = signal<string>('');

  /** Track if we created the current stream (vs using parent's) */
  private ownsCurrentStream = false;

  /** Unified CRT settings (consolidated from 8 individual signals) */
  protected readonly crtSettings = signal<CrtSettings>({
    scanlineIntensity: 0.50,
    scanlineSize: 2.5,
    vignetteStrength: 1.30,
    screenCurvature: 115,
    contrast: 1.10,
    brightness: 1.50,
    saturation: 1.30,
    hue: 0,
    renderMode: 'webgl',
    // Advanced effects (disabled by default)
    phosphorPattern: 'none',
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  });

  /** CRT config - full features for video dialog */
  protected readonly crtConfig: CrtSettingsConfig = CRT_CONFIGS.full;

  /**
   * Validation function for custom preset names.
   * Passed to CrtSettingsPanelComponent for preset name validation.
   */
  readonly validatePresetNameFn = (name: string, existingNames: string[]) => {
    const result = validatePresetName(name, existingNames);
    return { error: result.error ?? null };
  };

  /** Expose presets for template usage */
  protected readonly CRT_PRESETS = CRT_PRESETS;
  protected readonly DEFAULT_CRT_SETTINGS = DEFAULT_CRT_SETTINGS;

  constructor(
    public dialogRef: MatDialogRef<VideoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VideoDialogData
  ) {
    this.currentStream.set(data.stream);
    this.selectedDeviceId.set(data.selectedDeviceId);

    // Load saved CRT settings for this device
    const savedSettings = this.crtStorage.load(data.deviceId, 'video-dialog');
    if (savedSettings) {
      this.crtSettings.set(savedSettings);
    }
  }

  /** Close the dialog */
  onClose(): void {
    this.dialogRef.close(this.getResult());
  }

  /** Toggle fullscreen via overlay container */
  toggleFullscreen(): void {
    this.overlayContainer()?.toggleFullscreen();
  }

  /** Toggle CRT effect on/off */
  toggleCrtEffect(): void {
    this.isCrtEnabled.update(enabled => !enabled);
  }

  /** Toggle CRT controls panel visibility */
  toggleCrtControls(): void {
    this.showCrtControls.update(show => !show);
  }

  /** Toggle device selector visibility */
  toggleDeviceSelector(): void {
    this.showDeviceSelector.update(show => !show);
  }

  /** Handle device selector opened/closed state - pauses overlay hover */
  onDeviceSelectorOpenedChange(isOpen: boolean): void {
    this.isDeviceSelectorOpen.set(isOpen);
  }

  /** Handle device selection - switch stream and notify parent */
  async onDeviceSelected(videoDeviceId: string): Promise<void> {
    if (videoDeviceId === this.selectedDeviceId()) return;

    try {
      // Only stop streams we created, not the parent's original stream
      if (this.ownsCurrentStream) {
        const current = this.currentStream();
        if (current) {
          current.getTracks().forEach(track => track.stop());
        }
      }

      // Get new stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: videoDeviceId } },
        audio: false,
      });

      this.currentStream.set(stream);
      this.selectedDeviceId.set(videoDeviceId);
      this.ownsCurrentStream = true; // We now own this stream
    } catch (error) {
      console.error('🎥 Failed to switch video device in dialog:', error);
    }
  }

  /** Get result data for parent on close */
  getResult(): { selectedDeviceId: string } | null {
    // Only return result if device changed
    if (this.selectedDeviceId() !== this.data.selectedDeviceId) {
      return { selectedDeviceId: this.selectedDeviceId() };
    }
    return null;
  }

  /** Handle CRT settings changes from settings panel */
  onCrtSettingsChange(settings: CrtSettings): void {
    this.crtSettings.set(settings);
    this.crtStorage.save(this.data.deviceId, 'video-dialog', settings);
  }

  /** Apply a CRT preset (built-in or custom) */
  onCrtPresetSelected(presetName: AnyPresetName): void {
    let settings: CrtSettings;

    // Branch on preset type using type guard
    if (isBuiltInPreset(presetName)) {
      // Built-in preset: load from CRT_PRESETS constant
      settings = CRT_PRESETS[presetName];
    } else {
      // Custom preset: load from storage
      const customPresets = this.crtStorage.loadCustomPresets();
      const preset = customPresets.find(p => p.name === presetName);

      if (!preset) {
        console.warn(`[VideoDialogComponent] Custom preset not found: ${presetName}`);
        return; // Early return, don't change settings
      }

      settings = preset.settings;
    }

    // Apply settings and persist (same for both preset types)
    this.crtSettings.set(settings);
    this.crtStorage.save(this.data.deviceId, 'video-dialog', settings);
  }

  /** Cleanup streams we created on destroy */
  ngOnDestroy(): void {
    if (this.ownsCurrentStream) {
      const stream = this.currentStream();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }
}
