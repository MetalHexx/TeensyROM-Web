import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { updateState } from '@angular-architects/ngrx-toolkit';
import '@analogjs/vitest-angular/setup-zone';
import { StorageStore, StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';
import { isSlowFavoriteOperation } from './is-slow-favorite-operation';
import { STORAGE_SERVICE, IStorageService } from '@teensyrom-nx/domain';

/**
 * Tests for isSlowFavoriteOperation selector functionality
 *
 * This test suite verifies the slow favorite operation indicator feature which:
 * - Returns a Signal<boolean> tracking if a favorite operation is slow (> 3.5 seconds)
 * - Uses a 3.5-second delay threshold before returning true
 * - Cancels the delay if operation completes quickly (< 3.5 seconds)
 * - Returns to false immediately when operation completes
 * - Handles multiple rapid state changes
 * - Caches and reuses the same signal instance
 *
 * NOTE: These tests use REAL timers with actual delays to avoid fake timer issues.
 * Test timeouts are set to accommodate the 3.5+ second delays.
 */
describe('isSlowFavoriteOperation', () => {
  let store: WritableStore<StorageState>;
  let mockStorageService: IStorageService;

  // Helper to wait for async operations with real timers
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Helper function to update favorite operation processing state in the store
  const setFavoriteProcessing = (isProcessing: boolean, error: string | null = null) => {
    updateState(store, 'test-set-favorite-processing', () => ({
      favoriteOperationsState: {
        isProcessing,
        error,
      },
    }));
  };

  beforeEach(() => {
    // Mock storage service
    mockStorageService = {
      getDirectory: vi.fn(),
      index: vi.fn(),
      indexAll: vi.fn(),
      search: vi.fn(),
      saveFavorite: vi.fn(),
      removeFavorite: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        StorageStore,
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    });

    store = TestBed.inject(StorageStore) as unknown as WritableStore<StorageState>;
  });

  describe('Initial State', () => {
    it('should return false initially when no operation is processing', () => {
      const slowOperationSignal = TestBed.runInInjectionContext(() => {
        const selector = isSlowFavoriteOperation(store);
        return selector.isSlowFavoriteOperation();
      });
      expect(slowOperationSignal()).toBe(false);
    });

    it('should cache and return the same signal instance on multiple calls', () => {
      const signals = TestBed.runInInjectionContext(() => {
        const selector = isSlowFavoriteOperation(store);
        const signal1 = selector.isSlowFavoriteOperation();
        const signal2 = selector.isSlowFavoriteOperation();
        return { signal1, signal2 };
      });
      expect(signals.signal1).toBe(signals.signal2);
    });
  });

  describe('3.5-Second Delay Threshold', () => {
    it(
      'should return false immediately when operation starts',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);
        expect(slowOperationSignal()).toBe(false);
      },
      { timeout: 5000 }
    );

    it(
      'should return true after 3.5 seconds when operation is still processing',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);
        expect(slowOperationSignal()).toBe(false);

        // Wait 3.5+ seconds for the delay to trigger
        await wait(3600);
        expect(slowOperationSignal()).toBe(true);
      },
      { timeout: 6000 }
    );

    it(
      'should stay false for fast operations that complete before 3.5 seconds',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);
        expect(slowOperationSignal()).toBe(false);

        // Complete before 3.5 seconds
        await wait(2000);
        setFavoriteProcessing(false);

        // Wait past the 3.5-second mark
        await wait(2000);
        expect(slowOperationSignal()).toBe(false);
      },
      { timeout: 6000 }
    );

    it(
      'should return false immediately when slow operation completes',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);

        // Wait for slow operation to trigger
        await wait(3600);
        expect(slowOperationSignal()).toBe(true);

        // Complete operation - should immediately go false
        setFavoriteProcessing(false);
        await wait(50);
        expect(slowOperationSignal()).toBe(false);
      },
      { timeout: 6000 }
    );

    it(
      'should not trigger for operations that complete just before threshold',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);

        // Complete at 3.4 seconds (just before threshold)
        await wait(3400);
        setFavoriteProcessing(false);

        // Wait a bit more to ensure signal doesn't flip
        await wait(300);
        expect(slowOperationSignal()).toBe(false);
      },
      { timeout: 6000 }
    );
  });

  describe('Multiple Rapid State Changes', () => {
    it(
      'should handle rapid start/stop cycles',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        // Quick operation 1
        setFavoriteProcessing(true);
        await wait(500);
        setFavoriteProcessing(false);

        // Quick operation 2
        await wait(100);
        setFavoriteProcessing(true);
        await wait(500);
        setFavoriteProcessing(false);

        // Quick operation 3
        await wait(100);
        setFavoriteProcessing(true);
        await wait(500);
        setFavoriteProcessing(false);

        // Wait past threshold
        await wait(3000);

        // Should never have become true
        expect(slowOperationSignal()).toBe(false);
      },
      { timeout: 6000 }
    );

    it(
      'should reset delay timer when operation stops and starts again',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        // Start operation 1
        setFavoriteProcessing(true);
        await wait(2000);

        // Stop before threshold
        setFavoriteProcessing(false);
        await wait(100);

        // Start operation 2 - timer should reset
        setFavoriteProcessing(true);
        await wait(2000);

        // Still processing but less than 3.5 seconds for operation 2
        expect(slowOperationSignal()).toBe(false);

        // Wait for operation 2 to cross threshold
        await wait(1700);
        expect(slowOperationSignal()).toBe(true);
      },
      { timeout: 8000 }
    );

    it(
      'should handle operation that stops and restarts before threshold',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);
        await wait(1000);

        // Stop briefly
        setFavoriteProcessing(false);
        await wait(50);

        // Restart
        setFavoriteProcessing(true);

        // Combined time is > 3.5s but each individual operation is not
        await wait(3000);

        // Should not be true yet (timer restarted)
        expect(slowOperationSignal()).toBe(false);

        await wait(600);

        // Now should be true
        expect(slowOperationSignal()).toBe(true);
      },
      { timeout: 6000 }
    );
  });

  describe('Error Handling', () => {
    it(
      'should return false when operation completes with error',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);

        // Wait for slow operation to trigger
        await wait(3600);
        expect(slowOperationSignal()).toBe(true);

        // Complete with error
        setFavoriteProcessing(false, 'Operation failed');
        await wait(50);
        expect(slowOperationSignal()).toBe(false);
      },
      { timeout: 6000 }
    );

    it(
      'should not affect delay if error is set while still processing',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);

        // Set error while still processing (shouldn't affect timer)
        await wait(2000);
        setFavoriteProcessing(true, 'Some error');

        // Continue waiting
        await wait(1700);
        expect(slowOperationSignal()).toBe(true);
      },
      { timeout: 6000 }
    );
  });

  describe('Edge Cases', () => {
    it('should handle being called before any state changes', () => {
      const slowOperationSignal = TestBed.runInInjectionContext(() => {
        const selector = isSlowFavoriteOperation(store);
        return selector.isSlowFavoriteOperation();
      });
      expect(slowOperationSignal()).toBe(false);
    });

    it(
      'should handle multiple simultaneous subscribers to the same signal',
      async () => {
        const signals = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          const signal1 = selector.isSlowFavoriteOperation();
          const signal2 = selector.isSlowFavoriteOperation();
          return { signal1, signal2 };
        });

        setFavoriteProcessing(true);

        await wait(3600);

        // Both signals should reflect the same state
        expect(signals.signal1()).toBe(true);
        expect(signals.signal2()).toBe(true);

        setFavoriteProcessing(false);
        await wait(50);

        expect(signals.signal1()).toBe(false);
        expect(signals.signal2()).toBe(false);
      },
      { timeout: 6000 }
    );

    it(
      'should handle operation that exactly hits the threshold',
      async () => {
        const slowOperationSignal = TestBed.runInInjectionContext(() => {
          const selector = isSlowFavoriteOperation(store);
          return selector.isSlowFavoriteOperation();
        });

        setFavoriteProcessing(true);

        // Wait slightly more than 3.5 seconds to ensure we cross the threshold
        await wait(3550);

        // Should be true at or after threshold
        expect(slowOperationSignal()).toBe(true);
      },
      { timeout: 5000 }
    );
  });

  describe('Signal Caching', () => {
    it('should return cached signal within same injection context', () => {
      const signals = TestBed.runInInjectionContext(() => {
        const selector = isSlowFavoriteOperation(store);
        const signal1 = selector.isSlowFavoriteOperation();
        const signal2 = selector.isSlowFavoriteOperation();

        return { signal1, signal2 };
      });

      // Should be the same cached instance within same context
      expect(signals.signal1).toBe(signals.signal2);
    });

    it(
      'cached signal should continue to work after creating new selector instances',
      async () => {
        const signals = TestBed.runInInjectionContext(() => {
          const selector1 = isSlowFavoriteOperation(store);
          const signal1 = selector1.isSlowFavoriteOperation();

          setFavoriteProcessing(true);

          // Create second selector - should get cached signal
          const selector2 = isSlowFavoriteOperation(store);
          const signal2 = selector2.isSlowFavoriteOperation();

          return { signal1, signal2 };
        });

        await wait(3600);

        // Both should reflect current state
        expect(signals.signal1()).toBe(true);
        expect(signals.signal2()).toBe(true);
      },
      { timeout: 6000 }
    );
  });
});
