import { updateState } from '../../with-devtools';
import { DeviceColorRecord, IColorThemeService } from '@teensyrom-nx/domain';
import { createAction } from '@teensyrom-nx/utils';
import { ColorThemeActionStore, fetchRecord } from './action-store';

export function loadMissingRecords(store: ColorThemeActionStore, service: IColorThemeService) {
  return {
    /**
     * Fetches records for connected devices that have none yet, leaving the draft alone. Does nothing until
     * initialization has run, which loads the records of the devices connected at that point.
     */
    loadMissingRecords: async (): Promise<void> => {
      if (!store.hasInitialised()) {
        return;
      }

      const missing = store.connectedDevices().filter((d) => !store.records()[d.deviceId]);
      if (missing.length === 0) {
        return;
      }

      const actionMessage = createAction('load-missing-color-records');
      const loaded = await Promise.all(missing.map((d) => fetchRecord(service, d.deviceId)));
      const fetched = loaded.filter((r): r is DeviceColorRecord => r !== null);
      if (fetched.length === 0) {
        return;
      }

      updateState(store, actionMessage, (state) => ({
        ...state,
        records: {
          ...state.records,
          ...Object.fromEntries(fetched.map((r) => [r.deviceId, r])),
        },
      }));
    },
  };
}
