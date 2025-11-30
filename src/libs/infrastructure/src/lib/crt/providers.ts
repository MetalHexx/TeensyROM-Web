import { Provider } from '@angular/core';
import { CRT_STORAGE } from '@teensyrom-nx/domain';
import { CrtStorageService } from './crt-storage.service';

/**
 * Provider configuration for CRT storage infrastructure.
 * Binds ICrtStorage domain contract to CrtStorageService implementation.
 */
export const CRT_PROVIDERS: Provider[] = [
  {
    provide: CRT_STORAGE,
    useClass: CrtStorageService,
  },
];
