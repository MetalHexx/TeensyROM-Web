import { midiPortDeviceToken, type Device } from '@teensyrom-nx/domain';
import type { DeckBindingState } from './dj-store';
import type { MidiPortOption } from './ports/midi-access';
import { otherSlot, type Slot } from './slot';

/** One cartridge a deck can be bound to. */
export interface CartridgeOption {
  readonly id: string;
  readonly label: string;
  /** True when a MIDI output currently carries this cartridge's id. */
  readonly present: boolean;
  /** The other deck, when it already holds this cartridge. */
  readonly takenBy: Slot | null;
}

/** The server's rule for a device id; a token that fails it cannot be saved. */
const DEVICE_ID_RULE = /^[A-Za-z0-9_-]{1,32}$/;

interface Candidate {
  readonly id: string;
  readonly name: string;
  /** The name is the MIDI port's own, so the label is the port part alone. */
  readonly namedByPort: boolean;
}

/**
 * The cartridges deck `slot` can be bound to: every known device, every output that names a
 * cartridge the server does not know, and this slot's own bound cartridge when neither source
 * lists it. Deduplicated by id, ordered by label.
 *
 * Outputs with no `TeensyROM-` token (a wavetable synth) are not cartridges and are not listed,
 * nor are tokens the server would refuse as a device id.
 */
export function cartridgeOptions(
  slot: Slot,
  bindings: Readonly<Record<Slot, DeckBindingState>>,
  outputs: readonly MidiPortOption[],
  devices: readonly Device[]
): CartridgeOption[] {
  const outputById = new Map<string, MidiPortOption>();
  for (const output of outputs) {
    const token = midiPortDeviceToken(output.name);
    if (token !== null && DEVICE_ID_RULE.test(token) && !outputById.has(token)) {
      outputById.set(token, output);
    }
  }

  const candidates = new Map<string, Candidate>();
  for (const device of devices) {
    if (!candidates.has(device.deviceId)) {
      candidates.set(device.deviceId, {
        id: device.deviceId,
        name: device.name,
        namedByPort: false,
      });
    }
  }
  for (const [id, output] of outputById) {
    if (!candidates.has(id)) {
      candidates.set(id, { id, name: output.name, namedByPort: true });
    }
  }
  const bound = bindings[slot].device;
  if (bound !== null && !candidates.has(bound.id)) {
    candidates.set(bound.id, {
      id: bound.id,
      name: bound.name,
      namedByPort: midiPortDeviceToken(bound.name) === bound.id,
    });
  }

  const other = otherSlot(slot);
  const options = [...candidates.values()].map((candidate): CartridgeOption => {
    const output = outputById.get(candidate.id);
    return {
      id: candidate.id,
      label: labelFor(candidate, output),
      present: output !== undefined,
      takenBy: bindings[other].device?.id === candidate.id ? other : null,
    };
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function labelFor(candidate: Candidate, output: MidiPortOption | undefined): string {
  if (output === undefined) {
    const absent = `TeensyROM-${candidate.id} · absent`;
    return candidate.namedByPort ? absent : `${candidate.name}: ${absent}`;
  }
  const port = `${output.name} (${output.manufacturer})`;
  return candidate.namedByPort ? port : `${candidate.name}: ${port}`;
}
