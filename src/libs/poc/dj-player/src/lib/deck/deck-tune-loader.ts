import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import { DjPlayerEngine } from '../engine/dj-player-engine';
import { TuneIndexService } from '../analysis/tune-index.service';
import { BUNDLED_TUNES, decodeBundledTune } from '../sid/bundled';
import { parseSidFile } from '../sid/sid-file.parser';
import { SidParseError } from '../sid/sid-file.model';
import type { SidFile } from '../sid/sid-file.model';

/** A tune the Tune section can offer as a button — bundled, or opened from disk this session. */
export interface TuneSource {
  readonly id: string;
  readonly label: string;
  readonly getBytes: () => Uint8Array;
}

/**
 * One deck's tune machinery: which tunes it can offer, the one currently loaded, and the load
 * sequence that hands a fresh tune to this deck's own `DjPlayerEngine` and `TuneIndexService`.
 * Deck-scoped — lifted verbatim out of `DjPocViewComponent`, one instance per deck host.
 */
@Injectable()
export class DeckTuneLoader {
  private readonly engine = inject(DjPlayerEngine);
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

  async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allow re-picking the same file later in the session
    if (!file) {
      return;
    }

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
    this.engine.loadTune(file);
    // Called after loadTune, so the tune-index effect reads the subtune the load has already
    // settled on. Awaited so playback never races a background scan for the frame clock's thread —
    // a cache hit or a failed/abandoned scan releases this just as promptly as a completed one. Each
    // deck awaits its own index only — this loader and its engine are both this deck's own instance.
    await this.tuneIndex.setTune(file, filename);
    // play() already no-ops into the engine's "no MIDI output port selected" error path when no
    // port is chosen, so no separate guard is needed here.
    void this.engine.play();
  }
}

function describeParseError(error: unknown): string {
  return error instanceof SidParseError ? error.message : 'Failed to parse SID file.';
}
