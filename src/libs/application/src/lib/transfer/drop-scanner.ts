import { Injectable } from '@angular/core';
import { TransferManifestEntry } from '@teensyrom-nx/domain';
import { TRANSFER_SUPPORTED_EXTENSIONS, TRANSFER_ARCHIVE_EXTENSIONS } from './transfer.constants';

/** How many matches accumulate between `onProgress` ticks, so a large walk stays visibly live. */
const PROGRESS_BATCH_SIZE = 25;

export interface DropScanResult {
  entries: TransferManifestEntry[];
  rootName: string | null;
  /** Number of entries admitted as archives — one per archive file, regardless of its contents. */
  archiveCount: number;
}

/**
 * Walks a drag-and-drop payload or a directory-picker `FileList` into a single flat manifest,
 * without reading a byte beyond what `File` handles already carry.
 *
 * No DI beyond the decorator, no HTTP - trivially constructible against fake entry trees.
 */
@Injectable({ providedIn: 'root' })
export class DropScanner {
  scan(
    input: DataTransferItemList | FileList,
    onProgress: (found: number) => void,
    signal: AbortSignal
  ): Promise<DropScanResult> {
    return isDataTransferItemList(input)
      ? this.scanDrop(input, onProgress, signal)
      : this.scanFileList(input, onProgress, signal);
  }

  private async scanDrop(
    items: DataTransferItemList,
    onProgress: (found: number) => void,
    signal: AbortSignal
  ): Promise<DropScanResult> {
    const acc = createAccumulator();
    const progress = createProgressReporter(onProgress);
    let rootName: string | null = null;

    // Synchronous, before any await: the payload is only readable during the drop event's own turn.
    const entries = Array.from(items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null);

    for (const entry of entries) {
      if (signal.aborted) break;

      if (entry.isDirectory) {
        if (rootName === null) {
          rootName = entry.name;
        }
        await this.walkDirectory(
          entry as FileSystemDirectoryEntry,
          `${entry.name}/`,
          acc,
          progress,
          signal
        );
      } else if (entry.isFile) {
        const file = await readFile(entry as FileSystemFileEntry);
        addIfSupported(acc, file, entry.name, progress);
      }
    }

    progress.flush(acc.entries.length);
    return { entries: sortArchivesFirst(acc.entries), rootName, archiveCount: acc.archiveCount };
  }

  private async scanFileList(
    files: FileList,
    onProgress: (found: number) => void,
    signal: AbortSignal
  ): Promise<DropScanResult> {
    const acc = createAccumulator();
    const progress = createProgressReporter(onProgress);
    let rootName: string | null = null;

    for (const file of Array.from(files)) {
      if (signal.aborted) break;

      // `webkitRelativePath` from a directory picker already carries the root folder name.
      const relativePath = file.webkitRelativePath || file.name;
      if (rootName === null && file.webkitRelativePath) {
        rootName = file.webkitRelativePath.split('/')[0];
      }

      addIfSupported(acc, file, relativePath, progress);
    }

    progress.flush(acc.entries.length);
    return { entries: sortArchivesFirst(acc.entries), rootName, archiveCount: acc.archiveCount };
  }

  private async walkDirectory(
    directory: FileSystemDirectoryEntry,
    pathPrefix: string,
    acc: ScanAccumulator,
    progress: ProgressReporter,
    signal: AbortSignal
  ): Promise<void> {
    const reader = directory.createReader();

    // `readEntries` returns at most 100 entries per call; it must be drained until empty or a
    // large folder silently truncates.
    while (!signal.aborted) {
      const batch = await readEntries(reader);
      if (batch.length === 0) break;

      for (const child of batch) {
        if (signal.aborted) break;

        if (child.isDirectory) {
          await this.walkDirectory(
            child as FileSystemDirectoryEntry,
            `${pathPrefix}${child.name}/`,
            acc,
            progress,
            signal
          );
        } else if (child.isFile) {
          const file = await readFile(child as FileSystemFileEntry);
          addIfSupported(acc, file, `${pathPrefix}${child.name}`, progress);
        }
      }
    }
  }
}

function isDataTransferItemList(
  input: DataTransferItemList | FileList
): input is DataTransferItemList {
  const first = (input as ArrayLike<{ webkitGetAsEntry?: unknown }>)[0];
  return typeof first?.webkitGetAsEntry === 'function';
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function extensionOf(relativePath: string): string | null {
  const dotIndex = relativePath.lastIndexOf('.');
  return dotIndex === -1 ? null : relativePath.slice(dotIndex).toLowerCase();
}

function hasSupportedExtension(relativePath: string): boolean {
  const extension = extensionOf(relativePath);
  return extension !== null && TRANSFER_SUPPORTED_EXTENSIONS.has(extension);
}

function isArchiveExtension(relativePath: string): boolean {
  const extension = extensionOf(relativePath);
  return extension !== null && TRANSFER_ARCHIVE_EXTENSIONS.has(extension);
}

interface ScanAccumulator {
  entries: TransferManifestEntry[];
  archiveCount: number;
}

function createAccumulator(): ScanAccumulator {
  return { entries: [], archiveCount: 0 };
}

function addIfSupported(
  acc: ScanAccumulator,
  file: File,
  relativePath: string,
  progress: ProgressReporter
): void {
  if (!hasSupportedExtension(relativePath)) return;

  acc.entries.push({ file, relativePath, sizeBytes: file.size });
  if (isArchiveExtension(relativePath)) {
    acc.archiveCount++;
  }
  progress.report(acc.entries.length);
}

/**
 * Groups every archive entry ahead of every ordinary file, at the end of the scan rather than
 * during it — resorting per batch while walking would cost repeated work for no benefit. `sort`
 * is stable in every engine the app targets, so relative order within each group survives.
 */
function sortArchivesFirst(entries: TransferManifestEntry[]): TransferManifestEntry[] {
  return [...entries].sort((a, b) => {
    const aIsArchive = isArchiveExtension(a.relativePath);
    const bIsArchive = isArchiveExtension(b.relativePath);
    if (aIsArchive === bIsArchive) return 0;
    return aIsArchive ? -1 : 1;
  });
}

interface ProgressReporter {
  report(count: number): void;
  flush(finalCount: number): void;
}

/** Batches `onProgress` ticks so a large walk stays cheap while still visibly moving. */
function createProgressReporter(onProgress: (found: number) => void): ProgressReporter {
  let lastReported = 0;
  return {
    report(count: number): void {
      if (count - lastReported >= PROGRESS_BATCH_SIZE) {
        lastReported = count;
        onProgress(count);
      }
    },
    flush(finalCount: number): void {
      if (finalCount !== lastReported) {
        lastReported = finalCount;
        onProgress(finalCount);
      }
    },
  };
}
