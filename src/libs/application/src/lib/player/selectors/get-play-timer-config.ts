import { computed } from '@angular/core';
import { PlayerState, PlayTimerConfig } from '../player-store';
import { WritableStore } from '../player-helpers';

/**
 * Get custom play timer configuration for a device.
 *
 * Returns the current custom timer configuration from the PlayerStore for a specific device.
 * Used by components to display timer toggle state and duration dropdown.
 *
 * Custom Timer Configuration:
 * - enabled: Whether custom timer is active (overrides file metadata)
 * - durationMs: Custom duration in milliseconds (e.g., 180000 = 3 minutes)
 *
 * @param store - Player store instance
 * @returns Selector method object with computed signal
 */
export function getPlayTimerConfig(store: WritableStore<PlayerState>) {
  return {
    getPlayTimerConfig: (deviceId: string) =>
      computed<PlayTimerConfig | null>(() => {
        return store.players()[deviceId]?.playTimerConfig ?? null;
      }),
  };
}
