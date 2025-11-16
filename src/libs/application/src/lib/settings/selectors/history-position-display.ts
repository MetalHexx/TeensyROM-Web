import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector that returns a formatted string showing current position in history.
 * Format: "3/5" means position 2 (0-indexed) out of 5 total items.
 * Returns null when at current state (historyPosition === -1).
 */
export function historyPositionDisplay(store: WritableStore<SettingsState>) {
  return {
    historyPositionDisplay: () =>
      computed<string | null>(() => {
        const position = store.historyPosition();
        const history = store.history();

        if (position === -1 || !history || history.length === 0) {
          return null;
        }

        // Position is 0-indexed, display as 1-indexed
        const displayPosition = position + 1;
        const totalCount = history.length;

        return `${displayPosition}/${totalCount}`;
      }),
  };
}
