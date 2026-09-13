import type { MockDeviceFixture } from '../../support/test-data/fixtures/fixture.types';
import { generateDevice } from '../../support/test-data/generators/device.generators';
import { generateFileItem } from '../../support/test-data/generators/storage.generators';
import { interceptFindDevices } from '../../support/interceptors/findDevices.interceptors';
import { interceptConnectDevice } from '../../support/interceptors/connectDevice.interceptors';
import {
  interceptGetDirectory,
  setupGetDirectoryWithFiles,
  waitForGetDirectory,
} from '../../support/interceptors/getDirectory.interceptors';

// There is no two-device fixture in the suite (`singleDevice` has one, `multipleDevices` three —
// see `dj-mixer-responsive.cy.ts`). Devices map in with `isEnabled: true` and both storages
// available by default.
const twoDevices: MockDeviceFixture = { devices: [generateDevice(), generateDevice()] };

describe('DJ Mixer — Browse', () => {
  beforeEach(() => {
    interceptFindDevices({ fixture: twoDevices });
    interceptConnectDevice();
  });

  it('shows one browse tree per enabled device and seeds every available storage on mount', () => {
    interceptGetDirectory();
    cy.visit('/dj-mixer');

    cy.get('lib-browse-tree').should('have.length', 2);

    // Each of the two devices seeds both its SD and USB storage on mount: four requests total.
    for (let i = 0; i < 4; i++) {
      waitForGetDirectory();
    }
  });

  it("shows the first device's first available storage in the listing by default", () => {
    const files = [generateFileItem({ name: 'song.sid', path: '/song.sid' })];
    setupGetDirectoryWithFiles(files);
    cy.visit('/dj-mixer');

    cy.get('.breadcrumb-chips .breadcrumb-chip').first().should('contain.text', 'SD Card');
    cy.get('[data-item-path="/song.sid"]').should('exist');
  });

  it("switches the listing to the second device's USB storage on leaf click, naming it in the trail and issuing no new request", () => {
    const files = [generateFileItem({ name: 'song.sid', path: '/song.sid' })];
    setupGetDirectoryWithFiles(files);
    cy.visit('/dj-mixer');

    // The first device's SD storage (the default) is already loaded before the leaf click.
    cy.get('[data-item-path="/song.sid"]').should('exist');

    cy.get('lib-browse-tree').eq(1).contains('USB Storage').click();

    cy.get('.breadcrumb-chips .breadcrumb-chip').first().should('contain.text', 'USB Drive');
    cy.get('[data-item-path="/song.sid"]').should('exist');
  });
});
