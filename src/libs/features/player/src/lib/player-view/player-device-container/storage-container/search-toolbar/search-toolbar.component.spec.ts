import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { vi } from 'vitest';
import { NEVER } from 'rxjs';
import { By } from '@angular/platform-browser';
import { StorageStore, type IPlayerContext, type ShuffleSettings } from '@teensyrom-nx/application';
import { createMockStorageService } from '@teensyrom-nx/testing/fixtures';
import {
  STORAGE_SERVICE,
  PlayerFilterType,
  PlayerScope,
  StorageType,
  type IStorageService,
} from '@teensyrom-nx/domain';
import { InputFieldComponent } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { SearchToolbarComponent } from './search-toolbar.component';

const deviceId = 'device-1';

describe('SearchToolbarComponent', () => {
  // The component's `#searchInput` viewChild calls real InputFieldComponent methods
  // (`writeValue`) from a sync effect, and several rows read its own inputs directly.
  function render(
    playerContext: Partial<IPlayerContext> = {},
    searchServiceOverrides: Partial<IStorageService> = {}
  ) {
    const result = renderPlayerComponent(SearchToolbarComponent, {
      inputs: { deviceId },
      playerContext,
      providers: [
        { provide: STORAGE_SERVICE, useValue: createMockStorageService(searchServiceOverrides) },
      ],
      realChildren: [InputFieldComponent],
    });
    return { ...result, storageStore: TestBed.inject(StorageStore) };
  }

  async function renderWithStorageType(playerContext: Partial<IPlayerContext> = {}) {
    const rendered = render(playerContext);
    await rendered.storageStore.initializeStorage({ deviceId, storageType: StorageType.Sd });
    rendered.fixture.detectChanges();
    return rendered;
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('initializes with empty search text', () => {
    const { component } = render();
    expect(component.searchText()).toBe('');
  });

  it('reports canSearch false initially', () => {
    const { component } = render();
    expect(component.canSearch()).toBe(false);
  });

  it('updates searchText on input change', () => {
    const { component } = render();
    component.onSearchInputChange('test query');
    expect(component.searchText()).toBe('test query');
  });

  it('reports canSearch true once text is entered', () => {
    const { component } = render();
    component.onSearchInputChange('test');
    expect(component.canSearch()).toBe(true);
  });

  it('reports canSearch false for whitespace-only text', () => {
    const { component } = render();
    component.onSearchInputChange('   ');
    expect(component.canSearch()).toBe(false);
  });

  it('reports canSearch false while a search is already in progress', () => {
    const { component, storageStore } = render({}, { search: vi.fn().mockReturnValue(NEVER) });
    void storageStore.searchFiles({ deviceId, searchText: 'test' });

    component.onSearchInputChange('more text');

    expect(component.canSearch()).toBe(false);
  });

  describe('executeSearch', () => {
    it('calls searchFiles with the device id, text, and current filter', async () => {
      const { component, storageStore } = await renderWithStorageType();
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);
      component.onSearchInputChange('iron maiden');

      component.executeSearch();

      expect(searchFiles).toHaveBeenCalledWith({
        deviceId,
        searchText: 'iron maiden',
        filterType: PlayerFilterType.All,
      });
    });

    it('trims the search text before calling searchFiles', async () => {
      const { component, storageStore } = await renderWithStorageType();
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);
      component.onSearchInputChange('  spaced text  ');

      component.executeSearch();

      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({ searchText: 'spaced text' })
      );
    });

    it('is a no-op for empty/whitespace text', async () => {
      const { component, storageStore } = await renderWithStorageType();
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);
      component.onSearchInputChange('   ');

      component.executeSearch();

      expect(searchFiles).not.toHaveBeenCalled();
    });

    it('is a no-op when storageType is null', () => {
      const { component, storageStore } = render();
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);
      component.onSearchInputChange('test');

      component.executeSearch();

      expect(searchFiles).not.toHaveBeenCalled();
    });

    it('uses the current filter type from the player context', async () => {
      const { component, storageStore } = await renderWithStorageType({
        getShuffleSettings: vi
          .fn()
          .mockReturnValue(
            signal<ShuffleSettings>({
              filter: PlayerFilterType.Games,
              scope: PlayerScope.Storage,
            }).asReadonly()
          ),
      });
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);
      component.onSearchInputChange('mario');

      component.executeSearch();

      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({ filterType: PlayerFilterType.Games })
      );
    });

    it('triggers a search on Enter key press', async () => {
      const { component, fixture, storageStore } = await renderWithStorageType();
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);
      component.onSearchInputChange('test search');
      fixture.detectChanges();

      const inputField = fixture.debugElement.query(By.css('lib-input-field'));
      inputField.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(searchFiles).toHaveBeenCalled();
    });
  });

  describe('debounced auto-search', () => {
    it('does not fire for empty text', fakeAsync(() => {
      const { component, storageStore } = render();
      const searchFiles = vi.spyOn(storageStore, 'searchFiles').mockResolvedValue(undefined);

      component.onSearchInputChange('');
      tick(1000);

      expect(searchFiles).not.toHaveBeenCalled();
    }));
  });

  describe('clearSearch', () => {
    it("calls the store's clearSearch with the deviceId", async () => {
      const { component, storageStore } = await renderWithStorageType();
      const clearSearch = vi.spyOn(storageStore, 'clearSearch');

      component.clearSearch();

      expect(clearSearch).toHaveBeenCalledWith({ deviceId });
    });

    it('is a no-op when storageType is null', () => {
      const { component, storageStore } = render();
      const clearSearch = vi.spyOn(storageStore, 'clearSearch');

      component.clearSearch();

      expect(clearSearch).not.toHaveBeenCalled();
    });
  });

  describe('computed signals', () => {
    it('reflects hasSearched from the search state', async () => {
      const { component, storageStore } = render();
      expect(component.hasActiveSearch()).toBe(false);

      await storageStore.searchFiles({ deviceId, searchText: 'test' });

      expect(component.hasActiveSearch()).toBe(true);
    });

    it('reflects isSearching from the search state', () => {
      const { component, storageStore } = render({}, { search: vi.fn().mockReturnValue(NEVER) });
      expect(component.isSearching()).toBe(false);

      void storageStore.searchFiles({ deviceId, searchText: 'test' });

      expect(component.isSearching()).toBe(true);
    });

    it("reflects the player context's shuffle-settings filter", () => {
      const shuffleSettings = signal<ShuffleSettings | null>(null);
      const { component, fixture } = render({
        getShuffleSettings: vi.fn(() => shuffleSettings.asReadonly()),
      });
      expect(component.currentFilter()).toBe(PlayerFilterType.All);

      shuffleSettings.set({ filter: PlayerFilterType.Music, scope: PlayerScope.Storage });
      fixture.detectChanges();

      expect(component.currentFilter()).toBe(PlayerFilterType.Music);
    });
  });

  describe('template rendering', () => {
    it('renders .search-toolbar-content as the root element', () => {
      const { fixture } = render();
      expect(fixture.nativeElement.firstElementChild.classList.contains('search-toolbar-content')).toBe(
        true
      );
    });

    it('renders no card-wrapper component around the toolbar', () => {
      const { fixture } = render();
      expect(fixture.debugElement.query(By.css('lib-scaling-compact-card'))).toBeFalsy();
    });

    it('renders the input field with clearable=true', () => {
      const { fixture } = render();
      const inputField = fixture.debugElement.query(By.css('lib-input-field'));
      expect(inputField.componentInstance.clearable()).toBe(true);
    });

    it('renders no clear button in the DOM when not visible', () => {
      const { fixture } = render();
      const inputField = fixture.debugElement.query(By.css('lib-input-field'));
      expect(inputField.query(By.css('.clear-button'))).toBeFalsy();
    });

    it('renders the field with the correct placeholder and clearable properties', () => {
      const { fixture } = render();
      const inputField = fixture.debugElement.query(By.css('lib-input-field'));
      expect(inputField.componentInstance.placeholder()).toBe('Search');
      expect(inputField.componentInstance.clearable()).toBe(true);
    });
  });
});
