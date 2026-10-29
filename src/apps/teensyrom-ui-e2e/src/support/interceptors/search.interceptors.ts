/// <reference types="cypress" />

import type { FileItemDto, SearchResponse } from '@teensyrom-nx/data-access/api-client';
import type { Method } from 'cypress/types/net-stubbing';
import { interceptSuccess, type EndpointDefinition } from './primitives/interceptor-primitives';

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
}

// ============================================================================
// INTERCEPTOR FUNCTION
// ============================================================================

/**
 * Intercepts GET /devices/{deviceId}/search.
 *
 * @param options The results to serve
 */
export function interceptSearch(options: InterceptSearchOptions = {}): void {
  const { files = [] } = options;

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

  interceptSuccess(SEARCH_ENDPOINT, response);
}
