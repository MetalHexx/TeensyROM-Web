import { Injectable, inject } from '@angular/core';
import { MidiSettingsApiService } from '@teensyrom-nx/data-access/api-client';
import type { IMidiSettingsRepository, MidiSettingsRecord } from '@teensyrom-nx/application';
import { toMidiSettingsRecord, toSaveMidiSettingsRequest } from './midi-settings.mapper';

/**
 * `IMidiSettingsRepository` over the server's MIDI settings endpoints. Errors propagate: the
 * caller owns what a failed load or save means.
 */
@Injectable({ providedIn: 'root' })
export class ApiMidiSettingsRepository implements IMidiSettingsRepository {
  private readonly api = inject(MidiSettingsApiService);

  async load(): Promise<MidiSettingsRecord> {
    return toMidiSettingsRecord(await this.api.getMidiSettings());
  }

  async save(settings: MidiSettingsRecord): Promise<void> {
    await this.api.saveMidiSettings({
      saveMidiSettingsRequest: toSaveMidiSettingsRequest(settings),
    });
  }
}
