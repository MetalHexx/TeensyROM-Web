import { Device } from '../models';

const MIDI_PORT_TOKEN = /TeensyROM-([A-Za-z0-9_-]+)/;

/**
 * The token after "TeensyROM-" in a MIDI port name — the chip ID of the cartridge behind the port —
 * or `null` when the name carries none.
 */
export function midiPortDeviceToken(portName: string): string | null {
  return MIDI_PORT_TOKEN.exec(portName)?.[1] ?? null;
}

/**
 * Finds the device whose chip ID is the token after "TeensyROM-" in a MIDI port name.
 * The token must equal `deviceId` exactly, so chip `1234` does not match port `TeensyROM-12345`.
 */
export function findDeviceForMidiPort(
  portName: string,
  devices: readonly Device[]
): Device | undefined {
  const token = midiPortDeviceToken(portName);
  if (!token) {
    return undefined;
  }
  return devices.find((device) => device.deviceId === token);
}
