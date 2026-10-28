import { describe, it, expect } from 'vitest';
import {
  DirectoryListing,
  DirectoryTreeNode,
  DirectoryTreeNodeType,
  StorageType,
} from '@teensyrom-nx/domain';
import {
  buildDirectoryListingCache,
  buildDirectoryTree,
  directoryCacheKey,
  resolveSelectedNodeId,
  DirectoryListingCache,
} from './directory-tree.model';

const DEVICE_ID = 'device-1';
const DEVICE_NAME = 'TR-1';

function cacheFrom(listings: DirectoryListing[]): DirectoryListingCache {
  return new Map(
    listings.map((l) => [directoryCacheKey(l.deviceId, l.storageType, l.path), l.directories])
  );
}

function findNode(nodes: DirectoryTreeNode[], id: string): DirectoryTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = node.children && findNode(node.children, id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

describe('directory-tree.model', () => {
  describe('buildDirectoryTree', () => {
    it('always returns exactly one root device node with the expected shape', () => {
      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [StorageType.Sd],
        cache: cacheFrom([]),
      });

      expect(nodes).toHaveLength(1);
      const deviceNode = nodes[0];
      expect(deviceNode.id).toBe(`device-${DEVICE_ID}`);
      expect(deviceNode.name).toBe(DEVICE_NAME);
      expect(deviceNode.type).toBe(DirectoryTreeNodeType.Device);
      expect(deviceNode.icon).toBe('desktop_windows');
      expect(deviceNode.deviceId).toBe(DEVICE_ID);
    });

    it('relabels the device node from deviceName without changing any node id', () => {
      const cache = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
      ]);
      const build = (deviceName: string) =>
        buildDirectoryTree({
          deviceId: DEVICE_ID,
          deviceName,
          storageTypes: [StorageType.Sd],
          cache,
        });
      const collectIds = (nodes: DirectoryTreeNode[]): string[] =>
        nodes.flatMap((node) => [node.id, ...collectIds(node.children ?? [])]);

      const before = build('TR-1');
      const after = build('Living Room');

      expect(before[0].name).toBe('TR-1');
      expect(after[0].name).toBe('Living Room');
      expect(collectIds(after)).toEqual(collectIds(before));
      expect(after[0].id).toBe(`device-${DEVICE_ID}`);
    });

    it('gives the device node a placeholder child when storageTypes is empty', () => {
      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [],
        cache: cacheFrom([]),
      });

      const deviceNode = nodes[0];
      expect(deviceNode.children).toHaveLength(1);
      expect(deviceNode.children?.[0]).toMatchObject({
        name: 'Loading...',
        type: DirectoryTreeNodeType.Placeholder,
        icon: 'hourglass_empty',
      });
    });

    it('builds one storage node per storage type, ordered and named as given', () => {
      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [StorageType.Usb, StorageType.Sd],
        cache: cacheFrom([]),
      });

      const storageNodes = nodes[0].children ?? [];
      expect(storageNodes).toHaveLength(2);
      expect(storageNodes[0]).toMatchObject({
        name: `${StorageType.Usb} Storage`,
        type: DirectoryTreeNodeType.StorageType,
        path: '/',
        deviceId: DEVICE_ID,
        storageType: StorageType.Usb,
      });
      expect(storageNodes[1]).toMatchObject({
        name: `${StorageType.Sd} Storage`,
        type: DirectoryTreeNodeType.StorageType,
        path: '/',
        deviceId: DEVICE_ID,
        storageType: StorageType.Sd,
      });
    });

    it('maps storage type to icon: sd_storage, usb, and storage for anything else', () => {
      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [StorageType.Sd, StorageType.Usb, 'OTHER' as StorageType],
        cache: cacheFrom([]),
      });

      const [sdNode, usbNode, otherNode] = nodes[0].children ?? [];
      expect(sdNode.icon).toBe('sd_storage');
      expect(usbNode.icon).toBe('usb');
      expect(otherNode.icon).toBe('storage');
    });

    it('recurses into cached child listings to build nested directory nodes', () => {
      const cache = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/games',
          directories: [{ name: 'demos', path: '/games/demos' }],
        },
      ]);

      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [StorageType.Sd],
        cache,
      });

      const gamesNode = findNode(nodes, `${DEVICE_ID}-${StorageType.Sd}-/games`);
      expect(gamesNode).toMatchObject({
        name: 'games',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
        path: '/games',
      });

      const demosNode = findNode(nodes, `${DEVICE_ID}-${StorageType.Sd}-/games/demos`);
      expect(demosNode).toMatchObject({
        name: 'demos',
        type: DirectoryTreeNodeType.Directory,
        icon: 'folder',
        path: '/games/demos',
      });
    });

    it('directory children ladder: child directories present returns them', () => {
      const cache = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/games',
          directories: [{ name: 'demos', path: '/games/demos' }],
        },
      ]);

      const nodes = buildDirectoryTree({

        deviceId: DEVICE_ID,

        deviceName: DEVICE_NAME,

        storageTypes: [StorageType.Sd],

        cache,

      });
      const gamesNode = findNode(nodes, `${DEVICE_ID}-${StorageType.Sd}-/games`);

      expect(gamesNode?.children).toHaveLength(1);
      expect(gamesNode?.children?.[0].name).toBe('demos');
    });

    it('directory children ladder: no subdirectories but path is cached returns a real leaf ([])', () => {
      const cache = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/games',
          directories: [],
        },
      ]);

      const nodes = buildDirectoryTree({

        deviceId: DEVICE_ID,

        deviceName: DEVICE_NAME,

        storageTypes: [StorageType.Sd],

        cache,

      });
      const gamesNode = findNode(nodes, `${DEVICE_ID}-${StorageType.Sd}-/games`);

      expect(gamesNode?.children).toEqual([]);
    });

    it('directory children ladder: path not in cache returns a placeholder', () => {
      const cache = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
      ]);

      const nodes = buildDirectoryTree({

        deviceId: DEVICE_ID,

        deviceName: DEVICE_NAME,

        storageTypes: [StorageType.Sd],

        cache,

      });
      const gamesNode = findNode(nodes, `${DEVICE_ID}-${StorageType.Sd}-/games`);

      expect(gamesNode?.children).toHaveLength(1);
      expect(gamesNode?.children?.[0]).toMatchObject({
        name: 'Loading...',
        type: DirectoryTreeNodeType.Placeholder,
        icon: 'hourglass_empty',
      });
    });

    it('a cached-but-empty storage root keeps its placeholder rather than collapsing to []', () => {
      const cache = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [],
        },
      ]);

      const nodes = buildDirectoryTree({

        deviceId: DEVICE_ID,

        deviceName: DEVICE_NAME,

        storageTypes: [StorageType.Sd],

        cache,

      });
      const storageNode = nodes[0].children?.[0];

      expect(storageNode?.children).toHaveLength(1);
      expect(storageNode?.children?.[0]).toMatchObject({
        name: 'Loading...',
        type: DirectoryTreeNodeType.Placeholder,
        icon: 'hourglass_empty',
      });
    });
  });

  describe('buildDirectoryListingCache', () => {
    it('keys every loaded folder of every storage the way buildDirectoryTree reads it', () => {
      const cache = buildDirectoryListingCache([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          directoryListings: {
            '/': [{ name: 'games', path: '/games' }],
            '/games': [{ name: 'demos', path: '/games/demos' }],
          },
        },
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Usb,
          directoryListings: { '/': [{ name: 'music', path: '/music' }] },
        },
      ]);

      expect(cache.get(directoryCacheKey(DEVICE_ID, StorageType.Sd, '/'))).toEqual([
        { name: 'games', path: '/games' },
      ]);
      expect(cache.get(directoryCacheKey(DEVICE_ID, StorageType.Sd, '/games'))).toEqual([
        { name: 'demos', path: '/games/demos' },
      ]);
      expect(cache.get(directoryCacheKey(DEVICE_ID, StorageType.Usb, '/'))).toEqual([
        { name: 'music', path: '/music' },
      ]);
    });

    it('builds the full tree from a storage whose current folder is not the root', () => {
      const cache = buildDirectoryListingCache([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          directoryListings: {
            '/': [{ name: 'games', path: '/games' }],
            '/games': [],
          },
        },
      ]);

      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [StorageType.Sd],
        cache,
      });

      const storageNode = nodes[0].children?.[0];
      expect(storageNode?.children?.map((n) => n.name)).toEqual(['games']);
    });

    it('leaves a storage without listings out of the cache, so its root keeps the placeholder', () => {
      const cache = buildDirectoryListingCache([
        { deviceId: DEVICE_ID, storageType: StorageType.Sd },
      ]);

      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        storageTypes: [StorageType.Sd],
        cache,
      });

      expect(cache.size).toBe(0);
      expect(nodes[0].children?.[0].children?.[0].type).toBe(DirectoryTreeNodeType.Placeholder);
    });
  });

  describe('resolveSelectedNodeId', () => {
    it('returns the device node id when isDeviceLevel is true', () => {
      const result = resolveSelectedNodeId({
        deviceId: DEVICE_ID,
        isDeviceLevel: true,
        storageType: StorageType.Sd,
        currentPath: '/anything',
      });

      expect(result).toBe(`device-${DEVICE_ID}`);
    });

    it('returns null when storageType or currentPath is null', () => {
      expect(
        resolveSelectedNodeId({
          deviceId: DEVICE_ID,
          isDeviceLevel: false,
          storageType: null,
          currentPath: '/',
        })
      ).toBeNull();

      expect(
        resolveSelectedNodeId({
          deviceId: DEVICE_ID,
          isDeviceLevel: false,
          storageType: StorageType.Sd,
          currentPath: null,
        })
      ).toBeNull();
    });

    it('returns the storage node id (no path segment) when currentPath is the storage root', () => {
      const result = resolveSelectedNodeId({
        deviceId: DEVICE_ID,
        isDeviceLevel: false,
        storageType: StorageType.Sd,
        currentPath: '/',
      });

      expect(result).toBe(`${DEVICE_ID}-${StorageType.Sd}`);
    });

    it('returns the directory node id when currentPath is a nested directory', () => {
      const result = resolveSelectedNodeId({
        deviceId: DEVICE_ID,
        isDeviceLevel: false,
        storageType: StorageType.Sd,
        currentPath: '/games',
      });

      expect(result).toBe(`${DEVICE_ID}-${StorageType.Sd}-/games`);
    });
  });
});
