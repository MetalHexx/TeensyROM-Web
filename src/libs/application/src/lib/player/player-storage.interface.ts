import { InjectionToken } from '@angular/core';
import { DevicePlayerState } from './player-store';

/**
 * Contract for persisting and loading player state to/from browser storage.
 * Allows session restoration across page refreshes.
 */
export interface IPlayerStorage {
  /**
   * Save player state to persistent storage.
   * Filters out ephemeral state (loading, errors, timer state) before persistence.
   *
   * @param deviceId - Device identifier
   * @param state - Current player state to persist
   */
  save(deviceId: string, state: DevicePlayerState): void;

  /**
   * Load player state from persistent storage and merge with baseline state.
   * Returns a new state object with persisted values applied to the baseline.
   *
   * @param deviceId - Device identifier
   * @param baselineState - Fresh state from store to merge with
   * @returns Updated state with persisted values merged in
   */
  load(deviceId: string): DevicePlayerState | null;

  /**
   * Check if saved state exists for a device.
   *
   * @param deviceId - Device identifier
   * @returns True if saved state exists
   */
  hasSavedState(deviceId: string): boolean;

  /**
   * Clear saved state for a device.
   *
   * @param deviceId - Device identifier
   */
  clear(deviceId: string): void;
}

export const PLAYER_STORAGE = new InjectionToken<IPlayerStorage>('PLAYER_STORAGE');
