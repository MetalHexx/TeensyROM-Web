import { Injectable, Inject } from '@angular/core';
import { ICrtStorage, CrtStorageContext, CrtSettings, CustomCrtPreset, CustomPresetName, CRT_PRESET_PREFIX, validatePresetName, IAlertService, ALERT_SERVICE } from '@teensyrom-nx/domain';
import { logInfo, logWarn, LogType, logError } from '@teensyrom-nx/utils';

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
  private readonly CUSTOM_PRESETS_KEY = 'teensyrom_crt_custom_presets';
  private readonly MAX_CUSTOM_PRESETS = 50;

  constructor(@Inject(ALERT_SERVICE) private readonly alertService: IAlertService) {}

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

  // ═══════════════════════════════════════════════════════════════════════════
  // Custom Preset Methods
  // ═══════════════════════════════════════════════════════════════════════════

  saveCustomPreset(name: string, settings: CrtSettings): void {
    const presets = this.readCustomPresets();
    
    // Check if we're updating an existing preset
    const fullName = `${CRT_PRESET_PREFIX.CUSTOM}${name}` as CustomPresetName;
    const existingIndex = presets.findIndex(p => p.name === fullName);
    
    // Extract existing custom names (without 'custom-' prefix) for validation
    // Exclude the current name if we're updating (to allow overwriting)
    const existingNames = presets
      .filter((_, index) => index !== existingIndex) // Exclude current preset from duplicate check
      .map(p => p.name.replace(/^custom-/, ''));
    
    // Validate the name (user-entered name without prefix)
    const validation = validatePresetName(name, existingNames);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Check 50-preset limit (allow update if preset already exists)
    if (existingIndex === -1 && presets.length >= this.MAX_CUSTOM_PRESETS) {
      throw new Error('Maximum of 50 custom presets reached. Please delete unused presets.');
    }
    
    // Create or update preset
    const preset: CustomCrtPreset = {
      name: fullName,
      settings,
      createdAt: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      // Update existing preset (overwrite)
      presets[existingIndex] = preset;
    } else {
      // Add new preset
      presets.push(preset);
    }
    
    this.writeCustomPresets(presets);
    logInfo(LogType.Success, `CrtStorage: Saved custom preset '${fullName}'`);
    this.alertService.success(`Preset '${name}' saved successfully`);
  }

  updateCustomPreset(name: CustomPresetName, settings: CrtSettings): void {
    const presets = this.readCustomPresets();
    
    // Find the preset to update
    const presetIndex = presets.findIndex(p => p.name === name);
    if (presetIndex === -1) {
      throw new Error(`Preset not found: ${name}`);
    }
    
    // Update preset settings while preserving name and createdAt timestamp
    presets[presetIndex] = {
      ...presets[presetIndex],
      settings
    };
    
    this.writeCustomPresets(presets);
    logInfo(LogType.Success, `CrtStorage: Updated custom preset '${name}'`);
    const displayName = name.replace(/^custom-/, '');
    this.alertService.success(`Preset '${displayName}' updated successfully`);
  }

  loadCustomPresets(): CustomCrtPreset[] {
    return this.readCustomPresets();
  }

  deleteCustomPreset(name: CustomPresetName): void {
    const presets = this.readCustomPresets();
    const filtered = presets.filter(p => p.name !== name);
    
    this.writeCustomPresets(filtered);
    logInfo(LogType.Info, `CrtStorage: Deleted custom preset '${name}'`);
    const displayName = name.replace(/^custom-/, '');
    this.alertService.success(`Preset '${displayName}' deleted successfully`);
  }

  renameCustomPreset(oldName: CustomPresetName, newName: string): void {
    const presets = this.readCustomPresets();
    
    // Find preset with old name
    const presetIndex = presets.findIndex(p => p.name === oldName);
    if (presetIndex === -1) {
      throw new Error(`Preset not found: ${oldName}`);
    }
    
    // Extract existing custom names (excluding the one being renamed)
    const existingNames = presets
      .filter(p => p.name !== oldName)
      .map(p => p.name.replace(/^custom-/, ''));
    
    // Validate new name
    const validation = validatePresetName(newName, existingNames);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Update preset name while preserving settings and timestamp
    const fullNewName = `${CRT_PRESET_PREFIX.CUSTOM}${newName}` as CustomPresetName;
    presets[presetIndex] = {
      ...presets[presetIndex],
      name: fullNewName
    };
    
    this.writeCustomPresets(presets);
    logInfo(LogType.Info, `CrtStorage: Renamed custom preset '${oldName}' to '${fullNewName}'`);
    this.alertService.success(`Preset renamed to '${newName}' successfully`);
  }

  hasCustomPreset(name: CustomPresetName): boolean {
    try {
      const presets = this.readCustomPresets();
      return presets.some(p => p.name === name);
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reads all custom presets from localStorage.
   * Returns empty array if no presets exist or on parse errors.
   */
  private readCustomPresets(): CustomCrtPreset[] {
    try {
      const json = localStorage.getItem(this.CUSTOM_PRESETS_KEY);
      
      if (!json) {
        return [];
      }
      
      return JSON.parse(json) as CustomCrtPreset[];
    } catch (error) {
      logWarn(`CrtStorage: Failed to read custom presets: ${error}`);
      return [];
    }
  }

  /**
   * Writes all custom presets to localStorage as a single JSON array.
   * Logs errors but re-throws for caller to handle.
   */
  private writeCustomPresets(presets: CustomCrtPreset[]): void {
    try {
      const json = JSON.stringify(presets);
      localStorage.setItem(this.CUSTOM_PRESETS_KEY, json);
    } catch (error) {
      logError(`CrtStorage: Failed to write custom presets: ${error}`);
      throw error;
    }
  }

  private getStorageKey(deviceId: string, context: CrtStorageContext): string {
    return `${this.STORAGE_KEY_PREFIX}${deviceId}_${context}`;
  }
}
