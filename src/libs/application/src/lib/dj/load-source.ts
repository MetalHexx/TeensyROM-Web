import type { StorageType } from '@teensyrom-nx/domain';

/**
 * What a drop hands the loader: which device and storage backs the file, its path, and its
 * name. Structurally the feature layer's `DjFileDragPayload` — defined here, in the application,
 * so the feature depends on the application rather than the other way around.
 */
export interface LoadSource {
  readonly deviceId: string;
  readonly storageType: StorageType;
  readonly path: string;
  readonly fileName: string;
}
