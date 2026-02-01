import { Injectable, signal, computed } from '@angular/core';

/**
 * User Preferences
 *
 * Centralized user preferences stored in localStorage.
 * Add new preferences here as the application grows.
 */
export interface UserPreferences {
  /**
   * Whether tooltips are enabled globally.
   * @default true
   */
  tooltipsEnabled: boolean;
}

/**
 * Default preferences applied on first load or when localStorage is empty.
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  tooltipsEnabled: true,
};

const STORAGE_KEY = 'user-preferences';

/**
 * Preferences Service
 *
 * Manages user preferences with localStorage persistence.
 * Provides reactive signals for each preference and methods to update them.
 *
 * Architecture:
 * - Single localStorage key with JSON object for all preferences
 * - Signal-based reactive state for Angular components
 * - Type-safe preference keys and values
 * - Atomic updates with persistence
 *
 * Usage:
 * ```typescript
 * constructor(private preferences: PreferencesService) {
 *   // Read preference
 *   if (preferences.tooltipsEnabled()) {
 *     // show tooltip
 *   }
 *
 *   // Update preference
 *   preferences.toggleTooltips();
 * }
 * ```
 *
 * @Injectable providedIn: 'root' - Singleton service
 */
@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  private readonly _preferences = signal<UserPreferences>(this.loadPreferences());

  /**
   * Read-only signal for tooltip enabled state
   */
  readonly tooltipsEnabled = computed(() => this._preferences().tooltipsEnabled);

  /**
   * Toggles tooltip enabled state and persists to localStorage
   */
  toggleTooltips(): void {
    this.updatePreference('tooltipsEnabled', !this._preferences().tooltipsEnabled);
  }

  /**
   * Sets tooltip enabled state and persists to localStorage
   */
  setTooltipsEnabled(enabled: boolean): void {
    this.updatePreference('tooltipsEnabled', enabled);
  }

  /**
   * Updates a single preference and persists entire preferences object
   * @private
   */
  private updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): void {
    const updated = { ...this._preferences(), [key]: value };
    this._preferences.set(updated);
    this.savePreferences(updated);
  }

  /**
   * Loads preferences from localStorage, falling back to defaults if not found or invalid
   * @private
   */
  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return DEFAULT_PREFERENCES;
      }

      const parsed = JSON.parse(stored) as Partial<UserPreferences>;

      // Merge with defaults to ensure all keys exist (handles schema evolution)
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
      };
    } catch (error) {
      console.warn('Failed to load user preferences from localStorage, using defaults:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Persists preferences to localStorage
   * @private
   */
  private savePreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save user preferences to localStorage:', error);
    }
  }
}
