import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Service contract for learning where the engine serves https.
 *
 * Browsers hide Web MIDI and camera access on a page that is not a secure context, so the UI uses
 * this to point the user at the https address of the page they are already on.
 */
export interface IHttpsStatusService {
  /**
   * The port the engine serves https on, or null when it is not serving https or cannot be asked.
   * Never errors.
   */
  getSecurePort(): Observable<number | null>;
}

/** Injection token for IHttpsStatusService. */
export const HTTPS_STATUS_SERVICE = new InjectionToken<IHttpsStatusService>('IHttpsStatusService');
