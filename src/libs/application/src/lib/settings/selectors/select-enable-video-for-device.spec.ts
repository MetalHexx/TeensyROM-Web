import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { SettingsStore } from '../settings-store';
import { PlayerFilterType, SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { ISettingsService } from '@teensyrom-nx/domain';
import { DeviceSettings, Settings } from '@teensyrom-nx/domain';

describe('selectEnableVideoForDevice', () => {
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

  const createMockDevice = (deviceId: string, enableVideo: boolean): DeviceSettings => ({
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

  it('should return false when settings not loaded (safe default)', () => {
    const enableVideoForDevice = store.enableVideoForDevice('device-1');
    expect(enableVideoForDevice()).toBe(false);
  });

  it('should return false when knownDevices is empty (safe default)', async () => {
    const mockSettings = createMockSettings([]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const enableVideoForDevice = store.enableVideoForDevice('device-1');
    expect(enableVideoForDevice()).toBe(false);
  });

  it('should return true when device has enableVideo=true', async () => {
    const device = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const enableVideoForDevice = store.enableVideoForDevice('device-1');
    expect(enableVideoForDevice()).toBe(true);
  });

  it('should return false when device has enableVideo=false', async () => {
    const device = createMockDevice('device-1', false);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const enableVideoForDevice = store.enableVideoForDevice('device-1');
    expect(enableVideoForDevice()).toBe(false);
  });

  it('should return false for unknown device (safe default)', async () => {
    const device = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const enableVideoForDevice = store.enableVideoForDevice('unknown-device');
    expect(enableVideoForDevice()).toBe(false);
  });

  it('should reactively update when video settings change', async () => {
    const device = createMockDevice('device-1', false);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const enableVideoForDevice = store.enableVideoForDevice('device-1');

    expect(enableVideoForDevice()).toBe(false);

    // Update device settings
    const updatedDevice = { ...device, videoSettings: { ...device.videoSettings, enableVideo: true } };
    store.updateSettings({ settings: { knownDevices: [updatedDevice] } });

    expect(enableVideoForDevice()).toBe(true);
  });

  it('should handle multiple devices with different video settings', async () => {
    const devices = [
      createMockDevice('device-1', true),
      createMockDevice('device-2', false),
      createMockDevice('device-3', true),
    ];
    const mockSettings = createMockSettings(devices);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const enableVideo1 = store.enableVideoForDevice('device-1');
    const enableVideo2 = store.enableVideoForDevice('device-2');
    const enableVideo3 = store.enableVideoForDevice('device-3');

    expect(enableVideo1()).toBe(true);
    expect(enableVideo2()).toBe(false);
    expect(enableVideo3()).toBe(true);
  });


});
