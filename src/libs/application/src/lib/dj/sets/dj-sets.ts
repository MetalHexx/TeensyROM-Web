import { Injectable, inject } from '@angular/core';
import {
  addRow,
  changeRowMemory,
  createRow,
  createSet,
  editRowMemory,
  editRowSubtune,
  findRow,
  moveRow,
  nextPlaceholder,
  removeRow,
  renameSet,
  subtuneMemoryOf,
  summaryOf,
  tuneMemoryOf,
  type LoopMarker,
  type LoopPositionsStore,
  type PlainValue,
  type RowEdit,
  type RowTune,
  type SetRow,
  type SubtuneChange,
  type TuneMemory,
  type TuneReference,
  type TuneSet,
} from '@sidablist/tunes';
import { ALERT_SERVICE, type IAlertService } from '@teensyrom-nx/domain';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DjStore, type DeckHolding, type PendingRow, type RowPrep } from '../dj-store';
import type { LoadSource } from '../load-source';
import { DJ_LIBRARY_STATE_REPOSITORY, SET_STORE, TUNE_MEMORY_STORE } from '../ports';
import { DECK_SLOTS, type Slot } from '../slot';
import { TuneLoader } from '../tune-loader';
import { encodeRowHost } from './row-host';

/** The server rejects a longer set name. */
export const SET_NAME_MAX_LENGTH = 64;
/** The server's limits, mirrored so a document never fails validation forever behind a `failed`
 *  lamp. */
export const MAX_SETS = 1000;
export const MAX_ROWS_PER_SET = 1000;
export const MAX_MARKERS_PER_SUBTUNE = 128;

const SAVE_DEBOUNCE_MS = 300;

const ANALYZING: RowPrep = { phase: 'analyzing' };

/** Control characters as the server counts them (.NET's `char.IsControl`): it rejects a name
 *  holding one, so a pasted tab would otherwise fail every later save of that set for good. */
function isControlCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** A name as the server accepts it: control characters removed, then trimmed and capped to
 *  `maxLength` UTF-16 units, without leaving half a surrogate pair at the cut. Both rename paths
 *  use it. */
export function sanitizeName(name: string, maxLength: number): string {
  const printable = Array.from(name)
    .filter((character) => !isControlCode(character.charCodeAt(0)))
    .join('')
    .trim();
  const capped = printable.slice(0, maxLength);
  const last = capped.charCodeAt(capped.length - 1);
  return (isHighSurrogate(last) && capped.length < printable.length ? capped.slice(0, -1) : capped).trim();
}

function now(): string {
  return new Date().toISOString();
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function detachedKey(setId: string, rowId: string): string {
  return `${setId}:${rowId}`;
}

function rowTuneOf(reference: TuneReference): RowTune {
  return {
    sidHash: reference.identity.sidHash,
    title: reference.title,
    author: reference.author,
    released: reference.released,
    subtuneCount: reference.subtuneCount,
    byteLength: reference.byteLength,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hostOf(source: LoadSource): PlainValue {
  return encodeRowHost({
    source,
    lengths: source.subtuneLengths ?? [],
    playLength: source.playLength ?? '',
  });
}

function holdingOf(setId: string, row: SetRow): DeckHolding {
  return { setId, rowId: row.id, sidHash: row.tune.sidHash, subtune: row.lastSubtune };
}

/** A document waiting to be saved: how to send it, and how to put it back if sending fails. */
interface PendingDocument {
  readonly send: () => Promise<void>;
  readonly requeue: () => void;
}

/**
 * The DJ library's one owner: it hydrates the saved sets, keeps the current set always saved, and
 * gives the decks a memory scoped to the set row each holds.
 *
 * Every change is a new immutable copy of a document, queued by id the moment it is made: a flush
 * sends the latest copy of each pending document and never reads the store for "the current set",
 * so a set closed before the debounce fires still saves, and a deleted set's pending copy is
 * dropped so it never reappears.
 *
 * A failed load of the library suppresses every save for the session, so a partial library can
 * never overwrite the server's.
 */
@Injectable({ providedIn: 'root' })
export class DjSets {
  private readonly setStore = inject(SET_STORE);
  private readonly memoryStore = inject(TUNE_MEMORY_STORE);
  private readonly libraryState = inject(DJ_LIBRARY_STATE_REPOSITORY);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly store = inject(DjStore);
  private readonly loader = inject(TuneLoader);

  private hydration: Promise<void> | null = null;
  private savesSuppressed = false;

  private readonly pendingSets = new Map<string, TuneSet>();
  private readonly pendingMemories = new Map<string, TuneMemory>();
  private pendingLibrary: { readonly currentSetId: string | null } | null = null;

  private debounce: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private saveAgain = false;
  private failureAlerted = false;

  private readonly memoryCache = new Map<string, TuneMemory | null>();
  /** Sets whose `DELETE` is in flight, and sets deleted on the server. Neither is ever saved. */
  private readonly deleting = new Set<string>();
  private readonly deleted = new Set<string>();
  /** Rows a deck still holds after their set or their place in it is gone, by `setId:rowId`. */
  private readonly detached = new Map<string, SetRow>();

  /** Loads the library once; later calls return the same promise. Never rejects. */
  hydrate(): Promise<void> {
    this.hydration ??= this.loadLibrary();
    return this.hydration;
  }

  /** A new empty set under the next placeholder name becomes current, and is saved. */
  newSet(): void {
    this.whenHydrated(() => this.startSet());
  }

  /** Renames the current set. Control characters are removed and the name capped to
   *  `SET_NAME_MAX_LENGTH`; an empty name falls back to the set's placeholder. */
  renameCurrent(name: string): void {
    this.whenHydrated(() => {
      const set = this.currentSet();
      if (set === null) {
        return;
      }
      this.commitSet(renameSet(set, sanitizeName(name, SET_NAME_MAX_LENGTH), now()), set);
    });
  }

  /** Deletes the current set on the server, then starts a fresh one. Decks holding its rows keep
   *  them. A failed delete leaves the set as it was. */
  async deleteCurrent(): Promise<void> {
    await this.hydrate();
    const setId = this.store.sets.currentSetId();
    if (setId === null) {
      return;
    }
    if (this.savesSuppressed) {
      this.alertService.warning(
        'Sets cannot be deleted until the app is reloaded: the sets could not be loaded.'
      );
      return;
    }

    await this.settleFlush();
    const set = this.store.sets.open()[setId];
    if (this.store.sets.currentSetId() !== setId || !set || this.deleting.has(setId)) {
      return;
    }

    // Before the request: no queued or in-flight save may land after the DELETE.
    this.deleting.add(setId);
    this.pendingSets.delete(setId);
    try {
      await this.setStore.delete(setId);
    } catch (error) {
      this.deleting.delete(setId);
      const latest = this.store.sets.open()[setId];
      if (latest) {
        this.queueSet(latest);
        this.scheduleSave();
      }
      logError('DjSets: delete failed', error);
      this.alertService.error('The set could not be deleted.');
      return;
    }
    this.deleting.delete(setId);
    this.deleted.add(setId);

    const last = this.store.sets.open()[setId] ?? set;
    for (const slot of DECK_SLOTS) {
      const holding = this.store.sets.holdings()[slot];
      const row = holding?.setId === setId ? last.rows.find((r) => r.id === holding.rowId) : undefined;
      if (holding && row) {
        this.detached.set(detachedKey(setId, holding.rowId), row);
      }
    }

    this.store.removeSetSummary({ setId });
    this.store.closeOpenSets({
      keep: Object.keys(this.store.sets.open()).filter((id) => id !== setId),
    });
    this.startSet();
    this.store.announceSets({ text: `Deleted ${last.name}` });
  }

  /** Makes a saved set current, with its first row selected. A set a deck holds, or one closed
   *  moments ago and still waiting to save, is newer than its file and is used as it is. */
  async openSet(setId: string): Promise<void> {
    await this.hydrate();
    if (setId === this.store.sets.currentSetId()) {
      return;
    }

    await this.settleFlush();
    let set: TuneSet | null = this.store.sets.open()[setId] ?? this.pendingSets.get(setId) ?? null;
    if (set === null) {
      try {
        set = await this.setStore.load(setId);
      } catch (error) {
        logWarn(`DjSets: opening set ${setId} failed — ${describe(error)}`);
      }
    }
    if (set === null) {
      this.alertService.warning('That set could not be loaded.');
      return;
    }

    this.store.putOpenSet({ set });
    this.store.setCurrentSet({ setId, selectedRowId: set.rows[0]?.id ?? null });
    this.queueLibrary();
    this.scheduleSave();
    this.closeUnreferenced();
  }

  /**
   * Adds the listing's file to the current set. `index` is the insertion gap among the set's real
   * rows (0 to the row count; null appends): the card converts its displayed gaps, and pending
   * entries never count. The file shows as a pending entry while it fetches, then as a row while
   * it is analyzed.
   */
  async addFromListing(source: LoadSource, index: number | null): Promise<void> {
    await this.hydrate();
    const set = this.currentSet();
    if (set === null) {
      return;
    }
    if (set.rows.length >= MAX_ROWS_PER_SET) {
      this.warnSetFull();
      return;
    }

    const pending: PendingRow = {
      key: crypto.randomUUID(),
      setId: set.id,
      index: clamp(index ?? set.rows.length, 0, set.rows.length),
      title: source.title ?? source.fileName,
      author: source.author ?? '',
    };
    this.store.setPendingRows({ rows: [...this.store.sets.pending(), pending] });

    let placed: { readonly row: SetRow; readonly position: number } | null = null;
    let reference: TuneReference | null = null;
    try {
      reference = await this.fetchForAdd(source);
      if (reference !== null) {
        placed = await this.placeRow(reference, source, pending);
      }
    } finally {
      this.dropPending(pending, placed?.position ?? null);
    }

    if (placed !== null && reference !== null) {
      await this.analyzeRow(placed.row, reference);
    }
  }

  /** Moves a row so it ends at `toIndex` among the set's real rows once it is taken out — the same
   *  meaning as the library's `moveRow`. */
  moveRow(rowId: string, toIndex: number): void {
    this.whenHydrated(() => {
      const set = this.currentSet();
      if (set !== null) {
        this.commitSet(moveRow(set, rowId, toIndex, now()), set);
      }
    });
  }

  /** Removes a row from the current set. A deck holding it keeps its own copy. Selection moves to
   *  the row that took its place, else the one before, else none. */
  removeRow(rowId: string): void {
    this.whenHydrated(() => {
      const set = this.currentSet();
      const index = set === null ? -1 : set.rows.findIndex((row) => row.id === rowId);
      if (set === null || index < 0) {
        return;
      }

      for (const slot of DECK_SLOTS) {
        const holding = this.store.sets.holdings()[slot];
        if (holding?.setId === set.id && holding.rowId === rowId) {
          this.detached.set(detachedKey(set.id, rowId), set.rows[index]);
        }
      }

      const next = removeRow(set, rowId, now());
      this.commitSet(next, set);
      this.store.setRowPrep({ rowId, prep: null });
      if (this.store.sets.selectedRowId() === rowId) {
        const successor = next.rows[index] ?? next.rows[index - 1] ?? null;
        this.store.selectSetRow({ rowId: successor?.id ?? null, turned: false });
      }
    });
  }

  /** A click on a row: selects it without counting a turn. */
  selectRow(rowId: string): void {
    if (this.currentSet()?.rows.some((row) => row.id === rowId)) {
      this.store.selectSetRow({ rowId, turned: false });
    }
  }

  /** The Select keys: moves the selection by `delta` rows, stopping at the ends. Counts a turn. */
  moveSelection(delta: number): void {
    const rows = this.currentSet()?.rows ?? [];
    const from = rows.findIndex((row) => row.id === this.store.sets.selectedRowId());
    const base = from >= 0 ? from : delta > 0 ? -1 : rows.length;
    this.turnTo(rows, base + Math.trunc(delta));
  }

  /** The mapped knob: selects the row at `index` among the real rows, rounded and clamped. Counts
   *  a turn. */
  selectRowAt(index: number): void {
    if (!Number.isNaN(index)) {
      this.turnTo(this.currentSet()?.rows ?? [], Math.round(index));
    }
  }

  /**
   * The SID's row in the current set, appended when it is new. Everything it reads is re-read
   * after its awaits and `addRow` decides duplicates, so decks racing each other or a card drop
   * for one SID yield one row. Rejects when the set is full.
   */
  async joinForDeck(reference: TuneReference, source: LoadSource): Promise<DeckHolding> {
    await this.hydrate();
    const sidHash = reference.identity.sidHash;
    const memory = await this.memoryFor(sidHash);

    const set = this.currentSet();
    if (set === null) {
      throw new Error('There is no current set to hold the tune.');
    }
    if (set.rows.length >= MAX_ROWS_PER_SET && findRow(set, sidHash) === null) {
      this.warnSetFull();
      throw new Error(this.setFullMessage());
    }

    const row = createRow({
      id: crypto.randomUUID(),
      tune: rowTuneOf(reference),
      host: hostOf(source),
      memory,
      startSubtune: reference.identity.subtune,
    });
    const added = addRow(set, row, null, now());
    if (added.added) {
      this.commitSet(added.set, set);
    }
    return holdingOf(set.id, added.row);
  }

  /** The deck holding for a row, at the subtune it was last on. */
  holdingFor(setId: string, rowId: string): DeckHolding | null {
    const row = this.heldRow(setId, rowId);
    return row === null ? null : holdingOf(setId, row);
  }

  /** The row a holding names: the open set's, else the deck's detached copy, else null. */
  rowOf(holding: DeckHolding): SetRow | null {
    return this.heldRow(holding.setId, holding.rowId);
  }

  /** The host settings value kept for the holding's subtune, if any. */
  subtuneSettingsOf(holding: DeckHolding): PlainValue | undefined {
    const row = this.rowOf(holding);
    return row === null ? undefined : subtuneMemoryOf(row, holding.subtune)?.settings;
  }

  /** Records what a deck holds, then closes the open sets and detached copies nothing references. */
  hold(slot: Slot, holding: DeckHolding | null): void {
    this.store.setDeckHolding({ slot, holding });
    this.closeUnreferenced();
  }

  /** Loads and saves one subtune's markers of the holding's row. */
  positionsFor(holding: DeckHolding): LoopPositionsStore {
    return {
      load: async (identity) => {
        const row = this.rowOf(holding);
        const markers: readonly LoopMarker[] =
          row === null ? [] : (subtuneMemoryOf(row, identity.subtune)?.markers ?? []);
        return [...markers];
      },
      save: async (identity, markers) => {
        this.editHeldRow(holding, { markers }, identity.subtune);
      },
    };
  }

  /** Keeps the host settings value for the holding's subtune. */
  saveSubtuneSettings(holding: DeckHolding, settings: PlainValue): void {
    this.editHeldRow(holding, { settings }, holding.subtune);
  }

  /** Records `subtune` as the row's last, and returns the holding moved to it. */
  selectSubtune(holding: DeckHolding, subtune: number): DeckHolding {
    const row = this.applyRowEdit(
      holding,
      (set, at) => editRowSubtune(set, holding.rowId, subtune, at),
      (copy) => {
        const lastSubtune = clamp(Math.trunc(subtune), 1, Math.max(copy.tune.subtuneCount, 1));
        return lastSubtune === copy.lastSubtune ? copy : { ...copy, lastSubtune };
      }
    );
    return row === null ? holding : { ...holding, subtune: row.lastSubtune };
  }

  markUnavailable(rowId: string, reason: string): void {
    this.store.setRowPrep({ rowId, prep: { phase: 'unavailable', reason } });
  }

  markAvailable(rowId: string): void {
    this.store.setRowPrep({ rowId, prep: null });
  }

  // ---- Hydration ----

  private async loadLibrary(): Promise<void> {
    try {
      const [summaries, currentSetId] = await Promise.all([
        this.setStore.list(),
        this.libraryState.load(),
      ]);
      const saved = currentSetId === null ? null : await this.setStore.load(currentSetId);
      if (saved !== null) {
        this.store.setSetsLibrary({ summaries, current: saved });
        return;
      }

      const created = this.newEmptySet(summaries.map((summary) => summary.name));
      this.store.setSetsLibrary({ summaries: [...summaries, summaryOf(created)], current: created });
      this.queueSet(created);
      this.queueLibrary();
      this.scheduleSave();
    } catch (error) {
      logWarn(`DjSets: load failed — ${describe(error)}`);
      this.savesSuppressed = true;
      this.alertService.warning(
        'The sets could not be loaded. Changes will not be saved until the app is reloaded.'
      );
      const unsaved = this.newEmptySet([]);
      this.store.setSetsLibrary({ summaries: [summaryOf(unsaved)], current: unsaved });
      this.store.setSetsSaveStatus({ status: 'failed' });
    }
  }

  private whenHydrated(run: () => void): void {
    if (this.store.sets.ready()) {
      run();
    } else {
      void this.hydrate().then(run);
    }
  }

  // ---- The current set ----

  private currentSet(): TuneSet | null {
    const setId = this.store.sets.currentSetId();
    return setId === null ? null : (this.store.sets.open()[setId] ?? null);
  }

  private newEmptySet(names: readonly string[]): TuneSet {
    return createSet({ id: crypto.randomUUID(), placeholder: nextPlaceholder(names), now: now() });
  }

  private startSet(): void {
    const summaries = this.store.sets.summaries();
    if (summaries.length >= MAX_SETS) {
      this.alertService.warning(
        `The library holds the maximum of ${MAX_SETS} sets. Delete one to add another.`
      );
      return;
    }

    const set = this.newEmptySet(summaries.map((summary) => summary.name));
    this.store.putOpenSet({ set });
    this.store.setCurrentSet({ setId: set.id, selectedRowId: null });
    this.queueSet(set);
    this.queueLibrary();
    this.scheduleSave();
    this.closeUnreferenced();
  }

  /** Puts `next` in as the set's working copy and queues it, unless the change was a no-op. */
  private commitSet(next: TuneSet, previous: TuneSet): void {
    if (next === previous) {
      return;
    }
    this.store.putOpenSet({ set: next });
    this.queueSet(next);
    this.scheduleSave();
  }

  /** Closes the open sets and drops the detached copies that no deck, no pending entry and not the
   *  current set references. */
  private closeUnreferenced(): void {
    const holdings = DECK_SLOTS.flatMap((slot) => this.store.sets.holdings()[slot] ?? []);
    const keep = new Set<string>([
      ...holdings.map((holding) => holding.setId),
      ...this.store.sets.pending().map((entry) => entry.setId),
    ]);
    const currentSetId = this.store.sets.currentSetId();
    if (currentSetId !== null) {
      keep.add(currentSetId);
    }
    this.store.closeOpenSets({ keep: [...keep] });

    const held = new Set(holdings.map((holding) => detachedKey(holding.setId, holding.rowId)));
    for (const key of [...this.detached.keys()]) {
      if (!held.has(key)) {
        this.detached.delete(key);
      }
    }
  }

  private heldRow(setId: string, rowId: string): SetRow | null {
    const open = this.store.sets.open()[setId]?.rows.find((row) => row.id === rowId);
    return open ?? this.detached.get(detachedKey(setId, rowId)) ?? null;
  }

  // ---- Selection ----

  private turnTo(rows: readonly SetRow[], index: number): void {
    const target = rows.length === 0 ? null : rows[clamp(index, 0, rows.length - 1)];
    this.store.selectSetRow({ rowId: target?.id ?? this.store.sets.selectedRowId(), turned: true });
  }

  // ---- Adding from the listing ----

  private async fetchForAdd(source: LoadSource): Promise<TuneReference | null> {
    try {
      return await this.loader.fetchReference(source);
    } catch (error) {
      logWarn(`DjSets: fetching ${source.fileName} failed — ${describe(error)}`);
      const text = `${source.fileName} could not be fetched — it was not added.`;
      this.alertService.warning(text);
      this.store.announceSets({ text });
      return null;
    }
  }

  /** Puts the fetched tune's row into the set the drop was for, against that set's copy as it is
   *  now and at the entry's gap as it is now (rows that landed meanwhile move it). Null when
   *  nothing was added: the set is gone or full, or already holds the tune. */
  private async placeRow(
    reference: TuneReference,
    source: LoadSource,
    pending: PendingRow
  ): Promise<{ readonly row: SetRow; readonly position: number } | null> {
    const sidHash = reference.identity.sidHash;
    if (this.reportDuplicate(pending.setId, sidHash)) {
      return null;
    }

    const memory = await this.memoryFor(sidHash);
    const set = this.store.sets.open()[pending.setId];
    if (!set || this.deleted.has(set.id)) {
      return null;
    }
    if (set.rows.length >= MAX_ROWS_PER_SET && findRow(set, sidHash) === null) {
      this.warnSetFull();
      return null;
    }

    const added = addRow(
      set,
      createRow({
        id: crypto.randomUUID(),
        tune: rowTuneOf(reference),
        host: hostOf(source),
        memory,
        startSubtune: reference.identity.subtune,
      }),
      this.store.sets.pending().find((entry) => entry.key === pending.key)?.index ?? pending.index,
      now()
    );
    if (!added.added) {
      this.reportDuplicate(pending.setId, sidHash);
      return null;
    }

    this.commitSet(added.set, set);
    if (set.rows.length === 0 && set.id === this.store.sets.currentSetId()) {
      this.store.selectSetRow({ rowId: added.row.id, turned: false });
    }
    return { row: added.row, position: added.set.rows.indexOf(added.row) };
  }

  /** When the set already holds the tune: selects its row and says so. */
  private reportDuplicate(setId: string, sidHash: string): boolean {
    const set = this.store.sets.open()[setId];
    const existing = set ? findRow(set, sidHash) : null;
    if (existing === null) {
      return false;
    }
    if (setId === this.store.sets.currentSetId()) {
      this.store.selectSetRow({ rowId: existing.id, turned: false });
    }
    this.store.announceSets({ text: `${existing.tune.title} is already in the set` });
    return true;
  }

  /** Removes a settled pending entry. `position` is where its row landed among the real rows, so
   *  the entries still fetching behind it keep their place relative to the real rows. */
  private dropPending(pending: PendingRow, position: number | null): void {
    const all = this.store.sets.pending();
    const dropped = all.findIndex((entry) => entry.key === pending.key);
    const rows = all
      .filter((entry) => entry.key !== pending.key)
      .map((entry, i) => {
        const after = i >= dropped;
        const shifts =
          position !== null &&
          entry.setId === pending.setId &&
          (entry.index > position || (entry.index === position && after));
        return shifts ? { ...entry, index: entry.index + 1 } : entry;
      });
    this.store.setPendingRows({ rows });
    this.closeUnreferenced();
  }

  private async analyzeRow(row: SetRow, reference: TuneReference): Promise<void> {
    const markAnalyzing = (): void => this.store.setRowPrep({ rowId: row.id, prep: ANALYZING });
    markAnalyzing();
    try {
      await this.loader.analyze(reference.identity, markAnalyzing);
      this.markAvailable(row.id);
    } catch (error) {
      this.markUnavailable(row.id, describe(error));
    }
  }

  private warnSetFull(): void {
    this.alertService.warning(this.setFullMessage());
  }

  private setFullMessage(): string {
    return `A set holds at most ${MAX_ROWS_PER_SET} tunes.`;
  }

  // ---- Tune memory ----

  /** The tune's latest memory, loaded once per hash. A failed load is a warning and null, and is
   *  not cached, so the next add tries again. */
  private async memoryFor(sidHash: string): Promise<TuneMemory | null> {
    if (!this.memoryCache.has(sidHash)) {
      try {
        const loaded = await this.memoryStore.load(sidHash);
        if (!this.memoryCache.has(sidHash)) {
          this.memoryCache.set(sidHash, loaded);
        }
      } catch (error) {
        logWarn(`DjSets: loading the memory of ${sidHash} failed — ${describe(error)}`);
        return null;
      }
    }
    return this.memoryCache.get(sidHash) ?? null;
  }

  private editHeldRow(holding: DeckHolding, change: SubtuneChange, subtune: number): void {
    this.applyRowEdit(
      holding,
      (set, at) => editRowMemory(set, holding.rowId, subtune, change, at),
      (copy) => changeRowMemory(copy, subtune, change)
    );
  }

  /**
   * Applies an edit to the row a holding names, wherever its working copy lives, and returns the
   * edited row (null when no copy of it exists).
   *
   * In an open set the set and the tune's memory are both queued — except while the set's `DELETE`
   * is in flight, when only the memory is: the set's copy still takes the edit, so detaching after
   * success carries it into the deck's copy and a failed delete re-queues the set with it. A
   * detached row saves the tune's memory only.
   */
  private applyRowEdit(
    holding: DeckHolding,
    inSet: (set: TuneSet, at: string) => RowEdit | null,
    onCopy: (copy: SetRow) => SetRow
  ): SetRow | null {
    const at = now();
    const set = this.store.sets.open()[holding.setId];
    const edit = set ? inSet(set, at) : null;
    if (set && edit) {
      if (edit.set !== set) {
        this.store.putOpenSet({ set: edit.set });
        this.queueSet(edit.set);
        this.queueMemory(edit.memory);
        this.scheduleSave();
      }
      return edit.row;
    }

    const key = detachedKey(holding.setId, holding.rowId);
    const copy = this.detached.get(key);
    if (!copy) {
      return null;
    }
    const edited = onCopy(copy);
    if (edited !== copy) {
      this.detached.set(key, edited);
      this.queueMemory(tuneMemoryOf(edited, at));
      this.scheduleSave();
    }
    return edited;
  }

  // ---- Saving ----

  private queueSet(set: TuneSet): void {
    if (!this.deleting.has(set.id) && !this.deleted.has(set.id)) {
      this.pendingSets.set(set.id, set);
    }
  }

  private queueMemory(memory: TuneMemory): void {
    this.memoryCache.set(memory.sidHash, memory);
    this.pendingMemories.set(memory.sidHash, memory);
  }

  private queueLibrary(): void {
    this.pendingLibrary = { currentSetId: this.store.sets.currentSetId() };
  }

  /** Lights the lamp and sends the pending documents after a quiet 300 ms. One flush runs at a
   *  time; a change during it sends again once it settles. A failed flush is not retried on a
   *  timer: the next change schedules the next one. */
  private scheduleSave(): void {
    if (this.savesSuppressed) {
      return;
    }
    this.store.setSetsSaveStatus({ status: 'saving' });
    if (this.flushing !== null) {
      this.saveAgain = true;
      return;
    }
    if (this.debounce !== null) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => {
      this.debounce = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    let release!: () => void;
    this.flushing = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      let failed: boolean;
      do {
        this.saveAgain = false;
        failed = await this.sendPending();
      } while (this.saveAgain);
      this.store.setSetsSaveStatus({ status: failed ? 'failed' : 'saved' });
    } finally {
      this.flushing = null;
      release();
    }
  }

  /** Sends the latest copy of every pending document at once. A failed document goes back into
   *  pending unless a newer copy is already there. Resolves true when any failed. */
  private async sendPending(): Promise<boolean> {
    const documents: PendingDocument[] = [
      ...[...this.pendingSets.values()].map((set) => ({
        send: () => this.setStore.save(set),
        requeue: () => this.queueSetIfAbsent(set),
      })),
      ...[...this.pendingMemories.values()].map((memory) => ({
        send: () => this.memoryStore.save(memory),
        requeue: () => {
          if (!this.pendingMemories.has(memory.sidHash)) {
            this.pendingMemories.set(memory.sidHash, memory);
          }
        },
      })),
    ];
    const library = this.pendingLibrary;
    if (library !== null) {
      documents.push({
        send: () => this.libraryState.save(library.currentSetId),
        requeue: () => {
          this.pendingLibrary ??= library;
        },
      });
    }
    this.pendingSets.clear();
    this.pendingMemories.clear();
    this.pendingLibrary = null;

    const results = await Promise.allSettled(documents.map(async (item) => item.send()));

    let failed = false;
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        failed = true;
        logError('DjSets: save failed', result.reason);
        documents[i].requeue();
      }
    });
    if (!failed) {
      this.failureAlerted = false;
    } else if (!this.failureAlerted) {
      this.failureAlerted = true;
      this.alertService.error('The set could not be saved. Later changes will retry.');
    }
    return failed;
  }

  private queueSetIfAbsent(set: TuneSet): void {
    if (!this.pendingSets.has(set.id)) {
      this.queueSet(set);
    }
  }

  /** Resolves once no flush is in flight. */
  private async settleFlush(): Promise<void> {
    while (this.flushing !== null) {
      await this.flushing;
    }
  }
}
