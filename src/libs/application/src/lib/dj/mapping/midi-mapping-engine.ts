import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { clamp } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import type { HandTarget } from '../deck-hand';
import { HAND_GRIP_SECONDS } from './hand-settings';
import { MappableControls, type MappableControl } from './mappable-controls';
import { relativeTicks, type RelativeStyleKind } from './mapping-styles';
import {
  controlKey,
  sourceKey,
  type ControlMapping,
  type MidiSource,
  type SourceEvent,
} from './mapping.models';
import { MidiMappingStore } from './midi-mapping-store';

type HoldControl = Extract<MappableControl, { nature: 'hold' }>;
type ValueControl = Extract<MappableControl, { nature: 'value' }>;

/** A hold whose key is down: released by its key coming up, or by one of the engine's release
 *  paths. */
interface ActiveHold {
  readonly mappingId: string;
  readonly controllerId: string;
  readonly control: HoldControl;
}

/** A strip mapped as a hand with a finger on it: lifted by its source going away or by one of the
 *  engine's release paths. */
interface ActiveHand {
  readonly mappingId: string;
  readonly controllerId: string;
  readonly hand: HandTarget;
}

/** Absorbs floating-point error when a sum of fractional ticks lands a hair under a whole step. */
const STEP_EPSILON = 1e-9;

/** Rounds to the control's step when it has one, then keeps the value inside its range. */
function quantize(control: ValueControl, value: number): number {
  const snapped = control.step === null ? value : Math.round(value / control.step) * control.step;
  // `+ 0` turns a negative zero into zero.
  return clamp(snapped, control.min, control.max) + 0;
}

/**
 * Applies each incoming source message to the control its mapping drives, in the mapping's
 * activation style, through the control's own command. Nothing here persists or allocates beyond
 * a map lookup per message, so a stream of CC ticks costs no more than the command it drives.
 *
 * A key's press and release edges come from the last `pressed` seen per source. The press kinds act
 * on the key-down edge and the release kinds (`release`, `latch-release`, `on-release`,
 * `off-release`, `step-release`) on the key-up edge; a release with no press seen is no edge. A
 * hold must never stay stuck, so it is let go by its release edge, by `releaseHolds` (a controller
 * going away), by `releaseMapping` (its mapping removed or moved) and by the page being hidden. A
 * pitch bend strip mapped as a hand is let go the same ways, as a lift.
 */
@Injectable({ providedIn: 'root' })
export class MidiMappingEngine {
  private readonly store = inject(MidiMappingStore);
  private readonly controls = inject(MappableControls);

  private readonly bySource = computed(
    () => new Map(this.store.mappings().map((mapping) => [sourceKey(mapping.source), mapping]))
  );

  /** The last `pressed` seen per source key. */
  private readonly down = new Map<string, boolean>();
  /** The part of a stepped control's relative movement that has not yet made a whole step, per
   *  mapping id. */
  private readonly remainders = new Map<string, number>();
  /** Active holds by source key. */
  private readonly holds = new Map<string, ActiveHold>();
  /** Strips mapped as a hand with a finger on them, by source key. */
  private readonly hands = new Map<string, ActiveHand>();
  private readonly warnedControls = new Set<string>();

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    if (view !== null) {
      const releaseAll = (): void => this.releaseHolds();
      view.addEventListener('pagehide', releaseAll);
      inject(DestroyRef).onDestroy(() => view.removeEventListener('pagehide', releaseAll));
    }
  }

  /** Applies one message. Ignores a source with no mapping, and one whose control is not on the
   *  list. */
  handle(event: SourceEvent): void {
    const key = sourceKey(event);
    const mapping = this.bySource().get(key);
    if (mapping === undefined) {
      return;
    }
    const control = this.controls.find(mapping.control);
    if (control === null) {
      this.warnUnknownControl(mapping);
      return;
    }

    const wasPressed = this.down.get(key) ?? false;
    this.down.set(key, event.pressed);
    const pressEdge = event.pressed && !wasPressed;
    const releaseEdge = !event.pressed && wasPressed;

    const { kind, amount } = mapping.style;
    switch (kind) {
      case 'press':
        if (pressEdge && control.nature === 'trigger') {
          control.fire();
        }
        return;
      case 'release':
        if (releaseEdge && control.nature === 'trigger') {
          control.fire();
        }
        return;
      case 'latch':
        if (pressEdge && control.nature === 'state') {
          control.set(!control.read());
        }
        return;
      case 'latch-release':
        if (releaseEdge && control.nature === 'state') {
          control.set(!control.read());
        }
        return;
      case 'on':
      case 'off':
        if (pressEdge && control.nature === 'state') {
          control.set(kind === 'on');
        }
        return;
      case 'on-release':
      case 'off-release':
        if (releaseEdge && control.nature === 'state') {
          control.set(kind === 'on-release');
        }
        return;
      case 'hold':
        if (control.nature === 'hold') {
          this.applyHold(mapping, control, event, pressEdge, releaseEdge);
        }
        return;
      case 'hand':
        if (
          event.kind === 'pitch-bend' &&
          control.nature === 'value' &&
          control.hand !== undefined &&
          amount !== null
        ) {
          this.applyHand(mapping, control.hand, event, amount);
        }
        return;
      case 'absolute':
        if (event.kind === 'cc' && control.nature === 'value' && !control.wholeSteps) {
          const fraction = event.value / 127;
          control.set(quantize(control, control.min + fraction * (control.max - control.min)));
        }
        return;
      case 'relative-offset':
      case 'relative-signed':
        if (event.kind === 'cc' && control.nature === 'value' && amount !== null) {
          this.applyRelative(mapping.id, control, kind, amount, event.value);
        }
        return;
      case 'step':
        if (pressEdge && control.nature === 'value' && amount !== null) {
          this.applyStep(control, amount);
        }
        return;
      case 'step-release':
        if (releaseEdge && control.nature === 'value' && amount !== null) {
          this.applyStep(control, amount);
        }
        return;
    }
  }

  /** Lets go of every active hold and hand, or only those of one controller, and forgets the key
   *  states of the same scope so the next press is a fresh edge. */
  releaseHolds(controllerId?: string): void {
    for (const [key, hold] of [...this.holds]) {
      if (controllerId === undefined || hold.controllerId === controllerId) {
        this.holds.delete(key);
        this.letGo(hold);
      }
    }
    for (const [key, active] of [...this.hands]) {
      if (controllerId === undefined || active.controllerId === controllerId) {
        this.hands.delete(key);
        this.loseHand(active);
      }
    }
    if (controllerId === undefined) {
      this.down.clear();
      return;
    }
    const prefix = `${controllerId}|`;
    for (const key of [...this.down.keys()]) {
      if (key.startsWith(prefix)) {
        this.down.delete(key);
      }
    }
  }

  /** Whether the source's key is down on a hold, or a finger is on it as a hand, so its release is
   *  what lets that go. */
  isHolding(source: MidiSource): boolean {
    const key = sourceKey(source);
    return this.holds.has(key) || this.hands.has(key);
  }

  /** Lets go of the mapping's hold or hand and drops its edge and accumulator state. Call it before
   *  the mapping is removed or moved to another source. */
  releaseMapping(mappingId: string): void {
    for (const [key, hold] of [...this.holds]) {
      if (hold.mappingId === mappingId) {
        this.holds.delete(key);
        this.letGo(hold);
      }
    }
    for (const [key, active] of [...this.hands]) {
      if (active.mappingId === mappingId) {
        this.hands.delete(key);
        this.loseHand(active);
      }
    }
    this.remainders.delete(mappingId);
    const mapping = this.store.mappings().find((candidate) => candidate.id === mappingId);
    if (mapping !== undefined) {
      this.down.delete(sourceKey(mapping.source));
    }
  }

  private applyHold(
    mapping: ControlMapping,
    control: HoldControl,
    event: SourceEvent,
    pressEdge: boolean,
    releaseEdge: boolean
  ): void {
    const key = sourceKey(event);
    if (pressEdge) {
      this.holds.set(key, { mappingId: mapping.id, controllerId: event.controllerId, control });
      control.set(true, mapping.style.amount);
    } else if (releaseEdge) {
      this.holds.delete(key);
      control.set(false, null);
    }
  }

  /** Passes the strip's value to the deck's hand; the hand reads a return to centre as the lift. */
  private applyHand(
    mapping: ControlMapping,
    hand: HandTarget,
    event: SourceEvent,
    reachSeconds: number
  ): void {
    const key = sourceKey(event);
    if (!event.pressed) {
      this.hands.delete(key);
    } else if (!this.hands.has(key)) {
      this.hands.set(key, { mappingId: mapping.id, controllerId: event.controllerId, hand });
    }
    hand.strip(
      event.value,
      event.timeStampMs,
      reachSeconds,
      mapping.style.grip ?? HAND_GRIP_SECONDS.home
    );
  }

  private applyRelative(
    mappingId: string,
    control: ValueControl,
    kind: RelativeStyleKind,
    amount: number,
    raw: number
  ): void {
    const ticks = relativeTicks(kind, raw);
    if (ticks === 0) {
      return;
    }
    if (control.wholeSteps) {
      this.moveWholeSteps(control, ticks);
      return;
    }
    const delta = ticks * amount * (control.max - control.min);
    if (control.step === null) {
      control.set(clamp(control.read() + delta, control.min, control.max));
      return;
    }

    const total = (this.remainders.get(mappingId) ?? 0) + delta;
    const steps = Math.trunc(total / control.step + Math.sign(total) * STEP_EPSILON);
    if (steps === 0) {
      this.remainders.set(mappingId, total);
      return;
    }
    const target = control.read() + steps * control.step;
    const next = clamp(target, control.min, control.max);
    if (next === target) {
      this.remainders.set(mappingId, total - steps * control.step);
    } else {
      this.remainders.delete(mappingId);
    }
    control.set(next);
  }

  private applyStep(control: ValueControl, amount: number): void {
    if (control.wholeSteps) {
      this.moveWholeSteps(control, Math.sign(amount));
      return;
    }
    let delta = amount * (control.max - control.min);
    if (control.step !== null && Math.abs(delta) < control.step) {
      delta = Math.sign(delta) * control.step;
    }
    control.set(quantize(control, control.read() + delta));
  }

  /** Moves a whole-step selection by exactly `places`, stopping at its ends. With nothing to
   *  select it does nothing. */
  private moveWholeSteps(control: ValueControl, places: number): void {
    if (control.max <= control.min) {
      return;
    }
    control.set(clamp(control.read() + places, control.min, control.max));
  }

  /** Releases a hold, logging rather than throwing so one failing release cannot strand the rest. */
  private letGo(hold: ActiveHold): void {
    try {
      hold.control.set(false, null);
    } catch (error) {
      logWarn(
        `MidiMappingEngine: releasing ${controlKey(hold.control.identity)} failed — ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Lifts a hand, logging rather than throwing so one failing lift cannot strand the rest. */
  private loseHand(active: ActiveHand): void {
    try {
      active.hand.lose();
    } catch (error) {
      logWarn(
        `MidiMappingEngine: lifting mapping ${active.mappingId}'s hand failed — ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private warnUnknownControl(mapping: ControlMapping): void {
    const key = controlKey(mapping.control);
    if (!this.warnedControls.has(key)) {
      this.warnedControls.add(key);
      logWarn(`MidiMappingEngine: mapping ${mapping.id} drives unknown control ${key} — ignored.`);
    }
  }
}
