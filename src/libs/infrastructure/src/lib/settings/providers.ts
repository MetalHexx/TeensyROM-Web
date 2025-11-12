import { Provider } from '@angular/core';
import { SETTINGS_SERVICE, ALERT_SERVICE } from '@teensyrom-nx/domain';
import { SettingsService } from './settings.service';
import { SettingsApiService, Configuration } from '@teensyrom-nx/data-access/api-client';

/**
 * API Client provider for Settings API.
 * Configures the SettingsApiService with the backend base URL.
 */
export const SETTINGS_API_CLIENT_PROVIDER = {
  provide: SettingsApiService,
  useFactory: () => {
    const config = new Configuration({ basePath: 'http://localhost:5168' });
    return new SettingsApiService(config);
  },
};

/**
 * Provider configuration for settings infrastructure.
 *
 * Maps the domain SETTINGS_SERVICE injection token to the infrastructure
 * SettingsService implementation, with dependencies on the API client and alert service.
 */
export const SETTINGS_PROVIDERS: Provider[] = [
  SETTINGS_API_CLIENT_PROVIDER,
  {
    provide: SETTINGS_SERVICE,
    useClass: SettingsService,
    deps: [SettingsApiService, ALERT_SERVICE],
  },
];
