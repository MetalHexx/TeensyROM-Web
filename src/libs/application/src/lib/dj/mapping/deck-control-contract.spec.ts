import { describe, expect, it } from 'vitest';
import { DECK_CONTROL_IDS } from './mapping.models';

describe('deck control contract', () => {
  it('Should keep the server allow-list contract in step with the deck control list', async () => {
    await expect(`${JSON.stringify(DECK_CONTROL_IDS, null, 2)}\n`).toMatchFileSnapshot(
      '../../../../../../apps/api/src/TeensyRom.Api/Endpoints/MidiSettings/deck-control-ids.json'
    );
  });
});
