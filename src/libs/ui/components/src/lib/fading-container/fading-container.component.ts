import { Component, input, output, signal, computed, inject, Self, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
import type { AnimationParentMode } from '../shared/animation.types';
import { PARENT_ANIMATION_COMPLETE } from '../shared/animation-tokens';

/**
 * Simple opacity+blur fade animation wrapper — no transforms, no directional movement, no
 * layout impact. The lightest of the three animation containers.
 *
 * Because it uses no CSS transforms, this is the best choice for content styled with
 * `backdrop-filter` (glassy effects, see the `style-guide` skill): browsers render
 * `backdrop-filter` smoothly during opacity-only animation, avoiding the "blur pop-in"
 * artifact transform-based animation can cause. Use `ScalingContainerComponent` instead
 * when content should visually "pop" with a transform, or `SlidingContainerComponent` when
 * it should expand/collapse and push surrounding layout.
 *
 * Like the other animation containers, this component both consumes a parent's completion
 * signal (via `animationParent`) and provides its own via the `PARENT_ANIMATION_COMPLETE`
 * injection token, so components nested inside it can opt in to wait for it in turn. See
 * the Animation System entry for the full priority and opt-in mechanism.
 *
 * @example
 * ```html
 * <lib-fading-container [animationTrigger]="isVisible()">
 *   <div class="glassy-card">Blur renders smoothly — no transforms involved.</div>
 * </lib-fading-container>
 * ```
 */
@Component({
  selector: 'lib-fading-container',
  imports: [CommonModule],
  templateUrl: './fading-container.component.html',
  styleUrl: './fading-container.component.scss',
  host: {
    '[@fadeIn]': 'animationStateWithParams()',
    '(@fadeIn.done)': 'onAnimationDone()',
    '[class.visible]': 'animationState() === "visible"',
    '[class.hidden]': 'animationState() === "hidden"',
  },
  providers: [
    {
      provide: PARENT_ANIMATION_COMPLETE,
      useFactory: (self: FadingContainerComponent) => {
        // Always register self as a parent (children can opt-in to wait)
        return self.animationCompleteSignal.asReadonly();
      },
      deps: [[new Self(), FadingContainerComponent]],
    },
  ],
  animations: [
    trigger('fadeIn', [
      transition(
        'void => visible',
        [
          style({
            opacity: 0,
            filter: 'blur(10px)',
          }),
          animate(
            '{{ duration }}ms cubic-bezier(0.35, 0, 0.25, 1)',
            style({
              opacity: 1,
              filter: 'blur(0px)',
            })
          ),
        ],
        { params: { duration: 200 } }
      ),
      transition(
        'hidden => visible',
        [
          style({
            opacity: 0,
            filter: 'blur(10px)',
          }),
          animate(
            '{{ duration }}ms cubic-bezier(0.35, 0, 0.25, 1)',
            style({
              opacity: 1,
              filter: 'blur(0px)',
            })
          ),
        ],
        { params: { duration: 200 } }
      ),
      transition(
        'visible => hidden',
        [
          style({
            opacity: 1,
            filter: 'blur(0px)',
          }),
          animate(
            '{{ duration }}ms cubic-bezier(0.35, 0, 0.25, 1)',
            style({
              opacity: 0,
              filter: 'blur(10px)',
            })
          ),
        ],
        { params: { duration: 200 } }
      ),
    ]),
  ],
})
export class FadingContainerComponent {
  // Animation configuration inputs

  /** Manual entry/exit control. `true` plays the entry fade, `false` plays the exit fade and keeps the component visible until it completes; `undefined` (default) renders immediately with no explicit trigger. */
  animationTrigger = input<boolean | undefined>(undefined);

  /**
   * Animation duration in milliseconds (default: 200ms)
   */
  animationDuration = input<number>(200);

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

  /** Emitted each time the entry or exit fade finishes. */
  animationComplete = output<void>();

  /** Whether this container's most recent fade animation has finished; provided to nested containers via `PARENT_ANIMATION_COMPLETE`. */
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
  protected shouldRender = computed(() => {
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

  /** Angular animations state name (`'visible'`/`'hidden'`) derived from `shouldRender()`. */
  protected animationState = computed(() => {
    const shouldAnimate = this.shouldRender();
    return shouldAnimate ? 'visible' : 'hidden';
  });

  /** `animationState` bundled with the `duration` animation param, bound to the host's `@fadeIn` trigger. */
  protected animationStateWithParams = computed(() => ({
    value: this.animationState(),
    params: { duration: this.animationDuration() },
  }));

  /** Marks the animation complete, emits `animationComplete`, and removes the host from the DOM once the exit fade finishes. */
  onAnimationDone(): void {
    this.animationCompleteSignal.set(true);
    this.animationComplete.emit();

    // Remove from DOM after exit animation completes
    if (this.animationState() === 'hidden') {
      this.shouldBeInDom.set(false);
    }
  }

  /** Re-enters the host into the DOM before the entry animation starts whenever `shouldRender` flips to `true`. */
  constructor() {
    effect(() => {
      const shouldShow = this.shouldRender();

      // If we should show, ensure we're in the DOM before animation starts
      if (shouldShow) {
        this.shouldBeInDom.set(true);
      }
      // If we shouldn't show, the DOM removal happens in onAnimationDone after exit animation
    });
  }
}
