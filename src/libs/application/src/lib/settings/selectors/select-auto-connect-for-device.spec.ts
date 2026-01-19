import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { SettingsStore } from '../settings-store';
import { PlayerFilterType, SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { ISettingsService } from '@teensyrom-nx/domain';
import { DeviceSettings, Settings } from '@teensyrom-nx/domain';

describe('selectAutoConnectForDevice', () => {
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

  const createMockDevice = (deviceId: string, autoConnectEnabled: boolean): DeviceSettings => ({
    deviceId,
    videoSettings: {
      enableVideo: false,
      videoDeviceId: '',
    },
    connectionSettings: {
      autoConnectEnabled,
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

  it('should return true when settings not loaded (default to auto-connect)', () => {
    const autoConnectForDevice = store.autoConnectForDevice('device-1');
    expect(autoConnectForDevice()).toBe(true);
  });

  it('should return true when knownDevices is empty (default to auto-connect)', async () => {
    const mockSettings = createMockSettings([]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const autoConnectForDevice = store.autoConnectForDevice('device-1');
    expect(autoConnectForDevice()).toBe(true);
  });

  it('should return true when device has autoConnectEnabled=true', async () => {
    const device = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const autoConnectForDevice = store.autoConnectForDevice('device-1');
    expect(autoConnectForDevice()).toBe(true);
  });

  it('should return false when device has autoConnectEnabled=false', async () => {
    const device = createMockDevice('device-1', false);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const autoConnectForDevice = store.autoConnectForDevice('device-1');
    expect(autoConnectForDevice()).toBe(false);
  });

  it('should return true for unknown device (default to auto-connect)', async () => {
    const device = createMockDevice('device-1', false);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const autoConnectForDevice = store.autoConnectForDevice('unknown-device');
    expect(autoConnectForDevice()).toBe(true);
  });

  it('should reactively update when connection settings change', async () => {
    const device = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const autoConnectForDevice = store.autoConnectForDevice('device-1');

    expect(autoConnectForDevice()).toBe(true);

    // Update device settings
    const updatedDevice = {
      ...device,
      connectionSettings: { ...device.connectionSettings, autoConnectEnabled: false },
    };
    store.updateSettings({ settings: { knownDevices: [updatedDevice] } });

    expect(autoConnectForDevice()).toBe(false);
  });

  it('should handle multiple devices with different auto-connect settings', async () => {
    const devices = [
      createMockDevice('device-1', true),
      createMockDevice('device-2', false),
      createMockDevice('device-3', true),
    ];
    const mockSettings = createMockSettings(devices);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const autoConnect1 = store.autoConnectForDevice('device-1');
    const autoConnect2 = store.autoConnectForDevice('device-2');
    const autoConnect3 = store.autoConnectForDevice('device-3');

    expect(autoConnect1()).toBe(true);
    expect(autoConnect2()).toBe(false);
    expect(autoConnect3()).toBe(true);
  });


});
