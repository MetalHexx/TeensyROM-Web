import { computed } from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { ColorThemeKind, DEVICE_COLOR_SLOTS, DeviceColors } from '@teensyrom-nx/domain';
import { ColorThemeState } from '../color-theme-state.interface';

export function sameColors(a: DeviceColors, b: DeviceColors): boolean {
  return DEVICE_COLOR_SLOTS.every((slot) => a[slot] === b[slot]);
}

/** The theme lists, the selection, and whether the draft has drifted from it. */
export function themeSelectors(store: StateSignals<ColorThemeState>) {
  const shippedThemes = computed(() =>
    store.themes().filter((t) => t.kind === ColorThemeKind.Shipped)
  );
  const customThemes = computed(() =>
    store.themes().filter((t) => t.kind === ColorThemeKind.Custom)
  );
  const selectedTheme = computed(
    () => store.themes().find((t) => t.id === store.selectedThemeId()) ?? null
  );
  const isEdited = computed(() => {
    const theme = selectedTheme();
    return theme !== null && !sameColors(theme.parts.device, store.draft());
  });
  const unchangedThemeId = computed(() => {
    const theme = selectedTheme();
    return theme !== null && !isEdited() ? theme.id : null;
  });

  return { shippedThemes, customThemes, selectedTheme, isEdited, unchangedThemeId };
}
