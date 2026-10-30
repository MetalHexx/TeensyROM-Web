import {
  Injectable,
  Injector,
  effect,
  inject,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { logError } from '@teensyrom-nx/utils';
import type { PlainValue } from '@sidablist/tunes';
import { DeckSpeed } from './deck-speed';
import {
  DjStore,
  type DeckHolding,
  type DeckLoopsState,
  type DeckMixerSettings,
  type DeckPanelState,
  type DeckVoiceState,
} from './dj-store';
import { encodeRowSettings, type DeckRowSettings } from './loops/row-settings-codec';
import { DjSets } from './sets/dj-sets';
import { DECK_SLOTS, type Slot } from './slot';

/** How long a change waits for company before it is written: knob drags land a few times a
 *  second, not on every tick. */
const WRITE_DELAY_MS = 250;

/** Everything one run of a deck's effect reads. */
interface Observed {
  readonly holding: DeckHolding | null;
  readonly shapeable: boolean;
  readonly voices: readonly DeckVoiceState[];
  readonly repeat: boolean;
  readonly panel: DeckPanelState;
  readonly settingsInPlayId: DeckLoopsState['settingsInPlayId'];
  readonly mainSettings: DeckLoopsState['mainSettings'];
}

interface PendingWrite {
  readonly holding: DeckHolding;
  readonly settings: PlainValue;
}

/** What the keeper knows of one deck between runs. */
interface Lane {
  /** The holding of the last run, as `setId:rowId:subtune`. */
  key: string | null;
  /** The last run found the deck shapeable on a held row. */
  settled: boolean;
  /** The encoding of the settings as of the last run that recorded one. */
  baseline: string | null;
  pending: PendingWrite | null;
  timer: ReturnType<typeof setTimeout> | null;
}

function newLane(): Lane {
  return { key: null, settled: false, baseline: null, pending: null, timer: null };
}

function keyOf(holding: DeckHolding): string {
  return `${holding.setId}:${holding.rowId}:${holding.subtune}`;
}

function mutesOf(voices: readonly DeckVoiceState[]): DeckMixerSettings['mutes'] {
  return [voices[0]?.muted ?? false, voices[1]?.muted ?? false, voices[2]?.muted ?? false];
}

/**
 * Keeps what a deck has set — the SID panel, the voices' latched mutes, the speed fader and Repeat —
 * in the row and subtune it holds, and so in the tune's latest version.
 *
 * One effect per deck, tracking only the fields it keeps, each through its own deep signal: the
 * deck state changes for much it does not keep (status, the engine's speed, the hand), and the
 * effect must not re-run for that. The row is read only inside a write, never tracked, so one
 * deck's write cannot re-run the other deck's effect.
 *
 * It writes only while the deck is shapeable on a held row. A load or subtune switch ends with the
 * deck already showing the row's restored state (or home, for a subtune with nothing kept), so the
 * first shapeable run after one — and any run on a different holding — only records a baseline.
 * That is also why a failed load writes nothing: the deck it leaves is not shapeable, and the next
 * load that settles records a new baseline. A change after that moves the baseline and is written
 * within `WRITE_DELAY_MS`, the latest change replacing one still waiting.
 *
 * The row keeps the main track's settings: while a marker's own are in play, the ones held aside.
 * Holds, nudges and an open speed excursion's position are never kept. With both decks on one row
 * and subtune, each writes only when its own settings change; the row keeps the last writer's, and
 * the other deck takes them at its next load of the row.
 *
 * `DeckService` calls `flush` before anything can close the set a waiting write belongs to.
 */
@Injectable({ providedIn: 'root' })
export class DeckMemoryKeeper {
  private readonly store = inject(DjStore);
  private readonly deckSpeed = inject(DeckSpeed);
  private readonly sets = inject(DjSets);
  private readonly injector = inject(Injector);

  private installed = false;
  private readonly lanes: Record<Slot, Lane> = { A: newLane(), B: newLane() };

  /** Installs the per-deck effects, once. Further calls are no-ops. */
  install(): void {
    if (this.installed) {
      return;
    }
    this.installed = true;

    runInInjectionContext(this.injector, () => {
      for (const slot of DECK_SLOTS) {
        const holding = this.store.deckHolding(slot);
        const shapeable = this.store.canShape(slot);
        const deck = this.store.decks[slot];
        const panel = this.store.panel[slot];
        const loops = this.store.loops[slot];

        effect(() => {
          const observed: Observed = {
            holding: holding(),
            shapeable: shapeable(),
            voices: deck.voices(),
            repeat: deck.repeat(),
            panel: panel(),
            settingsInPlayId: loops.settingsInPlayId(),
            mainSettings: loops.mainSettings(),
          };
          // Only a trigger: the speed to keep comes from the speed controls, inside `observe`.
          deck.faderSpeed();
          untracked(() => this.observe(slot, observed));
        });
      }
    });
  }

  /** Writes the deck's waiting change, if there is one, now. */
  flush(slot: Slot): void {
    const lane = this.lanes[slot];
    if (lane.timer !== null) {
      clearTimeout(lane.timer);
      lane.timer = null;
    }
    const pending = lane.pending;
    if (pending === null) {
      return;
    }
    lane.pending = null;
    try {
      this.sets.saveSubtuneSettings(pending.holding, pending.settings);
    } catch (error) {
      logError(`DeckMemoryKeeper: keeping deck ${slot}'s settings failed`, error);
    }
  }

  private observe(slot: Slot, observed: Observed): void {
    const lane = this.lanes[slot];
    const { holding } = observed;
    const key = holding === null ? null : keyOf(holding);
    const holdingChanged = key !== lane.key;
    const wasSettled = lane.settled;
    lane.key = key;
    lane.settled = holding !== null && observed.shapeable;

    if (holdingChanged) {
      this.flush(slot);
    }
    if (holding === null || !lane.settled) {
      return;
    }

    const settings = encodeRowSettings(this.settingsOf(slot, observed));
    const encoded = JSON.stringify(settings);
    if (holdingChanged || !wasSettled) {
      lane.baseline = encoded;
      return;
    }
    if (encoded === lane.baseline) {
      return;
    }
    lane.baseline = encoded;
    lane.pending = { holding, settings };
    lane.timer ??= setTimeout(() => {
      lane.timer = null;
      this.flush(slot);
    }, WRITE_DELAY_MS);
  }

  private settingsOf(slot: Slot, observed: Observed): DeckRowSettings {
    const { settingsInPlayId, mainSettings } = observed;
    const mixer: DeckMixerSettings =
      settingsInPlayId !== null && mainSettings !== null
        ? mainSettings
        : { panel: observed.panel, mutes: mutesOf(observed.voices) };
    return { mixer, speed: this.deckSpeed.keptSpeed(slot), repeat: observed.repeat };
  }
}
