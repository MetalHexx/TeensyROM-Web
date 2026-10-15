import { Injectable, inject } from '@angular/core';
import { ALERT_SERVICE, type IAlertService } from '@teensyrom-nx/domain';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DjStore } from './dj-store';
import { MIDI_SETTINGS_REPOSITORY } from './ports';
import type { DeckDeviceBindingRecord, IMidiSettingsRepository, MidiSettingsRecord } from './ports';
import { DECK_SLOTS } from './slot';

const SAVE_DEBOUNCE_MS = 300;

/** The server rejects a longer name. */
const MAX_LAST_SEEN_NAME_LENGTH = 128;

const EMPTY_SETTINGS: MidiSettingsRecord = { controllers: [], mappings: [], deckBindings: [] };

/**
 * The only writer of the whole MIDI settings set. The server stores the set whole, so every save
 * sends all three lists: the deck bindings from `DjStore`, and the controllers and mappings
 * exactly as `load` returned them.
 *
 * A failed load resolves an empty set and suppresses every save for the rest of the session, so a
 * partial set can never overwrite the server's.
 */
@Injectable({ providedIn: 'root' })
export class MidiSettingsPersistence {
  private readonly repository: IMidiSettingsRepository = inject(MIDI_SETTINGS_REPOSITORY);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly store = inject(DjStore);

  private loading: Promise<MidiSettingsRecord> | null = null;
  private loaded: MidiSettingsRecord = EMPTY_SETTINGS;
  private savesSuppressed = false;

  private debounce: ReturnType<typeof setTimeout> | null = null;
  private saving = false;
  private saveAgain = false;

  /** Fetches the set on the first call; every later call returns the same promise. */
  load(): Promise<MidiSettingsRecord> {
    this.loading ??= this.fetch();
    return this.loading;
  }

  /** Asks for a save of `snapshot()` after a quiet 300 ms. Saves run one at a time: a request that
   *  arrives during a save sends the latest snapshot once that save settles. Never throws. */
  scheduleSave(): void {
    if (this.savesSuppressed) {
      return;
    }
    if (this.saving) {
      this.saveAgain = true;
      return;
    }
    if (this.debounce !== null) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => {
      this.debounce = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /** The set as it should be on the server right now. */
  snapshot(): MidiSettingsRecord {
    const bindings = this.store.bindings();
    const deckBindings = DECK_SLOTS.flatMap((slot): DeckDeviceBindingRecord[] => {
      const { device } = bindings[slot];
      return device === null
        ? []
        : [
            {
              slot,
              deviceId: device.id,
              lastSeenName: device.name.slice(0, MAX_LAST_SEEN_NAME_LENGTH),
            },
          ];
    });
    return { controllers: this.loaded.controllers, mappings: this.loaded.mappings, deckBindings };
  }

  private async fetch(): Promise<MidiSettingsRecord> {
    try {
      this.loaded = await this.repository.load();
      return this.loaded;
    } catch (error) {
      logWarn(`MidiSettingsPersistence: load failed — ${describe(error)}`);
      this.savesSuppressed = true;
      this.alertService.warning(
        'The MIDI settings could not be loaded. Changes will not be saved until the app is reloaded.'
      );
      return EMPTY_SETTINGS;
    }
  }

  private async flush(): Promise<void> {
    this.saving = true;
    try {
      do {
        await this.load();
        if (this.savesSuppressed) {
          return;
        }
        this.saveAgain = false;
        await this.send();
      } while (this.saveAgain);
    } finally {
      this.saving = false;
    }
  }

  private async send(): Promise<void> {
    try {
      await this.repository.save(this.snapshot());
    } catch (error) {
      logError('MidiSettingsPersistence: save failed', error);
      this.alertService.error('The MIDI settings could not be saved.');
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
