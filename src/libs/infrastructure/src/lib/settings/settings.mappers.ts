import {
  GetSettingsResponse,
  SaveSettingsRequest,
  PlayerSettingsDto,
  FileTransferSettingsDto,
  SearchSettingsDto,
  SearchWeightsDto,
  AppSettingsDto,
} from '@teensyrom-nx/data-access/api-client';
import {
  Settings,
  PlayerSettings,
  FileTransferSettings,
  SearchSettings,
  SearchWeights,
  AppSettings,
  StartupFilterType,
} from '@teensyrom-nx/domain';

/**
 * Maps API DTO to domain Settings model
 * @param dto - GetSettingsResponse from API
 * @returns Domain Settings object
 */
export function mapSettingsDtoToDomain(dto: GetSettingsResponse): Settings {
  return {
    playerSettings: mapPlayerSettingsDtoToDomain(dto.playerSettings),
    fileTransferSettings: mapFileTransferSettingsDtoToDomain(dto.fileTransferSettings),
    searchSettings: mapSearchSettingsDtoToDomain(dto.searchSettings),
    appSettings: mapAppSettingsDtoToDomain(dto.appSettings),
  };
}

/**
 * Maps domain Settings to API DTO (SaveSettingsRequest)
 * Note: SaveSettingsRequest includes connectionSettings which GetSettingsResponse doesn't have.
 * This mapper focuses on the fields we have in domain Settings.
 * @param settings - Domain Settings object
 * @returns SaveSettingsRequest DTO for API
 */
export function mapSettingsDomainToDto(
  settings: Settings
): Omit<SaveSettingsRequest, 'connectionSettings'> {
  return {
    playerSettings: mapPlayerSettingsDomainToDto(settings.playerSettings),
    fileTransferSettings: mapFileTransferSettingsDomainToDto(settings.fileTransferSettings),
    searchSettings: mapSearchSettingsDomainToDto(settings.searchSettings),
    appSettings: mapAppSettingsDomainToDto(settings.appSettings),
  };
}

/**
 * Maps PlayerSettings DTO to domain model (1:1 field mapping)
 */
function mapPlayerSettingsDtoToDomain(dto: PlayerSettingsDto): PlayerSettings {
  return {
    repeatModeOnStartup: dto.repeatModeOnStartup,
    playTimerEnabled: dto.playTimerEnabled,
    muteFastForward: dto.muteFastForward,
    muteRandomSeek: dto.muteRandomSeek,
    startupFilter: dto.startupFilter as StartupFilterType,
    startupLaunchEnabled: dto.startupLaunchEnabled,
    startupLaunchRandom: dto.startupLaunchRandom,
  };
}

/**
 * Maps domain PlayerSettings to DTO (1:1 field mapping)
 */
function mapPlayerSettingsDomainToDto(settings: PlayerSettings): PlayerSettingsDto {
  return {
    repeatModeOnStartup: settings.repeatModeOnStartup,
    playTimerEnabled: settings.playTimerEnabled,
    muteFastForward: settings.muteFastForward,
    muteRandomSeek: settings.muteRandomSeek,
    startupFilter: settings.startupFilter,
    startupLaunchEnabled: settings.startupLaunchEnabled,
    startupLaunchRandom: settings.startupLaunchRandom,
  };
}

/**
 * Maps FileTransferSettings DTO to domain model (1:1 field mapping)
 */
function mapFileTransferSettingsDtoToDomain(dto: FileTransferSettingsDto): FileTransferSettings {
  return {
    watchDirectoryLocation: dto.watchDirectoryLocation,
    autoTransferPath: dto.autoTransferPath,
    autoFileCopyEnabled: dto.autoFileCopyEnabled,
    autoLaunchOnCopyEnabled: dto.autoLaunchOnCopyEnabled,
    navToDirOnLaunch: dto.navToDirOnLaunch,
    syncFilesEnabled: dto.syncFilesEnabled,
  };
}

/**
 * Maps domain FileTransferSettings to DTO (1:1 field mapping)
 */
function mapFileTransferSettingsDomainToDto(
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

/**
 * Maps SearchSettings DTO to domain model (1:1 field mapping)
 */
function mapSearchSettingsDtoToDomain(dto: SearchSettingsDto): SearchSettings {
  return {
    weights: mapSearchWeightsDtoToDomain(dto.searchWeights),
    stopWords: dto.searchStopWords,
    bannedDirectories: dto.bannedDirectories,
    bannedFiles: dto.bannedFiles,
  };
}

/**
 * Maps domain SearchSettings to DTO (1:1 field mapping)
 */
function mapSearchSettingsDomainToDto(settings: SearchSettings): SearchSettingsDto {
  return {
    searchWeights: mapSearchWeightsDomainToDto(settings.weights),
    searchStopWords: settings.stopWords,
    bannedDirectories: settings.bannedDirectories,
    bannedFiles: settings.bannedFiles,
  };
}

/**
 * Maps SearchWeights DTO to domain model (1:1 field mapping)
 */
function mapSearchWeightsDtoToDomain(dto: SearchWeightsDto): SearchWeights {
  return {
    nameWeight: dto.fileName,
    titleWeight: dto.title,
    creatorWeight: dto.creator,
    releaseInfoWeight: dto.filePath,
    descriptionWeight: dto.description,
  };
}

/**
 * Maps domain SearchWeights to DTO (1:1 field mapping)
 */
function mapSearchWeightsDomainToDto(weights: SearchWeights): SearchWeightsDto {
  return {
    title: weights.titleWeight,
    fileName: weights.nameWeight,
    filePath: weights.releaseInfoWeight,
    creator: weights.creatorWeight,
    description: weights.descriptionWeight,
  };
}

/**
 * Maps AppSettings DTO to domain model (inverse logic for firstTimeSetup)
 */
function mapAppSettingsDtoToDomain(dto: AppSettingsDto): AppSettings {
  return {
    setupCompleted: !dto.firstTimeSetup,
  };
}

/**
 * Maps domain AppSettings to DTO (inverse logic for setupCompleted)
 */
function mapAppSettingsDomainToDto(settings: AppSettings): AppSettingsDto {
  return {
    firstTimeSetup: !settings.setupCompleted,
  };
}
