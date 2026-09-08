/**
 * Real-browser verification for Phase 2's own defining risk: `@sidablist/core` is a linked `file:`
 * dependency whose worker has to resolve from inside `node_modules`, and per the phase doc that
 * failure "is silent at build time and audible at run time." Build-artifact inspection and HTTP
 * probes against the served worker chunk (done elsewhere) confirm the chunk is emitted and reachable,
 * but neither one constructs a `Worker`, completes a `postMessage`/`onmessage` round trip, or lets
 * Angular's change detection render the result — the one failure mode that only announces itself in
 * a running page. This spec drives the genuine served app in a genuine browser and reads the
 * rendered readout back, mirroring the pattern `dj-poc-marker-moments.cy.ts` and
 * `dj-poc-channel-faders.cy.ts` established for the same class of gap.
 *
 * Run against both halves the phase's exit criteria name:
 *   - dev serve:     `pnpm exec nx run teensyrom-ui-e2e:e2e --spec=src/e2e/poc/dj-poc-core-replay-worker.cy.ts`
 *   - production build served statically:
 *       `pnpm exec nx run teensyrom-ui-e2e:e2e:production --spec=src/e2e/poc/dj-poc-core-replay-worker.cy.ts`
 * (`cypress.config.ts`'s `webServerCommands.default` / `.production` back these two configurations —
 * the former serves via `teensyrom-ui:serve`, the dev server; the latter via `teensyrom-ui:serve-static`,
 * a static file server in front of `teensyrom-ui:build`'s real output.)
 */

const SETUP_DRAWER_TITLE = 'SETUP & DIAGNOSTICS';
const SMOKE_BUTTON_LABEL = 'Run core smoke job';
const SMOKE_TARGET_FRAME = 5;
const EXPECTED_READOUT = `frame ${SMOKE_TARGET_FRAME} → landed at frame ${SMOKE_TARGET_FRAME}`;

describe('DJ Poc setup drawer — real-browser core replay worker round trip', () => {
  beforeEach(() => {
    cy.visit('/dev/dj-poc');
    cy.contains('.drawer-head', SETUP_DRAWER_TITLE).click();
  });

  it('starts the linked worker and renders the landed frame once it round-trips', () => {
    cy.get('.linked-core-result').should('have.text', '—');

    cy.contains('button', SMOKE_BUTTON_LABEL).click();

    cy.get('.linked-core-result').should('have.text', EXPECTED_READOUT);
  });
});
