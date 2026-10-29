import { ResponseError, ProblemDetails } from '@teensyrom-nx/data-access/api-client';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { DEVICE_BUSY_PROBLEM_CODE, DeviceBusyError, IAlertService } from '@teensyrom-nx/domain';

/** The engine's busy-with-a-transfer refusal, read from its 409 body. */
export interface DeviceBusyProblem {
  deviceId: string;
  activeJobId: string | null;
  title: string;
}

/**
 * Recognizes the engine's busy-with-a-transfer refusal by its problem code, never by text.
 *
 * @param error - The error thrown by the API client
 * @returns The busy problem, or null for any other error
 */
export async function readDeviceBusyProblem(error: unknown): Promise<DeviceBusyProblem | null> {
  if (!(error instanceof ResponseError) || error.response?.status !== 409) {
    return null;
  }

  try {
    const body = (await error.response.clone().json()) as {
      code?: unknown;
      deviceId?: unknown;
      activeJobId?: unknown;
      title?: unknown;
    } | null;
    if (body?.code !== DEVICE_BUSY_PROBLEM_CODE) {
      return null;
    }
    return {
      deviceId: typeof body.deviceId === 'string' ? body.deviceId : '',
      activeJobId: typeof body.activeJobId === 'string' ? body.activeJobId : null,
      title:
        typeof body.title === 'string' && body.title.trim()
          ? body.title
          : 'Device is busy with a transfer.',
    };
  } catch {
    return null;
  }
}

/**
 * Answers the engine's busy refusal: warns the user and fails with a {@link DeviceBusyError}. Any other
 * error is handed to `otherwise`, which supplies the failure the caller wants.
 *
 * @param error - The error thrown by the API client
 * @param alertService - Where the busy warning is shown
 * @param otherwise - Builds the failure for an error that is not the busy refusal
 */
export function failOnDeviceBusy(
  error: unknown,
  alertService: IAlertService,
  otherwise: () => Observable<never>
): Observable<never> {
  return from(readDeviceBusyProblem(error)).pipe(
    switchMap((busy) => {
      if (!busy) {
        return otherwise();
      }
      alertService.warning(busy.title);
      return throwError(() => new DeviceBusyError(busy.deviceId, busy.activeJobId, busy.title));
    })
  );
}

/**
 * The API's own message from a JSON response body. The API answers 502 with a ProblemDetails object (its
 * title, else its detail is used) and 404 with a bare JSON string (used as is). Undefined when the error is
 * not a ResponseError with a JSON / problem+json body, or the message is blank once NUL characters and
 * whitespace are trimmed.
 *
 * @param error - The error thrown by the API client
 * @returns The API's message, or undefined when it has none
 */
export async function extractProblemMessage(error: unknown): Promise<string | undefined> {
  if (!(error instanceof ResponseError) || !error.response) {
    return undefined;
  }

  try {
    const contentType = error.response.headers.get('content-type') || '';
    if (
      !contentType.includes('application/json') &&
      !contentType.includes('application/problem+json')
    ) {
      return undefined;
    }

    const bodyText = await error.response.clone().text();
    if (!bodyText) {
      return undefined;
    }

    const body = JSON.parse(bodyText) as ProblemDetails | string | null;
    if (typeof body === 'string') {
      return isNonBlank(body) ? body : undefined;
    }
    return body ? firstNonBlank(body.title, body.detail) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The problem `code` from a ResponseError's JSON / problem+json body, read from a clone so the body stays
 * readable. Undefined when the error is not a ResponseError, the body is not JSON, or it has no string code.
 *
 * @param error - The error thrown by the API client
 * @returns The problem code, or undefined when there is none
 */
export async function readProblemCode(error: unknown): Promise<string | undefined> {
  if (!(error instanceof ResponseError) || !error.response) {
    return undefined;
  }

  try {
    const body = (await error.response.clone().json()) as { code?: unknown } | null;
    return typeof body?.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts a user-friendly error message from an API response.
 *
 * Uses the API's ProblemDetails message when present, then the error's own message for a standard Error,
 * and finally the fallback message.
 *
 * @param error - The error thrown by the API client
 * @param fallbackMessage - The fallback message to use if extraction fails
 * @returns A user-friendly error message
 */
export async function extractErrorMessage(
  error: unknown,
  fallbackMessage: string
): Promise<string> {
  return (
    (await extractProblemMessage(error)) ??
    (error instanceof Error && error.message ? error.message : fallbackMessage)
  );
}

function firstNonBlank(...values: (string | null | undefined)[]): string | undefined {
  return values.find((value): value is string => isNonBlank(value));
}

function isNonBlank(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.split('\0').join('').trim() !== '';
}
