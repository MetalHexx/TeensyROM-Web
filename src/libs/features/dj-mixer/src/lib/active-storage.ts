import { StorageKeyUtil, type StorageKey } from '@teensyrom-nx/application';
import type { StorageType } from '@teensyrom-nx/domain';

/** The storage the DJ view's browse trees and directory listing are currently showing. */
export interface ActiveStorage {
  readonly deviceId: string;
  readonly storageType: StorageType;
}

/** The `StorageStore` entry key for an active storage. */
export function activeStorageKey(active: ActiveStorage): StorageKey;
/** `null` when nothing is active. */
export function activeStorageKey(active: ActiveStorage | null): StorageKey | null;
export function activeStorageKey(active: ActiveStorage | null): StorageKey | null {
  return active ? StorageKeyUtil.create(active.deviceId, active.storageType) : null;
}
