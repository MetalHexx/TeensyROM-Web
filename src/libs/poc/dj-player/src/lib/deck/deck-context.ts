import { computed, Injectable, signal, type Signal } from '@angular/core';
import type { DeckDescriptor } from './deck.config';

/**
 * The one holder every deck-scoped collaborator reaches a deck's identity through. Angular resolves
 * a component's `providers` before its inputs are set, so nothing built from `DeckHostComponent`'s
 * provider list — `DjPlayerEngine`, `DeckMidiBinding`, and this class itself — may read the deck id
 * or label at construction time. This is the seam that lets them read it lazily instead: adopted
 * once `DeckHostComponent.ngOnInit` has its own `deck` input, and readable from then on.
 */
@Injectable()
export class DeckContext {
  private readonly _descriptor = signal<DeckDescriptor | null>(null);
  readonly descriptor: Signal<DeckDescriptor | null> = this._descriptor.asReadonly();

  /** '' before `adopt` — never null, so a storage-key template literal never embeds the string
   *  `"null"`. */
  readonly id: Signal<string> = computed(() => this._descriptor()?.id ?? '');
  readonly label: Signal<string> = computed(() => this._descriptor()?.label ?? '');

  /** Called exactly once, by `DeckHostComponent.ngOnInit`, from its own input. */
  adopt(descriptor: DeckDescriptor): void {
    this._descriptor.set(descriptor);
  }
}
