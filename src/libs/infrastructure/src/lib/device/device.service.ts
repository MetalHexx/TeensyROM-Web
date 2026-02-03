import { Injectable, Inject } from '@angular/core';
import {
  DevicesApiService,
  FindDevicesResponse,
} from '@teensyrom-nx/data-access/api-client';
import { Device, IDeviceService, ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';
import { DomainMapper } from '../domain.mapper';
import { Observable, map, from, catchError, throwError } from 'rxjs';
import { logError } from '@teensyrom-nx/utils';

@Injectable()
export class DeviceService implements IDeviceService {
  private readonly apiService: DevicesApiService;
  private readonly alertService: IAlertService;

  constructor(apiService: DevicesApiService, @Inject(ALERT_SERVICE) alertService: IAlertService) {
    this.apiService = apiService;
    this.alertService = alertService;
  }

  findDevices(fullScan = false): Observable<Device[]> {
    return from(this.apiService.findDevices({ fullScan })).pipe(
      map((response: FindDevicesResponse) => {
        const devices = DomainMapper.toDeviceList(response.devices);
        this.checkIndexStatus(devices);
        return devices;
      }),
      catchError((error) => this.handleError(error, 'findDevices', 'Failed to find devices'))
    );
  }

  resetDevice(deviceId: string): Observable<void> {
    return from(this.apiService.resetDevice({ deviceId })).pipe(
      map(() => void 0),
      catchError((error) => this.handleError(error, 'resetDevice', 'Failed to reset device'))
    );
  }

  pingDevice(deviceId: string): Observable<void> {
    return from(this.apiService.pingDevice({ deviceId })).pipe(
      map(() => void 0),
      catchError((error) => this.handleError(error, 'pingDevice', 'Failed to ping device'))
    );
  }

  private handleError(
    error: unknown,
    methodName: string,
    friendlyMessage: string
  ): Observable<never> {
    logError(`DeviceService.${methodName} error:`, error);
    this.alertService.error(friendlyMessage);
    return throwError(() => error);
  }

  private checkIndexStatus(devices: Device[]): void {
    devices.forEach((device) => {
      if (device.sdStorage.available && device.sdStorage.indexExists === false) {
        this.alertService.warning(`${device.name} SD storage needs indexing`);
      }
      if (device.usbStorage.available && device.usbStorage.indexExists === false) {
        this.alertService.warning(`${device.name} USB storage needs indexing`);
      }
    });
  }
}
