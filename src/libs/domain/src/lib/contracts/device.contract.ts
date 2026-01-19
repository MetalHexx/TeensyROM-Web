import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Device } from '../models';

export interface IDeviceService {
  findDevices(fullScan?: boolean): Observable<Device[]>;
  resetDevice(deviceId: string): Observable<void>;
  pingDevice(deviceId: string): Observable<void>;
}

export const DEVICE_SERVICE = new InjectionToken<IDeviceService>('DEVICE_SERVICE');
