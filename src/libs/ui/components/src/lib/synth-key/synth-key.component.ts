import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * A raised dark DJ key with an uppercase mono label and an optional icon. It is a native button,
 * so Enter and Space press it and it sits in the tab order, and it keeps no state of its own: the
 * caller reports presses through `press` and feeds the state back.
 *
 * Three kinds, by `latched`: a one-shot key (`null`, no light), or a latching key
 * (`true`/`false`, exposed as `aria-pressed` and lit cyan while true). `lit` overrides the light
 * when it means something other than the pressed state, and `stateLight` draws a green / amber /
 * dark bar along the top for Play/Pause.
 *
 * The label can be hidden without touching the accessible name by setting the custom property
 * `--synth-key-label-display: none` on the key's host — a parent's container query can drive it.
 *
 * @example
 * ```html
 * <lib-synth-key
 *   label="Play"
 *   icon="play_arrow"
 *   accessibleName="Play deck A"
 *   [stateLight]="playing() ? 'playing' : 'paused'"
 *   (press)="onPlay()"
 * />
 * ```
 */
@Component({
  selector: 'lib-synth-key',
  imports: [MatIconModule],
  templateUrl: './synth-key.component.html',
  styleUrl: './synth-key.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SynthKeyComponent {
  /** Uppercase mono label. May be empty for an icon-only key. */
  readonly label = input<string>('');
  /** Material icon ligature, e.g. 'play_arrow'. */
  readonly icon = input<string | null>(null);
  /** Accessible name, e.g. 'Play deck A'; the caller composes it. */
  readonly accessibleName = input.required<string>();
  /** Disables the button: dimmed, no light, no `press`. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** `null`: a one-shot key with no light. `true`/`false`: a latching key, exposed as
   *  `aria-pressed` and lit cyan while true unless `lit` says otherwise. */
  readonly latched = input<boolean | null>(null);
  /** Overrides the light of a latching key when the light means something other than the pressed
   *  state — a voice mute key is pressed while muted but lit while the voice plays. */
  readonly lit = input<boolean | null>(null);
  /** A state-light bar along the key's top (Play/Pause): green steady (`playing`), amber blinking
   *  (`paused`), or dark (`off`). `null` draws no bar. */
  readonly stateLight = input<'playing' | 'paused' | 'off' | null>(null);
  /** Emits when the key is clicked, or pressed with Enter or Space. */
  readonly press = output<void>();

  /** Whether the key's light is on: off for a non-latching key, else `lit` or the latch. */
  protected readonly isLit = computed(() => {
    const latched = this.latched();
    return latched !== null && (this.lit() ?? latched);
  });
}
