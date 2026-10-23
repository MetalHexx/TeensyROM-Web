import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HoldPadComponent } from '../hold-pad/hold-pad.component';
import type { JumpButtonModel } from '../jump-button-group/jump-button-group.component';
import { SynthFaderComponent } from '../synth-fader/synth-fader.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/** One voice's pair of controls: a latching mute key over a Kill/Punch hold pad. */
export interface ChannelStripVoiceModel {
  /** The mute key's label, e.g. 'V1'. */
  readonly label: string;
  /** Whether the voice is muted. The mute key reports it as `aria-pressed`; its light is lit
   *  while the voice is NOT muted, i.e. while it plays. */
  readonly muted: boolean;
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
  readonly voices: readonly ChannelStripVoiceModel[];
  /** The speed being played, e.g. '1.000×'. */
  readonly speedText: string;
  /** Tints the speed display magenta while a nudge is in effect. */
  readonly nudging: boolean;
  /** The speed fader. The caller pins `value` into the travel; a nudge never moves it. */
  readonly fader: {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly home: number;
    readonly accessibleName: string;
  };
  readonly nudge: { readonly downAccessibleName: string; readonly upAccessibleName: string };
  readonly jumpButtons: readonly JumpButtonModel[];
  /** Disables every control; a held pad releases. */
  readonly disabled: boolean;
}

/**
 * One deck's voice-and-speed channel strip on a single faceplate: three voice pairs (a latching
 * mute key over a Kill/Punch hold pad), the speed display, a hardware-drawn speed fader that is
 * still a native range, the speed-nudge pads and the jump keys. Purely presentational — it keeps
 * no state and the caller feeds every value back through `model`. It is sized for the roughly 88px
 * voice-and-speed column and fills that column's height.
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
  imports: [SynthPanelComponent, SynthKeyComponent, HoldPadComponent, SynthFaderComponent],
})
export class DeckChannelStripComponent {
  readonly model = input.required<DeckChannelStripModel>();
  /** A mute key was pressed, carrying the voice's index and the mute it should now have. */
  readonly mutedChange = output<{ index: number; muted: boolean }>();
  /** A voice's Kill/Punch pad was pressed (`held: true`) or released (`held: false`). */
  readonly heldChange = output<{ index: number; held: boolean }>();
  /** The fader moved; the raw, unrounded value. */
  readonly faderChange = output<number>();
  /** A nudge pad was pressed or released, including a release forced by the strip being disabled. */
  readonly nudgeChange = output<{ direction: 'up' | 'down'; held: boolean }>();
  /** A jump key was pressed, carrying its `id`. */
  readonly jump = output<string>();
}
