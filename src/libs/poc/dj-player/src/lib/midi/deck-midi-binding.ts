import { computed, effect, Injectable, signal, type Signal } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import { buildDisplayCharsPacket } from '../asid/asid-encoder';
import { MidiAccessService } from './midi-access.service';

/** The three members `DeliveryTransport` and `DjPlayerEngine` actually use — deliberately narrower
 *  than `DeckMidiBinding` itself, so a plain test double can stand in for either collaborator
 *  without implementing selection, persistence or identify. */
export interface DeckMidiPort {
  readonly selectedPortId: Signal<string | null>;
  readonly supportsCancel: Signal<boolean>;
  send(bytes: Uint8Array, timestampMs?: number): void;
  cancelPending(): boolean;
}

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
export class DeckMidiBinding implements DeckMidiPort {
  deckId = '';

  private readonly _selectedPortId = signal<string | null>(null);
  readonly selectedPortId: Signal<string | null> = this._selectedPortId.asReadonly();
  readonly lastError = signal<string | null>(null);
  /**
   * Resolved against *this deck's* selected port, not "whichever port is selected somewhere" —
   * `DeliveryTransport` re-derives its cancel ceiling from this on every send, so it has to track
   * this deck and no other. Reads `access.ports()` unconditionally alongside the selection so a
   * port object replaced in place by a reconnect (same id, new capability) is picked up even though
   * the selection itself never changed.
   */
  readonly supportsCancel = computed<boolean>(() => {
    this.access.ports();
    const id = this._selectedPortId();
    return id === null ? false : this.access.supportsCancel(id);
  });

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
      logWarn(`MIDI: could not persist deck "${this.deckId}"'s selected port to localStorage — ${error}`);
    }
  }

  /** No-op with a warning when this deck has no port selected. `timestampMs` passes straight
   *  through to `MidiAccessService.send`; omitting it sends immediately. */
  send(bytes: Uint8Array, timestampMs?: number): void {
    const id = this._selectedPortId();
    if (id === null) {
      logWarn('MIDI: send() called with no MIDI port selected — bytes dropped.');
      return;
    }
    this.access.send(id, bytes, timestampMs);
  }

  /** Reports false, never throws, when this deck has no port selected — mirrors
   *  `MidiAccessService.cancelPending`'s own "false covers every reason it didn't cancel" contract. */
  cancelPending(): boolean {
    const id = this._selectedPortId();
    return id === null ? false : this.access.cancelPending(id);
  }

  /**
   * Sends a display-chars packet so the tester can see which physical C64 this deck's port drives.
   * Web MIDI exposes nothing that distinguishes two identical cartridges, so this is a confirmation
   * gesture, not a lookup — and it is not free: the firmware's `PrintflnToASID()` stops the playback
   * timer, drains the queue with a blocking wait, and re-initialises it, so sending this mid-tune
   * audibly interrupts the music.
   */
  identify(text: string): void {
    this.send(buildDisplayCharsPacket(text));
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
