import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CrtSettings } from './crt-settings.interface';
import { DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';

/**
 * A pure presentation wrapper component that applies CRT (cathode ray tube) visual effects
 * to any projected content via CSS custom properties.
 *
 * This component encapsulates CRT effects (scanlines, vignette, screen curvature, color filters)
 * and provides a clean interface for applying retro aesthetics without any store dependencies.
 *
 * @example
 * ```html
 * <!-- Full CRT effects on video -->
 * <lib-crt-effect-wrapper [settings]="CRT_PRESETS.full" [enabled]="showCrt">
 *   <lib-video-stream [stream]="mediaStream"></lib-video-stream>
 * </lib-crt-effect-wrapper>
 *
 * <!-- Color enhancement only on images -->
 * <lib-crt-effect-wrapper [settings]="CRT_PRESETS.filtersOnly">
 *   <img [src]="screenshot" alt="Screenshot" />
 * </lib-crt-effect-wrapper>
 *
 * <!-- Custom settings -->
 * <lib-crt-effect-wrapper [settings]="{ ...CRT_PRESETS.scanlines, brightness: 1.2 }">
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
   * CRT effect configuration.
   * Use CRT_PRESETS for common configurations or provide custom values.
   */
  readonly settings = input<CrtSettings>(DEFAULT_CRT_SETTINGS);

  /**
   * Whether CRT effects are applied.
   * When false, content renders without any effects (smooth transition).
   */
  readonly enabled = input<boolean>(true);
}
