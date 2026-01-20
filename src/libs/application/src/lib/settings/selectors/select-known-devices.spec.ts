import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { SettingsStore } from '../settings-store';
import { PlayerFilterType, SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { ISettingsService } from '@teensyrom-nx/domain';
import { DeviceSettings, Settings } from '@teensyrom-nx/domain';

describe('selectKnownDevices', () => {
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

  it('should return empty array when settings not loaded', () => {
    const allKnownDevices = store.allKnownDevices;
    expect(allKnownDevices()).toEqual([]);
  });

  it('should return empty array when knownDevices is empty', async () => {
    const mockSettings = createMockSettings([]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;
    expect(allKnownDevices()).toEqual([]);
  });

  it('should return array with single device', async () => {
    const device = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;
    expect(allKnownDevices()).toEqual([device]);
  });

  it('should return array with multiple devices', async () => {
    const devices = [
      createMockDevice('device-1', true),
      createMockDevice('device-2', false),
      createMockDevice('device-3', true),
    ];
    const mockSettings = createMockSettings(devices);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;
    expect(allKnownDevices()).toEqual(devices);
    expect(allKnownDevices().length).toBe(3);
  });

  it('should reactively update when devices are added', async () => {
    const device1 = createMockDevice('device-1', true);
    const mockSettings = createMockSettings([device1]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;

    expect(allKnownDevices().length).toBe(1);

    // Add new device
    const device2 = createMockDevice('device-2', false);
    store.updateSettings({ settings: { knownDevices: [device1, device2] } });

    expect(allKnownDevices().length).toBe(2);
    expect(allKnownDevices()).toEqual([device1, device2]);
  });

  it('should reactively update when devices are removed', async () => {
    const devices = [createMockDevice('device-1', true), createMockDevice('device-2', false)];
    const mockSettings = createMockSettings(devices);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;

    expect(allKnownDevices().length).toBe(2);

    // Remove one device
    store.updateSettings({ settings: { knownDevices: [devices[0]] } });

    expect(allKnownDevices().length).toBe(1);
    expect(allKnownDevices()).toEqual([devices[0]]);
  });

  it('should reactively update when devices are modified', async () => {
    const device = createMockDevice('device-1', false);
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;

    expect(allKnownDevices()[0].videoSettings.enableVideo).toBe(false);

    // Update device
    const updatedDevice = { ...device, videoSettings: { ...device.videoSettings, enableVideo: true } };
    store.updateSettings({ settings: { knownDevices: [updatedDevice] } });

    expect(allKnownDevices()[0].videoSettings.enableVideo).toBe(true);
  });

  it('should maintain device order', async () => {
    const devices = [
      createMockDevice('device-3', true),
      createMockDevice('device-1', false),
      createMockDevice('device-2', true),
    ];
    const mockSettings = createMockSettings(devices);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const allKnownDevices = store.allKnownDevices;

    expect(allKnownDevices()[0].deviceId).toBe('device-3');
    expect(allKnownDevices()[1].deviceId).toBe('device-1');
    expect(allKnownDevices()[2].deviceId).toBe('device-2');
  });
});
