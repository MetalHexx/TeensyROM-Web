import { updateState } from '../../with-devtools';
import { firstValueFrom } from 'rxjs';
import {
  ColorTheme,
  DeviceColorRecord,
  FACTORY_COLOR_THEME_ID,
  IColorThemeService,
} from '@teensyrom-nx/domain';
import { createAction, logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { ColorThemeActionStore, fetchRecord, waitForDeviceDiscovery } from './action-store';

export function initialize(store: ColorThemeActionStore, service: IColorThemeService) {
  return {
    /**
     * Waits for device discovery, then loads the themes and the records of all connected devices. The draft
     * and selection follow the first connected device's record, or the factory theme when none is connected.
     */
    initialize: async (): Promise<void> => {
      const actionMessage = createAction('initialize-color-theme');
      logInfo(LogType.Start, 'ColorTheme: Initializing', { actionMessage });

      updateState(store, actionMessage, (state) => ({ ...state, isLoading: true, error: null }));

      await waitForDeviceDiscovery(store);

      const devices = store.connectedDevices();
      let themes: ColorTheme[];
      let loaded: (DeviceColorRecord | null)[];
      try {
        [themes, loaded] = await Promise.all([
          firstValueFrom(service.listThemes()),
          Promise.all(devices.map((d) => fetchRecord(service, d.deviceId))),
        ]);
      } catch (error) {
        logError('ColorTheme: Failed to load themes:', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          isLoading: false,
          error: (error as Error)?.message || 'Failed to load themes',
        }));
        return;
      }

      const records: Record<string, DeviceColorRecord> = {};
      for (const record of loaded) {
        if (record) {
          records[record.deviceId] = record;
        }
      }
      const shown = records[devices[0]?.deviceId] ?? null;
      const factory = themes.find((t) => t.id === FACTORY_COLOR_THEME_ID) ?? null;

      let selectedThemeId: string | null = null;
      if (devices.length === 0) {
        selectedThemeId = FACTORY_COLOR_THEME_ID;
      } else if (shown?.themeId && themes.some((t) => t.id === shown.themeId)) {
        selectedThemeId = shown.themeId;
      }

      updateState(store, actionMessage, (state) => ({
        ...state,
        themes,
        records,
        selectedThemeId,
        draft: shown?.colors ?? factory?.parts.device ?? state.draft,
        hasInitialised: true,
        isLoading: false,
      }));

      logInfo(LogType.Finish, 'ColorTheme: Initialized');
    },
  };
}
