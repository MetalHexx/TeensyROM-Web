import { describe, it, expect } from 'vitest';
import { ResponseError } from '@teensyrom-nx/data-access/api-client';
import { extractErrorMessage } from './api-error.utils';

function responseErrorWithBody(body: unknown, contentType = 'application/json'): ResponseError {
  const response = new Response(JSON.stringify(body), {
    headers: { 'content-type': contentType },
  });
  return new ResponseError(response, 'Response returned an error code');
}

describe('extractErrorMessage', () => {
  it('resolves ProblemDetails.title when present', async () => {
    const error = responseErrorWithBody({ title: 'Invalid request', detail: 'Field X is required' });

    const message = await extractErrorMessage(error, 'fallback');

    expect(message).toBe('Invalid request');
  });

  it('falls back to ProblemDetails.detail when title is absent', async () => {
    const error = responseErrorWithBody({ detail: 'Field X is required' });

    const message = await extractErrorMessage(error, 'fallback');

    expect(message).toBe('Field X is required');
  });

  it('falls back to Error.message when the response cannot yield ProblemDetails', async () => {
    const response = new Response('not json', { headers: { 'content-type': 'text/plain' } });
    const error = new ResponseError(response, 'Boom');

    const message = await extractErrorMessage(error, 'fallback');

    expect(message).toBe('Boom');
  });

  it('returns the fallback message when nothing else resolves', async () => {
    const message = await extractErrorMessage('not an error object', 'fallback message');

    expect(message).toBe('fallback message');
  });

  it('falls back to the fallback message when JSON parsing throws', async () => {
    const response = new Response('{ not valid json', { headers: { 'content-type': 'application/json' } });
    const error = new ResponseError(response);

    const message = await extractErrorMessage(error, 'fallback message');

    expect(message).toBe('fallback message');
  });
});
