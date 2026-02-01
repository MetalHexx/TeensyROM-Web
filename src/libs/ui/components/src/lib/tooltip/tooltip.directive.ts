import { Directive, ElementRef, HostListener, OnDestroy, inject, input } from '@angular/core';
import { TooltipRendererService } from './tooltip-renderer.service';
import { PreferencesService } from '@teensyrom-nx/ui/styles';

/**
 * Tooltip positioning options
 */
export enum TooltipPosition {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right'
}

/**
 * Tooltip title color options
 */
export enum TooltipTitleColor {
  Default = 'default',
  Highlight = 'highlight'
}

/**
 * Tooltip configuration object
 */
export interface TooltipConfig {
  /**
   * Optional title text displayed at the top of the tooltip.
   * Larger font size and heavier weight than body text.
   */
  title?: string;

  /**
   * Optional title color. Defaults to on-surface color if not specified.
   * @default TooltipTitleColor.Default
   */
  titleColor?: TooltipTitleColor;

  /**
   * Body text content.
   * Required - tooltip must have at least title or body (or both).
   */
  body?: string;

  /**
   * Tooltip position relative to trigger element.
   * @default TooltipPosition.Top
   */
  position?: TooltipPosition;

  /**
   * Delay in milliseconds before tooltip appears.
   * @default 500
   */
  delay?: number;

  /**
   * Whether to always show this tooltip, ignoring user preferences.
   * Use sparingly for critical UI hints (e.g., tooltip toggle button).
   * @default false
   */
  alwaysShow?: boolean;
}

/**
 * Tooltip Directive
 *
 * Provides tooltip functionality via attribute directive. Displays tooltip on mouse hover
 * and delegates rendering to TooltipRendererService.
 *
 * @example
 * <button [libTooltip]="{ body: 'Click to save', position: TooltipPosition.Bottom }">Save</button>
 *
 * @example
 * <button [libTooltip]="{ title: 'Save', titleColor: TooltipTitleColor.Highlight, body: 'Click to save changes', position: TooltipPosition.Top }">Save</button>
 */
@Directive({
  selector: '[libTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  private tooltipRendererService = inject(TooltipRendererService);
  private elementRef = inject(ElementRef);
  private preferencesService = inject(PreferencesService);
  private currentTooltip: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Tooltip configuration (optional - no tooltip shown if undefined)
   */
  libTooltip = input<TooltipConfig | undefined>();

  /**
   * Shows tooltip on mouse enter (with delay)
   */
  @HostListener('mouseenter')
  showTooltip(): void {
    const config = this.libTooltip();

    // Don't show if tooltips are globally disabled (unless alwaysShow is true)
    if (!config?.alwaysShow && !this.preferencesService.tooltipsEnabled()) {
      return;
    }

    // Don't show if no title and no body
    if (!config?.title && !config?.body) {
      return;
    }

    // Don't show if already showing
    if (this.currentTooltip) {
      return;
    }

    // Clear any existing timeout
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }

    // Use configured delay or default to 500ms (industry standard)
    const delay = config.delay ?? 500;

    this.showTimeout = setTimeout(() => {
      this.currentTooltip = this.tooltipRendererService.createTooltip(
        config,
        this.elementRef.nativeElement,
        config.position ?? TooltipPosition.Top
      );
      this.showTimeout = null;
    }, delay);
  }

  /**
   * Hides tooltip on mouse leave and cancels pending display
   */
  @HostListener('mouseleave')
  hideTooltip(): void {
    // Cancel pending tooltip display
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    // Hide current tooltip if visible
    if (!this.currentTooltip) {
      return;
    }

    this.tooltipRendererService.destroyTooltip(
      this.currentTooltip,
      this.elementRef.nativeElement
    );
    this.currentTooltip = null;
  }

  /**
   * Cleanup: Ensures tooltip is destroyed and timeouts cleared
   */
  ngOnDestroy(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    if (this.currentTooltip) {
      this.hideTooltip();
    }
  }
}
