import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import type { ControlSize } from '../shared/control-size';

const CENTER = 40;
const HOME_ANGLE_DEG = -90;
const TRAVEL_DEG = 135;
/** Where a dial that rests at its minimum starts: the lower-left end of the sweep, -225°. */
const START_ANGLE_DEG = HOME_ANGLE_DEG - TRAVEL_DEG;
/** The whole lower-left to lower-right sweep, 270°. */
const FULL_SWEEP_DEG = 2 * TRAVEL_DEG;
/** An arc spanning more than this many degrees takes SVG's long way round (large-arc flag 1). */
const HALF_TURN_DEG = 180;
const POINTER_RADIUS = 26;
const RING_RADIUS = 34;
/** Vertical pixels of drag for a full min→max sweep — DAW convention (Ableton etc.), not the
 * native range's own horizontal click-and-drag. Tunable by ear, same spirit as `scale-taper.ts`. */
const PIXELS_PER_FULL_RANGE = 200;
/** Shift held while dragging quarters the sensitivity for fine adjustment. */
const FINE_ADJUST_MULTIPLIER = 4;

interface Point {
  readonly x: number;
  readonly y: number;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointOnCircle(angleDeg: number, radius: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: roundTo2(CENTER + radius * Math.cos(rad)),
    y: roundTo2(CENTER + radius * Math.sin(rad)),
  };
}

/**
 * The one rotary control every scale parameter (cutoff, resonance, pulse width, key) shares, so
 * they all behave identically under the hand. Purely presentational — it knows nothing of any
 * caller's model, coefficients or tapers; it takes a position and emits one. A native
 * `input[type="range"]`, transparent and layered over the dial, does the actual input handling,
 * which gives keyboard operation and assistive-technology state for free; the SVG dial is purely
 * decorative (`aria-hidden`).
 *
 * @example
 * ```html
 * <lib-rotary-knob
 *   label="Cutoff"
 *   accessibleName="Cutoff deck A"
 *   [value]="cutoff()"
 *   (valueChange)="onCutoffChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-rotary-knob',
  templateUrl: './rotary-knob.component.html',
  styleUrl: './rotary-knob.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': "disabled() ? '' : null",
  },
})
export class RotaryKnobComponent {
  /** 'Cutoff' | 'Resonance' | 'Pulse Width' | 'Key' */
  readonly label = input.required<string>();
  /** The dial's rendered size — reflected as `data-size` on the host, which the stylesheet reads to
   *  set the dial's own dimensions and font size. Defaults to `'large'`, today's only size, so every
   *  existing use renders pixel-identical. */
  readonly size = input<ControlSize>('large');
  /** e.g. 'Cutoff deck A' — caller composes it. */
  readonly accessibleName = input.required<string>();
  /** The dial's current position, between `min()` and `max()`. */
  readonly value = input.required<number>();
  /** Minimum of the dial's range. Defaults to `-1`. */
  readonly min = input<number>(-1);
  /** Maximum of the dial's range. Defaults to `1`. */
  readonly max = input<number>(1);
  /** Granularity of the native range input. Defaults to `0.01`. */
  readonly step = input<number>(0.01);
  /** The rest position the dial returns to on double-click. Defaults to `0`. When it equals `min()`
   *  the dial rests at its minimum: it starts lower-left and sweeps the full 270° to `max()`
   *  instead of splitting around a top-centre home. */
  readonly home = input<number>(0);
  /** Rendered under the dial when present — Key's semitone offset, and nothing else. */
  readonly readout = input<string | null>(null);
  /** Disables the native range input and dims the dial. A disabled knob ignores keyboard, vertical
   *  drag and double-click-to-home, so it emits nothing. Defaults to `false`, so every existing use
   *  is unchanged. */
  readonly disabled = input<boolean>(false);
  /** Emits the dial's new position — on drag, keyboard input, or double-click-to-home. */
  readonly valueChange = output<number>();

  /** Whether the current value sits exactly at `home()` — the value ring and `valueText` both
   *  branch on this rather than comparing floats independently. */
  protected readonly isAtHome = computed(() => this.value() === this.home());

  /** Whether `home()` is the bottom of the range, so the dial rests lower-left and sweeps the full
   *  270° to `max()` instead of splitting around a top-centre home. */
  protected readonly restsAtMinimum = computed(() => this.home() === this.min());

  /** The dial's own -225°..+45° sweep. Centre-home dials fix home at -90° (screen-up) and spread
   *  each side over its own half; a dial that `restsAtMinimum()` starts at -225° and spreads the
   *  whole range over 270°. */
  protected readonly angleDeg = computed(() => {
    const home = this.home();
    const value = this.value();
    if (this.restsAtMinimum()) {
      const range = this.max() - this.min();
      const t = range === 0 ? 0 : (value - this.min()) / range;
      return START_ANGLE_DEG + t * FULL_SWEEP_DEG;
    }
    if (value === home) {
      return HOME_ANGLE_DEG;
    }
    const span = value > home ? this.max() - home : home - this.min();
    const t = span === 0 ? 0 : (value - home) / span;
    return HOME_ANGLE_DEG + t * TRAVEL_DEG;
  });

  /** The pointer needle's endpoint, `POINTER_RADIUS` out from center at `angleDeg()`. */
  protected readonly pointerEnd = computed(() => pointOnCircle(this.angleDeg(), POINTER_RADIUS));

  /** `null` at home — the ring carries no state of its own, it is derived from `value()` alone. A
   *  dial that `restsAtMinimum()` grows its ring clockwise from the lower-left start. */
  protected readonly valueRingPath = computed(() => {
    if (this.isAtHome()) {
      return null;
    }
    const angle = this.angleDeg();
    const end = pointOnCircle(angle, RING_RADIUS);
    if (this.restsAtMinimum()) {
      const start = pointOnCircle(START_ANGLE_DEG, RING_RADIUS);
      const largeArcFlag = angle - START_ANGLE_DEG > HALF_TURN_DEG ? 1 : 0;
      return `M ${start.x},${start.y} A ${RING_RADIUS},${RING_RADIUS} 0 ${largeArcFlag},1 ${end.x},${end.y}`;
    }
    const start = pointOnCircle(HOME_ANGLE_DEG, RING_RADIUS);
    const sweepFlag = this.value() > this.home() ? 1 : 0;
    return `M ${start.x},${start.y} A ${RING_RADIUS},${RING_RADIUS} 0 0,${sweepFlag} ${end.x},${end.y}`;
  });

  /** What assistive technology announces. A centre-home knob says "home" at rest and the signed
   *  departure from it otherwise; a knob that `restsAtMinimum()` has no negative side, so it says
   *  its plain value. */
  protected readonly valueText = computed(() => {
    if (this.restsAtMinimum()) {
      return `${roundTo2(this.value())}`;
    }
    if (this.isAtHome()) {
      return 'home';
    }
    const departure = roundTo2(this.value() - this.home());
    return departure > 0 ? `+${departure}` : `${departure}`;
  });

  /** Active drag's pointer id, last seen `clientY`, and a running *unrounded* value, or `null` when
   * no drag is in progress. Tracked per-move (not from a fixed drag-start point) so toggling Shift
   * mid-drag — which changes the pixels-per-value ratio — never causes the value to jump.
   *
   * `rawValue` is why this isn't just `this.value() + delta`: a stepped knob (Key, `step=1`) has its
   * emitted value rounded before it comes back through `value()`, so re-deriving each move's delta
   * from that already-rounded input would throw away every sub-step fraction of the drag — most
   * small mouse movements would round back to the same integer and do nothing, only occasionally
   * lining up into a jump. Accumulating locally instead means the same physical drag distance always
   * produces the same result, continuous knobs and stepped ones alike. */
  private drag: { pointerId: number; lastY: number; rawValue: number } | null = null;

  /** Abandons a drag the moment the knob is disabled, not when the next pointer event happens to
   *  arrive: a knob disabled and re-enabled with the pointer held still (a new tune loading resets
   *  the value underneath it) would otherwise resume from the stale `rawValue` and jump. */
  constructor() {
    effect(() => {
      if (this.disabled()) {
        this.drag = null;
      }
    });
  }

  /** Forwards the native range's raw value straight through as `valueChange`, unrounded. */
  protected onRangeInput(event: Event): void {
    if (this.disabled()) {
      return;
    }
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }

  /** Resets to `home()` — the value ring collapses and the pointer snaps back to the dial's rest position. */
  protected onDoubleClick(): void {
    if (this.disabled()) {
      return;
    }
    this.valueChange.emit(this.home());
  }

  /** `preventDefault()` suppresses the native range's own click-to-position jump on `mousedown` —
   * that jump is what made the first click of a double-click move the knob before it landed home. */
  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    const target = event.target as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    target.focus();
    this.drag = { pointerId: event.pointerId, lastY: event.clientY, rawValue: this.value() };
  }

  /** Accumulates the move's `dy` into `drag.rawValue`, clamps to `[min, max]`, and emits — see
   *  `drag`'s doc for why this doesn't just add the delta to `value()`. */
  protected onPointerMove(event: PointerEvent): void {
    if (this.disabled() || !this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }
    const dy = this.drag.lastY - event.clientY;
    this.drag.lastY = event.clientY;

    const pixelsForFullRange = event.shiftKey
      ? PIXELS_PER_FULL_RANGE * FINE_ADJUST_MULTIPLIER
      : PIXELS_PER_FULL_RANGE;
    const delta = (dy / pixelsForFullRange) * (this.max() - this.min());
    this.drag.rawValue = Math.min(Math.max(this.drag.rawValue + delta, this.min()), this.max());
    this.valueChange.emit(this.drag.rawValue);
  }

  /** Ends the drag once its own pointer lifts or cancels; ignores any other pointer's event. */
  protected onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = null;
    }
  }
}
