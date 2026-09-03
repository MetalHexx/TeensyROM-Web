import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

const CENTER = 40;
const HOME_ANGLE_DEG = -90;
const TRAVEL_DEG = 135;
const POINTER_RADIUS = 26;
const RING_RADIUS = 34;

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
}
