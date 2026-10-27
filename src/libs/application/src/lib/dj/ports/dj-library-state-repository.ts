import { InjectionToken } from '@angular/core';

/** The one fact about the DJ library kept beside the sets themselves: which set is current. */
export interface IDjLibraryStateRepository {
  /** The current set's id; null when none was saved. */
  load(): Promise<string | null>;
  save(currentSetId: string | null): Promise<void>;
}

export const DJ_LIBRARY_STATE_REPOSITORY = new InjectionToken<IDjLibraryStateRepository>(
  'DJ_LIBRARY_STATE_REPOSITORY'
);
