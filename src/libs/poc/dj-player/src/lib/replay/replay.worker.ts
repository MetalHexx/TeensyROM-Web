import { replayToFrame } from './replay-to-frame';
import type { ReplayRequest, ReplayResponse } from './replay-runner';

// A shim and nothing else: one request in, one response out, with the failure turned into a message
// because a throw here would surface on the main thread as an unlabelled worker error. Imports are
// kept relative so the worker's module graph never needs a workspace path alias resolved.
self.onmessage = (event: MessageEvent<ReplayRequest>): void => {
  const request = event.data;
  let response: ReplayResponse;
  try {
    response = {
      id: request.id,
      ok: true,
      result: replayToFrame(request.file, request.subtune, request.targetFrame, request.mutes),
    };
  } catch (error) {
    response = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(response);
};
