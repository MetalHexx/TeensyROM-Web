import { Component, computed, signal, OnDestroy, inject, input, effect } from '@angular/core';
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
} from '@teensyrom-nx/ui/components';
import { CrtSettings, CRT_STORAGE, validatePresetName } from '@teensyrom-nx/domain';
import { VideoDialogComponent } from './video-dialog/video-dialog.component';
import { SettingsStore } from '@teensyrom-nx/application';

interface VideoDevice {
  deviceId: string;
  label: string;
}

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
})
export class VideoCaptureComponent implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly settingsStore = inject(SettingsStore);
  private readonly crtStorage = inject(CRT_STORAGE);

  deviceId = input.required<string>();

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

  private videoDevices = signal<VideoDevice[]>([]);
  private selectedDeviceId = signal<string | null>(null);
  protected readonly currentStream = signal<MediaStream | null>(null);
  private permissionDenied = signal<boolean>(false);

  devices = computed(() => this.videoDevices());
  hasDevices = computed(() => this.videoDevices().length > 0);
  isPermissionDenied = computed(() => this.permissionDenied());
  hasStream = computed(() => this.currentStream() !== null);
  selectedDevice = computed(() => this.selectedDeviceId());

  constructor() {
    this.enumerateVideoDevices();

    effect(() => {
      const deviceId = this.deviceId();
      if (deviceId) {
        const savedSettings = this.crtStorage.load(deviceId, 'video-compact');
        if (savedSettings) {
          this.crtSettings.set(savedSettings);
        } else {
          this.crtSettings.set(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);
        }
      }
    }, { allowSignalWrites: true });
  }

  protected onDeviceSelectorOpenedChange(isOpen: boolean): void {
    this.isDeviceSelectorOpen.set(isOpen);
  }

  /**
   * Enumerate available video input devices
   * POC: Requests permission first to get device labels (browser security requirement)
   */
  private async enumerateVideoDevices(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('MediaDevices API not available');
        return;
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));

      console.log('🎥 Video devices found:', videoInputs);

      permissionStream.getTracks().forEach((track) => track.stop());

      this.videoDevices.set(videoInputs);

      this.selectInitialDevice(videoInputs);
    } catch (error) {
      console.error('Failed to enumerate video devices:', error);
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionDenied.set(true);
      }
    }
  }

  /**
   * Select initial video device based on stored preference.
   * Falls back to first available device if stored device not found or not available.
   */
  private selectInitialDevice(videoInputs: VideoDevice[]): void {
    if (videoInputs.length === 0) {
      console.log('🎥 No video devices available');
      return;
    }

    const teensyDeviceId = this.deviceId();
    const storedVideoDeviceId = this.settingsStore.videoDeviceIdForDevice(teensyDeviceId)();

    console.log('🎥 Looking for stored video device:', storedVideoDeviceId);

    const storedDeviceExists = storedVideoDeviceId &&
      videoInputs.some(d => d.deviceId === storedVideoDeviceId);

    if (storedDeviceExists) {
      console.log('🎥 Using stored video device:', storedVideoDeviceId);
      this.selectedDeviceId.set(storedVideoDeviceId);
      setTimeout(() => this.switchToDevice(storedVideoDeviceId), 100);
    } else {
      const firstDevice = videoInputs[0];
      console.log('🎥 Stored device not found, falling back to first device:', firstDevice.deviceId);
      this.selectedDeviceId.set(firstDevice.deviceId);
      setTimeout(() => this.switchToDevice(firstDevice.deviceId), 100);
    }
  }

  /**
   * Switch to a different video device
   * POC: Stops current stream and starts new one
   */
  private async switchToDevice(deviceId: string): Promise<void> {
    try {
      console.log('🎥 Switching to device:', deviceId);

      const currentStream = this.currentStream();
      if (currentStream) {
        console.log('🎥 Stopping current stream...');
        currentStream.getTracks().forEach((track) => track.stop());
      }

      console.log('🎥 Requesting stream from device:', deviceId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      console.log('🎥 Stream acquired:', videoTrack?.label);
      console.log('🎥 Video track settings:', videoTrack?.getSettings());
      console.log('🎥 Video track enabled:', videoTrack?.enabled);
      console.log('🎥 Video track ready state:', videoTrack?.readyState);
      
      this.currentStream.set(stream);
    } catch (error) {
      console.error('🎥 Failed to switch video device:', error);
      console.error('🎥 Error details:', JSON.stringify(error, null, 2));
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionDenied.set(true);
      }
    }
  }

  /**
   * Handle device selection from dropdown
   */
  onDeviceSelected(videoDeviceId: string): void {
    console.log('🎥 User selected device:', videoDeviceId);
    this.selectedDeviceId.set(videoDeviceId);
    this.switchToDevice(videoDeviceId);

    const teensyDeviceId = this.deviceId();
    console.log('🎥 Persisting video device selection for TeensyROM device:', teensyDeviceId);
    this.settingsStore.updateDeviceVideoDeviceId({
      deviceId: teensyDeviceId,
      videoDeviceId,
    });
  }

  /**
   * Open video in fullscreen dialog
   */
  openVideoDialog(): void {
    const stream = this.currentStream();
    if (!stream) return;

    const deviceLabel = this.devices().find(d => d.deviceId === this.selectedDeviceId())?.label || 'Video Capture';
    const selectedDeviceId = this.selectedDeviceId() || '';

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
      if (result?.selectedDeviceId && result.selectedDeviceId !== this.selectedDeviceId()) {
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
      settings = CRT_PRESETS[presetName];
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

  ngOnDestroy(): void {
    const stream = this.currentStream();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
}
