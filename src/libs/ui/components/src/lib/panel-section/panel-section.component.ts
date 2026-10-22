import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A titled group on the SID panel: a hairline frame with the title centred in its top edge. It is
 * a native fieldset, so assistive technology announces the title as the group's name. It does not
 * lay out its content; the consumer arranges whatever is projected into it.
 *
 * @example
 * ```html
 * <lib-panel-section title="Filter">
 *   <lib-rotary-knob label="Cutoff" accessibleName="Cutoff deck A" [value]="0" />
 * </lib-panel-section>
 * ```
 */
@Component({
  selector: 'lib-panel-section',
  templateUrl: './panel-section.component.html',
  styleUrl: './panel-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelSectionComponent {
  /** The group's title, drawn in uppercase in the frame's top edge. */
  readonly title = input.required<string>();
}
