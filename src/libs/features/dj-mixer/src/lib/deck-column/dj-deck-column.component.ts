import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ScalingContainerComponent } from '@teensyrom-nx/ui/components';
import type { BindingCardModel, BindingPortModel } from '@teensyrom-nx/ui/components';
import {
  BindingPlateComponent,
  DeckChannelStripComponent,
  DeckTransportComponent,
  LoopsCuesPlateComponent,
} from '@teensyrom-nx/ui/components/dj';
import type {
  DeckChannelStripModel,
  DeckTransportModel,
  DeckTransportState,
  LoopBoundaryModel,
  LoopBoundaryNudge,
  LoopBoundarySnap,
  LoopSelectedRowModel,
  LoopTileModel,
  LoopsCuesPlateModel,
} from '@teensyrom-nx/ui/components/dj';
import {
  DeckService,
  DeviceStore,
  DjStore,
  MARKER_NAME_MAX_LENGTH,
  SPEED_FADER_RANGE,
  type DeckTransportSummary,
  type LoopActivity,
  type LoopBoundarySummary,
  type LoopItemSummary,
  type LoopSelectionSummary,
  cartridgeOptions,
  formatElapsed,
} from '@teensyrom-nx/application';
import { isDjFileDrag, readDjFileDragData } from '../drag/dj-file-drag';
import { isSetRowDrag, readSetRowDragId } from '../drag/dj-set-row-drag';
import type { DeckRef } from '../deck-ref';
import { settingsSignModel } from '../settings-sign-model';

const STATE_LABELS: Record<DeckTransportState, string> = {
  playing: 'Play',
  paused: 'Pause',
  stopped: 'Stop',
  analyzing: 'Analyzing…',
  error: 'Error',
  empty: 'Stop',
};

/** Whether the drag is one a deck's overlay takes: a file from the listing or a row of the set. */
function isDeckDrop(dt: DataTransfer): boolean {
  return isDjFileDrag(dt) || isSetRowDrag(dt);
}

/** A tune that played to its end reads as stopped on the display. */
function transportState(led: DeckTransportSummary['led']): DeckTransportState {
  return led === 'ended' ? 'stopped' : led;
}

const ACTIVITY_WORDS: Record<LoopActivity, string> = {
  idle: '',
  queued: 'queued',
  running: 'running',
};

/** The tile's select-button name: what it is, how long, and where it stands, spelled out. */
function tileSelectName(item: LoopItemSummary, letter: string): string {
  const state = [
    ACTIVITY_WORDS[item.activity],
    item.ready ? '' : 'not ready',
    item.ownSettings ? 'own settings' : '',
  ]
    .filter((word) => word !== '')
    .join(' and ');
  const length = item.kind === 'loop' ? item.lengthText : '';
  return [item.name, item.kind, length, state, `deck ${letter}`]
    .filter((part) => part !== '')
    .join(', ');
}

/** A boundary model from its summary; null is a cue's End or an empty row: drawn empty, inert. */
function boundaryModel(
  tag: 'Start' | 'End',
  letter: string,
  summary: LoopBoundarySummary | null
): LoopBoundaryModel {
  const word = tag.toLowerCase();
  return {
    tag,
    empty: summary === null,
    disabled: summary === null || summary.rangeFrames === 0,
    offsetFrames: summary?.offsetFrames ?? 0,
    rangeFrames: summary?.rangeFrames ?? 0,
    tickPercents: summary?.tickPercents ?? [],
    previousDisabled: !summary?.canSnapPrevious,
    nextDisabled: !summary?.canSnapNext,
    nudgeAccessibleName: `Nudge ${word} deck ${letter}`,
    previousAccessibleName: `Snap ${word} to previous moment deck ${letter}`,
    nextAccessibleName: `Snap ${word} to next moment deck ${letter}`,
  };
}

function selectedRowModel(
  selection: LoopSelectionSummary | null,
  letter: string
): LoopSelectedRowModel {
  const name = selection?.name ?? 'selected marker';
  return {
    empty: selection === null,
    name: selection?.name ?? '',
    kindLabel: selection === null ? '' : selection.kind === 'loop' ? 'LOOP' : 'CUE',
    spanText: selection?.spanText ?? '',
    activity: selection?.activity ?? 'idle',
    ready: selection?.ready ?? true,
    triggerDisabled: selection === null,
    setEndDisabled: selection === null,
    clearEndDisabled: selection?.kind !== 'loop',
    deleteDisabled: selection === null,
    playNowDisabled: selection === null,
    playNowAccessibleName: `Play now ${name} deck ${letter}`,
    sharesGlobal: selection?.sharesGlobal ?? true,
    globalDisabled: selection === null,
    globalAccessibleName: `GBL ${name} deck ${letter}`,
    renameDisabled: selection === null,
    renameLabel: `Rename ${name}`,
    nameMaxLength: MARKER_NAME_MAX_LENGTH,
    start: boundaryModel('Start', letter, selection?.start ?? null),
    end: boundaryModel('End', letter, selection?.end ?? null),
    triggerAccessibleName: `Trigger ${name} deck ${letter}`,
    setEndAccessibleName: `Set end of ${name} deck ${letter}`,
    clearEndAccessibleName: `Clear end of ${name} deck ${letter}`,
    deleteAccessibleName: `Delete ${name} deck ${letter}`,
  };
}

type SpeedJump = 'up' | 'home' | 'down';

/** The channel strip's `jump` id is an opaque string; this is the one place it is narrowed. */
function isSpeedJump(id: string): id is SpeedJump {
  return id === 'up' || id === 'home' || id === 'down';
}

@Component({
  selector: 'lib-dj-deck-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents', '[attr.data-deck]': 'deck().letter' },
  imports: [
    ScalingContainerComponent,
    DeckTransportComponent,
    LoopsCuesPlateComponent,
    BindingPlateComponent,
    DeckChannelStripComponent,
  ],
  templateUrl: './dj-deck-column.component.html',
  styleUrl: './dj-deck-column.component.scss',
})
export class DjDeckColumnComponent {
  private readonly djStore = inject(DjStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly deckService = inject(DeckService);

  readonly deck = input.required<DeckRef>();

  /** Whether a SID drag is currently in flight anywhere in the view — lights this deck's overlay. */
  readonly dropActive = input<boolean>(false);

  private readonly summary = computed(() => this.djStore.transportSummary(this.deck().slot)());
  private readonly binding = computed(() => this.djStore.bindingSummary(this.deck().slot)());
  private readonly deckState = computed(() => this.djStore.deck(this.deck().slot)());
  private readonly settingsInPlay = computed(() => this.djStore.settingsInPlay(this.deck().slot)());
  private readonly canShape = computed(() => this.djStore.canShape(this.deck().slot)());
  private readonly deckSet = computed(() => this.djStore.deckSetSummary(this.deck().slot)());

  /** Never reads the playhead, so the tiles and the selected row do not rebuild on a frame tick. */
  readonly loops = computed(() => this.djStore.loopsSummary(this.deck().slot)());
  /** The one per-frame value the plate takes: the running tile's lap. */
  readonly loopLapPercent = computed(() => this.djStore.loopLapPercent(this.deck().slot)());

  // Non-null only while a nudge strip is being dragged: the pointer's offset pins the boundary
  // readout until the nudge is committed or the selection moves on.
  readonly startDragOffset = signal<number | null>(null);
  readonly endDragOffset = signal<number | null>(null);

  readonly plateModel = computed<LoopsCuesPlateModel>(() => {
    const { letter } = this.deck();
    const { hasTune, canAdd, canStop, items, selected } = this.loops();
    return {
      accessibleName: `Loops/Cues deck ${letter}`,
      addAccessibleName: `Add cue deck ${letter}`,
      stopAccessibleName: `Stop loop deck ${letter}`,
      addDisabled: !canAdd,
      stopDisabled: !canStop,
      gridAccessibleName: `Loops deck ${letter}`,
      emptyText: hasTune ? 'Add a cue at the playhead' : 'Load a tune to add loops',
      selected: selectedRowModel(selected, letter),
      tiles: items.map(
        (item): LoopTileModel => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          lengthText: item.lengthText,
          activity: item.activity,
          selected: item.selected,
          ready: item.ready,
          triggerAccessibleName: `Trigger ${item.name} deck ${letter}`,
          selectAccessibleName: tileSelectName(item, letter),
          ownSettings: item.ownSettings,
          playNowAccessibleName: `Play now ${item.name} deck ${letter}`,
        })
      ),
    };
  });

  constructor() {
    const selectedId = computed(() => this.loops().selected?.id ?? null);
    effect(() => {
      selectedId();
      untracked(() => {
        this.startDragOffset.set(null);
        this.endDragOffset.set(null);
      });
    });
  }

  // Non-null only mid-drag or mid-seek: the pointer's own value pins the thumb so a polled
  // position update can't fight it — the POC transport adapter's pin-until-landed rule, carried
  // over verbatim (see `onScrubCommit`).
  private readonly scrubDragValue = signal<number | null>(null);

  readonly transportModel = computed<DeckTransportModel>(() => {
    const { letter } = this.deck();
    const summary = this.summary();
    const set = this.deckSet();
    const state: DeckTransportState =
      summary.status === 'empty' ? 'empty' : transportState(summary.led);
    return {
      accessibleName: `Transport deck ${letter}`,
      state,
      stateLabel: STATE_LABELS[state],
      title: summary.title,
      author: summary.author,
      emptyText: 'No tune — drop a SID here',
      totalText: summary.totalText,
      bar: summary.bar,
      marks: this.loops().items,
      scrubAccessibleName: `Position deck ${letter}`,
      playPause: { showing: summary.showing, disabled: summary.controlsDisabled },
      canStop: summary.canStop,
      repeatTrack: summary.repeat,
      subtune: {
        text: summary.subtuneCompact,
        disabled: summary.subtuneDisabled,
        previousAccessibleName: `Previous subtune deck ${letter}`,
        nextAccessibleName: `Next subtune deck ${letter}`,
      },
      actionAccessibleNames: {
        play: `Play deck ${letter}`,
        pause: `Pause deck ${letter}`,
        stop: `Stop deck ${letter}`,
        repeat: `Repeat track deck ${letter}`,
      },
      // A failed load's reason travels in `label`, not `errors`.
      errors: summary.status === 'failed' && summary.label ? [summary.label] : summary.errors,
      set: {
        positionText: set.positionText,
        setName: set.setName,
        previousDisabled: !set.available || !set.canPrevious,
        nextDisabled: !set.available || !set.canNext,
        previousAccessibleName: `Previous in the set deck ${letter}`,
        nextAccessibleName: `Next in the set deck ${letter}`,
      },
    };
  });

  /** The playhead as a percentage, or the drag pin while one is held. */
  readonly positionPercent = computed(() => this.scrubDragValue() ?? this.summary().scrubPercent);

  /** The frame under the drag pin, or null when no drag or seek is in flight. */
  private readonly pinFrames = computed<number | null>(() => {
    const pin = this.scrubDragValue();
    return pin === null ? null : (pin / 100) * (this.deckState().lengthFrames ?? 0);
  });

  /** Follows the drag pin like the thumb does, so the display tracks the pointer. */
  readonly elapsedText = computed(() => {
    const frames = this.pinFrames();
    return frames === null
      ? this.summary().elapsedText
      : formatElapsed(frames, this.deckState().playCallIntervalUs);
  });

  readonly frameLabel = computed(() => {
    const frames = this.pinFrames();
    return frames === null ? this.summary().frameLabel : `frame ${Math.round(frames)}`;
  });

  readonly channelModel = computed<DeckChannelStripModel>(() => {
    const { letter } = this.deck();
    const { speed, faderSpeed, nudging, voices } = this.deckState();
    return {
      settingsSign: settingsSignModel(this.deck(), this.settingsInPlay()),
      voiceAccessibleName: `Voice deck ${letter}`,
      speedAccessibleName: `Speed deck ${letter}`,
      voices: voices.map(({ muted }, i) => {
        const n = i + 1;
        const holdLabel = muted ? 'Punch' : 'Kill';
        return {
          label: `V${n}`,
          muted,
          holdLabel,
          muteAccessibleName: `Mute voice ${n} deck ${letter}`,
          holdAccessibleName: `${holdLabel} voice ${n} deck ${letter}`,
        };
      }),
      speedText: `${speed.toFixed(3)}×`,
      nudging,
      fader: {
        value: Math.min(Math.max(faderSpeed, SPEED_FADER_RANGE.min), SPEED_FADER_RANGE.max),
        min: SPEED_FADER_RANGE.min,
        max: SPEED_FADER_RANGE.max,
        step: 0.001,
        home: SPEED_FADER_RANGE.home,
        accessibleName: `Speed multiplier deck ${letter}`,
      },
      nudge: {
        downAccessibleName: `Nudge down deck ${letter}`,
        upAccessibleName: `Nudge up deck ${letter}`,
      },
      jumpButtons: [
        { id: 'up', label: '+50%', accessibleName: `Speed up 50% deck ${letter}` },
        { id: 'home', label: 'Home', accessibleName: `Speed home deck ${letter}` },
        { id: 'down', label: '−50%', accessibleName: `Speed down 50% deck ${letter}` },
      ],
      disabled: !this.canShape(),
    };
  });

  readonly bindingModel = computed<BindingCardModel>(() => {
    const { slot, letter } = this.deck();
    const binding = this.binding();
    const options = cartridgeOptions(
      slot,
      this.djStore.bindings(),
      this.djStore.midi().ports,
      this.deviceStore.devices()
    );
    return {
      accessibleName: `MIDI binding deck ${letter}`,
      heading: `Deck ${letter}`,
      ports: options.map(
        (option): BindingPortModel => ({
          id: option.id,
          label: option.label,
          takenBy: option.takenBy ?? undefined,
          absent: option.present ? undefined : true,
        })
      ),
      selectedPortId: binding.selectedDeviceId,
      portsEnabled: options.length > 0,
      portPlaceholder: binding.placeholder,
      enableVisible: binding.enableVisible,
      enableDisabled: binding.enableDisabled,
      identifyDisabled: binding.identifyDisabled,
      selectAccessibleName: `Cartridge deck ${letter}`,
      enableAccessibleName: `Enable MIDI deck ${letter}`,
      identifyAccessibleName: `Identify deck ${letter}`,
      errors: binding.errors,
    };
  });

  /** Whether the pointer is over this deck's own overlay while a SID or set row drag is in flight. */
  readonly hot = signal(false);

  private dragEnterCount = 0;

  onOverlayDragEnter(event: DragEvent): void {
    if (!event.dataTransfer || !isDeckDrop(event.dataTransfer)) return;
    event.preventDefault();
    this.dragEnterCount++;
    this.hot.set(true);
  }

  onOverlayDragOver(event: DragEvent): void {
    if (!event.dataTransfer || !isDeckDrop(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  onOverlayDragLeave(event: DragEvent): void {
    if (!event.dataTransfer || !isDeckDrop(event.dataTransfer)) return;
    event.preventDefault();
    this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
    if (this.dragEnterCount === 0) {
      this.hot.set(false);
    }
  }

  /** A drop is a plain load, played or not — no confirmation, no guard here; `DeckService.load`
   *  and `loadSetRow` stop whatever this deck is already playing before they load the new source. */
  onOverlayDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragEnterCount = 0;
    this.hot.set(false);

    const payload = readDjFileDragData(event.dataTransfer);
    if (payload) {
      void this.deckService.load(this.deck().slot, payload);
      return;
    }

    const rowId = readSetRowDragId(event.dataTransfer);
    if (rowId) {
      void this.deckService.loadSetRow(this.deck().slot, rowId);
    }
  }

  onPlayPauseClick(): void {
    void this.deckService.togglePlayPause(this.deck().slot);
  }

  onStopClick(): void {
    this.deckService.stop(this.deck().slot);
  }

  onRepeatTrackChange(on: boolean): void {
    this.deckService.setRepeat(this.deck().slot, on);
  }

  onPreviousSubtune(): void {
    void this.deckService.previousSubtune(this.deck().slot);
  }

  onNextSubtune(): void {
    void this.deckService.nextSubtune(this.deck().slot);
  }

  onPreviousInSet(): void {
    void this.deckService.previousRow(this.deck().slot);
  }

  onNextInSet(): void {
    void this.deckService.nextRow(this.deck().slot);
  }

  /** Pins the thumb at the dragged value for as long as the drag lasts. */
  onScrubInput(value: number): void {
    this.scrubDragValue.set(value);
  }

  /** The release, not every drag tick. The pin stays set — holding the thumb at the released spot
   *  — until the seek actually lands, guarded on the pin still being this call's own value so a
   *  superseded scrub settling late cannot clear a newer one's pin out from under it. */
  async onScrubCommit(value: number): Promise<void> {
    this.scrubDragValue.set(value);
    await this.deckService.seek(this.deck().slot, value);
    if (this.scrubDragValue() === value) {
      this.scrubDragValue.set(null);
    }
  }

  onAddMarker(): void {
    this.deckService.addMarker(this.deck().slot);
  }

  onStopLoop(): void {
    this.deckService.stopMarkerLoop(this.deck().slot);
  }

  onToggleSelected(): void {
    void this.deckService.toggleMarker(this.deck().slot);
  }

  onTriggerTile(id: string): void {
    void this.deckService.toggleMarker(this.deck().slot, id);
  }

  onPlayNowSelected(): void {
    void this.deckService.playMarkerNow(this.deck().slot);
  }

  onPlayNowTile(id: string): void {
    void this.deckService.playMarkerNow(this.deck().slot, id);
  }

  onToggleGlobal(): void {
    this.deckService.toggleMarkerGlobal(this.deck().slot);
  }

  onSelectTile(id: string): void {
    this.deckService.selectMarker(this.deck().slot, id);
  }

  onSetEnd(): void {
    this.deckService.setMarkerEnd(this.deck().slot);
  }

  onClearEnd(): void {
    this.deckService.clearMarkerEnd(this.deck().slot);
  }

  onRenameSelected(name: string): void {
    const id = this.loops().selected?.id;
    if (id !== undefined) {
      this.deckService.renameMarker(this.deck().slot, id, name);
    }
  }

  onDeleteSelected(): void {
    this.deckService.deleteMarker(this.deck().slot);
  }

  onSnap({ boundary, direction }: LoopBoundarySnap): void {
    void this.deckService.snapMarker(this.deck().slot, boundary, direction);
  }

  onNudgeInput({ boundary, offsetFrames }: LoopBoundaryNudge): void {
    (boundary === 'start' ? this.startDragOffset : this.endDragOffset).set(offsetFrames);
  }

  onNudgeCommit({ boundary, offsetFrames }: LoopBoundaryNudge): void {
    void this.deckService.nudgeMarker(this.deck().slot, boundary, offsetFrames);
    (boundary === 'start' ? this.startDragOffset : this.endDragOffset).set(null);
  }

  onSpeedChange(multiplier: number): void {
    this.deckService.setSpeed(this.deck().slot, multiplier);
  }

  onSpeedJump(id: string): void {
    if (isSpeedJump(id)) {
      this.deckService.jumpSpeed(this.deck().slot, id);
    }
  }

  onVoiceMutedChange({ index, muted }: { index: number; muted: boolean }): void {
    this.deckService.setVoiceMuted(this.deck().slot, index, muted);
  }

  onVoiceHeldChange({ index, held }: { index: number; held: boolean }): void {
    this.deckService.setVoiceHeld(this.deck().slot, index, held);
  }

  onNudgeChange({ direction, held }: { direction: 'up' | 'down'; held: boolean }): void {
    this.deckService.setNudge(this.deck().slot, direction, held);
  }

  onPortSelect(id: string): void {
    this.deckService.bindDevice(this.deck().slot, id || null);
  }

  onEnableMidi(): void {
    void this.deckService.enableMidi();
  }

  onIdentify(): void {
    this.deckService.identify(this.deck().slot);
  }
}
