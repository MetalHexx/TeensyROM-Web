/**
 * Transfer Store Constants
 *
 * Shared caps and defaults for transfer state management.
 */

/** Maximum number of entries retained in a device's activity feed, newest first. */
export const TRANSFER_FEED_CAP = 20;

/** Maximum number of entries retained in a device's end-of-job failure summary. */
export const TRANSFER_FAILURE_CAP = 50;

/** Default number of concurrent upload workers in the local upload pool. */
export const UPLOAD_POOL_CONCURRENCY = 6;

/** Default number of attempts (including the first) before an upload is recorded as failed. */
export const UPLOAD_POOL_MAX_ATTEMPTS = 3;

/** Default base delay for exponential backoff between retried uploads, in milliseconds. */
export const UPLOAD_POOL_BASE_BACKOFF_MS = 300;

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
]);
