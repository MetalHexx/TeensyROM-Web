import { actionOf, triggerOf, type StyleAction, type StyleTrigger } from './mapping-styles';
import type {
  ControlOwner,
  KnownController,
  MappingStyle,
  MidiSource,
  MidiSourceKind,
} from './mapping.models';

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
  }
}

/** The key edge in MIDI terms: a CC counts as pressed from value 64. */
export function describeTrigger(trigger: StyleTrigger, sourceKind: MidiSourceKind): string {
  const message = sourceKind === 'cc' ? 'CC' : 'Note';
  return `${message} ${trigger === 'press' ? 'On' : 'Off'}`;
}

/** `Note On`, `Toggle · Note Off`, `Step +5% · CC On`, `Hold · 5%` or `Relative (binary offset) · 1%`:
 *  the action, its amount, then the trigger when the style has one. */
export function describeStyle(style: MappingStyle, sourceKind: MidiSourceKind): string {
  const { kind, amount } = style;
  const action = actionOf(kind);
  const trigger = triggerOf(kind);
  const name = describeAction(action);
  let what = name;
  if (action === 'step') {
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
