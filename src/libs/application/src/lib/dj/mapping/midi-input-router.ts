import { DestroyRef, Injectable, inject } from '@angular/core';
import { MIDI_INPUT, type IMidiInput, type MidiInputMessage } from '../ports';
import { MidiControllers } from './midi-controllers';
import { MidiLearn } from './midi-learn';
import { MidiMappingEngine } from './midi-mapping-engine';
import { MidiMappingStore } from './midi-mapping-store';

/**
 * Sends each message from an open input to where it belongs: learn when it is capturing a
 * mapping, otherwise the engine through the controller behind the port. A port no controller owns
 * has no mappings, so its messages are dropped.
 */
@Injectable({ providedIn: 'root' })
export class MidiInputRouter {
  private readonly midiInput: IMidiInput = inject(MIDI_INPUT);
  private readonly store = inject(MidiMappingStore);
  private readonly learn = inject(MidiLearn);
  private readonly controllers = inject(MidiControllers);
  private readonly engine = inject(MidiMappingEngine);

  private unsubscribe: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unsubscribe?.());
  }

  /** Subscribes to the input port, once. */
  start(): void {
    if (this.unsubscribe !== null) {
      return;
    }
    this.unsubscribe = this.midiInput.subscribe((message) => this.route(message));
  }

  private route(message: MidiInputMessage): void {
    if (!this.endsHold(message)) {
      const portName =
        this.midiInput.inputs().find((port) => port.id === message.portId)?.name ?? '';
      if (this.learn.offer(message, portName)) {
        return;
      }
    }

    const controllerId = this.controllers.controllerForPort(message.portId);
    if (controllerId === null) {
      return;
    }
    // Mapping mode can hold the port of a controller whose listening is off: its mappings stay silent.
    const controller = this.store.controllers().find((known) => known.id === controllerId);
    if (controller === undefined || !controller.listening) {
      return;
    }

    this.engine.handle({
      controllerId,
      channel: message.channel,
      kind: message.kind,
      number: message.number,
      value: message.value,
      pressed: message.pressed,
      timeStampMs: message.timeStampMs,
    });
  }

  /** Whether the message is the key-up of a hold in progress. It belongs to the engine even while
   *  learn is capturing: learn would take it as the first message after a selection, and the hold
   *  would stay down. */
  private endsHold(message: MidiInputMessage): boolean {
    if (message.pressed) {
      return false;
    }
    const controllerId = this.controllers.controllerForPort(message.portId);
    return (
      controllerId !== null &&
      this.engine.isHolding({
        controllerId,
        channel: message.channel,
        kind: message.kind,
        number: message.number,
      })
    );
  }
}
