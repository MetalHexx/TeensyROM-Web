import { Injectable, Inject } from '@angular/core';
import { from, Observable, catchError, map, mergeMap, throwError } from 'rxjs';
import { SettingsApiService } from '@teensyrom-nx/data-access/api-client';
import { ISettingsService, Settings, ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';
import { DomainMapper } from '../domain.mapper';
import { extractErrorMessage } from '../error/api-error.utils';
import { logError } from '@teensyrom-nx/utils';

/**
 * Infrastructure implementation of ISettingsService.
 *
 * Communicates with the Settings API to retrieve and persist user settings.
 * Handles error conditions by dispatching user-friendly alerts via the alert service.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService implements ISettingsService {
  private readonly alertService: IAlertService;

  constructor(
    private readonly apiService: SettingsApiService,
    @Inject(ALERT_SERVICE) alertService: IAlertService
  ) {
    this.alertService = alertService;
  }

  /**
   * Retrieves all current user settings from the backend API.
   *
   * @returns Observable emitting the complete settings object
   */
  getSettings(): Observable<Settings> {
    return from(this.apiService.getSettings()).pipe(
      map((response) => DomainMapper.toSettings(response)),
      catchError((error) => this.handleError(error, 'getSettings', 'Failed to load settings'))
    );
  }

  /**
   * Saves all user settings to the backend API.
   *
   * @param settings - Complete settings object to persist
   * @returns Observable emitting the saved settings object (echoes back input)
   */
  saveSettings(settings: Settings): Observable<Settings> {
    // Map domain settings to DTO (now includes connectionSettings)
    const saveRequest = DomainMapper.toSettingsDto(settings);

    return from(this.apiService.saveSettings({ saveSettingsRequest: saveRequest })).pipe(
      map(() => settings), // Echo back the input settings since API only returns a message
      catchError((error) => this.handleError(error, 'saveSettings', 'Failed to save settings'))
    );
  }

  /**
   * Handles API errors by extracting error messages, dispatching alerts, and rethrowing errors.
   *
   * Follows the PlayerService pattern for consistent error handling across services.
   *
   * @param error - Error from API call
   * @param methodName - Name of the method where error occurred
   * @param fallbackMessage - User-friendly fallback message
   * @returns Observable that throws the error after handling
   */
  private handleError(
    error: unknown,
    methodName: string,
    fallbackMessage: string
  ): Observable<never> {
    return from(extractErrorMessage(error, fallbackMessage)).pipe(
      mergeMap((message) => {
        logError(`SettingsService.${methodName} failed:`, error);
        this.alertService.error(message);
        return throwError(() => (error instanceof Error ? error : new Error(fallbackMessage)));
      })
    );
  }
}
