import { InjectionToken } from '@angular/core';

/**
 * Injection token for the delay before auto-advancing away from an incompatible file, in ms.
 *
 * This delay gives the user time to see the "incompatible file" feedback before the player
 * automatically retries with the next file.
 * - Production default: 1000ms (1 second)
 * - Tests can override with 0ms for instant, deterministic behavior
 *
 * @example
 * ```typescript
 * // In tests
 * TestBed.configureTestingModule({
 *   providers: [
 *     { provide: PLAYER_INCOMPATIBLE_RETRY_DELAY_MS, useValue: 0 }
 *   ]
 * });
 * ```
 */
export const PLAYER_INCOMPATIBLE_RETRY_DELAY_MS = new InjectionToken<number>(
  'PLAYER_INCOMPATIBLE_RETRY_DELAY_MS',
  {
    providedIn: 'root',
    factory: () => 1000, // Default: 1 second
  }
);

/**
 * Injection token for the TimerService tick resolution, in ms.
 *
 * Controls how often the timer's RxJS interval fires and how much `currentTime` advances
 * per tick.
 * - Production default: 100ms
 * - Tests can override with 0ms for instant, deterministic behavior
 *
 * @example
 * ```typescript
 * // In tests
 * TestBed.configureTestingModule({
 *   providers: [
 *     { provide: PLAYER_TIMER_TICK_MS, useValue: 0 }
 *   ]
 * });
 * ```
 */
export const PLAYER_TIMER_TICK_MS = new InjectionToken<number>('PLAYER_TIMER_TICK_MS', {
  providedIn: 'root',
  factory: () => 100, // Default: 100ms
});
