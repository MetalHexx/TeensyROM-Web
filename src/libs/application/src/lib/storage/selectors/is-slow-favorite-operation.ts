import { Signal, Injector, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { timer, of } from 'rxjs';
import { map, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';

const FAVORITE_OPERATION_DELAY_MS = 3500;

export function isSlowFavoriteOperation(store: WritableStore<StorageState>) {
  let cachedSignal: Signal<boolean> | null = null;

  return {
    /**
     * Returns a signal indicating if a favorite operation is taking longer than 2 seconds.
     * Uses a delayed emission strategy to avoid showing dialogs for fast operations.
     * @returns Signal<boolean> - true if operation has been processing for more than 2 seconds
     */
    isSlowFavoriteOperation: (): Signal<boolean> => {
      if (cachedSignal) {
        return cachedSignal;
      }

      const injector = inject(Injector);

      const slowFavoriteOperation$ = toObservable(store.favoriteOperationsState, {
        injector,
      }).pipe(
        map((state) => state.isProcessing),
        distinctUntilChanged(),
        switchMap((isProcessing) =>
          isProcessing ? timer(FAVORITE_OPERATION_DELAY_MS).pipe(map(() => true)) : of(false)
        )
      );

      cachedSignal = toSignal(slowFavoriteOperation$, {
        injector,
        initialValue: false,
      });

      return cachedSignal;
    },
  };
}
