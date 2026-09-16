import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  ScalingCompactCardComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import type { BindingCardModel, TransportPanelModel } from '@teensyrom-nx/ui/components';
import { DeckService, DjStore } from '@teensyrom-nx/application';
import { isDjFileDrag, readDjFileDragData } from '../drag/dj-file-drag';
import type { DeckRef } from '../deck-ref';
import { createDeckPlaceholders } from '../placeholders/deck-placeholders';

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
  private readonly deckService = inject(DeckService);

  readonly deck = input.required<DeckRef>();

  /** Whether a SID drag is currently in flight anywhere in the view — lights this deck's overlay. */
  readonly dropActive = input<boolean>(false);

  /** Voice, Speed and Loops/Cues stay on the inert placeholders — present, but not yet wired. */
  readonly models = computed(() => createDeckPlaceholders(this.deck()));

  private readonly summary = computed(() => this.djStore.transportSummary(this.deck().slot)());
  private readonly binding = computed(() => this.djStore.bindingSummary(this.deck().slot)());

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

  readonly bindingModel = computed<BindingCardModel>(() => {
    const { letter } = this.deck();
    const binding = this.binding();
    return {
      accessibleName: `MIDI binding deck ${letter}`,
      heading: `Deck ${letter}`,
      ports: binding.portOptions.map((option) => ({
        id: option.id,
        label: option.label,
        takenBy: option.takenBy ?? undefined,
      })),
      selectedPortId: binding.selectedPortId,
      portsEnabled: binding.portsEnabled,
      portPlaceholder: binding.portPlaceholder,
      enableDisabled: binding.enableDisabled,
      identifyDisabled: binding.identifyDisabled,
      selectAccessibleName: `Output port deck ${letter}`,
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
    const slot = this.deck().slot;
    void this.deckService.selectSubtune(slot, this.djStore.deck(slot)().subtune - 1);
  }

  onNextSubtune(): void {
    const slot = this.deck().slot;
    void this.deckService.selectSubtune(slot, this.djStore.deck(slot)().subtune + 1);
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

  onPortSelect(id: string): void {
    void this.deckService.bindPort(this.deck().slot, id || null);
  }

  onEnableMidi(): void {
    void this.deckService.enableMidi();
  }

  onIdentify(): void {
    this.deckService.identify(this.deck().slot);
  }
}
