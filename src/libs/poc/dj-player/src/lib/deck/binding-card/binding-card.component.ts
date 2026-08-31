import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import { DeckContext } from '../deck-context';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MidiAccessService } from '../../midi/midi-access.service';

/**
 * The deck letter, this deck's own Output port selector, and its own Enable MIDI beside Identify —
 * everything MIDI-facing that used to sit in the transport panel or the page-level setup sidebar,
 * now bottom of this deck's own column, below Loops/Cues.
 *
 * `MidiAccessService` is page-level (the permission grant and the enumerated port list are shared),
 * but the button that requests it is deliberately duplicated here and on the other deck's own card —
 * the grant itself is one thing, but each deck still has to restore its own persisted selection once
 * it lands, and the control has to be reachable from either card without expanding a drawer.
 *
 * Reads every collaborator from the deck injector it renders inside (`DeckHostComponent`'s
 * `providers`) — no inputs, because the injector already resolves per deck.
 */
@Component({
  selector: 'lib-binding-card',
  templateUrl: './binding-card.component.html',
  styleUrl: './binding-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BindingCardComponent {
  private readonly context = inject(DeckContext);
  private readonly binding = inject(DeckMidiBinding);
  private readonly midiAccess = inject(MidiAccessService);
  private readonly engine = inject(DjPlayerEngine);

  protected readonly label = this.context.label;

  protected readonly midiAccessState = this.midiAccess.accessState;
  protected readonly midiPorts = this.midiAccess.ports;
  protected readonly midiAccessError = this.midiAccess.lastError;
  protected readonly selectedPortId = this.binding.selectedPortId;
  protected readonly bindingError = this.binding.lastError;

  // Web MIDI enumerates zero ports for a granted-but-empty session (no cartridge attached, or the OS
  // hasn't surfaced it yet) without the service itself treating that as an error.
  protected readonly noPortsFoundError = computed<string | null>(() =>
    this.midiAccessState() === 'granted' && this.midiPorts().length === 0
      ? 'MIDI access was granted, but no output ports were found. Connect the cartridge and re-enable MIDI.'
      : null
  );

  /** Whether Identify is reachable: access must be granted, this deck must hold a port, and
   *  identifying interrupts the stream on the cartridge, so it stays out of reach while this deck
   *  plays. */
  protected readonly canIdentify = computed<boolean>(
    () =>
      this.midiAccessState() === 'granted' &&
      this.selectedPortId() !== null &&
      this.engine.state() !== 'playing'
  );

  /** Requests the page-level grant, then restores this deck's own persisted selection — mirrors the
   *  old page-level sequence, narrowed to this deck's own binding, since this card knows only its
   *  own deck's collaborators. Idempotent: a second press while already granted just re-enumerates
   *  and restores again, which is itself a no-op once a selection already stands. */
  protected onEnableMidi(): void {
    void this.midiAccess.requestAccess().then(() => this.binding.restore());
  }

  protected onSelectPort(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.binding.selectPort(select.value);
  }

  protected onIdentify(): void {
    const ports = this.midiPorts();
    const index = ports.findIndex((port) => port.id === this.selectedPortId());
    const label = index === -1 ? 'ASID-DJ-0 PORT ?' : `ASID-DJ-0 PORT ${index + 1}`;
    this.binding.identify(label);
  }
}
