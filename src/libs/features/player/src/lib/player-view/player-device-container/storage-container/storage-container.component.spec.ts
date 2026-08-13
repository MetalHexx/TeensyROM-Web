import { vi } from 'vitest';
import { signal, type WritableSignal } from '@angular/core';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { createMockStorageService, createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { STORAGE_SERVICE } from '@teensyrom-nx/domain';
import type { PlayHistory } from '@teensyrom-nx/application';
import { StorageContainerComponent } from './storage-container.component';

describe('StorageContainerComponent', () => {
  let historyVisible: WritableSignal<boolean>;
  let playHistory: WritableSignal<PlayHistory | null>;
  let toggleHistoryView: ReturnType<typeof vi.fn>;

  function render(deviceId = 'device-1') {
    historyVisible = signal(false);
    playHistory = signal(null);
    toggleHistoryView = vi.fn();

    return renderPlayerComponent(StorageContainerComponent, {
      inputs: { deviceId },
      playerContext: {
        isHistoryViewVisible: vi.fn(() => historyVisible.asReadonly()),
        getPlayHistory: vi.fn(() => playHistory.asReadonly()),
        toggleHistoryView,
      },
      providers: [{ provide: STORAGE_SERVICE, useValue: createMockStorageService() }],
    });
  }

  const withOneEntry = (): PlayHistory => ({
    entries: [
      {
        file: createTestFileItem(),
        storageKey: 'device-1-SD',
        parentPath: '/',
        timestamp: Date.now(),
        isCompatible: true,
      },
    ],
    currentPosition: 0,
  });

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('shows history when the toggle is on and entries exist', () => {
    const { component, fixture } = render();
    historyVisible.set(true);
    playHistory.set(withOneEntry());
    fixture.detectChanges();

    expect(component.shouldShowHistory()).toBe(true);
  });

  it('hides history when the toggle is off, even with entries', () => {
    const { component, fixture } = render();
    historyVisible.set(false);
    playHistory.set(withOneEntry());
    fixture.detectChanges();

    expect(component.shouldShowHistory()).toBe(false);
  });

  it('hides history when there are no entries, even with the toggle on', () => {
    const { component, fixture } = render();
    historyVisible.set(true);
    playHistory.set(null);
    fixture.detectChanges();

    expect(component.shouldShowHistory()).toBe(false);
  });

  it('toggles history off when directory navigation happens while history is visible', () => {
    const { component } = render();
    historyVisible.set(true);

    component.onDirectoryNavigated();

    expect(toggleHistoryView).toHaveBeenCalledWith('device-1');
  });

  it('is a no-op on directory navigation when history is not visible', () => {
    const { component } = render();
    historyVisible.set(false);

    component.onDirectoryNavigated();

    expect(toggleHistoryView).not.toHaveBeenCalled();
  });
});
