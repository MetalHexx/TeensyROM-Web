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
 * Static card layout with an optional header (title, subtitle, and a `header` content
 * slot), a `corner` slot for status indicators or close buttons, a default body slot, and
 * an optional footer attribution line. No animation — pure layout and glassy backdrop
 * styling.
 *
 * Reach for this component when a card should render without an entry/exit animation —
 * e.g. content that's already on screen, or content whose transition is driven by
 * something else. Use `ScalingCardComponent` instead when the card should animate in and
 * out with the library's scale+fade+slide effect; it composes this component with
 * `ScalingContainerComponent`. For compact, header-less cards (forms, toolbars) use
 * `CompactCardLayoutComponent` (or its animated counterpart, `ScalingCompactCardComponent`).
 *
 * The glassy backdrop effect (enabled by default) is built from design tokens documented
 * in the `style-guide` skill — see `glassyIntensity` below for what each level means.
 *
 * **Header Slot**: Project custom content into the card header using `slot="header"`.
 * This content appears above the title/subtitle when both are provided.
 *
 * @example
 * ```html
 * <lib-card-layout title="File Info" subtitle="v1.2.3" glassyIntensity="strong">
 *   <mat-chip slot="corner">C64</mat-chip>
 *   <button slot="header" mat-icon-button><mat-icon>arrow_back</mat-icon></button>
 *   <p>Card content projected into the default slot.</p>
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
  /** Header title text. Omit to render a title-less header (e.g. `header`-slot-only content). */
  title = input<string>();

  /** Text rendered below the title inside the header, when provided. */
  subtitle = input<string>();

  /** Footer attribution text (e.g. a source URL or credit). Rendered in a dedicated footer row only when set; the footer is omitted entirely otherwise. */
  metadataSource = input<string>();

  /** Whether the card content area shows scrollbars when its content overflows (default: `true`). Set to `false` to clip overflow instead. */
  enableOverflow = input<boolean>(true);

  /** Additional CSS class name(s) applied to the underlying `mat-card`, alongside the computed glassy classes. */
  cardClass = input<string>('');

  /**
   * Enable/disable the glassy backdrop effect (default: `true`).
   * Set to `false` to disable glassy styling entirely.
   */
  glassy = input<boolean>(true);

  /**
   * Glassy effect intensity (default: `'dark'`). Only applies when `glassy` is `true`.
   * See the `style-guide` skill for the full design-token reference.
   * - `'subtle'`: 5% white opacity — barely visible tint
   * - `'light'`: 7.5% white opacity — gentle glassy effect
   * - `'medium'`: 15% white opacity — balanced glassy effect
   * - `'strong'`: 20% white opacity — prominent glassy effect
   * - `'dark'`: 40% black opacity — dark semi-transparent glass (recommended default)
   * - `'default'`: uses the `.glassy-card` utility class (40% black opacity + Material tokens)
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

    // Corresponds to --spacing-sm (8px) — reserve buffer for corner content positioning
    const bufferPx = 8;
    this.cornerReservePx.set(Math.ceil(cornerElement.offsetWidth + bufferPx));
  }
}
