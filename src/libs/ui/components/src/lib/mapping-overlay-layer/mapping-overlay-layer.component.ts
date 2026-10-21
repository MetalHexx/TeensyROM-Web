import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** How a mapping overlay reads: free to pick, picked and waiting, or already bound. */
export type MappingOverlayState = 'selectable' | 'selected' | 'bound';

/** One control the layer draws an overlay on. */
export interface MappingOverlayTarget {
  /** The caller's key for this target, emitted back by `targetSelect`. */
  readonly id: string;
  /** A CSS selector for the control's own element, resolved inside the layer's `scope`. */
  readonly anchor: string;
  /** The overlay's state. */
  readonly state: MappingOverlayState;
  /** The overlay button's accessible name, e.g. 'Map Speed, deck A'. */
  readonly accessibleName: string;
}

/** An overlay with its measured box, in the layer's own coordinates. */
interface PlacedOverlay {
  /** The target the overlay stands for. */
  readonly target: MappingOverlayTarget;
  /** Distance from the layer's top edge to the overlay's, in px. */
  readonly top: number;
  /** Distance from the layer's left edge to the overlay's, in px. */
  readonly left: number;
  /** The overlay's width, in px. */
  readonly width: number;
  /** The overlay's height, in px. */
  readonly height: number;
}

/** How far an overlay extends past its anchor's box on every side. */
const OVERLAY_INSET_PX = 3;

/**
 * Draws one overlay button on each target control's own box, for picking which control a hardware
 * input maps onto. The overlays sit above the controls; while an overlay exists its control is made
 * `inert`, so it can be neither operated nor focused, and the overlay is the only thing a click or
 * the keyboard reaches.
 *
 * The host is `position: absolute; inset: 0` with `pointer-events: none` — the caller places it
 * inside a `position: relative` container that also holds the controls, and passes that container,
 * or any element inside it, as `scope`. Each target's `anchor` selector is resolved inside `scope`;
 * one that matches nothing renders no overlay. Positions are re-measured in one animation frame
 * whenever `targets` or `scope` change, when the scope or any anchor resizes, and when the window
 * resizes.
 *
 * Line style and weight, not colour alone, tell the states apart: `selectable` is a thin dashed
 * border, `selected` a thick solid border with an outer ring, `bound` a thin solid border in the
 * accent colour.
 *
 * @example
 * ```html
 * <div #deck class="deck" style="position: relative">
 *   <button data-control="stop">Stop</button>
 *   <lib-mapping-overlay-layer
 *     [targets]="targets()"
 *     [scope]="deck"
 *     (targetSelect)="onTargetSelect($event)"
 *     (dismiss)="onDismiss()"
 *   />
 * </div>
 * ```
 */
@Component({
  selector: 'lib-mapping-overlay-layer',
  templateUrl: './mapping-overlay-layer.component.html',
  styleUrl: './mapping-overlay-layer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'scheduleMeasure()',
  },
})
export class MappingOverlayLayerComponent {
  /** The controls to draw an overlay on, in tab order. */
  readonly targets = input.required<readonly MappingOverlayTarget[]>();
  /** The element every target's `anchor` selector is resolved inside. */
  readonly scope = input.required<HTMLElement>();
  /** Emits the `id` of the target whose overlay was activated. */
  readonly targetSelect = output<string>();
  /** Emits when Escape is pressed on any overlay. */
  readonly dismiss = output<void>();

  /** The overlays currently drawn, each with its measured box. */
  protected readonly placed = signal<readonly PlacedOverlay[]>([]);

  /** The layer's own element, measured to turn viewport coordinates into layer coordinates. */
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Re-measures when the scope or an observed anchor changes size. */
  private readonly resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
  /** The elements the resize observer currently watches. */
  private readonly observed = new Set<Element>();
  /** Anchors this layer set `inert` on — and so the only ones it may clear. */
  private readonly madeInert = new Set<HTMLElement>();
  /** The pending animation frame's handle, or `null` when no measure is queued. */
  private frame: number | null = null;

  /** Re-measures whenever `targets` or `scope` change, and on destroy cancels the pending frame,
   *  disconnects the resize observer and restores every anchor it made inert. */
  constructor() {
    effect(() => {
      this.targets();
      this.scope();
      this.scheduleMeasure();
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) {
        cancelAnimationFrame(this.frame);
      }
      this.resizeObserver.disconnect();
      this.observed.clear();
      this.syncInert(new Set());
    });
  }

  /** Queues one re-measure for the next animation frame; calls made before it runs coalesce. */
  protected scheduleMeasure(): void {
    if (this.frame !== null) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.measure();
    });
  }

  /** Resolves every target's anchor, places an overlay on each one found, and brings the inert
   *  and observed sets in line with them. */
  private measure(): void {
    const scope = this.scope();
    const layerRect = this.host.nativeElement.getBoundingClientRect();
    const anchors = new Set<HTMLElement>();
    const placed: PlacedOverlay[] = [];

    for (const target of this.targets()) {
      const anchor = scope.querySelector<HTMLElement>(target.anchor);
      if (!anchor) {
        continue;
      }
      anchors.add(anchor);
      const rect = anchor.getBoundingClientRect();
      placed.push({
        target,
        top: rect.top - layerRect.top - OVERLAY_INSET_PX,
        left: rect.left - layerRect.left - OVERLAY_INSET_PX,
        width: rect.width + OVERLAY_INSET_PX * 2,
        height: rect.height + OVERLAY_INSET_PX * 2,
      });
    }

    this.placed.set(placed);
    this.syncInert(anchors);
    this.syncObserved(new Set<Element>([scope, ...anchors]));
  }

  /** Makes `anchors` inert and releases every control this layer made inert that is not in it. A
   *  control that was already inert is left as it was found. */
  private syncInert(anchors: ReadonlySet<HTMLElement>): void {
    for (const anchor of this.madeInert) {
      if (!anchors.has(anchor)) {
        anchor.removeAttribute('inert');
        this.madeInert.delete(anchor);
      }
    }
    for (const anchor of anchors) {
      if (!this.madeInert.has(anchor) && !anchor.hasAttribute('inert')) {
        anchor.setAttribute('inert', '');
        this.madeInert.add(anchor);
      }
    }
  }

  /** Observes exactly `elements`. Observers are added and dropped incrementally rather than rebuilt:
   *  starting an observation reports once, which would re-trigger a measure forever. */
  private syncObserved(elements: ReadonlySet<Element>): void {
    for (const element of this.observed) {
      if (!elements.has(element)) {
        this.resizeObserver.unobserve(element);
        this.observed.delete(element);
      }
    }
    for (const element of elements) {
      if (!this.observed.has(element)) {
        this.resizeObserver.observe(element);
        this.observed.add(element);
      }
    }
  }
}
