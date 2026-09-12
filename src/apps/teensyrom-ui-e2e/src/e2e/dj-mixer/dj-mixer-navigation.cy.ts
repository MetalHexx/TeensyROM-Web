import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { interceptConnectDevice } from '../../support/interceptors/connectDevice.interceptors';

describe('DJ Mixer — Navigation', () => {
  beforeEach(() => {
    interceptFindDevices();
    interceptConnectDevice();
    cy.visit('/devices');
    cy.get('[mat-dialog-title]', { timeout: 10000 }).should('not.exist');
  });

  it('navigates to the mixing route from the left nav and lands on the DJ Mixer view', () => {
    // The bottom bar's phone nav renders the same `aria-label` on its own button, hidden by CSS
    // but still present in the DOM at desktop width — scope to the visible nav-rail item.
    cy.get('.nav-rail-item[aria-label="DJ Mixer"]').click();

    cy.url().should('include', '/dj-mixer');
    cy.get('.dj-mixer-view').should('exist');
  });

  it('orders the DJ Mixer item directly after Player', () => {
    cy.get('.item-label').then(($labels) => {
      const names = [...$labels].map((el) => el.textContent?.trim());
      const playerIndex = names.indexOf('Player');

      expect(playerIndex, 'Player is present in the nav').to.be.greaterThan(-1);
      expect(names[playerIndex + 1]).to.equal('DJ Mixer');
    });
  });
});
