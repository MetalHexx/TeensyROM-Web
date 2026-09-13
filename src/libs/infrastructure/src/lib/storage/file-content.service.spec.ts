import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Blob as NodeBlob } from 'node:buffer';
import { FilesApiService, TeensyStorageType } from '@teensyrom-nx/data-access/api-client';
import { FileContentService } from './file-content.service';
import { StorageType, ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';

// jsdom's Blob polyfill doesn't implement arrayBuffer(); use Node's Blob (structurally identical)
// so the service's `blob.arrayBuffer()` call works under the jsdom test environment.
const Blob = NodeBlob as unknown as typeof globalThis.Blob;

describe('FileContentService', () => {
  let service: FileContentService;
  let mockFilesApiService: { getFileContent: ReturnType<typeof vi.fn> };
  let mockAlertService: Partial<IAlertService>;

  beforeEach(() => {
    mockFilesApiService = {
      getFileContent: vi.fn(),
    };

    mockAlertService = {
      error: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FileContentService,
        { provide: FilesApiService, useValue: mockFilesApiService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
      ],
    });

    service = TestBed.inject(FileContentService);
  });

  describe('getFileContent', () => {
    it('resolves a Blob into FileContent with the bytes intact', async () => {
      const deviceId = 'device-1';
      const storageType = StorageType.Sd;
      const path = '/games/test.prg';
      const sourceBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const blob = new Blob([sourceBytes]);

      mockFilesApiService.getFileContent.mockResolvedValue(blob);

      const result = await new Promise<import('@teensyrom-nx/domain').FileContent>(
        (resolve, reject) => {
          service.getFileContent(deviceId, storageType, path).subscribe({
            next: resolve,
            error: reject,
          });
        }
      );

      expect(new Uint8Array(result.bytes)).toEqual(sourceBytes);
      expect(result.byteLength).toBe(sourceBytes.byteLength);
      expect(result.fileName).toBe('test.prg');
    });

    it('sends the mapped storage type and the path to the API', async () => {
      const deviceId = 'device-1';
      const storageType = StorageType.Usb;
      const path = '/music/song.sid';
      const blob = new Blob([new Uint8Array([9])]);

      mockFilesApiService.getFileContent.mockResolvedValue(blob);

      await new Promise<void>((resolve, reject) => {
        service.getFileContent(deviceId, storageType, path).subscribe({
          next: () => resolve(),
          error: reject,
        });
      });

      expect(mockFilesApiService.getFileContent).toHaveBeenCalledWith({
        deviceId,
        storageType: TeensyStorageType.Usb,
        path,
      });
    });

    it('logs, alerts and rethrows the original error when the API call fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = new Error('Network error');

      mockFilesApiService.getFileContent.mockRejectedValue(error);

      let caughtError: unknown;
      await new Promise<void>((resolve) => {
        service.getFileContent('device-1', StorageType.Sd, '/test.prg').subscribe({
          error: (err: unknown) => {
            caughtError = err;
            resolve();
          },
        });
      });

      expect(caughtError).toBe(error);
      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to retrieve file from device');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ FileContentService.getFileContent error:',
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
