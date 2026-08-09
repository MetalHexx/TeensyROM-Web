import { Injectable } from '@angular/core';
import { TransferManifestEntry } from '@teensyrom-nx/domain';
import { TRANSFER_SUPPORTED_EXTENSIONS } from './transfer.constants';

/** How many matches accumulate between `onProgress` ticks, so a large walk stays visibly live. */
const PROGRESS_BATCH_SIZE = 25;

export interface DropScanResult {
  entries: TransferManifestEntry[];
  rootName: string | null;
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
    const entries: TransferManifestEntry[] = [];
    const progress = createProgressReporter(onProgress);
    let rootName: string | null = null;

    for (const item of Array.from(items)) {
      if (signal.aborted) break;

      const entry = item.webkitGetAsEntry();
      if (!entry) continue;

      if (entry.isDirectory) {
        if (rootName === null) {
          rootName = entry.name;
        }
        await this.walkDirectory(entry as FileSystemDirectoryEntry, `${entry.name}/`, entries, progress, signal);
      } else if (entry.isFile) {
        const file = await readFile(entry as FileSystemFileEntry);
        addIfSupported(entries, file, entry.name, progress);
      }
    }

    progress.flush(entries.length);
    return { entries, rootName };
  }

  private async scanFileList(
    files: FileList,
    onProgress: (found: number) => void,
    signal: AbortSignal
  ): Promise<DropScanResult> {
    const entries: TransferManifestEntry[] = [];
    const progress = createProgressReporter(onProgress);
    let rootName: string | null = null;

    for (const file of Array.from(files)) {
      if (signal.aborted) break;

      // `webkitRelativePath` from a directory picker already carries the root folder name.
      const relativePath = file.webkitRelativePath || file.name;
      if (rootName === null && file.webkitRelativePath) {
        rootName = file.webkitRelativePath.split('/')[0];
      }

      addIfSupported(entries, file, relativePath, progress);
    }

    progress.flush(entries.length);
    return { entries, rootName };
  }

  private async walkDirectory(
    directory: FileSystemDirectoryEntry,
    pathPrefix: string,
    entries: TransferManifestEntry[],
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
            entries,
            progress,
            signal
          );
        } else if (child.isFile) {
          const file = await readFile(child as FileSystemFileEntry);
          addIfSupported(entries, file, `${pathPrefix}${child.name}`, progress);
        }
      }
    }
  }
}

function isDataTransferItemList(input: DataTransferItemList | FileList): input is DataTransferItemList {
  const first = (input as ArrayLike<{ webkitGetAsEntry?: unknown }>)[0];
  return typeof first?.webkitGetAsEntry === 'function';
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function hasSupportedExtension(relativePath: string): boolean {
  const dotIndex = relativePath.lastIndexOf('.');
  if (dotIndex === -1) return false;
  return TRANSFER_SUPPORTED_EXTENSIONS.has(relativePath.slice(dotIndex).toLowerCase());
}

function addIfSupported(
  entries: TransferManifestEntry[],
  file: File,
  relativePath: string,
  progress: ProgressReporter
): void {
  if (!hasSupportedExtension(relativePath)) return;

  entries.push({ file, relativePath, sizeBytes: file.size });
  progress.report(entries.length);
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
