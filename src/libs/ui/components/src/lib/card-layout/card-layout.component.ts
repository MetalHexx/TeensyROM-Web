import {
  Component,
  input,
  computed,
  ViewEncapsulation,
  ElementRef,
  viewChild,
  signal,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import type { GlassyIntensity } from '../shared/glassy.types';

/**
 * Card layout component with support for title, subtitle, corner slot, and header slot.
 * 
 * **Header Slot**: Project custom content into the card header using `slot="header"`.
 * This content appears above the title/subtitle when both are provided.
 * 
 * @example
 * ```html
 * <lib-card-layout title="Card Title">
 *   <custom-nav slot="header"></custom-nav>
 *   <p>Card content...</p>
 * </lib-card-layout>
 * ```
 */
@Component({
  selector: 'lib-card-layout',
  imports: [CommonModule, MatCardModule],
  templateUrl: './card-layout.component.html',
  styleUrl: './card-layout.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.no-overflow]': 'enableOverflow() === false',
    '[style.--card-layout-corner-reserve.px]': 'cornerReservePx()',
  },
})
export class CardLayoutComponent implements AfterViewInit, OnDestroy {
  title = input<string>();
  subtitle = input<string>();
  metadataSource = input<string>();
  enableOverflow = input<boolean>(true);
  cardClass = input<string>(''); // Optional CSS class(es) to apply to the mat-card
  
  /**
   * Enable/disable glassy backdrop effect (default: true)
   * Set to false to disable glassy styling entirely
   */
  glassy = input<boolean>(true);
  
  /**
   * Glassy effect intensity (default: 'dark')
   * Options: 'subtle', 'light', 'medium', 'strong', 'dark', 'default'
   * Only applies when glassy=true
   */
  glassyIntensity = input<GlassyIntensity>('dark');

  private readonly cornerContent = viewChild<ElementRef<HTMLDivElement>>('cornerContent');
  private cornerResizeObserver: ResizeObserver | null = null;
  protected cornerReservePx = signal(0);
  
  /**
   * Computed CSS classes for the mat-card
   */
  protected computedCardClass = computed(() => {
    const classes: string[] = [];
    
    // Add custom cardClass if provided
    if (this.cardClass()) {
      classes.push(this.cardClass());
    }
    
    // Add glassy classes if enabled
    if (this.glassy()) {
      const intensity = this.glassyIntensity();
      if (intensity === 'default') {
        classes.push('glassy-card');
      } else {
        classes.push(`glassy-${intensity}`);
        classes.push('elevated-card');
      }
    }
    
    return classes.join(' ');
  });

  ngAfterViewInit(): void {
    this.updateCornerReserve();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const cornerElement = this.cornerContent()?.nativeElement;
    if (!cornerElement) {
      return;
    }

    this.cornerResizeObserver = new ResizeObserver(() => {
      this.updateCornerReserve();
    });

    this.cornerResizeObserver.observe(cornerElement);
  }

  ngOnDestroy(): void {
    this.cornerResizeObserver?.disconnect();
    this.cornerResizeObserver = null;
  }

  private updateCornerReserve(): void {
    const cornerElement = this.cornerContent()?.nativeElement;
    if (!cornerElement) {
      this.cornerReservePx.set(0);
      return;
    }

    const hasProjectedContent = cornerElement.childElementCount > 0;
    if (!hasProjectedContent) {
      this.cornerReservePx.set(0);
      return;
    }

    const bufferPx = 8;
    this.cornerReservePx.set(Math.ceil(cornerElement.offsetWidth + bufferPx));
  }
}
