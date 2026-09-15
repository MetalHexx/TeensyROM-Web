import { Injectable, inject } from '@angular/core';
import type { TuneStore } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { DjDatabase, TUNES_STORE } from './dj-database';

interface TuneRow {
  readonly sidHash: string;
  readonly bytes: ArrayBuffer;
  readonly byteLength: number;
  readonly indexes: Record<string, TuneIndexRecord>;
}

/**
 * `TuneStore` over `DjDatabase`. Degraded (the database failed to open), it keeps a session-only
 * in-memory `Map` as a fallback so a drop can still resolve and play — only persistence is lost, a
 * refresh forgets everything. The map lives on the instance, so a second instance never sees it.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbTuneStore implements TuneStore {
  private readonly db = inject(DjDatabase);
  private readonly fallback = new Map<string, TuneRow>();

  async getBytes(sidHash: string): Promise<Uint8Array | null> {
    const row = await this.getRow(sidHash);
    return row ? new Uint8Array(row.bytes) : null;
  }

  async putBytes(sidHash: string, bytes: Uint8Array): Promise<void> {
    const copiedBuffer = bytes.slice().buffer;
    const db = await this.db.open();

    if (db === null) {
      const existing = this.fallback.get(sidHash);
      this.fallback.set(sidHash, {
        sidHash,
        bytes: copiedBuffer,
        byteLength: bytes.byteLength,
        indexes: existing?.indexes ?? {},
      });
      return;
    }

    await this.db.update<TuneRow>(TUNES_STORE, sidHash, (row) => ({
      sidHash,
      bytes: copiedBuffer,
      byteLength: bytes.byteLength,
      indexes: row?.indexes ?? {},
    }));
  }

  async getIndex(sidHash: string, subtune: number): Promise<TuneIndexRecord | null> {
    const row = await this.getRow(sidHash);
    return row?.indexes[String(subtune)] ?? null;
  }

  async putIndex(record: TuneIndexRecord): Promise<void> {
    const db = await this.db.open();

    if (db === null) {
      const existing = this.fallback.get(record.sidHash);
      if (!existing) {
        throw new Error(
          `IndexedDbTuneStore.putIndex: no bytes stored for sidHash ${record.sidHash}`
        );
      }
      this.fallback.set(record.sidHash, {
        ...existing,
        indexes: { ...existing.indexes, [String(record.subtune)]: record },
      });
      return;
    }

    await this.db.update<TuneRow>(TUNES_STORE, record.sidHash, (row) => {
      if (!row) {
        throw new Error(
          `IndexedDbTuneStore.putIndex: no bytes stored for sidHash ${record.sidHash}`
        );
      }
      return { ...row, indexes: { ...row.indexes, [String(record.subtune)]: record } };
    });
  }

  private async getRow(sidHash: string): Promise<TuneRow | undefined> {
    const db = await this.db.open();
    if (db === null) {
      return this.fallback.get(sidHash);
    }
    return this.db.get<TuneRow>(TUNES_STORE, sidHash);
  }
}
