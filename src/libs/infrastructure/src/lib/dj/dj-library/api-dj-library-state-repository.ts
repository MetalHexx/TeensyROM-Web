import { Injectable, inject } from '@angular/core';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import type { IDjLibraryStateRepository } from '@teensyrom-nx/application';

/** `IDjLibraryStateRepository` over the server's library state endpoints. Errors propagate: the
 *  caller owns what a failed read or write means. */
@Injectable({ providedIn: 'root' })
export class ApiDjLibraryStateRepository implements IDjLibraryStateRepository {
  private readonly api = inject(DjLibraryApiService);

  async load(): Promise<string | null> {
    const response = await this.api.getDjLibraryState();
    return response.currentSetId ?? null;
  }

  async save(currentSetId: string | null): Promise<void> {
    await this.api.saveDjLibraryState({ djLibraryStateDto: { currentSetId } });
  }
}
