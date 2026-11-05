# Getting started

Install TeensyROM Suite, connect your cart, and get your library ready to search and shuffle.

## Install

Let Trom Agent install the suite for you, or install it yourself: download it for Windows, Linux or a Raspberry Pi from the [releases page](https://github.com/MetalHexx/TeensyROM-Suite/releases), or install it with Homebrew on a Mac.

The download holds Trom API, [Trom UI](trom-ui.md) and [Trom Terminal](trom-terminal.md) in one package. [Trom Agent](trom-agent.md) is a Claude Code plugin, installed separately.

### With Trom Agent

If you use [Claude Code](https://claude.com/claude-code), add the Trom Agent plugin, type `/trom`, and say yes when it offers to install the suite:

```
/plugin marketplace add MetalHexx/tr-plugin-marketplace
/plugin install trom-agent@tr-plugin-marketplace
```

- **Windows, Linux and Raspberry Pi:** it downloads the newest release for your computer, checks it against the SHA-256 GitHub publishes before unpacking it, unpacks it into a folder in your user profile and puts `trom` on your PATH.
- **macOS:** it installs with Homebrew, and installs Homebrew first if you don't have it. An install from the older `teensyrom-web` tap moves over to `teensyrom-suite`.
- Then it starts the suite and checks that Trom API and Trom UI are running.

It explains the plan and shows each command before it runs it. Apart from installing Homebrew, nothing needs admin rights. It keeps the suite up to date afterwards, too: see [Update](#update).

### Windows and Linux

1. Unpack the archive into a folder. It holds `api/` (Trom API and Trom UI) and `cli/` (`trom`).
2. Run `cli/trom ui` (`cli\trom ui` on Windows) to start the suite and [open Trom UI](#open-trom-ui).
3. Say yes when `trom` offers to put itself on your PATH, then open a new terminal. `cli/trom path add` (`cli\trom path add` on Windows) does the same later.

Windows may show a security warning the first time: choose "More info", then "Run anyway". Windows Firewall asks the first time Trom API starts: allow Private networks so phones and tablets can connect.

On Linux, USB carts need your user in the `dialout` group. Run `sudo usermod -aG dialout $USER`, then log out and back in.

#### Raspberry Pi

The Linux package also runs on a Raspberry Pi. Download the `linux-arm64` archive (`TeensyROM-Suite-<version>-linux-arm64.tar.gz`) and follow the steps above.

- The Pi needs a 64-bit Raspberry Pi OS. The Raspberry Pi 5 is tested, and the Pi 3, 4 and Zero 2 W with a 64-bit OS are expected to work.
- The `dialout` line above applies to USB carts.
- On Raspberry Pi OS Lite (Debian 13, Trixie), first run `sudo apt install libicu76 libasound2t64`. The desktop image already has them. Those are Debian 13 package names. On Raspberry Pi OS based on Bookworm (Debian 12) `apt` reports "Unable to locate package"; upgrade to the Trixie-based Pi OS, or install the Debian 12 equivalents (`libicu72 libasound2`).

### macOS

Install with Homebrew:

```bash
brew tap MetalHexx/TeensyROM-Suite https://github.com/MetalHexx/TeensyROM-Suite
brew install teensyrom-suite
```

Then run `trom ui` to start the suite and [open Trom UI](#open-trom-ui).

macOS may block the app on first run. Open System Settings, go to Privacy & Security and choose "Open Anyway".

### Open Trom UI

`trom ui` starts Trom API if it isn't running and opens Trom UI in your browser at [http://localhost:10213](http://localhost:10213). It also prints the addresses phones and tablets on the same network can use, such as `http://192.168.1.20:10213`, and the [secure address](#secure-address) beside each one. Add `--no-open` to print the addresses without opening the browser.

### Secure address

Trom API also serves Trom UI over HTTPS, on port `10214`. From another device, open the secure address that `trom ui` lists, such as `https://192.168.1.20:10214`. MIDI controllers and capture-card video need this address from another device; on the computer itself, `http://localhost:10213` works.

The certificate is made by Trom API on your computer and isn't signed by a public authority, so the browser warns once, the first time it opens the secure address. The warning comes back after the computer gets a new network address or name, or when the certificate nears its expiry. When that happens, `trom` says the certificate was re-issued.

### Firmware

Your TeensyROM needs firmware **0.8.0.9** or newer.

## Connect your cart

Plug your TeensyROM into the computer that runs the suite, over USB or the network. The suite finds carts on its own when it starts, and again when you refresh Trom UI. It remembers the carts it has seen, so they reconnect quickly. You can also scan for new carts from Trom UI.

- **USB:** connect the cart to the computer with a USB cable. It connects as soon as it is found.
- **Network:** turn on the Ethernet TCP listener on the cart. Each cart on your network needs its own MAC address and its own IP address, and carts ship with the same MAC address, so change it if you have more than one. The TeensyROM project explains the setup in [External App Control via TCP](https://github.com/SensoriumEmbedded/TeensyROM/blob/main/docs/Ethernet_Usage.md#external-app-control-via-tcp). A cart reachable both ways connects over the network.

### Several carts

Connect as many carts as you like, in any mix of USB and network. They all work at the same time.

A cart keeps its library and settings whichever way it connects.

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

## Update

`trom update` checks GitHub for a newer release and asks before it installs it. It downloads the release, checks its SHA-256, swaps in the new files, and restarts Trom API if it was running.

- `trom update --check` only reports whether a newer release is out.
- `trom update --yes` updates without asking.
- A stable install updates to stable releases. A pre-release install, such as a beta, also updates to newer pre-releases.
- On a Homebrew install, `trom update` runs Homebrew for you. `brew upgrade teensyrom-suite` works too.
- [Trom Agent](trom-agent.md) tells you when a new release is out as a session starts, and updates the suite once you agree. You can also ask it to.

`trom` checks for a new release once a day and prints a line when one is out. The guided menu shows it under the logo, with an "Update to" entry for the new version. Turn the check off with `trom settings set update-check false`, or with Toggle Update Check in the guided menu's Settings.

Your settings and library index live in `~/.teensyrom` (`%USERPROFILE%\.teensyrom` on Windows), outside the install folder, so updates keep them. Set `TEENSYROM_DATA_DIR` to keep them in another folder.

## Next

- [Trom UI](trom-ui.md): play, search, copy files, watch folders and themes.
- [DJ Mixer](dj-mixer.md): two SID decks played live through real C64s.
- [Trom Terminal](trom-terminal.md): the same library from your command line.
- [Trom Agent](trom-agent.md): drive the suite from Claude Code.
- [Contributing](contributing.md): build the suite from source.
