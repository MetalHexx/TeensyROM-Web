import { computed } from '@angular/core';
import { subtuneMemoryOf, type SetRow, type TuneSet } from '@sidablist/tunes';
import {
  DeckHolding,
  DeckStatus,
  DjState,
  PendingRow,
  RowPrep,
  SetsSaveStatus,
  WritableStore,
} from '../dj-store';
import { DECK_SLOTS, type Slot } from '../slot';
import { decodeRowHost, formatListingLength, type RowHost } from '../sets/row-host';

export interface SetRowSummary {
  readonly id: string;
  /** 1-based, in the card's order — pending entries count. */
  readonly number: number;
  readonly title: string;
  readonly author: string;
  /** In the row's last subtune. */
  readonly loops: number;
  readonly cues: number;
  /** '03:43', or '—'. */
  readonly lengthText: string;
  /** The decks holding this row. */
  readonly decks: readonly {
    readonly slot: Slot;
    readonly state: 'playing' | 'paused' | 'off';
  }[];
  readonly selected: boolean;
  /** 'fetching' only on a pending entry. */
  readonly prep: RowPrep | { readonly phase: 'fetching' } | null;
  readonly pending: boolean;
}

export interface SetCardSummary {
  readonly ready: boolean;
  readonly name: string;
  readonly placeholder: string;
  /** Includes pending entries. */
  readonly rowCount: number;
  readonly save: SetsSaveStatus;
  /** Pending entries interleaved at their index, numbered in place. */
  readonly rows: readonly SetRowSummary[];
  /** In `rows`. */
  readonly selectedIndex: number | null;
  /** '03/08', or '— / —'. */
  readonly positionText: string;
  /** Rows only, no pending entries. */
  readonly realRowCount: number;
  /** The selection's index among real rows — what the knob and the Select keys use. */
  readonly selectedRowIndex: number | null;
  readonly selectedTitle: string | null;
  readonly selectedAuthor: string | null;
  readonly announcement: { readonly seq: number; readonly text: string } | null;
}

/** The saved sets, newest first. */
export interface SetTreeSummary {
  readonly sets: readonly {
    readonly id: string;
    readonly name: string;
    /** The set in the card; a set open only because a deck holds one of its rows is not loaded. */
    readonly loaded: boolean;
  }[];
}

export interface DeckSetSummary {
  /** The deck holds a row of the current set. */
  readonly available: boolean;
  /** '02/08', or '— / —'. */
  readonly positionText: string;
  /** '' while unavailable. */
  readonly setName: string;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
}

const NO_POSITION = '— / —';

const NO_DECK_SET: DeckSetSummary = {
  available: false,
  positionText: NO_POSITION,
  setName: '',
  canPrevious: false,
  canNext: false,
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function positionOf(index: number | null, count: number): string {
  return index === null ? NO_POSITION : `${pad2(index + 1)}/${pad2(count)}`;
}

/** A row's host is decoded once per value, so a malformed one warns once rather than on every
 *  rebuild of the card. */
const hostCache = new WeakMap<object, RowHost | null>();

function hostOf(row: SetRow): RowHost | null {
  const value = row.host;
  if (typeof value !== 'object' || value === null) {
    return decodeRowHost(value);
  }
  if (!hostCache.has(value)) {
    hostCache.set(value, decodeRowHost(value));
  }
  return hostCache.get(value) ?? null;
}

function lengthTextOf(row: SetRow): string {
  const host = hostOf(row);
  if (host === null) {
    return formatListingLength('');
  }
  const subtuneLength = host.lengths[row.lastSubtune - 1] ?? '';
  return formatListingLength(
    subtuneLength !== '' || host.lengths.length > 0 ? subtuneLength : host.playLength
  );
}

function deckStateOf(status: DeckStatus): 'playing' | 'paused' | 'off' {
  return status === 'playing' || status === 'paused' ? status : 'off';
}

function currentSetOf(
  currentSetId: string | null,
  open: Record<string, TuneSet>
): TuneSet | null {
  return currentSetId === null ? null : (open[currentSetId] ?? null);
}

/** The pending entries of the current set, grouped by the real-row gap they sit in. */
function pendingByGap(pending: readonly PendingRow[], rowCount: number): Map<number, PendingRow[]> {
  const byGap = new Map<number, PendingRow[]>();
  for (const entry of pending) {
    const gap = Math.min(Math.max(entry.index, 0), rowCount);
    byGap.set(gap, [...(byGap.get(gap) ?? []), entry]);
  }
  return byGap;
}

/**
 * The set card's whole display model: the current set's rows with the SIDs still fetching
 * interleaved at their gaps. Reads each deck's status through its own deep signal and never
 * `store.decks()` — `samplePosition` rewrites `decks` on every animation frame, and this summary
 * can hold a thousand rows.
 */
export function setCardSummary(store: WritableStore<DjState>) {
  return {
    setCardSummary: () =>
      computed<SetCardSummary>(() => {
        const { sets } = store;
        const currentSetId = sets.currentSetId();
        const set = currentSetOf(currentSetId, sets.open());
        const selectedRowId = sets.selectedRowId();
        const holdings = sets.holdings();
        const prep = sets.prep();
        const statuses: Record<Slot, DeckStatus> = {
          A: store.decks.A.status(),
          B: store.decks.B.status(),
        };

        const realRows = set?.rows ?? [];
        const pendingEntries = sets.pending().filter((entry) => entry.setId === currentSetId);
        const byGap = pendingByGap(pendingEntries, realRows.length);

        const rows: SetRowSummary[] = [];

        const pushPending = (gap: number): void => {
          for (const entry of byGap.get(gap) ?? []) {
            rows.push({
              id: entry.key,
              number: rows.length + 1,
              title: entry.title,
              author: entry.author,
              loops: 0,
              cues: 0,
              lengthText: formatListingLength(''),
              decks: [],
              selected: false,
              prep: { phase: 'fetching' },
              pending: true,
            });
          }
        };

        let selectedIndex: number | null = null;
        let selectedRowIndex: number | null = null;
        for (const [realIndex, row] of realRows.entries()) {
          pushPending(realIndex);

          const selected = row.id === selectedRowId;
          if (selected) {
            selectedIndex = rows.length;
            selectedRowIndex = realIndex;
          }
          const markers = subtuneMemoryOf(row, row.lastSubtune)?.markers ?? [];
          rows.push({
            id: row.id,
            number: rows.length + 1,
            title: row.tune.title,
            author: row.tune.author,
            loops: markers.filter((marker) => marker.end !== null).length,
            cues: markers.filter((marker) => marker.end === null).length,
            lengthText: lengthTextOf(row),
            decks: DECK_SLOTS.filter(
              (slot) => holdings[slot]?.setId === currentSetId && holdings[slot]?.rowId === row.id
            ).map((slot) => ({ slot, state: deckStateOf(statuses[slot]) })),
            selected,
            prep: prep[row.id] ?? null,
            pending: false,
          });
        }
        pushPending(realRows.length);

        const selectedRow = selectedRowIndex === null ? null : realRows[selectedRowIndex];
        return {
          ready: sets.ready(),
          name: set?.name ?? '',
          placeholder: set?.placeholder ?? '',
          rowCount: rows.length,
          save: sets.save(),
          rows,
          selectedIndex,
          positionText: positionOf(selectedIndex, rows.length),
          realRowCount: realRows.length,
          selectedRowIndex,
          selectedTitle: selectedRow?.tune.title ?? null,
          selectedAuthor: selectedRow?.tune.author ?? null,
          announcement: sets.announcement(),
        };
      }),
  };
}

function updatedTime(updated: string): number {
  const time = Date.parse(updated);
  return Number.isNaN(time) ? 0 : time;
}

/** The saved sets for the tree, newest first. */
export function setTreeSummary(store: WritableStore<DjState>) {
  return {
    setTreeSummary: () =>
      computed<SetTreeSummary>(() => {
        const currentSetId = store.sets.currentSetId();
        return {
          sets: [...store.sets.summaries()]
            .sort((a, b) => updatedTime(b.updated) - updatedTime(a.updated))
            .map((summary) => ({
              id: summary.id,
              name: summary.name,
              loaded: summary.id === currentSetId,
            })),
        };
      }),
  };
}

function sameHolding(a: DeckHolding | null, b: DeckHolding | null): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.setId === b.setId &&
      a.rowId === b.rowId &&
      a.sidHash === b.sidHash &&
      a.subtune === b.subtune)
  );
}

/** The row a deck holds, compared by value, so it fires only when the holding changes. */
export function deckHolding(store: WritableStore<DjState>) {
  return {
    deckHolding: (slot: Slot) =>
      computed<DeckHolding | null>(() => store.sets.holdings()[slot], { equal: sameHolding }),
  };
}

function sameDeckSet(a: DeckSetSummary, b: DeckSetSummary): boolean {
  return (
    a.available === b.available &&
    a.positionText === b.positionText &&
    a.setName === b.setName &&
    a.canPrevious === b.canPrevious &&
    a.canNext === b.canNext
  );
}

/** Where a deck's row sits in the current set. A deck steps over real rows, so pending entries do
 *  not count. */
export function deckSetSummary(store: WritableStore<DjState>) {
  return {
    deckSetSummary: (slot: Slot) =>
      computed<DeckSetSummary>(
        () => {
          const holding = store.sets.holdings()[slot];
          const currentSetId = store.sets.currentSetId();
          const set = currentSetOf(currentSetId, store.sets.open());
          if (holding === null || set === null || holding.setId !== set.id) {
            return NO_DECK_SET;
          }

          const index = set.rows.findIndex((row) => row.id === holding.rowId);
          if (index < 0) {
            return NO_DECK_SET;
          }
          return {
            available: true,
            positionText: positionOf(index, set.rows.length),
            setName: set.name,
            canPrevious: index > 0,
            canNext: index < set.rows.length - 1,
          };
        },
        { equal: sameDeckSet }
      ),
  };
}
