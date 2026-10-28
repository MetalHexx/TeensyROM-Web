import { noDevices } from '../../support/test-data/fixtures';
import { interceptDjLibrary } from '../../support/interceptors/djLibrary.interceptors';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { APP_ROUTES } from '../../support/constants/app-routes.constants';
import { clearDjBindingsDatabase, stubNoMidiGrant } from '../../support/dj-mixer.helpers';

const DECK_LETTERS = ['A', 'B'] as const;
const KEY_NOTATION = '[aria-label="Key notation"]';
const SID_PANEL_VIEWPORT = { width: 1920, height: 1080 } as const;

describe('DJ Mixer — controls with no tune loaded', () => {
  beforeEach(() => {
    interceptDjLibrary();
    clearDjBindingsDatabase();
    interceptFindDevices({ fixture: noDevices });
    cy.visit(APP_ROUTES.djMixer, { onBeforeLoad: stubNoMidiGrant });
  });

  it('renders the SID panel with both decks voice strips and Panic buttons, and no crossfader', () => {
    cy.get('lib-dj-sid-panel').should('have.length', 1);
    DECK_LETTERS.forEach((letter) => {
      cy.get(`lib-dj-sid-panel [data-deck="${letter}"] lib-sid-voice-strip`).should(
        'have.length',
        3
      );
      cy.get(`lib-dj-sid-panel [data-deck="${letter}"] [data-control="panic"]`).should(
        'have.length',
        1
      );
    });
    cy.get('[aria-label]')
      .filter((_, el) => /crossfader/i.test(el.getAttribute('aria-label') ?? ''))
      .should('have.length', 0);
  });

  it('keeps Panic and every key notation button enabled', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[data-deck="${letter}"] [data-control="panic"] button`).should('be.enabled');
    });
    cy.get(`${KEY_NOTATION} button`)
      .should('have.length', 2)
      .each((button) => {
        cy.wrap(button).should('be.enabled');
      });
  });

  it('seats the one key notation switch between the two Panic buttons, and keeps it clickable', () => {
    cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

    cy.get(KEY_NOTATION).should('have.length', 1);
    cy.get(KEY_NOTATION).should(($switch) => {
      const root = $switch[0].ownerDocument;
      const rectOf = (el: Element | null) => (el as Element).getBoundingClientRect();
      const [panicA, panicB] = DECK_LETTERS.map((letter) =>
        rectOf(root.querySelector(`[data-deck="${letter}"] [data-control="panic"]`))
      );
      const bounds = rectOf($switch[0]);

      expect(bounds.left, 'right of deck A Panic').to.be.at.least(panicA.right - 1);
      expect(bounds.right, 'left of deck B Panic').to.be.at.most(panicB.left + 1);
      expect(Math.abs(bounds.top - panicA.top), 'on the Panic row').to.be.lessThan(panicA.height);
    });

    cy.contains(`${KEY_NOTATION} button`, 'Note').click();
    cy.contains(`${KEY_NOTATION} button`, 'Note').should('have.attr', 'aria-checked', 'true');
    cy.contains(`${KEY_NOTATION} button`, 'Camelot').click();
    cy.contains(`${KEY_NOTATION} button`, 'Camelot').should('have.attr', 'aria-checked', 'true');
  });

  it('disables the speed, jump, shaping and voice controls on both decks', () => {
    DECK_LETTERS.forEach((letter) => {
      cy.get(`[aria-label="Speed multiplier deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Speed up 50% deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Speed home deck ${letter}"]`).should('be.disabled');
      cy.get(`[aria-label="Speed down 50% deck ${letter}"]`).should('be.disabled');

      [
        `Deck ${letter} filter cutoff`,
        `Deck ${letter} filter resonance`,
        `Deck ${letter} voice 1 pulse width`,
        `Deck ${letter} key`,
      ].forEach((name) => {
        cy.get(`[aria-label="${name}"]`).should('be.disabled');
      });

      cy.get(`[aria-label="Deck ${letter} filter resonance"]`)
        .should('have.attr', 'min', '-15')
        .and('have.attr', 'max', '15');

      [1, 2, 3].forEach((voice) => {
        cy.get(`[aria-label="Mute voice ${voice} deck ${letter}"]`).should('be.disabled');
        cy.get(`[aria-label="Deck ${letter} voice ${voice} ring"]`).should('be.disabled');
      });
    });
  });

  it('keeps the key notation across a round trip to another route', () => {
    cy.contains(`${KEY_NOTATION} button`, 'Note').click();

    // The bottom bar's phone nav renders the same `aria-label`, hidden by CSS at desktop width —
    // scope to the visible nav-rail item.
    cy.get('.nav-rail-item[aria-label="Player"]').click();
    cy.url().should('include', APP_ROUTES.player);

    cy.get('.nav-rail-item[aria-label="DJ Mixer"]').click();
    cy.url().should('include', APP_ROUTES.djMixer);

    cy.contains(`${KEY_NOTATION} button`, 'Note').should('have.attr', 'aria-checked', 'true');
  });
});
