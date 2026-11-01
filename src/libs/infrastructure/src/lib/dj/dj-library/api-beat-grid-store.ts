import { Injectable, inject } from '@angular/core';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import type { BeatGridStore, TuneBeatGrids } from '@teensyrom-nx/application';
import { toDjTuneGridsDto, toTuneBeatGrids } from './dj-library.mapper';

/** `BeatGridStore` over the server's tune grids endpoints. Errors propagate: the caller owns what a
 *  failed read or write means. */
@Injectable({ providedIn: 'root' })
export class ApiBeatGridStore implements BeatGridStore {
  private readonly api = inject(DjLibraryApiService);

  async load(sidHash: string): Promise<TuneBeatGrids | null> {
    const response = await this.api.getTuneGrids({ sidHash });
    return response.grids == null ? null : toTuneBeatGrids(response.grids);
  }

  async save(grids: TuneBeatGrids): Promise<void> {
    await this.api.saveTuneGrids({
      sidHash: grids.sidHash,
      djTuneGridsDto: toDjTuneGridsDto(grids),
    });
  }
}
