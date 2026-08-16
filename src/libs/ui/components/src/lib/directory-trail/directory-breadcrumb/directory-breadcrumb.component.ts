import {
  Component,
  input,
  output,
  computed,
  signal,
  effect,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { DropdownMenuComponent } from '../../dropdown-menu/dropdown-menu.component';
import { DropdownMenuItemComponent } from '../../dropdown-menu/dropdown-menu-item.component';
import { IconButtonComponent } from '../../icon-button/icon-button.component';

interface PathSegment {
  label: string;
  path: string;
}

/**
 * A responsive breadcrumb trail for the current directory path. Splits `currentPath` into
 * clickable chips (root segment labeled with `storageType`, then one chip per path part),
 * measures available width, and collapses leading segments that no longer fit behind a
 * dropdown trigger rather than wrapping or truncating.
 *
 * `lib-directory-breadcrumb` is normally rendered by `DirectoryTrailComponent` as the
 * right-hand half of the directory toolbar; render it directly only when a surface needs
 * just the path trail without the trail's back/forward/up/refresh controls.
 *
 * @example
 * ```html
 * <lib-directory-breadcrumb
 *   [currentPath]="currentPath()"
 *   [storageType]="storageTypeLabel()"
 *   (navigationRequested)="onNavigate($event)"
 * ></lib-directory-breadcrumb>
 * ```
 */
@Component({
  selector: 'lib-directory-breadcrumb',
  standalone: true,
  imports: [MatChipsModule, DropdownMenuComponent, DropdownMenuItemComponent, IconButtonComponent],
  templateUrl: './directory-breadcrumb.component.html',
  styleUrl: './directory-breadcrumb.component.scss',
})
export class DirectoryBreadcrumbComponent implements AfterViewInit, OnDestroy {
  // Inputs
  /** The absolute path to render as breadcrumb segments, e.g. `/games/arcade`. `/` or `''` renders only the root segment. */
  currentPath = input.required<string>();
  /** Label for the root segment representing the storage device, e.g. `'SD Card'`. */
  storageType = input.required<string>();

  // Outputs
  /** Emitted with the absolute path of whichever segment (visible chip or hidden-segment menu item) the user clicked. */
  navigationRequested = output<string>();

  // View references
  private breadcrumbContainer = viewChild<ElementRef<HTMLDivElement>>('breadcrumbContainer');
  private measureContainer = viewChild<ElementRef<HTMLDivElement>>('measureContainer');

  // Signals for responsive behavior
  private resizeObserver: ResizeObserver | null = null;
  visibleSegments = signal<PathSegment[]>([]);
  hiddenSegments = signal<PathSegment[]>([]);

  // Computed segments
  pathSegments = computed(() => this.calculatePathSegments());

  hasHiddenSegments = computed(() => this.hiddenSegments().length > 0);

  constructor() {
    // Update visible/hidden segments when path changes
    effect(() => {
      const segments = this.pathSegments();
      // Initially show all segments until measurement is done
      this.visibleSegments.set(segments);
      this.hiddenSegments.set([]);
      // Recalculate after DOM update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.calculateVisibleSegments());
      });
    });
  }

  ngAfterViewInit(): void {
    // Set up ResizeObserver to detect container width changes
    const container = this.breadcrumbContainer()?.nativeElement;
    if (!container) return;

    // ResizeObserver is not available in jsdom by default (unit tests)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.calculateVisibleSegments());
        });
      });
      this.resizeObserver.observe(container);
    }

    // Initial calculation with delay (covers first paint)
    setTimeout(() => this.calculateVisibleSegments(), 0);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  onChipClick(path: string): void {
    this.navigationRequested.emit(path);
  }

  onHiddenSegmentClick(path: string): void {
    this.navigationRequested.emit(path);
  }

  private calculateVisibleSegments(): void {
    const container = this.breadcrumbContainer()?.nativeElement;
    const measure = this.measureContainer()?.nativeElement;
    if (!container || !measure) return;

    const segments = this.pathSegments();
    if (segments.length === 0) {
      this.visibleSegments.set([]);
      this.hiddenSegments.set([]);
      return;
    }

    const availableWidth = container.clientWidth;

    // Measure each chip + separator from the hidden measuring row (always full path)
    const chips = Array.from(measure.querySelectorAll('.measure-chip')) as HTMLElement[];
    const separators = Array.from(measure.querySelectorAll('.breadcrumb-separator')) as HTMLElement[];

    if (chips.length !== segments.length) return;

    // First try: can we show the full path with no prefix trigger?
    const fullVisibleCount = this.calculateVisibleCount({
      availableWidth,
      chips,
      separators,
      prefixReserve: 0,
    });

    if (fullVisibleCount === segments.length) {
      this.hiddenSegments.set([]);
      this.visibleSegments.set(segments);
      return;
    }

    // We need a prefix trigger (folder icon) + separator. Measure if present, otherwise estimate.
    const triggerEl = container.querySelector('.hidden-trigger') as HTMLElement | null;
    const triggerReserveEstimate = 56; // conservative estimate for medium icon-button + layout
    const separatorReserve = separators[0] ? this.outerWidth(separators[0]) : 24;
    const prefixReserve = (triggerEl ? this.outerWidth(triggerEl) : triggerReserveEstimate) + separatorReserve;

    const visibleCount = this.calculateVisibleCount({
      availableWidth,
      chips,
      separators,
      prefixReserve,
    });

    // Split segments into visible and hidden
    const hiddenCount = segments.length - visibleCount;
    this.hiddenSegments.set(segments.slice(0, hiddenCount));
    this.visibleSegments.set(segments.slice(hiddenCount));
  }

  private calculateVisibleCount(params: {
    availableWidth: number;
    chips: HTMLElement[];
    separators: HTMLElement[];
    prefixReserve: number;
  }): number {
    const { availableWidth, chips, separators, prefixReserve } = params;

    const budget = Math.max(0, availableWidth - prefixReserve);
    let cumulativeWidth = 0;
    let visibleCount = 0;

    for (let i = chips.length - 1; i >= 0; i--) {
      const chipWidth = this.outerWidth(chips[i]);
      const sepWidth = i < chips.length - 1 ? this.outerWidth(separators[i]) : 0;
      const segmentWidth = chipWidth + sepWidth;

      // Always show at least 1 segment
      if (visibleCount > 0 && cumulativeWidth + segmentWidth > budget) break;

      cumulativeWidth += segmentWidth;
      visibleCount++;
    }

    return Math.max(1, visibleCount);
  }

  private outerWidth(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const marginLeft = Number.parseFloat(style.marginLeft) || 0;
    const marginRight = Number.parseFloat(style.marginRight) || 0;
    return element.offsetWidth + marginLeft + marginRight;
  }

  private calculatePathSegments(): PathSegment[] {
    const path = this.currentPath();
    const storageTypeLabel = this.storageType();

    // Handle root case
    if (path === '/' || path === '') {
      return [{ label: storageTypeLabel, path: '/' }];
    }

    const segments: PathSegment[] = [{ label: storageTypeLabel, path: '/' }];

    // Split path and build cumulative segments
    const pathParts = path.split('/').filter((part) => part.length > 0);
    let currentPath = '';

    for (const part of pathParts) {
      currentPath += '/' + part;
      segments.push({
        label: part,
        path: currentPath,
      });
    }

    return segments;
  }
}
