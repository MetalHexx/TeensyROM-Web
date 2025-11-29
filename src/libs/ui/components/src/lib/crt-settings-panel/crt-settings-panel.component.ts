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
import { CrtSettings, CrtSettingsConfig } from '../crt-effect-wrapper/crt-settings.interface';
import {
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
  CRT_PRESETS,
} from '../crt-effect-wrapper/crt-settings.defaults';

/** Preset names that can be selected */
export type CrtPresetName = keyof typeof CRT_PRESETS;

/**
 * Slider configuration metadata for each CRT setting.
 * Matches the exact ranges from the original video-dialog implementation.
 */
interface SliderConfig {
  key: keyof CrtSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: 'decimal' | 'px';
  decimalPlaces?: number;
}

/** Scanline slider configurations */
const SCANLINE_SLIDERS: SliderConfig[] = [
  {
    key: 'scanlineIntensity',
    label: 'Scanline Intensity',
    min: 0,
    max: 0.5,
    step: 0.01,
    format: 'decimal',
    decimalPlaces: 2,
  },
  {
    key: 'scanlineThickness',
    label: 'Scanline Thickness',
    min: 1,
    max: 4,
    step: 1,
    format: 'px',
  },
  {
    key: 'scanlineSpacing',
    label: 'Scanline Gap',
    min: 1,
    max: 8,
    step: 1,
    format: 'px',
  },
];

/** Vignette slider configuration */
const VIGNETTE_SLIDER: SliderConfig = {
  key: 'vignetteStrength',
  label: 'Vignette',
  min: 0,
  max: 2,
  step: 0.05,
  format: 'decimal',
  decimalPlaces: 2,
};

/** Curvature slider configuration */
const CURVATURE_SLIDER: SliderConfig = {
  key: 'screenCurvature',
  label: 'Screen Curvature',
  min: 0,
  max: 115,
  step: 5,
  format: 'px',
};

/** Color filter slider configurations */
const COLOR_FILTER_SLIDERS: SliderConfig[] = [
  {
    key: 'contrast',
    label: 'Contrast',
    min: 0.8,
    max: 1.5,
    step: 0.05,
    format: 'decimal',
    decimalPlaces: 2,
  },
  {
    key: 'brightness',
    label: 'Brightness',
    min: 0.8,
    max: 1.5,
    step: 0.05,
    format: 'decimal',
    decimalPlaces: 2,
  },
  {
    key: 'saturation',
    label: 'Saturation',
    min: 0.8,
    max: 1.5,
    step: 0.05,
    format: 'decimal',
    decimalPlaces: 2,
  },
];

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

  /** Available preset names for the preset menu */
  protected readonly presetNames: CrtPresetName[] = ['full', 'standard', 'small', 'none'];

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Whether any effect group is enabled (panel has content to show).
   */
  protected readonly hasAnySliders = computed(() => {
    const c = this.config();
    return c.showScanlines || c.showVignette || c.showCurvature || c.showColorFilters;
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

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handles slider value changes.
   * Emits updated settings with the changed value.
   */
  protected onSliderChange(key: keyof CrtSettings, value: number): void {
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
   * Formats slider display value based on configuration.
   */
  protected formatValue(value: number, slider: SliderConfig): string {
    if (slider.format === 'px') {
      return `${value}px`;
    }
    return value.toFixed(slider.decimalPlaces ?? 2);
  }

  /**
   * Gets human-readable preset label for menu display.
   */
  protected getPresetLabel(presetName: CrtPresetName): string {
    const labels: Record<CrtPresetName, string> = {
      full: 'Full CRT',
      standard: 'Standard CRT',
      small: 'Small CRT',
      none: 'No Effects',
    };
    return labels[presetName];
  }
}
