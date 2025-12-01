import { Component, computed, input, signal, inject, effect } from '@angular/core';
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
} from '@teensyrom-nx/ui/components';
import { CrtSettings, CRT_STORAGE } from '@teensyrom-nx/domain';
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
  private readonly crtStorage = inject(CRT_STORAGE);

  // Inputs
  deviceId = input.required<string>();
  currentFile = input<LaunchedFile | null>();

  // CRT configuration - standard config (hide curvature since it's hardcoded to 16px)
  readonly crtConfig = CRT_CONFIGS.standard;

  // File-image specific default CRT settings (brightness at 100%, curvature locked to 16px)
  private readonly fileImageDefaultSettings: CrtSettings = {
    ...CRT_PRESETS.full,
    brightness: 1.0,
    screenCurvature: 16,
    scanlineSize: 1.2,
    scanlineIntensity: 0.69,
  };

  // CRT state signals
  protected readonly isCrtEnabled = signal<boolean>(true);
  protected readonly crtSettings = signal<CrtSettings>(this.fileImageDefaultSettings);
  protected readonly showCrtControls = signal<boolean>(false);

  constructor() {
    // Load saved CRT settings when component initializes
    effect(() => {
      const deviceId = this.deviceId();
      if (deviceId) {
        const savedSettings = this.crtStorage.load(deviceId, 'file-image');
        if (savedSettings) {
          // Use saved settings (user's preference), force screenCurvature to 16px
          this.crtSettings.set({ ...savedSettings, screenCurvature: 16 });
        }
        // If no saved settings, fileImageDefaultSettings from signal initialization is used
      }
    }, { allowSignalWrites: true });
  }

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
   * Persists settings to localStorage per device
   */
  onCrtSettingsChange(settings: CrtSettings): void {
    // Force screenCurvature to 16px to match cycle-image border-radius
    this.crtSettings.set({ ...settings, screenCurvature: 16 });
    const deviceId = this.deviceId();
    if (deviceId) {
      this.crtStorage.save(deviceId, 'file-image', settings);
    }
  }

  /**
   * Reset CRT settings to default preset
   */
  onCrtReset(): void {
    // Reset to file-image default settings (brightness 1.0, curvature 16px)
    this.crtSettings.set(this.fileImageDefaultSettings);
  }

  /**
   * Apply a CRT preset
   */
  onCrtPresetSelected(presetName: keyof typeof CRT_PRESETS): void {
    // Force screenCurvature to 16px to match cycle-image border-radius
    this.crtSettings.set({ ...CRT_PRESETS[presetName], screenCurvature: 16 });
  }
}
