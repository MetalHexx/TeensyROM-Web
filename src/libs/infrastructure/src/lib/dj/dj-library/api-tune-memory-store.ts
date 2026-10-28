import { Injectable, inject } from '@angular/core';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import type { TuneMemory, TuneMemoryStore } from '@sidablist/tunes';
import { toDjTuneMemoryDto, toTuneMemory } from './dj-library.mapper';

/** `TuneMemoryStore` over the server's tune memory endpoints. Errors propagate: the caller owns
 *  what a failed read or write means. */
@Injectable({ providedIn: 'root' })
export class ApiTuneMemoryStore implements TuneMemoryStore {
  private readonly api = inject(DjLibraryApiService);

  async load(sidHash: string): Promise<TuneMemory | null> {
    const response = await this.api.getTuneMemory({ sidHash });
    return response.memory == null ? null : toTuneMemory(response.memory);
  }

  async save(memory: TuneMemory): Promise<void> {
    await this.api.saveTuneMemory({
      sidHash: memory.sidHash,
      djTuneMemoryDto: toDjTuneMemoryDto(memory),
    });
  }
}
