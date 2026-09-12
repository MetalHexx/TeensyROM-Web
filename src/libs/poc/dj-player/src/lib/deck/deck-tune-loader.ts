import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import { parseSidFile, SidParseError } from '@sidablist/core';
import type { SidFile } from '@sidablist/core';
import { TuneIndexService } from '../analysis/tune-index.service';
import { BUNDLED_TUNES, decodeBundledTune } from '../sid/bundled';
import { SID_PLAYER } from './deck-player';

/** A tune the Tune section can offer as a button — bundled, or opened from disk this session. */
export interface TuneSource {
  readonly id: string;
  readonly label: string;
  readonly getBytes: () => Uint8Array;
}

/**
 * One deck's tune machinery: which tunes it can offer, the one currently loaded, and the load
 * sequence that hands a fresh tune to this deck's own player and `TuneIndexService`.
 * Deck-scoped — lifted verbatim out of `DjPocViewComponent`, one instance per deck host.
 */
@Injectable()
export class DeckTuneLoader {
  private readonly player = inject(SID_PLAYER);
  private readonly tuneIndex = inject(TuneIndexService);

  private readonly bundledSources: readonly TuneSource[] = BUNDLED_TUNES.map((tune) => ({
    id: tune.id,
    label: tune.label,
    getBytes: () => decodeBundledTune(tune.base64),
  }));

  // Tunes opened from disk join the bundled buttons for the rest of the session rather than
  // replacing the file picker's value — a listening session runs for hours.
  private readonly diskSources = signal<readonly TuneSource[]>([]);
  private diskTuneCount = 0;

  readonly availableTunes = computed<readonly TuneSource[]>(() => [
    ...this.bundledSources,
    ...this.diskSources(),
  ]);
  private readonly _currentTune = signal<SidFile | null>(null);
  readonly currentTune: Signal<SidFile | null> = this._currentTune.asReadonly();
  private readonly _tuneError = signal<string | null>(null);
  readonly tuneError: Signal<string | null> = this._tuneError.asReadonly();

  selectTune(source: TuneSource): void {
    try {
      void this.loadTune(parseSidFile(source.getBytes()), source.label);
    } catch (error) {
      this._currentTune.set(null);
      this._tuneError.set(describeParseError(error));
    }
  }

  /** Loads a file the operator opened from disk. The picking itself — unwrapping the input's own
   *  `files` and resetting its value so the same file can be re-picked — belongs to whatever control
   *  offered the dialog; this entry point sees only the `File` that came out of it. */
  async loadPickedFile(file: File): Promise<void> {
    const bytes = new Uint8Array(await file.arrayBuffer());

    try {
      const parsed = parseSidFile(bytes);
      const source: TuneSource = {
        id: `disk-${this.diskTuneCount++}-${file.name}`,
        label: file.name,
        getBytes: () => bytes,
      };
      this.diskSources.update((sources) => [...sources, source]);
      await this.loadTune(parsed, file.name);
    } catch (error) {
      this._currentTune.set(null);
      this._tuneError.set(describeParseError(error));
    }
  }

  private async loadTune(file: SidFile, filename: string): Promise<void> {
    this._currentTune.set(file);
    this._tuneError.set(null);
    this.player.loadTune(file);
    // Called after loadTune, so the tune-index effect reads the subtune the load has already
    // settled on. Awaited so playback never races a background scan for the frame clock's thread —
    // a cache hit or a failed/abandoned scan releases this just as promptly as a completed one. Each
    // deck awaits its own index only — this loader and its player are both this deck's own instance.
    await this.tuneIndex.setTune(file, filename);
    void this.player.play();
  }
}

function describeParseError(error: unknown): string {
  return error instanceof SidParseError ? error.message : 'Failed to parse SID file.';
}
