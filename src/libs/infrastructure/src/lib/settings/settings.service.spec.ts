import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  SettingsApiService,
  GetSettingsResponse,
  SaveSettingsResponse,
  PlayerSettingsDto,
  FileTransferSettingsDto,
  SearchSettingsDto,
  SearchWeightsDto,
  AppSettingsDto,
} from '@teensyrom-nx/data-access/api-client';
import { SettingsService } from './settings.service';
import { Settings, ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';

/**
 * Creates a complete test GetSettingsResponse DTO
 */
const createGetSettingsResponseDto = (): GetSettingsResponse => ({
  playerSettings: {
    repeatModeOnStartup: true,
    playTimerEnabled: true,
    muteFastForward: false,
    muteRandomSeek: false,
    startupFilter: 'All',
    startupLaunchEnabled: true,
    startupLaunchRandom: false,
  } as PlayerSettingsDto,
  fileTransferSettings: {
    watchDirectoryLocation: '/test/watch',
    autoTransferPath: '/test/transfer',
    autoFileCopyEnabled: true,
    autoLaunchOnCopyEnabled: true,
    navToDirOnLaunch: false,
    syncFilesEnabled: false,
  } as FileTransferSettingsDto,
  searchSettings: {
    searchWeights: {
      title: 10,
      fileName: 8,
      filePath: 5,
      creator: 7,
      description: 3,
    } as SearchWeightsDto,
    searchStopWords: ['the', 'and', 'or'],
    bannedDirectories: [],
    bannedFiles: [],
  } as SearchSettingsDto,
  appSettings: {
    firstTimeSetup: false,
  } as AppSettingsDto,
});

/**
 * Creates a complete test domain Settings object
 */
const createDomainSettings = (): Settings => ({
  playerSettings: {
    repeatModeOnStartup: true,
    playTimerEnabled: true,
    muteFastForward: false,
    muteRandomSeek: false,
    startupFilter: 'All',
    startupLaunchEnabled: true,
    startupLaunchRandom: false,
  },
  fileTransferSettings: {
    watchDirectoryLocation: '/test/watch',
    autoTransferPath: '/test/transfer',
    autoFileCopyEnabled: true,
    autoLaunchOnCopyEnabled: true,
    navToDirOnLaunch: false,
    syncFilesEnabled: false,
  },
  searchSettings: {
    weights: {
      nameWeight: 8,
      titleWeight: 10,
      creatorWeight: 7,
      releaseInfoWeight: 5,
      descriptionWeight: 3,
    },
    stopWords: ['the', 'and', 'or'],
    bannedDirectories: [],
    bannedFiles: [],
  },
  appSettings: {
    setupCompleted: true,
  },
});

describe('SettingsService', () => {
  let service: SettingsService;
  let mockSettingsApi: {
    getSettings: ReturnType<typeof vi.fn>;
    saveSettings: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: Partial<IAlertService>;

  beforeEach(() => {
    mockSettingsApi = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
    };

    mockAlertService = {
      error: vi.fn(),
      warning: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsApiService, useValue: mockSettingsApi },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
      ],
    });

    service = TestBed.inject(SettingsService);
  });

  describe('getSettings', () => {
    it('should call API and map response to domain Settings', async () => {
      const responseDto = createGetSettingsResponseDto();
      mockSettingsApi.getSettings.mockResolvedValue(responseDto);

      const result = await new Promise<Settings>((resolve, reject) => {
        service.getSettings().subscribe({
          next: resolve,
          error: reject,
        });
      });

      expect(mockSettingsApi.getSettings).toHaveBeenCalledWith();
      expect(result.playerSettings.repeatModeOnStartup).toBe(true);
      expect(result.playerSettings.playTimerEnabled).toBe(true);
      expect(result.playerSettings.startupLaunchEnabled).toBe(true);
      expect(result.fileTransferSettings.autoFileCopyEnabled).toBe(true);
      expect(result.fileTransferSettings.watchDirectoryLocation).toBe('/test/watch');
      expect(result.searchSettings.weights.titleWeight).toBe(10);
      expect(result.searchSettings.stopWords).toEqual(['the', 'and', 'or']);
      expect(result.appSettings.setupCompleted).toBe(true);
    });

    it('should handle API errors and display error alert', async () => {
      const error = new Error('Network error');
      mockSettingsApi.getSettings.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.getSettings().subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow('Network error');

      expect(mockAlertService.error).toHaveBeenCalledWith('Network error');
      consoleSpy.mockRestore();
    });

    it('should use fallback message when error has no message', async () => {
      const error = {};
      mockSettingsApi.getSettings.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.getSettings().subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to load settings');
      consoleSpy.mockRestore();
    });

    it('should call alert service exactly once on error', async () => {
      mockSettingsApi.getSettings.mockRejectedValue(new Error('Test'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.getSettings().subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  describe('saveSettings', () => {
    it('should call API with mapped settings and return input settings', async () => {
      const domainSettings = createDomainSettings();
      const response: SaveSettingsResponse = {
        message: 'Settings saved successfully',
      };

      mockSettingsApi.saveSettings.mockResolvedValue(response);

      const result = await new Promise<Settings>((resolve, reject) => {
        service.saveSettings(domainSettings).subscribe({
          next: resolve,
          error: reject,
        });
      });

      expect(mockSettingsApi.saveSettings).toHaveBeenCalled();
      const callArg = mockSettingsApi.saveSettings.mock.calls[0][0];
      expect(callArg.saveSettingsRequest).toBeDefined();
      expect(callArg.saveSettingsRequest.playerSettings).toBeDefined();
      expect(callArg.saveSettingsRequest.fileTransferSettings).toBeDefined();
      expect(callArg.saveSettingsRequest.searchSettings).toBeDefined();
      expect(callArg.saveSettingsRequest.appSettings).toBeDefined();
      expect(callArg.saveSettingsRequest.connectionSettings).toBeDefined(); // Stub provided

      // Result should echo back input
      expect(result).toEqual(domainSettings);
    });

    it('should map domain settings to DTO correctly', async () => {
      const domainSettings = createDomainSettings();
      const response: SaveSettingsResponse = {
        message: 'Settings saved',
      };

      mockSettingsApi.saveSettings.mockResolvedValue(response);

      await new Promise<Settings>((resolve, reject) => {
        service.saveSettings(domainSettings).subscribe({
          next: resolve,
          error: reject,
        });
      });

      const callArg = mockSettingsApi.saveSettings.mock.calls[0][0];
      const requestDto = callArg.saveSettingsRequest;

      // Verify player settings mapping
      expect(requestDto.playerSettings.repeatModeOnStartup).toBe(true);
      expect(requestDto.playerSettings.playTimerEnabled).toBe(true);
      expect(requestDto.playerSettings.startupLaunchEnabled).toBe(true);

      // Verify file transfer settings mapping
      expect(requestDto.fileTransferSettings.autoFileCopyEnabled).toBe(true);
      expect(requestDto.fileTransferSettings.autoLaunchOnCopyEnabled).toBe(true);
      expect(requestDto.fileTransferSettings.watchDirectoryLocation).toBe('/test/watch');

      // Verify search settings mapping
      expect(requestDto.searchSettings.searchWeights.title).toBe(10);
      expect(requestDto.searchSettings.searchWeights.fileName).toBe(8);
      expect(requestDto.searchSettings.searchStopWords).toEqual(['the', 'and', 'or']);

      // Verify app settings mapping
      expect(requestDto.appSettings.firstTimeSetup).toBe(false); // Inverse of setupCompleted
    });

    it('should handle API errors and display error alert', async () => {
      const domainSettings = createDomainSettings();
      const error = new Error('Save failed');
      mockSettingsApi.saveSettings.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.saveSettings(domainSettings).subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow('Save failed');

      expect(mockAlertService.error).toHaveBeenCalledWith('Save failed');
      consoleSpy.mockRestore();
    });

    it('should use fallback message when save error has no message', async () => {
      const domainSettings = createDomainSettings();
      const error = {};
      mockSettingsApi.saveSettings.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.saveSettings(domainSettings).subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to save settings');
      consoleSpy.mockRestore();
    });

    it('should call alert service exactly once on save error', async () => {
      const domainSettings = createDomainSettings();
      mockSettingsApi.saveSettings.mockRejectedValue(new Error('Test'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.saveSettings(domainSettings).subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  describe('Mapper Integration', () => {
    it('should correctly map all DTO fields to domain models', async () => {
      const responseDto = createGetSettingsResponseDto();
      mockSettingsApi.getSettings.mockResolvedValue(responseDto);

      const result = await new Promise<Settings>((resolve, reject) => {
        service.getSettings().subscribe({
          next: resolve,
          error: reject,
        });
      });

      // Verify all sections are mapped
      expect(result.playerSettings).toBeDefined();
      expect(result.fileTransferSettings).toBeDefined();
      expect(result.searchSettings).toBeDefined();
      expect(result.appSettings).toBeDefined();

      // Verify nested structures
      expect(result.searchSettings.weights).toBeDefined();
      expect(result.searchSettings.stopWords).toBeInstanceOf(Array);
      expect(result.searchSettings.bannedDirectories).toBeInstanceOf(Array);
      expect(result.searchSettings.bannedFiles).toBeInstanceOf(Array);
    });

    it('should handle empty arrays in settings', async () => {
      const responseDto = createGetSettingsResponseDto();
      responseDto.searchSettings.searchStopWords = [];
      responseDto.fileTransferSettings.watchDirectoryLocation = '';
      responseDto.searchSettings.bannedDirectories = [];
      responseDto.searchSettings.bannedFiles = [];

      mockSettingsApi.getSettings.mockResolvedValue(responseDto);

      const result = await new Promise<Settings>((resolve, reject) => {
        service.getSettings().subscribe({
          next: resolve,
          error: reject,
        });
      });

      expect(result.searchSettings.stopWords).toEqual([]);
      expect(result.searchSettings.bannedDirectories).toEqual([]);
      expect(result.searchSettings.bannedFiles).toEqual([]);
      expect(result.fileTransferSettings.watchDirectoryLocation).toBe('');
    });
  });
});
