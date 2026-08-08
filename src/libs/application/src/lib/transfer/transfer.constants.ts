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
export const TRANSFER_UPLOAD_POOL_SIZE = 4;
