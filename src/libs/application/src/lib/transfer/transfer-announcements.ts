import {
  TransferJobSnapshot,
  TransferJobState,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/domain';

export interface TransferAnnouncement {
  severity: 'info' | 'success' | 'error';
  message: string;
}

function filesLabel(count: number): string {
  return count === 1 ? '1 file' : `${count} files`;
}

/** The last segment of a Windows or POSIX path, ignoring trailing separators. */
function lastSegment(path: string | null): string {
  if (!path) {
    return '';
  }
  const segments = path.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? path;
}

/**
 * The start alert. The count is `totalFiles` when the engine knows it, else this tab's own scan
 * total; the engine publishes a job before it counts its files, so a watched transfer's start is
 * usually countless — the alert is not held back for it.
 */
export function buildStartAnnouncement(
  snapshot: TransferJobSnapshot,
  deviceName: string,
  ownScanTotal?: number
): TransferAnnouncement {
  const count = snapshot.totalFiles ?? (ownScanTotal && ownScanTotal > 0 ? ownScanTotal : null);
  const amount = count === null ? 'files' : filesLabel(count);
  const folder =
    snapshot.origin.kind === TransferOriginKind.WatchFolder
      ? lastSegment(snapshot.origin.watchFolderPath)
      : '';
  const source = folder ? ` from ${folder}` : '';

  return { severity: 'info', message: `Sending ${amount}${source} to ${deviceName}` };
}

function completedMessage(snapshot: TransferJobSnapshot, deviceName: string): string {
  const { filesSent, filesFailed } = snapshot;
  const base =
    filesFailed === 0
      ? `Sent ${filesLabel(filesSent)} to ${deviceName}`
      : `Sent ${filesSent} of ${filesLabel(filesSent + filesFailed)} to ${deviceName} · ${filesFailed} didn't arrive`;

  const file = lastSegment(snapshot.launchedPath);
  switch (snapshot.launchState) {
    case TransferLaunchState.Launched:
      return `${base} · launched ${file}`;
    case TransferLaunchState.Failed:
      return `${base} · couldn't launch ${file}${snapshot.launchError ? `: ${snapshot.launchError}` : ''}`;
    case TransferLaunchState.Incompatible:
      return `${base} · ${file} can't run on the TeensyROM`;
    default:
      return base;
  }
}

/**
 * The end alert. Only a clean `Completed` — nothing failed to arrive, and any launch worked or
 * was not attempted — is a success; every other ending is an error.
 */
export function buildEndAnnouncement(
  snapshot: TransferJobSnapshot,
  deviceName: string
): TransferAnnouncement {
  const sent = filesLabel(snapshot.filesSent);

  switch (snapshot.state) {
    case TransferJobState.Completed: {
      const launchedCleanly =
        snapshot.launchState === TransferLaunchState.None ||
        snapshot.launchState === TransferLaunchState.Launched;
      return {
        severity: snapshot.filesFailed === 0 && launchedCleanly ? 'success' : 'error',
        message: completedMessage(snapshot, deviceName),
      };
    }
    case TransferJobState.Cancelled:
      return {
        severity: 'error',
        message: `Transfer to ${deviceName} cancelled · ${sent} sent`,
      };
    case TransferJobState.Aborted:
      return {
        severity: 'error',
        message: `Transfer to ${deviceName} stopped${snapshot.error ? `: ${snapshot.error}` : ''} · ${sent} sent`,
      };
    case TransferJobState.Abandoned:
      return {
        severity: 'error',
        message: `Transfer to ${deviceName} stopped: the sender went away · ${sent} sent`,
      };
    default:
      throw new Error(`Cannot announce the end of a job in state ${snapshot.state}`);
  }
}
