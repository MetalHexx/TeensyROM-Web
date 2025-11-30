import { InjectionToken } from '@angular/core';
import { CrtSettings } from '../models';

/**
 * Context identifier for CRT settings storage.
 * Each component context maintains independent CRT settings per device.
 */
export type CrtStorageContext = 'file-image' | 'video-compact' | 'video-dialog';

/**
 * Contract for persisting CRT visual effect settings to browser storage.
 * Settings are scoped per TeensyROM device and component context.
 * 
 * Architecture:
 * - Each device maintains independent CRT settings per display context
 * - Allows per-device color/hue calibration for different hardware
 * - Component contexts maintain separate presets (file viewer vs video capture)
 * 
 * @example
 * ```typescript
 * // Save settings for device's video dialog
 * crtStorage.save('TR001', 'video-dialog', { hue: 15, brightness: 1.2, ... });
 * 
 * // Load settings (returns null if none saved)
 * const settings = crtStorage.load('TR001', 'video-dialog');
 * ```
 */
export interface ICrtStorage {
  /**
   * Persist CRT settings for a specific device and context.
   * 
   * @param deviceId - TeensyROM device identifier
   * @param context - Component context (file-image, video-compact, video-dialog)
   * @param settings - CRT visual effect settings to persist
   */
  save(deviceId: string, context: CrtStorageContext, settings: CrtSettings): void;

  /**
   * Load persisted CRT settings for a specific device and context.
   * 
   * @param deviceId - TeensyROM device identifier
   * @param context - Component context
   * @returns Saved CRT settings, or null if none exist
   */
  load(deviceId: string, context: CrtStorageContext): CrtSettings | null;

  /**
   * Check if saved settings exist for a device and context.
   * 
   * @param deviceId - TeensyROM device identifier
   * @param context - Component context
   * @returns True if settings exist in storage
   */
  hasSavedSettings(deviceId: string, context: CrtStorageContext): boolean;

  /**
   * Remove persisted settings for a specific device and context.
   * 
   * @param deviceId - TeensyROM device identifier
   * @param context - Component context
   */
  clear(deviceId: string, context: CrtStorageContext): void;
}

/**
 * Injection token for CRT storage service.
 * Use this to inject the storage implementation in components/stores.
 */
export const CRT_STORAGE = new InjectionToken<ICrtStorage>('ICrtStorage');
