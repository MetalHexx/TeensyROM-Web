import { Settings } from '@teensyrom-nx/domain';

/**
 * Settings store state structure
 * Manages current settings, undo/redo history, and loading/error states
 */
export interface SettingsState {
  /** Current settings configuration */
  settings: Settings | null;

  /** History of settings snapshots for undo/redo (max 50 entries) */
  history: Settings[];

  /** Current position in history (-1 = at current/end, 0+ = at historical position) */
  historyPosition: number;

  /** 
   * Stored current settings (used when navigating history)
   * When undo moves from -1 to history, this stores the "real" current
   * so redo can restore it when moving back to -1
   */
  storedCurrent: Settings | null;

  /** Whether settings are being loaded from backend */
  isLoading: boolean;

  /** Whether settings are being saved to backend */
  isSaving: boolean;

  /** Error message if operation failed */
  error: string | null;

  /** Timestamp of last state update */
  lastUpdated: number | null;
}
