import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One voice's caller-composed state within a voice panel. */
export interface VoiceRowModel {
  /** e.g. 'V1' — this row's own label, rendered beside the checkbox. */
  readonly label: string;
  /** The latched mute — drives the checkbox and the hold button's verb. */
  readonly muted: boolean;
  /** 'Kill' | 'Punch' — the hold button's own text. */
  readonly holdLabel: string;
  /** Unique per rendered row; the caller composes it. */
  readonly checkboxId: string;
  /** e.g. 'Mute voice 1 deck A' — the checkbox's own accessible name. */
  readonly muteAccessibleName: string;
  /** e.g. 'Kill voice 1 deck A' / 'Punch in voice 1 deck A' — the hold button's own accessible name. */
  readonly holdAccessibleName: string;
}

/**
 * One voice's mute/kill controls: a checkbox for the latched mute, checkbox and label on one line,
 * and beneath them a momentary hold button whose press and release are both meaningful — held down
 * it inverts the latched mute for as long as it's held, by pointer or by Enter/Space, which is the
 * only way a keyboard user can express "while held".
 *
 * Purely presentational: it holds no state of its own and never resolves latched-XOR-held itself —
 * `model().holdLabel` already carries whatever the caller decided that means.
 *
 * @example
 * ```html
 * <lib-voice-row
 *   [model]="rowModel()"
 *   (mutedChange)="onMutedChange($event)"
 *   (heldChange)="onHeldChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-voice-row',
  templateUrl: './voice-row.component.html',
  styleUrl: './voice-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceRowComponent {
  /** The voice row's display model and state. */
  readonly model = input.required<VoiceRowModel>();
  /** Emits when the mute checkbox is toggled. */
  readonly mutedChange = output<boolean>();
  /** Emits on hold button press (`true`) and release/cancel (`false`). Momentary; both press and release are meaningful. */
  readonly heldChange = output<boolean>();

  /** Tracks a keyboard-initiated hold so `onHoldBlur` knows whether to end one — a pointer hold
   *  ends through `onHoldEnd` regardless of focus, via pointer capture. */
  private keyHeld = false;

  /** Forwards the mute checkbox's toggled state. */
  protected onMutedChange(event: Event): void {
    this.mutedChange.emit((event.target as HTMLInputElement).checked);
  }

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   *  the browser fires no `pointerup` here and the row stays inverted. Guarded with `?.` because
   *  this API isn't implemented in the jsdom test environment. */
  protected onHoldStart(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.heldChange.emit(true);
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  protected onHoldEnd(): void {
    this.heldChange.emit(false);
  }

  /** Keyboard equivalent of `onHoldStart` for Enter/Space; `event.repeat` guards against the
   *  browser's auto-repeat re-triggering the press while the key stays down. Bound to the plain
   *  `keydown` event (rather than Angular's `keydown.enter`/`keydown.space` filter syntax) because
   *  strict template type checking can't resolve those filtered event names to `KeyboardEvent`. */
  protected onHoldKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.keyHeld = true;
    this.heldChange.emit(true);
  }

  /** Keyboard equivalent of `onHoldEnd` for Enter/Space. */
  protected onHoldKeyUp(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.keyHeld = false;
    this.heldChange.emit(false);
  }

  /** Ends a keyboard hold the browser will never deliver a matching `keyup` for — focus left this
   *  button (e.g. Tab, or a click elsewhere) while Enter/Space was still down. A no-op otherwise,
   *  so a pointer hold (which does not touch `keyHeld`) is untouched by a coincidental blur. */
  protected onHoldBlur(): void {
    if (!this.keyHeld) {
      return;
    }
    this.keyHeld = false;
    this.heldChange.emit(false);
  }
}
