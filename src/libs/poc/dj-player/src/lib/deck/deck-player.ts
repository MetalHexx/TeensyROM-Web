import { InjectionToken, type Signal } from '@angular/core';
import { frames } from '@sidablist/core';
import type {
  Frames,
  FrameClock,
  PlayerSnapshot,
  PlayerStats,
  ReplayRunner,
  SidPlayer,
} from '@sidablist/core';
import type { AsidSink } from '@sidablist/asid';
import { animationFrameSignal } from '../bridge/animation-frame';
import { storeSignal } from '../bridge/external-store';
import type { MarkerCollection } from './marker-collection';

/**
 * The player this deck drives. A token rather than a class provider because `createSidPlayer`
 * returns the `SidPlayer` contract and nothing else — the coordinator behind it is unexported, so
 * there is no class to name here.
 */
export const SID_PLAYER = new InjectionToken<SidPlayer>('SID_PLAYER');

/**
 * The far end this deck streams to. Held as its own token rather than reached through the player:
 * the schedule-ahead control, the delivery counters and the identify gesture are ASID's, not core's,
 * and `SidPlayer` deliberately carries none of them.
 */
export const ASID_SINK = new InjectionToken<AsidSink>('ASID_SINK');

/**
 * The clock this deck's player rides.
 *
 * A token rather than a `new` in a field initialiser so a test can tick the player by hand, and so
 * the POC's audio graph stays out of the app injector — the deck host provides it alongside the
 * player.
 */
export const FRAME_CLOCK = new InjectionToken<FrameClock>('FRAME_CLOCK');

/** The thread this deck's jumps replay on. */
export const REPLAY_RUNNER = new InjectionToken<ReplayRunner>('REPLAY_RUNNER');

/**
 * The player's read side as signals: the discrete snapshot pushed through `subscribe`, and the two
 * continuous readings pulled once per animation frame.
 *
 * Built once per deck rather than per consumer — four panels, the setup drawer and the analysis
 * panel all read the same player, and each creating its own polling loop would run six of them per
 * deck for readings that are identical by construction.
 */
export interface DeckPlayerView {
  readonly snapshot: Signal<PlayerSnapshot>;
  readonly stats: Signal<PlayerStats>;
  readonly position: Signal<Frames>;
}

export const DECK_PLAYER_VIEW = new InjectionToken<DeckPlayerView>('DECK_PLAYER_VIEW');

/** Must be called from an injection context — both bridges tie their teardown to it. */
export function createDeckPlayerView(player: SidPlayer): DeckPlayerView {
  return {
    snapshot: storeSignal(player),
    stats: animationFrameSignal(() => player.getStats()),
    position: animationFrameSignal(() => player.getPosition()),
  };
}

/**
 * Jumps to `percent` of the ceiling the player measures a scrub against, dropping whatever marker
 * loop was running first.
 *
 * That drop is a performance rule, not a timeline one, which is why it lives here rather than in
 * core: a manual scrub always wins over a passage the operator built against a marker, which would
 * otherwise drag playback straight back to wherever it was looping. The whole-tune structure
 * survives — repeating is the track's own behaviour, not something a scrub touches.
 */
export function scrubToPercent(
  player: SidPlayer,
  markers: MarkerCollection,
  percent: number
): Promise<void> {
  markers.stopMarkerLoop();
  const ceiling = player.getSnapshot().basis.ceilingFrames;
  return player.seek(frames(Math.round((percent / 100) * ceiling)));
}
