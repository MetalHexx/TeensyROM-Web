import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal, type WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { StorageStore, type StorageDirectoryState } from '@teensyrom-nx/application';
import { FileItemType, StorageType, type DirectoryItem, type FileItem } from '@teensyrom-nx/domain';
import {
  DirectoryItemComponent,
  IconButtonComponent,
  StorageItemActionsComponent,
  StorageItemComponent,
} from '@teensyrom-nx/ui/components';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { DjDirectoryListingComponent } from './dj-directory-listing.component';
import { DjDirectoryTrailComponent } from './dj-directory-trail.component';
import type { ActiveStorage } from '../active-storage';
import { DJ_FILE_DRAG_TYPE, type DjFileDragPayload } from '../drag/dj-file-drag';

@Component({
  selector: 'lib-dj-directory-trail',
  standalone: true,
  template: '<div class="mock-directory-trail"></div>',
})
class MockDjDirectoryTrailComponent {
  activeStorage = input.required<ActiveStorage>();
}

const mockDirectory: DirectoryItem = { name: 'Games', path: '/games' };
const mockFile: FileItem = createTestFileItem({ name: 'song.sid', path: '/song.sid', size: 4096 });
const mockImageFile: FileItem = createTestFileItem({
  name: 'cover.png',
  path: '/cover.png',
  size: 2048,
  type: FileItemType.Image,
});

/** A stubbed `DataTransfer` sufficient for `setDjFileDragData`/`readDjFileDragData` round-trips. */
function createFakeDataTransfer(): {
  dataTransfer: DataTransfer;
  setDragImage: ReturnType<typeof vi.fn>;
} {
  const data: Record<string, string> = {};
  const types: string[] = [];
  const setDragImage = vi.fn();
  const dataTransfer = {
    setData: (type: string, value: string) => {
      data[type] = value;
      types.push(type);
    },
    getData: (type: string) => data[type] ?? '',
    setDragImage,
    types,
    effectAllowed: 'none',
  } as unknown as DataTransfer;
  return { dataTransfer, setDragImage };
}

function dragStartEvent(dataTransfer: DataTransfer): DragEvent {
  const event = new Event('dragstart', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  return event;
}

function stateWith(overrides: Partial<StorageDirectoryState>): StorageDirectoryState {
  return {
    deviceId: 'device-1',
    storageType: StorageType.Sd,
    currentPath: '/',
    directory: { directories: [], files: [], path: '/' },
    isLoaded: true,
    isLoading: false,
    error: null,
    lastLoadTime: Date.now(),
    ...overrides,
  };
}

function searchStateWith(overrides: {
  results?: FileItem[];
  isSearching?: boolean;
  hasSearched?: boolean;
  error?: string | null;
}) {
  return {
    searchText: 'still',
    filterType: null,
    results: [] as FileItem[],
    isSearching: false,
    hasSearched: true,
    error: null as string | null,
    ...overrides,
  };
}

describe('DjDirectoryListingComponent', () => {
  let searchState: WritableSignal<ReturnType<typeof searchStateWith> | null>;
  let fixture: ComponentFixture<DjDirectoryListingComponent>;
  let component: DjDirectoryListingComponent;
  let navigateToDirectory: ReturnType<typeof vi.fn>;

  const active: ActiveStorage = { deviceId: 'device-1', storageType: StorageType.Sd };

  const setup = async (
    activeStorage: ActiveStorage | null,
    entries: Record<string, StorageDirectoryState> = {}
  ) => {
    navigateToDirectory = vi.fn().mockResolvedValue(undefined);
    searchState = signal(null);
    const storageStore = {
      storageEntries: signal(entries),
      navigateToDirectory,
      getSearchState: vi.fn(() => searchState),
      searchFiles: vi.fn().mockResolvedValue(undefined),
      clearSearch: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [DjDirectoryListingComponent],
      providers: [{ provide: StorageStore, useValue: storageStore }],
    }).overrideComponent(DjDirectoryListingComponent, {
      remove: { imports: [DjDirectoryTrailComponent] },
      add: { imports: [MockDjDirectoryTrailComponent] },
    });

    fixture = TestBed.createComponent(DjDirectoryListingComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('activeStorage', activeStorage);
    fixture.detectChanges();
    // The cdk virtual-scroll viewport attaches its scroll strategy from a microtask queued in
    // its own ngOnInit (deferred so it measures the viewport after it has a real size), so a
    // microtask flush is needed before a second `detectChanges()` renders its initial range.
    await Promise.resolve();
    fixture.detectChanges();
  };

  it('shows the "select a storage" empty state with no active storage', async () => {
    await setup(null);

    const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
    expect(emptyState).toBeTruthy();
    expect(fixture.nativeElement.querySelector('lib-dj-directory-trail')).toBeFalsy();
  });

  it('renders the trail once a storage is active', async () => {
    await setup(active, { 'device-1-SD': stateWith({}) });

    expect(fixture.nativeElement.querySelector('lib-dj-directory-trail')).toBeTruthy();
  });

  it('renders the search box in the header row beside the trail once a storage is active', async () => {
    await setup(active, { 'device-1-SD': stateWith({}) });

    const header = fixture.nativeElement.querySelector('.listing-header') as HTMLElement;
    expect(header.children[0].tagName.toLowerCase()).toBe('lib-dj-directory-trail');
    expect(header.children[1].tagName.toLowerCase()).toBe('lib-dj-search-toolbar');
  });

  it('renders no search box without an active storage', async () => {
    await setup(null);

    expect(fixture.nativeElement.querySelector('lib-dj-search-toolbar')).toBeFalsy();
  });

  it('shows a loading empty state while the entry is loading', async () => {
    await setup(active, { 'device-1-SD': stateWith({ isLoading: true }) });

    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeFalsy();
  });

  it('shows an error empty state when the entry failed to load', async () => {
    await setup(active, { 'device-1-SD': stateWith({ error: 'Directory not found' }) });

    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeFalsy();
  });

  it('shows an empty-directory state when there is no content', async () => {
    await setup(active, { 'device-1-SD': stateWith({}) });

    expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeFalsy();
  });

  it('renders directories before files, with data-item-path on each row', async () => {
    await setup(active, {
      'device-1-SD': stateWith({
        directory: { directories: [mockDirectory], files: [mockFile], path: '/' },
      }),
    });

    expect(component.rows().map((r) => r.itemType)).toEqual(['directory', 'file']);

    const rows = fixture.nativeElement.querySelectorAll('.listing-row');
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('data-item-path')).toBe('/games');
    expect(rows[1].getAttribute('data-item-path')).toBe('/song.sid');
  });

  it('navigates into a folder on a single click and clears the selection', async () => {
    await setup(active, {
      'device-1-SD': stateWith({
        directory: { directories: [mockDirectory], files: [], path: '/' },
      }),
    });

    const directoryItem = fixture.debugElement.query(By.directive(DirectoryItemComponent));
    directoryItem.componentInstance.itemSelected.emit(mockDirectory);

    expect(navigateToDirectory).toHaveBeenCalledWith({
      deviceId: 'device-1',
      storageType: StorageType.Sd,
      path: '/games',
    });
    expect(component.isSelected({ ...mockDirectory, itemType: 'directory' })).toBe(false);
  });

  it('selects a file row and dispatches nothing to the store', async () => {
    await setup(active, {
      'device-1-SD': stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }),
    });

    const storageItem = fixture.debugElement.query(By.directive(StorageItemComponent));
    storageItem.componentInstance.selectedChange.emit();
    fixture.detectChanges();

    expect(component.isSelected({ ...mockFile, itemType: 'file' })).toBe(true);
    expect(navigateToDirectory).not.toHaveBeenCalled();
  });

  it("renders a file row's icon, label, and formatted size", async () => {
    await setup(active, {
      'device-1-SD': stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }),
    });

    const storageItem = fixture.debugElement.query(By.directive(StorageItemComponent))
      .componentInstance as StorageItemComponent;
    expect(storageItem.icon()).toBe('music_note');
    expect(storageItem.label()).toBe('song.sid');
    expect(fixture.nativeElement.querySelector('.actions-label').textContent.trim()).toBe('4.0 KB');
  });

  describe('dragging a song row', () => {
    it('marks only the Song row draggable, leaving directories and other file types alone', async () => {
      await setup(active, {
        'device-1-SD': stateWith({
          directory: { directories: [mockDirectory], files: [mockFile, mockImageFile], path: '/' },
        }),
      });

      const rows = fixture.nativeElement.querySelectorAll('.listing-row');
      expect(rows[0].getAttribute('draggable')).toBeNull(); // directory
      expect(rows[1].getAttribute('draggable')).toBe('true'); // song
      expect(rows[2].getAttribute('draggable')).toBeNull(); // image
    });

    it('writes the drag payload under DJ_FILE_DRAG_TYPE and emits dragStarted on dragstart', async () => {
      await setup(active, {
        'device-1-SD': stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }),
      });

      const emitted: void[] = [];
      component.dragStarted.subscribe(() => emitted.push(undefined));

      const row = fixture.nativeElement.querySelector('.listing-row') as HTMLElement;
      const { dataTransfer } = createFakeDataTransfer();
      row.dispatchEvent(dragStartEvent(dataTransfer));

      const payload = JSON.parse(dataTransfer.getData(DJ_FILE_DRAG_TYPE)) as DjFileDragPayload;
      expect(payload).toEqual({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/song.sid',
        fileName: 'song.sid',
        title: 'Test Song',
        author: 'Test Artist',
        playLength: '3:45',
        subtuneLengths: [],
      });
      expect(emitted.length).toBe(1);
    });

    it('falls back to the file name for the title when the file has none', async () => {
      await setup(active, {
        'device-1-SD': stateWith({
          directory: {
            directories: [],
            files: [createTestFileItem({ name: 'untitled.sid', path: '/untitled.sid', title: '' })],
            path: '/',
          },
        }),
      });

      const row = fixture.nativeElement.querySelector('.listing-row') as HTMLElement;
      const { dataTransfer } = createFakeDataTransfer();
      row.dispatchEvent(dragStartEvent(dataTransfer));

      const payload = JSON.parse(dataTransfer.getData(DJ_FILE_DRAG_TYPE)) as DjFileDragPayload;
      expect(payload.title).toBe('untitled.sid');
    });

    it('sets the drag image from the off-screen chip, current with the dragged row', async () => {
      await setup(active, {
        'device-1-SD': stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }),
      });

      const row = fixture.nativeElement.querySelector('.listing-row') as HTMLElement;
      const { dataTransfer, setDragImage } = createFakeDataTransfer();
      row.dispatchEvent(dragStartEvent(dataTransfer));

      const chipEl = fixture.nativeElement.querySelector('.drag-chip-ghost');
      expect(chipEl.querySelector('.icon-label-text')?.textContent?.trim()).toBe('song.sid');
      expect(setDragImage).toHaveBeenCalledWith(chipEl, 16, chipEl.offsetHeight / 2);
    });

    it('emits dragEnded on dragend', async () => {
      await setup(active, {
        'device-1-SD': stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }),
      });

      const emitted: void[] = [];
      component.dragEnded.subscribe(() => emitted.push(undefined));

      const row = fixture.nativeElement.querySelector('.listing-row') as HTMLElement;
      row.dispatchEvent(new Event('dragend', { bubbles: true, cancelable: true }));

      expect(emitted.length).toBe(1);
    });
  });

  describe('search results', () => {
    const usbSong = createTestFileItem({
      name: 'usb-tune.sid',
      path: '/music/usb-tune.sid',
      parentPath: '/music',
      storageType: StorageType.Usb,
    });
    const sdSong = createTestFileItem({
      name: 'usb-tune.sid',
      path: '/music/usb-tune.sid',
      parentPath: '/music',
      storageType: StorageType.Sd,
    });
    const textFile = createTestFileItem({
      name: 'readme.txt',
      path: '/docs/readme.txt',
      parentPath: '/docs',
      type: FileItemType.Unknown,
      storageType: StorageType.Sd,
    });

    const render = async () => {
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();
    };

    const withSearch = async (state: ReturnType<typeof searchStateWith>) => {
      await setup(active, {
        'device-1-SD': stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }),
      });
      searchState.set(state);
      await render();
    };

    const rowPaths = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.listing-row') as NodeListOf<HTMLElement>).map(
        (r) => r.getAttribute('data-item-path')
      );

    const resultRows = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.listing-row')) as HTMLElement[];

    it('shows the directory when there is no search state, replaces it with results, and restores it on clear', async () => {
      await withSearch(searchStateWith({ results: [usbSong] }));
      expect(rowPaths()).toEqual(['/music/usb-tune.sid']);

      searchState.set(null);
      await render();

      expect(rowPaths()).toEqual(['/song.sid']);
    });

    it('keeps showing the directory until a first search has completed', async () => {
      await withSearch(searchStateWith({ hasSearched: false, isSearching: true }));

      expect(rowPaths()).toEqual(['/song.sid']);
    });

    it.each([
      ['searching', searchStateWith({ isSearching: true })],
      ['failed', searchStateWith({ error: 'boom' })],
      ['empty', searchStateWith({ results: [] })],
    ])('replaces the directory with a single state message when the search is %s', async (_name, state) => {
      await withSearch(state);

      expect(fixture.nativeElement.querySelectorAll('lib-empty-state-message').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeFalsy();
    });

    it('renders a row per result with its path and gives each row actions its own storage', async () => {
      await withSearch(searchStateWith({ results: [sdSong, usbSong] }));

      expect(rowPaths()).toEqual(['/music/usb-tune.sid', '/music/usb-tune.sid']);
      const storages = fixture.debugElement
        .queryAll(By.directive(StorageItemActionsComponent))
        .map((d) => (d.componentInstance as StorageItemActionsComponent).storageType());
      expect(storages).toEqual([StorageType.Sd, StorageType.Usb]);
      expect(fixture.nativeElement.querySelector('.result-path').textContent.trim()).toBe('/music');
    });

    it('selects a result on click without selecting its twin on the other storage', async () => {
      await withSearch(searchStateWith({ results: [sdSong, usbSong] }));

      const items = fixture.debugElement.queryAll(By.directive(StorageItemComponent));
      items[1].componentInstance.selectedChange.emit();
      fixture.detectChanges();

      expect(component.isSelectedResult(usbSong)).toBe(true);
      expect(component.isSelectedResult(sdSong)).toBe(false);
    });

    it('makes only song results draggable', async () => {
      await withSearch(searchStateWith({ results: [usbSong, textFile] }));

      const rows = resultRows();
      expect(rows[0].getAttribute('draggable')).toBe('true');
      expect(rows[1].getAttribute('draggable')).toBeNull();
    });

    it('drags a result with its own storage while another is active, using the chip as drag image', async () => {
      await withSearch(searchStateWith({ results: [usbSong] }));
      const started: void[] = [];
      const ended: void[] = [];
      component.dragStarted.subscribe(() => started.push(undefined));
      component.dragEnded.subscribe(() => ended.push(undefined));

      const { dataTransfer, setDragImage } = createFakeDataTransfer();
      const row = resultRows()[0];
      row.dispatchEvent(dragStartEvent(dataTransfer));
      row.dispatchEvent(new Event('dragend', { bubbles: true, cancelable: true }));

      const payload = JSON.parse(dataTransfer.getData(DJ_FILE_DRAG_TYPE)) as DjFileDragPayload;
      expect(payload).toEqual({
        deviceId: 'device-1',
        storageType: StorageType.Usb,
        path: '/music/usb-tune.sid',
        fileName: 'usb-tune.sid',
        title: 'Test Song',
        author: 'Test Artist',
        playLength: '3:45',
        subtuneLengths: [],
      });
      const chipEl = fixture.nativeElement.querySelector('.drag-chip-ghost');
      expect(chipEl.querySelector('.icon-label-text')?.textContent?.trim()).toBe('usb-tune.sid');
      expect(setDragImage).toHaveBeenCalledWith(chipEl, 16, chipEl.offsetHeight / 2);
      expect(started.length).toBe(1);
      expect(ended.length).toBe(1);
    });

    it('falls back to the active storage for a result without one', async () => {
      const unplaced = createTestFileItem({ name: 'x.sid', path: '/x.sid', storageType: undefined });
      await withSearch(searchStateWith({ results: [unplaced] }));

      const { dataTransfer } = createFakeDataTransfer();
      resultRows()[0].dispatchEvent(dragStartEvent(dataTransfer));

      const payload = JSON.parse(dataTransfer.getData(DJ_FILE_DRAG_TYPE)) as DjFileDragPayload;
      expect(payload.storageType).toBe(StorageType.Sd);
    });

    it('does not start a drag for a non-song result', async () => {
      await withSearch(searchStateWith({ results: [textFile] }));
      const started: void[] = [];
      component.dragStarted.subscribe(() => started.push(undefined));

      const { dataTransfer } = createFakeDataTransfer();
      resultRows()[0].dispatchEvent(dragStartEvent(dataTransfer));

      expect(dataTransfer.getData(DJ_FILE_DRAG_TYPE)).toBe('');
      expect(started.length).toBe(0);
    });

    it("jumps to the result's parent folder on the result's own storage", async () => {
      await withSearch(searchStateWith({ results: [usbSong] }));

      const button = fixture.debugElement.query(By.directive(IconButtonComponent));
      button.componentInstance.buttonClick.emit();

      expect(navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: StorageType.Usb,
        path: '/music',
      });
    });
  });
});
