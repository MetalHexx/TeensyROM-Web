import { InjectionToken } from '@angular/core';

/**
 * Injection token for the player loading delay threshold in milliseconds.
 * 
 * This delay determines when the "slow loading" indicator should appear during file launches.
 * - Production default: 2000ms (2 seconds)
 * - Tests can override with 0ms for instant, deterministic behavior
 * 
 * @example
 * ```typescript
 * // In tests
 * TestBed.configureTestingModule({
 *   providers: [
 *     { provide: PLAYER_LAUNCH_DELAY_MS, useValue: 0 }
 *   ]
 * });
 * ```
 */
export const PLAYER_LAUNCH_DELAY_MS = new InjectionToken<number>('PLAYER_LAUNCH_DELAY_MS', {
  providedIn: 'root',
  factory: () => 2000, // Default: 2 seconds
});
