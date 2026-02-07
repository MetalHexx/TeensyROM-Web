import { StorageType } from './storage-type.enum';

/**
 * Represents a storage device (SD/USB) as a navigable item in the directory listing.
 * Used when viewing the device-level to display available storage options.
 */
export interface StorageDeviceItem {
  /** Display name (e.g., "SD Storage", "USB Storage") */
  name: string;

  /** The type of storage this item represents */
  storageType: StorageType;

  /** Material icon name for display (e.g., "sd_storage", "usb") */
  icon: string;

  /** The device ID this storage belongs to */
  deviceId: string;

  /** Discriminator for type guards to distinguish from DirectoryItem/FileItem */
  itemType: 'storage-device';
}
