# Manual browser verification — the DJ view's SID panel vs `ASID-DJ-ROOT-WIREFRAME-SID-PANEL.html`

The SID panel (`lib-dj-sid-panel`) replaces the old mixer card in the DJ view. It is a 620px column
(`--mixer-col: 38.75rem`) between the two decks' Voice/Speed columns, and it is laid out for a
**1920 × 1080** viewport at minimum. The automated proof is in `dj-mixer-controls.cy.ts` and
`dj-mixer-responsive.cy.ts` (outside CI; run against a live dev server). This file records the
checks that need a real browser. The "Byte fidelity", "Hardware acceptance" and "Permission
auto-connect" sections below are separate records and are unchanged.

## How this was driven

`pnpm start` at `http://localhost:4200/dj-mixer` in a real Chrome tab. The automation window's
viewport cannot be set to a target CSS size, so the app was loaded into a same-origin `<iframe>` of
**1920 × 1080** CSS px, whose own `innerWidth`/`innerHeight` are that size, so the real media queries
and the live cascade apply. Every number below is `getBoundingClientRect()` or `scrollWidth` on the
live DOM. The cards' entry animation is a `scale(0.8)` transform that skews a rect read mid-flight,
so a stylesheet pinning `lib-scaling-container { transform: none }` was injected before measuring.
No API (port 10213) was running and no device was attached, so the page showed no devices.

## The panel at 1920 × 1080, bindings panel closed and open

| element | closed | open |
| --- | --- | --- |
| `lib-dj-sid-panel` (x, y, w × h) | 698, 66, 620 × 661.6 | 512, 66, 620 × 661.6 |
| `lib-synth-panel` faceplate (w × h) | 596 × 637.6 | — |
| each `lib-sid-voice-strip` (client / scroll width) | 90 / 90 | 90 / 90 |
| `.bottom-band` | 112, 739.6, 1792 × 324.4 | — |
| `lib-dj-bindings-panel` | — | 1544, 66, 360 × 998 |
| `.router-content` scroll / client height | 1030 / 1030 | 1030 / 1030 |

- Both decks' three voice strips, filter and Key sections, Panic buttons and deck labels render as
  frames A and B of the wireframe draw them: Deck A's lower row reads Filter then Key and deck B's
  Key then Filter, the bindings icon sits between the two labels, and the Camelot | Note switch
  sits between the two Panic buttons (136 × 24 at 940, 683; Panic A ends at 862 and Panic B starts at
  1154, either side of it).
- No voice strip overflows horizontally (client width equals scroll width on all six), and the panel
  keeps its 620px with the bindings panel open: the decks give way, not the panel.
- The page does not scroll (document 1080 = 1080) and the listing keeps a 324px band.
- Closing the bindings panel from its own close button returns focus to the bindings button.
- Camelot is no longer truncated: the switch is 8.5rem wide, and each cell's text fits (client 67 =
  scroll 67).
- **Narrow widths are a known limit.** The panel is laid out for 1920 × 1080 at minimum and keeps its
  fixed 620px column. Measured in the same iframe, a deck card is 474px at 1920, 314px at 1600,
  227px at 1400 and 167px at 1280, with no strip overflowing down to 1280 (strips 90-91px). At 400px
  the six strips overflow inside the panel (48px each), though the page itself never scrolls. The old
  stacked and one-device records were removed with the mixer card and not re-recorded; a breakpoint
  for narrow layouts is not decided.

## Live rings and lights

Needs no device. Serve the app (`pnpm nx run teensyrom-ui:serve`), serve a bundled `.sid` from a
local CORS-enabled server, stub the page's `/files/content` fetch to return it, and call
`DeckService.load('A', ...)` through the dev-mode Angular debug API (`ng.getInjector`).

- Deck A played: the voice-strip and filter-section style fingerprint took 3 distinct states across
  6 samples, while deck B's stayed constant.
- After pausing, deck A's fingerprint changed once and then held for 12 samples at 400ms (4.8s).
- A screenshot showed lit pulse waveforms, the Ring and Filt lights, LP lit, live rings and a Key
  readout of `5A`.

Recorded from the phase review's browser run. The ghost on a locked waveform was not separately
checked; the painter's unit tests cover the register-to-indicator mapping.

## The POC page still runs

`http://localhost:4200/dev/dj-poc`: loaded the bundled "InSID3 Out — Divertigo" tune on deck A, which
plays (frames advance and the status reads Playing). Moving the channel fader, crossfader, cutoff,
resonance, pulse-width and Key controls changes their values (Key's readout changed from `5A` to
`11A`), playback continues, and the console shows no errors — only the expected "no MIDI port
selected" warnings. The library refactor and the knob extension left the POC's behaviour alone.

## The restyled deck column: transport, voice and speed strip (P03-T02)

Browser check of the deck column rebuilt on the shared metal components (position strip and
transport, voice and speed channel strip, loops and binding plates) against
`ASID-DJ-ROOT-WIREFRAME-TRANSPORT.html`. Driven as above: the dev server's `/dj-mixer` in a
**1920 x 1080** same-origin `<iframe>`, no API and no device, with a bundled `.sid` served from a
local CORS server and the page's `/files/content` fetch stubbed to return it. Both decks were loaded
through `DeckService.load` (dev-mode `ng` debug API) and played for real; the output has no MIDI port
bound, so the engine drops its bytes. Held keys were driven with synthetic `keydown`/`keyup` events,
because a synthetic `pointerdown` throws in `setPointerCapture`.

**Frame A, the view at 1920 x 1080.** Matches: the display with status LED, title, author, elapsed
and total time and frame count; the position strip with its played fill, loop markers and white
playhead; Play (Pause while playing), Stop, Repeat and the subtune pager; the Loops / Cues plate
beneath; the binding plate at the foot with its Identify and Enable MIDI. A playing deck shows the
green LED and a green line under Pause; a paused one shows the amber LED and line.

**Frame B, the transport at three widths.** The deck's transport measured 474px at 1920 with the
bindings panel closed, 404px at 1780, 364px at 1700, 314px at 1600, and 288px at 1920 with the
bindings panel open. At 404px Stop and Repeat shrink to icon-only buttons and the pager to `1/1`,
as the mockup's 400px frame draws them. At 288px Play takes a row, Stop and Repeat share the next,
and the pager takes the last, as the 300px frame draws it; nothing overflows (client width equals
scroll width) and the page does not scroll.

**Frame C, the channel strip.** Matches: V1-V3 buttons with Kill beneath; a muted voice dims and its
Kill reads Punch; a held Kill is a magenta pill; the speed display; the fader with its centre
marker; the Nudge caption over the two round pads side by side, under the fader; +50% / Home / -50%.

- **Scrubbing.** Dragging the position bar with the mouse jumped deck A from 36% to 83% and kept it
  playing. Focusing the bar and pressing the right arrow five times moved the playhead forward
  (22% to 33%), and playback continued from the new position.
- **Nudge on a playing deck.** Nudge up read 1.050x and nudge down 0.950x, in magenta, with the
  fader still at 1.000. Both held read 1.000x (still magenta); releasing one left the other's
  0.950x; releasing both returned the display to white 1.000x. Moving the fader to 1.100 mid-nudge
  with nudge up held read 1.150x, kept the fader at 1.100, and the release landed on 1.100x.
- **Empty decks.** Each reads "No tune - drop a SID here"; Play, Stop and the pager are disabled;
  Repeat stays lit; the Loops / Cues plate is empty.
- **Drop highlight.** With a SID drag in flight both transports show a cyan outline and "Drop to
  load - Deck A/B" over the 474 x 151 display area; dragging over deck B's overlay marks only that
  one hot. (The drag was simulated with a `dragenter` carrying the DJ drag type: there is no device
  in this environment to list a file to pick up.)
- **Learn-mode overlays.** With mapping mode on (set on the store, because the toggle's Web MIDI
  permission prompt cannot be answered here) there are 134 overlays, 67 per deck, one on each
  control including all three voice buttons and Kill, both nudge pads, the position bar, the speed
  fader and jumps, Key, filter, and Panic, each aligned on its control. There is none for Clear.
- **The POC page.** `/dev/dj-poc` still renders its original look: the plain Position slider and
  Play/Stop row, the Voice panel with its checkboxes and Clear button, the Speed panel and the
  mixer column.

Not run here, for want of a MIDI controller: a mapped nudge note held and released, and the release
when the controller is unplugged mid-hold. The sound itself is not judged in a browser either.

### Bundle check

`pnpm nx build teensyrom-ui` on this branch against `main` (ac25dc43, the ASID-DJ-8 merge), the
initial chunks only, in bytes:

| chunk | main | this branch |
| --- | --- | --- |
| shared ui / vendor chunk | 1,354,572 | 1,394,023 |
| `main` | 419,031 | 419,031 |
| shared application chunk | 166,982 | 169,153 |
| other initial chunks and `polyfills` | 132,747 | 132,747 |
| **initial JavaScript** | **2,073,332** | **2,114,954 (+41,622)** |
| `styles` | 34,883 | 35,125 (+242) |

The styles chunk grew by the `--synth-display-*` token lines, as designed. This table is the
first measure, taken when the DJ components were still reaching the initial chunks through the
barrels: it showed the initial JavaScript 41.6 kB over `main`, which was recorded here as a failed
check. That was superseded. With the DJ-only components moved to the `@teensyrom-nx/ui/components/dj`
entry point, the check **passed**: the initial JavaScript came in 59 B under `main`. Components the
lazy route uses and the main barrel exports still land in the initial chunks (79 of the library's
components were already there on `main`); the DJ ones no longer do.

### Bench verdict (operator, real hardware)

On your C64s with a real TeensyROM, say whether:

1. Nudge beat-matches two decks by ear: hold nudge up or down on one playing deck and bring it
   back into step with the other; release lands where the fader says.
2. Scrubbing works: dragging the bar and the arrow keys move a playing tune without a glitch, and
   a drop loads a tune onto the deck it lands on.
3. The narrow transport is usable: with the bindings panel open (about 290-300px) Play, Stop,
   Repeat and the pager are all easy to hit.
4. The restyled deck plays as before: voices, Kill, speed and the pad hold behave as they did.
5. A mapped nudge note held and released, and released by unplugging the controller, ends the
   nudge.

## Loops and cues

Browser check of the deck column's Loops / Cues plate and the position strip's marks lane, now fed
from the store, against `ASID-DJ-ROOT-WIREFRAME-LOOPS.html` (frame A). Driven as in the sections
above: `pnpm start`, `/dj-mixer` in a **1920 x 1080** same-origin `<iframe>` with
`lib-scaling-container { transform: none }` injected, no API and no device. A bundled `.sid`
(`InSID3_Out.sid`) was served from a local CORS server, the iframe's `fetch` was stubbed to return it
for the `/files/content` call, and `DeckService.load('A', ...)` was reached through the dev-mode
`ng.getComponent` handle on the deck column (storage type `'SD'`). The tune loaded and played for
real; the output has no MIDI port bound. Controls were pressed with DOM clicks on the buttons found
by their accessible names; the nudge strip was driven with `input` then `change` events on its range.

**Live behaviour, deck A.** An empty deck shows a disabled Add and Stop, an empty selected row
("nothing selected" for a reader, an empty display) and "Load a tune to add loops". With the tune
playing: Add placed a cue at the playhead (then a second, and a third) and selected each; Set End on
Item 2 made it a 1.5 s loop; selecting Item 2 and pressing its trigger started it (tile and row lit
"running", the tile's lap bar advancing, `loopLapPercent` 64% mid-lap, the row reading
`00:08.5-00:10.0`); Stop loop released it (all tiles idle, Stop disabled again). The strip above the
transport showed three marks (two cue ticks and the loop bracket, the selected one highlighted).
Dragging the End nudge strip showed `+12 fr` while held (the pin) and committing moved the end to
`00:10.2` with the pin cleared. Deck B stayed empty and its plate unchanged. The console showed no
errors from the plate. The document did not scroll (1080 = 1080).

**Against frame A (1920 x 1080), measured on both pages.** Both are 474px wide. The first pass found
the plate's keys drawn at the shared key's size rather than the mockup's compact sizes, which left
the selected-row display 162px wide against the mockup's 197px and truncated "Item N"; the boundary
rows were 26px tall with 32px snap keys against the mockup's 22px squares. Fixed in P02's
components, as sizing custom properties on the shared key (`--synth-key-*`, defaults unchanged) set
by the row, the boundary, the tile and the plate header:

| element | mockup | view, after |
| --- | --- | --- |
| selected row (w x h) | 444.7 x 70.3 | 440.4 x 70.6 |
| trigger / Set End / Clear End / delete keys (w) | 32 / 68.8 / 79.5 / 26 | 32 / 69 / 79.7 / 26 |
| row display (w x h) | 197.2 x 26 | 192.1 x 26 |
| boundary snap keys / nudge strip (w) | 22 / 72.7 | 22 / 69.6 |
| tile trigger | 30 x 30 | 30 x 30 |
| Add / Stop keys (w) | 58.9 / 65.5 | 59.3 / 65.6 |
| plate (w x h) | 474 x 344 | 474 x 334 |

What remains is the synth panel's padding, which leaves the plate's content 4px narrower than the
mockup's (this moves the display, nudge strip and tiles by a few px), and the plate's height, which
here is whatever the deck column's grid slot gives (334 against the mockup's 344). The fixed row, the
two-column tile grid and the marks lane read as frame A draws them.

**Not checked in the browser here.** The queued and not-ready tile and row states: no readiness
delay or queued trigger was produced against the stubbed tune, and Storybook was not run, since the
tune loaded in the view. Deck B was not given a tune.

**Automated.** `pnpm nx test dj-mixer`, `pnpm nx lint dj-mixer`, `pnpm nx run-many -t typecheck -p
application dj-mixer`, `pnpm nx build teensyrom-ui` and the five DJ end-to-end specs
(`dj-mixer-*.cy.ts`, 43 tests, run against `serve-static` with `--excludeTaskDependencies` because
Cypress gave up waiting for the production build the dependent task starts) pass.

### Bundle check (loops and cues)

`pnpm nx build teensyrom-ui` on this branch against `main` (3899450b, after ASID-DJ-9 and
CLI-PARITY-9), the initial chunks only, in bytes (both built with the same `node_modules`):

| chunk | main | this branch |
| --- | --- | --- |
| shared ui / vendor chunk | 1,356,281 | 1,356,272 (-9) |
| `main` | 419,772 | 419,823 (+51) |
| shared application chunk | 170,554 | 185,122 (+14,568) |
| other initial chunks and `polyfills` | 132,747 | 133,096 (+349) |
| **initial JavaScript** | **2,079,354** | **2,094,313 (+14,959)** |
| `styles` | 35,125 | 35,125 (0) |

The new components add 0 B: they live in `dj.ts` and the ui chunk did not grow. The 14.6 kB is the
application layer: the loops state, `DeckLoops`, the loops selectors and the marker commands on
`DeckService`, which the lazy DJ route's store pulls into the shared application chunk (the same
effect the ASID-DJ-8 table describes). The initial JavaScript is over the 2.00 MB budget by 129 kB
here against 114 kB on `main`; that warning is already on `main` and `project.json`'s budgets are
unchanged.

### Bench checklist (operator, real hardware)

- [ ] Loops and cues are placed, triggered and left on both decks, from the mouse and from the
  controller.
- [ ] A loop is added and its end set mid-set from the controller, then corrected with snap.
- [ ] A long tune reloaded has its loops ready within about a second.
- [ ] The speed controls work inside a loop, and the speed is kept on leaving it.
- [ ] The other deck's timing is unaffected while one deck loads or rebuilds.

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

## Action and Trigger in the bindings panel (P05-T03)

Bench check for an operator with a MIDI controller. Open the bindings panel, turn on mapping mode and
map keys as below; expand a row to see its Action and Trigger choices, and read the collapsed chip
(for example `Turn off · Note Off`).

1. Map a note to Voice 1 mute and set it to Toggle with Trigger Note Off. Hold the note: nothing
   happens. Release it: the mute flips.
2. Map two keys to the same mute, one set to Turn on and one to Turn off, both on Note On. Each only
   does its own job: the first never unmutes, the second never mutes.
3. Map a note to a value control (Key or Speed) as Step and set Trigger Note Off. Pressing does
   nothing; releasing steps the value. The Amount field is shown for it.
4. Re-learn a mapping that has Turn off and Note Off set: after the new key is chosen, the row still
   shows the same Action and Trigger.
