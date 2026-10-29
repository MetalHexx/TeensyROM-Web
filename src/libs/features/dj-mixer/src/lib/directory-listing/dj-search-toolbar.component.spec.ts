import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal, type WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageStore, type SearchState } from '@teensyrom-nx/application';
import { DjSearchToolbarComponent } from './dj-search-toolbar.component';

const searchState = (overrides: Partial<SearchState> = {}): SearchState => ({
  searchText: 'iron maiden',
  filterType: null,
  results: [],
  isSearching: false,
  hasSearched: true,
  error: null,
  ...overrides,
});

describe('DjSearchToolbarComponent', () => {
  let fixture: ComponentFixture<DjSearchToolbarComponent>;
  let component: DjSearchToolbarComponent;
  let states: Record<string, WritableSignal<SearchState | null>>;
  let searchFiles: ReturnType<typeof vi.fn>;
  let clearSearch: ReturnType<typeof vi.fn>;

  const stateOf = (deviceId: string) => (states[deviceId] ??= signal<SearchState | null>(null));

  const fieldOf = () => fixture.debugElement.query(By.css('lib-input-field'));

  beforeEach(() => {
    vi.useFakeTimers();
    states = {};
    searchFiles = vi.fn().mockResolvedValue(undefined);
    clearSearch = vi.fn();

    TestBed.configureTestingModule({
      imports: [DjSearchToolbarComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: StorageStore,
          useValue: {
            getSearchState: vi.fn((deviceId: string) => stateOf(deviceId)),
            searchFiles,
            clearSearch,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(DjSearchToolbarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'device-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounced search', () => {
    it('searches once with the trimmed text after the debounce, not per keystroke', () => {
      component.onSearchInputChange('i');
      component.onSearchInputChange('iron ');
      vi.advanceTimersByTime(999);
      expect(searchFiles).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(searchFiles).toHaveBeenCalledTimes(1);
      expect(searchFiles).toHaveBeenCalledWith({ deviceId: 'device-1', searchText: 'iron' });
    });

    it('restarts the clock on each keystroke', () => {
      component.onSearchInputChange('iron');
      vi.advanceTimersByTime(800);
      component.onSearchInputChange('iron maiden');
      vi.advanceTimersByTime(800);
      expect(searchFiles).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(searchFiles).toHaveBeenCalledTimes(1);
      expect(searchFiles).toHaveBeenCalledWith({ deviceId: 'device-1', searchText: 'iron maiden' });
    });

    it('does not search blank or whitespace-only text, and blanking cancels a pending search', () => {
      component.onSearchInputChange('   ');
      vi.advanceTimersByTime(5000);

      component.onSearchInputChange('iron');
      component.onSearchInputChange('');
      vi.advanceTimersByTime(5000);

      expect(searchFiles).not.toHaveBeenCalled();
    });
  });

  describe('Enter key', () => {
    it('searches at once and leaves no second search behind', () => {
      component.onSearchInputChange('iron maiden');
      fieldOf().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(searchFiles).toHaveBeenCalledTimes(1);
      expect(searchFiles).toHaveBeenCalledWith({ deviceId: 'device-1', searchText: 'iron maiden' });

      vi.advanceTimersByTime(5000);
      expect(searchFiles).toHaveBeenCalledTimes(1);
    });

    it('does not search a blank box', () => {
      fieldOf().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(searchFiles).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('clears the device search and cancels a pending one', () => {
      component.onSearchInputChange('iron maiden');
      fieldOf().componentInstance.cleared.emit();
      vi.advanceTimersByTime(5000);

      expect(clearSearch).toHaveBeenCalledWith({ deviceId: 'device-1' });
      expect(searchFiles).not.toHaveBeenCalled();
    });
  });

  it('cancels a pending search on destroy', () => {
    component.onSearchInputChange('iron maiden');
    fixture.destroy();
    vi.advanceTimersByTime(5000);

    expect(searchFiles).not.toHaveBeenCalled();
  });

  describe('store sync', () => {
    it('fills the text from a search started elsewhere', () => {
      stateOf('device-1').set(searchState({ searchText: 'maiden' }));
      fixture.detectChanges();

      expect(component.searchText()).toBe('maiden');
    });

    it('empties the text when the search state goes null', () => {
      stateOf('device-1').set(searchState());
      fixture.detectChanges();
      expect(component.searchText()).toBe('iron maiden');
      expect(fieldOf().query(By.css('input')).nativeElement.value).toBe('iron maiden');

      stateOf('device-1').set(null);
      fixture.detectChanges();
      expect(component.searchText()).toBe('');
      expect(fieldOf().query(By.css('input')).nativeElement.value).toBe('');
    });
  });

  describe('changing the active device', () => {
    it('drops the old device pending search and empties the box when neither device has a search', () => {
      component.onSearchInputChange('iron maiden');

      fixture.componentRef.setInput('deviceId', 'device-2');
      fixture.detectChanges();
      vi.advanceTimersByTime(5000);

      expect(searchFiles).not.toHaveBeenCalled();
      expect(component.searchText()).toBe('');
    });

    it("shows the new device's own search text", () => {
      stateOf('device-2').set(searchState({ searchText: 'rob hubbard' }));
      component.onSearchInputChange('iron maiden');

      fixture.componentRef.setInput('deviceId', 'device-2');
      fixture.detectChanges();

      expect(component.searchText()).toBe('rob hubbard');
    });

    it('searches the new device with its own text afterwards', () => {
      fixture.componentRef.setInput('deviceId', 'device-2');
      fixture.detectChanges();

      component.onSearchInputChange('galway');
      vi.advanceTimersByTime(1000);

      expect(searchFiles).toHaveBeenCalledWith({ deviceId: 'device-2', searchText: 'galway' });
    });
  });
});
