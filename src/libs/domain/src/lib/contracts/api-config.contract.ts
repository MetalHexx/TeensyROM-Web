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

  /**
   * Gets the base URL for constructing absolute URLs to API resources.
   * Returns basePath if non-empty, otherwise returns window.location.origin.
   * This is used for building full URLs to assets served by the API.
   *
   * @returns The base URL to use for API resource URLs
   */
  getBaseUrl(): string;
}

export const API_CONFIG = new InjectionToken<IApiConfig>('API_CONFIG');
