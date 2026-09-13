import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { StorageStore, type StorageDirectoryState } from '@teensyrom-nx/application';
import { StorageType, type DirectoryItem, type FileItem } from '@teensyrom-nx/domain';
import { DirectoryItemComponent, StorageItemComponent } from '@teensyrom-nx/ui/components';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { DjDirectoryListingComponent } from './dj-directory-listing.component';
import { DjDirectoryTrailComponent } from './dj-directory-trail.component';
import type { ActiveStorage } from '../active-storage';

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
});
