import { InjectionToken } from '@angular/core';
import type { FrameClock, ReplayRunner } from '@sidablist/core';

/**
 * Factories, not instances — each deck slot calls these to build its own clock and its own replay
 * threads rather than sharing them. Two frame clocks and four replay workers is the design: every
 * deck drives its own audio graph and owns two workers, one for jumps and one for prepared builds,
 * never shared with another deck.
 */
export const FRAME_CLOCK_FACTORY = new InjectionToken<() => FrameClock>('FRAME_CLOCK_FACTORY');
export const REPLAY_RUNNER_FACTORY = new InjectionToken<() => ReplayRunner>(
  'REPLAY_RUNNER_FACTORY'
);
