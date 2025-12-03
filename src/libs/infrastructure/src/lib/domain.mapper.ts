import {
  CartDto,
  CartStorageDto,
  StorageCacheDto,
  DirectoryItemDto,
  FileItemDto,
  ViewableItemImageDto,
  FileItemType as ApiFileItemType,
  TeensyStorageType as ApiStorageType,
  LaunchRandomScopeEnum,
  NullableOfTeensyFilterType,
  YouTubeVideoDto,
  CompetitionDto,
  FileLinkDto,
  FileTagDto,
  GetSettingsResponse,
  SaveSettingsRequest,
  ConnectionSettingsDto,
  PlayerSettingsDto,
  VideoSettingsDto,
  FileTransferSettingsDto,
  SearchSettingsDto,
  SearchWeightsDto,
  AppSettingsDto,
  DeviceSettingsDto,
} from '@teensyrom-nx/data-access/api-client';
import { DeviceState as ApiDeviceState } from '@teensyrom-nx/data-access/api-client';
import {
  Device,
  DeviceStorage,
  DeviceState,
  StorageType,
  StorageDirectory,
  DirectoryItem,
  FileItem,
  ViewableItemImage,
  FileItemType,
  PlayerFilterType,
  PlayerScope,
  FileLink,
  FileTag,
  YouTubeVideo,
  Competition,
  Settings,
  ConnectionSettings,
  PlayerSettings,
  VideoSettings,
  FileTransferSettings,
  SearchSettings,
  SearchWeights,
  AppSettings,
  ConnectionType,
  DeviceSettings,
} from '@teensyrom-nx/domain';

/**
 * Centralized mapper for all domain model transformations.
 * Contains mapping logic for Device, Storage, and shared models.
 */
export class DomainMapper {
  // ===== DEVICE MAPPING =====

  static toDevice(cartDto: CartDto): Device {
    if (!cartDto) {
      return {} as Device;
    }

    return {
      deviceId: cartDto.deviceId,
      comPort: cartDto.comPort,
      name: cartDto.name,
      fwVersion: cartDto.fwVersion,
      isCompatible: cartDto.isCompatible,
      isConnected: cartDto.isConnected,
      deviceState: this.mapDeviceState(cartDto.deviceState),
      sdStorage: this.toDeviceStorage(cartDto.sdStorage),
      usbStorage: this.toDeviceStorage(cartDto.usbStorage),
    };
  }

  static toDeviceStorage(storageDto: CartStorageDto): DeviceStorage {
    return {
      deviceId: storageDto.deviceId,
      type: this.toDomainStorageType(storageDto.type),
      available: storageDto.available,
    };
  }

  static toDeviceList(cartDtos: CartDto[]): Device[] {
    return cartDtos.map((cart) => this.toDevice(cart));
  }

  private static mapDeviceState(apiState: ApiDeviceState): DeviceState {
    // Both enums have the same values, so we can safely cast
    return apiState as unknown as DeviceState;
  }

  // ===== STORAGE MAPPING =====

  static toStorageDirectory(
    storageCacheDto: StorageCacheDto,
    baseApiUrl: string
  ): StorageDirectory {
    if (!storageCacheDto) {
      throw new Error('StorageCacheDto is required for transformation');
    }

    return {
      directories: storageCacheDto.directories?.map(DomainMapper.toDirectoryItem) ?? [],
      files: storageCacheDto.files?.map((file) => DomainMapper.toFileItem(file, baseApiUrl)) ?? [],
      path: storageCacheDto.path ?? '',
    };
  }

  static toDirectoryItem(directoryItemDto: DirectoryItemDto): DirectoryItem {
    if (!directoryItemDto) {
      throw new Error('DirectoryItemDto is required for transformation');
    }

    return {
      name: directoryItemDto.name ?? '',
      path: directoryItemDto.path ?? '',
    };
  }

  static toFileItem(fileItemDto: FileItemDto, baseApiUrl: string): FileItem {
    if (!fileItemDto) {
      throw new Error('FileItemDto is required for transformation');
    }

    return {
      name: fileItemDto.name ?? '',
      path: fileItemDto.path ?? '',
      size: fileItemDto.size ?? 0,
      isFavorite: fileItemDto.isFavorite ?? false,
      isCompatible: fileItemDto.isCompatible ?? true,
      title: fileItemDto.title ?? '',
      creator: fileItemDto.creator ?? '',
      releaseInfo: fileItemDto.releaseInfo ?? '',
      description: fileItemDto.description ?? '',
      shareUrl: fileItemDto.shareUrl ?? '',
      metadataSource: fileItemDto.metadataSource ?? '',
      meta1: fileItemDto.meta1 ?? '',
      meta2: fileItemDto.meta2 ?? '',
      metadataSourcePath: fileItemDto.metadataSourcePath ?? '',
      parentPath: fileItemDto.parentPath ?? '',
      playLength: fileItemDto.playLength ?? '',
      subtuneLengths: fileItemDto.subtuneLengths ?? [],
      startSubtuneNum: fileItemDto.startSubtuneNum ?? 0,
      images:
        fileItemDto.images?.map((img) => DomainMapper.toViewableItemImage(img, baseApiUrl)) ?? [],
      type: DomainMapper.toFileItemType(fileItemDto.type),
      links: fileItemDto.links?.map(DomainMapper.toFileLink) ?? [],
      tags: fileItemDto.tags?.map(DomainMapper.toFileTag) ?? [],
      youTubeVideos: fileItemDto.youTubeVideos?.map(DomainMapper.toYouTubeVideo) ?? [],
      competitions: fileItemDto.competitions?.map(DomainMapper.toCompetition) ?? [],
      avgRating: fileItemDto.avgRating ?? undefined,
      ratingCount: fileItemDto.ratingCount ?? 0,
    };
  }

  static toViewableItemImage(
    viewableItemImageDto: ViewableItemImageDto,
    baseApiUrl: string
  ): ViewableItemImage {
    if (!viewableItemImageDto) {
      throw new Error('ViewableItemImageDto is required for transformation');
    }

    const baseAssetPath = viewableItemImageDto.baseAssetPath ?? '';
    const url = baseAssetPath ? `${baseApiUrl}${baseAssetPath}` : '';

    return {
      fileName: viewableItemImageDto.fileName ?? '',
      path: viewableItemImageDto.path ?? '',
      source: viewableItemImageDto.source ?? '',
      url,
    };
  }

  // ===== SHARED TYPE MAPPING =====

  static toFileItemType(apiFileItemType: ApiFileItemType): FileItemType {
    switch (apiFileItemType) {
      case ApiFileItemType.Song:
        return FileItemType.Song;
      case ApiFileItemType.Game:
        return FileItemType.Game;
      case ApiFileItemType.Image:
        return FileItemType.Image;
      case ApiFileItemType.Hex:
        return FileItemType.Hex;
      case ApiFileItemType.Unknown:
      default:
        return FileItemType.Unknown;
    }
  }

  /**
   * Convert domain StorageType to API TeensyStorageType
   */
  static toApiStorageType(domainType: StorageType): ApiStorageType {
    switch (domainType) {
      case StorageType.Sd:
        return ApiStorageType.Sd;
      case StorageType.Usb:
        return ApiStorageType.Usb;
      default:
        throw new Error(`Unknown storage type: ${domainType}`);
    }
  }

  /**
   * Convert API TeensyStorageType to domain StorageType
   */
  static toDomainStorageType(apiType: ApiStorageType): StorageType {
    switch (apiType) {
      case ApiStorageType.Sd:
        return StorageType.Sd;
      case ApiStorageType.Usb:
        return StorageType.Usb;
      default:
        throw new Error(`Unknown API storage type: ${apiType}`);
    }
  }

  // ===== PLAYER MAPPING =====

  /**
   * Convert domain PlayerScope to API LaunchRandomScopeEnum
   */
  static toApiPlayerScope(scope: PlayerScope): LaunchRandomScopeEnum {
    switch (scope) {
      case PlayerScope.Storage:
        return LaunchRandomScopeEnum.Storage;
      case PlayerScope.DirectoryDeep:
        return LaunchRandomScopeEnum.DirDeep;
      case PlayerScope.DirectoryShallow:
        return LaunchRandomScopeEnum.DirShallow;
      default:
        return LaunchRandomScopeEnum.Storage;
    }
  }

  /**
   * Convert domain PlayerFilterType to API NullableOfTeensyFilterType
   * Used for both player random launch and search operations
   */
  static toApiPlayerFilter(filter: PlayerFilterType): NullableOfTeensyFilterType {
    switch (filter) {
      case PlayerFilterType.All:
        return NullableOfTeensyFilterType.All;
      case PlayerFilterType.Games:
        return NullableOfTeensyFilterType.Games;
      case PlayerFilterType.Music:
        return NullableOfTeensyFilterType.Music;
      case PlayerFilterType.Images:
        return NullableOfTeensyFilterType.Images;
      case PlayerFilterType.Hex:
        return NullableOfTeensyFilterType.Hex;
      default:
        return NullableOfTeensyFilterType.All;
    }
  }

  /**
   * Convert domain PlayerFilterType to API NullableOfTeensyFilterType for search operations
   * Alias for toApiPlayerFilter to maintain semantic clarity in search context
   */
  static toApiSearchFilter(filter: PlayerFilterType): NullableOfTeensyFilterType {
    return DomainMapper.toApiPlayerFilter(filter);
  }

  // ===== NEW MAPPING METHODS =====

  /**
   * Convert API FileLink DTO to domain FileLink
   */
  static toFileLink(dto: FileLinkDto): FileLink {
    return {
      name: dto.name ?? '',
      url: dto.url ?? '',
    };
  }

  /**
   * Convert API FileTag DTO to domain FileTag
   */
  static toFileTag(dto: FileTagDto): FileTag {
    return {
      name: dto.name ?? '',
      type: dto.type ?? '',
    };
  }

  /**
   * Convert API YouTubeVideo DTO to domain YouTubeVideo
   */
  static toYouTubeVideo(dto: YouTubeVideoDto): YouTubeVideo {
    return {
      videoId: dto.videoId ?? '',
      url: dto.url ?? '',
      channel: dto.channel ?? '',
      subtune: dto.subtune ?? 0,
    };
  }

  /**
   * Convert API Competition DTO to domain Competition
   */
  static toCompetition(dto: CompetitionDto): Competition {
    return {
      name: dto.name ?? '',
      place: dto.place ?? undefined,
    };
  }

  // ===== SETTINGS MAPPING =====

  /**
   * Maps API filter string to domain PlayerFilterType enum
   * Case-insensitive with fallback to 'All' for unrecognized values
   */
  private static toPlayerFilterType(apiFilter: string): PlayerFilterType {
    const normalized = apiFilter?.toUpperCase() ?? '';

    switch (normalized) {
      case 'ALL':
        return PlayerFilterType.All;
      case 'GAMES':
        return PlayerFilterType.Games;
      case 'MUSIC':
        return PlayerFilterType.Music;
      case 'HEX':
        return PlayerFilterType.Hex;
      case 'IMAGES':
        return PlayerFilterType.Images;
      default:
        return PlayerFilterType.All;
    }
  }

  /**
   * Maps API DTO to domain Settings model
   */
  static toSettings(dto: GetSettingsResponse): Settings {
    return {
      playerSettings: this.toPlayerSettings(dto.playerSettings),
      fileTransferSettings: this.toFileTransferSettings(dto.fileTransferSettings),
      searchSettings: this.toSearchSettings(dto.searchSettings),
      appSettings: this.toAppSettings(dto.appSettings),
      knownDevices: this.toKnownDevices(dto.knownDevices),
    };
  }

  /**
   * Maps array of DeviceSettingsDto to domain DeviceSettings array
   */
  private static toKnownDevices(dtos: DeviceSettingsDto[]): DeviceSettings[] {
    return dtos?.map((d) => this.toDeviceSettings(d)) ?? [];
  }

  /**
   * Maps DeviceSettingsDto to domain DeviceSettings
   */
  private static toDeviceSettings(dto: DeviceSettingsDto): DeviceSettings {
    return {
      deviceId: dto.deviceId,
      videoSettings: this.toVideoSettings(dto.videoSettings),
      connectionSettings: this.toConnectionSettings(dto.connectionSettings),
    };
  }

  /**
   * Maps domain Settings to API DTO (SaveSettingsRequest)
   */
  static toSettingsDto(settings: Settings): SaveSettingsRequest {
    return {
      playerSettings: this.toPlayerSettingsDto(settings.playerSettings),
      fileTransferSettings: this.toFileTransferSettingsDto(settings.fileTransferSettings),
      searchSettings: this.toSearchSettingsDto(settings.searchSettings),
      appSettings: this.toAppSettingsDto(settings.appSettings),
      knownDevices: this.toKnownDevicesDto(settings.knownDevices),
    };
  }

  /**
   * Maps array of domain DeviceSettings to DeviceSettingsDto array
   */
  private static toKnownDevicesDto(devices: DeviceSettings[]): DeviceSettingsDto[] {
    return devices?.map((d) => this.toDeviceSettingsDto(d)) ?? [];
  }

  /**
   * Maps domain DeviceSettings to DeviceSettingsDto
   */
  private static toDeviceSettingsDto(settings: DeviceSettings): DeviceSettingsDto {
    return {
      deviceId: settings.deviceId,
      videoSettings: this.toVideoSettingsDto(settings.videoSettings),
      connectionSettings: this.toConnectionSettingsDto(settings.connectionSettings),
    };
  }

  private static toConnectionSettings(dto: ConnectionSettingsDto): ConnectionSettings {
    return {
      connectionType: dto.connectionType as ConnectionType,
      autoConnectEnabled: dto.autoConnectEnabled,
    };
  }

  private static toConnectionSettingsDto(settings: ConnectionSettings): ConnectionSettingsDto {
    return {
      connectionType: settings.connectionType,
      autoConnectEnabled: settings.autoConnectEnabled,
    };
  }

  private static toPlayerSettings(dto: PlayerSettingsDto): PlayerSettings {
    return {
      repeatModeOnStartup: dto.repeatModeOnStartup,
      playTimerEnabled: dto.playTimerEnabled,
      muteFastForward: dto.muteFastForward,
      muteRandomSeek: dto.muteRandomSeek,
      startupFilter: this.toPlayerFilterType(dto.startupFilter as string),
      startupLaunchEnabled: dto.startupLaunchEnabled,
      startupLaunchRandom: dto.startupLaunchRandom,
    };
  }

  private static toPlayerSettingsDto(settings: PlayerSettings): PlayerSettingsDto {
    // Convert PlayerFilterType enum back to TeensyFilterType string
    const filterMap: Record<PlayerFilterType, NullableOfTeensyFilterType> = {
      [PlayerFilterType.All]: NullableOfTeensyFilterType.All,
      [PlayerFilterType.Games]: NullableOfTeensyFilterType.Games,
      [PlayerFilterType.Music]: NullableOfTeensyFilterType.Music,
      [PlayerFilterType.Hex]: NullableOfTeensyFilterType.Hex,
      [PlayerFilterType.Images]: NullableOfTeensyFilterType.Images,
    };

    return {
      repeatModeOnStartup: settings.repeatModeOnStartup,
      playTimerEnabled: settings.playTimerEnabled,
      muteFastForward: settings.muteFastForward,
      muteRandomSeek: settings.muteRandomSeek,
      startupFilter: filterMap[settings.startupFilter],
      startupLaunchEnabled: settings.startupLaunchEnabled,
      startupLaunchRandom: settings.startupLaunchRandom,
    };
  }

  /**
   * Maps VideoSettingsDto from API to domain VideoSettings model
   * @param dto - VideoSettingsDto from API response
   * @returns VideoSettings domain model
   */
  private static toVideoSettings(dto: VideoSettingsDto): VideoSettings {
    return {
      enableVideo: dto.enableVideo,
      videoDeviceId: dto.videoDeviceId ?? '',
    };
  }

  /**
   * Maps VideoSettings domain model to VideoSettingsDto for API request
   * @param settings - VideoSettings domain model
   * @returns VideoSettingsDto for API
   */
  private static toVideoSettingsDto(settings: VideoSettings): VideoSettingsDto {
    return {
      enableVideo: settings.enableVideo,
      videoDeviceId: settings.videoDeviceId ?? '',
    };
  }

  private static toFileTransferSettings(dto: FileTransferSettingsDto): FileTransferSettings {
    return {
      watchDirectoryLocation: dto.watchDirectoryLocation,
      autoTransferPath: dto.autoTransferPath,
      autoFileCopyEnabled: dto.autoFileCopyEnabled,
      autoLaunchOnCopyEnabled: dto.autoLaunchOnCopyEnabled,
      navToDirOnLaunch: dto.navToDirOnLaunch,
      syncFilesEnabled: dto.syncFilesEnabled,
    };
  }

  private static toFileTransferSettingsDto(
    settings: FileTransferSettings
  ): FileTransferSettingsDto {
    return {
      watchDirectoryLocation: settings.watchDirectoryLocation,
      autoTransferPath: settings.autoTransferPath,
      autoFileCopyEnabled: settings.autoFileCopyEnabled,
      autoLaunchOnCopyEnabled: settings.autoLaunchOnCopyEnabled,
      navToDirOnLaunch: settings.navToDirOnLaunch,
      syncFilesEnabled: settings.syncFilesEnabled,
    };
  }

  private static toSearchSettings(dto: SearchSettingsDto): SearchSettings {
    return {
      weights: this.toSearchWeights(dto.searchWeights),
      stopWords: dto.searchStopWords,
      bannedDirectories: dto.bannedDirectories,
      bannedFiles: dto.bannedFiles,
    };
  }

  private static toSearchSettingsDto(settings: SearchSettings): SearchSettingsDto {
    return {
      searchWeights: this.toSearchWeightsDto(settings.weights),
      searchStopWords: settings.stopWords,
      bannedDirectories: settings.bannedDirectories,
      bannedFiles: settings.bannedFiles,
    };
  }

  private static toSearchWeights(dto: SearchWeightsDto): SearchWeights {
    return {
      nameWeight: dto.fileName,
      titleWeight: dto.title,
      creatorWeight: dto.creator,
      releaseInfoWeight: dto.filePath,
      descriptionWeight: dto.description,
    };
  }

  private static toSearchWeightsDto(weights: SearchWeights): SearchWeightsDto {
    return {
      title: weights.titleWeight,
      fileName: weights.nameWeight,
      filePath: weights.releaseInfoWeight,
      creator: weights.creatorWeight,
      description: weights.descriptionWeight,
    };
  }

  private static toAppSettings(dto: AppSettingsDto): AppSettings {
    return {
      setupCompleted: !dto.firstTimeSetup,
    };
  }

  private static toAppSettingsDto(settings: AppSettings): AppSettingsDto {
    return {
      firstTimeSetup: !settings.setupCompleted,
    };
  }
}
