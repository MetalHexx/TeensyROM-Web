import { Provider } from '@angular/core';
import { API_CONFIG, HTTPS_STATUS_SERVICE, IApiConfig } from '@teensyrom-nx/domain';
import { Configuration, EngineApiService } from '@teensyrom-nx/data-access/api-client';
import { HttpsStatusService } from './https-status.service';

/** API client provider for the Engine API, configured with the backend base URL. */
export const ENGINE_API_CLIENT_PROVIDER = {
  provide: EngineApiService,
  useFactory: (apiConfig: IApiConfig) =>
    new EngineApiService(new Configuration({ basePath: apiConfig.basePath })),
  deps: [API_CONFIG],
};

/** Maps the domain HTTPS_STATUS_SERVICE token to the infrastructure HttpsStatusService. */
export const HTTPS_STATUS_PROVIDERS: Provider[] = [
  ENGINE_API_CLIENT_PROVIDER,
  {
    provide: HTTPS_STATUS_SERVICE,
    useClass: HttpsStatusService,
    deps: [EngineApiService],
  },
];
