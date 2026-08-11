import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { StorageStore } from '@teensyrom-nx/application';
import { DirectoryItem, FileItem } from '@teensyrom-nx/domain';
import {
  DirectoryItemComponent,
  EmptyStateMessageComponent,
  IconButtonComponent,
  ScalingCardComponent,
  StorageItemActionsComponent,
  StorageItemComponent,
} from '@teensyrom-nx/ui/components';
import { DirectoryTrailContainerComponent } from '../directory-trail-container/directory-trail-container.component';
import { TransferSearchToolbarComponent } from './transfer-search-toolbar/transfer-search-toolbar.component';

/** Generic icon for existing files — this view only needs a name and a path, not the file's type. */
const EXISTING_FILE_ICON = 'insert_drive_file';

type DirectoryRow = DirectoryItem & { itemType: 'directory' };
type FileRow = FileItem & { itemType: 'file' };
type ListingRow = DirectoryRow | FileRow;

/**
 * The destination directory's contents: navigable folders and, below a divider,
 * existing files shown for awareness only. The only warning a user gets before a
 * silent-overwrite transfer.
 */
@Component({
  selector: 'lib-transfer-directory-listing',
  imports: [
    CommonModule,
    ScrollingModule,
    ScalingCardComponent,
    DirectoryItemComponent,
    StorageItemComponent,
    StorageItemActionsComponent,
    IconButtonComponent,
    EmptyStateMessageComponent,
    DirectoryTrailContainerComponent,
    TransferSearchToolbarComponent,
  ],
  templateUrl: './transfer-directory-listing.component.html',
  styleUrl: './transfer-directory-listing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferDirectoryListingComponent {
  deviceId = input.required<string>();

  private readonly storageStore = inject(StorageStore);

  readonly isDeviceLevelView = computed(() =>
    this.storageStore.isDeviceLevelView(this.deviceId())()
  );

  private readonly selectedDirectoryState = computed(() =>
    this.storageStore.getSelectedDirectoryState(this.deviceId())()
  );

  readonly directories = computed<DirectoryItem[]>(
    () => this.selectedDirectoryState()?.directory?.directories ?? []
  );

  readonly files = computed<FileItem[]>(
    () => this.selectedDirectoryState()?.directory?.files ?? []
  );

  readonly folderCount = computed(() => this.directories().length);
  readonly fileCount = computed(() => this.files().length);

  readonly hasContent = computed(() => this.folderCount() > 0 || this.fileCount() > 0);

  /** The divider between folders and files is only meaningful when both groups exist. */
  readonly showDivider = computed(() => this.folderCount() > 0 && this.fileCount() > 0);

  readonly rows = computed<ListingRow[]>(() => [
    ...this.directories().map((d) => ({ ...d, itemType: 'directory' as const })),
    ...this.files().map((f) => ({ ...f, itemType: 'file' as const })),
  ]);

  readonly existingFileIcon = EXISTING_FILE_ICON;

  private readonly searchState = computed(() => this.storageStore.getSearchState(this.deviceId())());

  readonly hasSearched = computed(() => this.searchState()?.hasSearched ?? false);
  readonly isSearching = computed(() => this.searchState()?.isSearching ?? false);
  readonly searchError = computed(() => this.searchState()?.error ?? null);
  readonly searchResults = computed<FileItem[]>(() => this.searchState()?.results ?? []);

  private readonly selectedPath = signal<string | null>(null);

  trackByPath = (_index: number, row: ListingRow): string => row.path;

  trackResultByPath = (_index: number, result: FileItem): string => result.path;

  isDirectoryRow(row: ListingRow): row is DirectoryRow {
    return row.itemType === 'directory';
  }

  isSelected(row: ListingRow): boolean {
    return this.selectedPath() === row.path;
  }

  onDirectorySelected(directory: DirectoryItem): void {
    this.selectedPath.set(directory.path);
  }

  onDirectoryActivated(directory: DirectoryItem): void {
    const state = this.selectedDirectoryState();
    if (!state) return;

    void this.storageStore.navigateToDirectory({
      deviceId: this.deviceId(),
      storageType: state.storageType,
      path: directory.path,
    });
    this.selectedPath.set(null);
  }

  /**
   * Jumps to the containing directory of a search result — the only interaction a result row
   * offers. Navigating also clears the active search, landing the listing on that directory.
   */
  onJumpToDirectory(file: FileItem): void {
    const state = this.selectedDirectoryState();
    if (!state) return;

    void this.storageStore.navigateToDirectory({
      deviceId: this.deviceId(),
      storageType: file.storageType ?? state.storageType,
      path: file.parentPath,
    });
  }
}
