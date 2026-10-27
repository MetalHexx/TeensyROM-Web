import { noDevices } from '../../support/test-data/fixtures';
import { interceptDjLibrary } from '../../support/interceptors/djLibrary.interceptors';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { APP_ROUTES } from '../../support/constants/app-routes.constants';
import { clearDjBindingsDatabase, stubNoMidiGrant } from '../../support/dj-mixer.helpers';

const DECK_LETTERS = ['A', 'B'] as const;

describe('DJ Mixer — fixed decks with no enabled devices', () => {
  beforeEach(() => {
    interceptDjLibrary();
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

  it('renders both binding cards with their cartridge select', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Cartridge deck ${letter}"]`).should('exist');
    });
  });

  it('shows the Enable MIDI button for both decks — the suite runs with no MIDI grant', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Enable MIDI deck ${letter}"]`).should('exist');
    });
  });
});
