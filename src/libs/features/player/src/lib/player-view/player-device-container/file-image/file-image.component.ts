import { Component, computed, input, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CycleImageComponent,
  ScalingCardComponent,
  ContentOverlayContainerComponent,
  CrtEffectWrapperComponent,
  CrtSettingsPanelOverlayComponent,
  VideoControlsToolbarComponent,
  CRT_CONFIGS,
  CRT_PRESETS,
  CRT_PRESET_KEYS,
  AnyPresetName,
  isBuiltInPreset,
} from '@teensyrom-nx/ui/components';
import { CrtSettings, CRT_STORAGE, validatePresetName } from '@teensyrom-nx/domain';
import type { LaunchedFile } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-file-image',
  imports: [
    CommonModule,
    ScalingCardComponent,
    CycleImageComponent,
    ContentOverlayContainerComponent,
    CrtEffectWrapperComponent,
    CrtSettingsPanelOverlayComponent,
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

  // CRT configuration - small config for file viewing
  readonly crtConfig = CRT_CONFIGS.small;

  /**
   * Context-appropriate label for the current preset.
   * Shows "Default" to users instead of size-based labels like "Small (WebGL)".
   */
  protected readonly currentPresetLabel = computed(() => 'Default');
  protected readonly excludePresets = computed(() => [CRT_PRESET_KEYS.LARGE_WEBGL]);

  /**
   * Validation function for custom preset names.
   * Passed to CrtSettingsPanelComponent for preset name validation.
   */
  readonly validatePresetNameFn = (name: string, existingNames: string[]) => {
    const result = validatePresetName(name, existingNames);
    return { error: result.error ?? null };
  };

  // CRT state signals (initialized in constructor based on WebGL detection)
  protected readonly isCrtEnabled = signal<boolean>(true);
  protected readonly crtSettings = signal<CrtSettings>(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]);
  protected readonly showCrtControls = signal<boolean>(false);

  constructor() {
    // Load saved CRT settings when component initializes
    effect(() => {
      const deviceId = this.deviceId();
      if (deviceId) {
        const savedSettings = this.crtStorage.load(deviceId, 'file-image');
        if (savedSettings) {
          this.crtSettings.set(savedSettings);
        } else {
          // Default to SMALL_WEBGL preset for new users
          this.crtSettings.set(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]);
        }
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
    // Apply settings without modification
    this.crtSettings.set(settings);
    const deviceId = this.deviceId();
    if (deviceId) {
      this.crtStorage.save(deviceId, 'file-image', settings);
    }
  }

  /**
   * Apply a CRT preset (built-in or custom)
   */
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
        console.warn(`[FileImageComponent] Custom preset not found: ${presetName}`);
        return; // Early return, don't change settings
      }

      settings = preset.settings;
    }

    // Apply preset settings without modification
    this.crtSettings.set(settings);
    const deviceId = this.deviceId();
    if (deviceId) {
      this.crtStorage.save(deviceId, 'file-image', settings);
    }
  }
}
