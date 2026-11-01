import { NTSC_PHI2_HZ, PAL_PHI2_HZ } from '@sidablist/core';
import { DeviceVideoStandard } from '@teensyrom-nx/domain';

/**
 * The φ2 of the C64 a cartridge sits in, from the video standard the device reports — or `null` when
 * it reports none, which leaves the deck playing a tune's bytes uncorrected.
 *
 * This is only the far end's half of the pitch correction. The clock each tune was written for is
 * read from the tune's own header by the player, so nothing here looks at the tune.
 */
export function machineClockHz(standard: DeviceVideoStandard | undefined): number | null {
  switch (standard) {
    case DeviceVideoStandard.Pal:
      return PAL_PHI2_HZ;
    case DeviceVideoStandard.Ntsc:
      return NTSC_PHI2_HZ;
    default:
      return null;
  }
}
