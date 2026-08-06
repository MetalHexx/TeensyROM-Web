import { StorageType } from './storage-type.enum';
import { DirectoryItem } from './directory-item.model';

export enum DirectoryTreeNodeType {
  Device = 'device',
  StorageType = 'storage',
  Directory = 'directory',
  Placeholder = 'placeholder',
}

export interface DirectoryTreeNode {
  id: string;
  name: string;
  type: DirectoryTreeNodeType;
  icon: string;
  deviceId?: string;
  storageType?: StorageType;
  path?: string;
  isLoading?: boolean;
  error?: string | null;
  children?: DirectoryTreeNode[];
}

/** One directory listing as the tree consumes it — the caller maps store state into this. */
export interface DirectoryListing {
  deviceId: string;
  storageType: StorageType;
  path: string;
  directories: DirectoryItem[];
}
