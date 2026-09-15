import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
  type OnDestroy,
  type Signal,
} from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { ANALYSIS_SCANNER } from './scan-runner';
import { indexTune } from '@sidablist/analysis';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { SharedTuneIndex } from './shared-tune-index';
import { DEFAULT_TIMING_MODE, frames } from '@sidablist/core';
import type { SidFile, TimingMode } from '@sidablist/core';
import { DECK_PLAYER_VIEW, SID_PLAYER } from '../deck/deck-player';

/** What a load establishes: which file, under which hash. `setTune` always writes a fresh object, so
 *  the effect below re-triggers even when the same tune is loaded twice in a session. */
interface TuneIdentity {
  readonly bytes: Uint8Array | null;
  readonly file: SidFile | null;
  readonly sidHash: string | null;
}

const EMPTY_IDENTITY: TuneIdentity = { bytes: null, file: null, sidHash: null };

/**
 * Owns the tune index's whole lifecycle for the tune currently loaded in this deck's player: look up
 * the stored record on every genuinely new tune or subtune load, produce it in the background on a
 * miss (via the package's `indexTune`), persist what it finds, and publish the answer onto `record()`
 * and into the player. Deck-host-provided, so its scanner and generation counter are scoped to one
 * deck's own player instance — the same reasoning `TrackAnalysisPanelComponent` uses for its own
 * `ANALYSIS_SCANNER`.
 *
 * Storage reads/writes and the scan ladder itself run through `SharedTuneIndex`, the page-level
 * collaborator every deck shares — that is what lets one deck's scan answer for another deck loading
 * the same tune. The generation guard stays here, on this side of that collaborator: `produceRecord`
 * is guard-free and always runs to completion, and `refreshIndex` applies this instance's own
 * generation check to the record it resolves with, discarding it if this deck's own tune moved on
 * while the shared run was in flight. A second deck awaiting the same run is unaffected — it applies
 * its own generation, not this one's.
 *
 * Depends on the player, never the other way around: the player holds no analysis record at all, and
 * this service is what turns one into the calls below — so the dependency runs one way and a
 * back-edge can never form a cycle.
 */
@Injectable()
export class TuneIndexService implements OnDestroy {
  private readonly shared = inject(SharedTuneIndex);
  private readonly scanner = inject(ANALYSIS_SCANNER);
  private readonly player = inject(SID_PLAYER);
  private readonly view = inject(DECK_PLAYER_VIEW);

  /** Narrowed off the snapshot rather than read from it directly: the snapshot's identity changes on
   *  every discrete state change — a play, a mute, a tempo move — and the effect below must fire for
   *  a subtune step and nothing else. */
  private readonly currentSubtune = computed<number | null>(
    () => this.view.snapshot().tune?.subtune ?? null
  );

  private readonly _record = signal<TuneIndexRecord | null>(null);
  readonly record: Signal<TuneIndexRecord | null> = this._record.asReadonly();

  private readonly _pending = signal<boolean>(false);
  /** True while a first-time background scan is in flight — distinct from "detector found nothing". */
  readonly pending: Signal<boolean> = this._pending.asReadonly();

  private readonly identity = signal<TuneIdentity>(EMPTY_IDENTITY);

  private generation = 0;

  /** Every `setTune` caller still waiting for an effect run to pick their load up, drained the moment
   *  one does. A list rather than a slot because signal writes coalesce: two loads issued in the same
   *  turn share a single effect run, and a slot would let the second silently displace the first
   *  caller's resolver — hanging it forever. A subtune-only trigger (no `setTune` in between) finds
   *  this empty, so it never resolves a promise it wasn't asked to settle. */
  private pendingSettles: (() => void)[] = [];

  constructor() {
    // A subtune step is different music from the tune it steps away from, and a fresh load replaces
    // the file outright; play, pause and stop touch neither signal below, so this effect stays inert
    // across them.
    effect(() => {
      const tune = this.identity();
      const subtune = this.currentSubtune() ?? 0;
      untracked(() => {
        const settles = this.pendingSettles;
        this.pendingSettles = [];
        void this.refresh(tune.bytes, tune.file, tune.sidHash, subtune, settles);
      });
    });
  }

  /** Called by the loader on every tune load. Resolves once the record for this tune has been
   *  published — on a cache hit, on a completed scan, and equally on a failed or abandoned one. Loads
   *  issued so close together that they coalesce into one effect run resolve together, on the outcome
   *  of the last one. Never rejects: a load path that hangs on a failed scan is worse than one that
   *  starts playback with no index. */
  setTune(bytes: Uint8Array | null, file: SidFile | null, sidHash: string | null): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pendingSettles.push(resolve);
      this.identity.set({ bytes, file, sidHash });
    });
  }

  /**
   * R6's timing escape hatch: rewrites the current record with `mode` and republishes it — no
   * re-scan, since the record already carries both rates. A no-op when nothing is indexed yet.
   *
   * Goes through `publish`, never `player.setTimingMode` on its own, so the mode change and the
   * structure it belongs with stay one operation — see `publish`.
   */
  setTimingMode(mode: TimingMode): void {
    const current = this.record();
    if (current === null) {
      return;
    }
    const updated: TuneIndexRecord = { ...current, timingMode: mode };
    this.shared.save(updated);
    this._record.set(updated);
    this.publish(updated);
  }

  /**
   * Hands the record's three facts to the player together: the track structure — which is what the
   * position basis, the track's end and the whole-tune loop are all derived from — and the timing
   * mode the clock resolves against.
   *
   * One method, deliberately. They were resolved as a set on the engine this replaces, and the
   * record they come from is an analysis type the package owns, so this service is the only place
   * that can keep them together. Scattering these calls across the call sites that publish a record
   * is exactly the coupling the single method exists to protect.
   *
   * **Any verified loop arms, including an implausibly short one — deliberately.** Detection is
   * byte-exact: it has already compared every frame of the tail against its counterpart one period
   * earlier, so a loop it reports is a repeat that was proven, not one that scored well. There is no
   * plausibility gate here, and none should be added: a detection fault must stay audible rather
   * than hide behind a guard that would also mask a future regression. `null` is the whole "declined
   * to answer" case.
   */
  private publish(record: TuneIndexRecord | null): void {
    this.player.setTrackStructure(
      record === null
        ? null
        : {
            loopStartFrame: record.loopStartFrame === null ? null : frames(record.loopStartFrame),
            loopPeriodFrames:
              record.loopPeriodFrames === null ? null : frames(record.loopPeriodFrames),
            endedAtFrame: record.endedAtFrame === null ? null : frames(record.endedAtFrame),
          }
    );
    this.player.setTimingMode(record?.timingMode ?? DEFAULT_TIMING_MODE);
  }

  ngOnDestroy(): void {
    this.scanner.dispose();
  }

  /**
   * Refreshes the index for the incoming tune and releases every caller that was waiting on this run,
   * whatever it concluded — a hit, a completed scan, a failed one, an abandoned one, or a throw out of
   * a detector or storage. The release sits in a `finally` rather than on each of the outcome paths so
   * that a new one cannot be added that forgets it: a hung load path is silent, has no error and no
   * timeout, and is worse than playback that starts with no index.
   */
  private async refresh(
    bytes: Uint8Array | null,
    file: SidFile | null,
    sidHash: string | null,
    subtune: number,
    settles: readonly (() => void)[]
  ): Promise<void> {
    try {
      await this.refreshIndex(bytes, file, sidHash, subtune);
    } finally {
      for (const settle of settles) {
        settle();
      }
    }
  }

  /** The refresh itself: retire the outgoing tune's answer, then hydrate from cache or produce the
   *  record for the incoming one — shared with every other deck loading the same tune. Every exit is
   *  an outcome its caller releases the load path on. */
  private async refreshIndex(
    bytes: Uint8Array | null,
    file: SidFile | null,
    sidHash: string | null,
    subtune: number
  ): Promise<void> {
    this.generation++;
    const generation = this.generation;
    // A stale answer describing the outgoing tune must never survive one frame into the incoming one.
    this._record.set(null);
    this._pending.set(false);
    this.publish(null);

    if (bytes === null || file === null || sidHash === null) {
      return;
    }

    const hit = this.shared.load(sidHash, subtune);
    if (hit !== null) {
      // A cache hit hydrates instantly — no scan at all, so the waiting load is released this turn.
      this._record.set(hit);
      this.publish(hit);
      return;
    }

    this._pending.set(true);
    const record = await this.shared.produceOnce(sidHash, subtune, () =>
      this.produceRecord(bytes, sidHash, subtune)
    );

    if (generation !== this.generation) {
      // This deck's own tune or subtune changed while the shared run was in flight; the record it
      // resolved with describes music that is no longer loaded here. A newer refresh has already
      // reset `pending` for its own tune, so this one must not touch it. The caller that awaited this
      // load is still released, though — it is superseded, not stuck. Any other deck still awaiting
      // this exact run applies its own generation check and is unaffected by this one moving on.
      return;
    }
    this._pending.set(false);

    if (record === null) {
      // A failed scan is not a cached "no answer" — the next load of this tune should try again.
      return;
    }

    this._record.set(record);
    this.publish(record);
  }

  /**
   * Runs the package's scan ladder to conclusion and persists the record it answers with through the
   * shared collaborator — or returns `null` when the ladder failed. This is the function `refreshIndex`
   * hands to `SharedTuneIndex.produceOnce`, so it runs at most once per `(sidHash, subtune)` no matter
   * how many decks are waiting on it.
   *
   * Deliberately guard-free: unlike `refreshIndex`, nothing here checks whether *this* deck's own
   * tune has since moved on, because another deck may be genuinely still waiting on this exact
   * answer for a tune it never abandoned. The generation check that discards a superseded answer
   * lives in `refreshIndex`, on the resolved record, once each caller's own wait is over.
   */
  private async produceRecord(
    bytes: Uint8Array,
    sidHash: string,
    subtune: number
  ): Promise<TuneIndexRecord | null> {
    try {
      const record = await indexTune(this.scanner, bytes, { sidHash, subtune });
      this.shared.save(record);
      logInfo(LogType.Success, `TuneIndexService: indexed ${sidHash}:${subtune}.`);
      return record;
    } catch (error) {
      logWarn(`TuneIndexService: scan failed for ${sidHash}:${subtune}: ${error}`);
      return null;
    }
  }
}
