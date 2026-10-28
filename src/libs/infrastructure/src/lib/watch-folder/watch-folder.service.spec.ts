import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WatchFoldersApiService, ResponseError, WatchFolderDto } from '@teensyrom-nx/data-access/api-client';
import { StorageType, WatchFolderRejectedError, WatchFolderState } from '@teensyrom-nx/domain';
import { WatchFolderService } from './watch-folder.service';

const dto: WatchFolderDto = {
  id: 'f1',
  path: 'C:\\Games',
  enabled: true,
  state: 'Watching',
  destinations: [
    { id: 'd1', deviceId: 'dev-1', deviceName: 'Rack', storageType: 'SD', path: '/auto', launch: false },
  ],
};

function refusal(status: number, body: unknown): ResponseError {
  return new ResponseError(new Response(JSON.stringify(body), { status }), 'error');
}

function validation(message: string): unknown {
  return { title: 'One or more validation errors occurred.', errors: { ValidationError: [message] } };
}

describe('WatchFolderService', () => {
  let api: {
    getWatchFolders: ReturnType<typeof vi.fn>;
    addWatchFolder: ReturnType<typeof vi.fn>;
    setWatchFolderDevice: ReturnType<typeof vi.fn>;
    setWatchFolderEnabled: ReturnType<typeof vi.fn>;
    removeWatchFolder: ReturnType<typeof vi.fn>;
    removeWatchFolderDevice: ReturnType<typeof vi.fn>;
  };
  let service: WatchFolderService;

  beforeEach(() => {
    api = {
      getWatchFolders: vi.fn(),
      addWatchFolder: vi.fn(),
      setWatchFolderDevice: vi.fn(),
      setWatchFolderEnabled: vi.fn(),
      removeWatchFolder: vi.fn(),
      removeWatchFolderDevice: vi.fn(),
    };
    service = new WatchFolderService(api as unknown as WatchFoldersApiService);
  });

  describe('reads and writes', () => {
    it('lists folders as domain models', async () => {
      api.getWatchFolders.mockResolvedValue({ watchFolders: [dto] });

      const folders = await service.list();

      expect(folders).toHaveLength(1);
      expect(folders[0].state).toBe(WatchFolderState.Watching);
      expect(folders[0].destinations[0].storageType).toBe(StorageType.Sd);
    });

    it('adds a folder with the API storage type and returns the mapped folder', async () => {
      api.addWatchFolder.mockResolvedValue({ watchFolder: dto, created: true });

      const folder = await service.add({
        path: 'C:\\Games',
        deviceId: 'dev-1',
        storageType: StorageType.Usb,
        devicePath: null,
        launch: true,
      });

      expect(api.addWatchFolder).toHaveBeenCalledWith({
        addWatchFolderBody: {
          path: 'C:\\Games',
          deviceId: 'dev-1',
          storageType: 'USB',
          devicePath: null,
          launch: true,
        },
      });
      expect(folder.id).toBe('f1');
    });

    it('sends only the changed fields when setting a destination', async () => {
      api.setWatchFolderDevice.mockResolvedValue({ watchFolder: dto });

      await service.setDestination('f1', 'dev-1', { launch: true });

      expect(api.setWatchFolderDevice).toHaveBeenCalledWith({
        watchFolderId: 'f1',
        deviceId: 'dev-1',
        setWatchFolderDeviceBody: { devicePath: undefined, launch: true },
      });
    });

    it('switches a folder on or off', async () => {
      api.setWatchFolderEnabled.mockResolvedValue({ watchFolder: { ...dto, enabled: false, state: 'Off' } });

      const folder = await service.setEnabled('f1', false);

      expect(api.setWatchFolderEnabled).toHaveBeenCalledWith({
        watchFolderId: 'f1',
        setWatchFolderEnabledBody: { enabled: false },
      });
      expect(folder.state).toBe(WatchFolderState.Off);
    });

    it('reports a removed folder with no remaining watch folder', async () => {
      api.removeWatchFolderDevice.mockResolvedValue({ folderRemoved: true, watchFolder: null });

      expect(await service.removeDestination('f1', 'dev-1')).toEqual({
        folderRemoved: true,
        watchFolder: null,
      });
    });

    it('maps the folder left after removing one of several devices', async () => {
      api.removeWatchFolderDevice.mockResolvedValue({ folderRemoved: false, watchFolder: dto });

      const result = await service.removeDestination('f1', 'dev-2');

      expect(result.folderRemoved).toBe(false);
      expect(result.watchFolder?.id).toBe('f1');
    });
  });

  describe('refusals', () => {
    const rejectedBy = async (error: unknown): Promise<WatchFolderRejectedError> => {
      api.addWatchFolder.mockRejectedValue(error);
      const thrown = await service
        .add({ path: 'p', deviceId: 'd', storageType: StorageType.Sd, devicePath: null, launch: false })
        .catch((e) => e);
      expect(thrown).toBeInstanceOf(WatchFolderRejectedError);
      return thrown as WatchFolderRejectedError;
    };

    it.each([
      ["The folder 'X' was not found on this machine.", 'folder'],
      ["'x' is not a valid folder path.", 'folder'],
      [
        'This folder overlaps a folder that is already watched. Folders cannot be nested in one another.',
        'folder',
      ],
      [
        "The device path must be a valid Unix-style directory path without '.' or '..' segments.",
        'devicePath',
      ],
      ['This device did not report its chip id, so a watch folder cannot follow it.', 'device'],
      ['Something else entirely.', null],
    ])('reads a 400 validation message and maps %s to %s', async (message, field) => {
      const error = await rejectedBy(refusal(400, validation(message)));

      expect(error.status).toBe(400);
      expect(error.message).toBe(message);
      expect(error.field).toBe(field);
    });

    it('reads a 404 bare string and maps a missing device to the device field', async () => {
      const error = await rejectedBy(refusal(404, 'No connected device was found with id dev-9.'));

      expect(error.message).toBe('No connected device was found with id dev-9.');
      expect(error.field).toBe('device');
    });

    it('maps an unavailable storage 404 to the storage field', async () => {
      const error = await rejectedBy(refusal(404, 'The storage USB is not available.'));

      expect(error.field).toBe('storage');
    });

    it('reads a 409 problem detail and maps it to the device field', async () => {
      const error = await rejectedBy(
        refusal(409, { title: 'Conflict', detail: 'This device already receives this folder.' })
      );

      expect(error.status).toBe(409);
      expect(error.message).toBe('This device already receives this folder.');
      expect(error.field).toBe('device');
    });

    it('falls back to a generic message when the body cannot be read', async () => {
      const error = await rejectedBy(
        new ResponseError(new Response('not json', { status: 400 }), 'error')
      );

      expect(error.message).toBeTruthy();
      expect(error.field).toBeNull();
    });

    it('rethrows a failure that is not an engine refusal untouched', async () => {
      const failure = new Error('network down');
      api.removeWatchFolder.mockRejectedValue(failure);

      await expect(service.remove('f1')).rejects.toBe(failure);
    });

    it('rethrows a server error as the original response error', async () => {
      const failure = refusal(500, 'boom');
      api.setWatchFolderEnabled.mockRejectedValue(failure);

      await expect(service.setEnabled('f1', true)).rejects.toBe(failure);
    });
  });
});
