import { InjectionToken } from '@angular/core';

/**
 * Configuration for API base URLs.
 * Enables environment-aware URL handling for API clients and SignalR hubs.
 *
 * - Development: Uses absolute URLs (e.g., 'http://localhost:5168')
 * - Production: Uses relative URLs (empty string for same-origin requests)
 */
export interface IApiConfig {
  /**
   * Base path for API HTTP requests.
   * - Development: 'http://localhost:5168'
   * - Production: '' (empty string for relative URLs)
   */
  basePath: string;

  /**
   * Base path for SignalR hub connections.
   * - Development: 'http://localhost:5168'
   * - Production: '' (empty string for relative URLs)
   */
  signalRBasePath: string;
}

export const API_CONFIG = new InjectionToken<IApiConfig>('API_CONFIG');
