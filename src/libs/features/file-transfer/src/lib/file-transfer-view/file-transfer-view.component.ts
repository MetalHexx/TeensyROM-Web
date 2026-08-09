import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { DeviceStore, StorageStore, TransferStore } from '@teensyrom-nx/application';
import { Device, StorageType } from '@teensyrom-nx/domain';
import { EmptyStateMessageComponent } from '@teensyrom-nx/ui/components';
import { DropzoneCardComponent } from './dropzone-card/dropzone-card.component';
import { TransferToolbarComponent } from './transfer-toolbar/transfer-toolbar.component';
import { DirectoryTreeContainerComponent } from './directory-tree-container/directory-tree-container.component';
import { TransferDirectoryListingComponent } from './transfer-directory-listing/transfer-directory-listing.component';

/**
 * Top-level view for the File Transfer feature. Resolves and persists the
 * transfer target, seeds its storage so the tree has roots to render, and
 * holds its navigation pin for exactly as long as this view is mounted.
 */
@Component({
  selector: 'lib-file-transfer-view',
  imports: [
    DropzoneCardComponent,
    TransferToolbarComponent,
    EmptyStateMessageComponent,
    DirectoryTreeContainerComponent,
    TransferDirectoryListingComponent,
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

  readonly enabledDevices = computed(() => this.deviceStore.devices().filter((d) => d.isEnabled));

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

    // Seed the target device's available storages only — never every device. untracked() keeps
    // the store's internal signal reads/writes from being tracked as this effect's dependencies.
    effect(() => {
      const device = this.targetDevice();
      if (device) {
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
