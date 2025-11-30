import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CycleImageComponent,
  ScalingCardComponent,
  ContentOverlayContainerComponent,
  CrtEffectWrapperComponent,
  CrtSettingsPanelComponent,
  VideoControlsToolbarComponent,
  CRT_CONFIGS,
  CRT_PRESETS,
  CrtSettings,
} from '@teensyrom-nx/ui/components';
import type { LaunchedFile } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-file-image',
  imports: [
    CommonModule,
    ScalingCardComponent,
    CycleImageComponent,
    ContentOverlayContainerComponent,
    CrtEffectWrapperComponent,
    CrtSettingsPanelComponent,
    VideoControlsToolbarComponent,
  ],
  templateUrl: './file-image.component.html',
  styleUrl: './file-image.component.scss',
})
export class FileImageComponent {
  // Inputs
  currentFile = input<LaunchedFile | null>();

  // CRT configuration - small preset (subtle scanlines for compact display)
  readonly crtConfig = CRT_CONFIGS.small;

  // CRT state signals
  protected readonly isCrtEnabled = signal<boolean>(true);
  protected readonly crtSettings = signal<CrtSettings>(CRT_PRESETS.small);
  protected readonly showCrtControls = signal<boolean>(false);

  // Computed signals derived from input
  creatorName = computed(() => {
    const creator = this.currentFile()?.file.creator;
    return creator && creator.trim().length > 0 ? creator : 'Welcome to TeensyROM!';
  });
  metadataSource = computed(() => {
    const images = this.currentFile()?.file.images;
    if (images && images.length > 0) {
      const source = images[0].source;
      return source && source.trim().length > 0 ? source : 'hExx';
    }
    return 'hExx';
  });
  imageUrls = computed(
    () =>
      this.currentFile()
        ?.file.images.map((img) => img.url)
        .filter((url: string) => url && url.length > 0) ?? []
  );
  hasImages = computed(() => this.imageUrls().length > 0);

  /**
   * Toggle CRT effect on/off
   */
  toggleCrtEffect(): void {
    this.isCrtEnabled.update((enabled) => !enabled);
  }

  /**
   * Toggle CRT controls panel visibility
   */
  toggleCrtControls(): void {
    this.showCrtControls.update((show) => !show);
  }

  /**
   * Handle CRT settings changes from settings panel
   */
  onCrtSettingsChange(settings: CrtSettings): void {
    this.crtSettings.set(settings);
  }

  /**
   * Reset CRT settings to default preset
   */
  onCrtReset(): void {
    this.crtSettings.set(CRT_PRESETS.small);
  }

  /**
   * Apply a CRT preset
   */
  onCrtPresetSelected(presetName: keyof typeof CRT_PRESETS): void {
    this.crtSettings.set(CRT_PRESETS[presetName]);
  }
}
