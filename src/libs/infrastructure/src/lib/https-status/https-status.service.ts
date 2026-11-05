import { Injectable } from '@angular/core';
import { catchError, from, map, Observable, of } from 'rxjs';
import { EngineApiService } from '@teensyrom-nx/data-access/api-client';
import { IHttpsStatusService } from '@teensyrom-nx/domain';

/**
 * Infrastructure implementation of IHttpsStatusService.
 *
 * Reads the engine's read-only HTTPS status. A failed request, or an engine that is not serving
 * https, both answer null so callers fall back to their generic advice.
 */
@Injectable({ providedIn: 'root' })
export class HttpsStatusService implements IHttpsStatusService {
  constructor(private readonly apiService: EngineApiService) {}

  getSecurePort(): Observable<number | null> {
    return from(this.apiService.getHttpsStatus()).pipe(
      map((status) => (status.listening ? status.port : null)),
      catchError(() => of(null))
    );
  }
}
