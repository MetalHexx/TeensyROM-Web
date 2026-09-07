import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DjPlayerEngine, SPEED_INPUT_SPAN } from '../../engine/dj-player-engine';
import { DeckContext } from '../deck-context';
import { createSpeedExcursion } from '../speed-excursion';

/**
 * Voice and Speed share one full-height, centre-aligned column — the narrowest of the deck's four
 * panels. Voice sits above Speed; both stack their controls vertically rather than side by side, which
 * is what lets the column stay narrow.
 *
 * Reads every collaborator from the deck injector it renders inside (`DeckHostComponent`'s
 * `providers`) — no inputs, because the injector already resolves per deck.
 */
@Component({
  selector: 'lib-voice-speed-column',
  templateUrl: './voice-speed-column.component.html',
  styleUrl: './voice-speed-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceSpeedColumnComponent {
  private readonly engine = inject(DjPlayerEngine);
  private readonly context = inject(DeckContext);

  protected readonly label = this.context.label;

  protected readonly voiceIndices: readonly number[] = [0, 1, 2];
  protected readonly mutedVoices = this.engine.mutedVoices;
  protected readonly effectiveMutes = this.engine.effectiveMutes;

  protected onVoiceMuteToggle(voice: number, event: Event): void {
    this.engine.setVoiceMuted(voice, (event.target as HTMLInputElement).checked);
  }

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   * the browser fires no `pointerup` here and the voice stays inverted. */
  protected onVoiceHoldStart(voice: number, event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.engine.setVoiceHeld(voice, true);
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  protected onVoiceHoldEnd(voice: number): void {
    this.engine.setVoiceHeld(voice, false);
  }

  /** Keyboard equivalent of `onVoiceHoldStart` for Enter/Space; `event.repeat` guards against the
   * browser's auto-repeat re-triggering the press while the key stays down. Bound to the plain
   * `keydown` event (rather than Angular's `keydown.enter`/`keydown.space` filter syntax) because
   * strict template type checking can't resolve those filtered event names to `KeyboardEvent`. */
  protected onVoiceHoldKeyDown(voice: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.engine.setVoiceHeld(voice, true);
  }

  /** Keyboard equivalent of `onVoiceHoldEnd` for Enter/Space. */
  protected onVoiceHoldKeyUp(voice: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.engine.setVoiceHeld(voice, false);
  }

  protected onClearVoiceMutes(): void {
    this.engine.clearVoiceMutes();
  }

  protected readonly speedMultiplier = this.engine.speedMultiplier;
  protected readonly minSpeed = 1 - SPEED_INPUT_SPAN;
  protected readonly maxSpeed = 1 + SPEED_INPUT_SPAN;

  /** The fader's displayed value, pinned to its own span when a jump has carried the multiplier
   * beyond it — display only, never written back to the engine. */
  protected readonly speedFaderValue = computed<number>(() =>
    Math.min(Math.max(this.speedMultiplier(), this.minSpeed), this.maxSpeed)
  );

  /** Drives the extracted excursion state machine rather than the engine's own (still-standing)
   *  copy — see `speed-excursion.ts`. Wired to `DjPlayerEngine.setTempo`, a raw set-and-retime with
   *  no clamp of its own, so the excursion's hard-span clamp is the only one in force; `P09-T05`
   *  points this same wiring at the player instead. */
  private readonly speedExcursion = createSpeedExcursion({
    setTempo: (multiplier) => this.engine.setTempo(multiplier),
    slowest: this.engine.slowestSpeed(),
    fastest: this.engine.fastestSpeed(),
  });

  protected onSpeedInput(event: Event): void {
    this.engine.setSpeed(Number((event.target as HTMLInputElement).value));
  }

  protected onSpeedJumpUp(): void {
    this.speedExcursion.jumpUp();
  }

  protected onSpeedJumpDown(): void {
    this.speedExcursion.jumpDown();
  }

  protected onSpeedHome(): void {
    this.speedExcursion.home();
  }
}
