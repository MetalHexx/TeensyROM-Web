# Getting started

Install TeensyROM Suite, connect your cart, and get your library ready to search and shuffle.

## Install

Download the package for your platform from the [releases page](https://github.com/MetalHexx/TeensyROM-Suite/releases). There is one download each for Windows, macOS and Linux.

The download holds Trom API, [Trom UI](trom-ui.md) and [Trom Terminal](trom-terminal.md) in one package. [Trom Agent](trom-agent.md) is installed separately.

### Windows and Linux

1. Unpack the archive into a folder.
2. Start the suite by running `TeensyRom.Api` (`TeensyRom.Api.exe` on Windows) at the root of that folder. Or run `cli/trom`, which starts it for you.
3. Run `trom path add` once to put `trom` on your PATH.

On Linux, make the program executable first with `chmod +x TeensyRom.Api`. Windows may show a security warning the first time: choose "More info", then "Run anyway".

### macOS

Install with Homebrew:

```bash
brew tap MetalHexx/TeensyROM-Suite https://github.com/MetalHexx/TeensyROM-Suite
brew install teensyrom-suite
```

Start the suite with `trom-suite`.

Already installed with Homebrew? Run `brew update && brew upgrade`.

macOS may block the app on first run. Open System Settings, go to Privacy & Security and choose "Open Anyway".

### Open Trom UI

With the suite running, open [http://localhost:10213](http://localhost:10213) in your browser. The same address works from your phone or tablet on your local network, using this computer's address in place of `localhost`.

### Firmware

Your TeensyROM needs firmware **0.8.0.9** or newer.

## Connect your cart

Plug your TeensyROM into the computer that runs the suite, over USB or the network. The suite finds carts on its own when it starts, and again when you refresh Trom UI. It remembers the carts it has seen, so they reconnect quickly. You can also scan for new carts from Trom UI.

- **USB:** connect the cart to the computer with a USB cable. It connects as soon as it is found.
- **Network:** turn on the Ethernet TCP listener on the cart. Each cart on your network needs its own MAC address and its own IP address, and carts ship with the same MAC address, so change it if you have more than one. The TeensyROM project explains the setup in [External App Control via TCP](https://github.com/SensoriumEmbedded/TeensyROM/blob/main/docs/Ethernet_Usage.md#external-app-control-via-tcp). A cart reachable both ways connects over the network.

### Several carts

Connect as many carts as you like, in any mix of USB and network. They all work at the same time.

A cart keeps its library and settings whichever way it connects, because the suite recognises it by an identity file it keeps on the cart's storage. Leave that file in place.

### Rename a cart

Give each cart a name you will recognise. Rename it in Trom UI, or in Trom Terminal with `trom device rename "<new name>"`.

## Prepare your library

### Index your storage

Indexing reads your SD and USB storage once, so search, random launch and shuffle can cover everything on the cart. Without an index they only know the folders you have opened.

Index from Trom UI, or run `trom index build` in Trom Terminal.

Index again after you change files on the cart outside the suite, such as swapping files in with a card reader. Otherwise they look like they are missing.

### Add the big collections

These collections make the library much richer. Put them on your cart's storage before you index.

- **[HVSC](https://hvsc.c64.org/)**, the High Voltage SID Collection. It adds accurate play times, composer names, release info and the scene history notes from the STIL database. [DeepSID](https://github.com/Chordian/deepsid) supplies the composer images.
- **[OneLoad64](https://www.youtube.com/watch?v=lz0CJbkplj0&list=PLmN5cgEuNrpiCj1LfKBDUZS06ZBCjif5b)**, the game collection. It adds load and play screens so you can preview games, and it gives the fastest consecutive game loads a Commodore can do.

### Search syntax

Search matches file names and paths for every file type. For SIDs in HVSC it also matches the artist, the song title and the STIL comments, which helps when you dig for a cover tune or a hidden gem.

- Type words to search for them.
- Put `+` in front of a word that every result must contain.
- Put a phrase in double quotes to match it exactly.
- Combine them: `Iron +Maiden +"Aces High"`

### Bans

Banning a file or folder hides it from browsing, search and shuffle. The list starts with entries such as `System Volume Information`, `FOUND.000`, `Docs` and `Dumps`, which are known to cause trouble on a TeensyROM.

- **Trom UI:** manage your bans in Trom UI settings. Add an entry to ban it, and remove an entry to lift the ban.
- **Trom Terminal:** `trom file ban "<path>"` bans a file, `trom file banned` lists the bans, and `trom file unban "<entry>"` lifts one.

## Next

- [Trom UI](trom-ui.md): play, search, copy files, watch folders and themes.
- [DJ Mixer](dj-mixer.md): two SID decks played live through real C64s.
- [Trom Terminal](trom-terminal.md): the same library from your command line.
- [Trom Agent](trom-agent.md): drive the suite from Claude Code.
- [Contributing](contributing.md): build the suite from source.
