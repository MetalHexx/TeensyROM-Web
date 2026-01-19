import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { SettingsStore } from '../settings-store';
import { SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { ISettingsService } from '@teensyrom-nx/domain';
import { DeviceSettings, PlayerFilterType, Settings } from '@teensyrom-nx/domain';

describe('selectVideoDeviceForDevice', () => {
  let store: InstanceType<typeof SettingsStore>;
  let mockSettingsService: ISettingsService;

  const createMockSettings = (devices: DeviceSettings[] = []): Settings => ({
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: false,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: PlayerFilterType.All,
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    fileTransferSettings: {
      watchDirectoryLocation: '',
      autoTransferPath: '',
      autoFileCopyEnabled: false,
      autoLaunchOnCopyEnabled: false,
      navToDirOnLaunch: false,
      syncFilesEnabled: false,
    },
    searchSettings: {
      weights: {
        nameWeight: 1,
        titleWeight: 1,
        creatorWeight: 1,
        releaseInfoWeight: 1,
        descriptionWeight: 1,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: {
      setupCompleted: false,
    },
    knownDevices: devices,
  });

  const createMockDevice = (deviceId: string, videoDeviceId: string): DeviceSettings => ({
    deviceId,
    videoSettings: {
      enableVideo: true,
      videoDeviceId,
    },
    connectionSettings: {
      autoConnectEnabled: true,
    },
  });

  beforeEach(() => {
    mockSettingsService = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [SettingsStore, { provide: SETTINGS_SERVICE, useValue: mockSettingsService }],
    });

    store = TestBed.inject(SettingsStore);
  });

  it('should return empty string when settings not loaded (safe default)', () => {
    const videoDeviceIdForDevice = store.videoDeviceIdForDevice('device-1');
    expect(videoDeviceIdForDevice()).toBe('');
  });

  it('should return empty string when knownDevices is empty (safe default)', async () => {
    const mockSettings = createMockSettings([]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const videoDeviceIdForDevice = store.videoDeviceIdForDevice('device-1');
    expect(videoDeviceIdForDevice()).toBe('');
  });

  it('should return empty string when device not found', async () => {
    const device = createMockDevice('device-1', 'cam-123');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const videoDeviceIdForDevice = store.videoDeviceIdForDevice('non-existent-device');
    expect(videoDeviceIdForDevice()).toBe('');
  });

  it('should return empty string when videoDeviceId is not set', async () => {
    const device = createMockDevice('device-1', '');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const videoDeviceIdForDevice = store.videoDeviceIdForDevice('device-1');
    expect(videoDeviceIdForDevice()).toBe('');
  });

  it('should return stored videoDeviceId when set', async () => {
    const device = createMockDevice('device-1', 'cam-abc-123');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const videoDeviceIdForDevice = store.videoDeviceIdForDevice('device-1');
    expect(videoDeviceIdForDevice()).toBe('cam-abc-123');
  });

  it('should return correct videoDeviceId for specific device among multiple devices', async () => {
    const device1 = createMockDevice('device-1', 'cam-111');
    const device2 = createMockDevice('device-2', 'cam-222');
    const device3 = createMockDevice('device-3', 'cam-333');
    const mockSettings = createMockSettings([device1, device2, device3]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    expect(store.videoDeviceIdForDevice('device-1')()).toBe('cam-111');
    expect(store.videoDeviceIdForDevice('device-2')()).toBe('cam-222');
    expect(store.videoDeviceIdForDevice('device-3')()).toBe('cam-333');
  });

  it('should reactively update when settings change', async () => {
    // Start with empty videoDeviceId
    const device = createMockDevice('device-1', '');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const videoDeviceIdForDevice = store.videoDeviceIdForDevice('device-1');
    expect(videoDeviceIdForDevice()).toBe('');

    // Update device settings using updateSettings action
    const updatedDevice = createMockDevice('device-1', 'new-cam-456');
    store.updateSettings({ settings: { knownDevices: [updatedDevice] } });

    // Should return the new value
    expect(videoDeviceIdForDevice()).toBe('new-cam-456');
  });
});
