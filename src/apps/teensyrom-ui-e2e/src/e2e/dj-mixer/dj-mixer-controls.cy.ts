import { noDevices } from '../../support/test-data/fixtures';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { APP_ROUTES } from '../../support/constants/app-routes.constants';

const DECK_LETTERS = ['A', 'B'] as const;
const CROSSFADER = 'Crossfader, deck A to deck B';
const KEY_NOTATION = '[aria-label="Key notation"]';

/** Clears the DJ bindings database before each test so a port bound by one spec never leaks its
 *  selection into the next — bindings persist across page loads by design. */
function clearDjBindingsDatabase(): void {
  cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve) => {
        const request = win.indexedDB.deleteDatabase('teensyrom-dj');
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      })
  );
}

/** Stubs the Permissions API's `midi` query to `'prompt'` before the app's own scripts run, so
 *  `DeckBindings.hydrate` never auto-connects on this suite's own account. Some Chromium/Electron
 *  builds answer `navigator.permissions.query({ name: 'midi' })` with `'granted'` even with no
 *  prior grant at all, which would otherwise auto-connect and hide the Enable MIDI button —
 *  this arranges the "no MIDI grant" precondition the suite is named for instead of relying on
 *  whatever the host browser's ambient default happens to be. */
function stubNoMidiGrant(win: Cypress.AUTWindow): void {
  if (!win.navigator.permissions) {
    return;
  }
  cy.stub(win.navigator.permissions, 'query')
    .withArgs(Cypress.sinon.match({ name: 'midi' }))
    .resolves({ state: 'prompt' } as PermissionStatus);
}

describe('DJ Mixer — controls with no tune loaded', () => {
  beforeEach(() => {
    clearDjBindingsDatabase();
    interceptFindDevices({ fixture: noDevices });
    cy.visit(APP_ROUTES.djMixer, { onBeforeLoad: stubNoMidiGrant });
  });

  it('keeps the gain faders and the crossfader enabled', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Gain deck ${letter}"]`).should('be.enabled');
    });
    cy.get(`[aria-label="${CROSSFADER}"]`).should('be.enabled');
  });

  it('keeps every key notation button enabled', () => {
    cy.get(`${KEY_NOTATION} button`).should('have.length', 2).each((button) => {
      cy.wrap(button).should('be.enabled');
    });
  });

  it('disables the speed, jump, shaping, filter, and voice controls on both decks', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Speed multiplier deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Speed up 50% deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Speed home deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Speed down 50% deck ${letter}"]`).should('be.disabled');

      ['Cutoff', 'Resonance', 'Pulse width', 'Key'].forEach((control) => {
        cy.get(`[aria-label="${control} deck ${letter}"]`).should('be.disabled');
      });

      ['low-pass', 'band-pass', 'high-pass', 'off'].forEach((mode) => {
        cy.get(`[aria-label="Filter mode ${mode} deck ${letter}"]`).should('be.disabled');
      });

      [1, 2, 3].forEach((voice) => {
        cy.get(`[aria-label="Mute voice ${voice} deck ${letter}"]`).should('be.disabled');
      });
    });
  });

  it('keeps gain, crossfader, and key notation across a round trip to another route', () => {
    cy.get('[aria-label="Gain deck A"]').invoke('val', 0.4).trigger('input');
    cy.get(`[aria-label="${CROSSFADER}"]`).invoke('val', 0.5).trigger('input');
    cy.contains(`${KEY_NOTATION} button`, 'Note').click();

    // The bottom bar's phone nav renders the same `aria-label`, hidden by CSS at desktop width —
    // scope to the visible nav-rail item.
    cy.get('.nav-rail-item[aria-label="Player"]').click();
    cy.url().should('include', APP_ROUTES.player);

    cy.get('.nav-rail-item[aria-label="DJ Mixer"]').click();
    cy.url().should('include', APP_ROUTES.djMixer);

    cy.get('[aria-label="Gain deck A"]').should('have.value', '0.4');
    cy.get(`[aria-label="${CROSSFADER}"]`).should('have.value', '0.5');
    cy.contains(`${KEY_NOTATION} button`, 'Note').should('have.attr', 'aria-pressed', 'true');
  });
});
