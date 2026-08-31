import { TuneScan } from './scan-tune';
import type { ScanMessage, ScanRequest } from './scan-runner';

/** The one ladder this worker is part-way through, if any. */
interface HeldScan {
  readonly session: number;
  readonly subtune: number;
  readonly scan: TuneScan;
}

let held: HeldScan | null = null;

/**
 * Handles one request: deepens the held scan when the request belongs to the same ladder, otherwise
 * starts a clean one, then posts progress and a terminal message.
 *
 * The match is on `session` and `subtune` and deliberately never on `file`. A `SidFile` is plain
 * structured-cloneable data, so every `postMessage` hands this worker a fresh copy: an identity test
 * on it could never be equal, and a deep comparison of a multi-kilobyte `Uint8Array` would cost more
 * than the emulation it saves. Either way every rung would re-init — invisibly, since a clean re-init
 * produces byte-identical output.
 *
 * A failure comes back as a `failed` message rather than a throw, which on the main thread would
 * surface as an unlabelled worker error, and discards the held scan: a machine that ran out of cycles
 * must never be deepened.
 *
 * Exported, and taking `post` rather than reaching for `self`, so the matching above is reachable
 * from a test — jsdom has no `Worker`.
 */
export function handleScanRequest(
  request: ScanRequest,
  post: (message: ScanMessage) => void
): void {
  let message: ScanMessage;
  try {
    const scan = scanFor(request);
    scan.advanceTo(request.maxFrames, (frame) => {
      post({ id: request.id, kind: 'progress', frame });
    });
    held = { session: request.session, subtune: request.subtune, scan };
    message = { id: request.id, kind: 'done', output: scan.output() };
  } catch (error) {
    held = null;
    message = {
      id: request.id,
      kind: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
  post(message);
}

function scanFor(request: ScanRequest): TuneScan {
  const current = held;
  if (
    current !== null &&
    current.session === request.session &&
    current.subtune === request.subtune
  ) {
    return current.scan;
  }
  return new TuneScan(request.file, request.subtune);
}

// A shim and nothing else. Imports are kept relative so the worker's module graph never needs a
// workspace path alias resolved.
self.onmessage = (event: MessageEvent<ScanRequest>): void => {
  handleScanRequest(event.data, (message) => self.postMessage(message));
};
