import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LedSwitchComponent } from '../led-switch/led-switch.component';
import { PanelSectionComponent } from '../panel-section/panel-section.component';
import { RotaryKnobComponent } from '../rotary-knob/rotary-knob.component';
import type { LiveLevelIndicator, LiveLightIndicator } from '../shared/live-indicator';
import type { PanelKnobModel } from '../shared/panel-knob.types';
import { VoiceWaveComponent } from '../voice-wave/voice-wave.component';
import { WaveformButtonComponent, WaveformKind } from '../waveform-button/waveform-button.component';

export type SidVoiceKnob =
  | 'coarse'
  | 'fine'
  | 'pulseWidth'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release';
export type SidVoiceSwitch = 'ring' | 'sync' | 'filter';

/** Everything one voice strip draws; the application owns every value in it. */
export interface SidVoiceStripModel {
  /** e.g. 'Voice 1'. */
  readonly title: string;
  readonly knobs: Readonly<Record<SidVoiceKnob, PanelKnobModel>>;
  /** The waveform the tune holds the operator off, or null. */
  readonly waveformLock: WaveformKind | null;
  /** Accessible names of the four waveform buttons. */
  readonly waveformNames: Readonly<Record<WaveformKind, string>>;
  readonly switches: Readonly<
    Record<SidVoiceSwitch, { readonly locked: boolean; readonly accessibleName: string }>
  >;
  readonly disabled: boolean;
  /** The fed bank and voice the strip's waveform window shows; without it the strip has no window. */
  readonly wave?: { readonly bank: string; readonly voice: 0 | 1 | 2 };
}

/** The strip's live indicators, in the order a painter addresses them. */
export interface SidVoiceStripLiveTargets {
  /** Triangle, sawtooth, pulse, noise. */
  readonly waveforms: readonly [
    LiveLightIndicator,
    LiveLightIndicator,
    LiveLightIndicator,
    LiveLightIndicator,
  ];
  readonly coarse: LiveLevelIndicator;
  readonly fine: LiveLevelIndicator;
  readonly pulseWidth: LiveLevelIndicator;
  readonly attack: LiveLevelIndicator;
  readonly decay: LiveLevelIndicator;
  readonly sustain: LiveLevelIndicator;
  readonly release: LiveLevelIndicator;
  readonly ring: LiveLightIndicator;
  readonly sync: LiveLightIndicator;
  readonly filter: LiveLightIndicator;
}

const WAVEFORMS: readonly WaveformKind[] = ['triangle', 'sawtooth', 'pulse', 'noise'];

/**
 * One SID voice's panel strip: an optional waveform window (when the model carries `wave`), four
 * waveform buttons, Coarse and Fine, pulse width, A/D/S/R and the Ring/Sync/Filt switches, composed from the shared knob and the panel parts. It holds no state:
 * the application feeds it a `model` and reacts to what the hand did through `knobChange`,
 * `waveformPress` and `switchPress`. A painter sets the live indicators through the instances
 * `liveTargets()` returns. The feature sets `data-voice` on the strip's host.
 *
 * @example
 * ```html
 * <lib-sid-voice-strip
 *   [attr.data-voice]="1"
 *   [model]="voiceModel()"
 *   (knobChange)="onKnob($event)"
 *   (waveformPress)="onWaveform($event)"
 *   (switchPress)="onSwitch($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-sid-voice-strip',
  imports: [
    PanelSectionComponent,
    VoiceWaveComponent,
    WaveformButtonComponent,
    RotaryKnobComponent,
    LedSwitchComponent,
  ],
  templateUrl: './sid-voice-strip.component.html',
  styleUrl: './sid-voice-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidVoiceStripComponent {
  readonly model = input.required<SidVoiceStripModel>();
  /** Emits the knob's id and its new position. */
  readonly knobChange = output<{ knob: SidVoiceKnob; value: number }>();
  /** Emits the pressed waveform. */
  readonly waveformPress = output<WaveformKind>();
  /** Emits the pressed switch. */
  readonly switchPress = output<SidVoiceSwitch>();

  protected readonly waveforms = WAVEFORMS;

  private readonly waveformButtons = viewChildren(WaveformButtonComponent);
  private readonly coarse = viewChild.required<RotaryKnobComponent>('coarse');
  private readonly fine = viewChild.required<RotaryKnobComponent>('fine');
  private readonly pulseWidth = viewChild.required<RotaryKnobComponent>('pulseWidth');
  private readonly attack = viewChild.required<RotaryKnobComponent>('attack');
  private readonly decay = viewChild.required<RotaryKnobComponent>('decay');
  private readonly sustain = viewChild.required<RotaryKnobComponent>('sustain');
  private readonly release = viewChild.required<RotaryKnobComponent>('release');
  private readonly ring = viewChild.required<LedSwitchComponent>('ring');
  private readonly sync = viewChild.required<LedSwitchComponent>('sync');
  private readonly filter = viewChild.required<LedSwitchComponent>('filter');

  /** The strip's live indicators, for a painter. Valid once the view has rendered; returns the
   *  same instances on every call. */
  liveTargets(): SidVoiceStripLiveTargets {
    const [triangle, sawtooth, pulse, noise] = this.waveformButtons();
    return {
      waveforms: [triangle, sawtooth, pulse, noise],
      coarse: this.coarse(),
      fine: this.fine(),
      pulseWidth: this.pulseWidth(),
      attack: this.attack(),
      decay: this.decay(),
      sustain: this.sustain(),
      release: this.release(),
      ring: this.ring(),
      sync: this.sync(),
      filter: this.filter(),
    };
  }
}
