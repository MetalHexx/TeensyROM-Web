import { Component, input, inject, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DirectoryTreeComponent } from './directory-tree/directory-tree.component';
import { DirectoryFilesComponent } from './directory-files/directory-files.component';
import { StorageStore, PLAYER_CONTEXT, IPlayerContext } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { SearchResultsComponent } from './search-results/search-results.component';
import { PlayHistoryComponent } from './play-history/play-history.component';

@Component({
  selector: 'lib-storage-container',
  imports: [
    CommonModule,
    DirectoryTreeComponent,
    DirectoryFilesComponent,
    SearchResultsComponent,
    PlayHistoryComponent,
  ],
  templateUrl: './storage-container.component.html',
  styleUrl: './storage-container.component.scss',
})
export class StorageContainerComponent {
  deviceId = input.required<string>();
  availableStorageTypes = input<StorageType[]>([]);

  readonly storageStore = inject(StorageStore);
  private readonly playerContext: IPlayerContext = inject(PLAYER_CONTEXT);

  readonly deviceEntries = computed(() =>
    this.storageStore.getDeviceStorageEntries(this.deviceId())()
  );

  readonly hasActiveSearch = computed(() => {
    const searchState = this.storageStore.getSearchState(this.deviceId())();
    return searchState?.hasSearched ?? false;
  });

  readonly historyViewVisible = computed(() =>
    this.playerContext.isHistoryViewVisible(this.deviceId())()
  );

  readonly hasPlayHistory = computed(() => {
    const history = this.playerContext.getPlayHistory(this.deviceId())();
    return (history?.entries.length ?? 0) > 0;
  });

  readonly shouldShowHistory = computed(
    () => this.historyViewVisible() && !this.hasActiveSearch() && this.hasPlayHistory()
  );

  private readonly initializationRecoveryEffect = effect(() => {
    const entries = this.deviceEntries();
    const deviceId = this.deviceId();
    const storageTypes = this.availableStorageTypes();

    for (const storageType of storageTypes) {
      const key = `${deviceId}-${storageType}`;
      const entry = entries[key];
      if (!entry || (!entry.isLoaded && !entry.isLoading)) {
        untracked(() =>
          this.storageStore.initializeStorage({ deviceId, storageType })
        );
      }
    }
  });

  onDirectoryNavigated(): void {
    const deviceId = this.deviceId();

    // Only hide history if currently visible
    if (this.playerContext.isHistoryViewVisible(deviceId)()) {
      this.playerContext.toggleHistoryView(deviceId);
    }
  }
}
