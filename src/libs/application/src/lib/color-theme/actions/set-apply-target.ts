import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { ColorThemeActionStore } from './action-store';

export function setApplyTarget(store: ColorThemeActionStore) {
  return {
    /** Chooses APPLY_TO_ALL_DEVICES or one device to apply to. */
    setApplyTarget: (target: string): void => {
      updateState(store, createAction('set-color-theme-apply-target'), (state) => ({
        ...state,
        applyTarget: target,
      }));
    },
  };
}
