import { InjectionToken } from '@angular/core';
import {
  AddWatchFolderInput,
  WatchFolder,
  WatchFolderDestinationChange,
  WatchFolderField,
} from '../models/watch-folder.model';

/** Manages the folders the engine watches and the devices each one delivers to. */
export interface IWatchFolderService {
  list(): Promise<WatchFolder[]>;
  /** Adds a folder, or a destination for another device to a folder already watched. */
  add(input: AddWatchFolderInput): Promise<WatchFolder>;
  setDestination(
    watchFolderId: string,
    deviceId: string,
    change: WatchFolderDestinationChange
  ): Promise<WatchFolder>;
  setEnabled(watchFolderId: string, enabled: boolean): Promise<WatchFolder>;
  remove(watchFolderId: string): Promise<void>;
  /** Removing a folder's last device removes the folder too. */
  removeDestination(
    watchFolderId: string,
    deviceId: string
  ): Promise<{ folderRemoved: boolean; watchFolder: WatchFolder | null }>;
}

export const WATCH_FOLDER_SERVICE = new InjectionToken<IWatchFolderService>('WATCH_FOLDER_SERVICE');

/** The engine refused a watch-folder change; field names the form field it concerns, when known. */
export class WatchFolderRejectedError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field: WatchFolderField | null
  ) {
    super(message);
    this.name = 'WatchFolderRejectedError';
  }
}
