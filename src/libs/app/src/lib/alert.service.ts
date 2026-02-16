import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IAlertService, AlertMessage, AlertSeverity, AlertPosition } from '@teensyrom-nx/domain';

const DEFAULT_AUTO_DISMISS_MS = 5000;
const DEFAULT_POSITION = AlertPosition.BottomCenter;

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID() when available (secure contexts: HTTPS or localhost),
 * falls back to crypto.getRandomValues() for non-secure contexts (e.g., HTTP over LAN).
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (HTTP over LAN)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

@Injectable()
export class AlertService implements IAlertService {
  private alertsSignal = signal<AlertMessage[]>([]);
  private timerMap = new Map<string, number>();
  private alertsSubject$ = new BehaviorSubject<AlertMessage[]>([]);

  alerts$ = this.alertsSubject$.asObservable();

  private updateAlerts(alerts: AlertMessage[]): void {
    this.alertsSignal.set(alerts);
    this.alertsSubject$.next(alerts);
  }

  show(
    message: string,
    severity: AlertSeverity,
    position: AlertPosition = DEFAULT_POSITION,
    autoDismissMs: number = DEFAULT_AUTO_DISMISS_MS
  ): void {
    const id = generateId();
    const alert: AlertMessage = {
      id,
      message,
      severity,
      position,
      autoDismissMs,
    };

    const updatedAlerts = [...this.alertsSignal(), alert];
    this.updateAlerts(updatedAlerts);

    // Start auto-dismiss timer
    const timerId = window.setTimeout(() => {
      this.dismiss(id);
    }, autoDismissMs);

    this.timerMap.set(id, timerId);
  }

  success(
    message: string,
    position: AlertPosition = DEFAULT_POSITION,
    autoDismissMs?: number
  ): void {
    this.show(message, AlertSeverity.Success, position, autoDismissMs);
  }

  error(message: string, position: AlertPosition = DEFAULT_POSITION, autoDismissMs?: number): void {
    this.show(message, AlertSeverity.Error, position, autoDismissMs);
  }

  warning(
    message: string,
    position: AlertPosition = DEFAULT_POSITION,
    autoDismissMs?: number
  ): void {
    this.show(message, AlertSeverity.Warning, position, autoDismissMs);
  }

  info(message: string, position: AlertPosition = DEFAULT_POSITION, autoDismissMs?: number): void {
    this.show(message, AlertSeverity.Info, position, autoDismissMs);
  }

  dismiss(alertId: string): void {
    // Cancel auto-dismiss timer if it exists
    const timerId = this.timerMap.get(alertId);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.timerMap.delete(alertId);
    }

    // Remove alert from signal and subject
    const updatedAlerts = this.alertsSignal().filter((a) => a.id !== alertId);
    this.updateAlerts(updatedAlerts);
  }
}
