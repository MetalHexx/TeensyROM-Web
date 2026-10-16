import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  ScalingCompactCardComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import type {
  BindingCardModel,
  BindingPortModel,
  SpeedPanelModel,
  TransportPanelModel,
  VoicePanelModel,
} from '@teensyrom-nx/ui/components';
import { DeckService, DeviceStore, DjStore, cartridgeOptions } from '@teensyrom-nx/application';
import { isDjFileDrag, readDjFileDragData } from '../drag/dj-file-drag';
import type { DeckRef } from '../deck-ref';
import { createDeckPlaceholders } from '../placeholders/deck-placeholders';

/** The speed fader's travel. Display only: the live multiplier can sit outside it after a jump
 *  (0.3x–1.7x), and the thumb pins at the edge while the readout shows the true value. */
const SPEED_FADER_MIN = 0.5;
const SPEED_FADER_MAX = 1.5;

type SpeedJump = 'up' | 'home' | 'down';

/** The speed panel's `jump` id is an opaque string; this is the one place it is narrowed. */
function isSpeedJump(id: string): id is SpeedJump {
  return id === 'up' || id === 'home' || id === 'down';
}

@Component({
  selector: 'lib-dj-deck-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents', '[attr.data-deck]': 'deck().letter' },
  imports: [
    ScalingCompactCardComponent,
    TransportPanelComponent,
    VoicePanelComponent,
    SpeedPanelComponent,
    LoopsCuesPanelComponent,
    BindingCardComponent,
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

  /** Loops/Cues stays on the inert placeholder — present, but not yet wired. */
  readonly models = computed(() => createDeckPlaceholders(this.deck()));

  private readonly summary = computed(() => this.djStore.transportSummary(this.deck().slot)());
  private readonly binding = computed(() => this.djStore.bindingSummary(this.deck().slot)());
  private readonly deckState = computed(() => this.djStore.deck(this.deck().slot)());
  private readonly canShape = computed(() => this.djStore.canShape(this.deck().slot)());

  // Non-null only mid-drag or mid-seek: the pointer's own value pins the thumb so a polled
  // position update can't fight it — the POC transport adapter's pin-until-landed rule, carried
  // over verbatim (see `onScrubCommit`).
  private readonly scrubDragValue = signal<number | null>(null);

  readonly transportModel = computed<TransportPanelModel>(() => {
    const { letter } = this.deck();
    const summary = this.summary();
    return {
      accessibleName: `Transport deck ${letter}`,
      bar: summary.bar,
      scrubAccessibleName: `Position deck ${letter}`,
      transport: { state: summary.led, label: summary.label },
      playPause: { showing: summary.showing, disabled: summary.controlsDisabled },
      canStop: summary.canStop,
      repeatTrack: summary.repeat,
      subtune: {
        text: summary.subtuneText,
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
      errors: summary.errors,
    };
  });

  /** The playhead as a percentage, or the drag pin while one is held. */
  readonly positionPercent = computed(() => this.scrubDragValue() ?? this.summary().scrubPercent);
  readonly frameLabel = computed(() => this.summary().frameLabel);

  readonly speedModel = computed<SpeedPanelModel>(() => {
    const { letter } = this.deck();
    const { speed } = this.deckState();
    return {
      accessibleName: `Speed deck ${letter}`,
      valueText: `${speed.toFixed(3)}x`,
      faderValue: Math.min(Math.max(speed, SPEED_FADER_MIN), SPEED_FADER_MAX),
      faderAccessibleName: `Speed multiplier deck ${letter}`,
      min: SPEED_FADER_MIN,
      max: SPEED_FADER_MAX,
      step: 0.001,
      jumpButtons: [
        { id: 'up', label: '+50%', accessibleName: `Speed up 50% deck ${letter}` },
        { id: 'home', label: 'Home', accessibleName: `Speed home deck ${letter}` },
        { id: 'down', label: '−50%', accessibleName: `Speed down 50% deck ${letter}` },
      ],
      disabled: !this.canShape(),
    };
  });

  readonly voiceModel = computed<VoicePanelModel>(() => {
    const { letter } = this.deck();
    return {
      accessibleName: `Voice deck ${letter}`,
      rows: this.deckState().voices.map(({ muted }, i) => {
        const n = i + 1;
        const holdLabel = muted ? 'Punch' : 'Kill';
        return {
          label: `V${n}`,
          muted,
          holdLabel,
          checkboxId: `voice-${letter}-${n}`,
          muteAccessibleName: `Mute voice ${n} deck ${letter}`,
          holdAccessibleName: `${holdLabel} voice ${n} deck ${letter}`,
        };
      }),
      clearAccessibleName: `Clear all voice mutes deck ${letter}`,
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

  /** Whether the pointer is over this deck's own overlay while a SID drag is in flight. */
  readonly hot = signal(false);

  private dragEnterCount = 0;

  onOverlayDragEnter(event: DragEvent): void {
    if (!event.dataTransfer || !isDjFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    this.dragEnterCount++;
    this.hot.set(true);
  }

  onOverlayDragOver(event: DragEvent): void {
    if (!event.dataTransfer || !isDjFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  onOverlayDragLeave(event: DragEvent): void {
    if (!event.dataTransfer || !isDjFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
    if (this.dragEnterCount === 0) {
      this.hot.set(false);
    }
  }

  /** A drop is a plain load, played or not — no confirmation, no guard here; `DeckService.load`
   *  stops whatever this deck is already playing before it loads the new source. */
  onOverlayDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragEnterCount = 0;
    this.hot.set(false);

    const payload = readDjFileDragData(event.dataTransfer);
    if (payload) {
      void this.deckService.load(this.deck().slot, payload);
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

  onClearVoiceMutes(): void {
    this.deckService.clearVoiceMutes(this.deck().slot);
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
