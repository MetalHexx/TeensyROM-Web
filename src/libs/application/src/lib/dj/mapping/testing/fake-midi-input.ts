import { signal } from '@angular/core';
import {
  PITCH_BEND_CENTRE,
  type IMidiInput,
  type MidiInputMessage,
  type MidiInputOpenResult,
  type MidiInputPort,
} from '../../ports';

/**
 * An in-memory `IMidiInput`. A port is plugged in with `plug` and pulled with `unplug`; its `open`
 * answers `open` unless `answer` says otherwise, and `missing` for a port that is not plugged in.
 */
export class FakeMidiInput implements IMidiInput {
  readonly inputs = signal<readonly MidiInputPort[]>([]);
  readonly openCalls: string[] = [];
  readonly closeCalls: string[] = [];

  private readonly open_ = new Set<string>();
  private readonly answers = new Map<string, MidiInputOpenResult>();
  private readonly listeners = new Set<(message: MidiInputMessage) => void>();

  async open(portId: string): Promise<MidiInputOpenResult> {
    this.openCalls.push(portId);
    const port = this.inputs().find((candidate) => candidate.id === portId);
    if (port === undefined || !port.connected) {
      return 'missing';
    }
    const result = this.answers.get(portId) ?? 'open';
    if (result === 'open') {
      this.open_.add(portId);
    }
    return result;
  }

  close(portId: string): void {
    this.closeCalls.push(portId);
    this.open_.delete(portId);
  }

  isOpen(portId: string): boolean {
    return this.open_.has(portId);
  }

  subscribe(listener: (message: MidiInputMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Lists a connected input, replacing any listed under the same id. */
  plug(id: string, name: string): void {
    this.inputs.update((ports) => [
      ...ports.filter((port) => port.id !== id),
      { id, name, manufacturer: 'Test', connected: true },
    ]);
  }

  /** Removes an input from the list, which also drops its open connection. */
  unplug(id: string): void {
    this.open_.delete(id);
    this.inputs.update((ports) => ports.filter((port) => port.id !== id));
  }

  /** What `open` answers for a port from now on. */
  answer(portId: string, result: MidiInputOpenResult): void {
    this.answers.set(portId, result);
  }

  /** Delivers a message as an open port would. */
  emit(
    portId: string,
    kind: 'note' | 'cc',
    number: number,
    value: number,
    channel = 1,
    timeStampMs = performance.now()
  ): void {
    const pressed = kind === 'note' ? value > 0 : value >= 64;
    this.deliver({ portId, kind, channel, number, value, pressed, timeStampMs });
  }

  /** Delivers a pitch bend (0–16383) as an open port would. */
  emitPitchBend(portId: string, value: number, channel = 1, timeStampMs = performance.now()): void {
    this.deliver({
      portId,
      kind: 'pitch-bend',
      channel,
      number: 0,
      value,
      pressed: value !== PITCH_BEND_CENTRE,
      timeStampMs,
    });
  }

  private deliver(message: MidiInputMessage): void {
    for (const listener of [...this.listeners]) {
      listener(message);
    }
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }
}
