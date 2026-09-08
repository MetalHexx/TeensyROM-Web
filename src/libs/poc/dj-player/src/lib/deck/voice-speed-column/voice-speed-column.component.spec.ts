import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { VoiceSpeedColumnComponent } from './voice-speed-column.component';
import { DeckContext } from '../deck-context';
import { DECK_PLAYER_VIEW, SID_PLAYER } from '../deck-player';
import { createFakeDeckPlayer } from '../../../testing/player-doubles';
import type { FakeDeckPlayer } from '../../../testing/player-doubles';

describe('VoiceSpeedColumnComponent', () => {
  let fixture: ComponentFixture<VoiceSpeedColumnComponent>;
  let player: FakeDeckPlayer;

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    player = createFakeDeckPlayer();

    TestBed.configureTestingModule({
      imports: [VoiceSpeedColumnComponent],
      providers: [
        DeckContext,
        { provide: SID_PLAYER, useValue: player.player },
        { provide: DECK_PLAYER_VIEW, useValue: player.view },
      ],
    });

    const context = TestBed.inject(DeckContext);
    context.adopt({ id: 'test', label: deckLabel });

    fixture = TestBed.createComponent(VoiceSpeedColumnComponent);
    fixture.detectChanges();
  }

  function holdButton(voice: number): HTMLButtonElement {
    return fixture.nativeElement.querySelectorAll('.voice-hold')[voice] as HTMLButtonElement;
  }

  function speedButton(label: string): HTMLButtonElement {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.speed-jump-buttons button')
    ).find((button) => button.textContent?.trim() === label) as HTMLButtonElement;
  }

  it("reads 'Kill' for an audible voice and 'Punch In' once that voice is muted", () => {
    build('A');

    expect(holdButton(0).textContent?.trim()).toBe('Kill');

    player.snapshot.update((snapshot) => ({
      ...snapshot,
      voices: [
        { muted: true, held: false },
        { muted: false, held: false },
        { muted: false, held: false },
      ],
    }));
    fixture.detectChanges();

    expect(holdButton(0).textContent?.trim()).toBe('Punch In');
  });

  it('orders the speed buttons +50% / Home / −50% top to bottom', () => {
    build('A');

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.speed-jump-buttons button')
    ).map((button) => button.textContent?.trim());

    expect(labels).toEqual(['+50%', 'Home', '−50%']);
  });

  it('suffix voice and speed control names with their own deck, distinct from the other deck', () => {
    build('A');
    const aKill = holdButton(0).getAttribute('aria-label');
    fixture.destroy();

    build('B');
    const bKill = holdButton(0).getAttribute('aria-label');

    expect(aKill).toBe('Kill voice 1 deck A');
    expect(bKill).toBe('Kill voice 1 deck B');
    expect(aKill).not.toBe(bKill);
  });

  describe('the speed jump excursion', () => {
    it("drives the jump buttons through the player's setTempo, clamped to the hard span", () => {
      build('A');

      speedButton('+50%').click();

      expect(player.player.setTempo).toHaveBeenLastCalledWith(1.5);
    });

    it('restores home exactly on the opposite button, closing the excursion', () => {
      build('A');

      speedButton('+50%').click();
      speedButton('−50%').click();

      expect(player.player.setTempo).toHaveBeenLastCalledWith(1);
    });

    it('routes Home through the same excursion module', () => {
      build('A');

      speedButton('+50%').click();
      speedButton('Home').click();

      expect(player.player.setTempo).toHaveBeenLastCalledWith(1);
    });

    it('remembers the fader-set multiplier, not the excursion module’s own stale tracking', () => {
      build('A');

      player.snapshot.update((snapshot) => ({
        ...snapshot,
        tempo: { ...snapshot.tempo, multiplier: 1.2 },
      }));
      fixture.detectChanges();

      speedButton('+50%').click(); // must remember 1.2, not the module's own stale value of 1
      expect(player.player.setTempo).toHaveBeenLastCalledWith(1.7);

      speedButton('−50%').click(); // opposite button — must restore exactly 1.2

      expect(player.player.setTempo).toHaveBeenLastCalledWith(1.2);
    });
  });
});
