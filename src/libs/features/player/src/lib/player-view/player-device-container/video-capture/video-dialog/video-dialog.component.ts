import { Component, Inject, ChangeDetectionStrategy, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  IconButtonComponent,
  CompactCardLayoutComponent,
  VideoStreamComponent,
  CrtEffectWrapperComponent,
  ContentOverlayContainerComponent,
  CrtSettingsPanelComponent,
  CrtSettings,
  CrtSettingsConfig,
  CRT_PRESETS,
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
} from '@teensyrom-nx/ui/components';
import { PlayerToolbarComponent } from '../../player-toolbar/player-toolbar.component';
import { FilterToolbarComponent } from '../../storage-container/filter-toolbar/filter-toolbar.component';

export interface VideoDialogData {
  stream: MediaStream;
  deviceLabel: string;
  deviceId: string;
}

@Component({
  selector: 'lib-video-dialog',
  standalone: true,
  imports: [
    CommonModule,
    IconButtonComponent,
    CompactCardLayoutComponent,
    VideoStreamComponent,
    CrtEffectWrapperComponent,
    ContentOverlayContainerComponent,
    CrtSettingsPanelComponent,
    PlayerToolbarComponent,
    FilterToolbarComponent,
  ],
  templateUrl: './video-dialog.component.html',
  styleUrl: './video-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoDialogComponent {
  /** Reference to overlay container for fullscreen control */
  protected readonly overlayContainer = viewChild<ContentOverlayContainerComponent>('overlayContainer');

  /** Whether CRT effects are enabled */
  protected readonly isCrtEnabled = signal<boolean>(true);

  /** Whether CRT settings panel is visible */
  protected readonly showCrtControls = signal<boolean>(false);

  /** Unified CRT settings (consolidated from 8 individual signals) */
  protected readonly crtSettings = signal<CrtSettings>({
    scanlineIntensity: 0.50,
    scanlineThickness: 3,
    scanlineSpacing: 2,
    vignetteStrength: 1.30,
    screenCurvature: 115,
    contrast: 1.10,
    brightness: 1.50,
    saturation: 1.30,
  });

  /** CRT config - full features for video dialog */
  protected readonly crtConfig: CrtSettingsConfig = CRT_CONFIGS.full;

  /** Expose presets for template usage */
  protected readonly CRT_PRESETS = CRT_PRESETS;
  protected readonly DEFAULT_CRT_SETTINGS = DEFAULT_CRT_SETTINGS;

  constructor(
    public dialogRef: MatDialogRef<VideoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VideoDialogData
  ) {}

  /** Close the dialog */
  onClose(): void {
    this.dialogRef.close();
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

  /** Handle CRT settings changes from settings panel */
  onCrtSettingsChange(settings: CrtSettings): void {
    this.crtSettings.set(settings);
  }

  /** Reset CRT settings to defaults */
  onCrtReset(): void {
    this.crtSettings.set(DEFAULT_CRT_SETTINGS);
  }

  /** Apply a CRT preset */
  onCrtPresetSelected(presetName: keyof typeof CRT_PRESETS): void {
    this.crtSettings.set(CRT_PRESETS[presetName]);
  }
}
