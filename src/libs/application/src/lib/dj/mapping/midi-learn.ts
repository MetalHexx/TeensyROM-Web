import { Injectable, inject } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import type { MappingStyleKind, MidiInputMessage } from '../ports';
import { MappableControls, type MappableControl } from './mappable-controls';
import { describeSource, ownerLabel } from './mapping-labels';
import { defaultAmountFor, defaultStyle, stylesForControl } from './mapping-styles';
import {
  controlKey,
  sourceKey,
  type ControlIdentity,
  type MappingStyle,
  type MidiSource,
} from './mapping.models';
import { MidiControllers } from './midi-controllers';
import { MidiMappingStore, type LearnState } from './midi-mapping-store';
import { MidiMappings } from './midi-mappings';

/** How long a CC is sampled before its style is guessed, and the most samples it keeps. */
const SAMPLING_WINDOW_MS = 1500;
const MAX_SAMPLES = 24;

/** A relative encoder sends few distinct values; a sweep sends many. */
const MAX_RELATIVE_DISTINCT = 6;
const MIN_SWEEP_DISTINCT = 4;

/** Signed-bit encoders send 1–15 for a turn up and 113–127 for a turn down. */
const SIGNED_UP_MAX = 15;
const SIGNED_DOWN_MIN = 113;

/** 64-centred encoders send values close to 64, never 64 itself. */
const OFFSET_CENTRE = 64;
const OFFSET_MIN = 49;
const OFFSET_MAX = 79;

/**
 * Guesses how a CC control is turned from the values it sent: `relative-signed` or
 * `relative-offset` when a few distinct values all sit in that encoder's tick range, whether it was
 * turned one way or both (the two ranges do not overlap), `absolute` for a sweep, and `null` when
 * the samples say nothing, so the control's own default applies.
 */
export function guessValueStyle(
  samples: readonly number[]
): Extract<MappingStyleKind, 'relative-signed' | 'relative-offset' | 'absolute'> | null {
  const distinct = new Set(samples).size;
  const isSignedValue = (value: number): boolean =>
    (value >= 1 && value <= SIGNED_UP_MAX) || (value >= SIGNED_DOWN_MIN && value <= 127);
  const isOffsetValue = (value: number): boolean =>
    value >= OFFSET_MIN && value <= OFFSET_MAX && value !== OFFSET_CENTRE;

  if (distinct > 0 && distinct <= MAX_RELATIVE_DISTINCT) {
    if (samples.every(isSignedValue)) {
      return 'relative-signed';
    }
    if (samples.every(isOffsetValue)) {
      return 'relative-offset';
    }
  }
  return distinct >= MIN_SWEEP_DISTINCT ? 'absolute' : null;
}

/** The CC being sampled: its raw values so far and the timer that ends the window. */
interface Sampling {
  readonly source: MidiSource;
  readonly samples: number[];
  readonly portName: string;
  lastValue: number;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Captures a mapping: the first message after a control is selected binds. A CC on a value control
 * is sampled for 1.5 s (or 24 messages) first, so a relative encoder can be told from a fader. A
 * pitch bend binds only to a control that takes a hand, and only when it is off centre. Binding a
 * source that drives another control moves it, and the move is announced.
 */
@Injectable({ providedIn: 'root' })
export class MidiLearn {
  private readonly store = inject(MidiMappingStore);
  private readonly mappings = inject(MidiMappings);
  private readonly controllers = inject(MidiControllers);
  private readonly controls = inject(MappableControls);

  private sampling: Sampling | null = null;
  private selectedAtMs = 0;

  /** Starts listening for a control, only while mapping mode is on. Selecting the control that is
   *  already selected cancels. */
  select(identity: ControlIdentity): void {
    if (!this.store.mappingMode()) {
      return;
    }
    const current = this.store.learn();
    if (current !== null && controlKey(current.control) === controlKey(identity)) {
      this.cancel();
      return;
    }
    this.start(identity, null);
  }

  /** Starts listening for a new source for an existing mapping. */
  async relearn(mappingId: string): Promise<void> {
    await this.controllers.setMappingMode(true);
    const mapping = this.store.mappings().find((candidate) => candidate.id === mappingId);
    if (mapping === undefined) {
      return;
    }
    this.start(mapping.control, mappingId);
  }

  cancel(): void {
    this.clearSampling();
    if (this.store.learn() === null) {
      return;
    }
    this.store.setLearn({ learn: null });
    logInfo(LogType.Midi, 'MIDI learn cancelled');
  }

  /** Takes a message for learn when one is in progress. Returns true when it was consumed, so it
   *  must not reach the engine. A note release is never consumed: it may end a hold. Neither is a
   *  pitch bend at centre, which may end a hand, nor one offered to a control that takes no hand:
   *  learn keeps waiting. A message stamped before the control was selected is stale and is never
   *  consumed, so a message the controller sent earlier cannot bind. */
  offer(message: MidiInputMessage, portName: string): boolean {
    const learn = this.store.learn();
    if (learn === null) {
      this.clearSampling();
      return false;
    }
    if (message.timeStampMs < this.selectedAtMs) {
      logInfo(
        LogType.Midi,
        `MIDI learn ignored a stale message ${heard(
          portName,
          message,
          message.value
        )}, ${Math.round(performance.now() - message.timeStampMs)} ms old`
      );
      return false;
    }
    if (message.kind === 'pitch-bend' && !message.pressed) {
      return false;
    }
    if (learn.phase === 'sampling') {
      return this.sample(message);
    }
    if (message.kind === 'note' && !message.pressed) {
      return false;
    }

    const control = this.controls.find(learn.control);
    if (control === null) {
      logWarn(`MidiLearn: ${controlKey(learn.control)} is not a mappable control.`);
      this.cancel();
      return false;
    }

    if (message.kind === 'pitch-bend' && stylesForControl(control, 'pitch-bend').length === 0) {
      return false;
    }

    const controllerId = this.controllers.ensureController(message.portId, portName);
    const source: MidiSource = {
      controllerId,
      channel: message.channel,
      kind: message.kind,
      number: message.number,
    };
    if (message.kind === 'cc' && control.nature === 'value') {
      this.beginSampling(learn, source, message, portName);
    } else {
      this.finish(
        learn,
        source,
        defaultStyle(control, message.kind),
        heard(portName, message, message.value)
      );
    }
    return true;
  }

  private start(identity: ControlIdentity, replacing: string | null): void {
    this.clearSampling();
    this.selectedAtMs = performance.now();
    this.store.setLearn({
      learn: { control: identity, phase: 'waiting', replacing, source: null },
    });
    logInfo(LogType.Midi, `MIDI learn selected ${controlKey(identity)}`);
  }

  private beginSampling(
    learn: LearnState,
    source: MidiSource,
    message: MidiInputMessage,
    portName: string
  ): void {
    this.clearSampling();
    const sampling: Sampling = {
      source,
      samples: [message.value],
      portName,
      lastValue: message.value,
      timer: setTimeout(() => this.endWindow(sampling), SAMPLING_WINDOW_MS),
    };
    this.sampling = sampling;
    this.store.setLearn({ learn: { ...learn, phase: 'sampling', source } });
    logInfo(LogType.Midi, `MIDI learn sampling ${heard(portName, message, message.value)}`);
  }

  private sample(message: MidiInputMessage): boolean {
    const sampling = this.sampling;
    if (
      sampling === null ||
      message.kind !== sampling.source.kind ||
      message.channel !== sampling.source.channel ||
      message.number !== sampling.source.number ||
      this.controllers.controllerForPort(message.portId) !== sampling.source.controllerId
    ) {
      return false;
    }
    sampling.samples.push(message.value);
    sampling.lastValue = message.value;
    if (sampling.samples.length >= MAX_SAMPLES) {
      this.endWindow(sampling);
    }
    return true;
  }

  /** Ends a sampling window unless learn has moved on from it. */
  private endWindow(sampling: Sampling): void {
    const learn = this.store.learn();
    if (
      this.sampling !== sampling ||
      learn?.phase !== 'sampling' ||
      learn.source === null ||
      sourceKey(learn.source) !== sourceKey(sampling.source)
    ) {
      return;
    }
    this.clearSampling();

    const control = this.controls.find(learn.control);
    if (control === null) {
      this.cancel();
      return;
    }
    this.finish(
      learn,
      sampling.source,
      this.sampledStyle(control, sampling.samples),
      `${heard(sampling.portName, sampling.source, sampling.lastValue)} after ${
        sampling.samples.length
      } samples`
    );
  }

  private sampledStyle(control: MappableControl, samples: readonly number[]): MappingStyle {
    const kind = guessValueStyle(samples);
    return kind === null
      ? defaultStyle(control, 'cc')
      : { kind, amount: defaultAmountFor(control, kind) };
  }

  /** Binds `source` and logs it, naming what was `heard` (see `heard`). */
  private finish(
    learn: LearnState,
    source: MidiSource,
    style: MappingStyle,
    heardDescription: string
  ): void {
    this.clearSampling();
    const result =
      learn.replacing !== null
        ? this.mappings.replaceSource(learn.replacing, source, style)
        : this.mappings.bind(source, learn.control, style);
    this.store.setLearn({ learn: null });
    if (result === null) {
      return;
    }

    const bound = `${this.label(learn.control)}, bound to ${describeSource(
      source,
      this.store.controllers()
    )}`;
    const moved = result.movedFrom === null ? '' : `, moved from ${this.label(result.movedFrom)}`;
    this.store.announce({ text: `${bound}${moved}` });
    logInfo(
      LogType.Midi,
      `MIDI learn ${moved === '' ? 'bound' : 'moved'} ${controlKey(learn.control)} to ${sourceKey(
        source
      )}, ${heardDescription}`
    );
  }

  /** `<control name>, <owner>`. */
  private label(identity: ControlIdentity): string {
    const name = this.controls.find(identity)?.name ?? identity.control;
    return `${name}, ${ownerLabel(identity.owner)}`;
  }

  private clearSampling(): void {
    if (this.sampling !== null) {
      clearTimeout(this.sampling.timer);
      this.sampling = null;
    }
  }
}

/** What learn heard, for its log lines: `from "<port>" ch <n> <kind> <number> value <v>`. */
function heard(
  portName: string,
  message: Pick<MidiInputMessage, 'channel' | 'kind' | 'number'>,
  value: number
): string {
  return `from "${portName}" ch ${message.channel} ${message.kind} ${message.number} value ${value}`;
}
