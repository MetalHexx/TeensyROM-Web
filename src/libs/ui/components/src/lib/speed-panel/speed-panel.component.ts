import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChannelFaderComponent } from '../channel-fader/channel-fader.component';
import { JumpButtonGroupComponent } from '../jump-button-group/jump-button-group.component';
import type { JumpButtonModel } from '../jump-button-group/jump-button-group.component';

/** One deck's whole speed panel: the readout, the fader's own bounds and value, and the jump
 *  buttons' own models. */
export interface SpeedPanelModel {
  /** e.g. 'Speed deck A' — the panel section's own aria-label. */
  readonly accessibleName: string;
  /** e.g. '1.000x' — the caller formats it. */
  readonly valueText: string;
  /** Already pinned to `[min, max]` by the caller. */
  readonly faderValue: number;
  /** e.g. 'Speed multiplier deck A' — the fader's own accessible name. */
  readonly faderAccessibleName: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Rendered in this array's order, one button each. */
  readonly jumpButtons: readonly JumpButtonModel[];
}

/**
 * One deck's speed control: a readout, a vertical fader (`ChannelFaderComponent`) and a
 * `JumpButtonGroupComponent`. Purely presentational — it holds no state of its own and never
 * clamps or rounds anything itself; the caller has already pinned `faderValue` into `[min, max]`
 * and formatted `valueText`.
 *
 * @example
 * ```html
 * <lib-speed-panel
 *   [model]="speedPanelModel()"
 *   (faderChange)="onSpeedFaderChange($event)"
 *   (jump)="onSpeedJump($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-speed-panel',
  templateUrl: './speed-panel.component.html',
  styleUrl: './speed-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChannelFaderComponent, JumpButtonGroupComponent],
})
export class SpeedPanelComponent {
  /** The speed panel's display model and state. */
  readonly model = input.required<SpeedPanelModel>();
  /** Emits the fader's raw numeric emission, unrounded and unclamped. */
  readonly faderChange = output<number>();
  /** Emits the pressed jump button's own `id`. */
  readonly jump = output<string>();
}
