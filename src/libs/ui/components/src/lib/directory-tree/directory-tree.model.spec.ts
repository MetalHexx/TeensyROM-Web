import { describe, it, expect } from 'vitest';
import {
  DirectoryListing,
  DirectoryTreeNode,
  DirectoryTreeNodeType,
  StorageType,
} from '@teensyrom-nx/domain';
import {
  buildDirectoryTree,
  mergeDirectoryListings,
  resolveSelectedNodeId,
  DirectoryListingCache,
} from './directory-tree.model';

const DEVICE_ID = 'device-1';

function cacheFrom(listings: DirectoryListing[]): DirectoryListingCache {
  return mergeDirectoryListings(new Map(), listings);
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
        storageTypes: [StorageType.Sd],
        cache: cacheFrom([]),
      });

      expect(nodes).toHaveLength(1);
      const deviceNode = nodes[0];
      expect(deviceNode.id).toBe(`device-${DEVICE_ID}`);
      expect(deviceNode.name).toBe(`Device ${DEVICE_ID}`);
      expect(deviceNode.type).toBe(DirectoryTreeNodeType.Device);
      expect(deviceNode.icon).toBe('desktop_windows');
      expect(deviceNode.deviceId).toBe(DEVICE_ID);
    });

    it('gives the device node a placeholder child when storageTypes is empty', () => {
      const nodes = buildDirectoryTree({
        deviceId: DEVICE_ID,
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

      const nodes = buildDirectoryTree({ deviceId: DEVICE_ID, storageTypes: [StorageType.Sd], cache });
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

      const nodes = buildDirectoryTree({ deviceId: DEVICE_ID, storageTypes: [StorageType.Sd], cache });
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

      const nodes = buildDirectoryTree({ deviceId: DEVICE_ID, storageTypes: [StorageType.Sd], cache });
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

      const nodes = buildDirectoryTree({ deviceId: DEVICE_ID, storageTypes: [StorageType.Sd], cache });
      const storageNode = nodes[0].children?.[0];

      expect(storageNode?.children).toHaveLength(1);
      expect(storageNode?.children?.[0]).toMatchObject({
        name: 'Loading...',
        type: DirectoryTreeNodeType.Placeholder,
        icon: 'hourglass_empty',
      });
    });
  });

  describe('mergeDirectoryListings', () => {
    it('returns the identical cache reference when a listing adds nothing new', () => {
      const initial = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
      ]);

      const merged = mergeDirectoryListings(initial, [
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          // A fresh array instance with identical contents.
          directories: [{ name: 'games', path: '/games' }],
        },
      ]);

      expect(merged).toBe(initial);
    });

    it('returns a new cache reference when a listing adds or changes an entry', () => {
      const initial = cacheFrom([
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'games', path: '/games' }],
        },
      ]);

      const merged = mergeDirectoryListings(initial, [
        {
          deviceId: DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/',
          directories: [{ name: 'demos', path: '/demos' }],
        },
      ]);

      expect(merged).not.toBe(initial);
      expect(merged.get(`${DEVICE_ID}-${StorageType.Sd}-/`)).toEqual([{ name: 'demos', path: '/demos' }]);
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
