import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';

import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';
import { DropdownMenuComponent } from '../dropdown-menu/dropdown-menu.component';
import { DropdownMenuItemComponent } from '../dropdown-menu/dropdown-menu-item.component';
import { PresetNameDialogComponent, PresetNameValidationFn } from '../preset-name-dialog/preset-name-dialog.component';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { CrtSettings, CrtSettingsConfig, PhosphorPatternType } from '../crt-effect-wrapper/crt-settings.interface';
import {
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
  CRT_PRESET_LABELS,
  CRT_PRESETS,
  CrtPresetName,
  CRT_PRESET_KEYS,
} from '../crt-effect-wrapper/crt-settings.defaults';
import {
  NumericCrtSettingsKey,
  SliderConfig,
  SCANLINE_SLIDERS,
  VIGNETTE_SLIDER,
  DISTORTION_SLIDER,
  BLOOM_SLIDER,
  CHROMATIC_ABERRATION_SLIDER,
  CURVATURE_SLIDER,
  COLOR_FILTER_SLIDERS,
  PHOSPHOR_SLIDER,
  PHOSPHOR_PATTERN_OPTIONS,
  PhosphorPatternOption,
  MONOCHROME_PHOSPHOR_OPTIONS,
  MonochromePhosphorOption,
  VIDEO_MODE_OPTIONS,
  VIDEO_STANDARD_OPTIONS,
  type VideoModeOption,
  type VideoStandardOption,
} from './crt-slider-configs';
import { CRT_STORAGE, CustomCrtPreset, CustomPresetName } from '@teensyrom-nx/domain';
import { IconLabelComponent } from "../icon-label/icon-label.component";

// Re-export CrtPresetName and CRT_PRESETS for consumers
export { CrtPresetName, CRT_PRESETS };

/**
 * CRT Settings Panel Component
 *
 * A configurable settings panel for CRT visual effects. Works cohesively with
 * `lib-crt-effect-wrapper` using the same `CrtSettings` and `CrtSettingsConfig` interfaces.
 *
 * The panel displays sliders only for effect groups enabled in the `config` input,
 * allowing flexible use cases (e.g., scanlines only, color filters only, full control).
 *
 * @example
 * ```html
 * <!-- Full settings panel -->
 * <lib-crt-settings-panel
 *   [settings]="crtSettings()"
 *   (settingsChange)="onSettingsChange($event)">
 * </lib-crt-settings-panel>
 *
 * <!-- Scanlines + color filters only -->
 * <lib-crt-settings-panel
 *   [settings]="crtSettings()"
 *   [config]="CRT_CONFIGS.scanlines"
 *   (settingsChange)="onSettingsChange($event)">
 * </lib-crt-settings-panel>
 *
 * <!-- In overlay container slot -->
 * <lib-content-overlay-container>
 *   <lib-crt-settings-panel leftControls
 *     [settings]="crtSettings()"
 *     [visible]="showPanel()"
 *     (settingsChange)="onSettingsChange($event)">
 *   </lib-crt-settings-panel>
 * </lib-content-overlay-container>
 * ```
 */
@Component({
  selector: 'lib-crt-settings-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatExpansionModule,
    CompactCardLayoutComponent,
    IconButtonComponent,
    DropdownMenuComponent,
    DropdownMenuItemComponent,
    PresetNameDialogComponent,
    ConfirmationDialogComponent,
    IconLabelComponent
],
  templateUrl: './crt-settings-panel.component.html',
  styleUrl: './crt-settings-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrtSettingsPanelComponent {
  // ─────────────────────────────────────────────────────────────────────────
  // Dependencies
  // ─────────────────────────────────────────────────────────────────────────

  private readonly crtStorage = inject(CRT_STORAGE);

  // ─────────────────────────────────────────────────────────────────────────
  // Inputs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Current CRT settings values.
   * These values populate the sliders and are used as base for change emissions.
   */
  readonly settings = input<CrtSettings>(DEFAULT_CRT_SETTINGS);

  /**
   * Controls which effect groups are shown in the panel.
   * Use CRT_CONFIGS for common configurations matching CRT_PRESETS.
   */
  readonly config = input<CrtSettingsConfig>(DEFAULT_CRT_CONFIG);

  /**
   * Additional CSS class(es) to forward to the inner compact card layout.
   * Use this to apply context-specific styling like height constraints.
   */
  readonly cardClass = input<string>('');

  /**
   * Maximum height for the panel in pixels.
   * When set, the panel becomes scrollable if content exceeds this height.
   * When not set (undefined), panel grows to fit content.
   */
  readonly maxHeight = input<number | undefined>(undefined);

  /**
   * Validation function for preset names.
   * Should return error object with 'error' property (string or null) for invalid names.
   * This is passed to the preset name dialog for client-side validation.
   */
  readonly validatePresetNameFn = input.required<(name: string, existingNames: string[]) => { error: string | null }>();

  /**
   * Optional label override for the current preset.
   * When provided, this label is displayed for built-in presets instead of the global CRT_PRESET_LABELS.
   * Custom presets always show their saved name regardless of this input.
   * Use this to provide context-appropriate labels (e.g., "Default" instead of "Small (WebGL)").
   */
  readonly currentPresetLabel = input<string>();

  /**
   * Built-in presets to exclude from the dropdown.
   * Use this to hide presets that aren't relevant to the component's context.
   * For example, a compact view might exclude the large preset.
   */
  readonly excludePresets = input<CrtPresetName[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Outputs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emitted when the user clicks the close button in the panel header.
   * Parent components should handle this to hide the panel and toggle button states.
   */
  readonly closed = output<void>();

  /**
   * Emits when any slider value changes.
   * Emits complete CrtSettings object with updated value.
   */
  readonly settingsChange = output<CrtSettings>();

  /**
   * Debug mode state from parent component.
   */
  readonly debugMode = input<boolean>(false);

  /**
   * Emits when debug mode toggle changes.
   */
  readonly debugModeChange = output<boolean>();

  /**
   * Emits when a preset is selected from the menu.
   * Emits the preset name so parent can apply CRT_PRESETS[name].
   */
  readonly presetSelected = output<CrtPresetName>();

  /**
   * Emitted when a dropdown opens or closes.
   * Parent components (like ContentOverlayContainerComponent) can use this to
   * prevent overlay hiding while dropdowns are open.
   * Use this to pause hover-based overlay visibility.
   */
  readonly openedChange = output<boolean>();

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip Configurations
  // ─────────────────────────────────────────────────────────────────────────

  readonly renamePresetTooltip: TooltipConfig = {
    body: 'Rename CRT preset',
    position: TooltipPosition.Top,
  };

  readonly deletePresetTooltip: TooltipConfig = {
    body: 'Delete CRT preset',
    position: TooltipPosition.Top,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Slider Configurations (exposed for template)
  // ─────────────────────────────────────────────────────────────────────────

  protected readonly scanlineSliders = SCANLINE_SLIDERS;
  protected readonly vignetteSlider = VIGNETTE_SLIDER;
  protected readonly distortionSlider = DISTORTION_SLIDER;
  protected readonly bloomSlider = BLOOM_SLIDER;
  protected readonly chromaticAberrationSlider = CHROMATIC_ABERRATION_SLIDER;
  protected readonly curvatureSlider = CURVATURE_SLIDER;
  protected readonly colorFilterSliders = COLOR_FILTER_SLIDERS;
  protected readonly phosphorSlider = PHOSPHOR_SLIDER;
  protected readonly phosphorPatternOptions = PHOSPHOR_PATTERN_OPTIONS;
  protected readonly monochromePhosphorOptions = MONOCHROME_PHOSPHOR_OPTIONS;
  protected readonly videoStandardOptions = VIDEO_STANDARD_OPTIONS;

  /** Video mode options filtered by current video standard */
  protected readonly videoModeOptions = computed(() => {
    const currentStandard = this.settings().videoStandard;

    return VIDEO_MODE_OPTIONS.filter(option =>
      option.region === 'all' || option.region === currentStandard
    );
  });

  /** Available preset names for the preset menu (computed to exclude specified presets) */
  protected readonly presetNames = computed(() => {
    const allPresets: CrtPresetName[] = [
      CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL,
      CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL,
      CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL,
    ];
    return allPresets.filter(preset => !this.excludePresets().includes(preset));
  });

  /** Validation function adapter for preset name dialog */
  protected readonly dialogValidationFn: PresetNameValidationFn = (name: string, existingNames: string[]) => {
    const result = this.validatePresetNameFn()(name, existingNames);
    return result.error ?? '';
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Preset State
  // ─────────────────────────────────────────────────────────────────────────

  /** Custom presets loaded from storage */
  protected readonly customPresets = signal<CustomCrtPreset[]>([]);

  /** Controls preset name dialog visibility */
  protected readonly showNameDialog = signal(false);

  /** Reference to preset dropdown menu */
  protected readonly presetDropdown = viewChild<DropdownMenuComponent>('presetDropdown');

  /** Controls confirmation dialog visibility */
  protected readonly showConfirmDialog = signal(false);

  /** Current preset name for dialog operations (rename/delete) */
  protected readonly dialogPresetName = signal<string>('');

  /** Distinguishes save vs rename workflow in name dialog */
  protected readonly isRenaming = signal(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Expansion Panel State
  // ─────────────────────────────────────────────────────────────────────────

  /** Currently expanded panel ID (null if all collapsed) */
  protected readonly expandedPanel = signal<string | null>(null);

  /** Determines which panel should be expanded by default based on config visibility */
  protected readonly defaultExpandedPanel = computed<string | null>(() => {
    if (this.hasScanlinesPanelContent()) return 'scanlines-screen';
    if (this.hasLightColorPanelContent()) return 'light-color';
    if (this.hasPhosphorPanelContent()) return 'phosphor';

    return null;
  });

  constructor() {
    try {
      const presets = this.crtStorage.loadCustomPresets();
      this.customPresets.set(presets);
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to load custom presets:', error);
      this.customPresets.set([]);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Whether any effect group is enabled (panel has content to show).
   */
  protected readonly hasAnySliders = computed(() => {
    const c = this.config();
    return c.showScanlines || c.showVignette || c.showCurvature || c.showColorFilters || c.showPhosphor;
  });

  /**
   * Combined CSS classes for the inner compact card layout.
   * Merges base classes with any additional cardClass input.
   */
  protected readonly computedCardClass = computed(() => {
    const classes: string[] = ['glassy-card', 'crt-controls-card'];

    if (this.maxHeight() !== undefined) {
      classes.push('scrollable-panel');
    }

    const additionalClass = this.cardClass();
    if (additionalClass) {
      classes.push(additionalClass);
    }

    return classes.join(' ');
  });

  /**
   * Computed styles for the panel container.
   * Applies max-height when specified via input.
   */
  protected readonly panelStyles = computed(() => {
    const maxHeight = this.maxHeight();
    return maxHeight !== undefined ? { 'max-height': `${maxHeight}px` } : {};
  });

  /**
   * All available presets (built-in + custom) organized by type.
   * Custom presets are sorted alphabetically for consistent display.
   */
  protected readonly allPresets = computed(() => ({
    builtIn: this.presetNames(),
    custom: this.customPresets().sort((a, b) => a.name.localeCompare(b.name)),
  }));

  /**
   * Computed - which preset name matches current settings (if any).
   * Checks both built-in and custom presets.
   * Returns null if settings don't exactly match any preset.
   */
  protected readonly currentPresetName = computed<CrtPresetName | CustomPresetName | null>(() => {
    const current = this.settings();

    const presetEntries = Object.entries(CRT_PRESETS) as Array<[CrtPresetName, CrtSettings]>;
    for (const [name, preset] of presetEntries) {
      if (JSON.stringify(current) === JSON.stringify(preset)) {
        return name;
      }
    }

    for (const preset of this.customPresets()) {
      if (JSON.stringify(current) === JSON.stringify(preset.settings)) {
        return preset.name;
      }
    }

    return null;
  });

  /** Whether phosphor controls should be visible */
  protected readonly shouldShowPhosphor = computed(() => {
    return this.config().showPhosphor;
  });

  /** Whether monochrome phosphor control should be visible */
  protected readonly shouldShowMonochromePhosphor = computed(() => {
    return this.config().showMonochromePhosphor;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Panel Visibility Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks if the Scanlines & Screen panel has any visible controls.
   * @returns true if at least one control in the panel is visible
   */
  protected hasScanlinesPanelContent(): boolean {
    const cfg = this.config();
    return cfg.showScanlines || cfg.showVignette || cfg.showCurvature || cfg.showDistortion;
  }

  /**
   * Checks if the Light & Color panel has any visible controls.
   * @returns true if at least one control in the panel is visible
   */
  protected hasLightColorPanelContent(): boolean {
    const cfg = this.config();
    return cfg.showBloom || cfg.showChromaticAberration || cfg.showColorFilters;
  }

  /**
   * Checks if the Phosphor Effects panel has any visible controls.
   * @returns true if at least one control in the panel is visible
   */
  protected hasPhosphorPanelContent(): boolean {
    const cfg = this.config();
    return cfg.showPhosphor || cfg.showMonochromePhosphor;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handles slider value changes.
   * Emits updated settings with the changed value.
   */
  protected onSliderChange(key: NumericCrtSettingsKey, value: number): void {
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      [key]: value,
    };
    this.settingsChange.emit(updatedSettings);
  }

  /**
   * Handles boolean toggle changes (e.g., autoCropBlackBars).
   * Emits updated settings with the changed value.
   */
  protected onToggleChange(key: keyof CrtSettings, value: boolean): void {
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      [key]: value,
    };
    this.settingsChange.emit(updatedSettings);
  }

  /**
   * Handles debug mode toggle changes.
   * Emits the new debug mode state to parent component.
   */
  protected onDebugModeChange(value: boolean): void {
    this.debugModeChange.emit(value);
  }

  /**
   * Handle dropdown open/close state change.
   * Emits to parent so overlay containers can keep overlays visible while dropdown is open.
   */
  protected onDropdownOpenedChange(isOpen: boolean): void {
    this.openedChange.emit(isOpen);
  }

  /**
   * Handles preset selection from menu.
   * Accepts both built-in and custom preset names.
   */
  protected onPresetSelect(presetName: CrtPresetName | CustomPresetName): void {
    // For now, just emit as CrtPresetName (will be enhanced in next task)
    // Custom preset loading will be implemented in Task 03-002
    this.presetSelected.emit(presetName as CrtPresetName);
  }

  /**
   * Handles phosphor pattern selection.
   */
  protected onPhosphorPatternChange(pattern: PhosphorPatternOption): void {
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      phosphorPattern: pattern as PhosphorPatternType,
    };
    this.settingsChange.emit(updatedSettings);
  }

  /**
   * Gets the label for the current phosphor pattern.
   */
  protected getPhosphorPatternLabel(): string {
    const pattern = this.settings().phosphorPattern;
    const option = PHOSPHOR_PATTERN_OPTIONS.find(o => o.value === pattern);
    return option?.label ?? 'Unknown';
  }

  /**
   * Handles monochrome phosphor selection.
   */
  protected onMonochromePhosphorChange(phosphor: MonochromePhosphorOption): void {
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      monochromePhosphor: phosphor as import('@teensyrom-nx/domain').MonochromePhosphorType,
    };
    this.settingsChange.emit(updatedSettings);
  }

  /**
   * Gets the label for the current monochrome phosphor.
   */
  protected getMonochromePhosphorLabel(): string {
    const phosphor = this.settings().monochromePhosphor;
    const option = MONOCHROME_PHOSPHOR_OPTIONS.find(o => o.value === phosphor);
    return option?.label ?? 'Unknown';
  }

  /**
   * Handles video mode selection.
   */
  protected onVideoModeChange(mode: VideoModeOption): void {
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      videoMode: mode,
    };
    this.settingsChange.emit(updatedSettings);
  }

  /**
   * Gets the label for the current video mode.
   */
  protected getVideoModeLabel(): string {
    const mode = this.settings().videoMode;
    const option = VIDEO_MODE_OPTIONS.find(o => o.value === mode);
    return option?.label ?? 'Unknown';
  }

  /**
   * Generates a test ID for video mode options (replaces spaces with hyphens).
   */
  protected getVideoModeTestId(mode: VideoModeOption): string {
    return 'video-mode-' + mode.replace(/\s+/g, '-');
  }

  /**
   * Handles video standard (PAL/NTSC) selection.
   * Resets video mode to 'auto' when standard changes to prevent invalid combinations.
   */
  protected onVideoStandardChange(standard: VideoStandardOption): void {
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      videoStandard: standard,
      // Reset video mode to auto when switching standards to prevent PAL mode on NTSC or vice versa
      videoMode: 'auto',
    };
    this.settingsChange.emit(updatedSettings);
  }

  /**
   * Gets the label for the current video standard.
   */
  protected getVideoStandardLabel(): string {
    const standard = this.settings().videoStandard;
    const option = VIDEO_STANDARD_OPTIONS.find(o => o.value === standard);
    return option?.label ?? 'Unknown';
  }

  /**
   * Formats slider display value based on configuration.
   */
  protected formatValue(value: number | string | boolean, slider: SliderConfig): string {
    if (typeof value === 'boolean') {
      return '';
    }

    if (typeof value !== 'number') {
      return String(value);
    }

    if (slider.format === 'px') {
      return `${value}px`;
    }
    if (slider.format === 'deg') {
      return `${value}°`;
    }
    if (slider.format === 'percentage') {
      const percentage = Math.round(value * 100);
      return `${percentage}%`;
    }
    return value.toFixed(slider.decimalPlaces ?? 2);
  }

  /**
   * Gets human-readable preset label for menu display.
   * For built-in presets: uses component-provided currentPresetLabel if available, otherwise falls back to CRT_PRESET_LABELS.
   * For custom presets: always returns the name without 'custom-' prefix.
   */
  protected getPresetLabel(presetName: CrtPresetName | CustomPresetName): string {
    if (typeof presetName === 'string' && presetName.startsWith('custom-')) {
      return this.stripCustomPrefix(presetName as CustomPresetName);
    }

    const providedLabel = this.currentPresetLabel();
    if (providedLabel) {
      return providedLabel;
    }

    return CRT_PRESET_LABELS[presetName as CrtPresetName];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Preset Operations (Stubs)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handles save current settings as new custom preset.
   * Opens name dialog for user to enter preset name.
   */
  protected onSaveAsPreset(): void {
    this.isRenaming.set(false);
    this.dialogPresetName.set('');
    this.showNameDialog.set(true);
  }

  /**
   * Handles updating an existing custom preset with current settings.
   * Overwrites the preset's settings without changing its name.
   */
  protected onUpdatePreset(presetName: CustomPresetName): void {
    const currentSettings = this.settings();
    this.crtStorage.updateCustomPreset(presetName, currentSettings);
    this.refreshCustomPresets();
  }

  /**
   * Handles rename custom preset request.
   * Opens name dialog with current preset name pre-filled.
   */
  protected onRenamePreset(presetName: CustomPresetName): void {
    this.isRenaming.set(true);
    this.dialogPresetName.set(presetName);
    this.showNameDialog.set(true);
  }

  /**
   * Handles delete custom preset request.
   * Opens confirmation dialog before deletion.
   */
  protected onDeletePreset(presetName: CustomPresetName): void {
    this.dialogPresetName.set(presetName);
    this.showConfirmDialog.set(true);
  }

  /**
   * Removes 'custom-' prefix from custom preset name for display.
   */
  protected stripCustomPrefix(name: CustomPresetName): string {
    return name.replace(/^custom-/, '');
  }

  /**
   * Gets list of reserved preset names (built-in + existing custom).
   * Used for validation in preset name dialog.
   * When renaming, excludes current preset name to allow keeping same name.
   */
  protected getReservedNames(): string[] {
    const builtInNames = this.presetNames().map(k => k.replace(/^default-/, ''));
    let customNames = this.customPresets().map(p => this.stripCustomPrefix(p.name));

    if (this.isRenaming() && this.dialogPresetName()) {
      const currentName = this.stripCustomPrefix(this.dialogPresetName() as CustomPresetName);
      customNames = customNames.filter(n => n !== currentName);
    }

    return [...builtInNames, ...customNames];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handles name dialog confirmation.
   * Branches to save or rename workflow based on isRenaming flag.
   */
  protected onNameDialogConfirmed(name: string): void {
    if (this.isRenaming()) {
      this.handleRenamePreset(name);
    } else {
      this.handleSavePreset(name);
    }
  }

  /**
   * Handles name dialog cancellation.
   * Closes dialog and resets state.
   */
  protected onNameDialogCancelled(): void {
    this.showNameDialog.set(false);
    this.dialogPresetName.set('');
    this.isRenaming.set(false);

    this.presetDropdown()?.open();
  }

  /**
   * Handles delete confirmation.
   * Removes preset from storage and refreshes list.
   * If deleted preset was active, emits presetSelected with default preset.
   */
  protected onDeleteConfirmed(): void {
    try {
      const presetName = this.dialogPresetName() as CustomPresetName;
      const wasActive = this.currentPresetName() === presetName;

      this.crtStorage.deleteCustomPreset(presetName);
      console.log(`[CrtSettingsPanel] Deleted custom preset: ${presetName}`);

      if (wasActive) {
        this.presetSelected.emit(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL);
      }

      this.refreshCustomPresets();
      this.showConfirmDialog.set(false);
      this.dialogPresetName.set('');

      this.presetDropdown()?.open();
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to delete preset:', error);
      this.showConfirmDialog.set(false);
      this.dialogPresetName.set('');
      this.presetDropdown()?.open();
    }
  }

  /**
   * Handles delete cancellation.
   * Closes confirmation dialog.
   */
  protected onDeleteCancelled(): void {
    this.showConfirmDialog.set(false);
    this.dialogPresetName.set('');

    this.presetDropdown()?.open();
  }

  /**
   * Gets confirmation message for delete dialog.
   * Formats message with preset display name.
   */
  protected getConfirmationMessage(): string {
    const displayName = this.stripCustomPrefix(this.dialogPresetName() as CustomPresetName);
    return `Delete preset '${displayName}'? This action cannot be undone.`;
  }

  /**
   * Gets initial value for name dialog.
   * Returns preset name without prefix when renaming, empty string when saving.
   */
  protected getDialogInitialValue(): string {
    if (!this.isRenaming()) {
      return '';
    }
    const presetName = this.dialogPresetName();
    if (!presetName) {
      return '';
    }
    return this.stripCustomPrefix(presetName as CustomPresetName);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Saves current settings as a new custom preset.
   * Checks maximum limit before saving.
   */
  private handleSavePreset(name: string): void {
    try {
      if (this.customPresets().length >= 50) {
        console.warn('[CrtSettingsPanel] Maximum preset limit reached (50)');
        this.showNameDialog.set(false);
        this.presetDropdown()?.open();
        return;
      }

      this.crtStorage.saveCustomPreset(name, this.settings());
      console.log(`[CrtSettingsPanel] Saved custom preset: custom-${name}`);

      this.refreshCustomPresets();
      this.showNameDialog.set(false);

      this.presetDropdown()?.open();
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to save preset:', error);
      this.showNameDialog.set(false);
      this.presetDropdown()?.open();
    }
  }

  /**
   * Renames an existing custom preset.
   * Calls storage service with old and new names.
   */
  private handleRenamePreset(newName: string): void {
    try {
      const oldName = this.dialogPresetName() as CustomPresetName;
      this.crtStorage.renameCustomPreset(oldName, newName);
      console.log(`[CrtSettingsPanel] Renamed preset: ${oldName} -> custom-${newName}`);

      this.refreshCustomPresets();
      this.showNameDialog.set(false);
      this.dialogPresetName.set('');
      this.isRenaming.set(false);

      this.presetDropdown()?.open();
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to rename preset:', error);
      this.showNameDialog.set(false);
      this.dialogPresetName.set('');
      this.isRenaming.set(false);
      this.presetDropdown()?.open();
    }
  }

  /**
   * Handles preset dropdown close event.
   * Resets dialog states to show preset list when dropdown reopens.
   */
  protected onPresetDropdownClosed(): void {
    this.showNameDialog.set(false);
    this.showConfirmDialog.set(false);
  }

  /**
   * Refreshes custom presets list from storage.
   * Called after save/rename/delete operations.
   */
  private refreshCustomPresets(): void {
    try {
      const presets = this.crtStorage.loadCustomPresets();
      this.customPresets.set(presets);
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to refresh presets:', error);
    }
  }
}
