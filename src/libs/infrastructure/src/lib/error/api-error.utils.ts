import { ResponseError, ProblemDetails } from '@teensyrom-nx/data-access/api-client';

/**
 * The API's own message from a ProblemDetails response body: its title, else its detail. Undefined when the
 * error is not a ResponseError with a JSON / problem+json body, or the message is blank once NUL characters
 * and whitespace are trimmed.
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

    const problemDetails = JSON.parse(bodyText) as ProblemDetails;
    return firstNonBlank(problemDetails.title, problemDetails.detail);
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
