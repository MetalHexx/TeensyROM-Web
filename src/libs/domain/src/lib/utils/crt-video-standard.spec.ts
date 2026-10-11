import { Device } from '../models';
import { DeviceVideoStandard } from '../models/device-facts.enum';
import { crtVideoStandardFor } from './crt-video-standard';

function device(videoStandard: DeviceVideoStandard): Device {
  return { deviceId: 'dev-1', videoStandard } as Device;
}

describe('crtVideoStandardFor', () => {
  it('returns NTSC for an NTSC device', () => {
    expect(crtVideoStandardFor(device(DeviceVideoStandard.Ntsc))).toBe('NTSC');
  });

  it('returns PAL for a PAL device', () => {
    expect(crtVideoStandardFor(device(DeviceVideoStandard.Pal))).toBe('PAL');
  });

  it('returns PAL for a device with an unknown standard', () => {
    expect(crtVideoStandardFor(device(DeviceVideoStandard.Unknown))).toBe('PAL');
  });

  it('returns PAL when the device is not found', () => {
    expect(crtVideoStandardFor(undefined)).toBe('PAL');
  });
});
