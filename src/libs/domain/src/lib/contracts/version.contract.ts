import { Observable } from 'rxjs';
import { AppVersion } from '../models/version.model';
import { InjectionToken } from '@angular/core';

/**
 * Service contract for retrieving application version information.
 *
 * Provides access to the current running version of TeensyROM,
 * displayed to users in the application header.
 */
export interface IVersionService {
  /**
   * Retrieves the current application version from the backend.
   *
   * Version follows semantic versioning format (e.g., "1.0.0-alpha.1").
   * This is typically called once during application initialization.
   *
   * @returns Observable emitting the application version
   */
  getVersion(): Observable<AppVersion>;
}

/**
 * Injection token for IVersionService.
 * Use this token to inject the version service implementation.
 */
export const VERSION_SERVICE = new InjectionToken<IVersionService>('IVersionService');
