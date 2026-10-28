import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  DjStore,
  MixerService,
  PANEL_RANGES,
  SidPanelPainter,
  type DeckPanelState,
  type DeckPanelTargets,
  type FilterKnob,
  type KeyDisplayFormat,
  type PanelFilterMode,
  type PanelRange,
  type PanelWaveform,
  type SettingsInPlaySummary,
  type Slot,
  type VoiceKnob,
  type VoiceSwitch,
  VOICE_NUMBERS,
} from '@teensyrom-nx/application';
import {
  DeckLabelComponent,
  IconButtonComponent,
  PanelSectionComponent,
  PanicButtonComponent,
  RotaryKnobComponent,
  ScalingContainerComponent,
  SegmentedControlComponent,
  SidFilterSectionComponent,
  SidVoiceStripComponent,
  SynthPanelComponent,
  type PanelKnobModel,
  type SegmentedControlOption,
  type SidFilterSectionModel,
  type SidVoiceStripModel,
} from '@teensyrom-nx/ui/components';
import {
  DeckSettingsSignComponent,
  type DeckSettingsSignModel,
} from '@teensyrom-nx/ui/components/dj';
import type { DeckRef } from '../deck-ref';
import { settingsSignModel } from '../settings-sign-model';

const KEY_FORMAT_OPTIONS: readonly SegmentedControlOption[] = [
  { id: 'camelot', label: 'Camelot' },
  { id: 'note', label: 'Note' },
];

function isKeyDisplayFormat(id: string): id is KeyDisplayFormat {
  return id === 'camelot' || id === 'note';
}

/** What one deck's Key knob shows. */
interface KeyKnobView {
  readonly value: number;
  readonly readout: string;
  readonly accessibleName: string;
}

/** One deck's half of the panel, built from the store. */
interface DeckPanelView {
  readonly deck: DeckRef;
  readonly voices: readonly { readonly number: number; readonly model: SidVoiceStripModel }[];
  readonly filter: SidFilterSectionModel;
  readonly key: KeyKnobView;
  readonly disabled: boolean;
  /** The lower row's sections left to right: Filter then Key on the first deck, mirrored on the
   *  second, so the two Key sections sit nearest the divider. */
  readonly lowerOrder: readonly ('filter' | 'key')[];
  readonly panicName: string;
  readonly sign: DeckSettingsSignModel;
}

function knob(
  range: PanelRange,
  value: number,
  accessibleName: string,
  valueUnit?: string
): PanelKnobModel {
  return {
    value,
    min: range.min,
    max: range.max,
    home: range.home,
    // Fine has no step: a drag keeps full resolution, and the arrow keys move one cent.
    step: range.step ?? 1,
    accessibleName,
    valueUnit,
  };
}

function buildDeckPanel(
  deck: DeckRef,
  panel: DeckPanelState,
  disabled: boolean,
  keyReadout: string,
  settingsInPlay: SettingsInPlaySummary
): DeckPanelView {
  const name = `Deck ${deck.letter}`;
  return {
    deck,
    disabled,
    voices: panel.voices.map((voice, i) => {
      const number = i + 1;
      const prefix = `${name} voice ${number}`;
      return {
        number,
        model: {
          title: `Voice ${number}`,
          knobs: {
            coarse: knob(PANEL_RANGES.coarse, voice.coarse, `${prefix} coarse`, 'semitones'),
            fine: knob(PANEL_RANGES.fine, voice.fine, `${prefix} fine`, 'cents'),
            pulseWidth: knob(PANEL_RANGES.pulseWidth, voice.pulseWidth, `${prefix} pulse width`),
            attack: knob(PANEL_RANGES.attack, voice.attack, `${prefix} attack`),
            decay: knob(PANEL_RANGES.decay, voice.decay, `${prefix} decay`),
            sustain: knob(PANEL_RANGES.sustain, voice.sustain, `${prefix} sustain`),
            release: knob(PANEL_RANGES.release, voice.release, `${prefix} release`),
          },
          waveformLock: voice.waveformLock,
          waveformNames: {
            triangle: `${prefix} triangle`,
            sawtooth: `${prefix} sawtooth`,
            pulse: `${prefix} pulse`,
            noise: `${prefix} noise`,
          },
          switches: {
            ring: { locked: voice.ringLock !== null, accessibleName: `${prefix} ring` },
            sync: { locked: voice.syncLock !== null, accessibleName: `${prefix} sync` },
            filter: { locked: voice.filterLock !== null, accessibleName: `${prefix} filter` },
          },
          disabled,
        },
      };
    }),
    filter: {
      cutoff: knob(PANEL_RANGES.cutoff, panel.cutoff, `${name} filter cutoff`),
      resonance: knob(PANEL_RANGES.resonance, panel.resonance, `${name} filter resonance`),
      modeLock: panel.filterModeLock,
      modeNames: {
        'low-pass': `${name} filter low-pass`,
        'band-pass': `${name} filter band-pass`,
        'high-pass': `${name} filter high-pass`,
      },
      disabled,
    },
    key: {
      value: panel.keySemitones,
      readout: keyReadout,
      accessibleName: `${name} key`,
    },
    lowerOrder: deck.index % 2 === 0 ? ['filter', 'key'] : ['key', 'filter'],
    panicName: `${name} panic: return the panel to home`,
    sign: settingsSignModel(deck, settingsInPlay),
  };
}

/**
 * The SID panel: both decks' voice strips, filter and Key sections, Panic buttons and deck labels,
 * with the bindings button and the Camelot / Note switch at the faceplate's centre. It builds each
 * control's model from `DjStore`, sends what the hand did to `MixerService`, and hands every
 * control's live indicators to `SidPanelPainter`.
 */
@Component({
  selector: 'lib-dj-sid-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScalingContainerComponent,
    SynthPanelComponent,
    DeckLabelComponent,
    DeckSettingsSignComponent,
    IconButtonComponent,
    PanelSectionComponent,
    PanicButtonComponent,
    RotaryKnobComponent,
    SegmentedControlComponent,
    SidFilterSectionComponent,
    SidVoiceStripComponent,
  ],
  templateUrl: './dj-sid-panel.component.html',
  styleUrl: './dj-sid-panel.component.scss',
})
export class DjSidPanelComponent {
  private readonly store = inject(DjStore);
  private readonly mixer = inject(MixerService);
  private readonly painter = inject(SidPanelPainter);

  readonly decks = input.required<readonly DeckRef[]>();

  /** Whether the bindings panel is open: the button's pressed look and its accessible name. */
  readonly bindingsOpen = input<boolean>(false);

  /** Emits when the bindings button is pressed, to open or close the panel. */
  readonly bindingsToggle = output<void>();

  /** Whether the browser (trees, listing and set card) is shown: the button's lit look and name. */
  readonly browserShown = input<boolean>(true);

  /** Emits when the browser button is pressed, to hide or show the browser. */
  readonly browserToggle = output<void>();

  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly voiceStrips = viewChildren(SidVoiceStripComponent);
  private readonly filterSections = viewChildren(SidFilterSectionComponent);

  protected readonly keyRange = PANEL_RANGES.key;
  protected readonly keyFormatOptions = KEY_FORMAT_OPTIONS;
  protected readonly keyDisplayFormat = this.store.keyDisplayFormat;

  private readonly deckSources = computed(() =>
    this.decks().map((deck) => ({
      deck,
      panel: this.store.deckPanel(deck.slot),
      canShape: this.store.canShape(deck.slot),
      keyReadout: this.store.keyReadout(deck.slot),
      settingsInPlay: this.store.settingsInPlay(deck.slot),
    }))
  );

  protected readonly panels = computed<readonly DeckPanelView[]>(() =>
    this.deckSources().map(({ deck, panel, canShape, keyReadout, settingsInPlay }) =>
      buildDeckPanel(deck, panel(), !canShape(), keyReadout(), settingsInPlay())
    )
  );

  constructor() {
    const detaches: (() => void)[] = [];

    afterNextRender(() => {
      const strips = this.voiceStrips();
      const sections = this.filterSections();
      this.decks().forEach(({ slot }, deckIndex) => {
        const filter = sections[deckIndex]?.liveTargets();
        const voices = strips
          .slice(deckIndex * VOICE_NUMBERS.length, (deckIndex + 1) * VOICE_NUMBERS.length)
          .map((strip) => strip.liveTargets());
        if (!filter || voices.length !== VOICE_NUMBERS.length) return;
        const targets: DeckPanelTargets = {
          voices,
          cutoff: filter.cutoff,
          resonance: filter.resonance,
          filterModes: filter.modes,
        };
        detaches.push(this.painter.attach(slot, targets));
      });
    });

    inject(DestroyRef).onDestroy(() => detaches.forEach((detach) => detach()));
  }

  /** Moves keyboard focus to the bindings button. */
  focusBindingsButton(): void {
    this.header().nativeElement.querySelector<HTMLElement>('.bindings-button button')?.focus();
  }

  protected onVoiceKnob(
    slot: Slot,
    voice: number,
    event: { knob: VoiceKnob; value: number }
  ): void {
    this.mixer.setVoiceKnob(slot, voice, event.knob, event.value);
  }

  protected onWaveform(slot: Slot, voice: number, waveform: PanelWaveform): void {
    this.mixer.pressWaveform(slot, voice, waveform);
  }

  protected onSwitch(slot: Slot, voice: number, sw: VoiceSwitch): void {
    this.mixer.pressSwitch(slot, voice, sw);
  }

  protected onFilterKnob(slot: Slot, event: { knob: FilterKnob; value: number }): void {
    this.mixer.setFilterKnob(slot, event.knob, event.value);
  }

  protected onFilterMode(slot: Slot, mode: PanelFilterMode): void {
    this.mixer.pressFilterMode(slot, mode);
  }

  protected onKey(slot: Slot, semitones: number): void {
    this.mixer.setKeySemitones(slot, semitones);
  }

  protected onPanic(slot: Slot): void {
    this.mixer.panic(slot);
  }

  protected onKeyFormat(id: string): void {
    if (isKeyDisplayFormat(id)) {
      this.mixer.setKeyDisplayFormat(id);
    }
  }
}
