import { describe, it, expect } from 'vitest';
import { NTSC_PHI2_HZ, PAL_PHI2_HZ } from '@sidablist/core';
import { DeviceVideoStandard } from '@teensyrom-nx/domain';
import { machineClockHz } from './machine-clock';

describe('machineClockHz', () => {
  it("names a PAL machine's φ2 and an NTSC machine's", () => {
    expect(machineClockHz(DeviceVideoStandard.Pal)).toBe(PAL_PHI2_HZ);
    expect(machineClockHz(DeviceVideoStandard.Ntsc)).toBe(NTSC_PHI2_HZ);
  });

  it('names none for a device that reports no standard, or no device', () => {
    expect(machineClockHz(DeviceVideoStandard.Unknown)).toBeNull();
    expect(machineClockHz(undefined)).toBeNull();
  });
});
