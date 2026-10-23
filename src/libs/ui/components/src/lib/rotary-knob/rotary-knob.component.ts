import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ControlSize } from '../shared/control-size';
import type { LiveLevelIndicator } from '../shared/live-indicator';

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
/** The panel look's offset arc and its inner track share this radius. */
const PANEL_ARC_RADIUS = 31;
/** The panel look's live ring and its track sit outside the offset arc. */
const LIVE_RING_RADIUS = 37;
const PANEL_POINTER_INNER_RADIUS = 6;
const PANEL_POINTER_OUTER_RADIUS = 17;
/** Right-hand end of the sweep, +45°. */
const END_ANGLE_DEG = HOME_ANGLE_DEG + TRAVEL_DEG;
/** The live ring's resolution: the level is quantized to thousandths. */
const LIVE_LEVEL_STEPS = 1000;
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

/** The whole -225°..+45° sweep as one arc on `radius`, the long way round. */
function fullSweepPath(radius: number): string {
  const start = pointOnCircle(START_ANGLE_DEG, radius);
  const end = pointOnCircle(END_ANGLE_DEG, radius);
  return `M ${start.x},${start.y} A ${radius},${radius} 0 1,1 ${end.x},${end.y}`;
}

const INNER_TRACK_PATH = fullSweepPath(PANEL_ARC_RADIUS);
const LIVE_TRACK_PATH = fullSweepPath(LIVE_RING_RADIUS);

/** The live ring's `stroke-dashoffset` for each step, prebuilt so `setLiveLevel` builds no string. */
const LIVE_DASH_OFFSETS: readonly string[] = Array.from({ length: LIVE_LEVEL_STEPS + 1 }, (_, i) =>
  String(100 - i / 10),
);

/** How the dial is drawn: today's outline dial, or the SID panel's skirt-and-cap dial. */
export type KnobAppearance = 'default' | 'panel';

/**
 * The one rotary control every scale parameter (cutoff, resonance, pulse width, key) shares, so
 * they all behave identically under the hand. Purely presentational — it knows nothing of any
 * caller's model, coefficients or tapers; it takes a position and emits one. A native
 * `input[type="range"]`, transparent and layered over the dial, does the actual input handling,
 * which gives keyboard operation and assistive-technology state for free; the SVG dial is purely
 * decorative (`aria-hidden`).
 *
 * `appearance="panel"` redraws the dial as the SID panel's (skirt, cap, white pointer, magenta
 * offset arc), and with `liveRing` adds an outer ring whose length a painter sets through
 * `setLiveLevel` — directly on the DOM, outside change detection.
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
    '[attr.data-appearance]': "appearance() === 'default' ? null : appearance()",
  },
})
export class RotaryKnobComponent implements LiveLevelIndicator {
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
  /** 'panel' draws the SID panel's dial: skirt, cap, white pointer, magenta offset arc. */
  readonly appearance = input<KnobAppearance>('default');
  /** Draws an outer ring whose length `setLiveLevel` sets. Part of the panel look only: with the
   *  default appearance it draws nothing. Defaults to false. */
  readonly liveRing = input<boolean>(false);
  /** Appended to the value text off home: "+12 semitones", "-20 cents". Defaults to null. */
  readonly valueUnit = input<string | null>(null);
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

  /** Whether the panel look is drawn. */
  protected readonly isPanel = computed(() => this.appearance() === 'panel');

  /** Whether the live ring and its track are drawn: the panel look with `liveRing()` on. */
  protected readonly showLiveRing = computed(() => this.isPanel() && this.liveRing());

  protected readonly innerTrackPath = INNER_TRACK_PATH;
  protected readonly liveTrackPath = LIVE_TRACK_PATH;

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

  /** The panel pointer's inner end, `PANEL_POINTER_INNER_RADIUS` out from center at `angleDeg()`. */
  protected readonly panelPointerStart = computed(() =>
    pointOnCircle(this.angleDeg(), PANEL_POINTER_INNER_RADIUS),
  );

  /** The panel pointer's outer end, `PANEL_POINTER_OUTER_RADIUS` out from center at `angleDeg()`. */
  protected readonly panelPointerEnd = computed(() =>
    pointOnCircle(this.angleDeg(), PANEL_POINTER_OUTER_RADIUS),
  );

  /** `null` at home — the ring carries no state of its own, it is derived from `value()` alone. A
   *  dial that `restsAtMinimum()` grows its ring clockwise from the lower-left start. */
  protected readonly valueRingPath = computed(() => this.offsetArcPath(RING_RADIUS));

  /** The panel look's offset arc: the same home-to-value arc as `valueRingPath`, on the inner track. */
  protected readonly panelArcPath = computed(() => this.offsetArcPath(PANEL_ARC_RADIUS));

  /** What assistive technology announces. A centre-home knob says "home" at rest and the signed
   *  departure from it otherwise; a knob that `restsAtMinimum()` has no negative side, so it says
   *  its plain value. Off home, `valueUnit()` follows the number. The panel look writes a negative
   *  with U+2212, the app's readout convention; the default look keeps the hyphen-minus. */
  protected readonly valueText = computed(() => {
    const unit = this.valueUnit();
    const suffix = unit ? ` ${unit}` : '';
    if (this.restsAtMinimum()) {
      return `${this.signed(roundTo2(this.value()))}${this.isAtHome() ? '' : suffix}`;
    }
    if (this.isAtHome()) {
      return 'home';
    }
    const departure = roundTo2(this.value() - this.home());
    return `${departure > 0 ? '+' : ''}${this.signed(departure)}${suffix}`;
  });

  private readonly liveRingPath = viewChild<ElementRef<SVGPathElement>>('liveRingPath');
  private lastLivePath: SVGPathElement | null = null;
  private lastLiveStep = 0;

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

  /** Sets the live ring to `level` (0…1, clamped; non-finite reads as 0). Writes the ring's
   *  stroke-dashoffset directly — no signal, no change detection, no layout. A no-op without
   *  `liveRing()` in the panel look. */
  setLiveLevel(level: number): void {
    const path = this.liveRingPath()?.nativeElement;
    if (!path) {
      return;
    }
    const clamped = Number.isFinite(level) ? Math.min(Math.max(level, 0), 1) : 0;
    const step = Math.round(clamped * LIVE_LEVEL_STEPS);
    if (path === this.lastLivePath && step === this.lastLiveStep) {
      return;
    }
    this.lastLivePath = path;
    this.lastLiveStep = step;
    path.style.strokeDashoffset = LIVE_DASH_OFFSETS[step];
  }

  /** The arc from home to the current value on `radius`, or `null` at home. */
  private offsetArcPath(radius: number): string | null {
    if (this.isAtHome()) {
      return null;
    }
    const angle = this.angleDeg();
    const end = pointOnCircle(angle, radius);
    if (this.restsAtMinimum()) {
      const start = pointOnCircle(START_ANGLE_DEG, radius);
      const largeArcFlag = angle - START_ANGLE_DEG > HALF_TURN_DEG ? 1 : 0;
      return `M ${start.x},${start.y} A ${radius},${radius} 0 ${largeArcFlag},1 ${end.x},${end.y}`;
    }
    const start = pointOnCircle(HOME_ANGLE_DEG, radius);
    const sweepFlag = this.value() > this.home() ? 1 : 0;
    return `M ${start.x},${start.y} A ${radius},${radius} 0 0,${sweepFlag} ${end.x},${end.y}`;
  }

  private signed(n: number): string {
    return this.isPanel() && n < 0 ? `\u2212${Math.abs(n)}` : `${n}`;
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
