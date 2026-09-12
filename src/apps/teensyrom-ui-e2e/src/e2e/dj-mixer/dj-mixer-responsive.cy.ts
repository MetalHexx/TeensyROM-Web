import { VIEWPORT } from '../../support/constants/test.constants';
import { multipleDevices } from '../../support/test-data/fixtures';
import type { MockDeviceFixture } from '../../support/test-data/fixtures/fixture.types';
import { generateDevice } from '../../support/test-data/generators/device.generators';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { interceptConnectDevice } from '../../support/interceptors/connectDevice.interceptors';

// There is no two-device fixture in the suite (`singleDevice` has one, `multipleDevices` three).
// Devices map in with `isEnabled: true` by default, so two discovered devices become two decks.
const twoDevices: MockDeviceFixture = { devices: [generateDevice(), generateDevice()] };

const STACKED_WIDTHS = [1279, VIEWPORT.TABLET.width] as const;
const NO_OVERFLOW_WIDTHS = [1400, 1279, 1100, VIEWPORT.TABLET.width, 400] as const;

/**
 * `.router-content` is the shell's own scroll container here (unlike the DJ Poc route, which
 * bypasses the shell and owns the viewport), so overflow is measured against it rather than
 * `document.documentElement`.
 */
function expectNoHorizontalOverflow(): void {
  cy.get('.router-content').then(([content]) => {
    expect(content.scrollWidth).to.be.at.most(content.clientWidth);
  });
}

describe('DJ Mixer — responsive layout', () => {
  describe('two decks', () => {
    beforeEach(() => {
      interceptFindDevices({ fixture: twoDevices });
      interceptConnectDevice();
      cy.visit('/dj-mixer');
    });

    it('holds deck A, the mixer, and deck B side by side at desktop width', () => {
      cy.viewport(VIEWPORT.STANDARD.width, VIEWPORT.STANDARD.height);

      cy.get('[aria-label="Transport deck A"]')
        .then(([transportA]) => transportA.getBoundingClientRect())
        .then((aRect) => {
          cy.get('[aria-label="Transport deck B"]')
            .then(([transportB]) => transportB.getBoundingClientRect())
            .then((bRect) => {
              expect(aRect.top, 'deck A and deck B share the same top').to.equal(bRect.top);

              cy.get('lib-dj-mixer-card')
                .then(([mixer]) => mixer.getBoundingClientRect())
                .then((mixerRect) => {
                  expect(aRect.left, 'deck A sits left of the mixer').to.be.lessThan(
                    mixerRect.left
                  );
                  expect(mixerRect.left, 'the mixer sits left of deck B').to.be.lessThan(
                    bRect.left
                  );
                });
            });
        });
    });

    it('positions the bottom band below the grid content, Browse before Directory Listing', () => {
      cy.viewport(VIEWPORT.STANDARD.width, VIEWPORT.STANDARD.height);

      cy.get('lib-dj-mixer-card')
        .then(([mixer]) => mixer.getBoundingClientRect())
        .then((mixerRect) => {
          cy.get('.browse-card')
            .then(([browse]) => browse.getBoundingClientRect())
            .then((browseRect) => {
              expect(mixerRect.bottom, 'the mixer sits above the bottom band').to.be.at.most(
                browseRect.top
              );

              cy.get('.directory-listing-card')
                .then(([directoryListing]) => directoryListing.getBoundingClientRect())
                .then((directoryListingRect) => {
                  expect(
                    browseRect.left,
                    'Browse sits left of Directory Listing'
                  ).to.be.lessThan(directoryListingRect.left);
                });
            });
        });
    });

    it('top-aligns the deck strips within the mixer card at desktop width', () => {
      cy.viewport(VIEWPORT.STANDARD.width, VIEWPORT.STANDARD.height);

      // The deck strip animates in (`animationEntry="from-bottom"` on the mixer's own
      // `lib-scaling-compact-card`), so the assertion is wrapped in `.should()` — Cypress
      // retries the whole callback until the entry animation settles, rather than reading a
      // mid-animation position from a single unretried `.then()`.
      cy.get('lib-deck-strip')
        .first()
        .should(([strip]) => {
          const mixerCard = strip.ownerDocument.querySelector('lib-dj-mixer-card');
          const stripRect = strip.getBoundingClientRect();
          const mixerCardRect = mixerCard!.getBoundingClientRect();

          expect(
            stripRect.top - mixerCardRect.top,
            "the deck strip sits within the mixer card's top quarter"
          ).to.be.lessThan(mixerCardRect.height * 0.25);
        });
    });

    it('stacks the bottom band into a single column at phone width', () => {
      cy.viewport(400, 900);

      cy.get('.browse-card')
        .then(([browse]) => browse.getBoundingClientRect())
        .then((browseRect) => {
          cy.get('.directory-listing-card')
            .then(([directoryListing]) => directoryListing.getBoundingClientRect())
            .then((directoryListingRect) => {
              expect(
                browseRect.left,
                'Browse and Directory Listing share the same left'
              ).to.equal(directoryListingRect.left);
              expect(browseRect.top, 'Browse sits above Directory Listing').to.be.lessThan(
                directoryListingRect.top
              );
            });
        });
    });

    STACKED_WIDTHS.forEach((width) => {
      const height = width === VIEWPORT.TABLET.width ? VIEWPORT.TABLET.height : 900;

      it(`stacks deck A, then the mixer, then deck B at ${width}px wide`, () => {
        cy.viewport(width, height);

        cy.get('[aria-label="Transport deck A"]')
          .then(([transportA]) => transportA.getBoundingClientRect().top)
          .then((deckATop) => {
            cy.get('lib-dj-mixer-card')
              .then(([mixer]) => mixer.getBoundingClientRect().top)
              .then((mixerTop) => {
                expect(deckATop, 'deck A sits above the mixer').to.be.lessThan(mixerTop);

                cy.get('[aria-label="Transport deck B"]')
                  .then(([transportB]) => transportB.getBoundingClientRect().top)
                  .then((deckBTop) => {
                    expect(mixerTop, 'the mixer sits above deck B').to.be.lessThan(deckBTop);
                  });
              });
          });
      });
    });

    NO_OVERFLOW_WIDTHS.forEach((width) => {
      it(`does not overflow horizontally at ${width}px wide`, () => {
        cy.viewport(width, 900);
        expectNoHorizontalOverflow();
      });
    });

    it('keeps deck B reachable once stacked at tablet width', () => {
      cy.viewport(VIEWPORT.TABLET.width, VIEWPORT.TABLET.height);

      cy.get('[aria-label="Repeat track deck B"]').scrollIntoView();
      cy.get('[aria-label="Repeat track deck B"]').should('be.visible');
    });

    it('keeps the speed fader and the +50% jump button visible and unclipped at desktop width', () => {
      cy.viewport(VIEWPORT.STANDARD.width, VIEWPORT.STANDARD.height);

      cy.get('[aria-label="Speed multiplier deck A"]').should('be.visible');
      cy.get('[aria-label="Speed up 50% deck A"]').should('be.visible');
    });

    it('shows a crossfader with two decks', () => {
      cy.viewport(VIEWPORT.STANDARD.width, VIEWPORT.STANDARD.height);

      cy.get('lib-deck-strip').should('have.length', 2);
      cy.get('lib-crossfader').should('exist');
    });
  });

  describe('one deck', () => {
    beforeEach(() => {
      interceptFindDevices(); // default fixture: singleDevice
      interceptConnectDevice();
      cy.visit('/dj-mixer');
      cy.viewport(VIEWPORT.STANDARD.width, VIEWPORT.STANDARD.height);
    });

    it('renders one deck strip and no crossfader', () => {
      cy.get('lib-deck-strip').should('have.length', 1);
      cy.get('lib-crossfader').should('not.exist');
    });

    NO_OVERFLOW_WIDTHS.forEach((width) => {
      it(`does not overflow horizontally at ${width}px wide`, () => {
        cy.viewport(width, 900);
        expectNoHorizontalOverflow();
      });
    });
  });

  describe('three decks', () => {
    beforeEach(() => {
      interceptFindDevices({ fixture: multipleDevices });
      interceptConnectDevice();
      cy.visit('/dj-mixer');
    });

    it('stacks at every width, including desktop, and keeps deck C reachable via its own scroll', () => {
      cy.viewport(1600, 900);

      cy.get('[aria-label="Transport deck C"]').scrollIntoView();
      cy.get('[aria-label="Transport deck C"]').should('be.visible');
    });

    NO_OVERFLOW_WIDTHS.forEach((width) => {
      it(`does not overflow horizontally at ${width}px wide`, () => {
        cy.viewport(width, 900);
        expectNoHorizontalOverflow();
      });
    });
  });
});
