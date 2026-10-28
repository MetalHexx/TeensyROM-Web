/// <reference types="cypress" />

import type { FileItemDto, SearchResponse } from '@teensyrom-nx/data-access/api-client';
import type { Interception, Method } from 'cypress/types/net-stubbing';
import {
  interceptError,
  interceptSuccess,
  type EndpointDefinition,
} from './primitives/interceptor-primitives';

/**
 * search endpoint interceptor: answers a device-wide file search with the given results.
 */

// ============================================================================
// ENDPOINT DEFINITION
// ============================================================================

// Host-agnostic and `/api`-prefixed, as `GET_DIRECTORY_ENDPOINT` explains. The trailing `*` covers
// the query string (`searchText`, `skip`, `take`).
export const SEARCH_ENDPOINT: EndpointDefinition = {
  method: 'GET' as Method,
  pattern: '/api/devices/*/search*',
  alias: 'search',
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Options for interceptSearch
 */
export interface InterceptSearchOptions {
  /**
   * The results every search is answered with. Each must carry a valid `storageType` (the
   * generator defaults it to SD): the app's mapper throws on a missing one, which shows as
   * "Search Failed" rather than as a row.
   */
  files?: FileItemDto[];
  /** When true, return an HTTP error to simulate API failure */
  errorMode?: boolean;
  /** Custom HTTP status code for error responses (default: 500) */
  statusCode?: number;
  /** Custom error message for error responses */
  errorMessage?: string;
  /** Simulate network delay in milliseconds */
  responseDelayMs?: number;
}

// ============================================================================
// INTERCEPTOR FUNCTION
// ============================================================================

/**
 * Intercepts GET /devices/{deviceId}/search.
 *
 * @param options The results to serve, or an error to simulate
 */
export function interceptSearch(options: InterceptSearchOptions = {}): void {
  const { files = [], errorMode = false, statusCode, errorMessage, responseDelayMs = 0 } = options;

  if (errorMode) {
    interceptError(
      SEARCH_ENDPOINT,
      statusCode || 500,
      errorMessage || 'Search failed. Please try again.',
      responseDelayMs
    );
    return;
  }

  const response: SearchResponse = {
    files,
    searchText: '',
    totalCount: files.length,
    count: files.length,
    skip: 0,
    take: 1000,
    hasMore: false,
    message: 'Success',
  };

  interceptSuccess(SEARCH_ENDPOINT, response, responseDelayMs);
}

// ============================================================================
// WAIT FUNCTIONS
// ============================================================================

/** Waits for a search request to complete. */
export function waitForSearch(timeout = 10000): Cypress.Chainable<Interception> {
  return cy.wait(`@${SEARCH_ENDPOINT.alias}`, { timeout });
}
