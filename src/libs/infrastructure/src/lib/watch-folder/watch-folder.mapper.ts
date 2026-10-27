import {
  WatchFolderDto,
  WatchFolderDestinationDto,
  TeensyStorageType,
} from '@teensyrom-nx/data-access/api-client';
import {
  StorageType,
  WatchFolder,
  WatchFolderDestination,
  WatchFolderState,
} from '@teensyrom-nx/domain';

/** Maps watch-folder DTOs from the generated API client onto the domain models. */
export class WatchFolderMapper {
  static toWatchFolder(dto: WatchFolderDto): WatchFolder {
    return {
      id: dto.id,
      path: dto.path,
      enabled: dto.enabled,
      state: WatchFolderMapper.toState(dto.state),
      destinations: dto.destinations.map((d) => WatchFolderMapper.toDestination(d)),
    };
  }

  static toDestination(dto: WatchFolderDestinationDto): WatchFolderDestination {
    return {
      id: dto.id,
      deviceId: dto.deviceId,
      deviceName: dto.deviceName ?? null,
      storageType: WatchFolderMapper.toStorageType(dto.storageType),
      path: dto.path,
      launch: dto.launch,
    };
  }

  private static toState(state: WatchFolderDto['state']): WatchFolderState {
    switch (state) {
      case 'Watching':
        return WatchFolderState.Watching;
      case 'Off':
        return WatchFolderState.Off;
      case 'Unavailable':
        return WatchFolderState.Unavailable;
      default:
        throw new Error(`Unknown watch folder state: ${state}`);
    }
  }

  private static toStorageType(storageType: TeensyStorageType): StorageType {
    switch (storageType) {
      case 'SD':
        return StorageType.Sd;
      case 'USB':
        return StorageType.Usb;
      default:
        throw new Error(`Unknown storage type: ${storageType}`);
    }
  }
}
