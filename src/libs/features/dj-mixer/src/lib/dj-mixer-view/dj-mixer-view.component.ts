import { DOCUMENT } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
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
import {
  DECK_SLOTS,
  DeviceStore,
  MappableControls,
  MidiControllers,
  MidiLearn,
  MidiMappingStore,
  StorageStore,
  controlKey,
} from '@teensyrom-nx/application';
import {
  EmptyStateMessageComponent,
  MappingOverlayLayerComponent,
  ScalingCompactCardComponent,
  SlidingContainerComponent,
} from '@teensyrom-nx/ui/components';
import { StorageType, type Device } from '@teensyrom-nx/domain';
import { DjDeckColumnComponent } from '../deck-column/dj-deck-column.component';
import { DjSidPanelComponent } from '../sid-panel/dj-sid-panel.component';
import { DjBindingsPanelComponent } from '../bindings-panel/dj-bindings-panel.component';
import { buildOverlayTargets } from '../mapping/mapping-overlay-targets';
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
    DjSidPanelComponent,
    DjBrowseTreesComponent,
    DjDirectoryListingComponent,
    DjBindingsPanelComponent,
    MappingOverlayLayerComponent,
    SlidingContainerComponent,
  ],
  templateUrl: './dj-mixer-view.component.html',
  styleUrl: './dj-mixer-view.component.scss',
})
export class DjMixerViewComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly storageStore = inject(StorageStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly midiStore = inject(MidiMappingStore);
  private readonly controls = inject(MappableControls);
  private readonly midiControllers = inject(MidiControllers);
  private readonly midiLearn = inject(MidiLearn);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly sidPanel = viewChild(DjSidPanelComponent);
  private readonly bindingsPanel = viewChild(DjBindingsPanelComponent);
  private readonly panelSlot = viewChild<unknown, ElementRef<HTMLElement>>('panelSlot', {
    read: ElementRef,
  });

  readonly enabledDevices = computed<Device[]>(() => this.deviceStore.usableDevices());

  /** The two fixed deck columns the DJ view always renders — never derived from device count or
   *  order; only which device (if any) a deck is bound to changes. */
  readonly decks: readonly DeckRef[] = DECK_SLOTS.map((slot, index) => ({
    slot,
    letter: slot,
    index,
  }));

  /** The DJ-local state: which device/storage the browse trees and listing currently show. */
  readonly activeStorage = signal<ActiveStorage | null>(null);

  /** Whether a SID drag from the listing is currently in flight — lights every deck's overlay. */
  readonly dragging = signal(false);

  /** Whether the bindings panel is open. */
  readonly panelOpen = signal(false);

  /** Whether the panel has ever been opened. The sliding container renders at full width until its
   *  first animation, so it is only created at the first open and stays after that. */
  readonly panelEverOpened = signal(false);

  /** Whether the user prefers no motion, which makes the panel's slide instant. */
  readonly reducedMotion = toSignal(
    inject(BreakpointObserver)
      .observe('(prefers-reduced-motion: reduce)')
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  /** How long the panel's slide and its card's own entry take: instant for reduced motion. */
  readonly panelAnimationDuration = computed(() => (this.reducedMotion() ? 0 : 400));

  /** Whether controls are overlaid for picking what a hardware input maps onto. */
  readonly mappingMode = this.midiStore.mappingMode;

  /** One overlay per mappable control, in the state the mapping store implies. */
  readonly overlayTargets = computed(() =>
    buildOverlayTargets(this.controls.all, {
      learn: this.midiStore.learn(),
      mappings: this.midiStore.mappings(),
      controllers: this.midiStore.controllers(),
    })
  );

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
    // Mapping mode lives in a root store, so leaving the view has to end it (and any learn) too,
    // or the hidden mode keeps unmapped ports open and can bind a control off-screen.
    this.destroyRef.onDestroy(() => {
      if (this.pinnedDeviceId) {
        this.storageStore.clearNavigationPin({ deviceId: this.pinnedDeviceId });
      }
      void this.midiControllers.setMappingMode(false);
    });
  }

  /** Opens the panel and moves focus into it, or closes it. */
  togglePanel(): void {
    if (this.panelOpen()) {
      this.closePanel();
    } else {
      this.panelEverOpened.set(true);
      this.panelOpen.set(true);
      afterNextRender(() => this.bindingsPanel()?.focusEntry(), { injector: this.injector });
    }
  }

  /** Closes the panel and ends mapping mode with it, so no hidden mode keeps running. Focus that
   *  was inside the panel returns to the Bindings button, as the panel's DOM leaves with it. */
  closePanel(): void {
    const focusWasInPanel = this.panelSlot()?.nativeElement.contains(this.document.activeElement);
    this.panelOpen.set(false);
    void this.midiControllers.setMappingMode(false);
    if (focusWasInPanel) {
      this.sidPanel()?.focusBindingsButton();
    }
  }

  /** Starts learning for the control whose overlay was chosen. */
  onTargetSelect(id: string): void {
    const control = this.controls.all.find(({ identity }) => controlKey(identity) === id);
    if (control) {
      this.midiLearn.select(control.identity);
    }
  }

  onOverlayDismiss(): void {
    this.midiLearn.cancel();
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
