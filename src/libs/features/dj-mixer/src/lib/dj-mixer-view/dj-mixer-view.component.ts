import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DECK_SLOTS, DeviceStore, StorageStore } from '@teensyrom-nx/application';
import {
  EmptyStateMessageComponent,
  ScalingCompactCardComponent,
} from '@teensyrom-nx/ui/components';
import { StorageType, type Device } from '@teensyrom-nx/domain';
import { DjDeckColumnComponent } from '../deck-column/dj-deck-column.component';
import { DjMixerCardComponent } from '../mixer-card/dj-mixer-card.component';
import {
  DjBrowseTreesComponent,
  type DjStorageSelectEvent,
} from '../browse-trees/dj-browse-trees.component';
import { DjDirectoryListingComponent } from '../directory-listing/dj-directory-listing.component';
import { activeStorageKey, type ActiveStorage } from '../active-storage';
import type { DeckRef } from '../deck-ref';

@Component({
  selector: 'lib-dj-mixer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateMessageComponent,
    ScalingCompactCardComponent,
    DjDeckColumnComponent,
    DjMixerCardComponent,
    DjBrowseTreesComponent,
    DjDirectoryListingComponent,
  ],
  templateUrl: './dj-mixer-view.component.html',
  styleUrl: './dj-mixer-view.component.scss',
})
export class DjMixerViewComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly storageStore = inject(StorageStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly enabledDevices = computed<Device[]>(() =>
    this.deviceStore.devices().filter((d) => d.isEnabled)
  );

  /** The two fixed deck columns the DJ view always renders — never derived from device count or
   *  order; only which device (if any) a deck is bound to changes. */
  readonly decks: readonly DeckRef[] = DECK_SLOTS.map((slot, index) => ({
    slot,
    letter: slot,
    index,
  }));
  readonly showCrossfader = computed(() => this.decks.length >= 2);

  /** The DJ-local state: which device/storage the browse trees and listing currently show. */
  readonly activeStorage = signal<ActiveStorage | null>(null);

  /** Whether a SID drag from the listing is currently in flight — lights every deck's overlay. */
  readonly dragging = signal(false);

  /** deviceId currently holding the navigation pin taken by this view. */
  private pinnedDeviceId: string | null = null;

  constructor() {
    // Seed every enabled device's available storage so the trees and listing have roots to
    // render. untracked() keeps the store's internal signal reads/writes from being tracked as
    // this effect's dependencies; initializeStorage is idempotent for an already-loaded entry,
    // so re-entering the view keeps the player's position.
    effect(() => {
      const devices = this.enabledDevices();
      untracked(() => {
        for (const device of devices) {
          void this.seedStorage(device);
        }
      });
    });

    // Default to the first enabled device's first available storage once one exists and nothing
    // is active yet.
    effect(() => {
      if (this.activeStorage() !== null) return;
      const first = firstAvailableStorage(this.enabledDevices());
      if (first) {
        untracked(() => this.activeStorage.set(first));
      }
    });

    // Hold the navigation pin on the active device while this view is mounted, so playback-driven
    // `alignToPlayingFile` cannot move the listing while performing. The old pin is released
    // before the new one is taken.
    effect(() => {
      const deviceId = this.activeStorage()?.deviceId ?? null;
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

    // Follow the store: a trail back/forward can land the active device on its other storage,
    // and the listing follows. A `null` storage type is the player's device-level view, which
    // the DJ view has no equivalent of, so it's ignored.
    effect(() => {
      const active = this.activeStorage();
      if (!active) return;

      const selected = this.storageStore.selectedDirectories()[active.deviceId];
      if (selected?.storageType && selected.storageType !== active.storageType) {
        untracked(() =>
          this.activeStorage.set({
            deviceId: active.deviceId,
            storageType: selected.storageType as StorageType,
          })
        );
      }
    });

    // Release the pin this view instance actually holds, not the recomputed active storage — the
    // two diverge when the active storage changes and the pin-take effect has not re-run yet.
    this.destroyRef.onDestroy(() => {
      if (this.pinnedDeviceId) {
        this.storageStore.clearNavigationPin({ deviceId: this.pinnedDeviceId });
      }
    });
  }

  onStorageSelect(event: DjStorageSelectEvent): void {
    this.activeStorage.set(event);
    const path = this.storageStore.storageEntries()[activeStorageKey(event)]?.currentPath ?? '/';
    void this.storageStore.navigateToDirectory({ ...event, path });
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

/** The first enabled device's first available storage, in SD-then-USB order. */
function firstAvailableStorage(devices: readonly Device[]): ActiveStorage | null {
  for (const device of devices) {
    if (device.sdStorage?.available) {
      return { deviceId: device.deviceId, storageType: StorageType.Sd };
    }
    if (device.usbStorage?.available) {
      return { deviceId: device.deviceId, storageType: StorageType.Usb };
    }
  }
  return null;
}
