import { Provider } from '@angular/core';
import { DJ_SERVICE } from '@teensyrom-nx/domain';
import { DjService } from './dj.service';

/**
 * Dependency injection providers for DJ infrastructure services.
 *
 * Exports a configured provider that binds the IDjService contract to the
 * DjService implementation, enabling application and feature layers to inject
 * DJ_SERVICE without coupling to the concrete implementation.
 */
export const DJ_PROVIDERS: Provider[] = [
  {
    provide: DJ_SERVICE,
    useClass: DjService,
  },
];
