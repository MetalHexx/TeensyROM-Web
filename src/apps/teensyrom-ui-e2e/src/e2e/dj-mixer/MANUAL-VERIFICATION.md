# Manual browser verification — DJ Mixer layout vs this amendment's description

The phase's own exit criteria require the four layout states (two devices, one device, zero
devices, stacked) to be checked in a real browser, alongside the automated proof in
`dj-mixer-navigation.cy.ts` / `dj-mixer-responsive.cy.ts`. This file is that record.

This amendment (`P03`) introduces a shared bottom band — a `Browse` placeholder beside a
`Directory Listing` placeholder — and flips the mixer's own content to sit at the top of its card
rather than the bottom. `ASID-DJ-ROOT-WIREFRAME-MIXER-VIEW.html` predates this change and is not
being redrawn, so the band, the Browse placeholder, and the mixer's alignment are checked below
against this amendment's description instead; everything else in each state (the deck stacks' own
content, the voice/speed columns, the zero-device empty state) is still the same shape the
wireframe shows and isn't re-verified here.

Checked against `pnpm nx serve teensyrom-ui` at `http://localhost:4200/dj-mixer` in a real Chrome
tab, driving device count through the live `DeviceStore`
(`ng.getComponent(document.querySelector('lib-layout')).deviceStore`), with `window.fetch` patched
to return a fixture `FindDevicesResponse` for the app's `/api/devices` call rather than letting it
reach a real backend or any actually-attached device.

- **Two devices** — `store.findDevices()` resolved after patching `window.fetch` to return a
  two-device fixture. Result: deck A's transport, controls and Voice/Speed column sit at the left,
  deck B's mirror sits at the right, the crossfader (`A ... B`) sits between them; the mixer's own
  content (Voice/Speed panels, crossfader) is pinned to the **top** of its card rather than
  centered or bottom-aligned — matching this amendment's flip. Below all of that, a single row
  holds the `Browse` placeholder card on the left and the `Directory Listing` placeholder card on
  the right, spanning the full width beneath both decks and the mixer. No deviation. Everything
  else (deck transport, Loops/Cues, output port controls) matches the wireframe's two-device frame
  unchanged.
- **One device** — the fixture reduced to the single device from the state above. Result: deck A's
  full column and its Voice/Speed panel render alone, no crossfader; the same shared bottom band
  (`Browse` beside `Directory Listing`) still renders beneath it, full width. No deviation.
  Everything else matches the wireframe's one-device frame unchanged.
- **Zero devices** — the one device from above disabled via `DeviceStore.disableDevice()`. Result:
  `lib-empty-state-message` renders "No Enabled Devices / Enable a TeensyROM device to get
  started. / Visit the Device View to manage your devices." verbatim — the bottom band doesn't
  render in this state, matching `@if (decks().length === 0)` gating the whole grid (including the
  band) behind the empty-state branch. Matches the wireframe's empty-state frame. No deviation.
- **Stacked** (below 1280px, or three-plus decks) — the browser-automation sandbox's own window is
  locked to a fixed CSS-px viewport (`resize_window` never changes `window.innerWidth`/
  `innerHeight`), so this state can't be reached by resizing the top-level tab. It is reachable,
  and was actually checked, by loading `/dj-mixer` inside a same-origin `<iframe>` sized to a CSS
  width of 768px (`VIEWPORT.TABLET`): the iframe's own `document.defaultView.innerWidth` is
  genuinely 768, so the app's real `below-tablet` media query fires and the live cascade is what's
  being read, not an assertion inferred from Cypress. Two devices were put in front of the app the
  same way as the "Two devices" state above (patching `window.fetch` inside the iframe's own
  `window`). Result: reading `getBoundingClientRect()` on the live DOM inside the iframe gives
  `Transport deck A` top 155.5px, `lib-dj-mixer-card` top 510.8px, `Transport deck B` top
  1218.7px — the single-column order the wireframe's stacked frame calls out (deck A with its
  voice/speed beside it, the mixer as a band, then deck B); the bottom band still renders as a row
  at this width (`Browse` top 1574px/left 112px, `Directory Listing` top 1574px/left 432.8px —
  same top, different left), since the band's own column-stack only triggers below phone width, not
  below tablet width. Narrowing the same iframe to 400px CSS width (the `below-phone` breakpoint)
  confirmed the band does stack there: `Browse` and `Directory Listing` share the same `left`
  (16px) and `Browse`'s `top` (999.4px) sits above `Directory Listing`'s `top` (1011.4px).
  `.router-content`'s `scrollWidth` matched its `clientWidth` at 768px (no horizontal overflow).
  Screenshots scrolled through the same iframe confirm it visually: deck A's transport and Voice
  column, then the crossfader band labelled A/B with the Voice/Speed panels immediately above it
  (not centered in the card), then deck B's transport, then the `Browse`/`Directory Listing` row,
  each full-width and unclipped. Matches the wireframe's stacked frame for the deck/mixer ordering;
  the band and mixer alignment are checked against this amendment's description as noted above. No
  deviation.

Device state was left at zero-enabled (matching a clean starting point) after the checks above.
The dev server started for this session was stopped afterward and never touched the real backend
or any committed configuration.

## Byte fidelity (P03-T02)

Not run. This task (`P03-T02`, wiring the drag/drop-to-alert path) requires a real TeensyROM
cartridge attached over serial to retrieve an actual `.sid` file's bytes and produce a real
SHA-256 in the alert. No cartridge was attached in this execution environment, so the drop →
retrieve → alert path, the byte count, and the hash were never exercised end to end here — this
check, and the companion real-browser check for the drag chip showing the correct row's name
(called out in the task as not skippable), are left for an operator with a device attached. No
hash is recorded here; none was fabricated.

To perform this check once a cartridge is available: `pnpm nx serve teensyrom-ui`, drag a known
`.sid` file from the DJ mixer's listing onto a deck's transport, copy the hash out of the resulting
alert, then hash the same file on the desktop (`Get-FileHash -Algorithm SHA256 <file>` on Windows,
or `sha256sum <file>` on macOS/Linux) and confirm the two hex strings match.
