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

## Key-notation switch placement (final corrective)

The one shared Camelot | Note switch sits between the Key-knob row and the fader row, centred across
both decks, and nothing remains below the crossfader. It is drawn from the first strip's
`.key-notation-slot` across both strips; every strip reserves a same-height slot so the Key knobs and
the faders stay level between decks. The heights in the sections above predate the switch, the
Key readout and the voice/speed wiring and are historical — the figures here are current. Driven the
same way as above (a same-origin `<iframe>` at the target CSS size on `http://localhost:4200/dj-mixer`,
`getBoundingClientRect()` on the live DOM, the entry animation's transform pinned off), compared with
the same card before the switch moved (the switch last in `.mixer-body`):

| width (CSS px) | form | `lib-dj-mixer-card` height, before → after | switch (w × h) | gap above / below the switch |
| --- | --- | --- | --- | --- |
| 1804 × 663 | column | 644.4 → **638.6** (−5.8) | 148 × 24 | 8 / 8 |
| 1804 × 820 | column, card stretched by the deck row | 651.4 → **651.4** (0) | 148 × 24 | 14.4 / 14.4 |
| 768 × 1024 | band, stacked page | 512.6 → **544.6** (+32.0) | 168.8 × 24 | 8 / 8 |
| 400 × 900 | band, wrapped | 550.4 → **544.6** (−5.8) | 168.8 × 24 | 8 / 8 |

- At every width the switch's horizontal centre is the centre of the two strips (offset 0.0), it
  reaches both strips' outer edges (it is exactly as wide as the two strips and their gap), it sits
  below both Key knobs and above both faders and the crossfader, no label clips, and nothing
  overflows horizontally. The crossfader is the last element in the card (12px of card padding
  below it in the column form).
- Where the deck row sets the card's height (1804 × 820) the leftover height is split evenly above
  and below the switch; at 1804 × 663 there is none.
- **The band form at 768px grows by 32px** (24 for the switch row plus one 8px strip gap). In that
  form the switch used to share the crossfader's line at no cost, and the card is now as tall as a
  strip that holds one more row. It is a stacked, scrolling page with no height budget; the column
  form, which has one, does not grow.
- `dj-mixer-controls.cy.ts` asserts this geometry at the column, band and stacked widths and clicks
  both halves of the switch, which proves the half drawn over the second strip is not covered.

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

## Hardware acceptance (P04-T02)

Not run. This task wires the DJ Mixer's deck columns to `DeckService`/`DjStore` — the load,
transport, and MIDI binding path — which the automated Cypress specs exercise against fixture
devices only (`dj-mixer-decks.cy.ts`, `dj-mixer-responsive.cy.ts`). The checklist below requires a
real TeensyROM cartridge connected over serial and was not exercised end to end in this execution
environment; no result is recorded here, only what an operator with a device attached still needs
to confirm, per the task's own acceptance criteria:

- `pnpm nx serve teensyrom-ui`, connect a device, and drag a `.sid` file from the listing onto
  deck A: the transport's status LED shows **Analyzing…** and then **Playing** — or, on a failed
  read, **failed** with a reason on the LED and no DJ-raised alert (a device-read failure still
  carries the `-3` file service's own alert; that alert is expected and accepted, not a DJ Mixer
  regression).
- Dragging the same file onto deck A again shows no new network request in DevTools' Network tab
  and goes straight to **Playing**, skipping both the Loading and Analyzing phases — the tune is
  already resolved from the prior drop, so nothing new is fetched or scanned.
- After a page refresh, deck A's Output port select comes back either bound to its prior selection
  or showing the "last saw" placeholder for a port not currently present — never reset to the
  unbound placeholder while a binding is on record.
- With deck A already bound to a MIDI output port, that same port appears disabled and marked
  "taken by Deck A" in deck B's own binding card select.

## Permission auto-connect on reload (P05-T04)

Not run. This task makes `DeckBindings.hydrate` query the origin's standing Web MIDI permission
and request access on its own when already granted, so a reload comes up bound with no click, and
hides each deck's Enable MIDI button while access is granted. Cypress cannot carry a real,
persisted Web MIDI permission grant across a page reload (`dj-mixer-decks.cy.ts` runs with no
grant, by design, and asserts the button is present in that state), so the granted-origin path
needs a real browser to confirm:

- `pnpm nx serve teensyrom-ui`, open `/dj-mixer`, click a deck's Enable MIDI button and grant the
  browser's SysEx permission prompt. Both decks' Enable MIDI buttons disappear once granted.
- Reload the page. Both decks come up with their prior selection bound (or the "last saw"
  placeholder for a port not currently present) with no click — Enable MIDI stays hidden on the
  granted origin.
- In the browser's site settings, revoke the MIDI permission for the origin, then reload. Enable
  MIDI is showing again on both decks, and no alert was raised for a merely-not-yet-granted
  origin.

## Filter sweep layout (ASID-DJ-6)

Checked at `http://localhost:4201/dj-mixer` (this worktree's `teensyrom-ui` dev server) in a real
Chrome tab, driven the same way as "How this was driven" above: a same-origin `<iframe>` at the
target CSS size, the device count set through the live `DeviceStore` with the iframe's `fetch`
patched to return fixture devices, and every number read with `getBoundingClientRect()`. The entry
animation's transform was pinned off first. The filter-mode selector is gone from the strip, so the
strip has no selector row at any width. No layout defect was found, so the mixer card's stylesheet
was not changed in this task.

| state | viewport (CSS px) | devices | card height | strip (top → bottom) | key switch | crossfader | page scroll |
| --- | --- | --- | --- | --- | --- | --- | --- |
| column | 1804 × 663 | 2 | 580.0 (66 → 646) | 528.0 (78 → 606) | 148 × 24, 396 → 420 | 148 × 16, 618 → 634, centred on the switch | 663 = 663 |
| band | 768 × 1024 | 2 | 486.0 | 470.0 (697 → 1167) | 168.8 × 24, 1015 → 1039 | 432.8 × 16, 1151 → 1167, right of the strips | 1024 = 1024 |
| stacked (wrapped) | 400 × 900 | 2 | 486.0 | 470.0 (647 → 1117) | 168.8 × 24, 965 → 989 | 160.8 × 16, 1101 → 1117, right of the strips | 900 = 900 |

- In every state the strip reads top to bottom: the four knobs (Cutoff, Resonance, Pulse width,
  Key), then the Camelot | Note switch, then the fader. Each gap between knob, switch and fader is
  8 px. Nothing overlaps.
- Column: the switch and crossfader share the same horizontal span (876 → 1024), so the crossfader
  is aligned as before. The card keeps its 12 px bottom padding under the crossfader.
- Column: `.router-content` reports `scrollHeight` 632 against `clientHeight` 613. The extra 19 px is
  the zero-height bottom band's row gap, and it sits below the card's bottom edge (646) inside the
  663 px viewport, so no visible content is clipped. The bottom band (Browse and the listing) stays
  at 0 px at this viewport. This is the same squeeze recorded in the 1804 × 663 section above and is
  not caused by the card's height. The fix would sit in the view's grid, outside this task's file
  scope, so it is recorded here and reported for phase review rather than changed.
- Band and stacked: `.router-content` scrolls by design (2012 against 974 at 768 wide, 2141 against
  836 at 400 wide). Neither page scrolls on its own, and neither overflows horizontally.
- Three devices at 1804 × 663 could not be measured. The mixer view in this build has two deck
  slots (`DECK_SLOTS` in `dj-mixer-view.component.ts`) and no `dj-mixer-view--many` form, so a third
  device is enabled but gets no deck. The three-device stacked check described above in
  "Three devices at 1804 × 663 (the permanently-stacked form)" does not apply to the current build
  and is not claimed here.

## Filter sweep listening session (operator, real hardware)

Run these four checks on your C64s with a real TeensyROM. Nothing here was run in the sandbox,
because sound is judged on hardware.

1. On a tune that never uses the filter, turning cutoff audibly changes the sound, and centre plays
   the tune exactly as before. On a tune that uses the filter, its own filtering returns the moment
   the knob is back at centre.
2. Resonance is audible while sweeping, on any tune.
3. Give a verdict on the sweep's feel, including whether passing through centre sounds smooth and
   whether anything needs retuning.
4. Turn the knob out of centre, back into it, and across from one side to the other. Each time the
   filter switches, the deck's volume fades out to silence, the switches change on a silent frame,
   and the volume fades back in (`FILTER_SWEEP.dip` sets the number of frames each way). Say
   whether the click is still audible, a gap is audible, or nothing is. If the click is still
   there, lengthen the fades; if a gap is audible, shorten them.

The verdict is recorded in the ASID-DJ portfolio's Decisions. The values to retune live in
`FILTER_SWEEP` and `RESONANCE_SWEEP` in `libs/application/src/lib/dj/mixer/filter-sweep.ts`. The
sweep is tuned for a 6581 (`FILTER_SWEEP.chip`) until a settings page lets the user pick their chip.

Resonance knob at rest, checked in the live card and in Storybook (`pnpm nx storybook ui-components`,
story `DJ/Rotary Knob / RestingAtMinimum`): the live knobs read min 0, max 1 and value 0, the
pointer ends lower-left, and there is no ring and no top tick. In Storybook the "Turned" knob at
0.6 draws its ring from the lower-left start clockwise up to the pointer.
