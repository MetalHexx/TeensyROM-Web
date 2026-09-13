import { StorageType } from '@teensyrom-nx/domain';

/**
 * MIME type constant for DJ file drag and drop operations.
 */
export const DJ_FILE_DRAG_TYPE = 'application/x-teensyrom-dj-file';

/**
 * Payload shape for a DJ file drag and drop operation. Carries the device, storage type,
 * file path, and file name across the drag boundary.
 */
export interface DjFileDragPayload {
  readonly deviceId: string;
  readonly storageType: StorageType;
  readonly path: string;
  readonly fileName: string;
}

/**
 * Encodes a DJ file drag payload into a DataTransfer object.
 *
 * Sets the payload as JSON-stringified data under the `DJ_FILE_DRAG_TYPE` MIME type,
 * and marks the drag's effect as `'copy'`.
 *
 * @param dt The DataTransfer object to write to.
 * @param payload The DJ file drag payload to encode.
 *
 * @example
 * ```ts
 * const payload: DjFileDragPayload = { deviceId: 'dev1', storageType: StorageType.Sd, path: '/music', fileName: 'song.sid' };
 * setDjFileDragData(event.dataTransfer, payload);
 * ```
 */
export function setDjFileDragData(dt: DataTransfer, payload: DjFileDragPayload): void {
  dt.setData(DJ_FILE_DRAG_TYPE, JSON.stringify(payload));
  dt.effectAllowed = 'copy';
}

/**
 * Decodes a DJ file drag payload from a DataTransfer object.
 *
 * Parses the JSON-stringified payload from the `DJ_FILE_DRAG_TYPE` MIME type. Returns `null`
 * if the data is missing, malformed, or not valid JSON.
 *
 * @param dt The DataTransfer object to read from. May be `null`.
 * @returns The decoded DJ file drag payload, or `null` if absent or invalid.
 *
 * @example
 * ```ts
 * const payload = readDjFileDragData(event.dataTransfer);
 * if (payload) {
 *   console.log(`Dropped ${payload.fileName}`);
 * }
 * ```
 */
export function readDjFileDragData(dt: DataTransfer | null): DjFileDragPayload | null {
  if (!dt) {
    return null;
  }

  try {
    const data = dt.getData(DJ_FILE_DRAG_TYPE);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as DjFileDragPayload;
  } catch {
    return null;
  }
}

/**
 * Detects whether a DataTransfer object contains a DJ file drag.
 *
 * Checks for the presence of the `DJ_FILE_DRAG_TYPE` MIME type in the types list.
 * This is the only reliable check during a `dragover` event, before a drop occurs.
 *
 * @param dt The DataTransfer object to check. May be `null`.
 * @returns `true` if the DJ file MIME type is present, `false` otherwise.
 *
 * @example
 * ```ts
 * if (isDjFileDrag(event.dataTransfer)) {
 *   event.dataTransfer.dropEffect = 'copy';
 * }
 * ```
 */
export function isDjFileDrag(dt: DataTransfer | null): boolean {
  return dt?.types.includes(DJ_FILE_DRAG_TYPE) ?? false;
}
