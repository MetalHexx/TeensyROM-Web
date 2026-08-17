import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AnimationDirection, AnimationParentMode } from '../shared/animation.types';
import { ScalingContainerComponent } from '../scaling-container/scaling-container.component';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';
import { PARENT_ANIMATION_COMPLETE } from '../shared/animation-tokens';

/**
 * Animated compact card — the public-facing wrapper for compact surfaces (forms,
 * toolbars) that should animate in and out. Composes `CompactCardLayoutComponent` (body
 * slot only, no header) with `ScalingContainerComponent` (scale+fade+slide entry/exit) in
 * a single component, and inherits the glassy backdrop effect from
 * `CompactCardLayoutComponent`.
 *
 * Reach for this component — rather than `CompactCardLayoutComponent` — whenever the
 * compact surface should animate. Use `CompactCardLayoutComponent` directly instead when
 * it must render without any animation. For cards that need a header (title, subtitle,
 * corner slot) use `ScalingCardComponent` (or its static counterpart,
 * `CardLayoutComponent`).
 *
 * This component doesn't register as an animation parent itself — its inner
 * `ScalingContainerComponent` does — but it forwards `animationParent` so children
 * projected into its slot can still opt in to the `PARENT_ANIMATION_COMPLETE` chain. See
 * the animation-chaining system entry for the full mechanism.
 *
 * @example
 * ```html
 * <lib-scaling-compact-card animationEntry="from-top">
 *   <mat-form-field><input matInput /></mat-form-field>
 * </lib-scaling-compact-card>
 * ```
 */
@Component({
  selector: 'lib-scaling-compact-card',
  imports: [CommonModule, ScalingContainerComponent, CompactCardLayoutComponent],
  templateUrl: './scaling-compact-card.component.html',
  styleUrl: './scaling-compact-card.component.scss',
})
export class ScalingCompactCardComponent {
  // Compact card layout inputs

  /** Whether the card content area shows scrollbars when its content overflows (default: `true`). */
  enableOverflow = input<boolean>(true);

  /** Additional CSS class name(s) applied to the inner card, alongside its computed glassy classes. */
  cardClass = input<string>('');

  // Animation inputs

  /** Direction the card animates in from (default: `'random'`). See `ScalingContainerComponent` for the full direction set and what each value means. */
  animationEntry = input<AnimationDirection>('random');

  /** Direction the card animates out toward when its exit animation plays (default: `'random'`). */
  animationExit = input<AnimationDirection>('random');

  /** Manual entry/exit control. `true` plays the entry animation, `false` plays the exit animation and keeps the component visible until it completes; `undefined` (default) renders immediately with no explicit trigger. */
  animationTrigger = input<boolean | undefined>(undefined);

  /**
   * Animation duration in milliseconds for transform animation (default: 2000ms)
   * Opacity animation runs 1.5x this duration for smooth fade
   */
  animationDuration = input<number>(2000);

  /**
   * Controls whether this component waits for parent animations:
   * - undefined (default): No waiting - component animates immediately
   * - 'auto': Opt-in to wait for nearest animation parent in DI tree
   * - AnimationParent: Wait for specific component (sibling, ancestor, or any component)
   * - null: No waiting - same as undefined
   *
   * Note: Composed components don't register as animation parents themselves,
   * but they pass this setting to their internal animation container.
   */
  animationParent = input<AnimationParentMode>(undefined);

  /** The nearest ancestor animation container's completion signal, if any. */
  private parentComplete = inject(PARENT_ANIMATION_COMPLETE, {
    optional: true,
    skipSelf: true,
  });

  /** Value passed through to the inner `ScalingContainerComponent`'s `animationTrigger`, resolved from `animationTrigger()`, then `animationParent()`, defaulting to immediate render. */
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
}
