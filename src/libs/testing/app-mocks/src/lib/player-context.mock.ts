import { signal } from '@angular/core';
import { vi } from 'vitest';
import type { IPlayerContext } from '@teensyrom-nx/application';
import { PlayerStatus, LaunchMode } from '@teensyrom-nx/domain';

/**
 * Builds a `Partial<IPlayerContext>` that stubs every member of the contract with a
 * sensible default, so a spec providing it under `PLAYER_CONTEXT` never trips an
 * unstubbed-method error. Signal-returning members default to a writable signal;
 * pass a pre-made signal through `overrides` (wrapped in `vi.fn()`) to drive it from
 * the test, mirroring the pattern in `storage-container.component.spec.ts`.
 */
export function createMockPlayerContext(
  overrides: Partial<IPlayerContext> = {}
): Partial<IPlayerContext> {
  return {
    initializePlayer: vi.fn(),
    removePlayer: vi.fn(),
    startListeningToPopState: vi.fn(),
    stopListeningToPopState: vi.fn(),
    launchFileWithContext: vi.fn().mockResolvedValue(undefined),
    updateCurrentFileFavoriteStatus: vi.fn(),
    getCurrentFile: vi.fn().mockReturnValue(signal(null).asReadonly()),
    getFileContext: vi.fn().mockReturnValue(signal(null).asReadonly()),
    isLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
    isSlowLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
    getError: vi.fn().mockReturnValue(signal(null).asReadonly()),
    getStatus: vi.fn().mockReturnValue(signal(PlayerStatus.Stopped).asReadonly()),
    launchRandomFile: vi.fn().mockResolvedValue(undefined),
    toggleShuffleMode: vi.fn(),
    setShuffleScope: vi.fn(),
    setFilterMode: vi.fn(),
    getShuffleSettings: vi.fn().mockReturnValue(signal(null).asReadonly()),
    getLaunchMode: vi.fn().mockReturnValue(signal(LaunchMode.Directory).asReadonly()),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
    getPlayerStatus: vi.fn().mockReturnValue(signal(PlayerStatus.Stopped).asReadonly()),
    getTimerState: vi.fn().mockReturnValue(signal(null).asReadonly()),
    getPlayTimerConfig: vi.fn().mockReturnValue(signal(null).asReadonly()),
    setCustomTimer: vi.fn(),
    isCurrentFileCompatible: vi.fn().mockReturnValue(signal(true).asReadonly()),
    getPlayHistory: vi.fn().mockReturnValue(signal(null).asReadonly()),
    getCurrentHistoryPosition: vi.fn().mockReturnValue(signal(0).asReadonly()),
    canNavigateBackwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
    canNavigateForwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
    clearHistory: vi.fn(),
    toggleHistoryView: vi.fn(),
    isHistoryViewVisible: vi.fn().mockReturnValue(signal(false).asReadonly()),
    navigateToHistoryPosition: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
