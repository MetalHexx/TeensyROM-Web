import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
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
import { CrtSettings, CrtSettingsConfig, PhosphorPatternType } from '../crt-effect-wrapper/crt-settings.interface';
import {
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
  CRT_PRESET_LABELS,
  CRT_PRESETS,
  CrtPresetName,
} from '../crt-effect-wrapper/crt-settings.defaults';
import { CrtRenderer } from '../crt-effect-wrapper/webgl/crt-renderer';
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
  RENDER_MODE_OPTIONS,
  RenderModeOption,
} from './crt-slider-configs';

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
 *   (settingsChange)="onSettingsChange($event)"
 *   (resetRequested)="onReset()">
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
  ],
  templateUrl: './crt-settings-panel.component.html',
  styleUrl: './crt-settings-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrtSettingsPanelComponent {
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
   * Controls panel visibility when used in overlay contexts.
   * When false, panel can be hidden/animated out by parent.
   */
  readonly visible = input<boolean>(true);

  /**
   * Additional CSS class(es) to forward to the inner compact card layout.
   * Use this to apply context-specific styling like height constraints.
   */
  readonly cardClass = input<string>('');

  // ─────────────────────────────────────────────────────────────────────────
  // Outputs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emits when any slider value changes.
   * Emits complete CrtSettings object with updated value.
   */
  readonly settingsChange = output<CrtSettings>();

  /**
   * Emits when reset button is clicked.
   * Parent should handle reset by providing DEFAULT_CRT_SETTINGS.
   */
  readonly resetRequested = output<void>();

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
  protected readonly renderModeOptions = RENDER_MODE_OPTIONS;

  /** Available preset names for the preset menu */
  protected readonly presetNames: CrtPresetName[] = [
    'fullscreen-css',
    'fullscreen-webgl',
    'dialog-css',
    'dialog-webgl',
    'image-css',
    'image-webgl',
  ];

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
    const baseClasses = 'glassy-card crt-controls-card';
    const additionalClass = this.cardClass();
    return additionalClass ? `${baseClasses} ${additionalClass}` : baseClasses;
  });

  /**
   * Computed - which preset name matches current settings (if any).
   * Returns null if settings don't exactly match any preset.
   */
  protected readonly currentPresetName = computed<CrtPresetName | null>(() => {
    const current = this.settings();
    const presetEntries = Object.entries(CRT_PRESETS) as Array<[CrtPresetName, CrtSettings]>;
    
    for (const [name, preset] of presetEntries) {
      if (JSON.stringify(current) === JSON.stringify(preset)) {
        return name;
      }
    }
    return null;
  });

  /**
   * Whether phosphor controls should be visible based on render mode.
   * Phosphor patterns are WebGL-only, so hide when CSS mode is selected.
   */
  protected readonly shouldShowPhosphor = computed(() => {
    const mode = this.settings().renderMode;
    return this.config().showPhosphor && mode !== 'css';
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
   * Handles reset button click.
   */
  protected onReset(): void {
    this.resetRequested.emit();
  }

  /**
   * Handles preset selection from menu.
   */
  protected onPresetSelect(presetName: CrtPresetName): void {
    this.presetSelected.emit(presetName);
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
   * Handles render mode toggle (CSS <-> WebGL).
   */
  protected onRenderModeToggle(): void {
    const currentMode = this.settings().renderMode;
    const newMode = currentMode === 'css' ? 'webgl' : 'css';
    const updatedSettings: CrtSettings = {
      ...this.settings(),
      renderMode: newMode,
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
   * Gets the label for the current render mode.
   */
  protected getRenderModeLabel(): string {
    const mode = this.settings().renderMode;
    const option = RENDER_MODE_OPTIONS.find(o => o.value === mode);
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
   */
  protected getPresetLabel(presetName: CrtPresetName): string {
    return CRT_PRESET_LABELS[presetName];
  }
}
