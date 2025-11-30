import { Injectable } from '@angular/core';
import { ICrtStorage, CrtStorageContext, CrtSettings } from '@teensyrom-nx/domain';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';

/**
 * Service for persisting CRT visual effect settings to browser localStorage.
 * Settings are scoped per TeensyROM device and component context.
 *
 * Architecture:
 * - Each device maintains independent CRT settings per display context
 * - Allows per-device color/hue calibration for different hardware
 * - Component contexts maintain separate presets (file-image, video-compact, video-dialog)
 * - Simple CRUD operations - no reactive observation to avoid loops
 *
 * Storage Key Format:
 * - `teensyrom_crt_${deviceId}_${context}`
 * - Example: `teensyrom_crt_TR001_video-dialog`
 */
@Injectable()
export class CrtStorageService implements ICrtStorage {
  private readonly STORAGE_KEY_PREFIX = 'teensyrom_crt_';

  save(deviceId: string, context: CrtStorageContext, settings: CrtSettings): void {
    try {
      const key = this.getStorageKey(deviceId, context);
      localStorage.setItem(key, JSON.stringify(settings));

      logInfo(
        LogType.Success,
        `CrtStorage: Persisted ${context} settings for device ${deviceId}`
      );
    } catch (error) {
      logWarn(
        `CrtStorage: Failed to save ${context} settings for device ${deviceId}: ${error}`
      );
    }
  }

  load(deviceId: string, context: CrtStorageContext): CrtSettings | null {
    try {
      const key = this.getStorageKey(deviceId, context);
      const json = localStorage.getItem(key);

      if (!json) {
        logInfo(
          LogType.Info,
          `CrtStorage: No saved ${context} settings found for device ${deviceId}`
        );
        return null;
      }

      const settings = JSON.parse(json) as CrtSettings;
      logInfo(
        LogType.Info,
        `CrtStorage: Loaded ${context} settings for device ${deviceId}`
      );
      return settings;
    } catch (error) {
      logWarn(
        `CrtStorage: Failed to load ${context} settings for device ${deviceId}: ${error}`
      );
      return null;
    }
  }

  hasSavedSettings(deviceId: string, context: CrtStorageContext): boolean {
    const key = this.getStorageKey(deviceId, context);
    return localStorage.getItem(key) !== null;
  }

  clear(deviceId: string, context: CrtStorageContext): void {
    try {
      const key = this.getStorageKey(deviceId, context);
      localStorage.removeItem(key);
      logInfo(LogType.Info, `CrtStorage: Cleared ${context} settings for device ${deviceId}`);
    } catch (error) {
      logWarn(
        `CrtStorage: Failed to clear ${context} settings for device ${deviceId}: ${error}`
      );
    }
  }

  private getStorageKey(deviceId: string, context: CrtStorageContext): string {
    return `${this.STORAGE_KEY_PREFIX}${deviceId}_${context}`;
  }
}
