import { Provider, isDevMode } from '@angular/core';
import { API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';

/**
 * Factory function that provides API configuration based on the current environment.
 *
 * - **Development mode** (`isDevMode() === true`):
 *   Returns absolute URLs for local development server
 *
 * - **Production mode** (`isDevMode() === false`):
 *   Returns empty strings for relative URLs (same-origin requests)
 *
 * @returns {IApiConfig} Configuration object with base paths
 */
export function provideApiConfig(): IApiConfig {
  const basePath = isDevMode() ? `http://${window.location.hostname}:213` : '';
  const signalRBasePath = isDevMode() ? `http://${window.location.hostname}:213` : '';
  
  return {
    basePath,
    signalRBasePath,
    getBaseUrl() {
      return this.basePath !== '' ? this.basePath : window.location.origin;
    },
  };
}

/**
 * Provider definition for API configuration.
 * Use this in application providers array to enable environment-aware API URLs.
 *
 * @example
 * ```typescript
 * // In app.config.ts or module providers
 * providers: [
 *   API_CONFIG_PROVIDER,
 *   // ... other providers
 * ]
 * ```
 */
export const API_CONFIG_PROVIDER: Provider = {
  provide: API_CONFIG,
  useFactory: provideApiConfig,
};
