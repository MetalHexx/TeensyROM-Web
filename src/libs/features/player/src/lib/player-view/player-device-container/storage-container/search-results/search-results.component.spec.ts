import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError, NEVER } from 'rxjs';
import { StorageStore, type IPlayerContext, type LaunchedFile } from '@teensyrom-nx/application';
import { createMockStorageService, createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { STORAGE_SERVICE, LaunchMode, type FileItem, type IStorageService } from '@teensyrom-nx/domain';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { SearchResultsComponent } from './search-results.component';

const deviceId = 'device-1';

describe('SearchResultsComponent', () => {
  beforeEach(() => {
    // The auto-select effect schedules a scroll-into-view that calls CSS.escape and
    // Element.scrollIntoView; jsdom implements neither.
    (globalThis as { CSS?: { escape(value: string): string } }).CSS = {
      escape: (value: string) => value,
    };
    Element.prototype.scrollIntoView = vi.fn();
  });

  function render(
    searchServiceOverrides: Partial<IStorageService> = {},
    playerContext: Partial<IPlayerContext> = {}
  ) {
    const result = renderPlayerComponent(SearchResultsComponent, {
      inputs: { deviceId },
      playerContext,
      providers: [
        { provide: STORAGE_SERVICE, useValue: createMockStorageService(searchServiceOverrides) },
      ],
    });
    return { ...result, storageStore: TestBed.inject(StorageStore) };
  }

  async function renderWithResults(files: FileItem[], playerContext: Partial<IPlayerContext> = {}) {
    const rendered = render({ search: vi.fn().mockReturnValue(of(files)) }, playerContext);
    await rendered.storageStore.searchFiles({ deviceId, searchText: 'test' });
    rendered.fixture.detectChanges();
    return rendered;
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('shows neither the empty state nor the results list while actively searching', async () => {
    // The "not searched yet" empty state only clears once a search has completed at least
    // once (hasSearched stays true across a re-search), so this simulates re-searching rather
    // than the very first search.
    const search = vi.fn().mockReturnValueOnce(of([])).mockReturnValue(NEVER);
    const { fixture, storageStore } = render({ search });
    await storageStore.searchFiles({ deviceId, searchText: 'first' });
    void storageStore.searchFiles({ deviceId, searchText: 'test' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.search-results-list')).toBeFalsy();
  });

  it('renders an error state when the search fails', async () => {
    const { fixture, storageStore } = render({
      search: vi.fn().mockReturnValue(throwError(() => new Error('Search failed'))),
    });
    await storageStore.searchFiles({ deviceId, searchText: 'test' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-state')).toBeTruthy();
  });

  it('shows a "not searched yet" empty state before any search runs', () => {
    const { fixture } = render();
    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
  });

  it('shows a "no results" empty state after a search with zero matches', async () => {
    const { fixture } = await renderWithResults([]);
    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
  });

  it('renders one list item per search result', async () => {
    const files = [createTestFileItem({ path: '/a.sid' }), createTestFileItem({ path: '/b.sid' })];
    const { fixture } = await renderWithResults(files);

    expect(fixture.nativeElement.querySelectorAll('.file-list-item')).toHaveLength(2);
  });

  it('sets selectedItem when a file is selected', async () => {
    const files = [createTestFileItem({ path: '/a.sid' }), createTestFileItem({ path: '/b.sid' })];
    const { component } = await renderWithResults(files);
    expect(component.selectedItem()).toBeNull();

    component.onFileSelected(files[0]);

    expect(component.selectedItem()).toEqual(files[0]);
  });

  it('launches a file with Search launch mode on double-click', async () => {
    const files = [createTestFileItem({ path: '/a.sid', parentPath: '/music' })];
    const launchFileWithContext = vi.fn().mockResolvedValue(undefined);
    const { component } = await renderWithResults(files, { launchFileWithContext });

    await component.onFileDoubleClick(files[0]);

    expect(launchFileWithContext).toHaveBeenCalledWith({
      deviceId,
      storageType: files[0].storageType,
      file: files[0],
      directoryPath: files[0].parentPath,
      files,
      launchMode: LaunchMode.Search,
    });
  });

  it('reports selection state per file', async () => {
    const files = [createTestFileItem({ path: '/a.sid' }), createTestFileItem({ path: '/b.sid' })];
    const { component } = await renderWithResults(files);

    component.onFileSelected(files[0]);

    expect(component.isSelected(files[0])).toBe(true);
    expect(component.isSelected(files[1])).toBe(false);
  });

  it('highlights the currently playing file in Search mode', async () => {
    const files = [createTestFileItem({ path: '/a.sid' }), createTestFileItem({ path: '/b.sid' })];
    const currentFile = signal<LaunchedFile | null>(null);
    const { component, fixture } = await renderWithResults(files, {
      getCurrentFile: vi.fn(() => currentFile.asReadonly()),
      getLaunchMode: vi.fn(() => signal(LaunchMode.Search).asReadonly()),
    });

    currentFile.set({
      storageKey: 'device-1-SD',
      file: files[0],
      parentPath: '/',
      launchedAt: Date.now(),
      isCompatible: true,
    });
    fixture.detectChanges();

    expect(component.isCurrentlyPlaying(files[0])).toBe(true);
    expect(component.isCurrentlyPlaying(files[1])).toBe(false);
  });

  it('does not highlight playing files outside Search mode', async () => {
    const files = [createTestFileItem({ path: '/a.sid' })];
    const { component } = await renderWithResults(files, {
      getCurrentFile: vi.fn().mockReturnValue(
        signal<LaunchedFile>({
          storageKey: 'device-1-SD',
          file: files[0],
          parentPath: '/',
          launchedAt: Date.now(),
          isCompatible: true,
        }).asReadonly()
      ),
      getLaunchMode: vi.fn().mockReturnValue(signal(LaunchMode.Directory).asReadonly()),
    });

    expect(component.isCurrentlyPlaying(files[0])).toBe(false);
  });

  it('reports a player error when the playing file has an error', () => {
    const { component } = render(undefined, {
      getError: vi.fn().mockReturnValue(signal('Playback failed').asReadonly()),
    });

    expect(component.hasPlayerError()).toBe(true);
  });

  it('auto-selects the playing file once playback starts', async () => {
    const files = [createTestFileItem({ path: '/a.sid' })];
    const currentFile = signal<LaunchedFile | null>(null);
    const { component, fixture } = await renderWithResults(files, {
      getCurrentFile: vi.fn(() => currentFile.asReadonly()),
      getLaunchMode: vi.fn(() => signal(LaunchMode.Search).asReadonly()),
    });
    expect(component.selectedItem()).toBeNull();

    currentFile.set({
      storageKey: 'device-1-SD',
      file: files[0],
      parentPath: '/',
      launchedAt: Date.now(),
      isCompatible: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedItem()).toEqual(files[0]);
  });

  it('resolves a null search state to safe defaults', () => {
    const { component } = render();

    expect(component.searchResults()).toEqual([]);
    expect(component.isSearching()).toBe(false);
    expect(component.hasSearched()).toBe(false);
    expect(component.searchError()).toBeNull();
  });

  it('does not crash change detection with an empty deviceId', () => {
    const { fixture } = renderPlayerComponent(SearchResultsComponent, {
      inputs: { deviceId: '' },
      providers: [{ provide: STORAGE_SERVICE, useValue: createMockStorageService() }],
    });

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('does not crash and does not highlight when the playing file is missing from results', async () => {
    const files = [createTestFileItem({ path: '/a.sid' }), createTestFileItem({ path: '/b.sid' })];
    const otherFile = createTestFileItem({ path: '/other.sid' });
    const { component, fixture } = await renderWithResults(files, {
      getCurrentFile: vi.fn().mockReturnValue(
        signal<LaunchedFile>({
          storageKey: 'device-1-SD',
          file: otherFile,
          parentPath: '/',
          launchedAt: Date.now(),
          isCompatible: true,
        }).asReadonly()
      ),
      getLaunchMode: vi.fn().mockReturnValue(signal(LaunchMode.Search).asReadonly()),
    });

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.isCurrentlyPlaying(files[0])).toBe(false);
    expect(component.isCurrentlyPlaying(files[1])).toBe(false);
  });

  it('does not crash and does not launch when double-clicking with no search state', async () => {
    const launchFileWithContext = vi.fn().mockResolvedValue(undefined);
    const { component } = render(undefined, { launchFileWithContext });

    await expect(component.onFileDoubleClick(createTestFileItem())).resolves.toBeUndefined();

    expect(launchFileWithContext).not.toHaveBeenCalled();
  });
});
