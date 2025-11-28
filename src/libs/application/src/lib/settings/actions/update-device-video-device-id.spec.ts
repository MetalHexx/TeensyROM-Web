import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { SettingsStore } from '../settings-store';
import { SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { ISettingsService } from '@teensyrom-nx/domain';
import { ConnectionType, DeviceSettings, PlayerFilterType, Settings } from '@teensyrom-nx/domain';

describe('updateDeviceVideoDeviceId', () => {
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
      connectionType: 'Serial' as ConnectionType,
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

  it('should update correct device videoDeviceId in state', async () => {
    const device1 = createMockDevice('device-1', 'old-cam-1');
    const device2 = createMockDevice('device-2', 'cam-2');
    const mockSettings = createMockSettings([device1, device2]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    await store.updateDeviceVideoDeviceId({
      deviceId: 'device-1',
      videoDeviceId: 'new-cam-1',
    });

    // Verify state was updated correctly
    const updatedSettings = store.settings();
    expect(updatedSettings?.knownDevices[0].videoSettings.videoDeviceId).toBe('new-cam-1');
    expect(updatedSettings?.knownDevices[1].videoSettings.videoDeviceId).toBe('cam-2'); // Unchanged
  });

  it('should not modify other devices in knownDevices array', async () => {
    const device1 = createMockDevice('device-1', 'cam-1');
    const device2 = createMockDevice('device-2', 'cam-2');
    const device3 = createMockDevice('device-3', 'cam-3');
    const mockSettings = createMockSettings([device1, device2, device3]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    await store.updateDeviceVideoDeviceId({
      deviceId: 'device-2',
      videoDeviceId: 'new-cam-2',
    });

    const updatedSettings = store.settings();
    expect(updatedSettings?.knownDevices[0].videoSettings.videoDeviceId).toBe('cam-1');
    expect(updatedSettings?.knownDevices[1].videoSettings.videoDeviceId).toBe('new-cam-2');
    expect(updatedSettings?.knownDevices[2].videoSettings.videoDeviceId).toBe('cam-3');
  });

  it('should call saveSettings with updated settings', async () => {
    const device = createMockDevice('device-1', 'old-cam');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    await store.updateDeviceVideoDeviceId({
      deviceId: 'device-1',
      videoDeviceId: 'new-cam',
    });

    expect(mockSettingsService.saveSettings).toHaveBeenCalled();
    const savedSettings = vi.mocked(mockSettingsService.saveSettings).mock.calls[0][0];
    expect(savedSettings.knownDevices[0].videoSettings.videoDeviceId).toBe('new-cam');
  });

  it('should handle device not found gracefully (no error, just log)', async () => {
    const device = createMockDevice('device-1', 'cam-1');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    // Should not throw when device not found
    await expect(
      store.updateDeviceVideoDeviceId({
        deviceId: 'non-existent-device',
        videoDeviceId: 'new-cam',
      })
    ).resolves.not.toThrow();

    // saveSettings should NOT be called since device was not found
    expect(mockSettingsService.saveSettings).not.toHaveBeenCalled();

    // Original settings should be unchanged
    const settings = store.settings();
    expect(settings?.knownDevices[0].videoSettings.videoDeviceId).toBe('cam-1');
  });

  it('should handle null settings gracefully', async () => {
    // Don't load settings, so settings is null
    await expect(
      store.updateDeviceVideoDeviceId({
        deviceId: 'device-1',
        videoDeviceId: 'new-cam',
      })
    ).resolves.not.toThrow();

    expect(mockSettingsService.saveSettings).not.toHaveBeenCalled();
  });

  it('should handle save failure gracefully (state still updated)', async () => {
    const device = createMockDevice('device-1', 'old-cam');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    vi.mocked(mockSettingsService.saveSettings).mockReturnValue(
      throwError(() => new Error('Save failed'))
    );
    await store.loadSettings();

    // Should not throw even if save fails
    await expect(
      store.updateDeviceVideoDeviceId({
        deviceId: 'device-1',
        videoDeviceId: 'new-cam',
      })
    ).resolves.not.toThrow();

    // State should still be updated even though save failed
    const settings = store.settings();
    expect(settings?.knownDevices[0].videoSettings.videoDeviceId).toBe('new-cam');
  });

  it('should not add to undo history (granular change)', async () => {
    const device = createMockDevice('device-1', 'old-cam');
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    const historyLengthBefore = store.history().length;

    await store.updateDeviceVideoDeviceId({
      deviceId: 'device-1',
      videoDeviceId: 'new-cam',
    });

    // History should NOT have grown (this is a granular change, no undo tracking)
    expect(store.history().length).toBe(historyLengthBefore);
  });

  it('should preserve other videoSettings properties when updating videoDeviceId', async () => {
    const device: DeviceSettings = {
      deviceId: 'device-1',
      videoSettings: {
        enableVideo: true,
        videoDeviceId: 'old-cam',
      },
      connectionSettings: {
        connectionType: 'Serial' as ConnectionType,
        autoConnectEnabled: true,
      },
    };
    const mockSettings = createMockSettings([device]);
    vi.mocked(mockSettingsService.getSettings).mockReturnValue(of(mockSettings));
    vi.mocked(mockSettingsService.saveSettings).mockReturnValue(of(mockSettings));
    await store.loadSettings();

    await store.updateDeviceVideoDeviceId({
      deviceId: 'device-1',
      videoDeviceId: 'new-cam',
    });

    const settings = store.settings();
    expect(settings?.knownDevices[0].videoSettings.enableVideo).toBe(true);
    expect(settings?.knownDevices[0].videoSettings.videoDeviceId).toBe('new-cam');
  });
});
