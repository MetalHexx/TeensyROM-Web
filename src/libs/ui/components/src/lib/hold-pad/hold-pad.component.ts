import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HoldPressDirective } from '../hold-press/hold-press.directive';

/**
 * A small rounded DJ pad with no light that glows magenta for as long as it is held — Kill and
 * Punch on a voice, or the speed nudge '−' and '+'. It is a native button using `libHoldPress`,
 * so a hold works by pointer or by Enter/Space, and `heldChange` reports both the press (`true`)
 * and the release (`false`), including a release forced by blur, pointer cancel, becoming
 * disabled or being removed mid-hold. The held state is reflected as `aria-pressed`.
 *
 * @example
 * ```html
 * <lib-hold-pad
 *   label="Kill"
 *   accessibleName="Kill voice 1 deck A"
 *   (heldChange)="onKill($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-hold-pad',
  imports: [HoldPressDirective],
  templateUrl: './hold-pad.component.html',
  styleUrl: './hold-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-shape]': 'shape()',
  },
})
export class HoldPadComponent {
  /** 'Kill' / 'Punch', or '−' / '+'. Drawn in uppercase. */
  readonly label = input<string>('');
  /** Accessible name, e.g. 'Kill voice 1 deck A'; the caller composes it. */
  readonly accessibleName = input.required<string>();
  /** `pill` is 44×22; `round` is 26×26. Defaults to `pill`. */
  readonly shape = input<'pill' | 'round'>('pill');
  /** Disables the pad. Becoming disabled mid-hold emits `heldChange(false)` once. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Emits `true` on press and `false` on release or cancel. Momentary; both are meaningful. */
  readonly heldChange = output<boolean>();
}
