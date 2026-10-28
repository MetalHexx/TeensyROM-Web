/// <reference types="cypress" />

import type { Interception, Method } from 'cypress/types/net-stubbing';
import type { EndpointDefinition } from './primitives/interceptor-primitives';

/**
 * getFileContent interceptor: serves a file's raw bytes, as the DJ view fetches a dragged SID.
 */

// ============================================================================
// ENDPOINT DEFINITION
// ============================================================================

// Host-agnostic and `/api`-prefixed, as `GET_DIRECTORY_ENDPOINT` explains.
export const GET_FILE_CONTENT_ENDPOINT: EndpointDefinition = {
  method: 'GET' as Method,
  pattern: '/api/devices/*/storage/*/files/content*',
  alias: 'getFileContent',
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Options for interceptGetFileContent
 */
export interface InterceptGetFileContentOptions {
  /** The bytes every request is answered with */
  bytes: Uint8Array;
  /** Simulate network delay in milliseconds */
  responseDelayMs?: number;
}

// ============================================================================
// INTERCEPTOR FUNCTION
// ============================================================================

/**
 * Intercepts GET /devices/{deviceId}/storage/{storageType}/files/content with binary bytes.
 *
 * @param options The bytes to serve
 */
export function interceptGetFileContent({
  bytes,
  responseDelayMs = 0,
}: InterceptGetFileContentOptions): void {
  cy.intercept(GET_FILE_CONTENT_ENDPOINT.method, GET_FILE_CONTENT_ENDPOINT.pattern, (req) => {
    req.reply({
      statusCode: 200,
      headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-cache' },
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      delay: responseDelayMs,
    });
  }).as(GET_FILE_CONTENT_ENDPOINT.alias);
}

// ============================================================================
// WAIT FUNCTIONS
// ============================================================================

/** Waits for a file-content request to complete. */
export function waitForGetFileContent(timeout = 10000): Cypress.Chainable<Interception> {
  return cy.wait(`@${GET_FILE_CONTENT_ENDPOINT.alias}`, { timeout });
}
