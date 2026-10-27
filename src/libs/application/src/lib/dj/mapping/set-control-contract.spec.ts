import { describe, expect, it } from 'vitest';
import { SET_CONTROL_IDS } from './mapping.models';

describe('set control contract', () => {
  it('Should keep the server allow-list contract in step with the set control list', async () => {
    await expect(`${JSON.stringify(SET_CONTROL_IDS, null, 2)}\n`).toMatchFileSnapshot(
      '../../../../../../apps/api/src/TeensyRom.Api/Endpoints/MidiSettings/set-control-ids.json'
    );
  });
});
