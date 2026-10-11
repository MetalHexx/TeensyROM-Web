import { Device } from '../models';

const MIDI_PORT_TOKEN = /TeensyROM-([A-Za-z0-9_-]+)/;

/**
 * Finds the device whose chip ID is the token after "TeensyROM-" in a MIDI port name.
 * The token must equal `deviceId` exactly, so chip `1234` does not match port `TeensyROM-12345`.
 */
export function findDeviceForMidiPort(
  portName: string,
  devices: readonly Device[]
): Device | undefined {
  const token = MIDI_PORT_TOKEN.exec(portName)?.[1];
  if (!token) {
    return undefined;
  }
  return devices.find((device) => device.deviceId === token);
}
