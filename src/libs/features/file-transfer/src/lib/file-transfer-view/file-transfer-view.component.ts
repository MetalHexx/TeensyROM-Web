import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { DeviceStore, StorageStore, TransferStore } from '@teensyrom-nx/application';
import { Device, StorageType } from '@teensyrom-nx/domain';
import { EmptyStateMessageComponent, SlidingContainerComponent } from '@teensyrom-nx/ui/components';
import { DropzoneCardComponent } from './dropzone-card/dropzone-card.component';
import { TransfersCardComponent } from './transfers-card/transfers-card.component';
import { DevicesTreeCardComponent } from './devices-tree-card/devices-tree-card.component';
import { TransferDirectoryListingComponent } from './transfer-directory-listing/transfer-directory-listing.component';
import { TransferSettingsPanelComponent } from '../transfer-settings-panel/transfer-settings-panel.component';

/**
 * Top-level view for the File Transfer feature. Resolves and persists the
 * transfer target, seeds every enabled device's storage so each tree has roots to render, and
 * holds its navigation pin for exactly as long as this view is mounted.
 */
@Component({
  selector: 'lib-file-transfer-view',
  imports: [
    DropzoneCardComponent,
    TransfersCardComponent,
    EmptyStateMessageComponent,
    DevicesTreeCardComponent,
    TransferDirectoryListingComponent,
    SlidingContainerComponent,
    TransferSettingsPanelComponent,
  ],
  templateUrl: './file-transfer-view.component.html',
  styleUrl: './file-transfer-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileTransferViewComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly storageStore = inject(StorageStore);
  private readonly transferStore = inject(TransferStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly transfersCard = viewChild(TransfersCardComponent);
  private readonly panel = viewChild(TransferSettingsPanelComponent);
  private readonly panelSlot = viewChild<unknown, ElementRef<HTMLElement>>('panelSlot', {
    read: ElementRef,
  });

  /** Whether the transfer settings panel is open. */
  readonly panelOpen = signal(false);

  /** Whether the panel has ever been opened. The sliding container renders at full width until its
   *  first animation, so it is only created at the first open and stays after that. */
  readonly panelEverOpened = signal(false);

  /** Whether the user prefers no motion, which makes the panel slide instant. */
  readonly reducedMotion = toSignal(
    inject(BreakpointObserver)
      .observe('(prefers-reduced-motion: reduce)')
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  /** How long the panel slide and its card own entry take: instant for reduced motion. */
  readonly panelAnimationDuration = computed(() => (this.reducedMotion() ? 0 : 400));

  readonly enabledDevices = computed(() => this.deviceStore.usableDevices());

  private readonly storedTargetDeviceId = this.transferStore.getTargetDeviceId();

  /**
   * Resolution order: keep the stored target while it is still an enabled
   * device, otherwise fall back to the first enabled device, otherwise null.
   */
  readonly targetDevice = computed(() => {
    const enabled = this.enabledDevices();
    const stillEnabled = enabled.find((d) => d.deviceId === this.storedTargetDeviceId());
    return stillEnabled ?? enabled[0] ?? null;
  });

  /** deviceId currently holding the navigation pin taken by this view. */
  private pinnedDeviceId: string | null = null;

  constructor() {
    // Persist the resolved target so leaving and returning to the view keeps the same selection.
    // untracked() keeps the store write from being treated as a dependency of this effect.
    effect(() => {
      const resolvedId = this.targetDevice()?.deviceId ?? null;
      const storedId = this.storedTargetDeviceId();
      if (resolvedId && resolvedId !== storedId) {
        untracked(() => this.transferStore.setTargetDevice({ deviceId: resolvedId }));
      }
    });

    // Seed every enabled device's available storages. A device with a transfer running answers
    // 409 and every failed read raises its own warning, so it is skipped until its transfer ends:
    // the busy read is tracked, so the effect re-runs and seeds the device once it goes idle.
    // untracked() keeps the store's internal signal reads/writes from being tracked as this
    // effect's dependencies.
    effect(() => {
      for (const device of this.enabledDevices()) {
        if (this.transferStore.isDeviceBusy(device.deviceId)()) continue;
        untracked(() => void this.seedStorage(device));
      }
    });

    // Hold the target's directory list against playback-driven moves while this view is mounted.
    // The old pin is released before the new one is taken; a pin this view no longer owns is
    // already a no-op to clear in the store.
    effect(() => {
      const deviceId = this.targetDevice()?.deviceId ?? null;
      if (deviceId === this.pinnedDeviceId) return;

      untracked(() => {
        if (this.pinnedDeviceId) {
          this.storageStore.clearNavigationPin({ deviceId: this.pinnedDeviceId });
        }
        if (deviceId) {
          this.storageStore.setNavigationPin({ deviceId });
        }
      });
      this.pinnedDeviceId = deviceId;
    });

    // Release the pin this view instance actually holds, not the recomputed target — the two
    // diverge when the target changes and the pin-take effect above has not re-run yet.
    this.destroyRef.onDestroy(() => {
      if (this.pinnedDeviceId) {
        this.storageStore.clearNavigationPin({ deviceId: this.pinnedDeviceId });
      }
    });
  }

  /** Opens the panel and moves focus into it, or closes it. */
  togglePanel(): void {
    if (this.panelOpen()) {
      this.closePanel();
    } else {
      this.panelEverOpened.set(true);
      this.panelOpen.set(true);
      afterNextRender(() => this.panel()?.focusEntry(), { injector: this.injector });
    }
  }

  /** Closes the panel. Focus that was inside it returns to the gear, as the panel DOM leaves with it. */
  closePanel(): void {
    const focusWasInPanel = this.panelSlot()?.nativeElement.contains(this.document.activeElement);
    this.panelOpen.set(false);
    if (focusWasInPanel) {
      this.transfersCard()?.focusSettingsButton();
    }
  }

  private async seedStorage(device: Device): Promise<void> {
    if (device.sdStorage?.available) {
      await this.storageStore.initializeStorage({
        deviceId: device.deviceId,
        storageType: StorageType.Sd,
      });
    }
    if (device.usbStorage?.available) {
      await this.storageStore.initializeStorage({
        deviceId: device.deviceId,
        storageType: StorageType.Usb,
      });
    }
  }
}
