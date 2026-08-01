import { describe, it, expect } from 'vitest';
import {
  CartDto,
  CartStorageDto,
  StorageCacheDto,
  DirectoryItemDto,
  FileItemDto,
  ViewableItemImageDto,
  FileItemType as ApiFileItemType,
  TeensyStorageType as ApiStorageType,
  DeviceState as ApiDeviceState,
  NullableOfTeensyFilterType,
  LaunchRandomScopeEnum,
  GetSettingsResponse,
  PlayerSettingsDto,
  FileTransferSettingsDto,
  SearchSettingsDto,
  SearchWeightsDto,
  AppSettingsDto,
  TeensyFilterType as ApiFilterType,
  AudioSettingsDto,
} from '@teensyrom-nx/data-access/api-client';
import { DomainMapper } from './domain.mapper';
import {
  FileItemType,
  StorageType,
  DeviceState,
  PlayerFilterType,
  PlayerScope,
  Settings,
  AudioSettings,
} from '@teensyrom-nx/domain';

describe('DomainMapper (Storage)', () => {
  const baseApiUrl = 'http://localhost:5168';

  describe('toStorageDirectory', () => {
    it('should transform StorageCacheDto to StorageDirectory successfully', () => {
      // Arrange
      const storageCacheDto: StorageCacheDto = {
        directories: [
          { name: 'Games', path: '/games' },
          { name: 'Music', path: '/music' },
        ],
        files: [
          {
            name: 'test.prg',
            path: '/test.prg',
            size: 1024,
            isFavorite: true,
            isCompatible: true,
            title: 'Test Game',
            creator: 'Test Creator',
            releaseInfo: '2023',
            description: 'A test game',
            shareUrl: 'http://example.com',
            metadataSource: 'HVSC',
            meta1: 'meta1',
            meta2: 'meta2',
            metadataSourcePath: '/metadata',
            parentPath: '/',
            playLength: '3:30',
            subtuneLengths: ['3:30'],
            startSubtuneNum: 1,
            images: [
              {
                fileName: 'image.png',
                path: '/images/image.png',
                baseAssetPath: '/Assets/Games/Screenshots/image.png',
                source: 'local',
              },
            ],
            links: [
              {
                name: 'CSDB Profile',
                url: 'https://csdb.dk/scener/?id=1234',
              },
            ],
            tags: [
              {
                name: 'Techno',
                type: 'genre',
              },
            ],
            youTubeVideos: [
              {
                videoId: 'abc123',
                url: 'https://youtube.com/watch?v=abc123',
                channel: 'Test Channel',
                subtune: 1,
              },
            ],
            competitions: [
              {
                name: 'Test Compo',
                place: 1,
              },
            ],
            avgRating: 4.5,
            ratingCount: 10,
            type: ApiFileItemType.Game,
            storageType: ApiStorageType.Sd,
          },
        ],
        path: '/root',
      };

      // Act
      const result = DomainMapper.toStorageDirectory(storageCacheDto, baseApiUrl);

      // Assert
      expect(result).toBeDefined();
      expect(result.path).toBe('/root');
      expect(result.directories).toHaveLength(2);
      expect(result.directories[0].name).toBe('Games');
      expect(result.directories[0].path).toBe('/games');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('test.prg');
      expect(result.files[0].type).toBe(FileItemType.Game);
      expect(result.files[0].links).toHaveLength(1);
      expect(result.files[0].links[0].name).toBe('CSDB Profile');
      expect(result.files[0].tags).toHaveLength(1);
      expect(result.files[0].tags[0].name).toBe('Techno');
      expect(result.files[0].youTubeVideos).toHaveLength(1);
      expect(result.files[0].youTubeVideos[0].channel).toBe('Test Channel');
      expect(result.files[0].youTubeVideos[0].subtune).toBe(1);
      expect(result.files[0].competitions).toHaveLength(1);
      expect(result.files[0].competitions[0].name).toBe('Test Compo');
      expect(result.files[0].competitions[0].place).toBe(1);
      expect(result.files[0].avgRating).toBe(4.5);
      expect(result.files[0].ratingCount).toBe(10);
    });

    it('should handle null/undefined directories and files arrays', () => {
      // Arrange
      const storageCacheDto: StorageCacheDto = {
        directories: [],
        files: [],
        path: '/test',
      };

      // Act
      const result = DomainMapper.toStorageDirectory(storageCacheDto, baseApiUrl);

      // Assert
      expect(result.directories).toEqual([]);
      expect(result.files).toEqual([]);
      expect(result.path).toBe('/test');
    });

    it('should throw error when StorageCacheDto is null', () => {
      // Arrange
      const storageCacheDto = null as unknown as StorageCacheDto;

      // Act & Assert
      expect(() => DomainMapper.toStorageDirectory(storageCacheDto, baseApiUrl)).toThrow(
        'StorageCacheDto is required for transformation'
      );
    });
  });

  describe('toFileItemType', () => {
    it('should map API file types to domain file types correctly', () => {
      expect(DomainMapper.toFileItemType(ApiFileItemType.Song)).toBe(FileItemType.Song);
      expect(DomainMapper.toFileItemType(ApiFileItemType.Game)).toBe(FileItemType.Game);
      expect(DomainMapper.toFileItemType(ApiFileItemType.Image)).toBe(FileItemType.Image);
      expect(DomainMapper.toFileItemType(ApiFileItemType.Hex)).toBe(FileItemType.Hex);
      expect(DomainMapper.toFileItemType(ApiFileItemType.Unknown)).toBe(FileItemType.Unknown);
    });
  });

  describe('toDirectoryItem', () => {
    it('should transform DirectoryItemDto successfully', () => {
      // Arrange
      const dto: DirectoryItemDto = {
        name: 'Test Directory',
        path: '/test',
      };

      // Act
      const result = DomainMapper.toDirectoryItem(dto);

      // Assert
      expect(result.name).toBe('Test Directory');
      expect(result.path).toBe('/test');
    });

    it('should handle null/undefined properties with defaults', () => {
      // Arrange
      const dto: DirectoryItemDto = {
        name: '',
        path: '',
      };

      // Act
      const result = DomainMapper.toDirectoryItem(dto);

      // Assert
      expect(result.name).toBe('');
      expect(result.path).toBe('');
    });

    it('should throw error when DirectoryItemDto is null', () => {
      // Arrange
      const dto = null as unknown as DirectoryItemDto;

      // Act & Assert
      expect(() => DomainMapper.toDirectoryItem(dto)).toThrow(
        'DirectoryItemDto is required for transformation'
      );
    });
  });

  describe('toFileItem', () => {
    const baseApiUrl = 'http://localhost:5168';

    it('should transform FileItemDto with all properties', () => {
      // Arrange
      const dto: FileItemDto = {
        name: 'test.sid',
        path: '/music/test.sid',
        size: 2048,
        isFavorite: false,
        isCompatible: true,
        title: 'Test Song',
        creator: 'Test Musician',
        releaseInfo: '1985',
        description: 'Classic SID tune',
        shareUrl: 'http://example.com/test.sid',
        metadataSource: 'HVSC',
        meta1: 'additional info',
        meta2: 'more info',
        metadataSourcePath: '/hvsc/test.sid',
        parentPath: '/music',
        playLength: '2:45',
        subtuneLengths: ['2:45', '1:30'],
        startSubtuneNum: 0,
        images: [],
        links: [],
        tags: [],
        youTubeVideos: [],
        competitions: [],
        avgRating: undefined,
        ratingCount: 0,
        type: ApiFileItemType.Song,
        storageType: ApiStorageType.Sd,
      };

      // Act
      const result = DomainMapper.toFileItem(dto, baseApiUrl);

      // Assert
      expect(result.name).toBe('test.sid');
      expect(result.path).toBe('/music/test.sid');
      expect(result.size).toBe(2048);
      expect(result.isFavorite).toBe(false);
      expect(result.isCompatible).toBe(true);
      expect(result.title).toBe('Test Song');
      expect(result.creator).toBe('Test Musician');
      expect(result.type).toBe(FileItemType.Song);
      expect(result.subtuneLengths).toEqual(['2:45', '1:30']);
    });

    it('should map isCompatible field correctly', () => {
      // Arrange - Compatible file
      const compatibleDto: FileItemDto = {
        name: 'compatible.sid',
        path: '/music/compatible.sid',
        size: 1024,
        isFavorite: false,
        isCompatible: true,
        title: '',
        creator: '',
        releaseInfo: '',
        description: '',
        shareUrl: '',
        metadataSource: '',
        meta1: '',
        meta2: '',
        metadataSourcePath: '',
        parentPath: '/music',
        playLength: '',
        subtuneLengths: [],
        startSubtuneNum: 0,
        images: [],
        links: [],
        tags: [],
        youTubeVideos: [],
        competitions: [],
        avgRating: undefined,
        ratingCount: 0,
        type: ApiFileItemType.Song,
        storageType: ApiStorageType.Sd,
      };

      // Act
      const compatibleResult = DomainMapper.toFileItem(compatibleDto, baseApiUrl);

      // Assert
      expect(compatibleResult.isCompatible).toBe(true);

      // Arrange - Incompatible file
      const incompatibleDto: FileItemDto = {
        ...compatibleDto,
        name: 'incompatible.sid',
        isCompatible: false,
      };

      // Act
      const incompatibleResult = DomainMapper.toFileItem(incompatibleDto, baseApiUrl);

      // Assert
      expect(incompatibleResult.isCompatible).toBe(false);
    });

    it('should default isCompatible to true when undefined', () => {
      // Arrange
      const dto = {
        name: 'test.sid',
        path: '/music/test.sid',
        size: 1024,
        isFavorite: false,
        isCompatible: undefined,
        title: '',
        creator: '',
        releaseInfo: '',
        description: '',
        shareUrl: '',
        metadataSource: '',
        meta1: '',
        meta2: '',
        metadataSourcePath: '',
        parentPath: '/music',
        playLength: '',
        subtuneLengths: [],
        startSubtuneNum: 0,
        images: [],
        links: [],
        tags: [],
        youTubeVideos: [],
        competitions: [],
        avgRating: undefined,
        ratingCount: 0,
        type: ApiFileItemType.Song,
        storageType: ApiStorageType.Sd,
      } as unknown as FileItemDto;

      // Act
      const result = DomainMapper.toFileItem(dto, baseApiUrl);

      // Assert
      expect(result.isCompatible).toBe(true);
    });

    it('should pass baseApiUrl to toViewableItemImage for all images', () => {
      // Arrange
      const dto: FileItemDto = {
        name: 'test.prg',
        path: '/games/test.prg',
        size: 1024,
        isFavorite: false,
        isCompatible: true,
        title: '',
        creator: '',
        releaseInfo: '',
        description: '',
        shareUrl: '',
        metadataSource: '',
        meta1: '',
        meta2: '',
        metadataSourcePath: '',
        parentPath: '/games',
        playLength: '',
        subtuneLengths: [],
        startSubtuneNum: 0,
        links: [],
        tags: [],
        youTubeVideos: [],
        competitions: [],
        avgRating: undefined,
        ratingCount: 0,
        images: [
          {
            fileName: 'screenshot1.png',
            path: '/images/screenshot1.png',
            baseAssetPath: '/Assets/Games/Screenshots/screenshot1.png',
            source: 'local',
          },
          {
            fileName: 'screenshot2.png',
            path: '/images/screenshot2.png',
            baseAssetPath: '/Assets/Games/Screenshots/screenshot2.png',
            source: 'local',
          },
        ],
        type: ApiFileItemType.Game,
        storageType: ApiStorageType.Sd,
      };

      // Act
      const result = DomainMapper.toFileItem(dto, baseApiUrl);

      // Assert
      expect(result.images).toHaveLength(2);
      expect(result.images[0].url).toBe(
        'http://localhost:5168/Assets/Games/Screenshots/screenshot1.png'
      );
      expect(result.images[1].url).toBe(
        'http://localhost:5168/Assets/Games/Screenshots/screenshot2.png'
      );
    });

    it('should throw error when FileItemDto is null', () => {
      // Arrange
      const dto = null as unknown as FileItemDto;

      // Act & Assert
      expect(() => DomainMapper.toFileItem(dto, baseApiUrl)).toThrow(
        'FileItemDto is required for transformation'
      );
    });
  });

  describe('toViewableItemImage', () => {
    const baseApiUrl = 'http://localhost:5168';

    it('should transform ViewableItemImageDto successfully with URL construction', () => {
      // Arrange
      const dto: ViewableItemImageDto = {
        fileName: 'screenshot.png',
        path: '/images/screenshot.png',
        baseAssetPath: '/Assets/Games/Screenshots/screenshot.png',
        source: 'embedded',
      };

      // Act
      const result = DomainMapper.toViewableItemImage(dto, baseApiUrl);

      // Assert
      expect(result.fileName).toBe('screenshot.png');
      expect(result.path).toBe('/images/screenshot.png');
      expect(result.source).toBe('embedded');
      expect(result.url).toBe('http://localhost:5168/Assets/Games/Screenshots/screenshot.png');
    });

    it('should construct URL correctly from baseApiUrl + baseAssetPath', () => {
      // Arrange
      const dto: ViewableItemImageDto = {
        fileName: 'test.png',
        path: '/test.png',
        baseAssetPath: '/Assets/Music/Covers/test.png',
        source: 'local',
      };

      // Act
      const result = DomainMapper.toViewableItemImage(dto, baseApiUrl);

      // Assert
      expect(result.url).toBe('http://localhost:5168/Assets/Music/Covers/test.png');
    });

    it('should return empty string for url when baseAssetPath is empty', () => {
      // Arrange
      const dto: ViewableItemImageDto = {
        fileName: 'test.png',
        path: '/test.png',
        baseAssetPath: '',
        source: 'local',
      };

      // Act
      const result = DomainMapper.toViewableItemImage(dto, baseApiUrl);

      // Assert
      expect(result.url).toBe('');
    });

    it('should return empty string for url when baseAssetPath is undefined', () => {
      // Arrange
      const dto: ViewableItemImageDto = {
        fileName: 'test.png',
        path: '/test.png',
        baseAssetPath: undefined as unknown as string,
        source: 'local',
      };

      // Act
      const result = DomainMapper.toViewableItemImage(dto, baseApiUrl);

      // Assert
      expect(result.url).toBe('');
    });

    it('should throw error when ViewableItemImageDto is null', () => {
      // Arrange
      const dto = null as unknown as ViewableItemImageDto;

      // Act & Assert
      expect(() => DomainMapper.toViewableItemImage(dto, baseApiUrl)).toThrow(
        'ViewableItemImageDto is required for transformation'
      );
    });
  });

  describe('Storage Type Mapping', () => {
    describe('toApiStorageType', () => {
      it('should map domain StorageType to API TeensyStorageType correctly', () => {
        expect(DomainMapper.toApiStorageType(StorageType.Sd)).toBe(ApiStorageType.Sd);
        expect(DomainMapper.toApiStorageType(StorageType.Usb)).toBe(ApiStorageType.Usb);
      });

      it('should throw error for unknown storage type', () => {
        const unknownType = 'InvalidType' as unknown as StorageType;
        expect(() => DomainMapper.toApiStorageType(unknownType)).toThrow(
          'Unknown storage type: InvalidType'
        );
      });
    });

    describe('toDomainStorageType', () => {
      it('should map API TeensyStorageType to domain StorageType correctly', () => {
        expect(DomainMapper.toDomainStorageType(ApiStorageType.Sd)).toBe(StorageType.Sd);
        expect(DomainMapper.toDomainStorageType(ApiStorageType.Usb)).toBe(StorageType.Usb);
      });

      it('should throw error for unknown API storage type', () => {
        const unknownType = 'InvalidApiType' as unknown as ApiStorageType;
        expect(() => DomainMapper.toDomainStorageType(unknownType)).toThrow(
          'Unknown API storage type: InvalidApiType'
        );
      });
    });
  });
});

describe('DomainMapper (Device)', () => {
  describe('toDevice', () => {
    it('should transform CartDto to Device successfully', () => {
      // Arrange
      const cartDto: CartDto = {
        deviceId: 'device-123',
        comPort: 'COM3',
        name: 'TeensyROM Cart',
        fwVersion: '1.0.0',
        isCompatible: true,
        isConnected: true,
        deviceState: ApiDeviceState.Connected,
        sdStorage: {
          deviceId: 'device-123',
          type: ApiStorageType.Sd,
          available: true,
          indexExists: false,
        },
        usbStorage: {
          deviceId: 'device-123',
          type: ApiStorageType.Usb,
          available: false,
          indexExists: false,
        },
        connectionType: 'Serial',
        ipAddress: '',
        tcpPort: 0,
      };

      // Act
      const result = DomainMapper.toDevice(cartDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.deviceId).toBe('device-123');
      expect(result.comPort).toBe('COM3');
      expect(result.name).toBe('TeensyROM Cart');
      expect(result.fwVersion).toBe('1.0.0');
      expect(result.isCompatible).toBe(true);
      expect(result.isConnected).toBe(true);
      expect(result.deviceState).toBe(DeviceState.Connected);
      expect(result.sdStorage).toBeDefined();
      expect(result.sdStorage.type).toBe(StorageType.Sd);
      expect(result.sdStorage.available).toBe(true);
      expect(result.usbStorage).toBeDefined();
      expect(result.usbStorage.type).toBe(StorageType.Usb);
      expect(result.usbStorage.available).toBe(false);
    });

    it('should handle null CartDto', () => {
      // Arrange
      const cartDto = null as unknown as CartDto;

      // Act
      const result = DomainMapper.toDevice(cartDto);

      // Assert
      expect(result).toEqual({});
    });

    it('should handle undefined CartDto', () => {
      // Arrange
      const cartDto = undefined as unknown as CartDto;

      // Act
      const result = DomainMapper.toDevice(cartDto);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('toDeviceStorage', () => {
    it('should transform CartStorageDto to DeviceStorage successfully', () => {
      // Arrange
      const storageDto: CartStorageDto = {
        deviceId: 'device-456',
        type: ApiStorageType.Sd,
        available: true,
        indexExists: true,
      };

      // Act
      const result = DomainMapper.toDeviceStorage(storageDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.deviceId).toBe('device-456');
      expect(result.type).toBe(StorageType.Sd);
      expect(result.available).toBe(true);
    });

    it('should handle USB storage type', () => {
      // Arrange
      const storageDto: CartStorageDto = {
        deviceId: 'device-789',
        type: ApiStorageType.Usb,
        available: false,
        indexExists: false,
      };

      // Act
      const result = DomainMapper.toDeviceStorage(storageDto);

      // Assert
      expect(result.deviceId).toBe('device-789');
      expect(result.type).toBe(StorageType.Usb);
      expect(result.available).toBe(false);
    });
  });

  describe('toDeviceList', () => {
    it('should transform array of CartDto to Device array successfully', () => {
      // Arrange
      const cartDtos: CartDto[] = [
        {
          deviceId: 'device-1',
          comPort: 'COM1',
          name: 'Cart 1',
          fwVersion: '1.0.0',
          isCompatible: true,
          isConnected: false,
          deviceState: ApiDeviceState.Connectable,
          sdStorage: {
            deviceId: 'device-1',
            type: ApiStorageType.Sd,
            available: true,
            indexExists: true,
          },
          usbStorage: {
            deviceId: 'device-1',
            type: ApiStorageType.Usb,
            available: true,
            indexExists: false,
          },
          connectionType: 'Serial',
          ipAddress: '',
          tcpPort: 0,
        },
        {
          deviceId: 'device-2',
          comPort: 'COM2',
          name: 'Cart 2',
          fwVersion: '1.1.0',
          isCompatible: false,
          isConnected: true,
          deviceState: ApiDeviceState.Connected,
          sdStorage: {
            deviceId: 'device-2',
            type: ApiStorageType.Sd,
            available: false,
            indexExists: false,
          },
          usbStorage: {
            deviceId: 'device-2',
            type: ApiStorageType.Usb,
            available: true,
            indexExists: true,
          },
          connectionType: 'Serial',
          ipAddress: '',
          tcpPort: 0,
        },
      ];

      // Act
      const result = DomainMapper.toDeviceList(cartDtos);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].deviceId).toBe('device-1');
      expect(result[0].name).toBe('Cart 1');
      expect(result[0].isConnected).toBe(false);
      expect(result[0].deviceState).toBe(DeviceState.Connectable);
      expect(result[1].deviceId).toBe('device-2');
      expect(result[1].name).toBe('Cart 2');
      expect(result[1].isCompatible).toBe(false);
      expect(result[1].deviceState).toBe(DeviceState.Connected);
    });

    it('should handle empty array', () => {
      // Arrange
      const cartDtos: CartDto[] = [];

      // Act
      const result = DomainMapper.toDeviceList(cartDtos);

      // Assert
      expect(result).toEqual([]);
    });
  });
});

describe('DomainMapper (Player)', () => {
  describe('toApiPlayerScope', () => {
    it('should map PlayerScope.Storage to LaunchRandomScopeEnum.Storage', () => {
      const result = DomainMapper.toApiPlayerScope(PlayerScope.Storage);
      expect(result).toBe(LaunchRandomScopeEnum.Storage);
    });

    it('should map PlayerScope.DirectoryDeep to LaunchRandomScopeEnum.DirDeep', () => {
      const result = DomainMapper.toApiPlayerScope(PlayerScope.DirectoryDeep);
      expect(result).toBe(LaunchRandomScopeEnum.DirDeep);
    });

    it('should map PlayerScope.DirectoryShallow to LaunchRandomScopeEnum.DirShallow', () => {
      const result = DomainMapper.toApiPlayerScope(PlayerScope.DirectoryShallow);
      expect(result).toBe(LaunchRandomScopeEnum.DirShallow);
    });
  });

  describe('toApiPlayerFilter', () => {
    it('should map PlayerFilterType.All to NullableOfTeensyFilterType.All', () => {
      const result = DomainMapper.toApiPlayerFilter(PlayerFilterType.All);
      expect(result).toBe(NullableOfTeensyFilterType.All);
    });

    it('should map PlayerFilterType.Games to NullableOfTeensyFilterType.Games', () => {
      const result = DomainMapper.toApiPlayerFilter(PlayerFilterType.Games);
      expect(result).toBe(NullableOfTeensyFilterType.Games);
    });

    it('should map PlayerFilterType.Music to NullableOfTeensyFilterType.Music', () => {
      const result = DomainMapper.toApiPlayerFilter(PlayerFilterType.Music);
      expect(result).toBe(NullableOfTeensyFilterType.Music);
    });

    it('should map PlayerFilterType.Images to NullableOfTeensyFilterType.Images', () => {
      const result = DomainMapper.toApiPlayerFilter(PlayerFilterType.Images);
      expect(result).toBe(NullableOfTeensyFilterType.Images);
    });

    it('should map PlayerFilterType.Hex to NullableOfTeensyFilterType.Hex', () => {
      const result = DomainMapper.toApiPlayerFilter(PlayerFilterType.Hex);
      expect(result).toBe(NullableOfTeensyFilterType.Hex);
    });
  });
});

describe('DomainMapper (Settings)', () => {
  describe('toSettings - API Filter String → PlayerFilterType Enum Mapping', () => {
    it('should map "All" to PlayerFilterType.All', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'All' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.All);
    });

    it('should map "Games" to PlayerFilterType.Games', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'Games' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Games);
    });

    it('should map "Music" to PlayerFilterType.Music', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'Music' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Music);
    });

    it('should map "Hex" to PlayerFilterType.Hex', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'Hex' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Hex);
    });

    it('should map "Images" to PlayerFilterType.Images', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'Images' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Images);
    });

    it('should be case-insensitive - lowercase', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'games' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Games);
    });

    it('should be case-insensitive - mixed case', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'MuSiC' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Music);
    });

    it('should default to PlayerFilterType.All for unrecognized values', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: 'InvalidFilter' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.All);
    });

    it('should default to PlayerFilterType.All for empty string', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: '' });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.All);
    });

    it('should default to PlayerFilterType.All for null/undefined', () => {
      const dto = createMockGetSettingsResponse({ startupFilter: null as unknown as string });
      const result = DomainMapper.toSettings(dto);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.All);
    });
  });

  describe('toSettings - Full Settings Mapping', () => {
    it('should map all player settings correctly', () => {
      const dto = createMockGetSettingsResponse({
        repeatModeOnStartup: true,
        playTimerEnabled: false,
        muteFastForward: true,
        muteRandomSeek: false,
        startupFilter: 'Music',
        startupLaunchEnabled: true,
        startupLaunchRandom: false,
      });
      const result = DomainMapper.toSettings(dto);

      expect(result.playerSettings.repeatModeOnStartup).toBe(true);
      expect(result.playerSettings.playTimerEnabled).toBe(false);
      expect(result.playerSettings.muteFastForward).toBe(true);
      expect(result.playerSettings.muteRandomSeek).toBe(false);
      expect(result.playerSettings.startupFilter).toBe(PlayerFilterType.Music);
      expect(result.playerSettings.startupLaunchEnabled).toBe(true);
      expect(result.playerSettings.startupLaunchRandom).toBe(false);
    });

    it('should map file transfer settings correctly', () => {
      const dto = createMockGetSettingsResponse({
        watchDirectoryLocation: '/watch',
        autoTransferPath: '/transfer',
        autoFileCopyEnabled: true,
        autoLaunchOnCopyEnabled: false,
        navToDirOnLaunch: true,
        syncFilesEnabled: false,
      });
      const result = DomainMapper.toSettings(dto);

      expect(result.fileTransferSettings.watchDirectoryLocation).toBe('/watch');
      expect(result.fileTransferSettings.autoTransferPath).toBe('/transfer');
      expect(result.fileTransferSettings.autoFileCopyEnabled).toBe(true);
      expect(result.fileTransferSettings.autoLaunchOnCopyEnabled).toBe(false);
      expect(result.fileTransferSettings.navToDirOnLaunch).toBe(true);
      expect(result.fileTransferSettings.syncFilesEnabled).toBe(false);
    });

    it('should map app settings correctly (inverse firstTimeSetup)', () => {
      const dto = createMockGetSettingsResponse({ firstTimeSetup: false });
      const result = DomainMapper.toSettings(dto);
      expect(result.appSettings.setupCompleted).toBe(true);
    });

    it('should map video settings correctly via knownDevices', () => {
      const dto = createMockGetSettingsResponse({ enableVideo: true });
      const result = DomainMapper.toSettings(dto);
      expect(result.knownDevices[0].videoSettings.enableVideo).toBe(true);
    });

    it('should map video settings with false value via knownDevices', () => {
      const dto = createMockGetSettingsResponse({ enableVideo: false });
      const result = DomainMapper.toSettings(dto);
      expect(result.knownDevices[0].videoSettings.enableVideo).toBe(false);
    });

    it('should handle empty knownDevices array', () => {
      const dto = createMockGetSettingsResponse({ knownDevices: [] });
      const result = DomainMapper.toSettings(dto);
      expect(result.knownDevices).toEqual([]);
    });

    it('should map multiple devices in knownDevices', () => {
      const dto = createMockGetSettingsResponse({
        knownDevices: [
          {
            deviceId: 'device-1',
            videoSettings: { enableVideo: true, videoDeviceId: 'cam-1' },
            indexingStatus: { sdLastIndexed: null, usbLastIndexed: null },
            audioSettings: {
              enableAudioStream: false,
              audioDeviceIndex: -1,
              audioDeviceName: '',
              channelCount: 1,
              sampleRate: 48000,
            },
          },
          {
            deviceId: 'device-2',
            videoSettings: { enableVideo: false, videoDeviceId: '' },
            indexingStatus: { sdLastIndexed: null, usbLastIndexed: null },
            audioSettings: {
              enableAudioStream: true,
              audioDeviceIndex: 0,
              audioDeviceName: 'Device 2 Mic',
              channelCount: 2,
              sampleRate: 44100,
            },
          },
        ],
      });
      const result = DomainMapper.toSettings(dto);

      expect(result.knownDevices.length).toBe(2);
      expect(result.knownDevices[0].deviceId).toBe('device-1');
      expect(result.knownDevices[0].videoSettings.enableVideo).toBe(true);
      expect(result.knownDevices[1].deviceId).toBe('device-2');
    });
  });

  describe('toSettingsDto', () => {
    it('should map PlayerFilterType enum back to API string', () => {
      const domainSettings = createMockDomainSettings({
        startupFilter: PlayerFilterType.Games,
      });
      const result = DomainMapper.toSettingsDto(domainSettings);

      expect(result.playerSettings.startupFilter).toBe('Games');
    });

    it('should preserve all player settings when mapping to DTO', () => {
      const domainSettings = createMockDomainSettings({
        repeatModeOnStartup: true,
        playTimerEnabled: false,
        muteFastForward: true,
        muteRandomSeek: false,
        startupFilter: PlayerFilterType.Music,
        startupLaunchEnabled: true,
        startupLaunchRandom: false,
      });
      const result = DomainMapper.toSettingsDto(domainSettings);

      expect(result.playerSettings.repeatModeOnStartup).toBe(true);
      expect(result.playerSettings.playTimerEnabled).toBe(false);
      expect(result.playerSettings.muteFastForward).toBe(true);
      expect(result.playerSettings.muteRandomSeek).toBe(false);
      expect(result.playerSettings.startupFilter).toBe('Music');
      expect(result.playerSettings.startupLaunchEnabled).toBe(true);
      expect(result.playerSettings.startupLaunchRandom).toBe(false);
    });

    it('should map app settings correctly (inverse setupCompleted)', () => {
      const domainSettings = createMockDomainSettings({ setupCompleted: true });
      const result = DomainMapper.toSettingsDto(domainSettings);
      expect(result.appSettings.firstTimeSetup).toBe(false);
    });

    it('should map video settings to DTO correctly via knownDevices', () => {
      const domainSettings = createMockDomainSettings({ enableVideo: true });
      const result = DomainMapper.toSettingsDto(domainSettings);
      expect(result.knownDevices[0].videoSettings.enableVideo).toBe(true);
    });

    it('should preserve video settings through round-trip transformation', () => {
      const originalSettings = createMockDomainSettings({ enableVideo: true });
      const dto = DomainMapper.toSettingsDto(originalSettings);
      const response: GetSettingsResponse = {
        knownDevices: dto.knownDevices,
        playerSettings: dto.playerSettings,
        fileTransferSettings: dto.fileTransferSettings,
        searchSettings: dto.searchSettings,
        appSettings: dto.appSettings,
      };
      const result = DomainMapper.toSettings(response);

      expect(result.knownDevices[0].videoSettings).toEqual(
        originalSettings.knownDevices[0].videoSettings
      );
      expect(result.knownDevices[0].videoSettings.enableVideo).toBe(true);
    });
  });

  describe('toSettings - AudioSettings Mapping', () => {
    it('should map audioSettings from DTO to domain with all properties', () => {
      const dto = createMockGetSettingsResponse({
        audioSettings: {
          enableAudioStream: true,
          audioDeviceIndex: 2,
          audioDeviceName: 'Microphone (USB)',
          captureChannelCount: 2,
          sampleRate: 44100,
        },
      });
      const result = DomainMapper.toSettings(dto);

      expect(result.knownDevices[0].audioSettings.enableAudioStream).toBe(true);
      expect(result.knownDevices[0].audioSettings.audioDeviceIndex).toBe(2);
      expect(result.knownDevices[0].audioSettings.audioDeviceName).toBe('Microphone (USB)');
      expect(result.knownDevices[0].audioSettings.captureChannelCount).toBe(2);
      expect(result.knownDevices[0].audioSettings.sampleRate).toBe(44100);
    });

    it('should use default values for missing audioSettings properties', () => {
      const dto = createMockGetSettingsResponse({
        audioSettings: {},
      });
      const result = DomainMapper.toSettings(dto);

      expect(result.knownDevices[0].audioSettings.enableAudioStream).toBe(false);
      expect(result.knownDevices[0].audioSettings.audioDeviceIndex).toBe(-1);
      expect(result.knownDevices[0].audioSettings.audioDeviceName).toBe('');
      expect(result.knownDevices[0].audioSettings.captureChannelCount).toBe(1);
      expect(result.knownDevices[0].audioSettings.sampleRate).toBe(48000);
    });

    it('should handle undefined audioSettings with defaults', () => {
      const dto = createMockGetSettingsResponse({
        audioSettings: undefined,
      });
      const result = DomainMapper.toSettings(dto);

      expect(result.knownDevices[0].audioSettings.enableAudioStream).toBe(false);
      expect(result.knownDevices[0].audioSettings.audioDeviceIndex).toBe(-1);
      expect(result.knownDevices[0].audioSettings.audioDeviceName).toBe('');
      expect(result.knownDevices[0].audioSettings.captureChannelCount).toBe(1);
      expect(result.knownDevices[0].audioSettings.sampleRate).toBe(48000);
    });
  });

  describe('toSettingsDto - AudioSettings Mapping', () => {
    it('should map audioSettings from domain to DTO', () => {
      const domainSettings = createMockDomainSettings({
        audioSettings: {
          enableAudioStream: true,
          audioDeviceIndex: 1,
          audioDeviceName: 'Built-in Microphone',
          captureChannelCount: 1,
          sampleRate: 48000,
        },
      });
      const result = DomainMapper.toSettingsDto(domainSettings);

      expect(result.knownDevices[0].audioSettings.enableAudioStream).toBe(true);
      expect(result.knownDevices[0].audioSettings.audioDeviceIndex).toBe(1);
      expect(result.knownDevices[0].audioSettings.audioDeviceName).toBe('Built-in Microphone');
      expect(result.knownDevices[0].audioSettings.captureChannelCount).toBe(1);
      expect(result.knownDevices[0].audioSettings.sampleRate).toBe(48000);
    });
  });

  describe('AudioSettings Round-Trip', () => {
    it('should preserve audioSettings through round-trip transformation', () => {
      const originalSettings = createMockDomainSettings({
        audioSettings: {
          enableAudioStream: true,
          audioDeviceIndex: 3,
          audioDeviceName: 'USB Audio Device',
          captureChannelCount: 2,
          sampleRate: 96000,
        },
      });
      const dto = DomainMapper.toSettingsDto(originalSettings);
      const response: GetSettingsResponse = {
        knownDevices: dto.knownDevices,
        playerSettings: dto.playerSettings,
        fileTransferSettings: dto.fileTransferSettings,
        searchSettings: dto.searchSettings,
        appSettings: dto.appSettings,
      };
      const result = DomainMapper.toSettings(response);

      expect(result.knownDevices[0].audioSettings.enableAudioStream).toBe(true);
      expect(result.knownDevices[0].audioSettings.audioDeviceIndex).toBe(3);
      expect(result.knownDevices[0].audioSettings.audioDeviceName).toBe('USB Audio Device');
      expect(result.knownDevices[0].audioSettings.captureChannelCount).toBe(2);
      expect(result.knownDevices[0].audioSettings.sampleRate).toBe(96000);
    });
  });
});

// Helper functions for settings tests

/** Override options for createMockGetSettingsResponse */
interface MockSettingsOverrides {
  repeatModeOnStartup?: boolean;
  playTimerEnabled?: boolean;
  muteFastForward?: boolean;
  muteRandomSeek?: boolean;
  startupFilter?: string | null;
  startupLaunchEnabled?: boolean;
  startupLaunchRandom?: boolean;
  watchDirectoryLocation?: string;
  autoTransferPath?: string;
  autoFileCopyEnabled?: boolean;
  autoLaunchOnCopyEnabled?: boolean;
  navToDirOnLaunch?: boolean;
  syncFilesEnabled?: boolean;
  firstTimeSetup?: boolean;
  deviceId?: string;
  enableVideo?: boolean;
  videoDeviceId?: string;
  autoConnectEnabled?: boolean;
  connectionType?: string;
  ipAddress?: string;
  tcpPort?: number;
  knownDevices?: Array<{
    deviceId: string;
    videoSettings: { enableVideo: boolean; videoDeviceId: string };
    indexingStatus: { sdLastIndexed: Date | null; usbLastIndexed: Date | null };
    audioSettings: {
      enableAudioStream: boolean;
      audioDeviceIndex: number;
      audioDeviceName: string;
      captureChannelCount: number;
      sampleRate: number;
      channels: Array<{ name: string; sourceChannel: number; enabled: boolean }>;
    };
  }>;
  audioSettings?: Partial<AudioSettingsDto>;
}

function createMockGetSettingsResponse(overrides: MockSettingsOverrides = {}): GetSettingsResponse {
  const playerSettings: PlayerSettingsDto = {
    repeatModeOnStartup: overrides.repeatModeOnStartup ?? false,
    playTimerEnabled: overrides.playTimerEnabled ?? true,
    muteFastForward: overrides.muteFastForward ?? false,
    muteRandomSeek: overrides.muteRandomSeek ?? false,
    startupFilter: (overrides.startupFilter ?? 'All') as ApiFilterType,
    startupLaunchEnabled: overrides.startupLaunchEnabled ?? false,
    startupLaunchRandom: overrides.startupLaunchRandom ?? false,
  };

  const fileTransferSettings: FileTransferSettingsDto = {
    watchDirectoryLocation: overrides.watchDirectoryLocation ?? '',
    autoTransferPath: overrides.autoTransferPath ?? '',
    autoFileCopyEnabled: overrides.autoFileCopyEnabled ?? false,
    autoLaunchOnCopyEnabled: overrides.autoLaunchOnCopyEnabled ?? false,
    navToDirOnLaunch: overrides.navToDirOnLaunch ?? false,
    syncFilesEnabled: overrides.syncFilesEnabled ?? false,
  };

  const searchWeights: SearchWeightsDto = {
    title: 1.0,
    fileName: 1.0,
    filePath: 1.0,
    creator: 1.0,
    description: 1.0,
  };

  const searchSettings: SearchSettingsDto = {
    searchWeights: searchWeights,
    searchStopWords: [],
    bannedDirectories: [],
    bannedFiles: [],
  };

  const appSettings: AppSettingsDto = {
    firstTimeSetup: overrides.firstTimeSetup ?? true,
  };

  // Create knownDevices array with device settings
  const knownDevices = overrides.knownDevices ?? [
    {
      deviceId: overrides.deviceId ?? 'test-device-1',
      videoSettings: {
        enableVideo: overrides.enableVideo ?? false,
        videoDeviceId: overrides.videoDeviceId ?? '',
      },
      indexingStatus: {
        sdLastIndexed: null,
        usbLastIndexed: null,
      },
      audioSettings: {
        enableAudioStream: overrides.audioSettings?.enableAudioStream ?? false,
        audioDeviceIndex: overrides.audioSettings?.audioDeviceIndex ?? -1,
        audioDeviceName: overrides.audioSettings?.audioDeviceName ?? '',
        captureChannelCount: overrides.audioSettings?.captureChannelCount ?? 1,
        channels: overrides.audioSettings?.channels ?? [],
        sampleRate: overrides.audioSettings?.sampleRate ?? 48000,
      },
    },
  ];

  return {
    knownDevices,
    playerSettings,
    fileTransferSettings,
    searchSettings,
    appSettings,
  };
}

/** Override options for createMockDomainSettings */
interface MockDomainSettingsOverrides {
  repeatModeOnStartup?: boolean;
  playTimerEnabled?: boolean;
  muteFastForward?: boolean;
  muteRandomSeek?: boolean;
  startupFilter?: PlayerFilterType;
  startupLaunchEnabled?: boolean;
  startupLaunchRandom?: boolean;
  watchDirectoryLocation?: string;
  autoTransferPath?: string;
  autoFileCopyEnabled?: boolean;
  autoLaunchOnCopyEnabled?: boolean;
  navToDirOnLaunch?: boolean;
  syncFilesEnabled?: boolean;
  setupCompleted?: boolean;
  deviceId?: string;
  enableVideo?: boolean;
  videoDeviceId?: string;
  knownDevices?: Settings['knownDevices'];
  audioSettings?: AudioSettings;
}

function createMockDomainSettings(overrides: MockDomainSettingsOverrides = {}): Settings {
  return {
    playerSettings: {
      repeatModeOnStartup: overrides.repeatModeOnStartup ?? false,
      playTimerEnabled: overrides.playTimerEnabled ?? true,
      muteFastForward: overrides.muteFastForward ?? false,
      muteRandomSeek: overrides.muteRandomSeek ?? false,
      startupFilter: overrides.startupFilter ?? PlayerFilterType.All,
      startupLaunchEnabled: overrides.startupLaunchEnabled ?? false,
      startupLaunchRandom: overrides.startupLaunchRandom ?? false,
    },
    fileTransferSettings: {
      watchDirectoryLocation: overrides.watchDirectoryLocation ?? '',
      autoTransferPath: overrides.autoTransferPath ?? '',
      autoFileCopyEnabled: overrides.autoFileCopyEnabled ?? false,
      autoLaunchOnCopyEnabled: overrides.autoLaunchOnCopyEnabled ?? false,
      navToDirOnLaunch: overrides.navToDirOnLaunch ?? false,
      syncFilesEnabled: overrides.syncFilesEnabled ?? false,
    },
    searchSettings: {
      weights: {
        nameWeight: 1.0,
        titleWeight: 1.0,
        creatorWeight: 1.0,
        releaseInfoWeight: 1.0,
        descriptionWeight: 1.0,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: {
      setupCompleted: overrides.setupCompleted ?? false,
    },
    knownDevices: overrides.knownDevices ?? [
      {
        deviceId: overrides.deviceId ?? 'test-device-1',
        videoSettings: {
          enableVideo: overrides.enableVideo ?? false,
          videoDeviceId: overrides.videoDeviceId ?? '',
        },
        audioSettings: overrides.audioSettings ?? {
          enableAudioStream: false,
          audioDeviceIndex: -1,
          audioDeviceName: '',
          captureChannelCount: 1,
          channels: [],
          sampleRate: 48000,
        },
      },
    ],
  };
}
