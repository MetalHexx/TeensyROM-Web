import { Component, input, output, signal, computed, inject, Self, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
import type { AnimationDirection, AnimationParentMode } from '../shared/animation.types';
import { PARENT_ANIMATION_COMPLETE } from '../shared/animation-tokens';

export type ContainerAnimationDirection = AnimationDirection | 'slide-down' | 'slide-up' | 'fade';

/**
 * Height/width expansion animation wrapper. Unlike the transform-based containers, this
 * one affects document flow — its content pushes and pulls surrounding elements as it
 * expands or collapses. Supports smooth entry and exit animations via `animationTrigger`.
 *
 * Reach for this component when the animated content should participate in layout (e.g. a
 * toolbar that pushes the page down as it slides in). Use `ScalingContainerComponent`
 * instead for a transform-based "pop" effect that never affects layout, or
 * `FadingContainerComponent` for a lightweight opacity-only fade — particularly when the
 * content uses `backdrop-filter` glassy styling, which renders more smoothly under
 * opacity-only animation than under transforms.
 *
 * Like the other animation containers, this component both consumes a parent's completion
 * signal (via `animationParent`) and provides its own via the `PARENT_ANIMATION_COMPLETE`
 * injection token, so components nested inside it can opt in to wait for it in turn. See
 * the Animation System entry for the full priority and opt-in mechanism.
 *
 * @example
 * ```html
 * <lib-sliding-container containerHeight="80px" animationDirection="from-top" [animationTrigger]="isVisible()">
 *   <div class="toolbar">Slides in and pushes content below it down.</div>
 * </lib-sliding-container>
 * ```
 */
@Component({
  selector: 'lib-sliding-container',
  imports: [CommonModule],
  templateUrl: './sliding-container.component.html',
  styleUrl: './sliding-container.component.scss',
  host: {
    '[class.visible]': 'animationParams.value === "visible"',
    '[class.hidden]': 'animationParams.value === "hidden"',
  },
  providers: [
    {
      provide: PARENT_ANIMATION_COMPLETE,
      useFactory: (self: SlidingContainerComponent) => {
        // Always register self as a parent (children can opt-in to wait)
        return self.animationCompleteSignal.asReadonly();
      },
      deps: [[new Self(), SlidingContainerComponent]],
    },
  ],
  animations: [
    trigger('containerAnimation', [
      transition(
        'void => visible',
        [
          style({
            opacity: 0,
            height: '{{ startHeight }}',
            width: '{{ startWidth }}',
            transform: '{{ startTransform }}',
          }),
          animate(
            '{{ duration }}ms {{ easing }}',
            style({
              opacity: 1,
              height: '{{ endHeight }}',
              width: '{{ endWidth }}',
              transform: '{{ endTransform }}',
            })
          ),
        ],
        {
          params: {
            startHeight: '0',
            endHeight: 'auto',
            startWidth: 'auto',
            endWidth: 'auto',
            startTransform: 'translateY(-20px)',
            endTransform: 'translateY(0)',
            duration: '400',
            easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
          },
        }
      ),
      transition(
        'hidden => visible',
        [
          style({
            opacity: 0,
            height: '{{ startHeight }}',
            width: '{{ startWidth }}',
            transform: '{{ startTransform }}',
          }),
          animate(
            '{{ duration }}ms {{ easing }}',
            style({
              opacity: 1,
              height: '{{ endHeight }}',
              width: '{{ endWidth }}',
              transform: '{{ endTransform }}',
            })
          ),
        ],
        {
          params: {
            startHeight: '0',
            endHeight: 'auto',
            startWidth: 'auto',
            endWidth: 'auto',
            startTransform: 'translateY(-20px)',
            endTransform: 'translateY(0)',
            duration: '400',
            easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
          },
        }
      ),
      transition(
        'visible => hidden',
        [
          animate(
            '{{ duration }}ms {{ easing }}',
            style({
              opacity: 0,
              height: '{{ startHeight }}',
              width: '{{ startWidth }}',
              transform: '{{ startTransform }}',
            })
          ),
        ],
        {
          params: {
            startHeight: '0',
            startWidth: 'auto',
            startTransform: 'translateY(-20px)',
            duration: '400',
            easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
          },
        }
      ),
    ]),
  ],
})
export class SlidingContainerComponent {
  // Animation configuration inputs

  /** Target height the container expands to on entry (default: `'auto'`). Any valid CSS height value (e.g. `'80px'`). */
  containerHeight = input<string>('auto');

  /** Target width the container expands to on entry (default: `'auto'`). Any valid CSS width value. */
  containerWidth = input<string>('auto');

  /** Duration of the expand/collapse animation in milliseconds (default: `400`). */
  animationDuration = input<number>(400);

  /**
   * Direction the container animates from on entry (default: `'from-top'`).
   * `'slide-down'` is an alias for `'from-top'` and `'slide-up'` for `'from-bottom'`;
   * `'fade'` expands with no directional slide, only an opacity transition.
   */
  animationDirection = input<ContainerAnimationDirection>('from-top');

  /** Manual entry/exit control. `true` plays the entry animation, `false` plays the exit animation and keeps the component in the DOM until it completes; `undefined` (default) renders immediately with no explicit trigger. */
  animationTrigger = input<boolean | undefined>(undefined);

  /**
   * Controls whether this component waits for parent animations:
   * - undefined (default): No waiting - component animates immediately
   * - 'auto': Opt-in to wait for nearest animation parent in DI tree
   * - AnimationParent: Wait for specific component (sibling, ancestor, or any component)
   * - null: No waiting - same as undefined
   *
   * Note: This component always registers as an animation parent for its children,
   * regardless of this setting. This input only controls waiting behavior.
   */
  animationParent = input<AnimationParentMode>(undefined);

  // Output events

  /** Emitted each time the entry or exit animation finishes. */
  animationComplete = output<void>();

  /** Whether this container's most recent expand/collapse animation has finished; provided to nested containers via `PARENT_ANIMATION_COMPLETE`. */
  animationCompleteSignal = signal(false);

  /** Whether the host element should stay rendered in the DOM (stays `true` through the exit animation, then flips to `false`). */
  private shouldBeInDom = signal(true);

  /** Read-only view of `shouldBeInDom` for the template. */
  protected shouldRenderInDom = this.shouldBeInDom.asReadonly();

  /** The nearest ancestor animation container's completion signal, if any. */
  private parentComplete = inject(PARENT_ANIMATION_COMPLETE, {
    optional: true,
    skipSelf: true,
  });

  /** Whether content should currently be shown, resolved from `animationTrigger`, then `animationParent`, defaulting to immediate render. */
  protected showContainer = computed(() => {
    const trigger = this.animationTrigger();

    // Priority 1: Explicit trigger (if defined)
    if (trigger !== undefined) {
      return trigger;
    }

    // Priority 2: Check animation parent mode
    const parentMode = this.animationParent();

    // If 'auto', wait for parent
    if (parentMode === 'auto' && this.parentComplete) {
      return this.parentComplete();
    }

    // If custom parent provided, wait for that parent
    if (parentMode && parentMode !== 'auto' && parentMode !== null) {
      return parentMode.animationCompleteSignal.asReadonly()();
    }

    // Priority 3: Default - render immediately (no chaining)
    return true;
  });

  /** Full Angular animations state (`value` + height/width/transform/duration `params`) bound to the host's `@containerAnimation` trigger. */
  get animationParams() {
    const shouldShow = this.showContainer();
    const direction = this.animationDirection();
    const duration = this.animationDuration();
    const height = this.containerHeight();
    const width = this.containerWidth();
    const { startHeight, endHeight, startWidth, endWidth, startTransform, endTransform } =
      this.getAnimationValues(direction, height, width);

    return {
      value: shouldShow ? 'visible' : 'hidden',
      params: {
        startHeight,
        endHeight,
        startWidth,
        endWidth,
        startTransform,
        endTransform,
        duration: duration.toString(),
        easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      },
    };
  }

  /** Marks the animation complete, emits `animationComplete`, and removes the host from the DOM once the exit animation finishes. */
  onContainerAnimationDone(): void {
    // Set internal signal for child components
    this.animationCompleteSignal.set(true);
    // Emit event for backward compatibility
    this.animationComplete.emit();

    // Remove from DOM after exit animation completes
    const currentState = this.animationParams;
    if (currentState && currentState.value === 'hidden') {
      this.shouldBeInDom.set(false);
    }
  }

  /** Re-enters the host into the DOM before the entry animation starts whenever `showContainer` flips to `true`. */
  constructor() {
    effect(() => {
      const shouldShow = this.showContainer();

      // If we should show, ensure we're in the DOM before animation starts
      if (shouldShow) {
        this.shouldBeInDom.set(true);
      }
      // If we shouldn't show, the DOM removal happens in onContainerAnimationDone after exit animation
    });
  }

  /** Resolves a direction (including `'random'`, recursively) to its start/end height, width, and transform animation values. */
  private getAnimationValues(
    direction: ContainerAnimationDirection,
    height: string,
    width: string
  ): {
    startHeight: string;
    endHeight: string;
    startWidth: string;
    endWidth: string;
    startTransform: string;
    endTransform: string;
  } {
    switch (direction) {
      case 'fade':
        return {
          startHeight: height,
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translate(0, 0)',
          endTransform: 'translate(0, 0)',
        };

      case 'slide-down':
      case 'from-top':
        return {
          startHeight: '0',
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translateY(-20px)',
          endTransform: 'translateY(0)',
        };

      case 'slide-up':
      case 'from-bottom':
        return {
          startHeight: '0',
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translateY(20px)',
          endTransform: 'translateY(0)',
        };

      case 'from-left':
        return {
          startHeight: height,
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translateX(-20px)',
          endTransform: 'translateX(0)',
        };

      case 'from-right':
        return {
          startHeight: height,
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translateX(20px)',
          endTransform: 'translateX(0)',
        };

      case 'from-top-left':
        return {
          startHeight: '0',
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translate(-20px, -20px)',
          endTransform: 'translate(0, 0)',
        };

      case 'from-top-right':
        return {
          startHeight: '0',
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translate(20px, -20px)',
          endTransform: 'translate(0, 0)',
        };

      case 'from-bottom-left':
        return {
          startHeight: '0',
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translate(-20px, 20px)',
          endTransform: 'translate(0, 0)',
        };

      case 'from-bottom-right':
        return {
          startHeight: '0',
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translate(20px, 20px)',
          endTransform: 'translate(0, 0)',
        };

      case 'none':
        return {
          startHeight: height,
          endHeight: height,
          startWidth: width,
          endWidth: width,
          startTransform: 'translate(0, 0)',
          endTransform: 'translate(0, 0)',
        };

      case 'random': {
        const directions: ContainerAnimationDirection[] = [
          'from-left',
          'from-right',
          'from-top',
          'from-bottom',
          'from-top-left',
          'from-top-right',
          'from-bottom-left',
          'from-bottom-right',
        ];
        const randomDir = directions[Math.floor(Math.random() * directions.length)];
        return this.getAnimationValues(randomDir, height, width);
      }

      default:
        return this.getAnimationValues('from-top', height, width);
    }
  }
}
