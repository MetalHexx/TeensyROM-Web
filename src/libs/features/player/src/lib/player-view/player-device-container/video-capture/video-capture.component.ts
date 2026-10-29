import { Component, computed, signal, inject, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import {
  VideoStreamComponent,
  ContentOverlayContainerComponent,
  CrtEffectWrapperComponent,
  CrtSettingsPanelOverlayComponent,
  ScalingCompactCardComponent,
  VideoDeviceSelectorComponent,
  VideoControlsToolbarComponent,
  CRT_CONFIGS,
  CRT_PRESETS,
  CRT_PRESET_KEYS,
  AnyPresetName,
  isBuiltInPreset,
  VideoCaptureSession,
} from '@teensyrom-nx/ui/components';
import { CrtSettings, CRT_STORAGE, validatePresetName, crtVideoStandardFor } from '@teensyrom-nx/domain';
import { VideoDialogComponent } from './video-dialog/video-dialog.component';
import { DeviceStore, SettingsStore } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-video-capture',
  imports: [
    CommonModule,
    VideoStreamComponent,
    ContentOverlayContainerComponent,
    CrtEffectWrapperComponent,
    CrtSettingsPanelOverlayComponent,
    ScalingCompactCardComponent,
    VideoDeviceSelectorComponent,
    VideoControlsToolbarComponent,
  ],
  templateUrl: './video-capture.component.html',
  styleUrl: './video-capture.component.scss',
  providers: [VideoCaptureSession],
})
export class VideoCaptureComponent {
  private readonly dialog = inject(MatDialog);
  private readonly settingsStore = inject(SettingsStore);
  private readonly crtStorage = inject(CRT_STORAGE);
  private readonly deviceStore = inject(DeviceStore);
  private readonly session = inject(VideoCaptureSession);

  deviceId = input.required<string>();

  /** Video standard new CRT settings start in: the device's own, or PAL when unknown. */
  private readonly deviceStandard = computed(() =>
    crtVideoStandardFor(this.deviceStore.devices().find((d) => d.deviceId === this.deviceId()))
  );

  readonly crtConfig = CRT_CONFIGS.smallVideo;

  /**
   * Context-appropriate label for the current preset.
   * Shows "Default" to users instead of context-based labels like "Small Video (WebGL)".
   */
  protected readonly currentPresetLabel = computed(() => 'Default');
  protected readonly excludePresets = computed(() => [CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL, CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]);

  /**
   * Validation function for custom preset names.
   * Passed to CrtSettingsPanelComponent for preset name validation.
   */
  readonly validatePresetNameFn = (name: string, existingNames: string[]) => {
    const result = validatePresetName(name, existingNames);
    return { error: result.error ?? null };
  };

  protected readonly isCrtEnabled = signal<boolean>(true);
  protected readonly crtSettings = signal<CrtSettings>(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);
  protected readonly showCrtControls = signal<boolean>(false);
  protected readonly isDeviceSelectorOpen = signal<boolean>(false);
  protected readonly showDeviceSelector = signal<boolean>(false);

  /** Debug mode state for black bar detection visualization */
  protected readonly debugMode = signal<boolean>(false);

  protected readonly currentStream = computed(() => this.session.stream());

  devices = computed(() => this.session.devices());
  hasDevices = computed(() => this.session.hasDevices());
  isPermissionDenied = computed(() => this.session.permissionDenied());
  hasStream = computed(() => this.session.stream() !== null);
  selectedDevice = computed(() => this.session.selectedDeviceId());

  constructor() {
    void this.session.start(() => this.settingsStore.videoDeviceIdForDevice(this.deviceId())());

    effect(() => {
      const deviceId = this.deviceId();
      if (deviceId) {
        const savedSettings = this.crtStorage.load(deviceId, 'video-compact');
        if (savedSettings) {
          this.crtSettings.set(savedSettings);
        } else {
          this.crtSettings.set({
            ...CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL],
            videoStandard: this.deviceStandard(),
          });
        }
      }
    }, { allowSignalWrites: true });
  }

  protected onDeviceSelectorOpenedChange(isOpen: boolean): void {
    this.isDeviceSelectorOpen.set(isOpen);
  }

  /**
   * Handle device selection from dropdown
   */
  onDeviceSelected(videoDeviceId: string): void {
    void this.session.select(videoDeviceId);

    const teensyDeviceId = this.deviceId();
    this.settingsStore.updateDeviceVideoDeviceId({
      deviceId: teensyDeviceId,
      videoDeviceId,
    });
  }

  /**
   * Open video in fullscreen dialog
   */
  openVideoDialog(): void {
    const stream = this.session.stream();
    if (!stream) return;

    const deviceLabel = this.devices().find(d => d.deviceId === this.session.selectedDeviceId())?.label || 'Video Capture';
    const selectedDeviceId = this.session.selectedDeviceId() || '';

    const dialogRef = this.dialog.open(VideoDialogComponent, {
      data: {
        stream,
        deviceLabel,
        deviceId: this.deviceId(),
        devices: this.devices(),
        selectedDeviceId,
      },
      width: '85vw',
      height: '85vh',
      maxWidth: '1200px',
      maxHeight: '900px',
      panelClass: 'video-dialog-fullscreen',
    });

    dialogRef.afterClosed().subscribe((result: { selectedDeviceId: string } | null) => {
      if (result?.selectedDeviceId && result.selectedDeviceId !== this.session.selectedDeviceId()) {
        this.onDeviceSelected(result.selectedDeviceId);
      }
    });
  }

  /**
   * Toggle CRT effect on/off
   */
  toggleCrtEffect(): void {
    this.isCrtEnabled.update(enabled => !enabled);
  }

  /**
   * Toggle CRT controls panel visibility
   */
  toggleCrtControls(): void {
    this.showCrtControls.update(show => !show);
  }

  /**
   * Toggle device selector visibility
   */
  toggleDeviceSelector(): void {
    this.showDeviceSelector.update(show => !show);
  }

  /**
   * Handle CRT settings changes from settings panel
   * Persists settings to localStorage per device
   */
  onCrtSettingsChange(settings: CrtSettings): void {
    this.crtSettings.set(settings);
    const deviceId = this.deviceId();
    if (deviceId) {
      this.crtStorage.save(deviceId, 'video-compact', settings);
    }
  }

  /**
   * Handle debug mode toggle from settings panel
   */
  onDebugModeChange(enabled: boolean): void {
    this.debugMode.set(enabled);
  }

  onCrtPresetSelected(presetName: AnyPresetName): void {
    let settings: CrtSettings;

    if (isBuiltInPreset(presetName)) {
      settings = { ...CRT_PRESETS[presetName], videoStandard: this.deviceStandard() };
    } else {
      const customPresets = this.crtStorage.loadCustomPresets();
      const preset = customPresets.find(p => p.name === presetName);

      if (!preset) {
        console.warn(`[VideoCaptureComponent] Custom preset not found: ${presetName}`);
        return;
      }

      settings = preset.settings;
    }

    this.crtSettings.set(settings);
    const deviceId = this.deviceId();
    if (deviceId) {
      this.crtStorage.save(deviceId, 'video-compact', settings);
    }
  }
}
