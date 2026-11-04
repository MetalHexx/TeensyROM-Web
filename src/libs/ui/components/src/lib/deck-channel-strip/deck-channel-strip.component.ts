import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  DeckSettingsSignComponent,
  type DeckSettingsSignModel,
} from '../deck-settings-sign/deck-settings-sign.component';
import { HoldPadComponent } from '../hold-pad/hold-pad.component';
import type { JumpButtonModel } from '../jump-button-group/jump-button-group.component';
import { SynthFaderComponent } from '../synth-fader/synth-fader.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import type { LiveBpmIndicator } from '../shared/live-indicator';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/** One voice's pair of controls: a latching mute key over a Kill/Punch hold pad. */
export interface ChannelStripVoiceModel {
  /** The mute key's label, e.g. 'V1'. */
  readonly label: string;
  /** Whether the voice is muted. The mute key reports it as `aria-pressed`; its light is lit
   *  while the voice is NOT muted, i.e. while it plays. */
  readonly muted: boolean;
  /** Whether the voice's Kill/Punch is held, from the screen or a controller. Lights the pad. */
  readonly held: boolean;
  /** The hold pad's label: 'Kill' | 'Punch'. */
  readonly holdLabel: string;
  /** e.g. 'Mute voice 1 deck A'. */
  readonly muteAccessibleName: string;
  /** e.g. 'Kill voice 1 deck A'. */
  readonly holdAccessibleName: string;
}

/** Everything the channel strip draws. */
export interface DeckChannelStripModel {
  /** The voice section's aria-label, e.g. 'Voice deck A'. */
  readonly voiceAccessibleName: string;
  /** The speed section's aria-label, e.g. 'Speed deck A'. */
  readonly speedAccessibleName: string;
  /** Whose settings are in play; drawn full-width above the first voice. */
  readonly settingsSign: DeckSettingsSignModel;
  readonly voices: readonly ChannelStripVoiceModel[];
  /** The speed being played as signed percent off 1×, e.g. '+1.25%'. */
  readonly speedText: string;
  /** Tints the speed display magenta while a nudge is in effect. */
  readonly nudging: boolean;
  /** Tints the speed display and the Tap key magenta while the deck is tapping. */
  readonly tapping: boolean;
  /** The Tap key's accessible name, e.g. 'Tap the beat deck A'. */
  readonly tapAccessibleName: string;
  /** The speed fader. The caller pins `value` into the travel; a nudge never moves it. */
  readonly fader: {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly home: number;
    readonly accessibleName: string;
    /** What the range announces in place of its number, e.g. '+1.25%'. */
    readonly valueText: string;
  };
  readonly nudge: {
    readonly downAccessibleName: string;
    readonly upAccessibleName: string;
    /** Whether the nudge-down pad is held, from the screen or a controller. Lights the pad. */
    readonly downHeld: boolean;
    /** Whether the nudge-up pad is held, from the screen or a controller. Lights the pad. */
    readonly upHeld: boolean;
  };
  readonly jumpButtons: readonly JumpButtonModel[];
  /** Disables every control; a held pad releases. */
  readonly disabled: boolean;
}

/** What the BPM line shows until a painter sets it; matches the template's initial figure and
 *  `data-none`. */
const NO_BPM_TEXT = '---.-- BPM';

/**
 * One deck's voice-and-speed channel strip on a single faceplate: a sign naming whose settings are
 * in play, three voice pairs (a latching mute key over a Kill/Punch hold pad), the speed display, a
 * hardware-drawn speed fader that is still a native range, the speed-nudge pads and the jump keys.
 * The speed display carries the deck's BPM under the percent, and a Tap key sits under the display.
 * Purely presentational — it keeps no state and the caller feeds every value back through
 * `model`. It is sized for the roughly 88px voice-and-speed column and fills that column's height.
 *
 * The BPM is position-dependent, so it is not in `model`: a painter sets it through `setLiveBpm`,
 * straight on the DOM, outside change detection. The line is the figure plus a fixed "BPM" unit,
 * dimmed while no beat is found.
 *
 * @example
 * ```html
 * <lib-deck-channel-strip
 *   [model]="stripModel()"
 *   (mutedChange)="onMute($event)"
 *   (heldChange)="onHold($event)"
 *   (faderChange)="onSpeed($event)"
 *   (nudgeChange)="onNudge($event)"
 *   (jump)="onJump($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-deck-channel-strip',
  templateUrl: './deck-channel-strip.component.html',
  styleUrl: './deck-channel-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SynthPanelComponent,
    SynthKeyComponent,
    HoldPadComponent,
    SynthFaderComponent,
    DeckSettingsSignComponent,
  ],
})
export class DeckChannelStripComponent implements LiveBpmIndicator {
  private readonly bpm = viewChild.required<ElementRef<HTMLElement>>('bpm');
  private readonly bpmLine = viewChild.required<ElementRef<HTMLElement>>('bpmLine');
  private liveBpm = NO_BPM_TEXT;

  /** Everything the strip draws; the caller builds it from the deck's store state. */
  readonly model = input.required<DeckChannelStripModel>();
  /** A mute key was pressed, carrying the voice's index and the mute it should now have. */
  readonly mutedChange = output<{ index: number; muted: boolean }>();
  /** A voice's Kill/Punch pad was pressed (`held: true`) or released (`held: false`). */
  readonly heldChange = output<{ index: number; held: boolean }>();
  /** The fader moved; the raw, unrounded value. */
  readonly faderChange = output<number>();
  /** The wheel turned over the fader: whole clicks, upward positive, with the event's time. */
  readonly faderWheel = output<{ clicks: number; timeStampMs: number }>();
  /** A nudge pad was pressed or released, including a release forced by the strip being disabled. */
  readonly nudgeChange = output<{ direction: 'up' | 'down'; held: boolean }>();
  /** A jump key was pressed, carrying its `id`. */
  readonly jump = output<string>();
  /** The Tap key was pressed. */
  readonly tap = output<void>();

  /** Sets the BPM line under the speed percent from e.g. '125.31 BPM' or '---.-- BPM'. Only the
   *  figure is written; the unit is fixed markup. `data-none` follows whether no beat is found.
   *  Deliberately not a field of `model`: the tempo follows the playhead, and a binding would put
   *  change detection on every frame. Writes straight to the DOM, and only a changed text. Valid
   *  once the view has rendered. */
  setLiveBpm(text: string): void {
    if (text === this.liveBpm) {
      return;
    }
    const noneFlips = (text === NO_BPM_TEXT) !== (this.liveBpm === NO_BPM_TEXT);
    this.liveBpm = text;
    this.bpm().nativeElement.textContent = text.replace(/ BPM$/, '');
    if (noneFlips) {
      this.bpmLine().nativeElement.toggleAttribute('data-none', text === NO_BPM_TEXT);
    }
  }
}
