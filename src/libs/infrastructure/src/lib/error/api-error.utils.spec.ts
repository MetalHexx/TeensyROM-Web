import { describe, it, expect } from 'vitest';
import { ResponseError } from '@teensyrom-nx/data-access/api-client';
import {
  extractErrorMessage,
  extractProblemMessage,
  readDeviceBusyProblem,
  readProblemCode,
} from './api-error.utils';

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

  it('resolves the message of a bare JSON string body, as the API sends for a 404', async () => {
    const response = new Response('"The directory /games was not found."', {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    const error = new ResponseError(response, 'Response returned an error code');

    await expect(extractProblemMessage(error)).resolves.toBe('The directory /games was not found.');
  });

  it('resolves undefined for a blank bare JSON string body', async () => {
    const error = responseErrorWithBody('  \u0000 ');

    await expect(extractProblemMessage(error)).resolves.toBeUndefined();
  });

  it('resolves undefined for a null JSON body', async () => {
    const error = responseErrorWithBody(null);

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
    const error = responseErrorWithBody({
      title: 'Invalid request',
      detail: 'Field X is required',
    });

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
    const response = new Response('{ not valid json', {
      headers: { 'content-type': 'application/json' },
    });
    const error = new ResponseError(response);

    const message = await extractErrorMessage(error, 'fallback message');

    expect(message).toBe('fallback message');
  });
});

describe('readDeviceBusyProblem', () => {
  const conflict = (body: unknown, status = 409) =>
    new ResponseError(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/problem+json' },
      })
    );

  it('returns the problem for a busy 409', async () => {
    const error = conflict({
      title: 'Alpha is busy with a transfer.',
      status: 409,
      code: 'deviceBusyWithTransfer',
      deviceId: 'device-1',
      activeJobId: 'job-7',
    });

    await expect(readDeviceBusyProblem(error)).resolves.toEqual({
      deviceId: 'device-1',
      activeJobId: 'job-7',
      title: 'Alpha is busy with a transfer.',
    });
  });

  it('returns a null activeJobId when the body carries none', async () => {
    const error = conflict({ title: 'Busy', code: 'deviceBusyWithTransfer', deviceId: 'device-1' });

    await expect(readDeviceBusyProblem(error)).resolves.toMatchObject({ activeJobId: null });
  });

  it('is null for a 409 without the busy code', async () => {
    await expect(readDeviceBusyProblem(conflict({ title: 'Busy' }))).resolves.toBeNull();
  });

  it('is null for a 502, even with the busy code', async () => {
    const error = conflict({ code: 'deviceBusyWithTransfer', deviceId: 'device-1' }, 502);

    await expect(readDeviceBusyProblem(error)).resolves.toBeNull();
  });

  it('is null for a 409 whose body is not JSON', async () => {
    const error = new ResponseError(new Response('not json', { status: 409 }));

    await expect(readDeviceBusyProblem(error)).resolves.toBeNull();
  });

  it('is null for a non-ResponseError', async () => {
    await expect(readDeviceBusyProblem(new Error('boom'))).resolves.toBeNull();
  });
});

describe('readProblemCode', () => {
  it('returns the code from a problem+json body and leaves the body readable', async () => {
    const error = responseErrorWithBody(
      { title: 'USB unreachable', code: 'usbUnreachable' },
      'application/problem+json'
    );

    await expect(readProblemCode(error)).resolves.toBe('usbUnreachable');
    await expect(error.response.json()).resolves.toMatchObject({ code: 'usbUnreachable' });
  });

  it('is undefined for a body without a string code', async () => {
    await expect(readProblemCode(responseErrorWithBody({ code: 7 }))).resolves.toBeUndefined();
    await expect(readProblemCode(responseErrorWithBody('bare string'))).resolves.toBeUndefined();
  });

  it('is undefined for a body that is not JSON', async () => {
    const error = new ResponseError(new Response('not json', { status: 502 }));

    await expect(readProblemCode(error)).resolves.toBeUndefined();
  });

  it('is undefined for an error that is not a ResponseError', async () => {
    await expect(readProblemCode(new Error('boom'))).resolves.toBeUndefined();
  });
});
