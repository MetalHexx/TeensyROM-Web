import { StorageType } from './storage-type.enum';

/** How the engine is treating a watched folder right now. */
export enum WatchFolderState {
  Watching = 'Watching',
  Off = 'Off',
  Unavailable = 'Unavailable',
}

/** One device a watched folder delivers to, and where on that device. */
export interface WatchFolderDestination {
  id: string;
  deviceId: string;
  /** The device's name, or null when the engine does not know the device. */
  deviceName: string | null;
  storageType: StorageType;
  /** Directory on the device the files land in. */
  path: string;
  /** Whether a delivered file is launched after it lands. */
  launch: boolean;
}

/** A folder on this machine that the engine watches and delivers to one or more devices. */
export interface WatchFolder {
  id: string;
  path: string;
  enabled: boolean;
  state: WatchFolderState;
  destinations: WatchFolderDestination[];
}

/** What it takes to add a folder, or a destination for another device to a folder already watched. */
export interface AddWatchFolderInput {
  path: string;
  deviceId: string;
  storageType: StorageType;
  devicePath: string | null;
  launch: boolean;
}

/** The fields of a destination that can change; an omitted or null field stays as it is. */
export interface WatchFolderDestinationChange {
  devicePath?: string | null;
  launch?: boolean | null;
}

/** The form field a rejected watch-folder change concerns. */
export type WatchFolderField = 'folder' | 'device' | 'storage' | 'devicePath';

/** A refused watch-folder change, in words the user can act on. */
export interface WatchFolderRejection {
  message: string;
  field: WatchFolderField | null;
}
