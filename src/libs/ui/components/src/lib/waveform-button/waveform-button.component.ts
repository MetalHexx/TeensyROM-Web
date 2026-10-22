import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { LiveLightIndicator } from '../shared/live-indicator';

export type WaveformKind = 'triangle' | 'sawtooth' | 'pulse' | 'noise';

const GLYPH_PATHS: Readonly<Record<WaveformKind, string>> = {
  triangle: 'M1 9 L4.5 1 L8 9 L11.5 1 L15 9',
  sawtooth: 'M1 9 L8 1 V9 L15 1 V9',
  pulse: 'M1 9 V1 H5.5 V9 H10.5 V1 H15',
  noise: 'M1 5 L2 2 L3 7 L4 3 L5 9 L6 1 L7 6 L8 4 L9 8 L10 2 L11 7 L12 3 L13 9 L14 4 L15 6',
};

/**
 * A small panel button that draws one SID waveform glyph. It is a native button, so Enter and
 * Space press it and it sits in the tab order. It carries no on/off state of its own: the caller
 * reports presses through `press`, and a painter sets the live light — what the chip is playing —
 * through `setLiveLight`, directly on the host and outside change detection. `locked` marks a
 * control the tune is not free to change, drawn as a heavier outline and reflected as
 * `aria-pressed`.
 *
 * @example
 * ```html
 * <lib-waveform-button
 *   waveform="pulse"
 *   accessibleName="Pulse, voice 1"
 *   [locked]="pulseLocked()"
 *   (press)="onPulse()"
 * />
 * ```
 */
@Component({
  selector: 'lib-waveform-button',
  templateUrl: './waveform-button.component.html',
  styleUrl: './waveform-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-locked]': "locked() ? '' : null",
  },
})
export class WaveformButtonComponent implements LiveLightIndicator {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private lastLit = false;
  private lastGhost = false;

  /** Which waveform's glyph to draw. */
  readonly waveform = input.required<WaveformKind>();
  /** e.g. 'Pulse, voice 1' — caller composes it. */
  readonly accessibleName = input.required<string>();
  /** Disables the button; no `press` is emitted. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Marks the control as locked: a magenta outline weight, and `aria-pressed`. Defaults to false. */
  readonly locked = input<boolean>(false);
  /** Emits when the button is clicked, or pressed with Enter or Space. */
  readonly press = output<void>();

  protected readonly glyphPaths = GLYPH_PATHS;

  /** Sets what the chip is playing: `lit` fills the light; `ghost` draws the tune's own choice
   *  under a lock as a faint dashed outline. Toggles host attributes directly (data-lit,
   *  data-ghost) — no signal, no change detection; repeat calls with the same pair write nothing. */
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
