import type { StorageType } from '@teensyrom-nx/domain';

/**
 * What a drop hands the loader: which device and storage backs the file, its path, and its
 * name, plus the listing's facts about it when it has them. Structurally compatible with the feature
 * layer's `DjFileDragPayload` — defined here, in the application, so the feature depends on the
 * application rather than the other way around.
 */
export interface LoadSource {
  readonly deviceId: string;
  readonly storageType: StorageType;
  readonly path: string;
  readonly fileName: string;
  /** The listing's title and author for the file, shown while it fetches. */
  readonly title?: string;
  readonly author?: string;
  /** HVSC lengths from the listing: the tune's, and each subtune's in order ('' unknown). */
  readonly playLength?: string;
  readonly subtuneLengths?: readonly string[];
}
