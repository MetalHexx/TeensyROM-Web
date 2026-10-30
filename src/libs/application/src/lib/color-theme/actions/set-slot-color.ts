import { updateState } from '../../with-devtools';
import { DeviceColors } from '@teensyrom-nx/domain';
import { createAction } from '@teensyrom-nx/utils';
import { ColorThemeActionStore } from './action-store';

export function setSlotColor(store: ColorThemeActionStore) {
  return {
    setSlotColor: (slot: keyof DeviceColors, colorIndex: number): void => {
      updateState(store, createAction('set-color-theme-slot'), (state) => ({
        ...state,
        draft: { ...state.draft, [slot]: colorIndex },
      }));
    },
  };
}
