import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { StorageStore, type StorageDirectoryState } from '@teensyrom-nx/application';
import {
  FileItemType,
  formatFileSize,
  getFileIcon,
  type DirectoryItem,
  type FileItem,
  type StorageType,
} from '@teensyrom-nx/domain';
import {
  DirectoryItemComponent,
  DragChipComponent,
  EmptyStateMessageComponent,
  IconButtonComponent,
  StorageItemActionsComponent,
  StorageItemComponent,
  TooltipPosition,
  type TooltipConfig,
} from '@teensyrom-nx/ui/components';
import { activeStorageKey, type ActiveStorage } from '../active-storage';
import { setDjFileDragData } from '../drag/dj-file-drag';
import { DjDirectoryTrailComponent } from './dj-directory-trail.component';
import { DjSearchToolbarComponent } from './dj-search-toolbar.component';

type DirectoryRow = DirectoryItem & { readonly itemType: 'directory' };
type FileRow = FileItem & { readonly itemType: 'file' };
type ListingRow = DirectoryRow | FileRow;

/**
 * The DJ view's directory listing: the active storage's trail and search box plus its contents, folders
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
    DjSearchToolbarComponent,
    DirectoryItemComponent,
    StorageItemComponent,
    StorageItemActionsComponent,
    EmptyStateMessageComponent,
    IconButtonComponent,
    DragChipComponent,
  ],
  templateUrl: './dj-directory-listing.component.html',
  styleUrl: './dj-directory-listing.component.scss',
})
export class DjDirectoryListingComponent {
  readonly activeStorage = input<ActiveStorage | null>(null);

  readonly dragStarted = output<void>();
  readonly dragEnded = output<void>();

  private readonly storageStore = inject(StorageStore);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  /** The off-screen drag-image chip's element, snapshotted synchronously by the browser on `dragstart`. */
  private readonly dragChipEl = viewChild<ElementRef<HTMLElement>, ElementRef<HTMLElement>>('dragChip', { read: ElementRef });

  /** The dragged row's name, shown by the off-screen chip that becomes the native drag image. */
  protected readonly dragChipLabel = signal('');

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

  private readonly searchState = computed(() => {
    const active = this.activeStorage();
    return active ? this.storageStore.getSearchState(active.deviceId)() : null;
  });

  readonly hasSearched = computed(() => this.searchState()?.hasSearched ?? false);
  readonly isSearching = computed(() => this.searchState()?.isSearching ?? false);
  readonly searchError = computed(() => this.searchState()?.error ?? null);
  readonly searchResults = computed<FileItem[]>(() => this.searchState()?.results ?? []);

  private readonly selectedPath = signal<string | null>(null);
  private readonly selectedResult = signal<{ path: string; storageType?: StorageType } | null>(null);

  /** The jump button sits at the card's right edge, so its tooltip opens to the left. */
  protected readonly jumpTooltip: TooltipConfig = {
    body: 'Go to containing folder',
    position: TooltipPosition.Left,
  };

  protected readonly getFileIcon = getFileIcon;
  protected readonly formatFileSize = formatFileSize;

  trackByPath = (_index: number, row: ListingRow): string => row.path;

  /** Search spans both storages, so the same path can appear twice; the storage keeps them apart. */
  trackResultByKey = (_index: number, result: FileItem): string =>
    `${result.storageType ?? ''}:${result.path}`;

  isDirectoryRow(row: ListingRow): row is DirectoryRow {
    return row.itemType === 'directory';
  }

  isSelected(row: ListingRow): boolean {
    return this.selectedPath() === row.path;
  }

  isSelectedResult(result: FileItem): boolean {
    const selected = this.selectedResult();
    return selected?.path === result.path && selected.storageType === result.storageType;
  }

  /** Only a `.sid` song is a drag source — every other file type gets nothing. */
  isDraggableFile(file: FileItem): boolean {
    return file.type === FileItemType.Song;
  }

  /** Directories are never drag sources; a file row defers to `isDraggableFile`. */
  isDraggableRow(row: ListingRow): row is FileRow {
    return !this.isDirectoryRow(row) && this.isDraggableFile(row);
  }

  onRowDragStart(event: DragEvent, row: ListingRow): void {
    const active = this.activeStorage();
    if (!active || !this.isDraggableRow(row)) return;

    this.onFileDragStart(event, row, active.storageType);
  }

  /** Starts a drag of `file` loaded from `storageType` — the storage it was listed or found on. */
  onFileDragStart(event: DragEvent, file: FileItem, storageType: StorageType): void {
    const active = this.activeStorage();
    if (!active || !this.isDraggableFile(file) || !event.dataTransfer) return;

    setDjFileDragData(event.dataTransfer, {
      deviceId: active.deviceId,
      storageType,
      path: file.path,
      fileName: file.name,
      title: file.title || file.name,
      author: file.creator,
      playLength: file.playLength,
      subtuneLengths: file.subtuneLengths,
    });

    // The label must be current before the browser snapshots the drag image, which happens
    // synchronously when this handler returns — zoneless-coalesced change detection would
    // otherwise still show the previously-dragged row's name.
    this.dragChipLabel.set(file.name);
    this.changeDetectorRef.detectChanges();

    const chipEl = this.dragChipEl()?.nativeElement;
    if (chipEl) {
      event.dataTransfer.setDragImage(chipEl, 16, chipEl.offsetHeight / 2);
    }

    this.dragStarted.emit();
  }

  onRowDragEnd(): void {
    this.dragEnded.emit();
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

  onResultSelected(result: FileItem): void {
    this.selectedResult.set({ path: result.path, storageType: result.storageType });
  }

  /** Lands the listing in a result's containing folder; navigating also clears the search. */
  onJumpToDirectory(file: FileItem): void {
    const active = this.activeStorage();
    if (!active) return;

    void this.storageStore.navigateToDirectory({
      deviceId: active.deviceId,
      storageType: file.storageType ?? active.storageType,
      path: file.parentPath,
    });
  }
}
