import { Provider } from '@angular/core';
import { SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { SettingsService } from './settings.service';

/**
 * Provider configuration for settings infrastructure.
 *
 * Maps the domain SETTINGS_SERVICE injection token to the infrastructure
 * SettingsService implementation.
 */
export const SETTINGS_PROVIDERS: Provider[] = [
  {
    provide: SETTINGS_SERVICE,
    useClass: SettingsService,
  },
];
