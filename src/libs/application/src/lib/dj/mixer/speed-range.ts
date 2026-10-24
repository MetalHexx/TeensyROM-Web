import { SPEED_INPUT_SPAN } from './speed-excursion';

/** The speed fader's travel: 1x ± `SPEED_INPUT_SPAN`, home at 1x. */
export const SPEED_FADER_RANGE = {
  min: 1 - SPEED_INPUT_SPAN,
  max: 1 + SPEED_INPUT_SPAN,
  home: 1,
} as const;
