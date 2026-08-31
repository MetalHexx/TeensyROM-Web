import { VIEWPORT } from '../../support/constants/test.constants';

/**
 * Widths that keep the DJ Poc grid's five columns side by side — each one steps past one of
 * `dj-poc-view.component.scss`'s spacing/wrap breakpoints (1500px, 1240px) without yet crossing
 * the 1000px width where the layout switches to the stacked deck A → mixer → deck B fallback.
 */
const SIDE_BY_SIDE_WIDTHS = [1500, 1240, 999] as const;

function expectNoHorizontalOverflow(): void {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth);
  });
}

describe('DJ Poc view — compression down to tablet width', () => {
  beforeEach(() => {
    cy.visit('/dev/dj-poc');
    cy.get('lib-deck-host').should('have.length', 2);
  });

  SIDE_BY_SIDE_WIDTHS.forEach((width) => {
    it(`does not overflow horizontally at ${width}px wide`, () => {
      cy.viewport(width, 900);
      expectNoHorizontalOverflow();
    });
  });

  it('stacks deck A, then the mixer band, then deck B at tablet width, with every control still reachable', () => {
    cy.viewport(VIEWPORT.TABLET.width, VIEWPORT.TABLET.height);
    expectNoHorizontalOverflow();

    // `lib-deck-host` itself renders `display: contents` (see deck-host.component.ts) and so has
    // no box of its own to measure — its `transport-panel` is used instead, a real element bearing
    // this deck's `grid-area`.
    cy.get('[aria-label="Transport deck A"]')
      .then(([transportA]) => transportA.getBoundingClientRect().top)
      .then((deckATop) => {
        cy.get('.mixer-column')
          .then(([mixer]) => mixer.getBoundingClientRect().top)
          .then((mixerTop) => {
            expect(deckATop, 'deck A sits above the mixer band').to.be.lessThan(mixerTop);

            cy.get('[aria-label="Transport deck B"]')
              .then(([transportB]) => transportB.getBoundingClientRect().top)
              .then((deckBTop) => {
                expect(mixerTop, 'the mixer band sits above deck B').to.be.lessThan(deckBTop);
              });
          });
      });

    // Proves each deck's own controls stay reachable and operable once stacked — not merely
    // rendered. The repeat toggle is used (rather than Play/Pause/Stop) because it never depends
    // on a tune being loaded, so it stays enabled with no fixture setup.
    cy.get('[aria-label="Repeat track deck A"]').should('be.visible').check();
    cy.get('[aria-label="Repeat track deck A"]').should('be.checked');
    cy.get('[aria-label="Repeat track deck B"]').should('be.visible').check();
    cy.get('[aria-label="Repeat track deck B"]').should('be.checked');
  });
});
