import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One button in a `JumpButtonGroupComponent`, rendered in `buttons()`'s own order. */
export interface JumpButtonModel {
  /** Opaque here — round-tripped verbatim on `jump`, e.g. `'up' | 'home' | 'down'`. */
  readonly id: string;
  /** The button's own text, e.g. `'+50%'`. */
  readonly label: string;
  /** This button's own accessible name, e.g. `'Speed up 50% deck A'`. */
  readonly accessibleName: string;
  readonly disabled?: boolean;
}

/**
 * A column of buttons driven entirely by data — not welded to any one caller's semantics. Renders
 * one button per `buttons()` entry, top to bottom, and reports which one was pressed by that
 * entry's own `id`. Purely presentational: it holds no state of its own.
 *
 * @example
 * ```html
 * <lib-jump-button-group [buttons]="jumpButtons()" (jump)="onJump($event)" />
 * ```
 */
@Component({
  selector: 'lib-jump-button-group',
  templateUrl: './jump-button-group.component.html',
  styleUrl: './jump-button-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JumpButtonGroupComponent {
  /** Array of button models, rendered in order from top to bottom. */
  readonly buttons = input.required<readonly JumpButtonModel[]>();
  /** Emits the pressed button's own `id`. */
  readonly jump = output<string>();
}
