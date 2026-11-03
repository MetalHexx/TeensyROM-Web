import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
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
  LoopEdgeMove,
  LoopSelectedRowModel,
  LoopTileModel,
  LoopsCuesPlateModel,
} from '@teensyrom-nx/ui/components/dj';
import {
  DeckService,
  DeviceStore,
  DjStore,
  MARKER_NAME_MAX_LENGTH,
  PlayheadPainter,
  SPEED_FADER_RANGE,
  formatSpeedPercent,
  type DeckTransportSummary,
  type LoopActivity,
  type LoopBoundaryName,
  type LoopBoundarySummary,
  type LoopItemSummary,
  type MoveStep,
  type LoopMoveStepOption,
  type LoopSelectionSummary,
  cartridgeOptions,
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

/** A boundary model from its summary; null is a cue's End or an empty row: drawn empty, inert. The
 *  key is enabled whenever a marker is selected: Out on a cue makes it a loop. */
function boundaryModel(
  boundary: LoopBoundaryName,
  letter: string,
  name: string,
  selected: boolean,
  summary: LoopBoundarySummary | null
): LoopBoundaryModel {
  const isStart = boundary === 'start';
  const word = isStart ? 'start' : 'end';
  return {
    key: {
      label: isStart ? 'In' : 'Out',
      accessibleName: `Loop ${isStart ? 'in' : 'out'} ${name} deck ${letter}`,
      control: isStart ? 'loop-in' : 'loop-set-end',
      disabled: !selected,
    },
    empty: summary === null,
    disabled: !selected,
    offsetFrames: summary?.offsetFrames ?? 0,
    rangeFrames: summary?.rangeFrames ?? 0,
    tickPercents: summary?.tickPercents ?? [],
    nudgeAccessibleName: `Nudge ${word} deck ${letter}`,
    earlierAccessibleName: `Move ${word} of ${name} earlier deck ${letter}`,
    laterAccessibleName: `Move ${word} of ${name} later deck ${letter}`,
  };
}

function selectedRowModel(
  selection: LoopSelectionSummary | null,
  moveStepText: string,
  moveStepOptions: readonly LoopMoveStepOption[],
  letter: string
): LoopSelectedRowModel {
  const name = selection?.name ?? 'selected marker';
  const selected = selection !== null;
  return {
    id: selection?.id ?? null,
    empty: selection === null,
    name: selection?.name ?? '',
    kindLabel: selection === null ? '' : selection.kind === 'loop' ? 'LOOP' : 'CUE',
    spanText: selection?.spanText ?? '',
    activity: selection?.activity ?? 'idle',
    ready: selection?.ready ?? true,
    triggerDisabled: selection === null,
    clearEndDisabled: selection?.kind !== 'loop',
    deleteDisabled: selection === null,
    playNowDisabled: selection === null,
    playNowAccessibleName: `Play now ${name} deck ${letter}`,
    sharesGlobal: selection?.sharesGlobal ?? true,
    globalDisabled: selection === null,
    globalAccessibleName: `GBL ${name} deck ${letter}`,
    wraps: selection?.wraps ?? false,
    wrapDisabled: selection?.kind !== 'loop',
    wrapAccessibleName: `WRAP ${name} deck ${letter}`,
    renameDisabled: selection === null,
    renameLabel: `Rename ${name}`,
    nameMaxLength: MARKER_NAME_MAX_LENGTH,
    start: boundaryModel('start', letter, name, selected, selection?.start ?? null),
    end: boundaryModel('end', letter, name, selected, selection?.end ?? null),
    length: {
      text: selection?.lengthText ?? '—',
      options: selection?.lengthOptions ?? [],
      halveAccessibleName: `Halve ${name} deck ${letter}`,
      doubleAccessibleName: `Double ${name} deck ${letter}`,
      pickAccessibleName: `Loop length ${name} deck ${letter}`,
    },
    move: {
      stepText: moveStepText,
      options: moveStepOptions,
      earlierAccessibleName: `Move ${name} earlier deck ${letter}`,
      laterAccessibleName: `Move ${name} later deck ${letter}`,
      pickAccessibleName: `Move step deck ${letter}`,
    },
    triggerAccessibleName: `Trigger ${name} deck ${letter}`,
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
  private readonly playheadPainter = inject(PlayheadPainter);

  readonly deck = input.required<DeckRef>();

  /** Whether a SID drag is currently in flight anywhere in the view — lights this deck's overlay. */
  readonly dropActive = input<boolean>(false);

  /** The playhead readouts' targets: `PlayheadPainter` writes the transport's position, elapsed
   *  time and frame, the running tile's lap and the speed display's BPM, straight to them. */
  private readonly transport = viewChild.required(DeckTransportComponent);
  private readonly loopsPlate = viewChild.required(LoopsCuesPlateComponent);
  private readonly channelStrip = viewChild.required(DeckChannelStripComponent);

  /** Never reads the playhead, so `transportModel` keeps its identity while the deck plays. */
  private readonly summary = computed(() => this.djStore.transportSummary(this.deck().slot)());
  private readonly binding = computed(() => this.djStore.bindingSummary(this.deck().slot)());
  private readonly deckState = computed(() => this.djStore.deck(this.deck().slot)());
  private readonly settingsInPlay = computed(() => this.djStore.settingsInPlay(this.deck().slot)());
  private readonly canShape = computed(() => this.djStore.canShape(this.deck().slot)());
  private readonly deckSet = computed(() => this.djStore.deckSetSummary(this.deck().slot)());

  /** Never reads the playhead, so the tiles and the selected row do not rebuild on a frame tick. */
  readonly loops = computed(() => this.djStore.loopsSummary(this.deck().slot)());

  // Non-null only while a nudge strip is being dragged: the pointer's offset pins the boundary
  // readout until the nudge is committed or the selection moves on.
  readonly startDragOffset = signal<number | null>(null);
  readonly endDragOffset = signal<number | null>(null);

  readonly plateModel = computed<LoopsCuesPlateModel>(() => {
    const { letter } = this.deck();
    const { hasTune, canAdd, canDuplicate, canStop, items, selected, moveStepText, moveStepOptions } =
      this.loops();
    return {
      accessibleName: `Loops/Cues deck ${letter}`,
      addAccessibleName: `Add cue deck ${letter}`,
      stopAccessibleName: `Stop loop deck ${letter}`,
      duplicateAccessibleName: `Duplicate deck ${letter}`,
      addDisabled: !canAdd,
      duplicateDisabled: !canDuplicate,
      stopDisabled: !canStop,
      gridAccessibleName: `Loops deck ${letter}`,
      emptyText: hasTune ? 'Add a cue at the playhead' : 'Load a tune to add loops',
      selected: selectedRowModel(selected, moveStepText, moveStepOptions, letter),
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

    let detach: (() => void) | null = null;
    afterNextRender(() => {
      detach = this.playheadPainter.attach(this.deck().slot, {
        transport: this.transport(),
        loops: this.loopsPlate(),
        speed: this.channelStrip(),
      });
    });
    inject(DestroyRef).onDestroy(() => detach?.());
  }

  // Non-null only mid-drag or mid-seek: the pointer's own value pins the transport's readouts, in
  // the painter, so the moving playhead can't fight it — the POC transport adapter's
  // pin-until-landed rule, carried over verbatim (see `onScrubCommit`).
  private scrubDragValue: number | null = null;

  readonly transportModel = computed<DeckTransportModel>(() => {
    const { letter } = this.deck();
    const summary = this.summary();
    const set = this.deckSet();
    const state: DeckTransportState =
      summary.status === 'empty' ? 'empty' : transportState(summary.led);
    return {
      accessibleName: `Transport deck ${letter}`,
      state,
      stateLabel: summary.held ? 'Held' : STATE_LABELS[state],
      held: summary.held,
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

  readonly channelModel = computed<DeckChannelStripModel>(() => {
    const { letter } = this.deck();
    const { speed, faderSpeed, nudging, nudgeHeld, tapping, voices } = this.deckState();
    return {
      settingsSign: settingsSignModel(this.deck(), this.settingsInPlay()),
      voiceAccessibleName: `Voice deck ${letter}`,
      speedAccessibleName: `Speed deck ${letter}`,
      voices: voices.map(({ muted, held }, i) => {
        const n = i + 1;
        const holdLabel = muted ? 'Punch' : 'Kill';
        return {
          label: `V${n}`,
          muted,
          held,
          holdLabel,
          muteAccessibleName: `Mute voice ${n} deck ${letter}`,
          holdAccessibleName: `${holdLabel} voice ${n} deck ${letter}`,
        };
      }),
      speedText: formatSpeedPercent(speed),
      nudging,
      tapping,
      tapAccessibleName: `Tap the beat deck ${letter}`,
      fader: {
        value: Math.min(Math.max(faderSpeed, SPEED_FADER_RANGE.min), SPEED_FADER_RANGE.max),
        min: SPEED_FADER_RANGE.min,
        max: SPEED_FADER_RANGE.max,
        step: 0.0001,
        home: SPEED_FADER_RANGE.home,
        accessibleName: `Speed multiplier deck ${letter}`,
        valueText: formatSpeedPercent(faderSpeed),
      },
      nudge: {
        downAccessibleName: `Nudge down deck ${letter}`,
        upAccessibleName: `Nudge up deck ${letter}`,
        downHeld: nudgeHeld.down,
        upHeld: nudgeHeld.up,
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

  /** Pins the thumb, the elapsed time and the frame at the dragged value for as long as the drag
   *  lasts. */
  onScrubInput(value: number): void {
    this.pinScrub(value);
  }

  /** The release, not every drag tick. The pin stays set — holding the readouts at the released
   *  spot — until the seek actually lands, guarded on the pin still being this call's own value so
   *  a superseded scrub settling late cannot clear a newer one's pin out from under it. Clearing it
   *  repaints the landed playhead at once. */
  async onScrubCommit(value: number): Promise<void> {
    this.pinScrub(value);
    await this.deckService.seek(this.deck().slot, value);
    if (this.scrubDragValue === value) {
      this.pinScrub(null);
    }
  }

  onAddMarker(): void {
    this.deckService.addMarker(this.deck().slot);
  }

  onDuplicateMarker(): void {
    this.deckService.duplicateMarker(this.deck().slot);
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

  onToggleWrap(): void {
    this.deckService.toggleMarkerWrap(this.deck().slot);
  }

  onSelectTile(id: string): void {
    this.deckService.selectMarker(this.deck().slot, id);
  }

  onSetIn(): void {
    this.deckService.setMarkerIn(this.deck().slot);
  }

  onSetOut(): void {
    this.deckService.setMarkerOut(this.deck().slot);
  }

  onHalve(): void {
    this.deckService.resizeMarker(this.deck().slot, 'halve');
  }

  onDouble(): void {
    this.deckService.resizeMarker(this.deck().slot, 'double');
  }

  onPickLength(beats: number): void {
    this.deckService.setMarkerLength(this.deck().slot, beats);
  }

  onMoveEarlier(): void {
    this.deckService.moveMarker(this.deck().slot, -1);
  }

  onMoveLater(): void {
    this.deckService.moveMarker(this.deck().slot, 1);
  }

  onPickMoveStep(step: MoveStep): void {
    this.deckService.setMoveStep(this.deck().slot, step);
  }

  onClearEnd(): void {
    this.deckService.clearMarkerEnd(this.deck().slot);
  }

  onRenameSelected({ id, name }: { id: string; name: string }): void {
    this.deckService.renameMarker(this.deck().slot, id, name);
  }

  onDeleteSelected(): void {
    this.deckService.deleteMarker(this.deck().slot);
  }

  onMoveEdge({ boundary, direction }: LoopEdgeMove): void {
    this.deckService.moveMarkerEdge(this.deck().slot, boundary, direction);
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

  onSpeedWheel({ clicks, timeStampMs }: { clicks: number; timeStampMs: number }): void {
    this.deckService.turnSpeed(this.deck().slot, clicks, timeStampMs);
  }

  onSpeedJump(id: string): void {
    if (isSpeedJump(id)) {
      this.deckService.jumpSpeed(this.deck().slot, id);
    }
  }

  onTap(): void {
    this.deckService.tap(this.deck().slot);
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

  /** Records the pin and hands it to the painter, which paints it — or, cleared, the playhead —
   *  at once. */
  private pinScrub(value: number | null): void {
    this.scrubDragValue = value;
    this.playheadPainter.pin(this.deck().slot, value);
  }
}
