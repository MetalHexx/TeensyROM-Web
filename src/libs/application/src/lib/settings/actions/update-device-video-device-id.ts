import { updateState } from '@angular-architects/ngrx-toolkit';
import { ISettingsService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';
import { firstValueFrom } from 'rxjs';

export interface UpdateDeviceVideoDeviceIdParams {
  /** TeensyROM device ID */
  deviceId: string;
  /** Video capture device ID */
  videoDeviceId: string;
}

/**
 * Action to update the video device ID for a specific TeensyROM device.
 * This action updates state immediately AND persists to backend.
 * Does NOT add to undo history (too granular for undo/redo).
 */
export function updateDeviceVideoDeviceId(
  writableStore: WritableStore<SettingsState>,
  settingsService: ISettingsService
) {
  return {
    updateDeviceVideoDeviceId: async (params: UpdateDeviceVideoDeviceIdParams): Promise<void> => {
      const actionMessage = createAction('update-device-video-device-id');

      logInfo(LogType.Start, 'UpdateDeviceVideoDeviceId: Updating video device ID', {
        actionMessage,
        deviceId: params.deviceId,
        videoDeviceId: params.videoDeviceId,
      });

      const currentSettings = writableStore.settings();

      if (!currentSettings) {
        logInfo(LogType.Info, 'UpdateDeviceVideoDeviceId: No settings loaded, cannot update');
        return;
      }

      if (!currentSettings.knownDevices) {
        logInfo(LogType.Info, 'UpdateDeviceVideoDeviceId: No known devices, cannot update');
        return;
      }

      const deviceIndex = currentSettings.knownDevices.findIndex(
        (d) => d.deviceId === params.deviceId
      );

      if (deviceIndex === -1) {
        logInfo(
          LogType.Info,
          `UpdateDeviceVideoDeviceId: Device ${params.deviceId} not found in known devices`
        );
        return;
      }

      // Create updated settings with the new video device ID
      const updatedKnownDevices = currentSettings.knownDevices.map((device, index) => {
        if (index === deviceIndex) {
          return {
            ...device,
            videoSettings: {
              ...device.videoSettings,
              videoDeviceId: params.videoDeviceId,
            },
          };
        }
        return device;
      });

      const updatedSettings = {
        ...currentSettings,
        knownDevices: updatedKnownDevices,
      };

      // Update state immediately (no history tracking for this granular change)
      updateState(writableStore, actionMessage, (state) => ({
        ...state,
        settings: updatedSettings,
        lastUpdated: Date.now(),
      }));

      logInfo(LogType.Success, 'UpdateDeviceVideoDeviceId: State updated successfully');

      // Persist immediately
      try {
        await firstValueFrom(settingsService.saveSettings(updatedSettings));
        logInfo(LogType.Finish, 'UpdateDeviceVideoDeviceId: Settings persisted successfully');
      } catch (error) {
        logError('UpdateDeviceVideoDeviceId: Failed to persist settings:', error);
        // State is already updated - we don't revert on save failure
        // This is consistent with other save patterns in the codebase
      }
    },
  };
}
