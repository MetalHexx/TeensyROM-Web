import { Injectable } from '@angular/core';
import { from, Observable, catchError, map, of } from 'rxjs';
import { VersionApiService } from '@teensyrom-nx/data-access/api-client';
import { IVersionService, AppVersion } from '@teensyrom-nx/domain';
import { logError } from '@teensyrom-nx/utils';

/**
 * Infrastructure implementation of IVersionService.
 *
 * Communicates with the Version API to retrieve application version information.
 * Handles errors gracefully by returning a fallback version placeholder.
 */
@Injectable({ providedIn: 'root' })
export class VersionService implements IVersionService {
  constructor(private readonly apiService: VersionApiService) {}

  /**
   * Retrieves the current application version from the backend API.
   *
   * @returns Observable emitting the application version, or a placeholder on error
   */
  getVersion(): Observable<AppVersion> {
    return from(this.apiService.getVersion()).pipe(
      map((response) => ({ version: response.version })),
      catchError((error) => {
        logError('Failed to load application version', error);
        // Return placeholder version on error
        return of({ version: '?.?.?' });
      })
    );
  }
}
