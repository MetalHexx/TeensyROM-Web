import { scanTune } from './scan-tune';
import type { ScanMessage, ScanRequest } from './scan-runner';

// A shim and nothing else: one request in, progress and a terminal message out, with the failure
// turned into a message because a throw here would surface on the main thread as an unlabelled
// worker error. Imports are kept relative so the worker's module graph never needs a workspace path
// alias resolved.
self.onmessage = (event: MessageEvent<ScanRequest>): void => {
  const request = event.data;
  let message: ScanMessage;
  try {
    const output = scanTune(request.file, request.subtune, request.maxFrames, (frame) => {
      self.postMessage({ id: request.id, kind: 'progress', frame });
    });
    message = { id: request.id, kind: 'done', output };
  } catch (error) {
    message = {
      id: request.id,
      kind: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(message);
};
