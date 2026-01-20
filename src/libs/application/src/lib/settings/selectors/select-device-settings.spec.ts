import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { SettingsStore } from '../settings-store';
import { PlayerFilterType, SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { ISettingsService } from '@teensyrom-nx/domain';
import { DeviceSettings, Settings } from '@teensyrom-nx/domain';

describe('selectDeviceSettings', () => {
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

  const createMockDevice = (deviceId: string, enableVideo = false): DeviceSettings => ({
    deviceId,
    videoSettings: {
      enableVideo,
      videoDeviceId: '',
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

  it('should return null when settings not loaded', () => {
    const getDeviceSettings = store.getDeviceSettings('device-1');
    expect(getDeviceSettings()).toBeNull();
  });

  it('should return null when knownDevices is empty', async () => {
    const mockSettings = createMockSettings([]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const getDeviceSettings = store.getDeviceSettings('device-1');
    expect(getDeviceSettings()).toBeNull();
  });

  it('should return correct device when ID matches', async () => {
    const device1 = createMockDevice('device-1', true);
    const device2 = createMockDevice('device-2', false);
    const mockSettings = createMockSettings([device1, device2]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const getDevice1 = store.getDeviceSettings('device-1');
    const getDevice2 = store.getDeviceSettings('device-2');

    expect(getDevice1()).toEqual(device1);
    expect(getDevice2()).toEqual(device2);
  });

  it('should return null for unknown device ID', async () => {
    const device1 = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device1]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const getDeviceSettings = store.getDeviceSettings('unknown-device');
    expect(getDeviceSettings()).toBeNull();
  });

  it('should reactively update when device settings change', async () => {
    const device1 = createMockDevice('device-1', false);
    const mockSettings = createMockSettings([device1]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const getDeviceSettings = store.getDeviceSettings('device-1');

    expect(getDeviceSettings()?.videoSettings.enableVideo).toBe(false);

    // Update device settings
    const updatedDevice = { ...device1, videoSettings: { ...device1.videoSettings, enableVideo: true } };
    store.updateSettings({ settings: { knownDevices: [updatedDevice] } });

    expect(getDeviceSettings()?.videoSettings.enableVideo).toBe(true);
  });

  it('should handle multiple devices correctly', async () => {
    const devices = [
      createMockDevice('device-1', true),
      createMockDevice('device-2', false),
      createMockDevice('device-3', true),
    ];
    const mockSettings = createMockSettings(devices);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const getDevice1 = store.getDeviceSettings('device-1');
    const getDevice2 = store.getDeviceSettings('device-2');
    const getDevice3 = store.getDeviceSettings('device-3');

    expect(getDevice1()?.deviceId).toBe('device-1');
    expect(getDevice2()?.deviceId).toBe('device-2');
    expect(getDevice3()?.deviceId).toBe('device-3');
    expect(getDevice1()?.videoSettings.enableVideo).toBe(true);
    expect(getDevice2()?.videoSettings.enableVideo).toBe(false);
    expect(getDevice3()?.videoSettings.enableVideo).toBe(true);
  });
});
