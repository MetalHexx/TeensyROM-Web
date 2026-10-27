import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** The deck transport's set row, caller-composed. */
export interface DeckSetRowModel {
  /** The deck's place in the set, e.g. '02/08', or '— / —' with no set. */
  readonly positionText: string;
  /** The set's name, e.g. 'Friday warm-up'; empty with no set. */
  readonly setName: string;
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
  /** e.g. 'Previous in the set deck A'. */
  readonly previousAccessibleName: string;
  readonly nextAccessibleName: string;
}

/**
 * The row under a deck's transport keys that walks the deck through the set: a previous key, a
 * `SET` readout of the deck's position and the set's name (ellipsised), and a next key. The keys'
 * labels can be hidden by setting `--synth-key-label-display: none` on this component's host,
 * which the transport does as its container narrows. Purely presentational.
 *
 * @example
 * ```html
 * <lib-deck-set-row [model]="set()" (previous)="onPrevious()" (next)="onNext()" />
 * ```
 */
@Component({
  selector: 'lib-deck-set-row',
  imports: [SynthKeyComponent],
  templateUrl: './deck-set-row.component.html',
  styleUrl: './deck-set-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckSetRowComponent {
  /** The row's state. */
  readonly model = input.required<DeckSetRowModel>();
  /** Emits when the previous key is pressed. */
  readonly previous = output<void>();
  /** Emits when the next key is pressed. */
  readonly next = output<void>();
}
