import { describe, it, expect } from 'vitest';
import { DropScanner } from './drop-scanner';

function createFile(name: string, content = 'x'): File {
  return new File([content], name);
}

function withRelativePath(file: File, relativePath: string): File {
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath, configurable: true });
  return file;
}

function fileEntry(name: string, file: File = createFile(name)): FileSystemFileEntry {
  return {
    name,
    isFile: true,
    isDirectory: false,
    file: (successCallback: (file: File) => void) => successCallback(file),
  } as unknown as FileSystemFileEntry;
}

/** A directory entry whose reader only ever hands back `pageSize` children per `readEntries` call. */
function directoryEntry(name: string, children: FileSystemEntry[], pageSize = 100): FileSystemDirectoryEntry {
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => {
      let index = 0;
      return {
        readEntries: (successCallback: (entries: FileSystemEntry[]) => void) => {
          const batch = children.slice(index, index + pageSize);
          index += batch.length;
          Promise.resolve().then(() => successCallback(batch));
        },
      } as unknown as FileSystemDirectoryReader;
    },
  } as unknown as FileSystemDirectoryEntry;
}

function dropItem(entry: FileSystemEntry | null): DataTransferItem {
  return { webkitGetAsEntry: () => entry } as unknown as DataTransferItem;
}

function asItemList(items: DataTransferItem[]): DataTransferItemList {
  return items as unknown as DataTransferItemList;
}

function asFileList(files: File[]): FileList {
  return files as unknown as FileList;
}

describe('DropScanner', () => {
  const noopProgress = () => undefined;
  const signal = () => new AbortController().signal;

  describe('drag-and-drop input', () => {
    it('roots every path at the dropped folder name and keeps only supported extensions', async () => {
      const tree = directoryEntry('HVSC', [
        fileEntry('song.sid'),
        fileEntry('readme.txt'),
        fileEntry('image.png'),
        directoryEntry('sub', [fileEntry('tune.crt'), fileEntry('notes.doc')]),
      ]);

      const scanner = new DropScanner();
      const result = await scanner.scan(asItemList([dropItem(tree)]), noopProgress, signal());

      expect(result.rootName).toBe('HVSC');
      expect(result.entries.map((e) => e.relativePath).sort()).toEqual(
        ['HVSC/readme.txt', 'HVSC/song.sid', 'HVSC/sub/tune.crt'].sort()
      );
    });

    it('gives a dropped loose file just its own name, with no folder prefix', async () => {
      const folder = directoryEntry('Games', [fileEntry('pitfall.prg')]);
      const looseFile = fileEntry('standalone.sid');

      const scanner = new DropScanner();
      const result = await scanner.scan(
        asItemList([dropItem(folder), dropItem(looseFile)]),
        noopProgress,
        signal()
      );

      expect(result.rootName).toBe('Games');
      expect(result.entries.map((e) => e.relativePath).sort()).toEqual(
        ['Games/pitfall.prg', 'standalone.sid'].sort()
      );
    });

    it('drains a directory reader that only ever returns 100 entries per call', async () => {
      const children = Array.from({ length: 250 }, (_, i) => fileEntry(`file-${i}.sid`));
      const tree = directoryEntry('Big', children, 100);

      const scanner = new DropScanner();
      const result = await scanner.scan(asItemList([dropItem(tree)]), noopProgress, signal());

      expect(result.entries).toHaveLength(250);
    });

    it('reports the found count incrementally as it walks, ending on the true total', async () => {
      const children = Array.from({ length: 60 }, (_, i) => fileEntry(`song-${i}.sid`));
      const tree = directoryEntry('Pack', children);

      const progressTicks: number[] = [];
      const scanner = new DropScanner();
      const result = await scanner.scan(asItemList([dropItem(tree)]), (found) => progressTicks.push(found), signal());

      expect(result.entries).toHaveLength(60);
      expect(progressTicks.length).toBeGreaterThan(1);
      expect(progressTicks[progressTicks.length - 1]).toBe(60);
      expect(progressTicks).toEqual([...progressTicks].sort((a, b) => a - b));
    });

    it('resolves to an empty manifest for an empty drop', async () => {
      const scanner = new DropScanner();
      const result = await scanner.scan(asItemList([]), noopProgress, signal());

      expect(result.entries).toEqual([]);
      expect(result.rootName).toBeNull();
    });

    it('resolves to an empty manifest when every dropped file is unsupported', async () => {
      const tree = directoryEntry('Docs', [fileEntry('notes.doc'), fileEntry('photo.png')]);

      const scanner = new DropScanner();
      const result = await scanner.scan(asItemList([dropItem(tree)]), noopProgress, signal());

      expect(result.entries).toEqual([]);
    });
  });

  describe('directory-picker input', () => {
    it('yields the same manifest shape as an equivalent drop, without doubling the root segment', async () => {
      const files = [
        withRelativePath(createFile('song1.sid'), 'MusicPack/song1.sid'),
        withRelativePath(createFile('song2.crt'), 'MusicPack/sub/song2.crt'),
        withRelativePath(createFile('notes.doc'), 'MusicPack/notes.doc'),
      ];

      const scanner = new DropScanner();
      const result = await scanner.scan(asFileList(files), noopProgress, signal());

      expect(result.rootName).toBe('MusicPack');
      expect(result.entries.map((e) => e.relativePath).sort()).toEqual(
        ['MusicPack/song1.sid', 'MusicPack/sub/song2.crt'].sort()
      );
    });

    it('falls back to the file name and a null root when there is no webkitRelativePath', async () => {
      const files = [createFile('loose.sid'), createFile('loose.doc')];

      const scanner = new DropScanner();
      const result = await scanner.scan(asFileList(files), noopProgress, signal());

      expect(result.rootName).toBeNull();
      expect(result.entries.map((e) => e.relativePath)).toEqual(['loose.sid']);
    });
  });
});
