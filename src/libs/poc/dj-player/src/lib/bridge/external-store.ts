import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/**
 * Wraps core's external store as a signal. Subscribes once, unsubscribes on destroy.
 *
 * Relies on `getSnapshot()` being referentially stable — an identity change is the only thing that
 * marks the signal dirty. No value comparison is layered on top: core guarantees the snapshot's
 * identity changes only when the state does, so a value comparison would either be redundant or
 * hide a core bug.
 *
 * Must be called from an injection context.
 */
export function storeSignal<T>(store: {
  subscribe(cb: () => void): () => void;
  getSnapshot(): T;
}): Signal<T> {
  const destroyRef = inject(DestroyRef);
  const value = signal(store.getSnapshot());
  const unsubscribe = store.subscribe(() => value.set(store.getSnapshot()));
  destroyRef.onDestroy(unsubscribe);
  return value.asReadonly();
}
