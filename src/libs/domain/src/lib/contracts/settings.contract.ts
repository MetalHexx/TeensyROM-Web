import { Observable } from 'rxjs';
import { Settings } from '../models/settings.model';
import { InjectionToken } from '@angular/core';

/**
 * Service contract for managing application settings.
 *
 * Provides operations to retrieve and persist user settings across
 * different configuration categories (player, search, file transfer, app).
 */
export interface ISettingsService {
  /**
   * Retrieves all current user settings from the backend.
   *
   * Settings are loaded from the Settings.json file and cached in memory.
   * This method always returns the current in-memory settings state.
   *
   * @returns Observable emitting the complete settings object
   */
  getSettings(): Observable<Settings>;

  /**
   * Saves all user settings to persistent storage.
   *
   * Settings are validated, persisted to Settings.json, and immediately
   * available in memory after successful save.
   *
   * @param settings - Complete settings object to persist
   * @returns Observable emitting the saved settings object
   */
  saveSettings(settings: Settings): Observable<Settings>;
}

/**
 * Injection token for ISettingsService.
 * Use this token to inject the settings service via dependency injection.
 */
export const SETTINGS_SERVICE = new InjectionToken<ISettingsService>('ISettingsService');
