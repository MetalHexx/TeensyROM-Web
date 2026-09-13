/** The four-step size scale shared by every sizeable control in this library — a rotary knob, a
 *  filter mode selector, a channel fader, a deck strip and anything else that scales — so callers
 *  reach for one vocabulary regardless of which control they are sizing. */
export const CONTROL_SIZES = ['small', 'medium', 'large', 'extra-large'] as const;

/** One of `CONTROL_SIZES`. */
export type ControlSize = (typeof CONTROL_SIZES)[number];
