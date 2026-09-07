import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/**
 * Polls `read` once per animation frame. For continuous values — the playhead, stats — which are
 * deliberately not notified: pushing them through a store's `subscribe` would be *worse* than
 * today's behaviour, not better, because Angular signals are lazy and a naive eager push would
 * fire change detection at 50 Hz whether or not anything is actually reading the value.
 *
 * Stops when the injection context is destroyed and while the document is hidden — two decks each
 * polling stats on a background tab is work nobody can see — and resumes when it is visible again.
 *
 * Must be called from an injection context.
 */
export function animationFrameSignal<T>(read: () => T): Signal<T> {
  const destroyRef = inject(DestroyRef);
  const value = signal(read());
  let frameId: number | null = null;

  const tick = (): void => {
    value.set(read());
    frameId = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (frameId === null && !document.hidden) {
      frameId = requestAnimationFrame(tick);
    }
  };

  const stop = (): void => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  start();

  destroyRef.onDestroy(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  return value.asReadonly();
}
