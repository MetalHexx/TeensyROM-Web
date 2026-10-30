import { afterEach, describe, expect, it, vi } from 'vitest';

function mockProductionMode(): void {
  vi.resetModules();
  vi.doMock('@angular/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@angular/core')>()),
    isDevMode: () => false,
  }));
}

describe('with-devtools', () => {
  afterEach(() => {
    vi.doUnmock('@angular/core');
    vi.resetModules();
  });

  describe('withDevtools', () => {
    it('is the toolkit devtools feature in dev mode', async () => {
      const toolkit = await import('@angular-architects/ngrx-toolkit');
      const { withDevtools } = await import('./with-devtools');

      expect(withDevtools).toBe(toolkit.withDevtools);
    });

    it('is the toolkit no-op stub in production', async () => {
      mockProductionMode();

      const toolkit = await import('@angular-architects/ngrx-toolkit');
      const { withDevtools } = await import('./with-devtools');

      expect(withDevtools).toBe(toolkit.withDevToolsStub);
    });
  });

  describe('updateState', () => {
    it('is the toolkit updateState in dev mode', async () => {
      const toolkit = await import('@angular-architects/ngrx-toolkit');
      const { updateState } = await import('./with-devtools');

      expect(updateState).toBe(toolkit.updateState);
    });

    it('patches the state directly in production, without the toolkit recording the action', async () => {
      mockProductionMode();
      const signals = await import('@ngrx/signals');
      const toolkit = await import('@angular-architects/ngrx-toolkit');
      const { updateState } = await import('./with-devtools');
      const state = signals.signalState({ count: 1 });

      updateState(state, 'increment [1]', (current) => ({ count: current.count + 1 }));

      expect(updateState).not.toBe(toolkit.updateState);
      expect(state.count()).toBe(2);
    });
  });
});
