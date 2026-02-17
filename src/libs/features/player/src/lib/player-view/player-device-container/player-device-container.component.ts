import { Component, input, computed, inject, effect, untracked, signal, viewChild, ElementRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Device } from '@teensyrom-nx/domain';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCompactCardComponent, SwipePaneContainerComponent, SwipePaneDirective } from '@teensyrom-nx/ui/components';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { FileImageComponent } from './file-image/file-image.component';
import { FileDescriptionComponent } from './file-description/file-description.component';
import { VideoCaptureComponent } from './video-capture/video-capture.component';
import { PlayerToolbarComponent } from './player-toolbar/player-toolbar.component';
import { PlayerToolbarActionsComponent } from './player-toolbar/player-toolbar-actions/player-toolbar-actions.component';
import { FilterToolbarComponent } from './storage-container/filter-toolbar/filter-toolbar.component';
import { StorageContainerComponent } from './storage-container/storage-container.component';
import { FileDescriptionMiniComponent } from './file-description-mini/file-description-mini.component';
import { PlayerToolbarMiniComponent } from './player-toolbar-mini/player-toolbar-mini.component';
import { PLAYER_CONTEXT, SettingsStore } from '@teensyrom-nx/application';

const PHONE_BREAKPOINT = '(max-width: 639px)';
const TOUCH_DEVICE_QUERY = '(hover: none)';

@Component({
  selector: 'lib-player-device-container',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    FileImageComponent,
    FileDescriptionComponent,
    VideoCaptureComponent,
    PlayerToolbarComponent,
    FilterToolbarComponent,
    StorageContainerComponent,
    FileDescriptionMiniComponent,
    PlayerToolbarMiniComponent,
    ScalingCompactCardComponent,
    SwipePaneContainerComponent,
    SwipePaneDirective,
    PlayerToolbarActionsComponent,
  ],
  templateUrl: './player-device-container.component.html',
  styleUrl: './player-device-container.component.scss',
})
export class PlayerDeviceContainerComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);
  private readonly settingsStore = inject(SettingsStore);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly isPhone = toSignal(
    this.breakpointObserver.observe(PHONE_BREAKPOINT).pipe(
      map(result => result.matches)
    ),
    { initialValue: false }
  );

  protected readonly isTouchDevice = toSignal(
    this.breakpointObserver.observe(TOUCH_DEVICE_QUERY).pipe(
      map(result => result.matches)
    ),
    { initialValue: false }
  );

  protected readonly activePane = signal(1);
  protected readonly swipeContainer = viewChild<ElementRef<HTMLElement>>('swipeContainer');
  protected readonly swipeReady = signal(false);
  protected readonly isSwiping = signal(false);
  protected readonly showPaneNav = signal(false);
  private swipeTimeout: ReturnType<typeof setTimeout> | null = null;
  private paneNavShowTimeout: ReturnType<typeof setTimeout> | null = null;
  private paneNavHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private paneNavAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private hoveringNavControl = false;

  protected readonly paneIndicators = computed(() => {
    if (this.isPhone()) {
      const panes = [
        { label: 'Show storage', index: 0 },
        { label: 'Show image', index: 1 },
        { label: 'Show description', index: 2 },
      ];
      if (this.enableVideo()) {
        panes.push({ label: 'Show video', index: 3 });
      }
      return panes;
    }
    // Desktop: only show indicators when video is enabled (image + description + video)
    if (this.enableVideo()) {
      return [
        { label: 'Show image', index: 0 },
        { label: 'Show description', index: 1 },
        { label: 'Show video', index: 2 },
      ];
    }
    return [];
  });

  device = input<Device>();

  readonly deviceId = computed(() => this.device()?.deviceId ?? '');

  /**
   * Whether video capture is enabled for this device.
   * Controls visibility of video capture component.
   * Uses per-device settings - returns false if device not found (safe default).
   */
  readonly enableVideo = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return false;
    return this.settingsStore.enableVideoForDevice(deviceId)();
  });

  constructor() {
    // Initialize player state when device container mounts
    // This ensures default filter from settings is applied for:
    // 1. Devices already connected at startup
    // 2. Devices that connect after app startup
    // Uses ensurePlayerState guard internally - won't overwrite existing state
    // Note: untracked() prevents initialization from triggering reactive loops
    // when handleDeepLinking updates store signals
    effect(() => {
      const deviceId = this.deviceId();
      if (deviceId) {
        untracked(() => {
          this.playerContext.initializePlayer(deviceId);
        });
      }
    });

    afterNextRender(() => {
      const container = this.swipeContainer()?.nativeElement;
      
      if (this.isPhone() && container) {
        // Synchronously scroll to pane 1 (file-image) — no animation
        container.scrollLeft = container.clientWidth;
        
        // Setup scroll tracking AFTER initial positioning
        this.setupSwipeTracking();
        
        // Show the container on next frame after scroll is established
        requestAnimationFrame(() => {
          this.swipeReady.set(true);
        });
      } else {
        this.swipeReady.set(true);
      }
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

    // Set activePane eagerly so button disabled states update immediately
    this.activePane.set(index);

    // Temporarily disable scroll-snap to prevent it from intercepting
    // the smooth scroll animation and snapping back to the current pane.
    container.style.scrollSnapType = 'none';

    container.scrollTo({
      left: index * container.clientWidth,
      behavior: 'smooth',
    });

    // Re-enable scroll-snap after animation completes
    const restoreSnap = () => {
      container.style.scrollSnapType = '';
      container.removeEventListener('scrollend', restoreSnap);
      clearTimeout(fallback);
    };
    container.addEventListener('scrollend', restoreSnap, { once: true });

    // Safety fallback for browsers without scrollend support
    const fallback = setTimeout(restoreSnap, 600);
  }

  scrollToNextPane(): void {
    const maxPane = this.paneIndicators().length - 1;
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
    if (this.paneNavHideTimeout) {
      clearTimeout(this.paneNavHideTimeout);
      this.paneNavHideTimeout = null;
    }
    this.paneNavShowTimeout = setTimeout(() => {
      this.showPaneNav.set(true);
      this.startAutoHideTimer();
    }, 400);
  }

  onSwipeAreaMouseLeave(): void {
    if (this.paneNavShowTimeout) {
      clearTimeout(this.paneNavShowTimeout);
      this.paneNavShowTimeout = null;
    }
    if (this.paneNavAutoHideTimeout) {
      clearTimeout(this.paneNavAutoHideTimeout);
      this.paneNavAutoHideTimeout = null;
    }
    // Don't hide if mouse moved to a nav control in the gutter
    this.paneNavHideTimeout = setTimeout(() => {
      if (!this.hoveringNavControl) {
        this.showPaneNav.set(false);
      }
    }, 300);
  }

  onNavControlEnter(): void {
    this.hoveringNavControl = true;
    if (this.paneNavHideTimeout) {
      clearTimeout(this.paneNavHideTimeout);
      this.paneNavHideTimeout = null;
    }
    if (this.paneNavAutoHideTimeout) {
      clearTimeout(this.paneNavAutoHideTimeout);
      this.paneNavAutoHideTimeout = null;
    }
  }

  onNavControlLeave(): void {
    this.hoveringNavControl = false;
    this.startAutoHideTimer();
  }

  onSwipeAreaMouseMove(): void {
    // Show nav if hidden, or reset auto-hide timer if already visible
    if (!this.showPaneNav()) {
      this.showPaneNav.set(true);
    }
    this.startAutoHideTimer();
  }

  private startAutoHideTimer(): void {
    if (this.paneNavAutoHideTimeout) {
      clearTimeout(this.paneNavAutoHideTimeout);
    }
    // Don't start auto-hide while hovering over a nav control
    if (this.hoveringNavControl) return;
    this.paneNavAutoHideTimeout = setTimeout(() => {
      this.showPaneNav.set(false);
    }, 2500);
  }

  readonly currentFile = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getCurrentFile(deviceId)();
  });

  readonly isPlayerLoaded = computed(() => this.currentFile() !== null);

  readonly fileDescription = computed(() => {
    const currentFile = this.currentFile();
    return currentFile?.file?.description ?? '';
  });
}
