import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CrtStorageService } from './crt-storage.service';
import { CrtSettings, CustomPresetName, ALERT_SERVICE, type IAlertService } from '@teensyrom-nx/domain';
import { of } from 'rxjs';
import * as domainValidation from '@teensyrom-nx/domain';

describe('CrtStorageService - Custom Preset Operations', () => {
  let service: CrtStorageService;
  let storage: Map<string, string>;
  let mockAlertService: IAlertService;

  const mockSettings: CrtSettings = {
    scanlineIntensity: 0.7,
    scanlineSize: 2.5,
    vignetteStrength: 0.3,
    screenCurvature: 12,
    contrast: 1.0,
    brightness: 0.8,
    saturation: 1.1,
    hue: 0,
    phosphorPattern: 'none' as const,
    phosphorIntensity: 0,
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0
  };

  beforeEach(() => {
    storage = new Map<string, string>();

    mockAlertService = {
      alerts$: of([]),
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CrtStorageService,
        { provide: ALERT_SERVICE, useValue: mockAlertService },
      ],
    });

    service = TestBed.inject(CrtStorageService);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storage.get(key) ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storage.set(key, value);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      storage.delete(key);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // saveCustomPreset Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('saveCustomPreset', () => {
    it('should save new preset with custom- prefix added', () => {
      service.saveCustomPreset('Valid Preset', mockSettings);

      const storedData = storage.get('teensyrom_crt_custom_presets');
      expect(storedData).toBeDefined();
      const stored = JSON.parse(storedData as string);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('custom-Valid Preset');
      expect(stored[0].settings).toEqual(mockSettings);
      expect(stored[0].createdAt).toBeDefined();
      expect(new Date(stored[0].createdAt)).toBeInstanceOf(Date);
    });

    it('should update existing preset if name matches (overwrite behavior)', async () => {
      const initialSettings = { ...mockSettings, brightness: 0.5 };
      const updatedSettings = { ...mockSettings, brightness: 0.9 };

      service.saveCustomPreset('Test', initialSettings);
      const firstData = storage.get('teensyrom_crt_custom_presets');
      const firstTimestamp = JSON.parse(firstData as string)[0].createdAt;

      // Wait 1ms to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 1));
      
      service.saveCustomPreset('Test', updatedSettings);

      const storedData = storage.get('teensyrom_crt_custom_presets');
      const stored = JSON.parse(storedData as string);
      expect(stored).toHaveLength(1);
      expect(stored[0].settings.brightness).toBe(0.9);
      expect(stored[0].createdAt).not.toBe(firstTimestamp); // Timestamp refreshed
    });

    it('should add ISO 8601 timestamp to createdAt', () => {
      service.saveCustomPreset('Test', mockSettings);

      const storedData = storage.get('teensyrom_crt_custom_presets');
      const stored = JSON.parse(storedData as string);
      const timestamp = stored[0].createdAt;
      
      // Verify ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should validate name before saving', () => {
      const validateSpy = vi.spyOn(domainValidation, 'validatePresetName');
      
      service.saveCustomPreset('Valid Name', mockSettings);

      expect(validateSpy).toHaveBeenCalledWith('Valid Name', []);
    });

    it('should throw error on invalid name', () => {
      vi.spyOn(domainValidation, 'validatePresetName').mockReturnValue({
        valid: false,
        error: 'Preset name cannot be empty'
      });

      expect(() => service.saveCustomPreset('', mockSettings))
        .toThrow('Preset name cannot be empty');
    });

    it('should throw error when 50-preset limit reached', () => {
      // Create 50 presets
      const existingPresets = Array.from({ length: 50 }, (_, i) => ({
        name: `custom-Preset${i}` as CustomPresetName,
        settings: mockSettings,
        createdAt: new Date().toISOString()
      }));
      
      storage.set('teensyrom_crt_custom_presets', JSON.stringify(existingPresets));

      // Attempt to add 51st preset
      expect(() => service.saveCustomPreset('New Preset', mockSettings))
        .toThrow('Maximum of 50 custom presets reached. Please delete unused presets.');
    });

    it('should allow update to existing preset when at 50-preset limit', () => {
      // Create 50 presets including one named "Test"
      const existingPresets = [
        { name: 'custom-Test' as CustomPresetName, settings: mockSettings, createdAt: '2025-01-01T00:00:00.000Z' },
        ...Array.from({ length: 49 }, (_, i) => ({
          name: `custom-Preset${i}` as CustomPresetName,
          settings: mockSettings,
          createdAt: new Date().toISOString()
        }))
      ];

      storage.set('teensyrom_crt_custom_presets', JSON.stringify(existingPresets));
      
      // Should allow updating existing "Test" preset
      const updatedSettings = { ...mockSettings, brightness: 0.9 };
      expect(() => service.saveCustomPreset('Test', updatedSettings)).not.toThrow();

      const storedData = storage.get('teensyrom_crt_custom_presets');
      const stored = JSON.parse(storedData as string);
      expect(stored).toHaveLength(50);
      expect(stored[0].settings.brightness).toBe(0.9);
    });

    it('should handle localStorage write errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => service.saveCustomPreset('Test', mockSettings))
        .toThrow('QuotaExceededError');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loadCustomPresets Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loadCustomPresets', () => {
    it('should return empty array when no presets exist', () => {
      const presets = service.loadCustomPresets();

      expect(presets).toEqual([]);
    });

    it('should return all saved presets correctly', () => {
      const savedPresets = [
        { name: 'custom-Preset1' as CustomPresetName, settings: mockSettings, createdAt: '2025-01-01T00:00:00.000Z' },
        { name: 'custom-Preset2' as CustomPresetName, settings: mockSettings, createdAt: '2025-01-02T00:00:00.000Z' }
      ];

      storage.set('teensyrom_crt_custom_presets', JSON.stringify(savedPresets));      const loaded = service.loadCustomPresets();

      expect(loaded).toEqual(savedPresets);
      expect(loaded).toHaveLength(2);
    });

    it('should parse preset array with correct structure', () => {
      service.saveCustomPreset('Test', mockSettings);

      const loaded = service.loadCustomPresets();

      expect(loaded[0]).toHaveProperty('name');
      expect(loaded[0]).toHaveProperty('settings');
      expect(loaded[0]).toHaveProperty('createdAt');
      expect(loaded[0].name).toBe('custom-Test');
      expect(loaded[0].settings).toEqual(mockSettings);
    });

    it('should return empty array on parse error', () => {
      storage.set('teensyrom_crt_custom_presets', 'invalid json');

      const loaded = service.loadCustomPresets();

      expect(loaded).toEqual([]);
    });

    it('should handle localStorage unavailable', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const loaded = service.loadCustomPresets();

      expect(loaded).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteCustomPreset Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteCustomPreset', () => {
    it('should remove preset from storage', () => {
      service.saveCustomPreset('Test1', mockSettings);
      service.saveCustomPreset('Test2', mockSettings);

      service.deleteCustomPreset('custom-Test1' as CustomPresetName);

      const remaining = service.loadCustomPresets();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('custom-Test2');
    });

    it('should handle non-existent preset gracefully (no error)', () => {
      service.saveCustomPreset('Test', mockSettings);

      expect(() => service.deleteCustomPreset('custom-NonExistent' as CustomPresetName))
        .not.toThrow();

      const remaining = service.loadCustomPresets();
      expect(remaining).toHaveLength(1);
    });

    it('should preserve other presets when deleting one', () => {
      service.saveCustomPreset('Keep1', mockSettings);
      service.saveCustomPreset('Delete', mockSettings);
      service.saveCustomPreset('Keep2', mockSettings);

      service.deleteCustomPreset('custom-Delete' as CustomPresetName);

      const remaining = service.loadCustomPresets();
      expect(remaining).toHaveLength(2);
      expect(remaining.map(p => p.name)).toEqual(['custom-Keep1', 'custom-Keep2']);
    });

    it('should update localStorage correctly after deletion', () => {
      service.saveCustomPreset('Test', mockSettings);
      service.deleteCustomPreset('custom-Test' as CustomPresetName);

      const stored = storage.get('teensyrom_crt_custom_presets');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored as string)).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // renameCustomPreset Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('renameCustomPreset', () => {
    it('should update preset name while preserving settings', () => {
      service.saveCustomPreset('OldName', mockSettings);

      service.renameCustomPreset('custom-OldName' as CustomPresetName, 'NewName');

      const presets = service.loadCustomPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('custom-NewName');
      expect(presets[0].settings).toEqual(mockSettings);
    });

    it('should preserve createdAt timestamp', () => {
      const fixedTimestamp = '2025-01-01T00:00:00.000Z';
      const presets = [{
        name: 'custom-Old' as CustomPresetName,
        settings: mockSettings,
        createdAt: fixedTimestamp
      }];
      
      storage.set('teensyrom_crt_custom_presets', JSON.stringify(presets));

      service.renameCustomPreset('custom-Old' as CustomPresetName, 'New');

      const updated = service.loadCustomPresets();
      expect(updated[0].createdAt).toBe(fixedTimestamp);
    });

    it('should validate new name before renaming', () => {
      service.saveCustomPreset('Old', mockSettings);
      const validateSpy = vi.spyOn(domainValidation, 'validatePresetName');

      service.renameCustomPreset('custom-Old' as CustomPresetName, 'New');

      expect(validateSpy).toHaveBeenCalledWith('New', []);
    });

    it('should throw error on invalid new name', () => {
      service.saveCustomPreset('Old', mockSettings);
      vi.spyOn(domainValidation, 'validatePresetName').mockReturnValue({
        valid: false,
        error: 'Invalid name'
      });

      expect(() => service.renameCustomPreset('custom-Old' as CustomPresetName, ''))
        .toThrow('Invalid name');
    });

    it('should throw error if old name not found', () => {
      expect(() => service.renameCustomPreset('custom-NonExistent' as CustomPresetName, 'New'))
        .toThrow('Preset not found: custom-NonExistent');
    });

    it('should prevent duplicate names (case-insensitive)', () => {
      service.saveCustomPreset('Existing', mockSettings);
      service.saveCustomPreset('ToRename', mockSettings);

      vi.spyOn(domainValidation, 'validatePresetName').mockReturnValue({
        valid: false,
        error: 'A preset with this name already exists'
      });

      expect(() => service.renameCustomPreset('custom-ToRename' as CustomPresetName, 'Existing'))
        .toThrow('A preset with this name already exists');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hasCustomPreset Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('hasCustomPreset', () => {
    it('should return true for existing preset', () => {
      service.saveCustomPreset('Test', mockSettings);

      const exists = service.hasCustomPreset('custom-Test' as CustomPresetName);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent preset', () => {
      service.saveCustomPreset('Test', mockSettings);

      const exists = service.hasCustomPreset('custom-NonExistent' as CustomPresetName);

      expect(exists).toBe(false);
    });

    it('should return false (not throw) on storage errors', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const exists = service.hasCustomPreset('custom-Test' as CustomPresetName);

      expect(exists).toBe(false);
    });

    it('should return false when no presets exist', () => {
      const exists = service.hasCustomPreset('custom-Test' as CustomPresetName);

      expect(exists).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Tests', () => {
    it('should save → load → verify preset persisted', () => {
      service.saveCustomPreset('Integration Test', mockSettings);

      const loaded = service.loadCustomPresets();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('custom-Integration Test');
      expect(loaded[0].settings).toEqual(mockSettings);
    });

    it('should save → rename → load → verify new name', () => {
      service.saveCustomPreset('Original', mockSettings);
      service.renameCustomPreset('custom-Original' as CustomPresetName, 'Renamed');

      const loaded = service.loadCustomPresets();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('custom-Renamed');
      expect(loaded[0].settings).toEqual(mockSettings);
    });

    it('should save multiple → delete one → load → verify correct count', () => {
      service.saveCustomPreset('Keep1', mockSettings);
      service.saveCustomPreset('Delete', mockSettings);
      service.saveCustomPreset('Keep2', mockSettings);

      service.deleteCustomPreset('custom-Delete' as CustomPresetName);

      const loaded = service.loadCustomPresets();

      expect(loaded).toHaveLength(2);
      expect(loaded.map(p => p.name)).toEqual(['custom-Keep1', 'custom-Keep2']);
    });

    it('should save 50 presets → attempt 51st → verify error', () => {
      // Save 50 presets
      for (let i = 0; i < 50; i++) {
        service.saveCustomPreset(`Preset${i}`, mockSettings);
      }

      expect(service.loadCustomPresets()).toHaveLength(50);

      // Attempt 51st
      expect(() => service.saveCustomPreset('Preset51', mockSettings))
        .toThrow('Maximum of 50 custom presets reached');
    });

    it('should handle full CRUD lifecycle', () => {
      // Create
      service.saveCustomPreset('Lifecycle', mockSettings);
      expect(service.hasCustomPreset('custom-Lifecycle' as CustomPresetName)).toBe(true);

      // Read
      const loaded = service.loadCustomPresets();
      expect(loaded).toHaveLength(1);

      // Update (via rename)
      service.renameCustomPreset('custom-Lifecycle' as CustomPresetName, 'Updated');
      expect(service.hasCustomPreset('custom-Updated' as CustomPresetName)).toBe(true);
      expect(service.hasCustomPreset('custom-Lifecycle' as CustomPresetName)).toBe(false);

      // Delete
      service.deleteCustomPreset('custom-Updated' as CustomPresetName);
      expect(service.hasCustomPreset('custom-Updated' as CustomPresetName)).toBe(false);
      expect(service.loadCustomPresets()).toHaveLength(0);
    });
  });
});
