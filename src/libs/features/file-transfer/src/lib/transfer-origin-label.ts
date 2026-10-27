import { TransferOrigin, TransferOriginKind } from '@teensyrom-nx/domain';

/** The watch folder's last path segment for a watched transfer; null for every other origin. */
export function watchFolderLabel(origin: TransferOrigin): string | null {
  if (origin.kind !== TransferOriginKind.WatchFolder) {
    return null;
  }
  const segments = (origin.watchFolderPath ?? '').split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? null;
}
