import { withMethods } from '@ngrx/signals';
import { DjState, WritableStore } from '../dj-store';
import { setDeckStatus } from './set-deck-status';
import { setDeckLoaded } from './set-deck-loaded';
import { setDeckStructure } from './set-deck-structure';
import { samplePosition } from './sample-position';
import { setDeckSubtune } from './set-deck-subtune';
import { setDeckRepeat } from './set-deck-repeat';
import { setBinding } from './set-binding';
import { setMidi } from './set-midi';
import { markSeen } from './mark-seen';

export function withDjActions() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<DjState>;
    return {
      ...setDeckStatus(writableStore),
      ...setDeckLoaded(writableStore),
      ...setDeckStructure(writableStore),
      ...samplePosition(writableStore),
      ...setDeckSubtune(writableStore),
      ...setDeckRepeat(writableStore),
      ...setBinding(writableStore),
      ...setMidi(writableStore),
      ...markSeen(writableStore),
    };
  });
}
