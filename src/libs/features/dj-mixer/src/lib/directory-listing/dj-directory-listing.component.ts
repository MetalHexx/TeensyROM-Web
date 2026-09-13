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
} from '@teensyrom-nx/domain';
import {
  DirectoryItemComponent,
  DragChipComponent,
  EmptyStateMessageComponent,
  StorageItemActionsComponent,
  StorageItemComponent,
} from '@teensyrom-nx/ui/components';
import { activeStorageKey, type ActiveStorage } from '../active-storage';
import { setDjFileDragData } from '../drag/dj-file-drag';
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

  /** Only a `.sid` song row is a drag source — directories and every other file type get nothing. */
  isDraggableRow(row: ListingRow): row is FileRow {
    return !this.isDirectoryRow(row) && row.type === FileItemType.Song;
  }

  onRowDragStart(event: DragEvent, row: ListingRow): void {
    const active = this.activeStorage();
    if (!active || !this.isDraggableRow(row) || !event.dataTransfer) return;

    setDjFileDragData(event.dataTransfer, {
      deviceId: active.deviceId,
      storageType: active.storageType,
      path: row.path,
      fileName: row.name,
    });

    // The label must be current before the browser snapshots the drag image, which happens
    // synchronously when this handler returns — zoneless-coalesced change detection would
    // otherwise still show the previously-dragged row's name.
    this.dragChipLabel.set(row.name);
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
}
