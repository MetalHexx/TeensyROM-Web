import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  StorageKeyUtil,
  type HistoryEntry,
  type IPlayerContext,
  type LaunchedFile,
  type PlayHistory,
} from '@teensyrom-nx/application';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { StorageType } from '@teensyrom-nx/domain';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { PlayHistoryComponent } from './play-history.component';

const deviceId = 'device-1';

function createTestHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    file: createTestFileItem(),
    storageKey: StorageKeyUtil.create(deviceId, StorageType.Usb),
    parentPath: '/test',
    timestamp: Date.now(),
    isCompatible: true,
    ...overrides,
  };
}

describe('PlayHistoryComponent', () => {
  beforeEach(() => {
    // The auto-scroll effect calls Element.scrollIntoView, which jsdom doesn't implement.
    Element.prototype.scrollIntoView = vi.fn();
  });

  function render(playerContext: Partial<IPlayerContext> = {}) {
    return renderPlayerComponent(PlayHistoryComponent, {
      inputs: { deviceId },
      playerContext,
    });
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('shows the empty state when there is no history', () => {
    const { fixture } = render();
    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
  });

  it('renders history entries as a list when history exists', () => {
    const entries = [
      createTestHistoryEntry({ timestamp: 1000 }),
      createTestHistoryEntry({ timestamp: 2000 }),
      createTestHistoryEntry({ timestamp: 3000 }),
    ];
    const { fixture } = render({
      getPlayHistory: vi.fn().mockReturnValue(signal<PlayHistory>({ entries, currentPosition: -1 }).asReadonly()),
    });

    expect(fixture.nativeElement.querySelector('.history-list')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('lib-history-entry')).toHaveLength(3);
  });

  it('displays entries newest-first', () => {
    const entries = [
      createTestHistoryEntry({ timestamp: 1000 }),
      createTestHistoryEntry({ timestamp: 2000 }),
      createTestHistoryEntry({ timestamp: 3000 }),
    ];
    const { fixture } = render({
      getPlayHistory: vi.fn().mockReturnValue(signal<PlayHistory>({ entries, currentPosition: -1 }).asReadonly()),
    });

    const items = fixture.nativeElement.querySelectorAll('.history-list-item');
    expect(items).toHaveLength(3);
    expect(items[0].getAttribute('data-index')).toBe('0');
    expect(items[2].getAttribute('data-index')).toBe('2');
  });

  it('highlights the currently playing entry in the reversed display', () => {
    const entries = [
      createTestHistoryEntry({ timestamp: 1000 }),
      createTestHistoryEntry({ timestamp: 2000 }),
    ];
    const { fixture } = render({
      getPlayHistory: vi.fn().mockReturnValue(signal<PlayHistory>({ entries, currentPosition: 1 }).asReadonly()),
      getCurrentFile: vi.fn().mockReturnValue(
        signal<LaunchedFile>({
          storageKey: entries[1].storageKey,
          file: entries[1].file,
          parentPath: entries[1].parentPath,
          launchedAt: entries[1].timestamp,
          isCompatible: true,
        }).asReadonly()
      ),
    });

    const items = fixture.nativeElement.querySelectorAll('.history-list-item');
    expect(items[0].getAttribute('data-is-playing')).toBe('true');
  });

  it('shows both playing and error highlights when the current file has an error', () => {
    const entry = createTestHistoryEntry({ timestamp: 1000 });
    const { fixture } = render({
      getPlayHistory: vi.fn().mockReturnValue(signal<PlayHistory>({ entries: [entry], currentPosition: 0 }).asReadonly()),
      getCurrentFile: vi.fn().mockReturnValue(
        signal<LaunchedFile>({
          storageKey: entry.storageKey,
          file: entry.file,
          parentPath: entry.parentPath,
          launchedAt: entry.timestamp,
          isCompatible: true,
        }).asReadonly()
      ),
      getError: vi.fn().mockReturnValue(signal('Failed to launch file').asReadonly()),
    });

    const item = fixture.nativeElement.querySelector('.history-list-item');
    expect(item.getAttribute('data-is-playing')).toBe('true');
    expect(item.getAttribute('data-has-error')).toBe('true');
  });

  it('selects an entry on single-click', () => {
    const entries = [createTestHistoryEntry({ timestamp: 1000 }), createTestHistoryEntry({ timestamp: 2000 })];
    const { component } = render();

    component.onEntrySelected(entries[1]);

    expect(component.selectedEntry()).toEqual(entries[1]);
  });

  it('navigates to the mapped history position on double-click', async () => {
    const entries = [
      createTestHistoryEntry({ timestamp: 1000 }),
      createTestHistoryEntry({ timestamp: 2000 }),
      createTestHistoryEntry({ timestamp: 3000 }),
    ];
    const navigateToHistoryPosition = vi.fn().mockResolvedValue(undefined);
    const { component } = render({
      getPlayHistory: vi.fn().mockReturnValue(signal<PlayHistory>({ entries, currentPosition: -1 }).asReadonly()),
      navigateToHistoryPosition,
    });

    // Double-click the first displayed item (newest, which is index 2 in the original array).
    await component.onEntryDoubleClick(entries[2], 0);

    expect(navigateToHistoryPosition).toHaveBeenCalledWith(deviceId, 2);
  });

  it('is a no-op on double-click with an empty history', async () => {
    const navigateToHistoryPosition = vi.fn().mockResolvedValue(undefined);
    const { component } = render({
      getPlayHistory: vi.fn().mockReturnValue(signal<PlayHistory>({ entries: [], currentPosition: -1 }).asReadonly()),
      navigateToHistoryPosition,
    });

    await component.onEntryDoubleClick(createTestHistoryEntry(), 0);

    expect(navigateToHistoryPosition).not.toHaveBeenCalled();
  });

  it('reports selection state per entry', () => {
    const entry1 = createTestHistoryEntry({ timestamp: 1000 });
    const entry2 = createTestHistoryEntry({ timestamp: 2000 });
    const { component } = render();

    component.selectedEntry.set(entry1);

    expect(component.isSelected(entry1)).toBe(true);
    expect(component.isSelected(entry2)).toBe(false);
  });

  it('reports currently-playing state per entry', () => {
    const entry1 = createTestHistoryEntry({ timestamp: 1000 });
    const entry2 = createTestHistoryEntry({ timestamp: 2000 });
    const { component } = render({
      getCurrentFile: vi.fn().mockReturnValue(
        signal<LaunchedFile>({
          storageKey: entry1.storageKey,
          file: entry1.file,
          parentPath: entry1.parentPath,
          launchedAt: entry1.timestamp,
          isCompatible: true,
        }).asReadonly()
      ),
    });

    expect(component.isCurrentlyPlaying(entry1)).toBe(true);
    expect(component.isCurrentlyPlaying(entry2)).toBe(false);
  });
});
