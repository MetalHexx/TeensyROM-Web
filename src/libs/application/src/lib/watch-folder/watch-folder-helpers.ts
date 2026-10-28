import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { updateState } from '@angular-architects/ngrx-toolkit';
import {
  WatchFolder,
  WatchFolderRejectedError,
  WatchFolderRejection,
} from '@teensyrom-nx/domain';
import type { WatchFolderStoreState } from './watch-folder-store';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

/** Replaces the folder with the same id, or appends it when it is new. */
export function upsertFolder(folders: WatchFolder[], folder: WatchFolder): WatchFolder[] {
  return folders.some((f) => f.id === folder.id)
    ? folders.map((f) => (f.id === folder.id ? folder : f))
    : [...folders, folder];
}

/** Marks a folder as having a change in flight (or clears the mark). */
export function setPending(
  store: WritableStore<WatchFolderStoreState>,
  actionMessage: string,
  watchFolderId: string,
  pending: boolean
): void {
  updateState(store, actionMessage, (state) => ({
    ...state,
    pendingFolderIds: pending
      ? [...state.pendingFolderIds.filter((id) => id !== watchFolderId), watchFolderId]
      : state.pendingFolderIds.filter((id) => id !== watchFolderId),
  }));
}

/** Words for a failed change, taken from the engine refusal when there is one. */
export function toRejection(error: unknown, fallback: string): WatchFolderRejection {
  if (error instanceof WatchFolderRejectedError) {
    return { message: error.message, field: error.field };
  }
  return { message: (error as Error)?.message || fallback, field: null };
}
