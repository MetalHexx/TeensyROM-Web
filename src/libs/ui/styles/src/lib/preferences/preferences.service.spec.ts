import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let localStorageSpy: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Mock localStorage
    localStorageSpy = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageSpy,
      writable: true,
    });

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorageSpy.getItem.mockClear();
    localStorageSpy.setItem.mockClear();
  });

  describe('initialization', () => {
    it('should create service', () => {
      service = TestBed.inject(PreferencesService);
      expect(service).toBeTruthy();
    });

    it('should load default preferences when localStorage is empty', () => {
      localStorageSpy.getItem.mockReturnValue(null);

      service = TestBed.inject(PreferencesService);

      expect(service.tooltipsEnabled()).toBe(true);
      expect(localStorageSpy.getItem).toHaveBeenCalledWith('user-preferences');
    });

    it('should load preferences from localStorage when available', () => {
      const storedPrefs = JSON.stringify({ tooltipsEnabled: false });
      localStorageSpy.getItem.mockReturnValue(storedPrefs);

      service = TestBed.inject(PreferencesService);

      expect(service.tooltipsEnabled()).toBe(false);
    });

    it('should merge stored preferences with defaults (handles schema evolution)', () => {
      // Simulate old stored preferences missing new keys
      const storedPrefs = JSON.stringify({});
      localStorageSpy.getItem.mockReturnValue(storedPrefs);

      service = TestBed.inject(PreferencesService);

      // Should have default value for missing key
      expect(service.tooltipsEnabled()).toBe(true);
    });

    it('should use defaults when localStorage contains invalid JSON', () => {
      localStorageSpy.getItem.mockReturnValue('invalid-json');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      service = TestBed.inject(PreferencesService);

      expect(service.tooltipsEnabled()).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load user preferences'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('tooltip preferences', () => {
    beforeEach(() => {
      localStorageSpy.getItem.mockReturnValue(null);
      service = TestBed.inject(PreferencesService);
    });

    it('should toggle tooltips from enabled to disabled', () => {
      expect(service.tooltipsEnabled()).toBe(true);

      service.toggleTooltips();

      expect(service.tooltipsEnabled()).toBe(false);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'user-preferences',
        JSON.stringify({ tooltipsEnabled: false })
      );
    });

    it('should toggle tooltips from disabled to enabled', () => {
      service.setTooltipsEnabled(false);
      localStorageSpy.setItem.mockClear();

      service.toggleTooltips();

      expect(service.tooltipsEnabled()).toBe(true);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'user-preferences',
        JSON.stringify({ tooltipsEnabled: true })
      );
    });

    it('should set tooltips enabled directly', () => {
      service.setTooltipsEnabled(false);

      expect(service.tooltipsEnabled()).toBe(false);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'user-preferences',
        JSON.stringify({ tooltipsEnabled: false })
      );
    });

    it('should handle localStorage write errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageSpy.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      service.toggleTooltips();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save user preferences'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('signal reactivity', () => {
    beforeEach(() => {
      localStorageSpy.getItem.mockReturnValue(null);
      service = TestBed.inject(PreferencesService);
    });

    it('should emit new values when preference changes', () => {
      const initialValue = service.tooltipsEnabled();
      expect(initialValue).toBe(true);

      service.toggleTooltips();

      const newValue = service.tooltipsEnabled();
      expect(newValue).toBe(false);
      expect(newValue).not.toBe(initialValue);
    });
  });
});
