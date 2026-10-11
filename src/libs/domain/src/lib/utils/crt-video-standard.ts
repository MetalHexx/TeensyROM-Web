import { Device, DeviceVideoStandard } from '../models';

/** The CRT standard for a device: its reported NTSC/PAL, PAL when unknown or the device isn't found. */
export function crtVideoStandardFor(device: Device | undefined): 'PAL' | 'NTSC' {
  return device?.videoStandard === DeviceVideoStandard.Ntsc ? 'NTSC' : 'PAL';
}
