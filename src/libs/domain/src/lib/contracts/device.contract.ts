import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AsidLaunchOutcome, Device } from '../models';

export interface IDeviceService {
  findDevices(fullScan?: boolean): Observable<Device[]>;
  resetDevice(deviceId: string): Observable<void>;
  pingDevice(deviceId: string): Observable<void>;
  reconnectDevice(deviceId: string): Observable<Device>;
  forgetDevice(deviceId: string): Observable<void>;
  renameDevice(deviceId: string, name: string): Observable<Device>;
  /**
   * Starts the ASID player on a cartridge. Never errors and raises no alert: every API failure comes
   * back as a failed outcome carrying the API's message, so the caller can name the deck.
   */
  launchAsidPlayer(deviceId: string): Observable<AsidLaunchOutcome>;
}

export const DEVICE_SERVICE = new InjectionToken<IDeviceService>('DEVICE_SERVICE');
