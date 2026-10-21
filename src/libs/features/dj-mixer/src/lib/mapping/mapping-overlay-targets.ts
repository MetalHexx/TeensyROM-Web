import {
  controlKey,
  describeSource,
  ownerLabel,
  type ControlMapping,
  type KnownController,
  type LearnState,
  type MappableControl,
} from '@teensyrom-nx/application';
import type { MappingOverlayTarget } from '@teensyrom-nx/ui/components';
import { anchorFor } from './control-anchors';

/** The store state an overlay's look depends on. */
export interface OverlayTargetState {
  readonly learn: LearnState | null;
  readonly mappings: readonly ControlMapping[];
  readonly controllers: readonly KnownController[];
}

/**
 * One overlay target per mappable control, in the control list's order. A control is `selected`
 * while learn is capturing for it, else `bound` when any mapping drives it, else `selectable`. Its
 * accessible name says what it is and where it is bound, so the state never rests on colour alone.
 */
export function buildOverlayTargets(
  controls: readonly MappableControl[],
  { learn, mappings, controllers }: OverlayTargetState
): MappingOverlayTarget[] {
  const mappingsByControl = new Map<string, ControlMapping[]>();
  for (const mapping of mappings) {
    const key = controlKey(mapping.control);
    mappingsByControl.set(key, [...(mappingsByControl.get(key) ?? []), mapping]);
  }
  const learning = learn === null ? null : controlKey(learn.control);

  return controls.map(({ identity, name }) => {
    const id = controlKey(identity);
    const bound = mappingsByControl.get(id) ?? [];
    const base = `Map ${name}, ${ownerLabel(identity.owner)}`;
    const binding =
      bound.length === 0
        ? 'not bound'
        : `bound to ${bound.map(({ source }) => describeSource(source, controllers)).join('; ')}`;

    return {
      id,
      anchor: anchorFor(identity),
      state: id === learning ? 'selected' : bound.length > 0 ? 'bound' : 'selectable',
      accessibleName: `${base}, ${binding}`,
    };
  });
}
