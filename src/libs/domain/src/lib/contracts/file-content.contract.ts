import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { FileContent, StorageType } from '../models';

export interface IFileContentService {
  /** Reads a file's raw bytes from a device's storage. Byte-identical to the file on the cartridge. */
  getFileContent(deviceId: string, storageType: StorageType, path: string): Observable<FileContent>;
}

export const FILE_CONTENT_SERVICE = new InjectionToken<IFileContentService>('FILE_CONTENT_SERVICE');
