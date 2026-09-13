import { StorageType } from '@teensyrom-nx/domain';

// DJ file key type for flat state structure
export type DjFileKey = `${string}-${StorageType}-${string}`;

// DJ file key utility functions
export const DjFileKeyUtil = {
  create(deviceId: string, storageType: StorageType, path: string): DjFileKey {
    return `${deviceId}-${storageType}-${path}` as DjFileKey;
  },
} as const;
