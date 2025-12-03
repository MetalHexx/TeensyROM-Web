import { Injectable } from '@angular/core';
import { IPlayerStorage, DevicePlayerState } from '@teensyrom-nx/application';
import { SavedPlayerState } from './saved-player-state.model';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { PlayerStatus } from '@teensyrom-nx/domain';

/**
 * Service for persisting player state to browser localStorage.
 * Persistence is triggered by explicit save() calls from store actions.
 *
 * Architecture:
 * - Maps DevicePlayerState ↔ SavedPlayerState (filters ephemeral state)
 * - Merges loaded state with baseline to preserve non-persisted fields
 * - Simple CRUD operations - no reactive observation to avoid loops
 */
@Injectable()
export class PlayerStorageService implements IPlayerStorage {
  private readonly STORAGE_KEY_PREFIX = 'teensyrom_player_';

  save(deviceId: string, state: DevicePlayerState): void {
    try {
      const savedState = this.mapToSavedState(state);
      const key = this.getStorageKey(deviceId);
      localStorage.setItem(key, JSON.stringify(savedState));

      logInfo(LogType.Success, `PlayerStorage: Persisted state for device ${deviceId}`);
    } catch (error) {
      logWarn(`PlayerStorage: Failed to save state for device ${deviceId}: ${error}`);
    }
  }

  load(deviceId: string): DevicePlayerState | null {
    try {
      const key = this.getStorageKey(deviceId);
      const json = localStorage.getItem(key);

      if (!json) {
        logInfo(LogType.Info, `PlayerStorage: No saved state found for device ${deviceId}`);
        return null;
      }

      const savedState = JSON.parse(json) as SavedPlayerState;
      return this.mapToDevicePlayerState(savedState);
      
    } catch (error) {
      logWarn(`PlayerStorage: Failed to load state for device ${deviceId}: ${error}`);
      return null;
    }
  }

  hasSavedState(deviceId: string): boolean {
    const key = this.getStorageKey(deviceId);
    return localStorage.getItem(key) !== null;
  }

  clear(deviceId: string): void {
    try {
      const key = this.getStorageKey(deviceId);
      localStorage.removeItem(key);
      logInfo(LogType.Info, `PlayerStorage: Cleared state for device ${deviceId}`);
    } catch (error) {
      logWarn(`PlayerStorage: Failed to clear state for device ${deviceId}: ${error}`);
    }
  }

  /**
   * Map DevicePlayerState to SavedPlayerState (exclude ephemeral fields).
   */
  private mapToSavedState(state: DevicePlayerState): SavedPlayerState {
    return {
      deviceId: state.deviceId,
      currentFile: state.currentFile,
      fileContext: state.fileContext,
      launchMode: state.launchMode,
      shuffleSettings: state.shuffleSettings,
      playHistory: state.playHistory,
      historyViewVisible: state.historyViewVisible,
      playTimerConfig: state.playTimerConfig,
      lastUpdated: state.lastUpdated,
    };
  }

  private mapToDevicePlayerState(savedState: SavedPlayerState): DevicePlayerState {
    return {
      deviceId: savedState.deviceId,
      currentFile: savedState.currentFile,
      fileContext: savedState.fileContext,
      launchMode: savedState.launchMode,
      shuffleSettings: savedState.shuffleSettings,
      playHistory: savedState.playHistory,
      historyViewVisible: savedState.historyViewVisible,
      playTimerConfig: savedState.playTimerConfig,
      lastUpdated: savedState.lastUpdated,
      status: PlayerStatus.Stopped,
      isLoading: false,
      error: null
    };
  }

  private getStorageKey(deviceId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${deviceId}`;
  }
}
