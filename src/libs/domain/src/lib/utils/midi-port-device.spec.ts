import { Device } from '../models';
import { findDeviceForMidiPort } from './midi-port-device';

function device(deviceId: string): Device {
  return { deviceId } as Device;
}

describe('findDeviceForMidiPort', () => {
  const devices = [device('1234'), device('12345'), device('ABC_def-9')];

  it('matches the device whose chip ID equals the token', () => {
    expect(findDeviceForMidiPort('TeensyROM-12345', devices)).toBe(devices[1]);
  });

  it('does not match a device whose chip ID is a prefix of the token', () => {
    expect(findDeviceForMidiPort('TeensyROM-12345', [device('1234')])).toBeUndefined();
  });

  it('does not match a device whose chip ID merely contains the token', () => {
    expect(findDeviceForMidiPort('TeensyROM-234', [device('1234')])).toBeUndefined();
  });

  it('matches chip IDs containing underscores and hyphens', () => {
    expect(findDeviceForMidiPort('TeensyROM-ABC_def-9', devices)).toBe(devices[2]);
  });

  it('finds the token when the OS adds text around the port name', () => {
    expect(findDeviceForMidiPort('Port 2: TeensyROM-1234 MIDI 1 24:0', devices)).toBe(devices[0]);
  });

  it('returns undefined when no device has the token', () => {
    expect(findDeviceForMidiPort('TeensyROM-9999', devices)).toBeUndefined();
  });

  it('returns undefined when the port name carries no TeensyROM token', () => {
    expect(findDeviceForMidiPort('Some Other Synth', devices)).toBeUndefined();
    expect(findDeviceForMidiPort('TeensyROM-', devices)).toBeUndefined();
  });

  it('returns undefined for an empty device list', () => {
    expect(findDeviceForMidiPort('TeensyROM-1234', [])).toBeUndefined();
  });
});
