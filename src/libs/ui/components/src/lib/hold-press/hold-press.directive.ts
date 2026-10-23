import { Directive, OnDestroy, Signal, effect, input, output, signal, untracked } from '@angular/core';

/**
 * Turns a native `<button>` into a momentary hold control whose press and release are both
 * meaningful: `holdChange(true)` when it is pressed, `holdChange(false)` when it is released, by
 * pointer or by Enter/Space — the only way a keyboard user can express "while held".
 *
 * A hold ends through pointer release, pointer cancel, key release, or — for a keyboard hold only
 * — the button losing focus. Two safety releases guarantee a consumer never sees a press without
 * its release: the host becoming `holdDisabled` mid-hold, and the host being destroyed mid-hold.
 *
 * @example
 * ```html
 * <button libHoldPress [holdDisabled]="disabled()" (holdChange)="onHold($event)">Kill</button>
 * ```
 */
@Directive({
  selector: '[libHoldPress]',
  exportAs: 'libHoldPress',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerEnd()',
    '(pointercancel)': 'onPointerEnd()',
    '(keydown)': 'onKeyDown($event)',
    '(keyup)': 'onKeyUp($event)',
    '(blur)': 'onBlur()',
  },
})
export class HoldPressDirective implements OnDestroy {
  /** Makes the host inert. Becoming disabled while a hold is in progress emits `holdChange(false)`
   *  once. Defaults to `false`. */
  readonly holdDisabled = input<boolean>(false);
  /** Emits `true` on press and `false` on release or cancel. Momentary; both are meaningful. */
  readonly holdChange = output<boolean>();

  private readonly heldState = signal(false);

  /** Whether a hold (pointer or keyboard) is in progress, for the host's styling. */
  readonly held: Signal<boolean> = this.heldState.asReadonly();

  /** Tracks a keyboard-initiated hold so `onBlur` knows whether to end one — a pointer hold
   *  ends through `onPointerEnd` regardless of focus, via pointer capture. */
  private keyHeld = false;

  /** Releases a hold in progress when the host becomes disabled: a disabled button never delivers
   *  its own release, so without this the consumer would stay held. */
  constructor() {
    effect(() => {
      if (this.holdDisabled() && untracked(this.heldState)) {
        this.keyHeld = false;
        this.endHold();
      }
    });
  }

  /** Releases a hold still in progress when the host is removed (e.g. navigating away mid-hold):
   *  the element goes before its release event, and the deck engine outlives the page, so without
   *  this the voice would stay inverted. Emits from `ngOnDestroy` rather than a `DestroyRef`
   *  callback, which runs after the parent's listeners are unsubscribed and so would reach no one. */
  ngOnDestroy(): void {
    if (this.heldState()) {
      this.keyHeld = false;
      this.endHold();
    }
  }

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   *  the browser fires no `pointerup` here and the hold never ends. Guarded with `?.` because
   *  this API isn't implemented in the jsdom test environment. */
  protected onPointerDown(event: PointerEvent): void {
    if (this.holdDisabled()) {
      return;
    }
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.startHold();
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  protected onPointerEnd(): void {
    if (this.holdDisabled()) {
      return;
    }
    this.endHold();
  }

  /** Keyboard equivalent of `onPointerDown` for Enter/Space; `event.repeat` guards against the
   *  browser's auto-repeat re-triggering the press while the key stays down. */
  protected onKeyDown(event: KeyboardEvent): void {
    if (this.holdDisabled() || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.keyHeld = true;
    this.startHold();
  }

  /** Keyboard equivalent of `onPointerEnd` for Enter/Space. */
  protected onKeyUp(event: KeyboardEvent): void {
    if (this.holdDisabled() || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    event.preventDefault();
    this.keyHeld = false;
    this.endHold();
  }

  /** Ends a keyboard hold the browser will never deliver a matching `keyup` for — focus left this
   *  button (e.g. Tab, or a click elsewhere) while Enter/Space was still down. A no-op otherwise,
   *  so a pointer hold (which does not touch `keyHeld`) is untouched by a coincidental blur. */
  protected onBlur(): void {
    if (!this.keyHeld) {
      return;
    }
    this.keyHeld = false;
    this.endHold();
  }

  private startHold(): void {
    this.heldState.set(true);
    this.holdChange.emit(true);
  }

  /** Clears the hold state and emits the release. */
  private endHold(): void {
    this.heldState.set(false);
    this.holdChange.emit(false);
  }
}
