import type { ControlOwner, KnownController, MappingStyle, MidiSource } from './mapping.models';

const UNKNOWN_CONTROLLER = 'Unknown controller';

/** `Launch Control XL · ch 1 · CC 21`, or `· Note 36` for a note. */
export function describeSource(
  source: MidiSource,
  controllers: readonly KnownController[]
): string {
  const name = controllers.find((controller) => controller.id === source.controllerId)?.name;
  const what = source.kind === 'cc' ? 'CC' : 'Note';
  return `${name ?? UNKNOWN_CONTROLLER} · ch ${source.channel} · ${what} ${source.number}`;
}

/** An amount as a percentage with at most one decimal: 0.015 reads `1.5`. */
function percent(amount: number): string {
  return String(Number((Math.abs(amount) * 100).toFixed(1)));
}

export function describeStyle(style: MappingStyle): string {
  const { kind, amount } = style;
  switch (kind) {
    case 'press':
      return 'On press';
    case 'release':
      return 'On release';
    case 'latch':
      return 'Latch';
    case 'on':
      return 'On key';
    case 'off':
      return 'Off key';
    case 'hold':
      return 'Hold';
    case 'absolute':
      return 'Absolute';
    case 'relative-offset':
      return amount === null ? 'Relative' : `Relative · ${percent(amount)}%`;
    case 'relative-signed':
      return amount === null ? 'Relative ±' : `Relative ± · ${percent(amount)}%`;
    case 'step':
      return amount === null ? 'Step' : `Step ${amount < 0 ? '−' : '+'}${percent(amount)}%`;
  }
}

/** `deck A`, `deck B` or `mixer`. */
export function ownerLabel(owner: ControlOwner): string {
  return owner === 'mixer' ? 'mixer' : `deck ${owner}`;
}
