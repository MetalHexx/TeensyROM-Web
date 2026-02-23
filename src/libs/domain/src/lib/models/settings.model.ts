import { PlayerFilterType } from './player-filter-type.enum';

/**
 * RepeatMode type representing music playback repeat options
 */
export type RepeatMode = 'Off' | 'Single' | 'All';

/**
 * Search weight configuration for content search
 */
export interface SearchWeights {
  /** Weight for file name matches */
  nameWeight: number;
  /** Weight for title matches */
  titleWeight: number;
  /** Weight for creator/author matches */
  creatorWeight: number;
  /** Weight for release information matches */
  releaseInfoWeight: number;
  /** Weight for description matches */
  descriptionWeight: number;
}

/**
 * Search-related settings for content discovery
 */
export interface SearchSettings {
  /** Weight configuration for different search criteria */
  weights: SearchWeights;
  /** List of words to exclude from search processing */
  stopWords: string[];
  /** List of directories to exclude from search */
  bannedDirectories: string[];
  /** List of files to exclude from search */
  bannedFiles: string[];
}

/**
 * File transfer and watch folder settings
 */
export interface FileTransferSettings {
  /** Directory location to watch for file changes */
  watchDirectoryLocation: string;
  /** Path where files should be auto-transferred */
  autoTransferPath: string;
  /** Whether automatic file copying is enabled */
  autoFileCopyEnabled: boolean;
  /** Whether to auto-launch files after copying */
  autoLaunchOnCopyEnabled: boolean;
  /** Whether to navigate to directory on launch */
  navToDirOnLaunch: boolean;
  /** Whether file synchronization is enabled */
  syncFilesEnabled: boolean;
}

/**
 * Player behavior and startup settings
 */
export interface PlayerSettings {
  /** Whether repeat mode is enabled on startup */
  repeatModeOnStartup: boolean;
  /** Whether play timer is enabled */
  playTimerEnabled: boolean;
  /** Whether to mute audio during fast forward */
  muteFastForward: boolean;
  /** Whether to mute audio during random seek */
  muteRandomSeek: boolean;
  /** Filter type to apply on startup */
  startupFilter: PlayerFilterType;
  /** Whether to launch a file on startup */
  startupLaunchEnabled: boolean;
  /** Whether to launch a random file on startup */
  startupLaunchRandom: boolean;
}

/**
 * Video settings for video capture component in player view
 */
export interface VideoSettings {
  /** Enable video capture component visibility in player view */
  enableVideo: boolean;
  /** Video capture device identifier */
  videoDeviceId: string;
}

/**
 * Configuration for a single audio channel in a multi-channel audio stream.
 * Each channel can be independently enabled/disabled and mapped to a source channel.
 */
export interface ChannelConfig {
  /** The 0-based index of the source channel in the interleaved PCM input */
  sourceChannel: number;
  /** Whether this channel should be included in the audio stream */
  enabled: boolean;
}

/**
 * Audio streaming capture and encoding settings
 */
export interface AudioSettings {
  /** Enable audio streaming from the host audio device */
  enableAudioStream: boolean;
  /** Audio input device index (-1 = auto-select) */
  audioDeviceIndex: number;
  /** Audio input device name */
  audioDeviceName: string;
  /** Number of channels to capture from hardware (1 = mono, 2 = stereo) */
  captureChannelCount: number;
  /** Sample rate for audio capture in Hz */
  sampleRate: number;
  /** Per-channel configuration for multi-channel audio streaming */
  channels: ChannelConfig[];
}

/**
 * Application-level settings
 */
export interface AppSettings {
  /** Whether initial setup has been completed */
  setupCompleted: boolean;
}

/**
 * Per-device settings containing video and audio configuration
 */
export interface DeviceSettings {
  /** Unique device identifier */
  deviceId: string;
  /** Video settings for this device */
  videoSettings: VideoSettings;
  /** Audio streaming settings for this device */
  audioSettings: AudioSettings;
}

/**
 * Root settings object containing all configuration categories
 */
export interface Settings {
  /** Player-related settings */
  playerSettings: PlayerSettings;
  /** File transfer and watch folder settings */
  fileTransferSettings: FileTransferSettings;
  /** Search configuration settings */
  searchSettings: SearchSettings;
  /** Application-level settings */
  appSettings: AppSettings;
  /** Per-device settings for all known devices */
  knownDevices: DeviceSettings[];
}
