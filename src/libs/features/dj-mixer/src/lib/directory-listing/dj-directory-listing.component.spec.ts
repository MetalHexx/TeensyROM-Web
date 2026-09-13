import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { StorageStore, type StorageDirectoryState } from '@teensyrom-nx/application';
import { FileItemType, StorageType, type DirectoryItem, type FileItem } from '@teensyrom-nx/domain';
import { DirectoryItemComponent, StorageItemComponent } from '@teensyrom-nx/ui/components';
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

describe('DjDirectoryListingComponent', () => {
  let fixture: ComponentFixture<DjDirectoryListingComponent>;
  let component: DjDirectoryListingComponent;
  let navigateToDirectory: ReturnType<typeof vi.fn>;

  const active: ActiveStorage = { deviceId: 'device-1', storageType: StorageType.Sd };

  const setup = async (
    activeStorage: ActiveStorage | null,
    entries: Record<string, StorageDirectoryState> = {}
  ) => {
    navigateToDirectory = vi.fn().mockResolvedValue(undefined);
    const storageStore = {
      storageEntries: signal(entries),
      navigateToDirectory,
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
      });
      expect(emitted.length).toBe(1);
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
});
