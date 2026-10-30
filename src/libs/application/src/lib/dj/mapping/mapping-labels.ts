import { actionOf, triggerOf, type StyleAction, type StyleTrigger } from './mapping-styles';
import type {
  ControlOwner,
  KnownController,
  MappingStyle,
  MidiSource,
  MidiSourceKind,
} from './mapping.models';

const UNKNOWN_CONTROLLER = 'Unknown controller';

/** `Launch Control XL · ch 1 · CC 21`, `· Note 36` for a note, or `· Pitch bend` with no number. */
export function describeSource(
  source: MidiSource,
  controllers: readonly KnownController[]
): string {
  const name = controllers.find((controller) => controller.id === source.controllerId)?.name;
  const who = `${name ?? UNKNOWN_CONTROLLER} · ch ${source.channel}`;
  if (source.kind === 'pitch-bend') {
    return `${who} · Pitch bend`;
  }
  return `${who} · ${source.kind === 'cc' ? 'CC' : 'Note'} ${source.number}`;
}

/** An amount as a percentage with at most one decimal: 0.015 reads `1.5`. */
function percent(amount: number): string {
  return String(Number((Math.abs(amount) * 100).toFixed(1)));
}

/** Seconds as whole milliseconds: 0.13 reads `130`. */
function milliseconds(seconds: number): string {
  return String(Math.round(seconds * 1000));
}

/** The wording of what a style does, apart from when; a one-shot button's `fire` has none. */
export function describeAction(action: StyleAction): string {
  switch (action) {
    case 'fire':
      return '';
    case 'toggle':
      return 'Toggle';
    case 'on':
      return 'Turn on';
    case 'off':
      return 'Turn off';
    case 'step':
      return 'Step';
    case 'hold':
      return 'Hold';
    case 'absolute':
      return 'Absolute';
    case 'relative-offset':
      return 'Relative (binary offset)';
    case 'relative-signed':
      return "Relative (two's complement)";
    case 'hand':
      return 'Hand';
  }
}

/** The key edge in MIDI terms: a CC counts as pressed from value 64. */
export function describeTrigger(trigger: StyleTrigger, sourceKind: MidiSourceKind): string {
  if (sourceKind === 'pitch-bend') {
    return 'Pitch bend';
  }
  const message = sourceKind === 'cc' ? 'CC' : 'Note';
  return `${message} ${trigger === 'press' ? 'On' : 'Off'}`;
}

/** `Note On`, `Toggle · Note Off`, `Step +5% · CC On`, `Hold · 5%`, `Relative (binary offset) · 1%` or
 *  `Hand · reach 130 ms · grip 250 ms`: the action, its amount, then the trigger when the style has
 *  one. */
export function describeStyle(style: MappingStyle, sourceKind: MidiSourceKind): string {
  const { kind, amount, grip } = style;
  const action = actionOf(kind);
  const trigger = triggerOf(kind);
  const name = describeAction(action);
  let what = name;
  if (action === 'hand') {
    what = [
      name,
      amount === null ? '' : `reach ${milliseconds(amount)} ms`,
      grip === undefined ? '' : `grip ${milliseconds(grip)} ms`,
    ]
      .filter((part) => part !== '')
      .join(' · ');
  } else if (action === 'step') {
    what = amount === null ? name : `${name} ${amount < 0 ? '−' : '+'}${percent(amount)}%`;
  } else if (amount !== null && (action === 'hold' || action.startsWith('relative'))) {
    what = `${name} · ${percent(amount)}%`;
  }
  const when = trigger === null ? '' : describeTrigger(trigger, sourceKind);
  return [what, when].filter((part) => part !== '').join(' · ');
}

/** `deck A`, `deck B`, `mixer` or `set`. */
export function ownerLabel(owner: ControlOwner): string {
  return owner === 'mixer' || owner === 'set' ? owner : `deck ${owner}`;
}
