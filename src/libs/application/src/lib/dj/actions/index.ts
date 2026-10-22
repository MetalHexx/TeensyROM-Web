import { withMethods } from '@ngrx/signals';
import { DjState, WritableStore } from '../dj-store';
import { setDeckStatus } from './set-deck-status';
import { setDeckBusy } from './set-deck-busy';
import { setDeckLoaded } from './set-deck-loaded';
import { setDeckStructure } from './set-deck-structure';
import { samplePosition } from './sample-position';
import { setDeckSubtune } from './set-deck-subtune';
import { setDeckRepeat } from './set-deck-repeat';
import { setBinding } from './set-binding';
import { setMidi } from './set-midi';
import { markSeen } from './mark-seen';
import { setVoiceStrip } from './set-voice-strip';
import { setDeckPanel } from './set-deck-panel';
import { setKeyDisplayFormat } from './set-key-display-format';
import { resetDeckPanel } from './reset-deck-panel';
import { setDeckEngineControls } from './set-deck-engine-controls';
import { setDeckDetectedKey } from './set-deck-detected-key';
import { setDeckSwitching } from './set-deck-switching';

export function withDjActions() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<DjState>;
    return {
      ...setDeckStatus(writableStore),
      ...setDeckBusy(writableStore),
      ...setDeckLoaded(writableStore),
      ...setDeckStructure(writableStore),
      ...samplePosition(writableStore),
      ...setDeckSubtune(writableStore),
      ...setDeckRepeat(writableStore),
      ...setBinding(writableStore),
      ...setMidi(writableStore),
      ...markSeen(writableStore),
      ...setVoiceStrip(writableStore),
      ...setDeckPanel(writableStore),
      ...setKeyDisplayFormat(writableStore),
      ...resetDeckPanel(writableStore),
      ...setDeckEngineControls(writableStore),
      ...setDeckDetectedKey(writableStore),
      ...setDeckSwitching(writableStore),
    };
  });
}
