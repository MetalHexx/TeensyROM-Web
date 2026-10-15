import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  MidiSettingsApiService,
  type GetMidiSettingsResponse,
} from '@teensyrom-nx/data-access/api-client';
import type { MidiSettingsRecord } from '@teensyrom-nx/application';
import { ApiMidiSettingsRepository } from './api-midi-settings-repository';

describe('ApiMidiSettingsRepository', () => {
  let repository: ApiMidiSettingsRepository;
  let api: {
    getMidiSettings: ReturnType<typeof vi.fn>;
    saveMidiSettings: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      getMidiSettings: vi.fn(),
      saveMidiSettings: vi.fn().mockResolvedValue({ message: 'saved' }),
    };
    TestBed.configureTestingModule({
      providers: [ApiMidiSettingsRepository, { provide: MidiSettingsApiService, useValue: api }],
    });
    repository = TestBed.inject(ApiMidiSettingsRepository);
  });

  it('loads the set the server holds, mapped to records', async () => {
    const response: GetMidiSettingsResponse = {
      controllers: [{ id: 'launchpad', name: 'Launchpad', lastPortId: null, listening: true }],
      mappings: [],
      deckBindings: [{ slot: 'A', deviceId: '14470230', lastSeenName: 'TR-1' }],
    };
    api.getMidiSettings.mockResolvedValue(response);

    const settings = await repository.load();

    expect(settings).toEqual(response);
  });

  it('saves the whole set in the request body', async () => {
    const settings: MidiSettingsRecord = {
      controllers: [{ id: 'launchpad', name: 'Launchpad', lastPortId: 'p1', listening: false }],
      mappings: [],
      deckBindings: [{ slot: 'B', deviceId: '19277260', lastSeenName: 'TR-2' }],
    };

    await repository.save(settings);

    expect(api.saveMidiSettings).toHaveBeenCalledWith({ saveMidiSettingsRequest: settings });
  });

  it('lets a failed load propagate', async () => {
    api.getMidiSettings.mockRejectedValue(new Error('500'));

    await expect(repository.load()).rejects.toThrow('500');
  });

  it('lets a failed save propagate', async () => {
    api.saveMidiSettings.mockRejectedValue(new Error('400'));

    await expect(
      repository.save({ controllers: [], mappings: [], deckBindings: [] })
    ).rejects.toThrow('400');
  });
});
