/// <reference types="cypress" />

import type {
  DjSetDto,
  DjSetSummaryDto,
  DjTuneMemoryDto,
} from '@teensyrom-nx/data-access/api-client';
import type { CyHttpMessages, Interception, Method } from 'cypress/types/net-stubbing';
import type { EndpointDefinition } from './primitives/interceptor-primitives';

/**
 * DJ library interceptors: the saved sets, each tune's memory and which set is current.
 * One stateful in-memory library answers all eight endpoints, so a save is seen by the next read.
 */

// ============================================================================
// ENDPOINT DEFINITIONS
// ============================================================================

// Host-agnostic and `/api`-prefixed, as `GET_DIRECTORY_ENDPOINT` explains: the generated API client
// always issues `/api/dj/...`, against an absolute origin in dev mode and a relative one in
// production. `*` stops at a `/`, so the list and the per-set patterns never overlap.
export const LIST_DJ_SETS_ENDPOINT: EndpointDefinition = {
  method: 'GET' as Method,
  pattern: '/api/dj/sets',
  alias: 'listDjSets',
};

export const GET_DJ_SET_ENDPOINT: EndpointDefinition = {
  method: 'GET' as Method,
  pattern: '/api/dj/sets/*',
  alias: 'getDjSet',
};

export const SAVE_DJ_SET_ENDPOINT: EndpointDefinition = {
  method: 'PUT' as Method,
  pattern: '/api/dj/sets/*',
  alias: 'saveDjSet',
};

export const DELETE_DJ_SET_ENDPOINT: EndpointDefinition = {
  method: 'DELETE' as Method,
  pattern: '/api/dj/sets/*',
  alias: 'deleteDjSet',
};

export const GET_TUNE_MEMORY_ENDPOINT: EndpointDefinition = {
  method: 'GET' as Method,
  pattern: '/api/dj/tunes/*/memory',
  alias: 'getTuneMemory',
};

export const SAVE_TUNE_MEMORY_ENDPOINT: EndpointDefinition = {
  method: 'PUT' as Method,
  pattern: '/api/dj/tunes/*/memory',
  alias: 'saveTuneMemory',
};

export const GET_DJ_LIBRARY_ENDPOINT: EndpointDefinition = {
  method: 'GET' as Method,
  pattern: '/api/dj/library',
  alias: 'getDjLibrary',
};

export const SAVE_DJ_LIBRARY_ENDPOINT: EndpointDefinition = {
  method: 'PUT' as Method,
  pattern: '/api/dj/library',
  alias: 'saveDjLibrary',
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Options for interceptDjLibrary
 */
export interface InterceptDjLibraryOptions {
  /** Sets already saved on the server; none by default (an empty library) */
  sets?: DjSetDto[];
  /** The set the library says is current; none by default */
  currentSetId?: string | null;
  /** Tune memories already saved on the server, by SID hash */
  tuneMemories?: DjTuneMemoryDto[];
  /** Simulate network delay in milliseconds */
  responseDelayMs?: number;
}

// ============================================================================
// INTERCEPTOR FUNCTION
// ============================================================================

/**
 * Intercepts every `/api/dj/...` endpoint with one in-memory library: reads answer from it and
 * saves and deletes change it. Registered once per test, before the page loads.
 *
 * @param options The library's starting contents
 */
export function interceptDjLibrary(options: InterceptDjLibraryOptions = {}): void {
  const { responseDelayMs = 0 } = options;
  const sets = new Map<string, DjSetDto>((options.sets ?? []).map((set) => [set.id, set]));
  const memories = new Map<string, DjTuneMemoryDto>(
    (options.tuneMemories ?? []).map((memory) => [memory.sidHash, memory])
  );
  let currentSetId = options.currentSetId ?? null;

  const reply = (req: CyHttpMessages.IncomingHttpRequest, body: unknown) =>
    req.reply({
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
      body,
      delay: responseDelayMs,
    });
  const idIn = (req: CyHttpMessages.IncomingHttpRequest, after: string) =>
    decodeURIComponent(new URL(req.url).pathname.split(`/${after}/`)[1].split('/')[0]);

  cy.intercept(LIST_DJ_SETS_ENDPOINT.method, LIST_DJ_SETS_ENDPOINT.pattern, (req) =>
    reply(req, { sets: [...sets.values()].map(toSummary), message: 'Success' })
  ).as(LIST_DJ_SETS_ENDPOINT.alias);

  cy.intercept(GET_DJ_SET_ENDPOINT.method, GET_DJ_SET_ENDPOINT.pattern, (req) =>
    reply(req, { set: sets.get(idIn(req, 'sets')) ?? null, message: 'Success' })
  ).as(GET_DJ_SET_ENDPOINT.alias);

  cy.intercept(SAVE_DJ_SET_ENDPOINT.method, SAVE_DJ_SET_ENDPOINT.pattern, (req) => {
    const set = req.body as DjSetDto;
    sets.set(set.id, set);
    reply(req, { message: 'Success' });
  }).as(SAVE_DJ_SET_ENDPOINT.alias);

  cy.intercept(DELETE_DJ_SET_ENDPOINT.method, DELETE_DJ_SET_ENDPOINT.pattern, (req) => {
    sets.delete(idIn(req, 'sets'));
    reply(req, { message: 'Success' });
  }).as(DELETE_DJ_SET_ENDPOINT.alias);

  cy.intercept(GET_TUNE_MEMORY_ENDPOINT.method, GET_TUNE_MEMORY_ENDPOINT.pattern, (req) =>
    reply(req, { memory: memories.get(idIn(req, 'tunes')) ?? null, message: 'Success' })
  ).as(GET_TUNE_MEMORY_ENDPOINT.alias);

  cy.intercept(SAVE_TUNE_MEMORY_ENDPOINT.method, SAVE_TUNE_MEMORY_ENDPOINT.pattern, (req) => {
    const memory = req.body as DjTuneMemoryDto;
    memories.set(memory.sidHash, memory);
    reply(req, { message: 'Success' });
  }).as(SAVE_TUNE_MEMORY_ENDPOINT.alias);

  cy.intercept(GET_DJ_LIBRARY_ENDPOINT.method, GET_DJ_LIBRARY_ENDPOINT.pattern, (req) =>
    reply(req, { currentSetId, message: 'Success' })
  ).as(GET_DJ_LIBRARY_ENDPOINT.alias);

  cy.intercept(SAVE_DJ_LIBRARY_ENDPOINT.method, SAVE_DJ_LIBRARY_ENDPOINT.pattern, (req) => {
    currentSetId = (req.body as { currentSetId?: string | null }).currentSetId ?? null;
    reply(req, { message: 'Success' });
  }).as(SAVE_DJ_LIBRARY_ENDPOINT.alias);
}

function toSummary(set: DjSetDto): DjSetSummaryDto {
  return { id: set.id, name: set.name, rowCount: set.rows.length, updated: set.updated };
}

// ============================================================================
// WAIT FUNCTIONS
// ============================================================================

/** Waits for a PUT of a set and yields its body. */
export function waitForSaveDjSet(timeout = 10000): Cypress.Chainable<DjSetDto> {
  return cy
    .wait(`@${SAVE_DJ_SET_ENDPOINT.alias}`, { timeout })
    .then((xhr) => xhr.request.body as DjSetDto);
}

/** Waits for a GET of the given set; reads of other sets before it (hydrating) are skipped. */
export function waitForGetDjSet(setId: string, timeout = 10000): Cypress.Chainable<Interception> {
  return cy
    .wait(`@${GET_DJ_SET_ENDPOINT.alias}`, { timeout })
    .then((interception) =>
      interception.request.url.includes(setId)
        ? cy.wrap(interception)
        : waitForGetDjSet(setId, timeout)
    );
}

/** Waits for a DELETE of one set. */
export function waitForDeleteDjSet(timeout = 10000): Cypress.Chainable<Interception> {
  return cy.wait(`@${DELETE_DJ_SET_ENDPOINT.alias}`, { timeout });
}
