import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { APPLY_TO_ALL_DEVICES } from '@teensyrom-nx/domain';
import { ColorThemeState } from './color-theme-state.interface';
import { withColorThemeSelectors } from './selectors';
import { withColorThemeActions } from './actions';

const initialState: ColorThemeState = {
  themes: [],
  selectedThemeId: null,
  // TR Default colors, so the rows never render empty
  draft: { background: 0, border: 4, banner: 4, time: 10, option: 7, sources: 14, name: 13 },
  records: {},
  applyTarget: APPLY_TO_ALL_DEVICES,
  hasInitialised: false,
  isLoading: false,
  isSaving: false,
  isApplying: false,
  error: null,
};

export const ColorThemeStore = signalStore(
  { providedIn: 'root' },
  withDevtools('colorTheme'),
  withState(initialState),
  withColorThemeSelectors(),
  withColorThemeActions()
);
