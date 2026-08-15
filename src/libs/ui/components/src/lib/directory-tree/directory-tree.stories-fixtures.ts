import { DirectoryItem, DirectoryTreeNode, DirectoryTreeNodeType, StorageType } from '@teensyrom-nx/domain';

/**
 * Shared mock directory tree for a single fake TeensyROM device, reused across the
 * directory-tree, directory-tree-node, and directory-item stories so the data reads
 * as one coherent device rather than unrelated per-story fixtures.
 */
const DEVICE_ID = 'teensyrom-1';

export const mockPlaceholderNode: DirectoryTreeNode = {
  id: 'teensyrom-1-SD-/games-placeholder',
  name: 'Loading...',
  type: DirectoryTreeNodeType.Placeholder,
  icon: 'hourglass_empty',
};

export const mockArcadeNode: DirectoryTreeNode = {
  id: 'teensyrom-1-SD-/games/arcade',
  name: 'Arcade',
  type: DirectoryTreeNodeType.Directory,
  icon: 'folder',
  deviceId: DEVICE_ID,
  storageType: StorageType.Sd,
  path: '/games/arcade',
};

export const mockGamesNode: DirectoryTreeNode = {
  id: 'teensyrom-1-SD-/games',
  name: 'Games',
  type: DirectoryTreeNodeType.Directory,
  icon: 'folder',
  deviceId: DEVICE_ID,
  storageType: StorageType.Sd,
  path: '/games',
  children: [mockArcadeNode, mockPlaceholderNode],
};

export const mockMusicNode: DirectoryTreeNode = {
  id: 'teensyrom-1-SD-/music',
  name: 'Music',
  type: DirectoryTreeNodeType.Directory,
  icon: 'folder',
  deviceId: DEVICE_ID,
  storageType: StorageType.Sd,
  path: '/music',
};

export const mockSdStorageNode: DirectoryTreeNode = {
  id: 'teensyrom-1-SD',
  name: 'SD Storage',
  type: DirectoryTreeNodeType.StorageType,
  icon: 'sd_storage',
  deviceId: DEVICE_ID,
  storageType: StorageType.Sd,
  path: '/',
  children: [mockGamesNode, mockMusicNode],
};

export const mockDeviceNode: DirectoryTreeNode = {
  id: `device-${DEVICE_ID}`,
  name: 'TeensyROM',
  type: DirectoryTreeNodeType.Device,
  icon: 'desktop_windows',
  deviceId: DEVICE_ID,
  children: [mockSdStorageNode],
};

export const mockDirectoryTree: DirectoryTreeNode[] = [mockDeviceNode];

export const mockGamesDirectoryItem: DirectoryItem = {
  name: mockGamesNode.name,
  path: mockGamesNode.path ?? '/',
};

export const mockArcadeDirectoryItem: DirectoryItem = {
  name: mockArcadeNode.name,
  path: mockArcadeNode.path ?? '/',
};
