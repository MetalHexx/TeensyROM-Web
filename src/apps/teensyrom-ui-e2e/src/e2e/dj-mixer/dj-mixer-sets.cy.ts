import { FileItemType } from '@teensyrom-nx/data-access/api-client';
import type { DjSetDto, DjSetRowDto } from '@teensyrom-nx/data-access/api-client';
import { APP_ROUTES } from '../../support/constants/app-routes.constants';
import { clearDjBindingsDatabase, stubNoMidiGrant } from '../../support/dj-mixer.helpers';
import {
  interceptDjLibrary,
  waitForDeleteDjSet,
  waitForGetDjSet,
} from '../../support/interceptors/djLibrary.interceptors';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { interceptConnectDevice } from '../../support/interceptors/connectDevice.interceptors';
import { setupGetDirectoryWithFiles } from '../../support/interceptors/getDirectory.interceptors';
import { interceptGetFileContent } from '../../support/interceptors/getFileContent.interceptors';
import { generateFileItem } from '../../support/test-data/generators/storage.generators';
import { stillTimeSidBytes } from '../../support/test-data/fixtures/still-time.fixture';

const VIEWPORT = { width: 1920, height: 1080 } as const;

const FRIDAY_ID = '6f1c2a40-0b7e-4d57-9a53-1f0d5d9b0a01';
const SATURDAY_ID = '6f1c2a40-0b7e-4d57-9a53-1f0d5d9b0a02';

const CARD = 'lib-dj-set-card lib-set-card';
const CARD_NAME = `${CARD} section.card`;
const TIMESTAMP = '2026-10-01T20:00:00.000Z';

function row(id: string, sidHash: string, title: string, author: string): DjSetRowDto {
  return {
    id,
    tune: { sidHash, title, author, released: '2024', subtuneCount: 1, byteLength: 4096 },
    copiedFrom: null,
    lastSubtune: 1,
    subtunes: [],
    host: null,
  };
}

function savedSet(id: string, name: string, rows: DjSetRowDto[]): DjSetDto {
  return { id, name, placeholder: name, rows, created: TIMESTAMP, updated: TIMESTAMP };
}

const FRIDAY = savedSet(FRIDAY_ID, 'Friday', [
  row('11111111-1111-4111-8111-111111111111', 'a'.repeat(32), 'Alpha Tune', 'Ann'),
  row('22222222-2222-4222-8222-222222222222', 'b'.repeat(32), 'Beta Tune', 'Bob'),
]);
const SATURDAY = savedSet(SATURDAY_ID, 'Saturday', [
  row('33333333-3333-4333-8333-333333333333', 'c'.repeat(32), 'Gamma Tune', 'Cy'),
]);

/** Waits for set saves until one satisfies the predicate, then yields its body. A load can save
 *  more than once on its way (hydrating, selecting), so the wanted save is not always the first. */
function waitForSaveWhere(
  predicate: (set: DjSetDto) => boolean,
  timeout = 10000
): Cypress.Chainable<DjSetDto> {
  return cy.wait('@saveDjSet', { timeout }).then(({ request }) => {
    const set = request.body as DjSetDto;
    if (predicate(set)) {
      return cy.wrap(set);
    }
    return waitForSaveWhere(predicate, timeout);
  });
}

function layoutRects() {
  return cy.document().then((doc) => {
    const rect = (selector: string) => {
      const element = doc.querySelector(selector);
      if (element === null) {
        throw new Error(`No element matches ${selector}`);
      }
      const { top, left, width, height } = element.getBoundingClientRect();
      return { top, left, width, height };
    };
    return {
      transportA: rect('[aria-label="Transport deck A"]'),
      transportB: rect('[aria-label="Transport deck B"]'),
      speedA: rect('[data-deck="A"] [data-control="speed"]'),
      speedB: rect('[data-deck="B"] [data-control="speed"]'),
      sidPanel: rect('lib-dj-sid-panel'),
    };
  });
}

function visitDjMixer(library: Parameters<typeof interceptDjLibrary>[0] = {}): void {
  cy.viewport(VIEWPORT.width, VIEWPORT.height);
  clearDjBindingsDatabase();
  interceptDjLibrary(library);
  interceptFindDevices();
  interceptConnectDevice();
  setupGetDirectoryWithFiles([]);
  cy.visit(APP_ROUTES.djMixer, { onBeforeLoad: stubNoMidiGrant });
}

describe('DJ Mixer — sets', () => {
  describe('with saved sets', () => {
    beforeEach(() => {
      visitDjMixer({ sets: [FRIDAY, SATURDAY], currentSetId: FRIDAY_ID });
    });

    it('shows the current set in the card with its name, count and position', () => {
      cy.get(CARD_NAME).should('have.attr', 'aria-label').and('include', 'Set Friday, 2 SIDs');
      cy.get(CARD).contains('2 SIDS').should('be.visible');
      cy.get(`${CARD} button[aria-label="Rename set Friday"]`).should('be.visible');
      cy.get(`${CARD} button[aria-label^="Row 1 of 2, Alpha Tune"]`).should('be.visible');
      cy.get(`${CARD} [aria-label^="Set selection"]`).should('exist');
    });

    it('renames the set with a PUT carrying the new name', () => {
      cy.get(`${CARD} button[aria-label="Rename set Friday"]`).click();
      cy.get(`${CARD} input`).clear();
      cy.get(`${CARD} input`).type('Late Night{enter}');

      waitForSaveWhere((set) => set.name === 'Late Night').then((set) => {
        expect(set.id).to.equal(FRIDAY_ID);
      });
      cy.get(CARD_NAME).should('have.attr', 'aria-label').and('include', 'Set Late Night');
    });

    it('moves a row with Alt+ArrowDown on its handle and saves the new order', () => {
      cy.get(`${CARD} button[aria-label^="Move Alpha Tune"]`).trigger('keydown', {
        key: 'ArrowDown',
        altKey: true,
      });

      waitForSaveWhere((set) => set.rows[0]?.tune.title === 'Beta Tune').then((set) => {
        expect(set.rows.map((r) => r.tune.title)).to.deep.equal(['Beta Tune', 'Alpha Tune']);
      });
    });

    it('lists the sets in the tree and loads another with its own GET', () => {
      cy.get('[role="treeitem"][aria-label="Set Friday, loaded"]').should('exist');
      cy.get('[role="treeitem"][aria-label="Set Saturday"]').click();

      waitForGetDjSet(SATURDAY_ID);
      cy.get(CARD_NAME).should('have.attr', 'aria-label').and('include', 'Set Saturday, 1 SID');
      cy.get('[role="treeitem"][aria-label="Set Saturday, loaded"]').should('exist');
    });

    it('asks before deleting: Cancel sends nothing, Delete sends DELETE then saves a fresh set', () => {
      cy.get(`${CARD} button[aria-label="Delete set Friday"]`).click();
      cy.get(`${CARD} [role="alertdialog"]`).should('be.visible');
      cy.get(`${CARD} [role="alertdialog"] button[aria-label="Cancel"]`).click();
      cy.get(`${CARD} [role="alertdialog"]`).should('not.exist');
      cy.get('@deleteDjSet.all').should('have.length', 0);

      cy.get(`${CARD} button[aria-label="Delete set Friday"]`).click();
      cy.get(`${CARD} [role="alertdialog"] button[aria-label="Delete"]`).click();

      waitForDeleteDjSet().its('request.url').should('include', FRIDAY_ID);
      waitForSaveWhere((set) => set.id !== FRIDAY_ID && /^Set \d+$/.test(set.name)).then((set) => {
        expect(set.rows).to.have.length(0);
      });
    });

    it('adds a set with the New key and makes it current', () => {
      cy.get(`${CARD} button[aria-label="New set"]`).click();

      waitForSaveWhere((set) => set.id !== FRIDAY_ID && /^Set \d+$/.test(set.name)).then((set) => {
        cy.get(CARD_NAME)
          .should('have.attr', 'aria-label')
          .and('include', `Set ${set.name}, 0 SIDs`);
      });
      cy.get('[role="treeitem"][aria-label^="Set Set "]').should('exist');
    });
  });

  describe('hiding the browser', () => {
    beforeEach(() => {
      visitDjMixer({ sets: [FRIDAY], currentSetId: FRIDAY_ID });
      // The scaling containers' entry animation still moves their rects; measure the layout itself.
      cy.document().then((doc) => {
        const style = doc.createElement('style');
        style.textContent =
          'lib-scaling-container, lib-scaling-compact-card { transform: none !important; }';
        doc.head.appendChild(style);
      });
    });

    it('removes the band and leaves the decks and the SID panel where they were', () => {
      cy.get('.bottom-band').should('exist');
      cy.get('button[aria-label="Hide the browser"]').should('have.attr', 'aria-expanded', 'true');
      layoutRects().then((shown) => {
        cy.get('button[aria-label="Hide the browser"]').click();

        cy.get('.bottom-band').should('not.exist');
        cy.get('.mixer-grid').should('have.class', 'mixer-grid--no-browser');
        cy.get('button[aria-label="Show the browser"]').should(
          'have.attr',
          'aria-expanded',
          'false'
        );
        layoutRects().should('deep.equal', shown);

        cy.get('button[aria-label="Show the browser"]').click();

        cy.get('.bottom-band').should('exist');
        cy.get('.mixer-grid').should('not.have.class', 'mixer-grid--no-browser');
        layoutRects().should('deep.equal', shown);
      });
    });

    it('keeps the deck controls clickable after the browser is hidden', () => {
      cy.get('button[aria-label="Hide the browser"]').click();
      cy.get('.bottom-band').should('not.exist');

      cy.get('[data-deck="A"] [data-control="panic"] button').click();
    });
  });

  describe('the set peek', () => {
    /** The part of Angular's dev-mode debug API the case uses; absent from a production build. */
    interface NgDebug {
      getComponent(element: Element): { djSets: { moveSelection(delta: number): void } };
    }

    beforeEach(() => {
      visitDjMixer({ sets: [FRIDAY], currentSetId: FRIDAY_ID });
      cy.document().then((doc) => {
        const style = doc.createElement('style');
        style.textContent =
          'lib-scaling-container, lib-scaling-compact-card { transform: none !important; }';
        doc.head.appendChild(style);
      });
    });

    it('rises over the bottom on a Select turn while the browser is hidden, then leaves the decks clickable', function () {
      cy.window().then((win) => {
        if ((win as unknown as { ng?: NgDebug }).ng === undefined) {
          // A production build has no debug API to turn the Select knob with; run against `serve`.
          this.skip();
        }
      });
      cy.get('.bottom-band').should('exist');
      layoutRects().then((shown) => {
        cy.get('button[aria-label="Hide the browser"]').click();
        cy.get('.bottom-band').should('not.exist');
        cy.get('.set-peek').should('not.exist');

        cy.window().then((win) => {
          const { ng } = win as unknown as { ng: NgDebug };
          const view = win.document.querySelector('lib-dj-mixer-view') as Element;
          ng.getComponent(view).djSets.moveSelection(1);
        });

        cy.get('.set-peek lib-set-card').should('be.visible');
        layoutRects().should('deep.equal', shown);

        cy.get('.set-peek lib-set-card', { timeout: 5000 }).should('not.exist');
        layoutRects().should('deep.equal', shown);
        cy.get('[data-deck="A"] [data-control="panic"] button').click();
      });
    });
  });

  describe('dragging a SID from the listing into the card', () => {
    beforeEach(() => {
      cy.viewport(VIEWPORT.width, VIEWPORT.height);
      clearDjBindingsDatabase();
      interceptDjLibrary();
      interceptFindDevices();
      interceptConnectDevice();
      setupGetDirectoryWithFiles([
        generateFileItem({
          name: 'Still_Time.sid',
          path: '/Still_Time.sid',
          type: FileItemType.Song,
          title: 'Still Time',
        }),
      ]);
      interceptGetFileContent({ bytes: stillTimeSidBytes() });
      cy.visit(APP_ROUTES.djMixer, { onBeforeLoad: stubNoMidiGrant });
    });

    it('shows a pending row, then the tune with its title, and saves it', () => {
      cy.get(`${CARD} [role="list"]`).should('not.exist');
      cy.window().then((win) => {
        const dataTransfer = new win.DataTransfer();
        cy.get('[data-item-path="/Still_Time.sid"]').trigger('dragstart', { dataTransfer });
        cy.get(`${CARD} .rows`).trigger('dragover', { dataTransfer });
        cy.get(`${CARD} .rows`).trigger('drop', { dataTransfer });
      });

      cy.get(`${CARD} lib-set-row[data-pending]`).should('exist');
      cy.get(`${CARD} button[aria-label*="Still Time"]`, { timeout: 60000 }).should('exist');
      cy.get(`${CARD} lib-set-row[data-pending]`).should('not.exist');

      waitForSaveWhere((set) => set.rows.length === 1, 60000).then((set) => {
        expect(set.rows[0].tune.title).to.match(/Still Time/);
        expect(set.rows[0].tune.sidHash).to.match(/^[0-9a-f]{32}$/);
      });
    });
  });
});
