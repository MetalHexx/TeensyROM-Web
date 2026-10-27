import { Injectable } from '@angular/core';
import { WatchFoldersApiService, ResponseError } from '@teensyrom-nx/data-access/api-client';
import {
  AddWatchFolderInput,
  IWatchFolderService,
  WatchFolder,
  WatchFolderDestinationChange,
  WatchFolderField,
  WatchFolderRejectedError,
} from '@teensyrom-nx/domain';
import { logError } from '@teensyrom-nx/utils';
import { DomainMapper } from '../domain.mapper';
import { WatchFolderMapper } from './watch-folder.mapper';

const FALLBACK_REJECTION = 'The watch folder change was refused.';

/** Stable phrases in the engine's own 400 / 404 messages, each tied to the field it concerns. */
const FIELD_PHRASES: ReadonlyArray<{ phrase: string; field: WatchFolderField }> = [
  { phrase: 'is not a valid folder path', field: 'folder' },
  { phrase: 'was not found on this machine', field: 'folder' },
  { phrase: 'overlaps a folder that is already watched', field: 'folder' },
  { phrase: 'device path must be a valid', field: 'devicePath' },
  { phrase: 'did not report its chip id', field: 'device' },
  { phrase: 'No connected device was found', field: 'device' },
  { phrase: 'is not available', field: 'storage' },
];

/**
 * Infrastructure implementation of IWatchFolderService over the generated `WatchFoldersApiService`.
 * An engine refusal (400, 404, 409) surfaces as a `WatchFolderRejectedError` carrying the
 * engine's message and, when it can be told, the form field it concerns; it never alerts.
 */
@Injectable()
export class WatchFolderService implements IWatchFolderService {
  constructor(private readonly watchFoldersApi: WatchFoldersApiService) {}

  async list(): Promise<WatchFolder[]> {
    const response = await this.watchFoldersApi.getWatchFolders();
    return response.watchFolders.map((dto) => WatchFolderMapper.toWatchFolder(dto));
  }

  async add(input: AddWatchFolderInput): Promise<WatchFolder> {
    try {
      const response = await this.watchFoldersApi.addWatchFolder({
        addWatchFolderBody: {
          path: input.path,
          deviceId: input.deviceId,
          storageType: DomainMapper.toApiStorageType(input.storageType),
          devicePath: input.devicePath,
          launch: input.launch,
        },
      });
      return WatchFolderMapper.toWatchFolder(response.watchFolder);
    } catch (error) {
      throw await this.toRejection(error);
    }
  }

  async setDestination(
    watchFolderId: string,
    deviceId: string,
    change: WatchFolderDestinationChange
  ): Promise<WatchFolder> {
    try {
      const response = await this.watchFoldersApi.setWatchFolderDevice({
        watchFolderId,
        deviceId,
        setWatchFolderDeviceBody: { devicePath: change.devicePath, launch: change.launch },
      });
      return WatchFolderMapper.toWatchFolder(response.watchFolder);
    } catch (error) {
      throw await this.toRejection(error);
    }
  }

  async setEnabled(watchFolderId: string, enabled: boolean): Promise<WatchFolder> {
    try {
      const response = await this.watchFoldersApi.setWatchFolderEnabled({
        watchFolderId,
        setWatchFolderEnabledBody: { enabled },
      });
      return WatchFolderMapper.toWatchFolder(response.watchFolder);
    } catch (error) {
      throw await this.toRejection(error);
    }
  }

  async remove(watchFolderId: string): Promise<void> {
    try {
      await this.watchFoldersApi.removeWatchFolder({ watchFolderId });
    } catch (error) {
      throw await this.toRejection(error);
    }
  }

  async removeDestination(
    watchFolderId: string,
    deviceId: string
  ): Promise<{ folderRemoved: boolean; watchFolder: WatchFolder | null }> {
    try {
      const response = await this.watchFoldersApi.removeWatchFolderDevice({
        watchFolderId,
        deviceId,
      });
      return {
        folderRemoved: response.folderRemoved,
        watchFolder: response.watchFolder
          ? WatchFolderMapper.toWatchFolder(response.watchFolder)
          : null,
      };
    } catch (error) {
      throw await this.toRejection(error);
    }
  }

  /** Turns an engine refusal into a `WatchFolderRejectedError`; anything else is rethrown as-is. */
  private async toRejection(error: unknown): Promise<unknown> {
    if (!(error instanceof ResponseError)) {
      logError('WatchFolderService: request failed', error);
      return error;
    }

    const status = error.response.status;
    if (status !== 400 && status !== 404 && status !== 409) {
      logError('WatchFolderService: request failed', { status });
      return error;
    }

    const message = (await this.readMessage(error.response, status)) ?? FALLBACK_REJECTION;
    logError('WatchFolderService: change refused', { status, message });
    return new WatchFolderRejectedError(status, message, this.toField(status, message));
  }

  /**
   * Reads the engine's text from the body: a 400 is a ValidationProblem (text at
   * `errors.ValidationError[0]`), a 404 is a bare JSON string, a 409 is ProblemDetails.
   */
  private async readMessage(response: Response, status: number): Promise<string | null> {
    try {
      const body: unknown = await response.clone().json();
      if (typeof body === 'string') return body || null;
      if (!body || typeof body !== 'object') return null;

      const problem = body as {
        title?: string | null;
        detail?: string | null;
        errors?: { ValidationError?: string[] };
      };
      if (status === 400) {
        return problem.errors?.ValidationError?.[0] ?? problem.title ?? null;
      }
      return problem.detail ?? problem.title ?? null;
    } catch {
      return null;
    }
  }

  private toField(status: number, message: string): WatchFolderField | null {
    if (status === 409) return 'device';
    return FIELD_PHRASES.find(({ phrase }) => message.includes(phrase))?.field ?? null;
  }
}
