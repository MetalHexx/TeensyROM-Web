import { FileItem, LaunchMode, PlayerFilterType, PlayerScope } from '@teensyrom-nx/domain';
import { StorageKey } from '@teensyrom-nx/application';

/**
 * Lightweight player state model for localStorage persistence.
 * Excludes ephemeral state (loading, errors, timer state) that should not be restored.
 *
 * Infrastructure layer only - Not exposed outside this layer.
 */
export interface SavedPlayerState {
  deviceId: string;
  currentFile: SavedLaunchedFile | null;
  fileContext: SavedFileContext | null;
  launchMode: LaunchMode;
  shuffleSettings: SavedShuffleSettings;
  playHistory: SavedPlayHistory | null;
  historyViewVisible: boolean;
  playTimerConfig: SavedPlayTimerConfig;
  lastUpdated: number | null;
}

export interface SavedLaunchedFile {
  storageKey: StorageKey;
  file: FileItem;
  parentPath: string;
  launchedAt: number;
  isCompatible: boolean;
}

export interface SavedFileContext {
  storageKey: StorageKey;
  directoryPath: string;
  files: FileItem[];
  currentIndex: number;
}

export interface SavedShuffleSettings {
  scope: PlayerScope;
  filter: PlayerFilterType;
  startingDirectory?: string;
}

export interface SavedPlayHistory {
  entries: SavedHistoryEntry[];
  currentPosition: number;
}

export interface SavedHistoryEntry {
  file: FileItem;
  storageKey: StorageKey;
  parentPath: string;
  timestamp: number;
  isCompatible: boolean;
}

export interface SavedPlayTimerConfig {
  enabled: boolean;
  durationMs: number;
}
