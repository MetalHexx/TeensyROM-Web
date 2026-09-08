import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransportPanelComponent } from './transport-panel.component';
import { DeckContext } from '../deck-context';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { TuneSource } from '../deck-tune-loader';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { DECK_PLAYER_VIEW, SID_PLAYER } from '../deck-player';
import { MarkerCollection } from '../marker-collection';
import { TuneIndexService } from '../../analysis/tune-index.service';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import { frames } from '@sidablist/core';
import type { Frames, SidFile } from '@sidablist/core';
import { createFakeDeckPlayer, fakeSidFile } from '../../../testing/player-doubles';
import type { FakeDeckPlayer } from '../../../testing/player-doubles';

// An 80-second tune at 50 Hz, against the fixed 300-second jump ceiling. Deliberately unequal: a
// scrub resolved against the wrong one of the two lands 3.75x away from where it was dragged.
const POSITION_BASIS_FRAMES = 4_000;
const CEILING_FRAMES = 15_000;

describe('TransportPanelComponent', () => {
  let fixture: ComponentFixture<TransportPanelComponent>;
  let player: FakeDeckPlayer;
  let tuneLoader: {
    availableTunes: WritableSignal<readonly TuneSource[]>;
    currentTune: WritableSignal<SidFile | null>;
    tuneError: WritableSignal<string | null>;
    selectTune: ReturnType<typeof vi.fn>;
    onFilePicked: ReturnType<typeof vi.fn>;
  };
  let binding: { selectedPortId: WritableSignal<string | null> };
  let tuneIndexService: {
    pending: WritableSignal<boolean>;
    record: WritableSignal<TuneIndexRecord | null>;
  };
  let context: DeckContext;

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    player = createFakeDeckPlayer();
    tuneLoader = {
      availableTunes: signal<readonly TuneSource[]>([]),
      currentTune: signal<SidFile | null>(null),
      tuneError: signal<string | null>(null),
      selectTune: vi.fn(),
      onFilePicked: vi.fn(),
    };
    binding = { selectedPortId: signal<string | null>(null) };
    tuneIndexService = {
      pending: signal<boolean>(false),
      record: signal<TuneIndexRecord | null>(null),
    };

    TestBed.configureTestingModule({
      imports: [TransportPanelComponent],
      providers: [
        DeckContext,
        { provide: DeckTuneLoader, useValue: tuneLoader as unknown as DeckTuneLoader },
        { provide: DeckMidiBinding, useValue: binding as unknown as DeckMidiBinding },
        { provide: SID_PLAYER, useValue: player.player },
        { provide: DECK_PLAYER_VIEW, useValue: player.view },
        { provide: MarkerCollection, useValue: new MarkerCollection(player.player) },
        { provide: TuneIndexService, useValue: tuneIndexService as unknown as TuneIndexService },
      ],
    });

    context = TestBed.inject(DeckContext);
    context.adopt({ id: 'test', label: deckLabel });

    fixture = TestBed.createComponent(TransportPanelComponent);
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    ) as HTMLButtonElement;
  }

  describe('disabled/enabled logic', () => {
    beforeEach(() => build('A'));

    it('gates Play on a loaded tune, a selected MIDI port, an idle deck and no scan in flight', () => {
      expect(button('Play').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      binding.selectedPortId.set('port-1');
      fixture.detectChanges();
      expect(button('Play').disabled).toBe(false);

      tuneIndexService.pending.set(true);
      fixture.detectChanges();
      expect(button('Play').disabled).toBe(true);
    });

    it('gates Stop on a loaded tune, refusing only the freshly-loaded/still-scanning case', () => {
      expect(button('Stop').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      fixture.detectChanges();
      expect(button('Stop').disabled).toBe(false);

      tuneIndexService.pending.set(true);
      fixture.detectChanges();
      expect(button('Stop').disabled).toBe(true);

      player.snapshot.update((snapshot) => ({ ...snapshot, transport: 'playing' }));
      fixture.detectChanges();
      expect(button('Stop').disabled).toBe(false);
    });

    it('gates the subtune stepper on a loaded tune with more than one subtune', () => {
      expect(button('◀').disabled).toBe(true);
      expect(button('▶').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      player.snapshot.update((snapshot) => ({
        ...snapshot,
        tune: { subtune: 1, subtuneCount: 3, lengthFrames: null },
      }));
      fixture.detectChanges();

      expect(button('◀').disabled).toBe(false);
      expect(button('▶').disabled).toBe(false);
    });
  });

  describe('accessible names', () => {
    it("suffix every control's accessible name with its own deck, distinct from the other deck", () => {
      build('A');
      const aName = button('Play').getAttribute('aria-label');
      fixture.destroy();

      build('B');
      const bName = button('Play').getAttribute('aria-label');

      expect(aName).toBe('Play deck A');
      expect(bName).toBe('Play deck B');
      expect(aName).not.toBe(bName);
    });
  });

  describe('scrubbing', () => {
    beforeEach(() => {
      build('A');
      player.snapshot.update((snapshot) => ({
        ...snapshot,
        basis: {
          ...snapshot.basis,
          positionBasisFrames: frames(POSITION_BASIS_FRAMES),
          ceilingFrames: frames(CEILING_FRAMES),
        },
      }));
      fixture.detectChanges();
    });

    function scrubTrack(): HTMLInputElement {
      return fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    }

    /** Drags the thumb to `percent` and releases it, then settles the awaited seek. */
    async function dragTo(percent: number): Promise<void> {
      const track = scrubTrack();
      track.value = String(percent);
      track.dispatchEvent(new Event('input', { bubbles: true }));
      track.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      fixture.detectChanges();
    }

    /** The frame the player was last asked to seek to. */
    function lastSeekFrame(): Frames {
      return vi.mocked(player.player.seek).mock.calls.at(-1)?.[0] as Frames;
    }

    it.each([0, 25, 50, 87.5, 100])(
      'seeks to %s%% of the basis the playhead is read against',
      async (percent) => {
        await dragTo(percent);

        expect(lastSeekFrame()).toBe(frames(Math.round((percent / 100) * POSITION_BASIS_FRAMES)));
      }
    );

    it('leaves the thumb where it was dragged once the seek lands', async () => {
      await dragTo(25);

      // What the real player does when the jump lands: the playhead adopts the frame it was sent to.
      player.position.set(lastSeekFrame());
      fixture.detectChanges();

      expect(Number(scrubTrack().value)).toBe(25);
    });
  });

  describe('error surfaces', () => {
    beforeEach(() => build('A'));

    it("renders the player's last error as an alert", () => {
      player.snapshot.update((snapshot) => ({ ...snapshot, error: 'Delivery stalled.' }));
      fixture.detectChanges();

      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Delivery stalled.');
    });

    it('renders the tune parse error as an alert', () => {
      tuneLoader.tuneError.set('Not a valid SID file.');
      fixture.detectChanges();

      const alerts: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[role="alert"]')
      );
      expect(alerts.some((el) => el.textContent?.includes('Not a valid SID file.'))).toBe(true);
    });
  });
});
