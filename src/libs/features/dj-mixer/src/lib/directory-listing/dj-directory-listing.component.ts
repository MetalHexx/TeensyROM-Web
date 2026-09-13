import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { StorageStore, type StorageDirectoryState } from '@teensyrom-nx/application';
import {
  formatFileSize,
  getFileIcon,
  type DirectoryItem,
  type FileItem,
} from '@teensyrom-nx/domain';
import {
  DirectoryItemComponent,
  EmptyStateMessageComponent,
  StorageItemActionsComponent,
  StorageItemComponent,
} from '@teensyrom-nx/ui/components';
import { activeStorageKey, type ActiveStorage } from '../active-storage';
import { DjDirectoryTrailComponent } from './dj-directory-trail.component';

type DirectoryRow = DirectoryItem & { readonly itemType: 'directory' };
type FileRow = FileItem & { readonly itemType: 'file' };
type ListingRow = DirectoryRow | FileRow;

/**
 * The DJ view's directory listing: the active storage's trail plus its contents, folders
 * before files. A thin container over `StorageStore`, mirroring the file-transfer view's
 * `transfer-directory-listing` — except a single click on a folder row navigates into it
 * (rather than the player's double-click), and a file row only selects.
 */
@Component({
  selector: 'lib-dj-directory-listing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollingModule,
    DjDirectoryTrailComponent,
    DirectoryItemComponent,
    StorageItemComponent,
    StorageItemActionsComponent,
    EmptyStateMessageComponent,
  ],
  templateUrl: './dj-directory-listing.component.html',
  styleUrl: './dj-directory-listing.component.scss',
})
export class DjDirectoryListingComponent {
  readonly activeStorage = input<ActiveStorage | null>(null);

  private readonly storageStore = inject(StorageStore);

  private readonly entry = computed<StorageDirectoryState | null>(() => {
    const key = activeStorageKey(this.activeStorage());
    return key ? this.storageStore.storageEntries()[key] ?? null : null;
  });

  readonly isLoading = computed(() => this.entry()?.isLoading ?? false);
  readonly error = computed(() => this.entry()?.error ?? null);

  private readonly directories = computed<DirectoryItem[]>(
    () => this.entry()?.directory?.directories ?? []
  );
  private readonly files = computed<FileItem[]>(() => this.entry()?.directory?.files ?? []);

  readonly hasContent = computed(() => this.directories().length > 0 || this.files().length > 0);

  readonly rows = computed<ListingRow[]>(() => [
    ...this.directories().map((d): DirectoryRow => ({ ...d, itemType: 'directory' })),
    ...this.files().map((f): FileRow => ({ ...f, itemType: 'file' })),
  ]);

  private readonly selectedPath = signal<string | null>(null);

  protected readonly getFileIcon = getFileIcon;
  protected readonly formatFileSize = formatFileSize;

  trackByPath = (_index: number, row: ListingRow): string => row.path;

  isDirectoryRow(row: ListingRow): row is DirectoryRow {
    return row.itemType === 'directory';
  }

  isSelected(row: ListingRow): boolean {
    return this.selectedPath() === row.path;
  }

  onDirectorySelected(directory: DirectoryItem): void {
    const active = this.activeStorage();
    if (!active) return;

    void this.storageStore.navigateToDirectory({
      deviceId: active.deviceId,
      storageType: active.storageType,
      path: directory.path,
    });
    this.selectedPath.set(null);
  }

  onFileSelected(file: FileItem): void {
    this.selectedPath.set(file.path);
  }
}
