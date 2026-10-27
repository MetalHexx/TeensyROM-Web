import { Injectable, inject } from '@angular/core';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import type { SetStore, SetSummary, TuneSet } from '@sidablist/tunes';
import { toDjSetDto, toSetSummary, toTuneSet } from './dj-library.mapper';

/** `SetStore` over the server's DJ set endpoints. Errors propagate: the caller owns what a failed
 *  read or write means. */
@Injectable({ providedIn: 'root' })
export class ApiSetStore implements SetStore {
  private readonly api = inject(DjLibraryApiService);

  async list(): Promise<readonly SetSummary[]> {
    const response = await this.api.listDjSets();
    return response.sets.map(toSetSummary);
  }

  async load(id: string): Promise<TuneSet | null> {
    const response = await this.api.getDjSet({ setId: id });
    return response.set == null ? null : toTuneSet(response.set);
  }

  async save(set: TuneSet): Promise<void> {
    await this.api.saveDjSet({ setId: set.id, djSetDto: toDjSetDto(set) });
  }

  async delete(id: string): Promise<void> {
    await this.api.deleteDjSet({ setId: id });
  }
}
