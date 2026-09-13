import { Injectable, inject } from '@angular/core';
import { FilesApiService } from '@teensyrom-nx/data-access/api-client';
import { FileContent, StorageType, IFileContentService, ALERT_SERVICE } from '@teensyrom-nx/domain';
import { DomainMapper } from '../domain.mapper';
import { Observable, from, map, switchMap, catchError, throwError } from 'rxjs';
import { logError } from '@teensyrom-nx/utils';

@Injectable({ providedIn: 'root' })
export class FileContentService implements IFileContentService {
  private readonly apiService = inject(FilesApiService);
  private readonly alertService = inject(ALERT_SERVICE);

  getFileContent(
    deviceId: string,
    storageType: StorageType,
    path: string
  ): Observable<FileContent> {
    const apiStorageType = DomainMapper.toApiStorageType(storageType);
    return from(
      this.apiService.getFileContent({ deviceId, storageType: apiStorageType, path })
    ).pipe(
      switchMap((blob) => from(blob.arrayBuffer())),
      map((bytes) => ({
        bytes,
        byteLength: bytes.byteLength,
        fileName: path.substring(path.lastIndexOf('/') + 1),
      })),
      catchError((error) =>
        this.handleError(error, 'getFileContent', 'Failed to retrieve file from device')
      )
    );
  }

  private handleError(
    error: unknown,
    methodName: string,
    friendlyMessage: string
  ): Observable<never> {
    logError(`FileContentService.${methodName} error:`, error);
    this.alertService.error(friendlyMessage);
    return throwError(() => error);
  }
}
