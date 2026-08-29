import { InjectionToken } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';

export interface ITuneIndexStorage {
  load(filename: string, subtune: number): TuneIndexRecord | null;
  save(record: TuneIndexRecord): void;
}

/**
 * A token rather than a direct `localStorage` dependency, so a test substitutes an in-memory double
 * instead of leaning on jsdom's `localStorage`.
 */
export const TUNE_INDEX_STORAGE = new InjectionToken<ITuneIndexStorage>('TUNE_INDEX_STORAGE');

export class LocalStorageTuneIndexStorage implements ITuneIndexStorage {
  private readonly STORAGE_KEY_PREFIX = 'teensyrom_dj_tune_index_';

  load(filename: string, subtune: number): TuneIndexRecord | null {
    const key = this.getStorageKey(filename, subtune);
    try {
      const json = localStorage.getItem(key);
      if (json === null) {
        logInfo(LogType.Info, `TuneIndexStorage: No stored record for ${filename}:${subtune}`);
        return null;
      }

      const parsed: unknown = JSON.parse(json);
      if (!isRecordLike(parsed) || parsed['formatVersion'] !== TUNE_INDEX_FORMAT_VERSION) {
        logWarn(`TuneIndexStorage: Discarding stale or malformed record for ${filename}:${subtune}`);
        return null;
      }

      return parsed as unknown as TuneIndexRecord;
    } catch (error) {
      logWarn(`TuneIndexStorage: Failed to load record for ${filename}:${subtune}: ${error}`);
      return null;
    }
  }

  save(record: TuneIndexRecord): void {
    try {
      const key = this.getStorageKey(record.filename, record.subtune);
      localStorage.setItem(key, JSON.stringify(record));
      logInfo(LogType.Success, `TuneIndexStorage: Persisted record for ${record.filename}:${record.subtune}`);
    } catch (error) {
      logWarn(`TuneIndexStorage: Failed to save record for ${record.filename}:${record.subtune}: ${error}`);
    }
  }

  private getStorageKey(filename: string, subtune: number): string {
    return `${this.STORAGE_KEY_PREFIX}${filename}:${subtune}`;
  }
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
