import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CrtSettings, CrtSettingsConfig } from './crt-settings.interface';
import { DEFAULT_CRT_SETTINGS, DEFAULT_CRT_CONFIG } from './crt-settings.defaults';

/**
 * A pure presentation wrapper component that applies CRT (cathode ray tube) visual effects
 * to any projected content via CSS custom properties.
 *
 * This component encapsulates CRT effects (scanlines, vignette, screen curvature, color filters)
 * and provides a clean interface for applying retro aesthetics without any store dependencies.
 *
 * Use the `config` input to control which effect groups are applied. This allows you to
 * use a subset of effects (e.g., scanlines only, color filters only) while the settings
 * panel shows only the relevant controls.
 *
 * @example
 * ```html
 * <!-- Full CRT effects on video -->
 * <lib-crt-effect-wrapper [settings]="CRT_PRESETS.full" [enabled]="showCrt">
 *   <lib-video-stream [stream]="mediaStream"></lib-video-stream>
 * </lib-crt-effect-wrapper>
 *
 * <!-- Color enhancement only on images -->
 * <lib-crt-effect-wrapper
 *   [settings]="CRT_PRESETS.filtersOnly"
 *   [config]="CRT_CONFIGS.filtersOnly">
 *   <img [src]="screenshot" alt="Screenshot" />
 * </lib-crt-effect-wrapper>
 *
 * <!-- Scanlines + color filters (no vignette/curvature) -->
 * <lib-crt-effect-wrapper
 *   [settings]="settings()"
 *   [config]="CRT_CONFIGS.scanlines">
 *   <div class="terminal-output">...</div>
 * </lib-crt-effect-wrapper>
 * ```
 */
@Component({
  selector: 'lib-crt-effect-wrapper',
  standalone: true,
  imports: [],
  templateUrl: './crt-effect-wrapper.component.html',
  styleUrl: './crt-effect-wrapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrtEffectWrapperComponent {
  /**
   * CRT effect configuration values.
   * Use CRT_PRESETS for common configurations or provide custom values.
   */
  readonly settings = input<CrtSettings>(DEFAULT_CRT_SETTINGS);

  /**
   * Controls which effect groups are enabled.
   * Use CRT_CONFIGS for common configurations matching CRT_PRESETS.
   * When a group is disabled, its CSS effects are not applied regardless of settings values.
   */
  readonly config = input<CrtSettingsConfig>(DEFAULT_CRT_CONFIG);

  /**
   * Whether CRT effects are applied.
   * When false, content renders without any effects (smooth transition).
   */
  readonly enabled = input<boolean>(true);

  /**
   * Computed CSS variable values that respect both settings and config.
   * Returns neutral values for disabled effect groups.
   */
  protected readonly effectiveSettings = computed(() => {
    const s = this.settings();
    const c = this.config();

    return {
      // Scanlines: 0 intensity disables the effect
      scanlineIntensity: c.showScanlines ? s.scanlineIntensity : 0,
      scanlineThickness: c.showScanlines ? s.scanlineThickness : 0,
      scanlineSpacing: c.showScanlines ? s.scanlineSpacing : 0,

      // Vignette: 0 strength disables the effect
      vignetteStrength: c.showVignette ? s.vignetteStrength : 0,

      // Curvature: 0 disables the effect
      screenCurvature: c.showCurvature ? s.screenCurvature : 0,

      // Color filters: 1 is neutral (no change)
      contrast: c.showColorFilters ? s.contrast : 1,
      brightness: c.showColorFilters ? s.brightness : 1,
      saturation: c.showColorFilters ? s.saturation : 1,
    };
  });
}
