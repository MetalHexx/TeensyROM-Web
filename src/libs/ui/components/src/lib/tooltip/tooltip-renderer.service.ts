import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { TooltipConfig, TooltipPosition, TooltipTitleColor } from './tooltip.directive';

/**
 * Tooltip Renderer Service
 *
 * Handles portal rendering of tooltips to document.body, intelligent position calculation
 * with overflow detection, and ARIA relationship management.
 *
 * This service is consumed by TooltipDirective to separate DOM manipulation concerns
 * from user interaction logic.
 *
 * @Injectable providedIn: 'root' - Singleton service
 */
@Injectable({ providedIn: 'root' })
export class TooltipRendererService {
  private renderer: Renderer2;
  private tooltipIdCounter = 0;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  /**
   * Creates a tooltip element, positions it relative to trigger element, and appends to document.body.
   *
   * Position calculation logic:
   * - Top/Bottom: Centered horizontally, positioned above/below (8px gap)
   * - Left/Right: Centered vertically, positioned left/right (8px gap)
   * - Flips if would overflow viewport
   *
   * @param config - The tooltip configuration (title, body, titleColor)
   * @param triggerElement - The DOM element that triggered the tooltip (for positioning)
   * @param position - Preferred position relative to trigger element
   * @returns The created tooltip HTMLElement
   */
  createTooltip(
    config: TooltipConfig,
    triggerElement: HTMLElement,
    position: TooltipPosition = TooltipPosition.Top
  ): HTMLElement {
    // Create tooltip element
    const tooltip = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setAttribute(tooltip, 'role', 'tooltip');
    this.renderer.addClass(tooltip, 'lib-tooltip');

    // Build title section if provided
    if (config.title && config.title.trim()) {
      const titleElement = this.renderer.createElement('div');
      this.renderer.addClass(titleElement, 'lib-tooltip__title');

      // Apply color class
      const colorClass =
        config.titleColor === TooltipTitleColor.Highlight
          ? 'lib-tooltip__title--highlight'
          : 'lib-tooltip__title--default';
      this.renderer.addClass(titleElement, colorClass);

      const titleText = this.renderer.createText(config.title);
      this.renderer.appendChild(titleElement, titleText);
      this.renderer.appendChild(tooltip, titleElement);
    }

    // Build body section if provided
    if (config.body && config.body.trim()) {
      const bodyElement = this.renderer.createElement('div');
      this.renderer.addClass(bodyElement, 'lib-tooltip__body');

      const bodyText = this.renderer.createText(config.body);
      this.renderer.appendChild(bodyElement, bodyText);
      this.renderer.appendChild(tooltip, bodyElement);
    }

    // Generate unique ID and establish ARIA relationship
    const tooltipId = `tooltip-${++this.tooltipIdCounter}`;
    this.renderer.setAttribute(tooltip, 'id', tooltipId);
    this.renderer.setAttribute(triggerElement, 'aria-describedby', tooltipId);

    // Apply positioning styles (visibility hidden for measurement, but element rendered)
    this.renderer.setStyle(tooltip, 'visibility', 'hidden');

    // Append to appropriate parent container
    // In fullscreen mode, append to the fullscreen element so tooltip is visible
    // Otherwise append to body
    const parentElement = document.fullscreenElement || document.body;
    this.renderer.appendChild(parentElement, tooltip);

    // Calculate position
    const calculatedPosition = this.calculatePosition(tooltip, triggerElement, position);

    // Apply final position
    this.renderer.setStyle(tooltip, 'left', `${calculatedPosition.left}px`);
    this.renderer.setStyle(tooltip, 'top', `${calculatedPosition.top}px`);

    // Make visible and trigger fade-in animation
    this.renderer.setStyle(tooltip, 'visibility', 'visible');
    this.renderer.addClass(tooltip, 'lib-tooltip--visible');

    return tooltip;
  }

  /**
   * Removes tooltip from DOM and cleans up ARIA relationships.
   *
   * @param tooltipElement - The tooltip element to remove
   * @param triggerElement - The trigger element (to clean up ARIA attributes)
   */
  destroyTooltip(tooltipElement: HTMLElement, triggerElement: HTMLElement): void {
    // Remove ARIA relationship
    this.renderer.removeAttribute(triggerElement, 'aria-describedby');

    // Trigger fade-out animation before removal
    this.renderer.removeClass(tooltipElement, 'lib-tooltip--visible');

    // Wait for animation to complete (150ms transition duration)
    setTimeout(() => {
      // Remove tooltip from its parent (body or fullscreen element)
      const parentElement = tooltipElement.parentElement;
      if (parentElement) {
        this.renderer.removeChild(parentElement, tooltipElement);
      }
    }, 150);
  }

  /**
   * Calculates the optimal position for the tooltip relative to the trigger element.
   *
   * Strategy:
   * 1. Get trigger element bounds
   * 2. Measure tooltip dimensions
   * 3. Calculate position based on preferred direction
   * 4. Flip if overflow detected
   * 5. Clamp to viewport bounds
   *
   * @private
   */
  private calculatePosition(
    tooltip: HTMLElement,
    triggerElement: HTMLElement,
    position: TooltipPosition
  ): { left: number; top: number } {
    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8; // 8px gap between trigger and tooltip

    let left: number;
    let top: number;

    switch (position) {
      case TooltipPosition.Top:
        // Center horizontally
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        // Position above
        top = triggerRect.top - tooltipRect.height - gap;
        // Check if tooltip would overflow above viewport
        if (top < 0) {
          // Flip to below
          top = triggerRect.bottom + gap;
        }
        break;

      case TooltipPosition.Bottom:
        // Center horizontally
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        // Position below
        top = triggerRect.bottom + gap;
        // Check if tooltip would overflow below viewport
        if (top + tooltipRect.height > window.innerHeight) {
          // Flip to above
          top = triggerRect.top - tooltipRect.height - gap;
        }
        break;

      case TooltipPosition.Left:
        // Position left of trigger
        left = triggerRect.left - tooltipRect.width - gap;
        // Center vertically
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        // Check if tooltip would overflow left viewport
        if (left < 0) {
          // Flip to right
          left = triggerRect.right + gap;
        }
        break;

      case TooltipPosition.Right:
        // Position right of trigger
        left = triggerRect.right + gap;
        // Center vertically
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        // Check if tooltip would overflow right viewport
        if (left + tooltipRect.width > window.innerWidth) {
          // Flip to left
          left = triggerRect.left - tooltipRect.width - gap;
        }
        break;
    }

    // Clamp horizontal position to viewport bounds
    if (left < 0) {
      left = 0;
    } else if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width;
    }

    // Clamp vertical position to viewport bounds (final safety check)
    if (top < 0) {
      top = 0;
    } else if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height;
    }

    return { left, top };
  }
}
