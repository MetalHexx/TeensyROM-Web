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
import { InputFieldComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';
import { StorageStore } from '@teensyrom-nx/application';

/** Matches the Player and File Transfer search toolbars' debounce so search-as-you-type feels consistent app-wide. */
const SEARCH_DEBOUNCE_MS = 1000;

/**
 * Debounced search box for the DJ directory listing's header. Searches the active device across
 * storages via the shared `StorageStore` search state; it is rendered only while a storage is
 * active, so the device is always known.
 */
@Component({
  selector: 'lib-dj-search-toolbar',
  imports: [InputFieldComponent],
  templateUrl: './dj-search-toolbar.component.html',
  styleUrl: './dj-search-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DjSearchToolbarComponent implements OnDestroy {
  /** Device this toolbar searches. */
  readonly deviceId = input.required<string>();

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

  private readonly searchState = computed(() => this.storageStore.getSearchState(this.deviceId())());

  private readonly isSearching = computed(() => this.searchState()?.isSearching ?? false);

  /** Local text signal; the sync effects below keep it aligned with the store's search state. */
  readonly searchText = signal('');

  private readonly canSearch = computed(
    () => this.searchText().trim().length > 0 && !this.isSearching()
  );

  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Bidirectionally sync the input with the store's search state. A null state means the search
    // was cleared — by clearSearch() here or by any navigation action, which all clear it too.
    effect(() => {
      const state = this.searchState();

      untracked(() => {
        if (!state) {
          this.setText('');
          return;
        }

        if (state.searchText !== this.searchText()) {
          this.setText(state.searchText);
        }
      });
    });

    // The toolbar outlives a change of active device. A state-keyed effect does not re-run when
    // both devices have no search, so this one reads the device itself: it drops the old device's
    // pending search and shows the new device's own text (or none).
    effect(() => {
      const deviceId = this.deviceId();

      untracked(() => {
        this.cancelPendingSearch();
        this.setText(this.storageStore.getSearchState(deviceId)()?.searchText ?? '');
      });
    });
  }

  /** Updates the local text and (re)schedules the debounced auto-search for it. */
  onSearchInputChange(value: string): void {
    this.searchText.set(value);
    this.cancelPendingSearch();

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
    this.cancelPendingSearch();

    const trimmedText = this.searchText().trim();
    if (trimmedText.length === 0) return;

    void this.storageStore.searchFiles({
      deviceId: this.deviceId(),
      searchText: trimmedText,
    });
  }

  clearSearch(): void {
    this.cancelPendingSearch();
    this.storageStore.clearSearch({ deviceId: this.deviceId() });
  }

  ngOnDestroy(): void {
    this.cancelPendingSearch();
  }

  private setText(text: string): void {
    this.searchText.set(text);
    this.searchInput()?.writeValue(text);
  }

  private cancelPendingSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = undefined;
  }
}
