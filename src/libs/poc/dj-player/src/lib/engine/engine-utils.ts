/** Shared by every engine collaborator that turns a µs interval into a millisecond one. */
export const MICROSECONDS_PER_SECOND = 1_000_000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
