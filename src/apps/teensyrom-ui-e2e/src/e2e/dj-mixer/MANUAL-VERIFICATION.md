# Manual browser verification — DJ Mixer layout vs wireframe

The phase's own exit criteria require the four layout states (two devices, one device, zero
devices, stacked) to be checked in a real browser against
`~/.radorc/projects/ASID-DJ-ROOT/ASID-DJ-ROOT-WIREFRAME-MIXER-VIEW.html`, alongside the automated
proof in `dj-mixer-navigation.cy.ts` / `dj-mixer-responsive.cy.ts`. This file is that record.

Checked against `pnpm nx serve teensyrom-ui` at `http://localhost:4210/mixing` in a real Chrome
tab, driving device count through the live `DeviceStore`
(`ng.getComponent(document.querySelector('lib-layout')).deviceStore`) rather than Cypress
interceptors, since a real device happened to be attached in this environment.

The **Stacked** check below was recorded in a later session against `pnpm nx serve teensyrom-ui`
at `http://localhost:4200`, with no real device attached; it drives device count by having the
app's own dev-mode API calls hit a throwaway local HTTP server instead of the live `DeviceStore`
patch used above, for the reasons given in that entry.

- **Two devices** — the attached real device plus a second injected by patching `window.fetch` so
  `DeviceStore.findDevices()` resolves a two-device `FindDevicesResponse`. Result: `.mixer-grid`
  carries `mixer-grid--two`; `[aria-label="Transport deck A"]` and
  `[aria-label="Transport deck B"]` share the same `top`; `lib-dj-mixer-card`'s `left` sits between
  them; one `lib-crossfader`, two `lib-deck-strip`s; the Voice (V1/V2/V3, audible/Kill) and Speed
  (jump buttons, filter knobs) panels render unclipped. Matches the wireframe's two-device frame.
  No deviation.
- **One device** — the attached real device alone, enabled. Result: `.mixer-grid--one`; transport,
  Loops/Cues, the deck-A stack (output port, Enable MIDI, Identify, directory listing), and the
  voice/speed column all present; one `lib-deck-strip`, zero `lib-crossfader`. Matches the
  wireframe's one-device frame. No deviation.
- **Zero devices** — the same device disabled via `DeviceStore.disableDevice()`. Result:
  `lib-empty-state-message` renders "No Enabled Devices / Enable a TeensyROM device to get
  started. / Visit the Device View to manage your devices." verbatim. Matches the wireframe's
  empty-state frame. No deviation.
- **Stacked** (below 1280px, or three-plus decks) — the browser-automation sandbox's own window is
  locked to a fixed ~1546×568 CSS-px viewport (`resize_window` calls down to 800×900 never change
  `window.innerWidth`/`innerHeight`), so this state can't be reached by resizing the top-level tab.
  It is reachable, and was actually checked, by loading `/mixing` inside a same-origin `<iframe>`
  on `http://localhost:4200` sized to a CSS width of 768px (`VIEWPORT.TABLET`): the iframe's own
  `document.defaultView.innerWidth` is genuinely 768, so the app's real `below-tablet` media query
  fires and the live cascade is what's being read, not an assertion inferred from Cypress. Two
  enabled devices were put in front of the app by pointing its dev-mode API base
  (`http://localhost:213`) at a throwaway local HTTP server returning a two-device
  `FindDevicesResponse` fixture, since no real hardware was attached in this session. Result: the
  grid carries `mixer-grid--two`; reading `getBoundingClientRect()` on the live DOM inside the
  iframe gives `Transport deck A` top 155px, `lib-dj-mixer-card` top 695px, `Transport deck B` top
  1403px — the single-column order the wireframe's stacked frame calls out ("deck A with its
  voice/speed beside it, the mixer as a band, then deck B"); `.router-content`'s `scrollWidth`
  matched its `clientWidth` (no horizontal overflow). Screenshots scrolled through the same iframe
  confirm it visually: deck A's transport and Voice column, then the crossfader band labelled A/B,
  then deck B's transport and Voice column, each full-width and unclipped. Matches the wireframe's
  stacked frame. No deviation.

The device store was restored to its real single-device state after the two-device check. The
throwaway local server used for the Stacked check was torn down afterwards and never touched the
real backend or any committed configuration.
