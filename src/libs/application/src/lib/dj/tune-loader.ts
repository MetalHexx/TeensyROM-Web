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
import { FILE_CONTENT_SERVICE, type IFileContentService } from '@teensyrom-nx/domain';
import { DjStore } from './dj-store';
import { DjFileKeyUtil } from './dj-file-key.util';
import { TUNE_INSERTER, TUNE_RESOLVER } from './ports';
import type { Slot } from './slot';
import type { LoadSource } from './load-source';

/** Called as a load or a subtune resolve crosses each phase. `reference` carries the tune's
 *  header facts once they are known; it is `null` for the `loading` phase and for a subtune
 *  resolve, which starts from an identity it already knows the header for. The `indexing` phase
 *  fires only when the resolver actually starts a scan; a lookup hit resolves silently, reporting
 *  neither phase. */
export type LoadPhase = (phase: 'loading' | 'indexing', reference: TuneReference | null) => void;

/**
 * Turns a drop into a playable: fetch on first sight, insert, resolve — the POC's
 * `DeckTuneLoader.loadTune` await-then-play sequence and `TuneIndexService.refreshIndex`'s
 * generation guard, recomposed over the tunes package ports instead of the POC's page-level
 * collaborators.
 *
 * The generation guard is per-slot and shared between `load` and `resolveSubtune`: a drop
 * supersedes whichever of the two is in flight for that slot, and each checks the counter after
 * every await it takes — not once at the end — so a supersession mid-fetch, mid-insert or
 * mid-resolve is caught the moment it happens.
 */
@Injectable({ providedIn: 'root' })
export class TuneLoader {
  private readonly fileContent: IFileContentService = inject(FILE_CONTENT_SERVICE);
  private readonly inserter: TuneInserter = inject(TUNE_INSERTER);
  private readonly resolver: TuneResolver = inject(TUNE_RESOLVER);
  private readonly store = inject(DjStore);

  private readonly generation: Record<Slot, number> = { A: 0, B: 0 };

  async load(slot: Slot, source: LoadSource, onPhase: LoadPhase): Promise<Playable | null> {
    const myGeneration = ++this.generation[slot];
    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);

    let reference = this.store.seen()[key];
    if (reference === undefined) {
      onPhase('loading', null);

      const content = await firstValueFrom(
        this.fileContent.getFileContent(source.deviceId, source.storageType, source.path)
      );
      if (this.generation[slot] !== myGeneration) {
        return null;
      }

      reference = await this.inserter.insert(new Uint8Array(content.bytes));
      if (this.generation[slot] !== myGeneration) {
        return null;
      }

      this.store.markSeen({ key, reference });
    }

    const options: ResolveOptions = { onScanStart: () => onPhase('indexing', reference) };
    const playable = await this.resolver.resolve(reference.identity, options);
    if (this.generation[slot] !== myGeneration) {
      return null;
    }
    if (playable === null) {
      throw new Error('tune bytes are no longer available — drop it again');
    }
    return playable;
  }

  /** Resolves a subtune switch on an already-loaded tune. Bumps the same per-slot generation
   *  `load` does — the one counter, one rule — so a drop supersedes an in-flight subtune resolve
   *  and a subtune switch supersedes an in-flight load. Reports the same `indexing` phase `load`
   *  does, on the same `onScanStart` condition, with no reference — a subtune switch starts from
   *  an identity whose header is already known, not from a fresh fetch. */
  async resolveSubtune(slot: Slot, identity: TuneIdentity, onPhase: LoadPhase): Promise<Playable | null> {
    const myGeneration = ++this.generation[slot];

    const options: ResolveOptions = { onScanStart: () => onPhase('indexing', null) };
    const playable = await this.resolver.resolve(identity, options);
    if (this.generation[slot] !== myGeneration) {
      return null;
    }
    if (playable === null) {
      throw new Error('tune bytes are no longer available — drop it again');
    }
    return playable;
  }
}
