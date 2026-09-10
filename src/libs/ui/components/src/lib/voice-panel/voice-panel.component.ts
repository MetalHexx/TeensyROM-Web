import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { VoiceRowComponent } from '../voice-row/voice-row.component';
import type { VoiceRowModel } from '../voice-row/voice-row.component';

/** One deck's whole voice panel: its own accessible name, every row in render order, and the Clear
 *  button's own accessible name. */
export interface VoicePanelModel {
  /** e.g. 'Voice deck A' — the panel section's own aria-label. */
  readonly accessibleName: string;
  /** Rendered in this array's order, one row each. */
  readonly rows: readonly VoiceRowModel[];
  /** e.g. 'Clear all voice mutes deck A' — the Clear button's own accessible name. */
  readonly clearAccessibleName: string;
}

/**
 * One deck's per-voice mute/kill list: a heading, one `VoiceRowComponent` per `model().rows` entry,
 * and a Clear button that resets every latched mute at once. Purely presentational — it composes
 * `VoiceRowComponent` and holds no state of its own; the caller owns every row's mute/held state
 * and every write.
 *
 * @example
 * ```html
 * <lib-voice-panel
 *   [model]="voicePanelModel()"
 *   (mutedChange)="onVoiceMutedChange($event)"
 *   (heldChange)="onVoiceHeldChange($event)"
 *   (clearMutes)="onClearVoiceMutes()"
 * />
 * ```
 */
@Component({
  selector: 'lib-voice-panel',
  templateUrl: './voice-panel.component.html',
  styleUrl: './voice-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VoiceRowComponent],
})
export class VoicePanelComponent {
  /** The voice panel's display model and state. */
  readonly model = input.required<VoicePanelModel>();
  /** Emits when a voice row's mute checkbox is toggled. `index` is the row's position in `model().rows`. */
  readonly mutedChange = output<{ index: number; muted: boolean }>();
  /** Emits on a voice row's hold button press or release. `index` is the row's position in `model().rows`, `held` is `true` on press, `false` on release/cancel. */
  readonly heldChange = output<{ index: number; held: boolean }>();
  /** Emits when the Clear button is pressed. */
  readonly clearMutes = output<void>();

  /** Re-packages one row's `mutedChange` with its own index for the panel-level `mutedChange`. */
  protected onMutedChange(index: number, muted: boolean): void {
    this.mutedChange.emit({ index, muted });
  }

  /** Re-packages one row's `heldChange` with its own index for the panel-level `heldChange`. */
  protected onHeldChange(index: number, held: boolean): void {
    this.heldChange.emit({ index, held });
  }
}
