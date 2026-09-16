import { noDevices } from '../../support/test-data/fixtures';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';

const DECK_LETTERS = ['A', 'B'] as const;

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

describe('DJ Mixer — fixed decks with no enabled devices', () => {
  beforeEach(() => {
    clearDjBindingsDatabase();
    interceptFindDevices({ fixture: noDevices });
    cy.visit('/dj-mixer');
  });

  it('renders both transports with every disable-able control disabled', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Transport deck ${letter}"]`).should('exist');
      cy.get(`[aria-label="Play deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Stop deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Previous subtune deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Next subtune deck ${letter}"]`).should('be.disabled');
    });
  });

  it('renders both binding cards with their output port select', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Output port deck ${letter}"]`).should('exist');
    });
  });

  it('shows the Enable MIDI button for both decks — the suite runs with no MIDI grant', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Enable MIDI deck ${letter}"]`).should('exist');
    });
  });
});
