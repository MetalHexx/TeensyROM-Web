import { describe, it, expect } from 'vitest';
import { ResponseError } from '@teensyrom-nx/data-access/api-client';
import { extractErrorMessage, extractProblemMessage } from './api-error.utils';

function responseErrorWithBody(body: unknown, contentType = 'application/json'): ResponseError {
  const response = new Response(JSON.stringify(body), {
    headers: { 'content-type': contentType },
  });
  return new ResponseError(response, 'Response returned an error code');
}

describe('extractProblemMessage', () => {
  it('resolves ProblemDetails.title when present', async () => {
    const error = responseErrorWithBody({
      title: 'Invalid request',
      detail: 'Field X is required',
    });

    await expect(extractProblemMessage(error)).resolves.toBe('Invalid request');
  });

  it('falls back to ProblemDetails.detail when title is absent', async () => {
    const error = responseErrorWithBody({ detail: 'Field X is required' });

    await expect(extractProblemMessage(error)).resolves.toBe('Field X is required');
  });

  it('treats a blank title as absent and uses detail', async () => {
    const error = responseErrorWithBody({ title: '   ', detail: 'Field X is required' });

    await expect(extractProblemMessage(error)).resolves.toBe('Field X is required');
  });

  it('resolves undefined when the title is blank and there is no detail', async () => {
    const error = responseErrorWithBody({ title: '   ' });

    await expect(extractProblemMessage(error)).resolves.toBeUndefined();
  });

  it('resolves undefined when the title is NUL-only', async () => {
    const error = responseErrorWithBody({ title: '\u0000\u0000' });

    await expect(extractProblemMessage(error)).resolves.toBeUndefined();
  });

  it('resolves undefined for a non-JSON response body', async () => {
    const response = new Response('not json', { headers: { 'content-type': 'text/plain' } });
    const error = new ResponseError(response, 'Boom');

    await expect(extractProblemMessage(error)).resolves.toBeUndefined();
  });

  it('resolves undefined for an error that is not a ResponseError', async () => {
    await expect(extractProblemMessage(new Error('Boom'))).resolves.toBeUndefined();
  });
});

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
