import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { clamp } from '@sidablist/core';
import { DeckContext } from '../deck-context';
import { DECK_PLAYER_VIEW, SID_PLAYER } from '../deck-player';
import { createSpeedExcursion, SPEED_HARD_SPAN, SPEED_INPUT_SPAN } from '../speed-excursion';

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
  private readonly player = inject(SID_PLAYER);
  private readonly view = inject(DECK_PLAYER_VIEW);
  private readonly context = inject(DeckContext);

  protected readonly label = this.context.label;

  private readonly snapshot = this.view.snapshot;

  protected readonly voiceIndices: readonly number[] = [0, 1, 2];
  protected readonly mutedVoices = computed<readonly boolean[]>(() =>
    this.snapshot().voices.map((voice) => voice.muted)
  );
  /** What the chip actually does: latched XOR held. */
  protected readonly effectiveMutes = computed<readonly boolean[]>(() =>
    this.snapshot().voices.map((voice) => voice.muted !== voice.held)
  );

  protected onVoiceMuteToggle(voice: number, event: Event): void {
    this.player.setVoiceMuted(voice, (event.target as HTMLInputElement).checked);
  }

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   * the browser fires no `pointerup` here and the voice stays inverted. */
  protected onVoiceHoldStart(voice: number, event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.player.setVoiceHeld(voice, true);
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  protected onVoiceHoldEnd(voice: number): void {
    this.player.setVoiceHeld(voice, false);
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
    this.player.setVoiceHeld(voice, true);
  }

  /** Keyboard equivalent of `onVoiceHoldEnd` for Enter/Space. */
  protected onVoiceHoldKeyUp(voice: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.player.setVoiceHeld(voice, false);
  }

  protected onClearVoiceMutes(): void {
    this.player.clearVoiceMutes();
  }

  protected readonly speedMultiplier = computed(() => this.snapshot().tempo.multiplier);
  protected readonly minSpeed = 1 - SPEED_INPUT_SPAN;
  protected readonly maxSpeed = 1 + SPEED_INPUT_SPAN;

  /** The fader's displayed value, pinned to its own span when a jump has carried the multiplier
   * beyond it — display only, never written back to the player. */
  protected readonly speedFaderValue = computed<number>(() =>
    Math.min(Math.max(this.speedMultiplier(), this.minSpeed), this.maxSpeed)
  );

  /** The excursion state machine — see `speed-excursion.ts`. Wired straight to the player's
   *  `setTempo`, which rejects only what it cannot divide by, so the excursion's hard-span clamp is
   *  the only one in force on this path. */
  private readonly speedExcursion = createSpeedExcursion({
    setTempo: (multiplier) => this.player.setTempo(multiplier),
    getMultiplier: () => this.speedMultiplier(),
    slowest: 1 - SPEED_HARD_SPAN,
    fastest: 1 + SPEED_HARD_SPAN,
  });

  /** The fader's own narrower span is applied here, not in core: how far a control may reach is the
   *  application's to decide. */
  protected onSpeedInput(event: Event): void {
    const multiplier = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(multiplier)) {
      return;
    }
    this.player.setTempo(clamp(multiplier, this.minSpeed, this.maxSpeed));
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
