import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * The panel's Panic button: an outlined magenta button that asks for everything to be silenced
 * and reset. It is a native button, so Enter and Space press it and it sits in the tab order. It
 * has no on/off state and no live light; the caller acts on `press`.
 *
 * @example
 * ```html
 * <lib-panic-button accessibleName="Panic: silence all voices" (press)="onPanic()" />
 * ```
 */
@Component({
  selector: 'lib-panic-button',
  templateUrl: './panic-button.component.html',
  styleUrl: './panic-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanicButtonComponent {
  /** e.g. 'Panic: silence all voices' — caller composes it. */
  readonly accessibleName = input.required<string>();
  /** Disables the button; no `press` is emitted. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Emits when the button is clicked, or pressed with Enter or Space. */
  readonly press = output<void>();
}
