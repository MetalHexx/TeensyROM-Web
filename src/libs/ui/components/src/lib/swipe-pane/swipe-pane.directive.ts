import { Directive, inject, input, TemplateRef } from '@angular/core';

/**
 * Marks an `<ng-template>` as one swipeable pane for `SwipePaneContainerComponent`. The
 * directive itself renders nothing — it only captures the template's `TemplateRef` (via
 * `contentChildren(SwipePaneDirective)` on the container) and an optional `label` used for
 * the container's pagination dots. Apply it to `<ng-template>`, not a normal element,
 * since the container is what decides which pane's content actually renders.
 *
 * @example
 * ```html
 * <lib-swipe-pane-container>
 *   <ng-template libSwipePane label="Overview">
 *     <div>Overview content</div>
 *   </ng-template>
 *   <ng-template libSwipePane label="Settings">
 *     <div>Settings content</div>
 *   </ng-template>
 * </lib-swipe-pane-container>
 * ```
 */
@Directive({
  selector: '[libSwipePane]',
  standalone: true,
})
export class SwipePaneDirective {
  /** The captured template, read by `SwipePaneContainerComponent` via `contentChildren`. */
  readonly templateRef = inject(TemplateRef);

  /**
   * Text shown in the container's pagination-dot navigation for this pane
   * (default: `''` — no label rendered).
   */
  readonly label = input<string>('');
}
