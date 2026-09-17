import { noDevices } from '../../support/test-data/fixtures';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { APP_ROUTES } from '../../support/constants/app-routes.constants';

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

describe('DJ Mixer — fixed decks with no enabled devices', () => {
  beforeEach(() => {
    clearDjBindingsDatabase();
    interceptFindDevices({ fixture: noDevices });
    cy.visit(APP_ROUTES.djMixer, { onBeforeLoad: stubNoMidiGrant });
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
