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

**Not checked in the view.** The queued and not-ready tile and row states: no readiness delay or
queued trigger was produced against the stubbed tune, and Deck B was not given a tune. The queued
states are checked in Storybook below.

**Against frame B (Storybook).** `pnpm nx build-storybook ui-components`, the build served statically
and opened at `iframe.html?id=...`, the mockup page served beside it and measured in the same
browser. The three steps of frame B ("one deck through a queued jump") each have a story,
`QueuedJumpKnobMovedOn`, `QueuedJumpLapEnded` and `QueuedJumpSelectionFollows`, on the mockup's six
items (loop, loop, cue, loop, loop, cue; 7.8 s, 13.4 s, CUE, 8.0 s, 8.0 s, CUE):

| step | mockup | story |
| --- | --- | --- |
| 1 · Item 4 queued, knob moved on to Item 5 | Item 2 running with its lap bar, Item 4's light blinking, outline on Item 5, selected row on Item 5 and idle | the same: Item 2 running (53%), Item 4's light blinking (`state-blink` against the mockup's `blink`), outline and row on Item 5, row trigger unlit |
| 2 · lap ends, Item 4 runs, selection stays on Item 5 | Item 4 running with its lap bar, outline and row still on Item 5 | the same |
| 3 · knob left alone, selection follows to Item 4 | Item 4 running and outlined, row on Item 4 with its trigger lit | the same |

Measured on step 1 in both: the tile is 219.4 x 40 in the mockup and 215.4 x 40 in the story (the
same 4 px of synth-panel padding the frame A table notes); the plate is 474 wide in both. The mockup
plate is 164.9 high because it sizes to its content, where the story's wrapper gives it a fixed 360.
The running light is a theme token in the app (`rgb(134,198,145)`, queued `rgb(245,215,110)`) and a
mockup literal there (`rgb(111,220,140)`, `rgb(245,226,158)`), the same hue family. `EmptyNoTune`,
`FewMarkers`, `ManyMarkers` and `Narrow` were opened too and stand for frame A's empty, populated,
scrolling and narrow states: the empty plate shows disabled keys and "Load a tune to add loops", the
populated one a running and a queued tile, the scrolling one keeps the selected row fixed above the
tiles, and the narrow one stacks the Start and End rows. Frame A's own plate is the measured table
above.

**Automated.** `pnpm nx test dj-mixer`, `pnpm nx lint dj-mixer`, `pnpm nx run-many -t typecheck -p
application dj-mixer`, `pnpm nx build teensyrom-ui` and the five DJ end-to-end specs
(`dj-mixer-*.cy.ts`, 43 tests, run against `serve-static` with `--excludeTaskDependencies` because
Cypress gave up waiting for the production build the dependent task starts) pass.

### Audition on every edit

Driven as above against the running dev server: `/dj-mixer` in a 1920 x 1080 same-origin iframe,
`InSID3_Out.sid` (161 s at 100 play calls a second, so a second is 100 frames) from a local CORS
server with the iframe's `fetch` stubbed, deck A loaded through `DeckService.load`. The nudge strips
were released with `input` then `change` events and the snap keys pressed with DOM clicks, with every
`seekToFrame` logged against the time of the release. The MIDI snap path was not driven (no
controller here); it reaches the same `snapMarker` and is covered by the specs.

Deck A playing, a loop at 2394-3481 running: a start nudge of +30 held the old bounds for about 120
ms, then made one seek to 2424; start snaps next and previous sought to 2427 and 2311 after 125 and
94 ms; an end nudge of -50 sought at once to 3231 (the end less two seconds), and end snaps to
3259 and 3263 likewise. The same on the loop after Stop loop (idle) re-engaged it each time (start
nudge +20 to 2414 after about 100 ms, end nudge +40 to 3321, start snap to 2463). With the deck paused
a nudge resumed playback and then sought (end +10 to 3291, start +50 to 2444 on the running loop); with
it stopped, a start snap restarted it from the top and then landed at 2311. An end snap key that was
disabled (no moment in reach) was not pressed.

Deep marker, on a fresh page with only the one cue, at frame 13108 (131 s): start nudges to 13138,
13068 and 13168 landed 438, 579 and 576 ms after the release, against 92-162 ms for marks at 10-154
s that had another prepared mark nearer. About half a second is noticeable. A start edit withdraws
the old start's prepared image and a live-captured marker's image is never a chain source, so the new
start is replayed from the nearest prepared mark. Follow-up for the engine's prepared builds;
`sidablist` is unchanged here.

### Bundle check (loops and cues)

`pnpm nx build teensyrom-ui` on this branch against `main` (3899450b, after ASID-DJ-9 and
CLI-PARITY-9), the initial chunks only, in bytes (both built with the same `node_modules`):

| chunk | main | this branch |
| --- | --- | --- |
| shared ui / vendor chunk | 1,356,281 | 1,356,272 (-9) |
| `main` | 419,772 | 419,823 (+51) |
| shared application chunk | 170,554 | 186,821 (+16,267) |
| other initial chunks and `polyfills` | 132,747 | 133,096 (+349) |
| **initial JavaScript** | **2,079,354** | **2,096,012 (+16,658)** |
| `styles` | 35,125 | 35,125 (0) |

The new components add 0 B: they live in `dj.ts` and the ui chunk did not grow. The 16.3 kB is the
application layer: the loops state, `DeckLoops`, the loops selectors, the marker commands on
`DeckService` and the loop controls with their style layer, which the lazy DJ route's store pulls
into the shared application chunk (the same effect the ASID-DJ-8 table describes). The initial
JavaScript is over the 2.00 MB budget by 131 kB here against 114 kB on `main`; that warning is
already on `main` and `project.json`'s budgets are unchanged. The figures are from a build at the
final commit of the phase corrective, after the loop controls were mapped.

### Bench checklist (operator, real hardware)

- [ ] Loops and cues are placed, triggered and left on both decks, from the mouse and from the
  controller.
- [ ] A loop is added and its end set mid-set from the controller, then corrected with snap.
- [ ] A long tune reloaded has its loops ready within about a second.
- [ ] A running loop dialed in by slider, mouse snap and controller snap: each edit is heard at
  once, a start from the start of the loop and an end two seconds before the wrap.
- [ ] A start edit on a marker deep in a long tune lands without a noticeable wait.
- [ ] The speed controls work inside a loop, and the speed is kept on leaving it.
- [ ] The other deck's timing is unaffected while one deck loads or rebuilds.

## Per-loop settings and play now

Browser check of the play-now and GBL keys, the cue's Set End slot, the tiles' play-now keys and
dots, and the settings sign on the SID panel and the channel strip, against
`ASID-DJ-ROOT-WIREFRAME-LOOP-SETTINGS.html` (frames A to D). Driven as in "Loops and cues": `pnpm
start`, `/dj-mixer` in a **1920 x 1080** same-origin `<iframe>` with `lib-scaling-container {
transform: none }` injected, no API and no device. `InSID3_Out.sid` came from a local CORS server
(which also served the mockup page over `http://`, measured in the same browser), the iframe's
`fetch` was stubbed for `/files/content`, and `DeckService.load('A', ...)` was reached through
`ng.getComponent` on the deck column. Keys were pressed with DOM clicks on their accessible names;
the Key knob was turned with an `input` event on its range.

**Live behaviour, deck A.** Two cues were added, Set End on Item 2 made it a loop, and GBL on Item 2
was unlatched (its `aria-pressed` went false and its tile grew the dot). Then:

| step | Key readout | sign (SID panel and strip) | tiles |
| --- | --- | --- | --- |
| tune playing, nothing in play | `5A` | Main | Item 2 own dot |
| Key turned +3 on the main track | `2A` | Main | unchanged |
| play key on Item 2 (own settings) | `5A` | ITEM 2, lit | Item 2 running |
| play-now on Item 1 (shares) | `2A` | Main | all idle |
| play-now on Item 2 | `5A` | ITEM 2, lit | Item 2 running |
| play-now on Item 1, then the play key on Item 2 | `2A`, then `5A` | Main, then ITEM 2, lit | follows |
| Stop loop, then Stop | `2A` | Main | idle, deck stopped |

The two signs agreed at every step, and Deck B's stayed Main. The row's GBL read unlatched for Item 2
and latched for Item 1. The console showed no errors from the plate.

**Learn overlays (mapping mode set on the store, as in the transport section).**

| selection | `loop-play-now` / `loop-global` | `loop-set-end` | `loop-end-snap-*` |
| --- | --- | --- | --- |
| a loop (bindings closed and open) | one overlay each, centred on its key | none | on the End boundary's snap keys, as before |
| a cue (bindings closed and open) | one overlay each, centred on its key | one, over the End slot's Set End key | none (the slot has no snap keys) |

Each overlay sat 3 px outside its key on every side, as the existing ones do (play-now 34 x 32
around 28 x 26 before the sizing fix below, Set End 169 x 28 around 163.5 x 22).

**Against frames A to D (1920 x 1080), measured on both pages.** The first pass found the row's
keys narrower than the mockup's (play-now 28.1 wide against 32, GBL 32.2 against 44.2, Clear End
28.1 against 26) and, with the bindings panel open, the tiles squeezed to 122 px, which cut each
name down to its first letter. Fixed in P03-T01's components: the play-now key takes the trigger's
32 px, Clear End the delete key's 26 px and GBL a 44 px minimum, and the tile grid takes one tile per
line below 24rem. After:

| element | mockup | view |
| --- | --- | --- |
| selected row (w x h) | 443.9 x 71.1 | 439.9 x 71.1 |
| row keys, left to right (w) | 32 / 32 / display 235.6 / 44.2 / 26 / 26 | 32 / 32 / display 231.7 / 44 / 26 / 26 |
| tile (w x h), trigger, play-now | 218.9 x 40, 30 x 30, 26 x 30 | 214.9 x 40, 30 x 30, 26 x 30 |
| tile's own-settings dot | 6 x 6 | 6 x 6 |
| cue's Set End key (w x h) | 165.9 x 22 | 163.5 x 22 |
| sign on the SID panel, Main / Item 2 (w x h) | 50.2 x 18 / 61.3 x 18 | 50.2 x 18 / 61.2 x 18 |
| gap from the deck label to its sign | 8 | 8 |
| sign on the channel strip, full width of V1 | 61.7 (V1 61.7) | 69.9 (V1 69.9) |

The 4 px in the row, display and tile is the synth panel's padding, as the Loops and cues table
records. The channel strip's column is 8 px wider than the mockup's, so its V1 and sign are as well;
both fill the strip. The label sits first and the sign after it on both decks, as the mockup draws
them. One difference stays: the mockup's GBL key draws a lamp dot beside its label, and the shared
key has none, so the view shows lit as cyan text, border and glow with the pressed look, and unlit
as plain dim text. The span text is fully readable at 474 px and when narrow.

**Narrow width (bindings panel open).** The plate is 288 px. The top line wraps its keys above the
display, which takes a line of its own: its text is whole (display scroll width equals client width,
the span `00:03.9-00:04.4` at 91 of 91 px). The two tiles take a line each, 250 px wide, with no
name, length or dot clipped. The page does not scroll (1080 = 1080). The same plate with the same
selection before the grid change had tiles 122 px wide and clipped names.

**Storybook** (`pnpm nx run ui-components:storybook`, port 4400), for states the live run did not
produce: `dj-loops-cues-plate--mixed-settings` (own dots on two of four tiles, row keys as in the
table), `--queued-jump-knob-moved-on` (queued tile, outline and row on another tile), `--narrow`
(300 px, one tile per line, nothing clipped); `dj-loop-selected-row--cue-set-end-slot` (Set End key
180.5 x 22 in the 474 px row, no snap keys); `dj-loop-tile--not-ready` (both keys present and
enabled); `dj-deck-settings-sign--marker` (lit, 61.2 x 18, named "Settings in play deck A: Item 2").

**Automated.** `pnpm nx test dj-mixer`, `pnpm nx lint dj-mixer`, `pnpm nx test ui-components`,
`pnpm nx run-many -t typecheck -p application dj-mixer`, `pnpm nx build teensyrom-ui` and the five DJ
end-to-end specs (`dj-mixer-*.cy.ts`, 43 tests, run against a `serve-static` started by hand, with
`--excludeTaskDependencies`) pass. No spec selected the row's keys, so none changed.

### Bundle check (per-loop settings)

`pnpm nx build teensyrom-ui` on this branch against `main` (c25d7588, after ASID-DJ-10), the initial
chunks only, in bytes (both built with the same `node_modules`):

| chunk | main | this branch |
| --- | --- | --- |
| shared ui / vendor chunk | 1,358,451 | 1,358,451 (0) |
| `main` | 419,823 | 419,823 (0) |
| shared application chunk | 187,929 | 195,774 (+7,845) |
| other initial chunks and `polyfills` | 133,334 | 133,334 (0) |
| **initial JavaScript** | **2,099,537** | **2,107,382 (+7,845)** |
| `styles` | 35,125 | 35,125 (0) |

The new components add 0 B: they live in `dj.ts` and the ui chunk did not grow. The 7.8 kB is the
application layer, which the lazy DJ route's store pulls into the shared application chunk: the
per-marker settings state, the settings landing with a jump, play-now, the GBL toggle and their
mapped controls. The initial JavaScript is over the 2.00 MB budget by 142.51 kB here against 134.66
kB on `main`; that warning is already on `main` and `project.json`'s budgets are unchanged.

### Bench checklist (operator, real hardware, per-loop settings)

- [ ] A marker's settings land with the jump into it with no audible glitch or timing slip, from a
  queued trigger and from play-now, in both directions between a marker with its own settings and
  one that shares.
- [ ] Rapid repeated play-now presses hold up over a long run.
- [ ] The other deck's timing is unaffected while one deck jumps with settings.
- [ ] GBL toggled mid-set on the running loop A/Bs between its own settings and the main track's.
- [ ] Play-now and GBL are learned and played from the controller.

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
