import { Component, computed, inject, Signal, effect, untracked } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../components/header/header.component';
import { NavigationService, NAV_ITEMS } from '@teensyrom-nx/app/navigation';
import { AlertContainerComponent } from '@teensyrom-nx/app/alerts';
import { filter, map, mergeMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  DeviceStore,
  PLAYER_CONTEXT,
  StorageStore,
  TransferStore,
  TransferPlaybackGuard,
} from '@teensyrom-nx/application';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BusyDialogComponent } from '../components/busy-dialog/busy-dialog.component';
import { TransferModalComponent } from '@teensyrom-nx/features/file-transfer';
import {
  NavRailComponent,
  NavRailItem,
  BottomBarComponent,
  BottomBarItem,
} from '@teensyrom-nx/ui/components';

@Component({
  selector: 'lib-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    AlertContainerComponent,
    NavRailComponent,
    BottomBarComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  readonly deviceStore = inject(DeviceStore);
  readonly playerContext = inject(PLAYER_CONTEXT);
  readonly storageStore = inject(StorageStore);
  readonly transferStore = inject(TransferStore);
  readonly navService = inject(NavigationService);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly dialog = inject(MatDialog);
  // Eager construction: nothing else injects this guard, and providedIn: 'root' alone never
  // instantiates it — without this, the device-mid-transfer playback protection silently never runs.
  private readonly transferPlaybackGuard = inject(TransferPlaybackGuard);
  pageTitle: Signal<string>;
  showIndexDialog = computed(() => this.deviceStore.isIndexing());
  showFindDeviceDialog = computed(() => this.deviceStore.isLoading());
  showSlowLoadingDialog: Signal<boolean>;
  showSlowFavoriteDialog: Signal<boolean>;
  showTransferDialog = computed(() => {
    const deviceId = this.transferStore.getTargetDeviceId()();
    return deviceId !== null && this.transferStore.isTransferModalOpen(deviceId)();
  });
  private indexDialogRef: MatDialogRef<BusyDialogComponent> | null = null;
  private findDeviceDialogRef: MatDialogRef<BusyDialogComponent> | null = null;
  private slowLoadingDialogRef: MatDialogRef<BusyDialogComponent> | null = null;
  private slowFavoriteDialogRef: MatDialogRef<BusyDialogComponent> | null = null;
  private transferDialogRef: MatDialogRef<TransferModalComponent> | null = null;

  /** Menu items for the nav rail */
  readonly menuItems: NavRailItem[] = NAV_ITEMS;

  /** Current route URL from router events */
  private readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /** Active route segment for nav rail highlighting */
  readonly activeRoute = computed(() => {
    const url = this.routeUrl();
    // Extract first path segment (e.g., '/player/browse' → 'player')
    return url?.split('/')[1] ?? '';
  });

  constructor() {
    // Initialize slow loading signal
    this.showSlowLoadingDialog = this.playerContext.isSlowLoading();
    // Initialize slow favorite operation signal
    this.showSlowFavoriteDialog = this.storageStore.isSlowFavoriteOperation();

    this.initBusyDialog(
      this.showFindDeviceDialog,
      this.findDeviceDialogRef,
      'Finding Devices',
      'Scanning COM ports and network for TeensyROM devices.'
    );

    this.initBusyDialog(
      this.showIndexDialog,
      this.indexDialogRef,
      'Indexing Storage',
      'This can take a few minutes.  Do not touch your commodore device.'
    );

    // Slow loading dialog effect
    effect(() => {
      const isSlowLoading = this.showSlowLoadingDialog();
      if (isSlowLoading && !this.slowLoadingDialogRef) {
        this.slowLoadingDialogRef = this.dialog.open(BusyDialogComponent, {
          data: {
            title: 'Slow Launch Detected',
            message: 'TeensyROM may be swapping firmware modes. Hang tight! :)',
          },
          disableClose: true,
          panelClass: 'glassy-dialog',
          backdropClass: 'busy-dialog-backdrop',
        });
      } else if (!isSlowLoading && this.slowLoadingDialogRef) {
        this.slowLoadingDialogRef.close();
        this.slowLoadingDialogRef = null;
      }
    });

    // Slow favorite operation dialog effect
    effect(() => {
      const isSlowFavorite = this.showSlowFavoriteDialog();
      if (isSlowFavorite && !this.slowFavoriteDialogRef) {
        this.slowFavoriteDialogRef = this.dialog.open(BusyDialogComponent, {
          data: {
            title: 'Updating Favorites',
            message: 'TeensyROM may be swapping firmware modes. Hang tight!',
          },
          disableClose: true,
          panelClass: 'glassy-dialog',
          backdropClass: 'busy-dialog-backdrop',
        });
      } else if (!isSlowFavorite && this.slowFavoriteDialogRef) {
        this.slowFavoriteDialogRef.close();
        this.slowFavoriteDialogRef = null;
      }
    });

    // Transfer modal effect — driven by store state alone, never by a click handler, so a later
    // iteration can re-raise it after a reload with no new machinery.
    effect(() => {
      const shouldShow = this.showTransferDialog();
      if (shouldShow && !this.transferDialogRef) {
        const deviceName = untracked(() => {
          const deviceId = this.transferStore.getTargetDeviceId()();
          return this.deviceStore.devices().find((d) => d.deviceId === deviceId)?.name || deviceId || 'the device';
        });
        this.transferDialogRef = this.dialog.open(TransferModalComponent, {
          disableClose: true,
          panelClass: 'glassy-dialog',
          backdropClass: 'busy-dialog-backdrop',
          ariaLabel: `Transferring files to ${deviceName}`,
          restoreFocus: true,
          // Material's dialog defaults to `max-width: 80vw`, which would silently cap the
          // terminal shape's 900px width on smaller displays. `width` stays unset so the
          // content-driven width from TransferProgressComponent's own root wins.
          maxWidth: '95vw',
        });
      } else if (!shouldShow && this.transferDialogRef) {
        this.transferDialogRef.close();
        this.transferDialogRef = null;
      }
    });

    this.pageTitle = toSignal(
      this.router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.route),
        map((r) => {
          while (r.firstChild) r = r.firstChild;
          return r;
        }),
        mergeMap((r) => r.data),
        map((data) => data['title'] ?? '')
      ),
      { initialValue: '' }
    );
  }

  private initBusyDialog(
    busySignal: Signal<boolean>,
    dialogRef: MatDialogRef<BusyDialogComponent> | null,
    title: string,
    message: string
  ) {
    effect(() => {
      if (busySignal() && !dialogRef) {
        dialogRef = this.dialog.open(BusyDialogComponent, {
          data: {
            title: title,
            message: message,
          },
          disableClose: true,
          panelClass: 'glassy-dialog',
          backdropClass: 'busy-dialog-backdrop', // Lighter backdrop for busy states
        });
      } else if (dialogRef) {
        dialogRef.close();
        dialogRef = null;
      }
    });
  }

  /** Handle nav rail or bottom bar item click - navigate to the item's route */
  onNavItemClick(item: NavRailItem | BottomBarItem): void {
    this.router.navigate([item.route]);
  }
}
