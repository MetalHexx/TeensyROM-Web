import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import { ALERT_SERVICE, COLOR_THEME_SERVICE } from '@teensyrom-nx/domain';
import { ColorThemeActionStore } from './action-store';
import { initialize } from './initialize';
import { loadMissingRecords } from './load-missing-records';
import { selectTheme } from './select-theme';
import { setSlotColor } from './set-slot-color';
import { saveSelected } from './save-selected';
import { saveAs } from './save-as';
import { deleteSelected } from './delete-selected';
import { setApplyTarget } from './set-apply-target';
import { apply } from './apply';

export function withColorThemeActions() {
  return withMethods((store) => {
    const service = inject(COLOR_THEME_SERVICE);
    const alertService = inject(ALERT_SERVICE);
    const actionStore = store as unknown as ColorThemeActionStore;
    return {
      ...initialize(actionStore, service),
      ...loadMissingRecords(actionStore, service),
      ...selectTheme(actionStore),
      ...setSlotColor(actionStore),
      ...saveSelected(actionStore, service),
      ...saveAs(actionStore, service),
      ...deleteSelected(actionStore, service),
      ...setApplyTarget(actionStore),
      ...apply(actionStore, service, alertService),
    };
  });
}
