import { computed, Signal } from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { ColorTheme, ColorThemeKind, Device } from '@teensyrom-nx/domain';
import { ColorThemeState } from '../color-theme-state.interface';

/** What the user can do right now. */
export function permissionSelectors(
  store: StateSignals<ColorThemeState>,
  targetDevices: Signal<Device[]>,
  selectedTheme: Signal<ColorTheme | null>
) {
  const canApply = computed(() => targetDevices().length > 0 && !store.isApplying());
  const canSave = computed(
    () => selectedTheme()?.kind === ColorThemeKind.Custom && !store.isSaving()
  );
  const canDelete = computed(
    () => selectedTheme()?.kind === ColorThemeKind.Custom && !store.isSaving()
  );

  return { canApply, canSave, canDelete };
}
