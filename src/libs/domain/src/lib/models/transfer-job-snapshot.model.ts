import { StorageType } from './storage-type.enum';

/**
 * Lifecycle states of a transfer job, mirroring the API's TransferJobState.
 */
export enum TransferJobState {
  Created = 'Created',
  Receiving = 'Receiving',
  Sealed = 'Sealed',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  Abandoned = 'Abandoned',
  Aborted = 'Aborted',
}

/** Where a transfer job came from: a browser upload or a watched folder. */
export enum TransferOriginKind {
  Upload = 'Upload',
  WatchFolder = 'WatchFolder',
}

export interface TransferOrigin {
  kind: TransferOriginKind;
  watchFolderId: string | null;
  watchFolderPath: string | null;
}

/** Progress of the post-transfer launch of the transferred file on the device. */
export enum TransferLaunchState {
  None = 'None',
  Pending = 'Pending',
  Launched = 'Launched',
  Incompatible = 'Incompatible',
  Failed = 'Failed',
}

/** Outcome of a single file's upload within a transfer job. */
export interface TransferFileCompletion {
  jobId: string;
  relativePath: string;
  targetPath: string;
  success: boolean;
  error: string | null;
  sizeBytes: number;
}

/**
 * Normalized snapshot of a transfer job, hydrated from either generated job DTO
 * (the HTTP response envelope or the bare SignalR hub push).
 */
export interface TransferJobSnapshot {
  jobId: string;
  deviceId: string;
  storageType: StorageType;
  /** Destination directory, trailing-slash normalized by the API - kept verbatim. */
  destinationDirectory: string;
  state: TransferJobState;
  filesReceived: number;
  filesSent: number;
  filesFailed: number;
  bytesSent: number;
  totalFiles: number | null;
  currentFile: string | null;
  origin: TransferOrigin;
  startedUtc: Date;
  lastActivityUtc: Date;
  error: string | null;
  failures: TransferFileCompletion[];
  recentCompletions: TransferFileCompletion[]; // newest-first, server-bounded
  bytesPerSecond: number; // rolling window; 0 when idle
  filesPerSecond: number; // rolling window; 0 when idle
  /** Relative path of the archive currently being expanded; null when none is. */
  expandingArchive: string | null;
  /** Uncompressed bytes written for that archive only — resets as the next one starts. */
  expansionBytesWritten: number;
  /** Uncompressed bytes that archive declares. The expansion bar's denominator. */
  expansionBytesDeclared: number;
  /** Files expansion has yielded — null until every archive in the job has finished expanding. */
  expandedFileCount: number | null;
  /** How the engine's launch of the transferred file went. */
  launchState: TransferLaunchState;
  /** Path of the file the engine launched (or tried to); null when no launch applies. */
  launchedPath: string | null;
  launchError: string | null;
}
