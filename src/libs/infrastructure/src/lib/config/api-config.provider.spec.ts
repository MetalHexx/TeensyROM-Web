import { isDevMode } from '@angular/core';
import { provideApiConfig } from './api-config.provider';

// Mock isDevMode to control test behavior
vi.mock('@angular/core', async () => {
  const actual = await vi.importActual('@angular/core');
  return {
    ...actual,
    isDevMode: vi.fn(),
  };
});

describe('provideApiConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Development Mode', () => {
    it('should return absolute URLs when in dev mode', () => {
      // Arrange
      vi.mocked(isDevMode).mockReturnValue(true);

      // Act
      const config = provideApiConfig();

      // Assert
      expect(config).toMatchObject({
        basePath: 'http://localhost:213',
        signalRBasePath: 'http://localhost:213',
      });
    });
  });

  describe('Production Mode', () => {
    it('should return relative URLs (empty strings) when in production mode', () => {
      // Arrange
      vi.mocked(isDevMode).mockReturnValue(false);

      // Act
      const config = provideApiConfig();

      // Assert
      expect(config).toMatchObject({
        basePath: '',
        signalRBasePath: '',
      });
    });
  });

  describe('Configuration Structure', () => {
    it('should return object with required properties', () => {
      // Arrange
      vi.mocked(isDevMode).mockReturnValue(true);

      // Act
      const config = provideApiConfig();

      // Assert
      expect(config).toHaveProperty('basePath');
      expect(config).toHaveProperty('signalRBasePath');
      expect(typeof config.basePath).toBe('string');
      expect(typeof config.signalRBasePath).toBe('string');
    });
  });
});
