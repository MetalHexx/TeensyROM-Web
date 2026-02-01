import { InjectionToken, Signal } from '@angular/core';
import {
  FileItem,
  LaunchMode,
  PlayerStatus,
  PlayerFilterType,
  PlayerScope,
  StorageType,
} from '@teensyrom-nx/domain';
import { LaunchedFile, PlayerFileContext, ShuffleSettings, PlayHistory, PlayTimerConfig } from './player-store';
import { TimerState } from './timer-state.interface';

export interface LaunchFileContextRequest {
  deviceId: string;
  file: FileItem;
  storageType?: StorageType;
  directoryPath: string;
  files: FileItem[];
  launchMode?: LaunchMode;
}

export interface IPlayerContext {
  initializePlayer(deviceId: string): void;
  removePlayer(deviceId: string): void;
  startListeningToPopState(): void;
  stopListeningToPopState(): void;
  launchFileWithContext(request: LaunchFileContextRequest): Promise<void>;
  updateCurrentFileFavoriteStatus(deviceId: string, filePath: string, isFavorite: boolean): void;
  getCurrentFile(deviceId: string): Signal<LaunchedFile | null>;
  getFileContext(deviceId: string): Signal<PlayerFileContext | null>;
  isLoading(deviceId: string): Signal<boolean>;
  
  /**
   * Returns a global signal indicating if ANY device is slow loading (loading for more than 2 seconds).
   * This is used to show a busy dialog for slow file launches while avoiding flashing for quick operations.
   * @returns Signal<boolean> - true if any device has been loading for more than 2 seconds
   */
  isSlowLoading(): Signal<boolean>;
  
  getError(deviceId: string): Signal<string | null>;
  getStatus(deviceId: string): Signal<PlayerStatus>;

  // Shuffle functionality
  launchRandomFile(deviceId: string): Promise<void>;
  toggleShuffleMode(deviceId: string): void;
  setShuffleScope(deviceId: string, scope: PlayerScope): void;
  setFilterMode(deviceId: string, filter: PlayerFilterType): void;
  getShuffleSettings(deviceId: string): Signal<ShuffleSettings | null>;
  getLaunchMode(deviceId: string): Signal<LaunchMode>;

  // Phase 3: Playback controls
  play(deviceId: string): Promise<void>;
  pause(deviceId: string): Promise<void>;
  stop(deviceId: string): Promise<void>;
  next(deviceId: string): Promise<void>;
  previous(deviceId: string): Promise<void>;
  getPlayerStatus(deviceId: string): Signal<PlayerStatus>;

  // Phase 5: Timer system
  getTimerState(deviceId: string): Signal<TimerState | null>;

  // Custom Play Timer
  /**
   * Get custom play timer configuration for a device.
   * Returns a signal that emits the current timer config (enabled state and duration).
   * @param deviceId - The device identifier
   * @returns Signal emitting PlayTimerConfig or null if device doesn't exist
   */
  getPlayTimerConfig(deviceId: string): Signal<PlayTimerConfig | null>;

  /**
   * Update custom play timer configuration for a device.
   * Sets the enabled state and duration. When enabled, custom timer overrides
   * music metadata for non-song files only. Changes take effect on next file launch,
   * or immediately for currently playing files if mid-playback updates are enabled.
   * @param deviceId - The device identifier
   * @param enabled - Whether custom timer is active
   * @param durationMs - Custom duration in milliseconds
   */
  setCustomTimer(deviceId: string, enabled: boolean, durationMs: number): void;

  // File compatibility
  isCurrentFileCompatible(deviceId: string): Signal<boolean>;

  // Play history
  getPlayHistory(deviceId: string): Signal<PlayHistory | null>;
  getCurrentHistoryPosition(deviceId: string): Signal<number>;
  canNavigateBackwardInHistory(deviceId: string): Signal<boolean>;
  canNavigateForwardInHistory(deviceId: string): Signal<boolean>;
  clearHistory(deviceId: string): void;
  toggleHistoryView(deviceId: string): void;
  isHistoryViewVisible(deviceId: string): Signal<boolean>;
  navigateToHistoryPosition(deviceId: string, position: number): Promise<void>;
}

export const PLAYER_CONTEXT = new InjectionToken<IPlayerContext>('PLAYER_CONTEXT');
