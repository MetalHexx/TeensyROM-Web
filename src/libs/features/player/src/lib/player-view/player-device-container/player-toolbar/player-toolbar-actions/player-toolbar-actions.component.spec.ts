import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { LaunchMode, StorageType } from '@teensyrom-nx/domain';
import { StorageStore, StorageKeyUtil, type LaunchedFile, type PlayTimerConfig } from '@teensyrom-nx/application';
import { PlayerToolbarActionsComponent } from './player-toolbar-actions.component';

function createLaunchedFile(
  deviceId: string,
  storageType: StorageType,
  overrides: Parameters<typeof createTestFileItem>[0] = {}
): LaunchedFile {
  return {
    storageKey: StorageKeyUtil.create(deviceId, storageType),
    file: createTestFileItem(overrides),
    parentPath: '/test',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

function render(deviceId = 'test-device') {
  const currentFile = signal<LaunchedFile | null>(null);
  const launchMode = signal<LaunchMode>(LaunchMode.Directory);
  const timerConfig = signal<PlayTimerConfig | null>(null);
  const favoriteOperationsState = signal<{ isProcessing: boolean; error: string | null }>({
    isProcessing: false,
    error: null,
  });

  const mockStorageStore = {
    saveFavorite: vi.fn().mockResolvedValue(undefined),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    favoriteOperationsState: vi.fn(() => favoriteOperationsState()),
  };

  const context = {
    toggleShuffleMode: vi.fn(),
    getLaunchMode: vi.fn().mockReturnValue(launchMode),
    getCurrentFile: vi.fn().mockReturnValue(currentFile),
    updateCurrentFileFavoriteStatus: vi.fn(),
    getPlayTimerConfig: vi.fn().mockReturnValue(timerConfig),
    setCustomTimer: vi.fn(),
  };

  const result = renderPlayerComponent(PlayerToolbarActionsComponent, {
    inputs: { deviceId },
    playerContext: context,
    providers: [{ provide: StorageStore, useValue: mockStorageStore }],
  });

  return { ...result, context, mockStorageStore, currentFile, launchMode, timerConfig, favoriteOperationsState };
}

describe('PlayerToolbarActionsComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  it('forwards toggleShuffleMode to the context with the deviceId', () => {
    const { component, context } = render();

    component.toggleShuffleMode();

    expect(context.toggleShuffleMode).toHaveBeenCalledWith('test-device');
  });

  it('reflects the context launch mode in isShuffleMode', () => {
    const { component, launchMode } = render();

    launchMode.set(LaunchMode.Shuffle);
    expect(component.isShuffleMode()).toBe(true);

    launchMode.set(LaunchMode.Directory);
    expect(component.isShuffleMode()).toBe(false);
  });

  it('is not favorite when no file is loaded', () => {
    const { component } = render();

    expect(component.isFavorite()).toBe(false);
  });

  it('is favorite when the current file is flagged as favorite', () => {
    const { component, currentFile } = render();

    currentFile.set(createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true }));

    expect(component.isFavorite()).toBe(true);
  });

  it('is not favorite when the current file flag is false', () => {
    const { component, currentFile } = render();

    currentFile.set(createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false }));

    expect(component.isFavorite()).toBe(false);
  });

  it('reports no favorite operation in progress when idle', () => {
    const { component } = render();

    expect(component.isFavoriteOperationInProgress()).toBe(false);
  });

  it('reports a favorite operation in progress mid-save', () => {
    const { component, favoriteOperationsState } = render();

    favoriteOperationsState.set({ isProcessing: true, error: null });

    expect(component.isFavoriteOperationInProgress()).toBe(true);
  });

  it('saves and updates the context when toggling favorite on', async () => {
    const { component, context, mockStorageStore, currentFile } = render();
    currentFile.set(
      createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false, path: '/games/game.rom' })
    );

    await component.toggleFavorite();

    expect(mockStorageStore.saveFavorite).toHaveBeenCalledWith({
      deviceId: 'test-device',
      storageType: StorageType.Sd,
      filePath: '/games/game.rom',
    });
    expect(context.updateCurrentFileFavoriteStatus).toHaveBeenCalledWith(
      'test-device',
      '/games/game.rom',
      true
    );
  });

  it('removes and updates the context when toggling favorite off', async () => {
    const { component, context, mockStorageStore, currentFile } = render();
    currentFile.set(
      createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true, path: '/games/game.rom' })
    );

    await component.toggleFavorite();

    expect(mockStorageStore.removeFavorite).toHaveBeenCalledWith({
      deviceId: 'test-device',
      storageType: StorageType.Sd,
      filePath: '/games/game.rom',
    });
    expect(context.updateCurrentFileFavoriteStatus).toHaveBeenCalledWith(
      'test-device',
      '/games/game.rom',
      false
    );
  });

  it('is a no-op when no file is loaded', async () => {
    const { component, context, mockStorageStore } = render();

    await component.toggleFavorite();

    expect(mockStorageStore.saveFavorite).not.toHaveBeenCalled();
    expect(mockStorageStore.removeFavorite).not.toHaveBeenCalled();
    expect(context.updateCurrentFileFavoriteStatus).not.toHaveBeenCalled();
  });

  it('does not update the context when the save operation reports an error', async () => {
    const { component, context, mockStorageStore, currentFile, favoriteOperationsState } = render();
    currentFile.set(
      createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false, path: '/games/game.rom' })
    );
    favoriteOperationsState.set({ isProcessing: false, error: 'Failed to save' });

    await component.toggleFavorite();

    expect(mockStorageStore.saveFavorite).toHaveBeenCalled();
    expect(context.updateCurrentFileFavoriteStatus).not.toHaveBeenCalled();
  });

  it('returns early when an operation is already in progress', async () => {
    const { component, context, mockStorageStore, currentFile, favoriteOperationsState } = render();
    favoriteOperationsState.set({ isProcessing: true, error: null });
    currentFile.set(
      createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false, path: '/games/game.rom' })
    );

    await component.toggleFavorite();

    expect(mockStorageStore.saveFavorite).not.toHaveBeenCalled();
    expect(mockStorageStore.removeFavorite).not.toHaveBeenCalled();
    expect(context.updateCurrentFileFavoriteStatus).not.toHaveBeenCalled();
  });

  it('currentFile is null when no file is loaded', () => {
    const { component } = render();

    expect(component.currentFile()).toBeNull();
  });

  it('currentFile returns the file from the context', () => {
    const { component, currentFile } = render();
    const launchedFile = createLaunchedFile('test-device', StorageType.Sd);

    currentFile.set(launchedFile);

    expect(component.currentFile()).toEqual(launchedFile);
  });

  it('currentFile updates as the underlying signal changes', () => {
    const { component, currentFile } = render();
    const file1 = createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false });
    const file2 = createLaunchedFile('test-device', StorageType.Sd, { isFavorite: true });

    currentFile.set(file1);
    expect(component.currentFile()).toEqual(file1);

    currentFile.set(file2);
    expect(component.currentFile()).toEqual(file2);
  });

  it('reactively tracks a nested favorite-flag update', () => {
    const { component, currentFile } = render();
    const launchedFile = createLaunchedFile('test-device', StorageType.Sd, { isFavorite: false });
    currentFile.set(launchedFile);

    expect(component.isFavorite()).toBe(false);

    currentFile.set({ ...launchedFile, file: { ...launchedFile.file, isFavorite: true } });

    expect(component.isFavorite()).toBe(true);
  });

  it('renders exactly 4 icon-buttons (timer, history, shuffle, favorite)', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelectorAll('lib-icon-button').length).toBe(4);
  });

  it('exposes 8 duration options', () => {
    const { component } = render();

    expect(component['durationOptions'].length).toBe(8);
  });

  it('orders duration options strictly ascending', () => {
    const { component } = render();
    const options = component['durationOptions'];

    for (let i = 1; i < options.length; i++) {
      expect(options[i].valueMs).toBeGreaterThan(options[i - 1].valueMs);
    }
  });

  it('customTimerConfig is null when no config exists', () => {
    const { component } = render();

    expect(component.customTimerConfig()).toBeNull();
  });

  it('customTimerConfig returns the config from the context', () => {
    const { component, timerConfig } = render();
    const config = { enabled: true, durationMs: 180000 };

    timerConfig.set(config);

    expect(component.customTimerConfig()).toEqual(config);
  });

  it('isCustomTimerEnabled defaults to false', () => {
    const { component } = render();

    expect(component.isCustomTimerEnabled()).toBe(false);
  });

  it('isCustomTimerEnabled is true when the config is enabled', () => {
    const { component, timerConfig } = render();

    timerConfig.set({ enabled: true, durationMs: 180000 });

    expect(component.isCustomTimerEnabled()).toBe(true);
  });

  it('selectedDurationMs defaults to 180000', () => {
    const { component } = render();

    expect(component.selectedDurationMs()).toBe(180000);
  });

  it('selectedDurationMs returns the configured duration', () => {
    const { component, timerConfig } = render();

    timerConfig.set({ enabled: true, durationMs: 30000 });

    expect(component.selectedDurationMs()).toBe(30000);
  });

  it('isCustomTimerEnabled updates reactively across config changes', () => {
    const { component, timerConfig } = render();

    timerConfig.set({ enabled: false, durationMs: 180000 });
    expect(component.isCustomTimerEnabled()).toBe(false);

    timerConfig.set({ enabled: true, durationMs: 180000 });
    expect(component.isCustomTimerEnabled()).toBe(true);

    timerConfig.set({ enabled: false, durationMs: 180000 });
    expect(component.isCustomTimerEnabled()).toBe(false);
  });

  it('selectedDurationMs updates reactively across config changes', () => {
    const { component, timerConfig } = render();

    timerConfig.set({ enabled: true, durationMs: 180000 });
    expect(component.selectedDurationMs()).toBe(180000);

    timerConfig.set({ enabled: true, durationMs: 30000 });
    expect(component.selectedDurationMs()).toBe(30000);

    timerConfig.set({ enabled: true, durationMs: 3600000 });
    expect(component.selectedDurationMs()).toBe(3600000);
  });

  it('disables the timer via setCustomTimer when Off is selected', () => {
    const { component, context, timerConfig } = render();
    timerConfig.set({ enabled: true, durationMs: 180000 });

    component.onTimerMenuItemClick(null);

    expect(context.setCustomTimer).toHaveBeenCalledWith('test-device', false, 180000);
  });

  it('enables the timer via setCustomTimer when a duration is selected', () => {
    const { component, context, timerConfig } = render();
    timerConfig.set({ enabled: false, durationMs: 180000 });

    component.onTimerMenuItemClick(30000);

    expect(context.setCustomTimer).toHaveBeenCalledWith('test-device', true, 30000);
  });

  it('renders the timer button', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('[data-testid="timer-button"]')).toBeTruthy();
  });

  it('is a no-op for onTimerMenuItemClick with an empty deviceId', () => {
    const { component, context } = render('');

    expect(() => component.onTimerMenuItemClick(null)).not.toThrow();
    expect(context.setCustomTimer).not.toHaveBeenCalled();
  });

  it('timerBadgeText reflects the selected duration', () => {
    const { component, timerConfig } = render();

    timerConfig.set({ enabled: true, durationMs: 30000 });
    expect(component.timerBadgeText()).toBe('30s');

    timerConfig.set({ enabled: true, durationMs: 180000 });
    expect(component.timerBadgeText()).toBe('3m');

    timerConfig.set({ enabled: true, durationMs: 3600000 });
    expect(component.timerBadgeText()).toBe('1h');
  });

  it('timerBadgeText defaults to "3m" when config is null', () => {
    const { component } = render();

    expect(component.timerBadgeText()).toBe('3m');
  });

  it('renders the timer dropdown menu', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-dropdown-menu')).toBeTruthy();
  });

  it('maintains independent timer configs across devices', () => {
    const device1Config = signal<PlayTimerConfig | null>({ enabled: true, durationMs: 30000 });
    const device2Config = signal<PlayTimerConfig | null>({ enabled: false, durationMs: 180000 });

    const context = {
      getPlayTimerConfig: vi.fn((deviceId: string) =>
        deviceId === 'device-1' ? device1Config : device2Config
      ),
    };

    const { component, setInput } = renderPlayerComponent(PlayerToolbarActionsComponent, {
      inputs: { deviceId: 'device-1' },
      playerContext: context,
      providers: [
        {
          provide: StorageStore,
          useValue: {
            saveFavorite: vi.fn(),
            removeFavorite: vi.fn(),
            favoriteOperationsState: vi.fn(() => ({ isProcessing: false, error: null })),
          },
        },
      ],
    });

    expect(component.isCustomTimerEnabled()).toBe(true);
    expect(component.selectedDurationMs()).toBe(30000);
    expect(component.timerBadgeText()).toBe('30s');

    setInput('deviceId', 'device-2');

    expect(component.isCustomTimerEnabled()).toBe(false);
    expect(component.selectedDurationMs()).toBe(180000);
    expect(component.timerBadgeText()).toBe('3m');
  });
});
