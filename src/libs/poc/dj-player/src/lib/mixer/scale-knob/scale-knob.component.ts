import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

const CENTER = 40;
const HOME_ANGLE_DEG = -90;
const TRAVEL_DEG = 135;
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
 * they all behave identically under the hand. Purely presentational — it knows nothing of
 * `MixerService`, coefficients or tapers; it takes a position and emits one. `P02-T02` binds it to
 * the model. A native `input[type="range"]`, transparent and layered over the dial, does the actual
 * input handling, which gives keyboard operation and assistive-technology state for free; the SVG
 * dial is purely decorative (`aria-hidden`).
 */
@Component({
  selector: 'lib-scale-knob',
  templateUrl: './scale-knob.component.html',
  styleUrl: './scale-knob.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaleKnobComponent {
  /** 'Cutoff' | 'Resonance' | 'Pulse Width' | 'Key' */
  readonly label = input.required<string>();
  /** e.g. 'Cutoff deck A' — caller composes it. */
  readonly accessibleName = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input<number>(-1);
  readonly max = input<number>(1);
  readonly step = input<number>(0.01);
  readonly home = input<number>(0);
  /** Rendered under the dial when present — Key's semitone offset, and nothing else. */
  readonly readout = input<string | null>(null);
  readonly valueChange = output<number>();

  protected readonly isAtHome = computed(() => this.value() === this.home());

  /** The dial's own -225°..+45° sweep, home fixed at -90° (screen-up). */
  protected readonly angleDeg = computed(() => {
    const home = this.home();
    const value = this.value();
    if (value === home) {
      return HOME_ANGLE_DEG;
    }
    const span = value > home ? this.max() - home : home - this.min();
    const t = span === 0 ? 0 : (value - home) / span;
    return HOME_ANGLE_DEG + t * TRAVEL_DEG;
  });

  protected readonly pointerEnd = computed(() => pointOnCircle(this.angleDeg(), POINTER_RADIUS));

  /** `null` at home — the ring carries no state of its own, it is derived from `value()` alone. */
  protected readonly valueRingPath = computed(() => {
    if (this.isAtHome()) {
      return null;
    }
    const start = pointOnCircle(HOME_ANGLE_DEG, RING_RADIUS);
    const end = pointOnCircle(this.angleDeg(), RING_RADIUS);
    const sweepFlag = this.value() > this.home() ? 1 : 0;
    return `M ${start.x},${start.y} A ${RING_RADIUS},${RING_RADIUS} 0 0,${sweepFlag} ${end.x},${end.y}`;
  });

  /** "home" at rest, otherwise the signed departure from it. */
  protected readonly valueText = computed(() => {
    if (this.isAtHome()) {
      return 'home';
    }
    const departure = roundTo2(this.value() - this.home());
    return departure > 0 ? `+${departure}` : `${departure}`;
  });

  protected onRangeInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onDoubleClick(): void {
    this.valueChange.emit(this.home());
  }

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

  /** `preventDefault()` suppresses the native range's own click-to-position jump on `mousedown` —
   * that jump is what made the first click of a double-click move the knob before it landed home. */
  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    const target = event.target as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    target.focus();
    this.drag = { pointerId: event.pointerId, lastY: event.clientY, rawValue: this.value() };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
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

  protected onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = null;
    }
  }
}
