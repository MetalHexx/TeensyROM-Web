import { Injectable, Inject } from '@angular/core';
import {
  DevicesApiService,
  FindDevicesResponse,
  LaunchAsidPlayerResponse,
  ReconnectDeviceResponse,
  RenameDeviceResponse,
  ResponseError,
} from '@teensyrom-nx/data-access/api-client';
import {
  Device,
  IDeviceService,
  ALERT_SERVICE,
  IAlertService,
  AsidLaunchOutcome,
} from '@teensyrom-nx/domain';
import { DomainMapper } from '../domain.mapper';
import { Observable, map, from, catchError, switchMap, throwError } from 'rxjs';
import { logError } from '@teensyrom-nx/utils';
import {
  extractProblemMessage,
  failOnDeviceBusy,
  readDeviceBusyProblem,
  readProblemCode,
} from '../error/api-error.utils';

const USB_UNREACHABLE_PROBLEM_CODE = 'usbUnreachable';
const LAUNCH_ASID_FALLBACK_MESSAGE = 'The ASID player could not be started.';

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

  reconnectDevice(deviceId: string): Observable<Device> {
    return from(this.apiService.reconnectDevice({ deviceId })).pipe(
      map((response: ReconnectDeviceResponse) => DomainMapper.toDevice(response.device)),
      catchError((error) =>
        this.handleError(error, 'reconnectDevice', this.reconnectErrorMessage(error))
      )
    );
  }

  forgetDevice(deviceId: string): Observable<void> {
    return from(this.apiService.forgetDevice({ deviceId })).pipe(
      map(() => void 0),
      catchError((error) => this.handleError(error, 'forgetDevice', 'Failed to forget device'))
    );
  }

  renameDevice(deviceId: string, name: string): Observable<Device> {
    return from(this.apiService.renameDevice({ deviceId, renameDeviceBody: { name } })).pipe(
      map((response: RenameDeviceResponse) => DomainMapper.toDevice(response.device)),
      catchError((error) => this.handleError(error, 'renameDevice', 'Failed to rename device'))
    );
  }

  launchAsidPlayer(deviceId: string): Observable<AsidLaunchOutcome> {
    return from(this.apiService.launchAsidPlayer({ deviceId })).pipe(
      map((response: LaunchAsidPlayerResponse) => DomainMapper.toAsidLaunchOutcome(response)),
      catchError((error) => {
        logError('DeviceService.launchAsidPlayer error:', error);
        return from(this.toFailedLaunchOutcome(error));
      })
    );
  }

  private async toFailedLaunchOutcome(error: unknown): Promise<AsidLaunchOutcome> {
    const busy = await readDeviceBusyProblem(error);
    if (busy) {
      return { launched: false, reason: 'busy', message: busy.title };
    }

    const message = (await extractProblemMessage(error)) ?? LAUNCH_ASID_FALLBACK_MESSAGE;
    if (error instanceof ResponseError) {
      if (error.response.status === 404) {
        return { launched: false, reason: 'notFound', message };
      }
      if (
        error.response.status === 502 &&
        (await readProblemCode(error)) === USB_UNREACHABLE_PROBLEM_CODE
      ) {
        return { launched: false, reason: 'usbUnreachable', message };
      }
    }
    return { launched: false, reason: 'launchFailed', message };
  }

  private reconnectErrorMessage(error: unknown): string {
    if (error instanceof ResponseError && error.response.status === 502) {
      return 'Device could not be found. Check it is powered on and connected.';
    }
    return 'Failed to reconnect device';
  }

  private handleError(
    error: unknown,
    methodName: string,
    friendlyMessage: string
  ): Observable<never> {
    logError(`DeviceService.${methodName} error:`, error);
    return failOnDeviceBusy(error, this.alertService, () =>
      from(extractProblemMessage(error)).pipe(
        switchMap((apiMessage) => {
          this.alertService.error(apiMessage ?? friendlyMessage);
          return throwError(() => error);
        })
      )
    );
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
