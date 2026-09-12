import { effect, Injectable, signal, type Signal } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import type { AsidSink, MidiOutputPort } from '@sidablist/asid';
// The `./web-midi` subpath, not the package root — the browser adapter is deliberately kept out of
// the entry point every non-browser consumer imports.
import { midiOutputPortFrom } from '@sidablist/asid/web-midi';
import { MidiAccessService } from './midi-access.service';
import type { MIDIOutputLike } from './midi-access.service';

/** Namespaces a deck's persisted selection under its own key, so two decks sharing the browser's
 *  `localStorage` never collide and restoring one can never touch the other's. */
function storageKeyFor(deckId: string): string {
  return `asid-dj-0.deck-${deckId}.selected-midi-port`;
}

/**
 * One deck's binding onto a `MidiAccessService`: which port this deck drives, its own persisted
 * selection, and the identify gesture. Two `DeckMidiBinding`s over the same `MidiAccessService`
 * can hold two different ports at once, and neither's loss, error or persisted key touches the
 * other's.
 *
 * `deckId` is a constructor-free field rather than a constructor parameter: `DeckHostComponent`
 * sets it from `DeckContext` right after `context.adopt(...)`, since providers resolve before that
 * adoption ever runs. Every read of it here is lazy — nothing in this class needs the identity to
 * be known before its first method call.
 */
@Injectable()
export class DeckMidiBinding {
  deckId = '';

  /**
   * The deck's ASID sink, set by `DeckHostComponent` right after the deck's injector resolves.
   *
   * A constructor-free field for the same reason `deckId` is, and for one more: the sink is built
   * over *this binding's own* `outputPort`, so injecting it here would close a construction-time
   * cycle. Nothing in this class reads it before `identify` is called.
   */
  sink: AsidSink | null = null;

  private readonly _selectedPortId = signal<string | null>(null);
  readonly selectedPortId: Signal<string | null> = this._selectedPortId.asReadonly();
  readonly lastError = signal<string | null>(null);

  /**
   * This deck's selected output as the port an ASID sink schedules against — a stable façade that
   * re-resolves the selection on every call, so a port swap needs no rebuild of the sink above it.
   *
   * Reports `portId: null` and drops writes while nothing is selected, which is what lets the sink
   * be built at provider time, before the operator has chosen anything.
   */
  readonly outputPort: MidiOutputPort = this.createOutputPort();

  /** The most recently wrapped output and the wrapper built over it — see `resolvePort`. */
  private wrappedOutput: MIDIOutputLike | null = null;
  private wrappedPort: MidiOutputPort | null = null;

  constructor(private readonly access: MidiAccessService) {
    effect(() => {
      const id = this._selectedPortId();
      if (id === null) {
        return;
      }
      const stillEnumerated = this.access.ports().some((port) => port.id === id);
      if (stillEnumerated) {
        return;
      }
      this._selectedPortId.set(null);
      this.lastError.set(
        'The selected MIDI port disappeared — check the connection and re-select it.'
      );
      this.access.release(this.deckId);
      logWarn(
        `MIDI: deck "${this.deckId}"'s selected port "${id}" is no longer present; selection cleared.`
      );
    });
  }

  /**
   * Claims `id` for this deck. Refused, not silent: when another deck already holds it, the
   * selection is left untouched, `lastError` names the deck that holds it, and neither the claim
   * nor the other deck's own selection is disturbed.
   */
  selectPort(id: string): void {
    if (!this.access.claim(this.deckId, id)) {
      const holder = this.access.deckHolding(id);
      this.lastError.set(
        holder === null
          ? 'That port is already claimed. Pick a different one.'
          : `Deck ${holder} is already bound to that port. Pick a different one.`
      );
      return;
    }

    this._selectedPortId.set(id);
    this.lastError.set(null);
    try {
      localStorage.setItem(storageKeyFor(this.deckId), id);
    } catch (error) {
      logWarn(
        `MIDI: could not persist deck "${this.deckId}"'s selected port to localStorage — ${error}`
      );
    }
  }

  /**
   * Releases this deck's claim, if it holds one, and forgets its persisted choice — the
   * placeholder option's target. Distinct from `selectPort`: an empty id is not a port, so it must
   * never reach `access.claim`, which would otherwise let this deck "hold" a port that does not
   * exist and read as selected (`selectedPortId() !== null`) with nothing behind it.
   */
  clearSelection(): void {
    this._selectedPortId.set(null);
    this.lastError.set(null);
    this.access.release(this.deckId);
    try {
      localStorage.removeItem(storageKeyFor(this.deckId));
    } catch (error) {
      logWarn(
        `MIDI: could not clear deck "${this.deckId}"'s persisted port selection from localStorage — ${error}`
      );
    }
  }

  private createOutputPort(): MidiOutputPort {
    // Closed over rather than reached through `this`: the object below needs its own `this` for the
    // two getters `MidiOutputPort` declares as properties.
    const selectedPortId = this._selectedPortId;
    const resolve = (): MidiOutputPort | null => this.resolvePort();

    return {
      get portId(): string | null {
        return selectedPortId();
      },
      get supportsCancel(): boolean {
        return resolve()?.supportsCancel ?? false;
      },
      send(bytes: Uint8Array, timestampMs?: number): void {
        const port = resolve();
        if (port === null) {
          logWarn('MIDI: send() called with no MIDI port selected — bytes dropped.');
          return;
        }
        port.send(bytes, timestampMs);
      },
      cancelPending(): boolean {
        return resolve()?.cancelPending() ?? false;
      },
    };
  }

  /** The wrapped output for whatever this deck currently holds, or null. Memoised on the output
   *  object's identity rather than its id, so a same-id reconnect that replaces the object re-wraps
   *  instead of sending into the detached one — and a steady stream costs one map lookup per frame
   *  rather than a fresh wrapper. */
  private resolvePort(): MidiOutputPort | null {
    const id = this._selectedPortId();
    const output = id === null ? null : this.access.outputFor(id);
    if (output === null) {
      this.wrappedOutput = null;
      this.wrappedPort = null;
      return null;
    }
    if (output !== this.wrappedOutput) {
      this.wrappedOutput = output;
      // The service works against its own minimal shape of the output; `midiOutputPortFrom` works
      // against the DOM lib's. Both describe the same object — this is where they meet.
      this.wrappedPort = midiOutputPortFrom(output as unknown as MIDIOutput);
    }
    return this.wrappedPort;
  }

  /**
   * Shows this deck's label on the cartridge so the tester can see which physical C64 its port
   * drives. Web MIDI exposes nothing that distinguishes two identical cartridges, so this is a
   * confirmation gesture, not a lookup — and it is not free: the firmware's `PrintflnToASID()` stops
   * the playback timer, drains the queue with a blocking wait, and re-initialises it, so sending
   * this mid-tune audibly interrupts the music.
   *
   * Routed through the sink rather than encoded here: building the display-chars packet in this
   * repository is the one thing that would put a SysEx byte back on the application's side of the
   * boundary.
   */
  identify(text: string): void {
    if (this.sink === null) {
      logWarn(`MIDI: identify() called for deck "${this.deckId}" before its sink was set.`);
      return;
    }
    this.sink.showText(text);
  }

  /**
   * Restores this deck's persisted port if it is still enumerated and not already legitimately held
   * by another deck. A no-op when this deck already has a selection, when nothing was persisted, or
   * when the persisted port is gone or claimed elsewhere. Idempotent — safe to call again after a
   * later grant populates `access.ports()`, which is when the caller (the view, for now; `DeckContext`
   * once P01-T02 lands) is expected to call it.
   */
  restore(): void {
    if (this._selectedPortId() !== null) {
      return;
    }

    let storedId: string | null;
    try {
      storedId = localStorage.getItem(storageKeyFor(this.deckId));
    } catch (error) {
      logWarn(
        `MIDI: could not read deck "${this.deckId}"'s persisted port selection from localStorage — ${error}`
      );
      return;
    }

    if (storedId === null || !this.access.ports().some((port) => port.id === storedId)) {
      return;
    }
    if (!this.access.claim(this.deckId, storedId)) {
      return;
    }
    this._selectedPortId.set(storedId);
  }
}
