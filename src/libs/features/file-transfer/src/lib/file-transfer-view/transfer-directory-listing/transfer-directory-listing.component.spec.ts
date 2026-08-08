import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Component, input, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { StorageStore, StorageDirectoryState } from '@teensyrom-nx/application';
import { DirectoryItem, FileItem, StorageType } from '@teensyrom-nx/domain';
import { DirectoryItemComponent, StorageItemComponent } from '@teensyrom-nx/ui/components';
import { TransferDirectoryListingComponent } from './transfer-directory-listing.component';
import { DirectoryTrailContainerComponent } from '../directory-trail-container/directory-trail-container.component';

@Component({
  selector: 'lib-directory-trail-container',
  standalone: true,
  template: '<div class="mock-directory-trail"></div>',
})
class MockDirectoryTrailContainerComponent {
  deviceId = input.required<string>();
}

const mockDirectory: DirectoryItem = { name: 'Games', path: '/games' };
const mockFile: FileItem = { name: 'existing.sid', path: '/existing.sid' } as FileItem;

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

describe('TransferDirectoryListingComponent', () => {
  let fixture: ComponentFixture<TransferDirectoryListingComponent>;
  let component: TransferDirectoryListingComponent;
  let mockStorageStore: {
    isDeviceLevelView: ReturnType<typeof vi.fn>;
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
    navigateToDirectory: ReturnType<typeof vi.fn>;
  };

  const setup = async (state: StorageDirectoryState | null, isDeviceLevel = false) => {
    mockStorageStore = {
      isDeviceLevelView: vi.fn(() => signal(isDeviceLevel).asReadonly()),
      getSelectedDirectoryState: vi.fn(() => signal(state).asReadonly()),
      navigateToDirectory: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TransferDirectoryListingComponent],
      providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
    })
      .overrideComponent(TransferDirectoryListingComponent, {
        remove: { imports: [DirectoryTrailContainerComponent] },
        add: { imports: [MockDirectoryTrailContainerComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TransferDirectoryListingComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'device-1');
    fixture.detectChanges();
  };

  it('creates', async () => {
    await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));
    expect(component).toBeTruthy();
  });

  describe('folder rows', () => {
    it('navigates on itemDoubleClicked using the current storageType and the folder path', async () => {
      await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));

      component.onDirectoryActivated(mockDirectory);

      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/games',
      });
    });

    it('only sets local selection on itemSelected, without navigating', async () => {
      await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));

      component.onDirectorySelected(mockDirectory);

      expect(component.isSelected({ ...mockDirectory, itemType: 'directory' })).toBe(true);
      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });

    it('clears the local selection after navigating', async () => {
      await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));

      component.onDirectorySelected(mockDirectory);
      expect(component.isSelected({ ...mockDirectory, itemType: 'directory' })).toBe(true);

      component.onDirectoryActivated(mockDirectory);

      expect(component.isSelected({ ...mockDirectory, itemType: 'directory' })).toBe(false);
    });

    it('binds itemDoubleClicked and itemSelected on the rendered directory item, not single click', async () => {
      await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));
      fixture.detectChanges();

      const directoryItem = fixture.debugElement.query(By.directive(DirectoryItemComponent));
      expect(directoryItem).toBeTruthy();

      directoryItem.componentInstance.itemDoubleClicked.emit(mockDirectory);
      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/games',
      });
    });
  });

  describe('existing file rows', () => {
    it('renders existing files as disabled storage items with no activation wiring', async () => {
      await setup(stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }));
      fixture.detectChanges();

      const storageItem = fixture.debugElement.query(By.directive(StorageItemComponent));
      expect(storageItem).toBeTruthy();
      expect(storageItem.componentInstance.disabled()).toBe(true);
      expect(storageItem.componentInstance.label()).toBe('existing.sid');

      // Activating the disabled row must never reach the store — nothing in this iteration
      // compares a dropped file against existing files.
      storageItem.componentInstance.activated.emit();
      storageItem.componentInstance.selectedChange.emit();
      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });

    it('applies the disabled-row class to existing file rows for dimmed visual treatment', async () => {
      await setup(stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }));
      fixture.detectChanges();

      const fileRow = fixture.debugElement.query(By.css('.listing-row'));
      expect(fileRow.nativeElement.classList.contains('disabled-row')).toBe(true);
    });
  });

  describe('divider', () => {
    it('is absent when the directory holds only folders', async () => {
      await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));
      expect(component.showDivider()).toBe(false);
    });

    it('is absent when the directory holds only files', async () => {
      await setup(stateWith({ directory: { directories: [], files: [mockFile], path: '/' } }));
      expect(component.showDivider()).toBe(false);
    });

    it('is present when both folders and files exist, and rows list folders before files', async () => {
      await setup(
        stateWith({ directory: { directories: [mockDirectory], files: [mockFile], path: '/' } })
      );

      expect(component.showDivider()).toBe(true);
      expect(component.rows().map((r) => r.itemType)).toEqual(['directory', 'file']);
    });
  });

  describe('empty and device-level states', () => {
    it('shows the empty-state treatment when the device is at device level', async () => {
      await setup(null, true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeFalsy();
    });

    it('shows the empty-state treatment when the directory is empty', async () => {
      await setup(stateWith({ directory: { directories: [], files: [], path: '/' } }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeFalsy();
    });

    it('renders the viewport instead of the empty state when content exists', async () => {
      await setup(stateWith({ directory: { directories: [mockDirectory], files: [], path: '/' } }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('.listing-viewport')).toBeTruthy();
    });
  });
});
