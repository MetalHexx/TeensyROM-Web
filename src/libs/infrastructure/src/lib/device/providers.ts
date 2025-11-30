import {
  DEVICE_SERVICE,
  DEVICE_LOGS_SERVICE,
  DEVICE_EVENTS_SERVICE,
  DEVICE_STORAGE_SERVICE,
  ALERT_SERVICE,
  API_CONFIG,
  IApiConfig,
} from '@teensyrom-nx/domain';
import { DeviceService } from './device.service';
import { DeviceLogsService } from './device-logs.service';
import { DeviceEventsService } from './device-events.service';
import { StorageService } from '../storage/storage.service';
import { DevicesApiService, Configuration } from '@teensyrom-nx/data-access/api-client';

// API Client provider
export const DEVICES_API_CLIENT_PROVIDER = {
  provide: DevicesApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new DevicesApiService(config);
  },
  deps: [API_CONFIG],
};

export const DEVICE_SERVICE_PROVIDER = {
  provide: DEVICE_SERVICE,
  useClass: DeviceService,
  deps: [DevicesApiService, ALERT_SERVICE],
};

export const DEVICE_LOGS_SERVICE_PROVIDER = {
  provide: DEVICE_LOGS_SERVICE,
  useClass: DeviceLogsService,
  deps: [DevicesApiService, ALERT_SERVICE, API_CONFIG],
};

export const DEVICE_EVENTS_SERVICE_PROVIDER = {
  provide: DEVICE_EVENTS_SERVICE,
  useClass: DeviceEventsService,
  deps: [DevicesApiService, ALERT_SERVICE, API_CONFIG],
};

export const DEVICE_STORAGE_SERVICE_PROVIDER = {
  provide: DEVICE_STORAGE_SERVICE,
  useClass: StorageService,
};
