# Manual browser verification — DJ Mixer layout vs wireframe

The phase's own exit criteria require the four layout states (two devices, one device, zero
devices, stacked) to be checked in a real browser against
`~/.radorc/projects/ASID-DJ-ROOT/ASID-DJ-ROOT-WIREFRAME-MIXER-VIEW.html`, alongside the automated
proof in `dj-mixer-navigation.cy.ts` / `dj-mixer-responsive.cy.ts`. This file is that record.

Checked against `pnpm nx serve teensyrom-ui` at `http://localhost:4210/mixing` in a real Chrome
tab, driving device count through the live `DeviceStore`
(`ng.getComponent(document.querySelector('lib-layout')).deviceStore`) rather than Cypress
interceptors, since a real device happened to be attached in this environment.

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
- **Stacked** (below 1280px, or three-plus decks) — not reachable as a live resize in this
  environment: the browser-automation sandbox's window is locked to a fixed ~1546×568 CSS-px
  viewport, reproduced across two separate verification sessions (`resize_window` calls down to
  800×900 never change `window.innerWidth`/`innerHeight`). Per this phase's own accepted
  substitution, this state is instead proven by `dj-mixer-responsive.cy.ts`'s exact-width
  assertions at 1279px and `VIEWPORT.TABLET` (768px), which assert the same top-ordering
  (transport A → mixer → transport B) the wireframe's stacked frame shows.

The device store was restored to its real single-device state after the two-device check.
