import { describe, it, expect } from 'vitest';
import { WatchFolderDto } from '@teensyrom-nx/data-access/api-client';
import { StorageType, WatchFolderState } from '@teensyrom-nx/domain';
import { WatchFolderMapper } from './watch-folder.mapper';

const dto: WatchFolderDto = {
  id: 'f1',
  path: 'C:\\Games',
  enabled: true,
  state: 'Unavailable',
  destinations: [
    { id: 'd1', deviceId: 'dev-1', deviceName: 'Rack', storageType: 'USB', path: '/auto', launch: true },
    { id: 'd2', deviceId: 'dev-2', storageType: 'SD', path: '/x', launch: false },
  ],
};

describe('WatchFolderMapper', () => {
  it('maps the folder, its state and its destinations', () => {
    const folder = WatchFolderMapper.toWatchFolder(dto);

    expect(folder).toMatchObject({
      id: 'f1',
      path: 'C:\\Games',
      enabled: true,
      state: WatchFolderState.Unavailable,
    });
    expect(folder.destinations).toHaveLength(2);
    expect(folder.destinations[0]).toEqual({
      id: 'd1',
      deviceId: 'dev-1',
      deviceName: 'Rack',
      storageType: StorageType.Usb,
      path: '/auto',
      launch: true,
    });
  });

  it('maps a missing device name to null and SD to the SD storage type', () => {
    const [, second] = WatchFolderMapper.toWatchFolder(dto).destinations;

    expect(second.deviceName).toBeNull();
    expect(second.storageType).toBe(StorageType.Sd);
  });

  it.each([
    ['Watching', WatchFolderState.Watching],
    ['Off', WatchFolderState.Off],
  ] as const)('maps the %s state', (state, expected) => {
    expect(WatchFolderMapper.toWatchFolder({ ...dto, state }).state).toBe(expected);
  });
});
