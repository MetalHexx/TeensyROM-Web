import {
  DirectoryItem,
  DirectoryTreeNode,
  DirectoryTreeNodeType,
  StorageType,
} from '@teensyrom-nx/domain';

export type DirectoryListingCache = ReadonlyMap<string, readonly DirectoryItem[]>;

export function directoryCacheKey(deviceId: string, storageType: StorageType, path: string): string {
  return `${deviceId}-${storageType}-${path}`;
}

/** The slice of a storage entry the tree reads: every folder loaded so far, keyed by path. */
export interface StorageDirectoryListings {
  deviceId: string;
  storageType: StorageType;
  directoryListings?: Record<string, DirectoryItem[]>;
}

/** Flattens each storage's accumulated folder listings into the cache `buildDirectoryTree` reads. */
export function buildDirectoryListingCache(
  entries: readonly StorageDirectoryListings[]
): DirectoryListingCache {
  const cache = new Map<string, readonly DirectoryItem[]>();

  for (const { deviceId, storageType, directoryListings } of entries) {
    for (const [path, directories] of Object.entries(directoryListings ?? {})) {
      cache.set(directoryCacheKey(deviceId, storageType, path), directories);
    }
  }

  return cache;
}

function getStorageTypeIcon(storageType: StorageType): string {
  switch (storageType) {
    case StorageType.Sd:
      return 'sd_storage';
    case StorageType.Usb:
      return 'usb';
    default:
      return 'storage';
  }
}

function createPlaceholderChildren(parentNodeId: string): DirectoryTreeNode[] {
  return [
    {
      id: `${parentNodeId}-placeholder`,
      name: 'Loading...',
      type: DirectoryTreeNodeType.Placeholder,
      icon: 'hourglass_empty',
    },
  ];
}

function determineDirectoryChildren(
  childDirectories: DirectoryTreeNode[],
  childIsCached: boolean,
  nodeId: string
): DirectoryTreeNode[] {
  // If we have child directories, return them
  if (childDirectories.length > 0) {
    return childDirectories;
  }

  // Cached data with no subdirectories means it's a real leaf, not a placeholder
  if (childIsCached) {
    return [];
  }

  // No cached data means not loaded yet, show placeholder
  return createPlaceholderChildren(nodeId);
}

function buildDirectoryNodes(
  deviceId: string,
  storageType: StorageType,
  parentPath: string,
  cache: DirectoryListingCache
): DirectoryTreeNode[] {
  const cachedDirectories = cache.get(directoryCacheKey(deviceId, storageType, parentPath));

  if (!cachedDirectories) {
    return [];
  }

  return cachedDirectories.map((dir) => {
    const nodeId = `${deviceId}-${storageType}-${dir.path}`;
    const childDirectories = buildDirectoryNodes(deviceId, storageType, dir.path, cache);
    const childIsCached = cache.has(directoryCacheKey(deviceId, storageType, dir.path));

    return {
      id: nodeId,
      name: dir.name,
      type: DirectoryTreeNodeType.Directory,
      icon: 'folder',
      deviceId,
      storageType,
      path: dir.path,
      children: determineDirectoryChildren(childDirectories, childIsCached, nodeId),
    };
  });
}

function buildStorageTypeNode(
  deviceId: string,
  storageType: StorageType,
  cache: DirectoryListingCache
): DirectoryTreeNode {
  const storageNodeId = `${deviceId}-${storageType}`;
  const directoryChildren = buildDirectoryNodes(deviceId, storageType, '/', cache);

  return {
    id: storageNodeId,
    name: `${storageType} Storage`,
    type: DirectoryTreeNodeType.StorageType,
    icon: getStorageTypeIcon(storageType),
    deviceId,
    storageType,
    path: '/',
    children: directoryChildren.length > 0 ? directoryChildren : createPlaceholderChildren(storageNodeId),
  };
}

/** Builds the device -> storage -> directory tree. The device node is labelled with
 *  `deviceName`; node ids are always derived from `deviceId`, never from the name, so a
 *  rename relabels the node without disturbing selection or expansion. */
export function buildDirectoryTree(args: {
  deviceId: string;
  deviceName: string;
  storageTypes: readonly StorageType[];
  cache: DirectoryListingCache;
}): DirectoryTreeNode[] {
  const { deviceId, deviceName, storageTypes, cache } = args;

  const storageNodes = storageTypes.map((storageType) => buildStorageTypeNode(deviceId, storageType, cache));
  const children =
    storageNodes.length > 0 ? storageNodes : createPlaceholderChildren(`device-${deviceId}`);

  const deviceNode: DirectoryTreeNode = {
    id: `device-${deviceId}`,
    name: deviceName,
    type: DirectoryTreeNodeType.Device,
    icon: 'desktop_windows',
    deviceId,
    children,
  };

  return [deviceNode];
}

/** The one place node-id derivation lives, so selection can never drift from construction. */
export function resolveSelectedNodeId(args: {
  deviceId: string;
  isDeviceLevel: boolean;
  storageType: StorageType | null;
  currentPath: string | null;
}): string | null {
  const { deviceId, isDeviceLevel, storageType, currentPath } = args;

  if (isDeviceLevel) {
    return `device-${deviceId}`;
  }

  if (storageType === null || currentPath === null) {
    return null;
  }

  if (currentPath === '/') {
    return `${deviceId}-${storageType}`;
  }

  return `${deviceId}-${storageType}-${currentPath}`;
}
