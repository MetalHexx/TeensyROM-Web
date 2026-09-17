import { InjectionToken } from '@angular/core';
import type { FrameClock, ReplayRunner } from '@sidablist/core';

/**
 * Factories, not instances — each deck slot calls these to build its own clock and its own replay
 * thread rather than sharing one. Two frame clocks, two replay workers is the design: every deck
 * drives its own audio graph and owns its own worker, never shared with another deck.
 */
export const FRAME_CLOCK_FACTORY = new InjectionToken<() => FrameClock>('FRAME_CLOCK_FACTORY');
export const REPLAY_RUNNER_FACTORY = new InjectionToken<() => ReplayRunner>(
  'REPLAY_RUNNER_FACTORY'
);
