/**
 * Transfer Store Constants
 *
 * Shared caps and defaults for transfer state management.
 */

/** Maximum number of entries retained in a device's activity feed, newest first. */
export const TRANSFER_FEED_CAP = 5;

/** Maximum number of entries retained in a device's end-of-job failure summary. */
export const TRANSFER_FAILURE_CAP = 50;

/** Default number of concurrent upload workers in the local upload pool. */
export const UPLOAD_POOL_CONCURRENCY = 6;

/** Default number of attempts (including the first) before an upload is recorded as failed. */
export const UPLOAD_POOL_MAX_ATTEMPTS = 3;

/** Default base delay for exponential backoff between retried uploads, in milliseconds. */
export const UPLOAD_POOL_BASE_BACKOFF_MS = 300;

/** Cadence at which the upload pool reports aggregated byte progress — the server's own snapshot notifier cadence. */
export const UPLOAD_PROGRESS_THROTTLE_MS = 250;

/** Rolling window, in milliseconds, over which the upload pool's bytes-per-second figure is averaged. */
export const UPLOAD_RATE_WINDOW_MS = 10_000;

/** Minimum elapsed-time divisor, in milliseconds, for a rate calculation — stops an early burst from reading as an absurd figure. */
export const UPLOAD_RATE_MIN_DIVISOR_MS = 100;

/**
 * File extensions the scanner admits into a transfer manifest, matched case-insensitively.
 * Verbatim from the API's own file-type mapping.
 */
export const TRANSFER_SUPPORTED_EXTENSIONS = new Set<string>([
  '.sid',
  '.crt',
  '.prg',
  '.p00',
  '.hex',
  '.kla',
  '.koa',
  '.art',
  '.aas',
  '.hpi',
  '.seq',
  '.txt',
  '.d64',
  '.zip',
  '.7z',
  '.rar',
]);

/** Extensions the server expands into their contents rather than transferring. Subset of the above. */
export const TRANSFER_ARCHIVE_EXTENSIONS = new Set<string>(['.zip', '.7z', '.rar']);
