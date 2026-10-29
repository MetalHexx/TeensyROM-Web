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
import { restoreDeckPanel } from './restore-deck-panel';
import { setDeckEngineControls } from './set-deck-engine-controls';
import { setDeckDetectedKey } from './set-deck-detected-key';
import { setDeckSwitching } from './set-deck-switching';
import { setDeckTiming } from './set-deck-timing';
import { setDeckLoops } from './set-deck-loops';
import { setLoopMarkers } from './set-loop-markers';
import { setLoopSelection } from './set-loop-selection';
import { setLoopActivity } from './set-loop-activity';
import { setSettingsInPlay } from './set-settings-in-play';
import { setSetsLibrary } from './set-sets-library';
import { putOpenSet } from './put-open-set';
import { closeOpenSets } from './close-open-sets';
import { setCurrentSet } from './set-current-set';
import { removeSetSummary } from './remove-set-summary';
import { setDeckHolding } from './set-deck-holding';
import { selectSetRow } from './select-set-row';
import { setPendingRows } from './set-pending-rows';
import { setRowPrep } from './set-row-prep';
import { setSetsSaveStatus } from './set-sets-save-status';
import { announceSets } from './announce-sets';
import { setAsidLaunching } from './set-asid-launching';

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
      ...restoreDeckPanel(writableStore),
      ...setDeckEngineControls(writableStore),
      ...setDeckDetectedKey(writableStore),
      ...setDeckSwitching(writableStore),
      ...setDeckTiming(writableStore),
      ...setDeckLoops(writableStore),
      ...setLoopMarkers(writableStore),
      ...setLoopSelection(writableStore),
      ...setLoopActivity(writableStore),
      ...setSettingsInPlay(writableStore),
      ...setSetsLibrary(writableStore),
      ...putOpenSet(writableStore),
      ...closeOpenSets(writableStore),
      ...setCurrentSet(writableStore),
      ...removeSetSummary(writableStore),
      ...setDeckHolding(writableStore),
      ...selectSetRow(writableStore),
      ...setPendingRows(writableStore),
      ...setRowPrep(writableStore),
      ...setSetsSaveStatus(writableStore),
      ...announceSets(writableStore),
      ...setAsidLaunching(writableStore),
    };
  });
}
