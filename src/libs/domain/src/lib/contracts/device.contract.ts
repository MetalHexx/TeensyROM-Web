import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Device } from '../models';

export interface IDeviceService {
  findDevices(fullScan?: boolean): Observable<Device[]>;
  resetDevice(deviceId: string): Observable<void>;
  pingDevice(deviceId: string): Observable<void>;
  reconnectDevice(deviceId: string): Observable<Device>;
  forgetDevice(deviceId: string): Observable<void>;
  renameDevice(deviceId: string, name: string): Observable<Device>;
}

export const DEVICE_SERVICE = new InjectionToken<IDeviceService>('DEVICE_SERVICE');
