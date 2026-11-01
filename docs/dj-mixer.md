# DJ Mixer

## What it is

Two decks of SID music, played live through real C64s. Every note is made by the SID chip itself, and none by an emulator. Load a tune on each deck, shape its sound, loop and cue it, scratch it, and mix between them.

Open it from **DJ Mixer** in Trom UI.

## What you need

- A browser with MIDI support, such as Chrome or Edge, on the computer that runs the suite.
- The TeensyROM each deck plays through, connected by USB.
- Optionally, a MIDI controller.

Each deck has a MIDI port selector. Press **Enable MIDI** and allow access when the browser asks, then pick the port of the TeensyROM that deck plays through.

## Load tunes

The browser at the bottom shows the SD and USB storage of every connected cart, with a **Sets** branch for your saved sets. Browse the folders, or search the storage you have open.

Load a tune onto either deck by dragging it onto the deck. Load a set onto a deck with the **A** and **B** load buttons on the set card.

## Play a deck

- **Transport:** play or pause, stop and repeat the tune.
- **Position:** the position bar shows how far in you are. Drag it to jump.
- **Tunes:** step to the previous or next tune in the loaded set, and to the previous or next sub-tune of the tune that is loaded.
- **Speed:** drag the speed fader, nudge it up or down for a moment, or jump it up, down or back to normal.
- **Voices:** mute any of a tune's three voices, or hold one.

## Shape the sound

Each deck has a full panel of the SID chip's controls, for each of its three voices:

- Waveform buttons, coarse and fine pitch, and pulse width.
- Attack, decay, sustain and release.
- Ring modulation, sync, and whether the voice runs through the filter.

The filter has a cutoff, a resonance and its modes. A **Key** knob moves the whole tune up or down in semitones, and a panic button silences the deck if something hangs.

The knobs show the chip's live values as the tune plays, and every voice has an oscilloscope-style wave of what it is playing.

## Loops and cues

Each deck keeps a list of loops and cues for the tune it holds.

- **Set:** add a marker at the current position. Give it an end to make it a loop, or leave it as a cue. Stop a running loop at any time.
- **Fine tune:** nudge a marker's start or end, or snap it to the previous or next moment in the tune.
- **Name:** rename any marker.
- **Jump:** trigger a marker to jump to it, or use **play now** to start it right away.
- **Own mixer settings:** a marker follows the deck's settings by default. Turn off **GBL** on it to give it voice, filter and key settings of its own. Markers with their own settings are marked in the list.

## Sets

A set is an ordered list of tunes for a performance.

- **Build:** add tunes to a set by dragging them from the browser onto it.
- **Arrange:** drag tunes into the order you want and remove the ones you don't.
- **Name:** rename a set, create a new one, or delete one.
- **Play:** load the set onto either deck, then step through it with the previous and next tune controls.

## Key match

A light between the decks shows how well the keys of the two loaded tunes fit, from a full match through close and possible to a clash. It is unlit when a deck's tune has no key. Use it to judge a mix before you bring a tune in. Show keys as Camelot codes or as note names.

## Scratch

Map a pitch bend strip on your controller to a deck's hand. Touch the strip and the record is yours: move your finger to scratch. Let go and the record is thrown back up to the deck's speed.

Set up the strip in the [controllers](#controllers) panel.

## Controllers

Map any control to a MIDI controller by learning it.

1. Open the bindings panel with the sliders button at the top of the SID panel.
2. Turn on **Mapping mode** and click a control on the mixer.
3. Move the knob, slider, key or pad on your controller that should drive it.

Each mapping lets you choose its style, such as a toggle, a hold, or an absolute or relative knob. You can change a mapping later, learn it again, or delete it. The panel also lists your controllers and lets you pick which ones to listen to.

## Start the ASID player

The decks play through the ASID player on each cart. Press the rocket button at the top of the SID panel to start it on both decks' carts at once. Each deck starts on its own, so one cart failing doesn't stop the other.

## What's remembered

The mixer remembers your work across a refresh of the page:

- A tune's loops, cues and settings are kept per tune.
- Your sets, and the settings and markers of each tune in them, are kept per set.
- Your controller mappings and their settings are kept.

<!-- Image placeholder: screenshot of the DJ Mixer with a tune loaded on each deck -->
