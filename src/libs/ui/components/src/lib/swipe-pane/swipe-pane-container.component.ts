import {
  Component,
  ChangeDetectionStrategy,
  contentChildren,
  viewChild,
  ElementRef,
  input,
  output,
  signal,
  afterNextRender,
  inject,
  DestroyRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SwipePaneDirective } from './swipe-pane.directive';

const TOUCH_DEVICE_QUERY = '(hover: none)';

@Component({
  selector: 'lib-swipe-pane-container',
  standalone: true,
  imports: [NgTemplateOutlet, MatIconModule],
  templateUrl: './swipe-pane-container.component.html',
  styleUrl: './swipe-pane-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwipePaneContainerComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

  readonly panes = contentChildren(SwipePaneDirective);
  readonly initialPane = input<number>(0);
  readonly activePaneChange = output<number>();

  protected readonly isTouchDevice = toSignal(
    this.breakpointObserver.observe(TOUCH_DEVICE_QUERY).pipe(map(r => r.matches)),
    { initialValue: false }
  );

  protected readonly activePane = signal(0);
  protected readonly swipeContainer = viewChild<ElementRef<HTMLElement>>('swipeContainer');
  protected readonly isSwiping = signal(false);
  protected readonly showNav = signal(false);

  private swipeTimeout: ReturnType<typeof setTimeout> | null = null;
  private navShowTimeout: ReturnType<typeof setTimeout> | null = null;
  private navHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private navAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private hoveringNavControl = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearAllTimeouts());

    afterNextRender(() => {
      const container = this.swipeContainer()?.nativeElement;
      if (!container) return;

      const initial = this.initialPane();
      if (initial > 0) {
        container.scrollLeft = initial * container.clientWidth;
      }
      this.activePane.set(initial);
      this.setupSwipeTracking();
    });
  }

  private setupSwipeTracking(): void {
    const container = this.swipeContainer()?.nativeElement;
    if (!container) return;

    container.addEventListener(
      'scroll',
      () => {
        const scrollLeft = container.scrollLeft;
        const width = container.clientWidth;
        const newPane = Math.round(scrollLeft / width);
        if (this.activePane() !== newPane) {
          this.activePane.set(newPane);
          this.activePaneChange.emit(newPane);
        }

        this.isSwiping.set(true);
        if (this.swipeTimeout) clearTimeout(this.swipeTimeout);
        this.swipeTimeout = setTimeout(() => this.isSwiping.set(false), 1200);
      },
      { passive: true }
    );
  }

  scrollToPane(index: number): void {
    const container = this.swipeContainer()?.nativeElement;
    if (!container) return;

    this.activePane.set(index);
    this.activePaneChange.emit(index);

    container.style.scrollSnapType = 'none';

    container.scrollTo({
      left: index * container.clientWidth,
      behavior: 'smooth',
    });

    const restoreSnap = () => {
      container.style.scrollSnapType = '';
      container.removeEventListener('scrollend', restoreSnap);
      clearTimeout(fallback);
    };
    container.addEventListener('scrollend', restoreSnap, { once: true });
    const fallback = setTimeout(restoreSnap, 600);
  }

  scrollToNextPane(): void {
    const maxPane = this.panes().length - 1;
    if (this.activePane() < maxPane) {
      this.scrollToPane(this.activePane() + 1);
    }
  }

  scrollToPreviousPane(): void {
    if (this.activePane() > 0) {
      this.scrollToPane(this.activePane() - 1);
    }
  }

  onSwipeAreaMouseEnter(): void {
    if (this.isTouchDevice()) return;
    if (this.navHideTimeout) {
      clearTimeout(this.navHideTimeout);
      this.navHideTimeout = null;
    }
    this.navShowTimeout = setTimeout(() => {
      this.showNav.set(true);
      this.startAutoHideTimer();
    }, 400);
  }

  onSwipeAreaMouseLeave(): void {
    if (this.isTouchDevice()) return;
    if (this.navShowTimeout) {
      clearTimeout(this.navShowTimeout);
      this.navShowTimeout = null;
    }
    if (this.navAutoHideTimeout) {
      clearTimeout(this.navAutoHideTimeout);
      this.navAutoHideTimeout = null;
    }
    this.navHideTimeout = setTimeout(() => {
      if (!this.hoveringNavControl) {
        this.showNav.set(false);
      }
    }, 300);
  }

  onSwipeAreaMouseMove(): void {
    if (this.isTouchDevice()) return;
    if (!this.showNav()) {
      this.showNav.set(true);
    }
    this.startAutoHideTimer();
  }

  onNavControlEnter(): void {
    this.hoveringNavControl = true;
    if (this.navHideTimeout) {
      clearTimeout(this.navHideTimeout);
      this.navHideTimeout = null;
    }
    if (this.navAutoHideTimeout) {
      clearTimeout(this.navAutoHideTimeout);
      this.navAutoHideTimeout = null;
    }
  }

  onNavControlLeave(): void {
    this.hoveringNavControl = false;
    this.startAutoHideTimer();
  }

  private startAutoHideTimer(): void {
    if (this.navAutoHideTimeout) {
      clearTimeout(this.navAutoHideTimeout);
    }
    if (this.hoveringNavControl) return;
    this.navAutoHideTimeout = setTimeout(() => {
      this.showNav.set(false);
    }, 2500);
  }

  private clearAllTimeouts(): void {
    if (this.swipeTimeout) clearTimeout(this.swipeTimeout);
    if (this.navShowTimeout) clearTimeout(this.navShowTimeout);
    if (this.navHideTimeout) clearTimeout(this.navHideTimeout);
    if (this.navAutoHideTimeout) clearTimeout(this.navAutoHideTimeout);
  }
}
