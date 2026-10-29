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
  DjSets,
  DjStore,
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
import { FoldHandleComponent, type SetsTreeBranchModel } from '@teensyrom-nx/ui/components/dj';
import { DjDeckColumnComponent } from '../deck-column/dj-deck-column.component';
import { DjSidPanelComponent } from '../sid-panel/dj-sid-panel.component';
import { DjBindingsPanelComponent } from '../bindings-panel/dj-bindings-panel.component';
import { buildOverlayTargets } from '../mapping/mapping-overlay-targets';
import {
  DjBrowseTreesComponent,
  type DjStorageSelectEvent,
} from '../browse-trees/dj-browse-trees.component';
import { DjDirectoryListingComponent } from '../directory-listing/dj-directory-listing.component';
import { DjSetCardComponent } from '../set-card/dj-set-card.component';
import { activeStorageKey, type ActiveStorage } from '../active-storage';
import type { DeckRef } from '../deck-ref';

/** How long the peek stays after the last Select press. */
const PEEK_DURATION_MS = 1500;

/** The query the `below-phone` mixin uses (`$bp-phone` is 640px), below which the band stacks. */
const STACKED_QUERY = '(max-width: 639px)';

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
    DjSetCardComponent,
    DjBindingsPanelComponent,
    MappingOverlayLayerComponent,
    SlidingContainerComponent,
    FoldHandleComponent,
  ],
  templateUrl: './dj-mixer-view.component.html',
  styleUrl: './dj-mixer-view.component.scss',
})
export class DjMixerViewComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly storageStore = inject(StorageStore);
  private readonly djStore = inject(DjStore);
  private readonly djSets = inject(DjSets);
  private readonly destroyRef = inject(DestroyRef);
  private readonly midiStore = inject(MidiMappingStore);
  private readonly controls = inject(MappableControls);
  private readonly midiControllers = inject(MidiControllers);
  private readonly midiLearn = inject(MidiLearn);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly breakpoints = inject(BreakpointObserver);

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

  private readonly setTree = this.djStore.setTreeSummary();

  /** The saved sets for the tree's Sets branch, newest first, the loaded one lit. */
  readonly setsBranch = computed<SetsTreeBranchModel>(() => ({
    label: 'Sets',
    sets: this.setTree().sets.map(({ id, name, loaded }) => ({
      id,
      name,
      loaded,
      accessibleName: loaded ? `Set ${name}, loaded` : `Set ${name}`,
    })),
  }));

  /** The DJ-local state: which device/storage the browse trees and listing currently show. */
  readonly activeStorage = signal<ActiveStorage | null>(null);

  /** Whether a SID drag from the listing is currently in flight — lights every deck's overlay. */
  readonly dragging = signal(false);

  /** Whether a set row drag is in flight — lights every deck's overlay, but not the set card's
   *  listing drop state. */
  readonly rowDragging = signal(false);

  /** Whether the bindings panel is open. */
  readonly panelOpen = signal(false);

  /** Whether the panel has ever been opened. The sliding container renders at full width until its
   *  first animation, so it is only created at the first open and stays after that. */
  readonly panelEverOpened = signal(false);

  /** Whether the user prefers no motion, which makes the panel's slide instant. */
  readonly reducedMotion = toSignal(
    this.breakpoints
      .observe('(prefers-reduced-motion: reduce)')
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  /** Whether the band has stacked its three cards (below the phone breakpoint). */
  readonly stacked = toSignal(
    this.breakpoints.observe(STACKED_QUERY).pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  /** How long the panel's slide and its card's own entry take: instant for reduced motion. */
  readonly panelAnimationDuration = computed(() => (this.reducedMotion() ? 0 : 400));

  /** Whether the file listing is folded into its strip; session only, independent of
   *  `browserShown`. Read through `listingFoldedEffective`, which ignores it when stacked. */
  readonly listingFolded = signal(false);

  /** Whether the listing is folded as far as the layout is concerned: never when stacked. */
  readonly listingFoldedEffective = computed(() => this.listingFolded() && !this.stacked());

  /** The listing body's open width, held when a fold starts so the listing does not reflow into
   *  the shrinking card; `null` once an unfold releases it. */
  private readonly heldListingWidth = signal<number | null>(null);

  /** The width the listing body is held at while folded; none when it is not. */
  protected readonly listingBodyWidth = computed(() =>
    this.listingFoldedEffective() ? this.heldListingWidth() : null
  );

  private readonly listingBody = viewChild<ElementRef<HTMLElement>>('listingBody');

  /** Whether the browser (trees, listing and set card) is shown; session only. */
  readonly browserShown = signal(true);

  /** Whether the grid has dropped the band's row. It follows the band's exit animation, never
   *  leads it, so the decks do not jump mid-slide. */
  readonly browserCollapsed = signal(false);

  /** Whether the set card's peek is up while the browser is hidden. */
  readonly peekShown = signal(false);

  /** Whether the peek has ever been needed: its sliding container renders at full height until
   *  its first animation, so it is only created at first use and stays after that. */
  readonly peekEverShown = signal(false);

  /** Whether controls are overlaid for picking what a hardware input maps onto. */
  readonly mappingMode = this.midiStore.mappingMode;

  /** Counts the band's finished slides. The set controls' anchors leave the DOM with the band and
   *  come back on a slide, so the overlay layer must measure again once it settles. */
  private readonly bandSettled = signal(0);

  /** One overlay per mappable control, in the state the mapping store implies. */
  readonly overlayTargets = computed(() => {
    this.bandSettled();
    return buildOverlayTargets(this.controls.all, {
      learn: this.midiStore.learn(),
      mappings: this.midiStore.mappings(),
      controllers: this.midiStore.controllers(),
    });
  });

  /** What a screen reader hears when a save fails while the browser is hidden: the set card, and
   *  with it the Saved lamp, is not in the DOM then. */
  readonly hiddenSaveNotice = computed(() =>
    this.djStore.sets().save === 'failed' && !this.browserShown() ? 'The set was not saved' : ''
  );

  private peekTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSelectTurns = untracked(() => this.djStore.sets().selectTurns);
  private lastSaveFailed = untracked(() => this.djStore.sets().save === 'failed');

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

    // A Select press while the browser is hidden shows the set card for a moment, so the knob's
    // position can still be read.
    effect(() => {
      const turns = this.djStore.sets().selectTurns;
      untracked(() => {
        if (turns === this.lastSelectTurns) return;
        this.lastSelectTurns = turns;
        if (!this.browserShown()) {
          this.showPeek();
        }
      });
    });

    // A save that fails while the browser is hidden raises the peek, so the Not saved lamp shows.
    effect(() => {
      const failed = this.djStore.sets().save === 'failed';
      untracked(() => {
        const newlyFailed = failed && !this.lastSaveFailed;
        this.lastSaveFailed = failed;
        if (newlyFailed && !this.browserShown()) {
          this.showPeek();
        }
      });
    });

    // Release the pin this view instance actually holds, not the recomputed active storage — the
    // two diverge when the active storage changes and the pin-take effect has not re-run yet.
    // Mapping mode lives in a root store, so leaving the view has to end it (and any learn) too,
    // or the hidden mode keeps unmapped ports open and can bind a control off-screen.
    this.destroyRef.onDestroy(() => {
      this.clearPeekTimer();
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

  /** Hides the browser, or shows it. Showing restores the grid's row first, so the entry
   *  animation plays into it, and puts the peek away at once. Either way the source card of a row
   *  drag leaves the DOM, so its `dragend` may never come: the drag is taken as over. */
  toggleBrowser(): void {
    this.rowDragging.set(false);
    if (this.browserShown()) {
      this.browserShown.set(false);
      return;
    }
    this.browserCollapsed.set(false);
    this.browserShown.set(true);
    this.clearPeekTimer();
    this.peekShown.set(false);
  }

  /** Folds the file listing into its strip, or unfolds it. A fold holds the body at the width it
   *  has now; an unfold releases it. With no motion there is no transition to wait for, so the
   *  overlays are asked to measure again at once. */
  foldListing(folded: boolean): void {
    if (this.listingFolded() === folded) return;
    this.heldListingWidth.set(
      folded ? this.listingBody()?.nativeElement.offsetWidth ?? null : null
    );
    this.listingFolded.set(folded);
    if (this.panelAnimationDuration() === 0) {
      this.bandSettled.update((count) => count + 1);
    }
  }

  /** The listing card's own width transition finished: the set card's controls have moved, so the
   *  overlays measure again. Transitions bubbling from the card's content are not its own. */
  onListingCardTransitionEnd(event: TransitionEvent): void {
    if (event.target === event.currentTarget && event.propertyName === 'flex-basis') {
      this.bandSettled.update((count) => count + 1);
    }
  }

  /** The band's slide finished: after an exit, the grid drops its row. An entry's finish is
   *  ignored — the row was restored before it began. */
  onBandAnimationComplete(): void {
    this.bandSettled.update((count) => count + 1);
    if (!this.browserShown()) {
      this.browserCollapsed.set(true);
    }
  }

  /** A row drag began: the peek, if up, holds until it ends, so a drag begun in it keeps its source. */
  onRowDragStart(): void {
    this.rowDragging.set(true);
    this.clearPeekTimer();
  }

  /** A row drag ended: the peek, if up, goes away its usual interval after the drop. */
  onRowDragEnd(): void {
    this.rowDragging.set(false);
    if (this.peekShown()) {
      this.showPeek();
    }
  }

  private showPeek(): void {
    this.peekEverShown.set(true);
    this.peekShown.set(true);
    this.clearPeekTimer();
    if (this.rowDragging()) {
      return;
    }
    this.peekTimer = setTimeout(() => {
      this.peekTimer = null;
      this.peekShown.set(false);
    }, PEEK_DURATION_MS);
  }

  private clearPeekTimer(): void {
    if (this.peekTimer !== null) {
      clearTimeout(this.peekTimer);
      this.peekTimer = null;
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

  /** Choosing a storage asks to see its files, so a folded listing opens. */
  onStorageSelect(event: DjStorageSelectEvent): void {
    this.foldListing(false);
    this.activeStorage.set(event);
    const path = this.storageStore.storageEntries()[activeStorageKey(event)]?.currentPath ?? '/';
    void this.storageStore.navigateToDirectory({ ...event, path });
  }

  onSetSelect(id: string): void {
    void this.djSets.openSet(id);
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
