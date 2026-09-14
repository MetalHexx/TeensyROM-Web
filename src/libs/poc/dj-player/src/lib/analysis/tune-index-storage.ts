import { InjectionToken } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { TUNE_INDEX_FORMAT_VERSION } from '@sidablist/analysis';
import type { TuneIndexRecord } from '@sidablist/analysis';

export interface ITuneIndexStorage {
  load(sidHash: string, subtune: number): TuneIndexRecord | null;
  save(record: TuneIndexRecord): void;
}

/**
 * A token rather than a direct `localStorage` dependency, so a test substitutes an in-memory double
 * instead of leaning on jsdom's `localStorage`.
 */
export const TUNE_INDEX_STORAGE = new InjectionToken<ITuneIndexStorage>('TUNE_INDEX_STORAGE');

export class LocalStorageTuneIndexStorage implements ITuneIndexStorage {
  private readonly STORAGE_KEY_PREFIX = 'teensyrom_dj_tune_index_';

  load(sidHash: string, subtune: number): TuneIndexRecord | null {
    const key = this.getStorageKey(sidHash, subtune);
    try {
      const json = localStorage.getItem(key);
      if (json === null) {
        logInfo(LogType.Info, `TuneIndexStorage: No stored record for ${sidHash}:${subtune}`);
        return null;
      }

      const parsed: unknown = JSON.parse(json);
      if (!isRecordLike(parsed) || parsed['formatVersion'] !== TUNE_INDEX_FORMAT_VERSION) {
        logWarn(`TuneIndexStorage: Discarding stale or malformed record for ${sidHash}:${subtune}`);
        return null;
      }

      return parsed as unknown as TuneIndexRecord;
    } catch (error) {
      logWarn(`TuneIndexStorage: Failed to load record for ${sidHash}:${subtune}: ${error}`);
      return null;
    }
  }

  save(record: TuneIndexRecord): void {
    try {
      const key = this.getStorageKey(record.sidHash, record.subtune);
      localStorage.setItem(key, JSON.stringify(record));
      logInfo(
        LogType.Success,
        `TuneIndexStorage: Persisted record for ${record.sidHash}:${record.subtune}`
      );
    } catch (error) {
      logWarn(
        `TuneIndexStorage: Failed to save record for ${record.sidHash}:${record.subtune}: ${error}`
      );
    }
  }

  private getStorageKey(sidHash: string, subtune: number): string {
    return `${this.STORAGE_KEY_PREFIX}${sidHash}:${subtune}`;
  }
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
