import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { TransferSearchToolbarComponent } from './transfer-search-toolbar.component';
import { StorageStore, StorageDirectoryState, SearchState } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';

const directoryState = (overrides: Partial<StorageDirectoryState> = {}): StorageDirectoryState => ({
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  currentPath: '/',
  directory: { directories: [], files: [], path: '/' },
  isLoaded: true,
  isLoading: false,
  error: null,
  lastLoadTime: Date.now(),
  ...overrides,
});

describe('TransferSearchToolbarComponent', () => {
  let fixture: ComponentFixture<TransferSearchToolbarComponent>;
  let component: TransferSearchToolbarComponent;
  let mockStorageStore: {
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
    getSearchState: ReturnType<typeof vi.fn>;
    searchFiles: ReturnType<typeof vi.fn>;
    clearSearch: ReturnType<typeof vi.fn>;
  };

  const createComponent = () => {
    fixture = TestBed.createComponent(TransferSearchToolbarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'device-1');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockStorageStore = {
      getSelectedDirectoryState: vi.fn(() => signal(directoryState()).asReadonly()),
      getSearchState: vi.fn(() => signal(null).asReadonly()),
      searchFiles: vi.fn().mockResolvedValue(undefined),
      clearSearch: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TransferSearchToolbarComponent],
      providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
    }).compileComponents();

    createComponent();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  describe('debounced search', () => {
    it('triggers searchFiles once after the debounce, not per keystroke', fakeAsync(() => {
      component.onSearchInputChange('i');
      component.onSearchInputChange('ir');
      component.onSearchInputChange('iro');
      component.onSearchInputChange('iron');
      tick(5000);

      expect(mockStorageStore.searchFiles).toHaveBeenCalledTimes(1);
      expect(mockStorageStore.searchFiles).toHaveBeenCalledWith({
        deviceId: 'device-1',
        searchText: 'iron',
      });
    }));

    it('does not search before the debounce elapses', fakeAsync(() => {
      component.onSearchInputChange('iron');
      tick(10);

      expect(mockStorageStore.searchFiles).not.toHaveBeenCalled();
      tick(5000);
    }));

    it('does not auto-search empty or whitespace-only text', fakeAsync(() => {
      component.onSearchInputChange('   ');
      tick(5000);

      expect(mockStorageStore.searchFiles).not.toHaveBeenCalled();
    }));

    it('omits filterType from the search call', fakeAsync(() => {
      component.onSearchInputChange('maiden');
      tick(5000);

      const call = mockStorageStore.searchFiles.mock.calls[0][0];
      expect('filterType' in call).toBe(false);
    }));
  });

  describe('Enter key', () => {
    it('searches immediately, without waiting for the debounce', () => {
      component.onSearchInputChange('iron maiden');
      fixture.detectChanges();

      const inputField = fixture.debugElement.query(By.css('lib-input-field'));
      inputField.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(mockStorageStore.searchFiles).toHaveBeenCalledWith({
        deviceId: 'device-1',
        searchText: 'iron maiden',
      });
    });

    it('does not search when there is no selected storage directory', () => {
      mockStorageStore.getSelectedDirectoryState.mockReturnValue(signal(null).asReadonly());
      createComponent();

      component.onSearchInputChange('iron maiden');
      component.executeSearch();

      expect(mockStorageStore.searchFiles).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('calls clearSearch on the cleared output', () => {
      const inputField = fixture.debugElement.query(By.css('lib-input-field'));
      inputField.componentInstance.cleared.emit();

      expect(mockStorageStore.clearSearch).toHaveBeenCalledWith({ deviceId: 'device-1' });
    });
  });

  describe('store-sync effect', () => {
    it('empties the input when the store search state goes null', () => {
      const searchState: SearchState = {
        searchText: 'iron maiden',
        filterType: null,
        results: [],
        isSearching: false,
        hasSearched: true,
        error: null,
      };
      mockStorageStore.getSearchState.mockReturnValue(signal(searchState).asReadonly());
      createComponent();

      expect(component.searchText()).toBe('iron maiden');

      mockStorageStore.getSearchState.mockReturnValue(signal(null).asReadonly());
      createComponent();

      expect(component.searchText()).toBe('');
    });
  });
});
