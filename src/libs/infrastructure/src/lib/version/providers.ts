import { Provider } from '@angular/core';
import { VERSION_SERVICE, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { VersionService } from './version.service';
import { VersionApiService, Configuration } from '@teensyrom-nx/data-access/api-client';

/**
 * API Client provider for Version API.
 * Configures the VersionApiService with the backend base URL.
 */
export const VERSION_API_CLIENT_PROVIDER = {
  provide: VersionApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new VersionApiService(config);
  },
  deps: [API_CONFIG],
};

/**
 * Provider configuration for version infrastructure.
 *
 * Maps the domain VERSION_SERVICE injection token to the infrastructure
 * VersionService implementation.
 */
export const VERSION_PROVIDERS: Provider[] = [
  VERSION_API_CLIENT_PROVIDER,
  {
    provide: VERSION_SERVICE,
    useClass: VersionService,
    deps: [VersionApiService],
  },
];
