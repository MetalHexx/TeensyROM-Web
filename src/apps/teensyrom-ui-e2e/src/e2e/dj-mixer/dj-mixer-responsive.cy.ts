import { VIEWPORT } from '../../support/constants/test.constants';
import { APP_ROUTES } from '../../support/constants/app-routes.constants';
import { multipleDevices } from '../../support/test-data/fixtures';
import type { MockDeviceFixture } from '../../support/test-data/fixtures/fixture.types';
import { generateDevice } from '../../support/test-data/generators/device.generators';
import { interceptDjLibrary } from '../../support/interceptors/djLibrary.interceptors';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { interceptConnectDevice } from '../../support/interceptors/connectDevice.interceptors';

// There is no two-device fixture in the suite (`singleDevice` has one, `multipleDevices` three).
// The decks are a fixed pair (A and B) regardless of device count — this fixture exists only to
// keep at least one enabled device around, so the bottom band renders Browse and Directory
// Listing instead of the "No Enabled Devices" empty state.
const twoDevices: MockDeviceFixture = { devices: [generateDevice(), generateDevice()] };

const STACKED_WIDTHS = [1279, VIEWPORT.TABLET.width] as const;
const SID_PANEL_VIEWPORT = { width: 1920, height: 1080 } as const;
const NO_OVERFLOW_WIDTHS = [1400, 1279, 1100, VIEWPORT.TABLET.width, 400] as const;
// 400 is left out: the voice strips are known to be too narrow there.
const KEY_MATCH_WIDTHS = [
  SID_PANEL_VIEWPORT.width,
  1400,
  1279,
  1100,
  VIEWPORT.TABLET.width,
] as const;

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
      interceptDjLibrary();
      interceptFindDevices({ fixture: twoDevices });
      interceptConnectDevice();
      cy.visit(APP_ROUTES.djMixer);
    });

    it('holds deck A, the SID panel, and deck B side by side at desktop width', () => {
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

      cy.get('[aria-label="Transport deck A"]')
        .then(([transportA]) => transportA.getBoundingClientRect())
        .then((aRect) => {
          cy.get('[aria-label="Transport deck B"]')
            .then(([transportB]) => transportB.getBoundingClientRect())
            .then((bRect) => {
              expect(aRect.top, 'deck A and deck B share the same top').to.equal(bRect.top);

              cy.get('lib-dj-sid-panel')
                .then(([mixer]) => mixer.getBoundingClientRect())
                .then((mixerRect) => {
                  expect(aRect.left, 'deck A sits left of the panel').to.be.lessThan(
                    mixerRect.left
                  );
                  expect(mixerRect.left, 'the panel sits left of deck B').to.be.lessThan(
                    bRect.left
                  );
                });
            });
        });
    });

    it('positions the bottom band below the grid content, Browse before Directory Listing', () => {
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

      cy.get('lib-dj-sid-panel')
        .then(([mixer]) => mixer.getBoundingClientRect())
        .then((mixerRect) => {
          cy.get('.browse-card')
            .then(([browse]) => browse.getBoundingClientRect())
            .then((browseRect) => {
              expect(mixerRect.bottom, 'the panel sits above the bottom band').to.be.at.most(
                browseRect.top
              );

              cy.get('.directory-listing-card')
                .then(([directoryListing]) => directoryListing.getBoundingClientRect())
                .then((directoryListingRect) => {
                  expect(browseRect.left, 'Browse sits left of Directory Listing').to.be.lessThan(
                    directoryListingRect.left
                  );
                });
            });
        });
    });

    it('keeps every voice strip inside the SID panel without horizontal overflow at 1920 wide', () => {
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

      // The panel animates in (`animationEntry="from-bottom"`), so the assertion is wrapped in
      // `.should()` and Cypress retries it until the entry animation settles.
      cy.get('lib-sid-voice-strip').should('have.length', 6);
      cy.get('lib-sid-voice-strip').should(($strips) => {
        $strips.each((_, strip) => {
          expect(strip.scrollWidth, 'the strip does not overflow').to.be.at.most(
            strip.clientWidth + 1
          );
        });
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
              expect(browseRect.left, 'Browse and Directory Listing share the same left').to.equal(
                directoryListingRect.left
              );
              expect(browseRect.top, 'Browse sits above Directory Listing').to.be.lessThan(
                directoryListingRect.top
              );
            });
        });
    });

    STACKED_WIDTHS.forEach((width) => {
      const height = width === VIEWPORT.TABLET.width ? VIEWPORT.TABLET.height : 900;

      it(`stacks deck A, then the SID panel, then deck B at ${width}px wide`, () => {
        cy.viewport(width, height);

        cy.get('[aria-label="Transport deck A"]')
          .then(([transportA]) => transportA.getBoundingClientRect().top)
          .then((deckATop) => {
            cy.get('lib-dj-sid-panel')
              .then(([mixer]) => mixer.getBoundingClientRect().top)
              .then((mixerTop) => {
                expect(deckATop, 'deck A sits above the panel').to.be.lessThan(mixerTop);

                cy.get('[aria-label="Transport deck B"]')
                  .then(([transportB]) => transportB.getBoundingClientRect().top)
                  .then((deckBTop) => {
                    expect(mixerTop, 'the panel sits above deck B').to.be.lessThan(deckBTop);
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
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

      cy.get('[aria-label="Speed multiplier deck A"]').should('be.visible');
      cy.get('[aria-label="Speed up 50% deck A"]').should('be.visible');
    });

    it('fits the whole grid in the viewport at desktop width — the page itself never scrolls', () => {
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

      // Retried via `.should()`: the cards animate in (`animationEntry="from-bottom"`), so a single
      // unretried read can catch a mid-animation height.
      cy.get('.mixer-grid').should(([grid]) => {
        const page = grid.ownerDocument.documentElement;
        expect(page.scrollHeight, 'the page itself does not scroll').to.be.at.most(
          page.clientHeight
        );
      });
    });

    it('shows the SID panel with both decks, and no crossfader', () => {
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);

      cy.get('lib-dj-sid-panel').should('have.length', 1);
      cy.get('lib-dj-sid-panel [data-deck]').should('have.length', 2);
      cy.get('[aria-label]')
        .filter((_, el) => /crossfader/i.test(el.getAttribute('aria-label') ?? ''))
        .should('have.length', 0);
    });

    describe('the Key match light', () => {
      KEY_MATCH_WIDTHS.forEach((width) => {
        const height = width === VIEWPORT.TABLET.width ? VIEWPORT.TABLET.height : 1080;

        it(`sits centred between the two Key sections at ${width}px wide`, () => {
          cy.viewport(width, height);

          // Retried via `.should()`: the panel animates in, so a single read can catch it mid-scale.
          cy.get('lib-dj-sid-panel .lower-key').should('have.length', 2);
          cy.get('lib-dj-sid-panel lib-key-match-light').should('have.length', 1);
          cy.get('lib-dj-sid-panel').should(([panel]) => {
            const [keyA, keyB] = Array.from(panel.querySelectorAll('.lower-key')).map((el) =>
              el.getBoundingClientRect()
            );
            const light = panel.querySelector('lib-key-match-light')!.getBoundingClientRect();

            const gapMiddle = (keyA.right + keyB.left) / 2;
            const keysMiddle = (keyA.top + keyA.height / 2 + keyB.top + keyB.height / 2) / 2;
            expect(
              Math.abs(light.left + light.width / 2 - gapMiddle),
              'horizontal offset from the midpoint between the Key sections'
            ).to.be.at.most(1);
            expect(
              Math.abs(light.top + light.height / 2 - keysMiddle),
              'vertical offset from the Key sections'
            ).to.be.at.most(1);
          });
        });
      });
    });

    describe('transport layout by its own width', () => {
      // The transport answers to the width of its container, not the viewport's, so the width is
      // forced on the host of deck A's transport.
      const LAYOUTS = [
        { width: 440, rows: 1, labelledKeys: true, frameShown: true },
        { width: 360, rows: 1, labelledKeys: false, frameShown: true },
        { width: 300, rows: 2, labelledKeys: false, frameShown: false },
      ] as const;

      LAYOUTS.forEach(({ width, rows, labelledKeys, frameShown }) => {
        it(`lays the keys out in ${rows} row(s) at ${width}px`, () => {
          cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);
          cy.get('lib-deck-transport')
            .first()
            .then(($transport) => {
              $transport[0].style.width = `${width}px`;
            });

          cy.get('lib-deck-transport')
            .first()
            .find('.keys lib-synth-key')
            .should(($keys) => {
              const tops = new Set(
                $keys.toArray().map((key) => Math.round(key.getBoundingClientRect().top))
              );
              expect(tops.size, 'distinct key rows').to.equal(rows);
            });
          cy.get('lib-deck-transport')
            .first()
            .find('.stop-key .text')
            .should(labelledKeys ? 'be.visible' : 'not.be.visible');
          cy.get('lib-deck-transport')
            .first()
            .find('.frame')
            .should(frameShown ? 'be.visible' : 'not.be.visible');
        });
      });
    });
  });

  describe('one device still renders two decks', () => {
    beforeEach(() => {
      interceptDjLibrary();
      interceptFindDevices(); // default fixture: singleDevice
      interceptConnectDevice();
      cy.visit(APP_ROUTES.djMixer);
      cy.viewport(SID_PANEL_VIEWPORT.width, SID_PANEL_VIEWPORT.height);
    });

    it('renders both decks on the one SID panel — the decks are a fixed pair, not one per device', () => {
      cy.get('lib-dj-sid-panel [data-deck]').should('have.length', 2);
      cy.get('lib-sid-voice-strip').should('have.length', 6);
    });

    NO_OVERFLOW_WIDTHS.forEach((width) => {
      it(`does not overflow horizontally at ${width}px wide`, () => {
        cy.viewport(width, 900);
        expectNoHorizontalOverflow();
      });
    });
  });

  describe('three devices still render two decks', () => {
    beforeEach(() => {
      interceptDjLibrary();
      interceptFindDevices({ fixture: multipleDevices });
      interceptConnectDevice();
      cy.visit(APP_ROUTES.djMixer);
    });

    it('renders no deck C — the decks are a fixed pair, not one per device', () => {
      cy.viewport(1600, 900);

      cy.get('[aria-label="Transport deck C"]').should('not.exist');
    });

    NO_OVERFLOW_WIDTHS.forEach((width) => {
      it(`does not overflow horizontally at ${width}px wide`, () => {
        cy.viewport(width, 900);
        expectNoHorizontalOverflow();
      });
    });
  });
});
