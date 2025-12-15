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
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
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
  CURVATURE_SLIDER,
  COLOR_FILTER_SLIDERS,
  PHOSPHOR_SLIDER,
  PHOSPHOR_PATTERN_OPTIONS,
  PhosphorPatternOption,
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
    MatIconModule,
    MatTooltipModule,
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
   * Emits when a preset is selected from the menu.
   * Emits the preset name so parent can apply CRT_PRESETS[name].
   */
  readonly presetSelected = output<CrtPresetName>();

  // ─────────────────────────────────────────────────────────────────────────
  // Slider Configurations (exposed for template)
  // ─────────────────────────────────────────────────────────────────────────

  protected readonly scanlineSliders = SCANLINE_SLIDERS;
  protected readonly vignetteSlider = VIGNETTE_SLIDER;
  protected readonly curvatureSlider = CURVATURE_SLIDER;
  protected readonly colorFilterSliders = COLOR_FILTER_SLIDERS;
  protected readonly phosphorSlider = PHOSPHOR_SLIDER;
  protected readonly phosphorPatternOptions = PHOSPHOR_PATTERN_OPTIONS;

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

  constructor() {
    // Load custom presets on component initialization
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
    
    // Add scrollable class when maxHeight is set
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
    
    // Check built-in presets
    const presetEntries = Object.entries(CRT_PRESETS) as Array<[CrtPresetName, CrtSettings]>;
    for (const [name, preset] of presetEntries) {
      if (JSON.stringify(current) === JSON.stringify(preset)) {
        return name;
      }
    }
    
    // Check custom presets
    for (const preset of this.customPresets()) {
      if (JSON.stringify(current) === JSON.stringify(preset.settings)) {
        return preset.name;
      }
    }
    
    return null;
  });

  /**
   * Whether phosphor controls should be visible.
   * Phosphor patterns are WebGL-only (now the only mode).
   */
  protected readonly shouldShowPhosphor = computed(() => {
    return this.config().showPhosphor;
  });

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
   * Formats slider display value based on configuration.
   */
  protected formatValue(value: number, slider: SliderConfig): string {
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
    // Check if it's a custom preset
    if (typeof presetName === 'string' && presetName.startsWith('custom-')) {
      return this.stripCustomPrefix(presetName as CustomPresetName);
    }
    
    // For built-in presets: use component-provided label if available
    const providedLabel = this.currentPresetLabel();
    if (providedLabel) {
      return providedLabel;
    }
    
    // Fallback to global preset labels
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
    console.log('[CrtSettingsPanel] onSaveAsPreset called');
    console.log('[CrtSettingsPanel] Current state:', {
      showNameDialog: this.showNameDialog(),
      isRenaming: this.isRenaming(),
      dialogPresetName: this.dialogPresetName(),
      customPresetsCount: this.customPresets().length
    });
    
    this.isRenaming.set(false);
    this.dialogPresetName.set('');
    this.showNameDialog.set(true);
    
    // Ensure dropdown is open to show the dialog
    if (!this.presetDropdown()?.isOpen()) {
      this.presetDropdown()?.open();
    }
    
    console.log('[CrtSettingsPanel] After updates:', {
      showNameDialog: this.showNameDialog(),
      isRenaming: this.isRenaming(),
      dialogPresetName: this.dialogPresetName()
    });
  }

  /**
   * Handles updating an existing custom preset with current settings.
   * Overwrites the preset's settings without changing its name.
   */
  protected onUpdatePreset(presetName: CustomPresetName): void {
    console.log('[CrtSettingsPanel] onUpdatePreset called:', presetName);
    
    const currentSettings = this.settings();
    this.crtStorage.updateCustomPreset(presetName, currentSettings);
    this.refreshCustomPresets();
    
    console.log('[CrtSettingsPanel] Preset updated:', presetName);
  }

  /**
   * Handles rename custom preset request.
   * Opens name dialog with current preset name pre-filled.
   */
  protected onRenamePreset(presetName: CustomPresetName): void {
    this.isRenaming.set(true);
    this.dialogPresetName.set(presetName);
    this.showNameDialog.set(true);
    
    // Ensure dropdown is open to show the dialog
    if (!this.presetDropdown()?.isOpen()) {
      this.presetDropdown()?.open();
    }
  }

  /**
   * Handles delete custom preset request.
   * Opens confirmation dialog before deletion.
   */
  protected onDeletePreset(presetName: CustomPresetName): void {
    this.dialogPresetName.set(presetName);
    this.showConfirmDialog.set(true);
    
    // Ensure dropdown is open to show the dialog
    if (!this.presetDropdown()?.isOpen()) {
      this.presetDropdown()?.open();
    }
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
    // Get built-in names without 'default-' prefix
    const builtInNames = this.presetNames().map(k => k.replace(/^default-/, ''));
    // Get custom names without 'custom-' prefix
    let customNames = this.customPresets().map(p => this.stripCustomPrefix(p.name));
    
    // When renaming, exclude current preset name (allow keeping same name)
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
  }

  /**
   * Handles delete confirmation.
   * Removes preset from storage and refreshes list.
   * If deleted preset was active, emits presetSelected with default preset.
   */
  protected onDeleteConfirmed(): void {
    try {
      const presetName = this.dialogPresetName() as CustomPresetName;
      this.crtStorage.deleteCustomPreset(presetName);
      console.log(`[CrtSettingsPanel] Deleted custom preset: ${presetName}`);
      
      
      // Refresh preset list and close dialog
      this.refreshCustomPresets();
      this.showConfirmDialog.set(false);
      this.dialogPresetName.set('');
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to delete preset:', error);
      // Future: show error toast
      // Close dialog even on error to reset state
      this.showConfirmDialog.set(false);
      this.dialogPresetName.set('');
    }
  }

  /**
   * Handles delete cancellation.
   * Closes confirmation dialog.
   */
  protected onDeleteCancelled(): void {
    this.showConfirmDialog.set(false);
    this.dialogPresetName.set('');
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
      // Check maximum preset limit
      if (this.customPresets().length >= 50) {
        console.warn('[CrtSettingsPanel] Maximum preset limit reached (50)');
        // Future: show error toast to user
        this.showNameDialog.set(false);
        return;
      }
      
      // Save preset with current settings
      this.crtStorage.saveCustomPreset(name, this.settings());
      console.log(`[CrtSettingsPanel] Saved custom preset: custom-${name}`);
      
      // Refresh preset list and close dialog
      this.refreshCustomPresets();
      this.showNameDialog.set(false);
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to save preset:', error);
      // Future: show error toast
      // Close dialog even on error to reset state
      this.showNameDialog.set(false);
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
      
      // Refresh preset list and close dialog
      this.refreshCustomPresets();
      this.showNameDialog.set(false);
      this.dialogPresetName.set('');
      this.isRenaming.set(false);
    } catch (error) {
      console.error('[CrtSettingsPanel] Failed to rename preset:', error);
      // Future: show error toast
      // Close dialog even on error to reset state
      this.showNameDialog.set(false);
      this.dialogPresetName.set('');
      this.isRenaming.set(false);
    }
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
      // Keep existing list on error
    }
  }
}
