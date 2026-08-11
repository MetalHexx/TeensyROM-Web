import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputFieldComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';
import { StorageStore } from '@teensyrom-nx/application';

/** Matches the Player search toolbar's debounce so search-as-you-type feels consistent app-wide. */
const SEARCH_DEBOUNCE_MS = 1000;

/**
 * Debounced search box for the transfer directory listing's header. Searches the target device
 * across storages via the shared `StorageStore` search state — no player filter, no shuffle
 * settings, this view only ever picks a destination directory.
 */
@Component({
  selector: 'lib-transfer-search-toolbar',
  imports: [CommonModule, InputFieldComponent],
  templateUrl: './transfer-search-toolbar.component.html',
  styleUrl: './transfer-search-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferSearchToolbarComponent implements OnDestroy {
  /** Device whose storages this toolbar searches. */
  deviceId = input.required<string>();

  private readonly storageStore = inject(StorageStore);

  private readonly searchInput = viewChild<InputFieldComponent>('searchInput');

  readonly searchTooltip: TooltipConfig = {
    title: 'Search Files',
    body: 'Searches for files using the file name, directory name, and file metadata like composer name, song title, HVSC STIL comments etc.',
    position: TooltipPosition.Top,
  };

  readonly clearTooltip: TooltipConfig = {
    title: 'Clear Search',
    body: 'Clears the search and returns to the current directory listing.',
    position: TooltipPosition.Top,
  };

  private readonly selectedDirectoryState = computed(() =>
    this.storageStore.getSelectedDirectoryState(this.deviceId())()
  );

  /** Search needs a selected storage directory as its destination context; device level has none. */
  private readonly currentStorageType = computed(() => this.selectedDirectoryState()?.storageType ?? null);

  private readonly searchState = computed(() => this.storageStore.getSearchState(this.deviceId())());

  readonly isSearching = computed(() => this.searchState()?.isSearching ?? false);

  /** Local text signal; the sync effect below keeps it aligned with the store's search state. */
  readonly searchText = signal('');

  readonly canSearch = computed(() => this.searchText().trim().length > 0 && !this.isSearching());

  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Bidirectionally sync the input with the store's search state. A null state means the search
    // was cleared — by clearSearch() here or by any navigation action, which all clear it too.
    effect(() => {
      const state = this.searchState();

      untracked(() => {
        const inputField = this.searchInput();

        if (!state) {
          this.searchText.set('');
          inputField?.writeValue('');
          return;
        }

        if (state.searchText !== this.searchText()) {
          this.searchText.set(state.searchText);
          inputField?.writeValue(state.searchText);
        }
      });
    });
  }

  /** Updates the local text and (re)schedules the debounced auto-search for it. */
  onSearchInputChange(value: string): void {
    this.searchText.set(value);

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (value.trim().length === 0) {
      return;
    }

    this.searchTimeout = setTimeout(() => {
      if (this.canSearch()) {
        this.executeSearch();
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  executeSearch(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    const trimmedText = this.searchText().trim();
    if (trimmedText.length === 0) return;
    if (!this.currentStorageType()) return;

    void this.storageStore.searchFiles({
      deviceId: this.deviceId(),
      searchText: trimmedText,
    });
  }

  clearSearch(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!this.currentStorageType()) return;

    this.storageStore.clearSearch({ deviceId: this.deviceId() });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimeout);
  }
}
