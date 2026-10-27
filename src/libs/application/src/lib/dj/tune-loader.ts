import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  Playable,
  ResolveOptions,
  TuneIdentity,
  TuneInserter,
  TuneReference,
  TuneResolver,
} from '@sidablist/tunes';
import {
  FILE_CONTENT_SERVICE,
  type FileContent,
  type IFileContentService,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '../device/device-store';
import { DjStore } from './dj-store';
import { DjFileKeyUtil, type DjFileKey } from './dj-file-key.util';
import { TUNE_INSERTER, TUNE_RESOLVER } from './ports';
import type { Slot } from './slot';
import type { LoadSource } from './load-source';

/** Called as a load or a subtune resolve crosses each phase. `reference` carries the tune's
 *  header facts when the loader just fetched them; it is `null` for the `loading` phase and when
 *  the tune was already known. The `indexing` phase fires only when the resolver actually starts a
 *  scan; a lookup hit resolves silently, reporting neither phase. */
export type LoadPhase = (phase: 'loading' | 'indexing', reference: TuneReference | null) => void;

const BYTES_GONE_MESSAGE = 'tune bytes are no longer available — drop it again';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A set row's tune is not in the cache and could not be brought back: the message names the file
 *  and why. Anything else a load throws is an ordinary load failure. */
export class RowUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RowUnavailableError';
  }
}

/**
 * Brings a tune to a deck: fetch on first sight, insert, resolve — the POC's `DeckTuneLoader.loadTune`
 * await-then-play sequence and `TuneIndexService.refreshIndex`'s generation guard, recomposed over
 * the tunes package ports instead of the POC's page-level collaborators.
 *
 * A listing drop takes `reference` (the tune's header facts, fetched unless seen this session) and
 * then `resolveRow` for the row it joined; a set row loaded on its own takes `resolveRow` alone,
 * fetching from where it was found when the cache no longer holds its bytes.
 *
 * The generation guard is per-slot and shared between `reference`, `resolveRow` and
 * `resolveSubtune`: each supersedes whichever of the three is in flight for that slot, and each
 * checks the counter after every await it takes — not once at the end — so a supersession
 * mid-fetch, mid-insert or mid-resolve is caught the moment it happens.
 */
@Injectable({ providedIn: 'root' })
export class TuneLoader {
  private readonly fileContent: IFileContentService = inject(FILE_CONTENT_SERVICE);
  private readonly inserter: TuneInserter = inject(TUNE_INSERTER);
  private readonly resolver: TuneResolver = inject(TUNE_RESOLVER);
  private readonly store = inject(DjStore);
  private readonly deviceStore = inject(DeviceStore);

  private readonly generation: Record<Slot, number> = { A: 0, B: 0 };

  /** The reference for a listing drop: seen this session, or fetched and inserted.
   *  Generation-guarded per slot; null when superseded. */
  async reference(
    slot: Slot,
    source: LoadSource,
    onPhase: LoadPhase
  ): Promise<TuneReference | null> {
    const myGeneration = ++this.generation[slot];
    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);

    const seen = this.store.seen()[key];
    if (seen !== undefined) {
      return seen;
    }
    onPhase('loading', null);
    return this.fetchAndInsert(source, key, () => this.generation[slot] !== myGeneration);
  }

  /**
   * Resolves a row's tune: from the cache when its bytes are there; on a miss, fetched from `source`
   * and inserted first. Generation-guarded per slot; null when superseded.
   *
   * On a miss it throws `RowUnavailableError` when `source` is unknown, its device is not
   * connected, the fetch fails, or the fetched file is no longer the row's tune. A scan failure
   * after the bytes are in hand is an ordinary error.
   */
  async resolveRow(
    slot: Slot,
    identity: TuneIdentity,
    source: LoadSource | null,
    onPhase: LoadPhase
  ): Promise<Playable | null> {
    const myGeneration = ++this.generation[slot];
    const isStale = (): boolean => this.generation[slot] !== myGeneration;

    let fetched: TuneReference | null = null;
    const options: ResolveOptions = { onScanStart: () => onPhase('indexing', fetched) };

    let playable = await this.resolver.resolve(identity, options);
    if (isStale()) {
      return null;
    }
    if (playable === null) {
      fetched = await this.fetchMissing(identity, source, isStale, onPhase);
      if (fetched === null) {
        return null;
      }
      playable = await this.resolver.resolve(identity, options);
      if (isStale()) {
        return null;
      }
    }
    if (playable === null) {
      throw new Error(BYTES_GONE_MESSAGE);
    }
    return playable;
  }

  /** Fetches (unless seen this session) and inserts the file; for set rows, so no slot and no
   *  generation. */
  async fetchReference(source: LoadSource): Promise<TuneReference> {
    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);
    return this.store.seen()[key] ?? (await this.fetchAndInsert(source, key));
  }

  /** Resolves `identity`, scanning when its index is not cached; `onScanStart` fires only for a real
   *  scan. Throws when the bytes are gone. */
  async analyze(identity: TuneIdentity, onScanStart: () => void): Promise<Playable> {
    const playable = await this.resolver.resolve(identity, { onScanStart });
    if (playable === null) {
      throw new Error(BYTES_GONE_MESSAGE);
    }
    return playable;
  }

  /** Resolves a subtune switch on an already-loaded tune. Bumps the same per-slot generation
   *  `reference` and `resolveRow` do — the one counter, one rule — so a drop supersedes an
   *  in-flight subtune resolve and a subtune switch supersedes an in-flight load. Reports the same
   *  `indexing` phase `resolveRow` does, on the same `onScanStart` condition, with no reference — a
   *  subtune switch starts from an identity whose header is already known, not from a fresh fetch. */
  async resolveSubtune(slot: Slot, identity: TuneIdentity, onPhase: LoadPhase): Promise<Playable | null> {
    const myGeneration = ++this.generation[slot];

    const options: ResolveOptions = { onScanStart: () => onPhase('indexing', null) };
    const playable = await this.resolver.resolve(identity, options);
    if (this.generation[slot] !== myGeneration) {
      return null;
    }
    if (playable === null) {
      throw new Error(BYTES_GONE_MESSAGE);
    }
    return playable;
  }

  /** Brings back a row's tune from where it was found. Null when superseded. */
  private async fetchMissing(
    identity: TuneIdentity,
    source: LoadSource | null,
    isStale: () => boolean,
    onPhase: LoadPhase
  ): Promise<TuneReference | null> {
    if (source === null) {
      throw new RowUnavailableError(
        `${this.titleOf(identity.sidHash)} is not cached and where it was found is unknown`
      );
    }
    if (!this.deviceStore.usableDevices().some((device) => device.deviceId === source.deviceId)) {
      throw new RowUnavailableError(
        `${source.fileName} is not cached and ${source.deviceId} is not connected`
      );
    }

    onPhase('loading', null);
    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);
    const reference = await this.fetchAndInsert(
      source,
      key,
      isStale,
      (error) =>
        new RowUnavailableError(`${source.fileName} could not be fetched: ${describeError(error)}`)
    );
    if (reference !== null && reference.identity.sidHash !== identity.sidHash) {
      throw new RowUnavailableError(
        `${source.fileName} on ${source.deviceId} has changed since it was added`
      );
    }
    return reference;
  }

  /** The title an open set shows for the tune, else its hash. */
  private titleOf(sidHash: string): string {
    for (const set of Object.values(this.store.sets.open())) {
      const row = set.rows.find((candidate) => candidate.tune.sidHash === sidHash);
      if (row !== undefined) {
        return row.tune.title;
      }
    }
    return sidHash;
  }

  /** The one fetch-insert-`markSeen` step. With `isStale`, checked after each await, a superseded
   *  call stops and resolves null. `fetchFailure` turns a failed fetch (not a failed insert) into
   *  the error to throw instead. */
  private fetchAndInsert(source: LoadSource, key: DjFileKey): Promise<TuneReference>;
  private fetchAndInsert(
    source: LoadSource,
    key: DjFileKey,
    isStale: () => boolean,
    fetchFailure?: (error: unknown) => Error
  ): Promise<TuneReference | null>;
  private async fetchAndInsert(
    source: LoadSource,
    key: DjFileKey,
    isStale: () => boolean = () => false,
    fetchFailure?: (error: unknown) => Error
  ): Promise<TuneReference | null> {
    let content: FileContent;
    try {
      content = await firstValueFrom(
        this.fileContent.getFileContent(source.deviceId, source.storageType, source.path)
      );
    } catch (error) {
      if (isStale()) {
        return null;
      }
      throw fetchFailure === undefined ? error : fetchFailure(error);
    }
    if (isStale()) {
      return null;
    }

    const reference = await this.inserter.insert(new Uint8Array(content.bytes));
    if (isStale()) {
      return null;
    }

    this.store.markSeen({ key, reference });
    return reference;
  }
}
