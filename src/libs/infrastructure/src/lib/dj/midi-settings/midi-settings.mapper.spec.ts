import { describe, it, expect } from 'vitest';
import type { GetMidiSettingsResponse } from '@teensyrom-nx/data-access/api-client';
import type { MidiSettingsRecord } from '@teensyrom-nx/application';
import { toMidiSettingsRecord, toSaveMidiSettingsRequest } from './midi-settings.mapper';

const RECORD: MidiSettingsRecord = {
  controllers: [
    { id: 'launchpad', name: 'Launchpad', lastPortId: 'port-9', listening: true },
    { id: 'nano', name: 'nanoKONTROL', lastPortId: null, listening: false },
  ],
  mappings: [
    {
      id: 'm1',
      source: { controllerId: 'launchpad', channel: 1, kind: 'note', number: 36 },
      owner: 'A',
      control: 'play',
      style: { kind: 'press', amount: null },
    },
    {
      id: 'm2',
      source: { controllerId: 'nano', channel: 2, kind: 'cc', number: 7 },
      owner: 'mixer',
      control: 'crossfader',
      style: { kind: 'step', amount: 0.25 },
    },
    {
      id: 'm3',
      source: { controllerId: 'nano', channel: 2, kind: 'cc', number: 8 },
      owner: 'set',
      control: 'set-select',
      style: { kind: 'relative-offset', amount: 1 },
    },
  ],
  deckBindings: [
    { slot: 'A', deviceId: '14470230', lastSeenName: 'TR-1' },
    { slot: 'B', deviceId: '19277260', lastSeenName: 'TR-2' },
  ],
};

describe('midi settings mapper', () => {
  it('round-trips a record through the wire shape unchanged', () => {
    const request = toSaveMidiSettingsRequest(RECORD);

    expect(toMidiSettingsRecord(request)).toEqual(RECORD);
  });

  it('turns an omitted lastPortId and amount into null', () => {
    const dto: GetMidiSettingsResponse = {
      controllers: [{ id: 'launchpad', name: 'Launchpad', listening: true }],
      mappings: [
        {
          id: 'm1',
          source: { controllerId: 'launchpad', channel: 1, kind: 'note', number: 36 },
          owner: 'B',
          control: 'play',
          style: { kind: 'press' },
        },
      ],
      deckBindings: [],
    };

    const record = toMidiSettingsRecord(dto);

    expect(record.controllers[0].lastPortId).toBeNull();
    expect(record.mappings[0].style.amount).toBeNull();
  });

  it('sends null lastPortId and amount as they are', () => {
    const request = toSaveMidiSettingsRequest(RECORD);

    expect(request.controllers[1].lastPortId).toBeNull();
    expect(request.mappings[0].style.amount).toBeNull();
    expect(request.mappings[1].style.amount).toBe(0.25);
  });
});
