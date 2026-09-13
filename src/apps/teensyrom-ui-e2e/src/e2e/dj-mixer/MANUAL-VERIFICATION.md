# Manual browser verification — DJ Mixer layout vs `ASID-DJ-3-WIREFRAME-DJ-MIXER.html`

The phase's exit criteria require the layout states to be checked in a real browser alongside the
automated proof in `dj-mixer-navigation.cy.ts` / `dj-mixer-responsive.cy.ts`. This file is that
record. It replaces the previous amendment's layout section; the "Byte fidelity (P03-T02)" section
below it is a separate record and is unchanged.

## How this was driven

`pnpm nx serve teensyrom-ui` at `http://localhost:4200/dj-mixer` in a real Chrome tab. The
automation window cannot be resized to a target CSS viewport (`resize_window` never changes
`window.innerWidth`/`innerHeight`), so each state was loaded into a same-origin `<iframe>` sized to
the target CSS width and height — the iframe's own `document.defaultView.innerWidth` really is the
target, so the app's real media queries fire and the live cascade is what is being read.

Browser page zoom is equivalent to a larger CSS viewport at the same CSS sizes, so **100 % at
1804 × 663** is the iframe at 1804 × 663, and **80 %** is the same frame at 1804 / 0.8 × 663 / 0.8 =
**2255 × 829**, drawn back to the physical 1804 × 663 with a `transform: scale(0.8)` on the iframe's
wrapper. Device count was driven through the live `DeviceStore`
(`ng.getComponent(document.querySelector('lib-dj-mixer-view')).deviceStore.findDevices()`) with the
iframe's own `window.fetch` patched to return a fixture `FindDevicesResponse` and fixture
`GetDirectoryResponse`s, rather than reaching a real backend or an attached device. Every number
below is `getBoundingClientRect()` on the live DOM — nothing here was eyeballed. The cards'
entry animation (`animationEntry="from-bottom"`) is a `scale(0.8)` transform that skews a rect read
mid-flight, so a stylesheet pinning `lib-scaling-container { transform: none }` was injected before
measuring; it changes no layout, only the visual transform.

## Two devices at 1804 × 663 / 100 % (wireframe frame 1)

Shell: `.router-content` is 613px tall below the 50px header band; the view's grid gets 581px of
that.

| element | height (CSS px) |
| --- | --- |
| deck row (`.deck-stack`, `.voice-speed-column`, `lib-dj-mixer-card` — all one grid row) | 611.9 |
| `lib-dj-mixer-card` (its own content height, the number driving the row) | **611.9** |
| `.transport-slot` | 121.3 |
| `.loops-card` | 401.4 |
| `.binding-card-slot` | 65.3 |
| `.voice-card` | 324.9 |
| `.speed-card` | 275.0 |
| `.bottom-band` / `.browse-card` / `.directory-listing-card` | **0** |

- Each deck renders as one stack — transport, Loops/Cues filling the middle, the one-line binding
  card (`Deck A`, `Output port` + select, `Enable MIDI`, `Identify`) at the bottom — with its own
  Voice/Speed column beside it, and the mixer between the two decks. Deck A's stack and deck B's
  share the same top (66) and the same width (640.1); their Voice and Speed cards share tops.
- Each deck strip's `input[type=range]` is **148.0px tall** and the crossfader's `input[type=range]`
  is **148.0px wide** — equal to the pixel, and equal to the wireframe's `.cfader`/`.xfader`. The
  mixer column is 172px wide, as drawn.
- `.browse-card` is 300px wide, matching the wireframe.
- `document.scrollingElement.scrollHeight === clientHeight` (663 = 663): the page itself does not
  scroll and there is no page scrollbar.
- **Deviation (the height budget).** The task targets **≤ 556px** for the medium mixer card so the
  band keeps its trail visible. The measured card is **611.9px**, 55.9px over, so the flexing
  `bottom` row is squeezed to **0px** and `.router-content` clips 51px (`scrollHeight` 664 vs
  `clientHeight` 613, `overflow-y: hidden`): at this viewport the browse card and the listing are
  not visible at all, and Speed's fader (92px) ends up shorter than its jump-button group (104px).
  All four prescribed tunables were applied first, in order, and are included in the 611.9:
  - deck strip internal gap `--spacing-md` → `--spacing-sm` at `medium`: −20.0 (567.9 → 547.9 strip)
  - knob caption 0.75rem → 0.7rem with a 2px dial gap at `medium`: −3.2 per knob, −12.8 over four
  - crossfader label row 0.7rem in fixed-track mode: −4.2 (45.0 → 40.8 crossfader)
  - medium filter-selector option height 24px: already pinned, 49.9px selector, no change available

  The card cannot go lower without breaking one of the task's own "never" rules. Its floor is:
  24 (card padding) + 535.1 (strip: 49.9 filter selector + 4 × 66.8 knobs + 178.0 fader block +
  5 × 8 gaps) + 12 (body gap) + 40.8 (crossfader: 16.8 labels + 8 gap + 16 track) = **611.9**. The
  two dominant terms are the 148px fader ("never shorten the fader — it is tied to the crossfader")
  and the four 48px dials ("never change the 48px dial"), which together are 340 of the 611.9.
  The task's own estimate of 580px for the untuned card is 68.9px short of the built one, and that
  difference is three rows the wireframe does not draw: the channel fader's own `A`/`B` caption
  (18 + 8 gap), the crossfader's label row above its track (16.8 + 8 gap, against the wireframe's
  6px margin), and the taller filter-mode selector (49.9 against the wireframe's 37). Reaching
  556px means removing or shrinking those visible labels, which is a UI decision this task does not
  authorise. Recorded here with the numbers rather than accepting a silently clipped band.

  The single-device form clears the bar: without a crossfader the same card is **559.1px** and the
  band gets 9.9px (`.router-content` `scrollHeight` 613 = `clientHeight` 613, no clipping).

## Two devices at 80 % — wireframe frame 2, mid-drag (2255 × 829 CSS)

| element | 100 % | 80 % |
| --- | --- | --- |
| `lib-dj-mixer-card` / deck row | 611.9 | 650.2 |
| `.transport-slot` | 121.3 | 121.3 |
| `.binding-card-slot` | 65.3 | 65.3 |
| `.voice-card` | 324.9 | 324.9 |
| `.loops-card` | 401.4 | 439.6 |
| `.speed-card` | 275.0 | 313.3 |
| `.browse-card` / `.directory-listing-card` | 0 | 84.6 |
| channel fader / crossfader track | 148 / 148 | 148 / 148 |

- `.router-content` `scrollHeight` 779 = `clientHeight` 779 and the page is 829 = 829: nothing
  scrolls or clips at 80 %, and the listing's trail (40px) is visible.
- The transport, binding and voice cards are unchanged in CSS px between the two zoom levels, and
  the fader travels are unchanged, so zooming out buys the band its height back. The three cards
  that do change — Loops/Cues, Speed and the listing — all change because they are the cards that
  take up slack; at 100 % they are being squeezed by the shortfall above rather than sitting at
  their own content. **Deviation:** the task expects only the listing to change between the two
  zoom levels; Loops/Cues (+38.2) and Speed (+38.3) change too, and the deck row grows rather than
  shrinks, all as a consequence of the 100 % state being over-height.
- Mid-drag (the view's `dragging` signal set, as a listing drag does) draws exactly two
  `.drop-overlay`s, each at `[112, 66, 865, 121]` and `[1373, 66, 865, 121]` — identical to its own
  `.transport-slot` rect, so P03-T02's overlay still lands on the transport and nowhere else. No
  drop was performed, so no alert was raised.

## One device at 1804 × 663 / 100 %

`mixer-grid--one`, `grid-template-areas: "d0 vs0 mx" "bottom bottom bottom"`, columns
`1392.16px 88px 172px`, rows `559.12px 9.92px`. One deck strip, no crossfader. `.router-content`
`scrollHeight` 613 = `clientHeight` 613 and `scrollWidth` 1676 = `clientWidth` 1676 — neither axis
overflows.

## Stacked — two devices at 768px (below tablet)

`grid-template-areas: "d0 vs0" "mx mx" "d1 vs1" "bottom bottom"`, rows
`614.2px 493.12px 614.2px 256px`. Order top to bottom: deck A's stack (66), the mixer band (688.2),
deck B's stack (1189.3), the bottom band (1811.5) — the single-column order the wireframe's stacked
frame calls out. `.loops-card` 395.6, `.speed-card` 297.3, `.voice-card` 308.9, `.transport-slot`
145.3, `.binding-card-slot` 57.3: every card is at its own content height, nothing collapses.
`.router-content` scrolls (`scrollHeight` 2018 vs `clientHeight` 974) and does not overflow
horizontally (`scrollWidth` 632 = `clientWidth` 632).

At 400px (below phone) the band stacks: `.browse-card` and `.directory-listing-card` share
`left: 16` with Browse (top 1794.5) above the listing (top 1978.5), and the browse card drops its
300px basis so it is 359.7 wide rather than 300 tall. No horizontal overflow (392 = 392).

## Three devices at 1804 × 663 (the permanently-stacked form)

The host carries `dj-mixer-view--many` and brings its own scroll (`scrollHeight` 2884 vs
`clientHeight` 581, `overflow-y: auto`), so deck C stays reachable. The component's inline
`grid-template-areas` is `"d0 vs0" "mx mx" "d1 vs1" "d2 vs2" "bottom bottom"` — one stack row per
deck beside that deck's own voice/speed column, the mixer band straight after the first deck, the
bottom band last. All three decks' Loops/Cues (439.6) and Speed (313.3) cards are at content
height. `.router-content` overflows on neither axis.

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
