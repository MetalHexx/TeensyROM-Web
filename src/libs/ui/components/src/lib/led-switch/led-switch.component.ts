import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { LiveLightIndicator } from '../shared/live-indicator';

/**
 * A small labelled pill with an LED dot, for the panel's on/off switches — Ring, Sync, Filt and
 * the LP/BP/HP filter modes. It is a native button, so Enter and Space press it and it sits in
 * the tab order. It carries no on/off state of its own: the caller reports presses through
 * `press`, and a painter sets the live light — what the chip is doing — through `setLiveLight`,
 * directly on the host and outside change detection. `locked` marks a control the tune is not
 * free to change, drawn as a heavier outline and reflected as `aria-pressed`.
 *
 * @example
 * ```html
 * <lib-led-switch
 *   label="Ring"
 *   accessibleName="Ring modulation, voice 1"
 *   [locked]="ringLocked()"
 *   (press)="onRing()"
 * />
 * ```
 */
@Component({
  selector: 'lib-led-switch',
  templateUrl: './led-switch.component.html',
  styleUrl: './led-switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-locked]': "locked() ? '' : null",
  },
})
export class LedSwitchComponent implements LiveLightIndicator {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private lastLit = false;
  private lastGhost = false;

  /** 'Ring' | 'Sync' | 'Filt' | 'LP' | 'BP' | 'HP' — drawn in uppercase. */
  readonly label = input.required<string>();
  /** e.g. 'Ring modulation, voice 1' — caller composes it. */
  readonly accessibleName = input.required<string>();
  /** Disables the button; no `press` is emitted. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Marks the control as locked: a magenta outline weight, and `aria-pressed`. Defaults to false. */
  readonly locked = input<boolean>(false);
  /** Emits when the button is clicked, or pressed with Enter or Space. */
  readonly press = output<void>();

  /** Sets what the chip is doing: `lit` fills the LED; `ghost` draws the tune's own choice under
   *  a lock as a dashed outline with a hollow ring dot. Toggles host attributes directly
   *  (data-lit, data-ghost) — no signal, no change detection; repeat calls with the same pair
   *  write nothing. */
  setLiveLight(lit: boolean, ghost: boolean): void {
    if (lit === this.lastLit && ghost === this.lastGhost) {
      return;
    }
    const el = this.host.nativeElement;
    if (lit !== this.lastLit) {
      el.toggleAttribute('data-lit', lit);
    }
    if (ghost !== this.lastGhost) {
      el.toggleAttribute('data-ghost', ghost);
    }
    this.lastLit = lit;
    this.lastGhost = ghost;
  }
}
