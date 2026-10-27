/// <reference types="cypress" />

/** Clears the DJ bindings database before each test so a port bound by one spec never leaks its
 *  selection into the next — bindings persist across page loads by design. */
export function clearDjBindingsDatabase(): void {
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
export function stubNoMidiGrant(win: Cypress.AUTWindow): void {
  if (!win.navigator.permissions) {
    return;
  }
  cy.stub(win.navigator.permissions, 'query')
    .withArgs(Cypress.sinon.match({ name: 'midi' }))
    .resolves({ state: 'prompt' } as PermissionStatus);
}
