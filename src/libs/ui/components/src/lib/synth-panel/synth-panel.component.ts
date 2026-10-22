import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The SID panel's faceplate: a dark, lightly lit board with a hairline border and a screw in each
 * corner. It only frames what is projected into it; the consumer owns the inner layout.
 *
 * @example
 * ```html
 * <lib-synth-panel>
 *   <div class="panel-grid">...</div>
 * </lib-synth-panel>
 * ```
 */
@Component({
  selector: 'lib-synth-panel',
  templateUrl: './synth-panel.component.html',
  styleUrl: './synth-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SynthPanelComponent {}
