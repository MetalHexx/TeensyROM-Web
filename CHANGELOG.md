# Changelog

Release notes for TeensyROM Suite, newest first. Releases before 1.0.0-beta.1 shipped as TeensyROM Web.

<!-- release.yml publishes the section under each "## [version]" heading as that release's GitHub notes. Write it before tagging: the release fails without it. -->

## [Unreleased]

### 🍓 Raspberry Pi and Linux ARM64

The suite now ships for 64-bit ARM Linux, so a Raspberry Pi can run Trom API, Trom UI and Trom Terminal.

- **New package**: `TeensyROM-Suite-{version}-linux-arm64.tar.gz`, for a Raspberry Pi with a 64-bit Raspberry Pi OS. The Pi 5 is tested, and the Pi 3, 4 and Zero 2 W are expected to work.
- **Updates and Trom Agent**: `trom update` and Trom Agent pick the ARM64 package on a Pi.

---

### 🔒 Secure address for MIDI and video

Trom API serves the same app over HTTPS on port 10214, beside http on 10213. From another device, open the secure address that `trom ui` lists for MIDI controllers and capture-card video.

- **Self-signed certificate**: Trom API makes it on your computer and keeps it in your data home. The browser warns once, and again after the computer gets a new address or name.
- **Notices**: `trom api start`, `trom api status`, `trom ui` and `trom init` show the secure address, the certificate's expiry and a notice when a certificate is created or re-issued.
- **Trusted local networks only**: HTTPS protects against passive snooping on your home network. It is not for exposing Trom API to the internet.

---

## [1.0.0-beta.1](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-beta.1) - 2026-11-02

> **Firmware Requirement**: TeensyROM firmware **0.8.0.9** or later is required for this release.

### 🧩 Three Apps, One Suite

TeensyROM Web is now **TeensyROM Suite**. The TeensyROM desktop UI, the TeensyROM CLI and TeensyROM Web used to be three separate apps, each with its own way of talking to your cart. Now there is one download per platform, and every part drives your carts through one engine:

- **Trom UI**: the web app, in any browser on your network
- **Trom Terminal**: the `trom` command, replacing TeensyROM-CLI
- **Trom Agent** *(new)*: a Claude Code plugin that runs your TeensyROM by conversation, and can install and update the suite for you
- **Trom API**: the engine behind all three

What you start in one, the others see. The TeensyROM-UI and TeensyROM-CLI repos are retired and archived.

---

### 💻 Trom Terminal: the CLI, Rebuilt

TeensyROM-CLI carried its own USB serial code. Trom Terminal drops it and works through Trom API, just like Trom UI, so it reaches carts on your network as well as USB and gets every connection fix in this release. Everything it did came across onto one grammar, `trom <noun> <verb>`, and it picked up a lot on the way.

- **Copy files** and folders to a cart and back, or launch a file from your computer in one step
- **Playback from the prompt**: next, previous, pause and stop, and a full-screen player that shows each file's full record
- **Everything else the engine does**: watch folders, transfers, themes, device names and bans, from a command or the BBS-style guided menu
- **Built for scripts and agents**: `--json`, pipes and stable exit codes
- **Looks after itself**: starts Trom API when it needs it, and offers to put itself on your PATH

<table>
  <tr>
    <td width="50%"><img width="100%" alt="Trom Terminal's guided menu" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/trom-terminal-menu.png" /></td>
    <td width="50%"><img width="100%" alt="Trom Terminal one-line commands: list carts, search, launch, download and upload" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/trom-terminal-commands.png" /></td>
  </tr>
</table>

---

### 🎛️ DJ Mixer

The desktop UI's DJ features had to work around the player on the cart. The DJ Mixer takes the playhead into your browser: it runs each tune's own player code and streams the SID register writes to two real C64s. The SID chip still makes every sound, and tempo, loops and cues are yours.

- **Beat matching**: fine speed control with nudge, a BPM readout, Tap for the beat grid, and a light that says how well the two keys mix
- **Loops and cues** snap to beats, each with its own name and mixer settings
- **Touch strip**: hold, backcue, throw and scratch like a hand on the record
- **SID panel** per deck: bend the tune's own waveforms, envelopes and filter, with a live scope for every voice
- **MIDI controllers and sets**: map nearly every control with learn mode, and keep each tune's loops, grid and settings in a set

<table>
  <tr>
    <td width="50%"><img width="100%" alt="DJ Mixer with a tune loaded on each deck" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/dj-mixer.png" /></td>
    <td width="50%" align="center"><a href="https://youtu.be/PjhqYkmsScg"><img width="100%" alt="Watch the DJ Mixer mix preview on YouTube" src="https://img.youtube.com/vi/PjhqYkmsScg/maxresdefault.jpg" /></a><br><a href="https://youtu.be/PjhqYkmsScg">▶️ Mix Preview</a> · <a href="https://youtu.be/xoJBOEPB5IY">▶️ Scratch / Beat Juggle</a></td>
  </tr>
</table>

> Needs Chrome or Edge (Web MIDI), with each deck's cart connected by USB.

---

### 📂 File Transfer & Watch Folders

Built for whole collections: Trom API starts writing to the cart while the rest of a drop is still uploading, and files show up in your library as they land.

- **Drag and drop** files or whole folders onto a cart; zip, 7z and rar archives are unpacked on the way
- **Several carts at once**, each with live progress, speed and failures, and a details view you can hide without stopping anything
- **One list everywhere**: a transfer started in Trom UI shows in Trom Terminal, and the other way round
- **Watch folders**: set up as many as you like, each sending whatever lands in it to one or more carts and launching it if you ask. They run inside Trom API, so nothing else needs to be open
- **Protected while busy**: a cart that's receiving refuses other commands until it's done, and the rest stay free

<table>
  <tr>
    <td width="50%"><img width="100%" alt="File Transfer with two carts transferring and the watch folders panel open" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/file-transfer.png" /></td>
    <td width="50%"><img width="100%" alt="A transfer's details" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/file-transfer-details.png" /></td>
  </tr>
</table>

---

### 🎨 Themes

Your TeensyROM's own menu can wear new colors now.

- **Six shipped themes**: TR Default, Black & White, C64 Mono, CGA, The Blues and Rainbow
- **Tune your own**: any of the menu's seven colors from the C64's 16, saved under your own name
- **Apply to one cart or all**, and watch it land in a live preview from your video capture
- **Everywhere**: Trom UI, Trom Terminal's menu and `trom theme` share the same themes, and Trom Agent sets them on request

<table>
  <tr>
    <td width="50%"><img width="100%" alt="The Themes view in Trom UI" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/themes.png" /></td>
    <td width="50%"><img width="100%" alt="The Theme screen in Trom Terminal's guided menu" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/trom-terminal-theme.png" /></td>
  </tr>
</table>

---

### 🤖 Trom Agent

A companion for your C64, inside Claude Code. Type `/trom` and ask in plain words. It works through Trom Terminal, and asks before it copies files, changes your setup or installs anything. Starting a session resets your cart to its menu, so it stops what's running.

- **Installs the suite for you**: Homebrew on a Mac (Homebrew too, if you need it), or the newest release on Windows and Linux, checked against its SHA-256 before it's unpacked and put on your PATH. When a new release is out, it tells you and updates once you agree
- **Play and shuffle**: "play me some Rob Hubbard", "show me demos from 1989", and it tells you a little about what's playing
- **Timed sets**: "give me a 30-minute set", built from your library and played through on the cart
- **Library tours and curation**: walk your folders, search, favorite and ban
- **Files, watch folders and themes**: "watch my Downloads folder and send new files to the cart"
- **Setup doctor**: Virtual Travis checks Trom Terminal, Trom API, Trom UI, your cart and your index, and walks you through the fixes

```
/plugin marketplace add MetalHexx/tr-plugin-marketplace
/plugin install trom-agent@tr-plugin-marketplace
```

<table>
  <tr>
    <td width="50%"><img width="100%" alt="Trom Agent greeting a new session" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/trom-agent-greeting.png" /></td>
    <td width="50%"><img width="100%" alt="Trom Agent playing a Depeche Mode set" src="https://raw.githubusercontent.com/MetalHexx/TeensyROM-Suite/main/.github/images/trom-agent.png" /></td>
  </tr>
</table>

---

### 🔌 One Engine, Rebuilt Connections

- Carts are identified by their own **chip ID**, not a tag file written to your SD card, and get names (TR-1, TR-2, …) you can change
- **Faster, steadier** resets and launches, and known carts reconnect from memory
- **Opening Trom UI no longer touches your carts**, so a running game keeps running
- Dropped network links **recover on their own**, without launching twice
- Only TeensyROM serial ports are opened, so other USB boards are left alone

---

### ✨ Also New

- **`trom ui`** starts Trom API if needed, opens Trom UI and prints the address your phone or tablet can use
- **`trom update`** installs new releases, checking each download before it swaps anything
- **Audio streaming**: hear your C64 on a phone or tablet
- **Bans** match whole file names and apply right away

---

### ⚠️ Upgrade Notes

- **Trom UI moved from port 213 to http://localhost:10213.** Update bookmarks and firewall rules.
- **Everyone starts fresh** in `~/.teensyrom`: carts show up as new devices, and names, settings and indexes are set up again.
- **TeensyROM-CLI users**: commands are now `trom <noun> <verb>`, and the old command lines no longer work. `trom --help` lists them all. On Homebrew, `brew uninstall teensyrom-cli` first.
- The package now holds `api/` and `cli/` folders.

### Update
- With Trom Agent: type `/trom` in Claude Code. It installs the suite if it's missing, or offers the update.
- Already on a suite release: `trom update` (`trom update --check` only looks).
- Installed with Homebrew: `brew update && brew upgrade teensyrom-suite`.
- Fresh install on a Mac: `brew tap MetalHexx/TeensyROM-Suite https://github.com/MetalHexx/TeensyROM-Suite`, then `brew install teensyrom-suite` and `trom ui`.
- Fresh install on Windows or Linux: download the package below, unpack it and run `cli/trom ui` (`cli\trom ui` on Windows).

### Downloads
- Windows x64: `TeensyROM-Suite-1.0.0-beta.1-win-x64.zip`
- Linux x64: `TeensyROM-Suite-1.0.0-beta.1-linux-x64.tar.gz`
- macOS: install with Homebrew, above. The `osx-arm64` and `osx-x64` packages are the ones Homebrew installs.

Docs: https://github.com/MetalHexx/TeensyROM-Suite/blob/main/docs/getting-started.md

## [1.0.0-alpha.8](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.8) - 2026-02-19

> **Firmware Requirement**: TeensyROM firmware **v0.7.1** or later is required for this release.

### What's New

#### 🌐 TCP / Ethernet Device Support

TeensyROM Web can now connect to your TeensyROM device over the network via TCP/Ethernet in addition to the existing USB Serial connection. This enables wireless or wired Ethernet access to your device without being physically tethered by USB.

- Connects using port **2112** on the TeensyROM device
- Select connection type (Serial or TCP) from device settings
- See the updated [README](https://github.com/MetalHexx/TeensyROM-Web?tab=readme-ov-file#-device-discovery--connectivity) for multi-device Ethernet setup instructions

> **Requires TeensyROM firmware v0.7.1**

#### 📱 Mobile & Responsive UI Overhaul

A major rework of the player, browser, and navigation experience for phones and smaller screens.  
Phone Demo: https://www.youtube.com/shorts/hcfaokI_lHw 

- **Swipe navigation** — swipe left/right between player views on mobile
- **Mini player toolbar** — compact, touch-friendly toolbar for phone sizes
- **Bottom nav rail** — dedicated navigation bar at the bottom of the screen on phone layouts
- **Swipeable action bar** — file actions accessible via swipe for efficiency on small screens
- **Phone player view** — shows artist name, title, and time display optimized for small screens
- **Header** hidden in phone view to maximize content area
- **Navigation rail** auto-hides and supports hover-delay and pin/unpin functionality
- **Directory tree** hidden at smaller screen sizes to prioritize content
- **Collapsible directory breadcrumb** for space-efficient navigation
- Scrollbar fixes, touch tap support for launching files, and numerous polish fixes across all breakpoints

#### 🔍 Global Cross-Device Search

Search now queries across **both SD and USB storage devices simultaneously**, returning unified results from your entire library. Favorites and playlist directories are excluded from results to avoid duplicates.

#### 💾 Storage Device Indicators

Files in the browser now display which storage device (SD or USB) they are stored on, with an icon and tooltip for quick identification. All storage-related actions (launch, favorites, etc.) now correctly resolve the storage device context, including from search results.

#### ⚠️ Incompatible File Auto-Advance

When a file is incompatible with the current launch mode (e.g., launching a game as minimal), the player now **automatically advances to the next file** instead of stopping. An indicator is shown in the file listing for incompatible items so you can identify them at a glance.

#### 💡 Tooltip System

A new custom tooltip directive replaces the CDK-based tooltips throughout the app. Key improvements:

- Tooltips work correctly alongside the CRT effect CDK overlay
- **Touch device support** via long-press activation
- Tooltips can now be **toggled globally** from the header
- Added throughout: device toolbar buttons, player toolbar, power button, action buttons, icon components

#### 🗂️ Indexing Guidance Indicators

New indexing indicators and alerts have been added to guide users through the file indexing process more clearly, particularly after first-launch or device re-connection.

#### ⏱️ Custom Play Timer Improvements

- Fixed timer start edge case on the first game launch in a session
- Removed 5-second and 10-second options (too short for practical use)
- Added descriptive tooltips on all timer controls

#### 🐢 Slow Operation Feedback

- A new **slow launching file dialog** gives feedback when a file is taking longer than expected to launch
- A **slow favorite operation dialog** improves UX when swapping minimal FW favorites which can be a slow transition.

### Notable Fixes

- Fixed favorite button functionality after icon family change
- Fixed an issue where the progress bar would not return after switching from a game back to a SID
- Fixed device discovery when a storage device is missing on the TeensyROM device
- Fixed directory tree expansion for deep directory structures
- Fixed visual hover/selection jank on file listings caused by glassmorphism layering
- Fixed scroll issues on real phone hardware
- Fixed custom play timer edge cases on first session launch
- Sanitized log output — removed extra carriage returns that caused large visual gaps in user-facing logs
- Fixed launch guard to prevent timer-based launches while a launch is already in progress

### Upgrade Notes

- See [README](https://github.com/MetalHexx/TeensyROM-Web?tab=readme-ov-file#-quick-start) for installation / setup instructions
- **Firmware v0.7.1** is required. TCP connectivity and some Serial communication changes depend on updated firmware routines.
- **Application port changed**: TeensyROM Web now runs on **port 213** (e.g., `http://localhost:213`) instead of the previous port 5000. Update any bookmarks, firewall rules, or router port-forwarding configurations accordingly.

## [1.0.0-alpha.7](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.7) - 2025-12-28

This release features **automatic black bar removal** for fullscreen retro content, **enhanced CRT defaults** for authentic display emulation, and **usability improvements** across the board.

### ✨ New Features

#### Automatic Black Bar Cropping

Intelligent video edge detection that automatically removes black letterboxing and pillarboxing from your content:

- **GPU-Accelerated Detection** - WebGL-powered edge detection measures black bars on all four edges in real-time
- **Video Mode Presets** - Choose between Automatic, PAL Standard, NTSC Standard, or Open Border modes
- **Per-Device Memory** - Your crop preferences save automatically for each device

#### Minor Updates
- Added reasonable defaults for CRT effects

### 🔧 Fixes
- **Fixed macOS file loading** - Corrected path resolution for game art and DeepSID metadata on macOS
- **Auto-scrolling device logs** - Logs now automatically scroll to newest entries on load

## [1.0.0-alpha.6](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.6) - 2025-12-21

### What's New

#### Error Handling Improvements
- Added `GlobalExceptionHandler` for centralized exception management
- Introduced `ExceptionMiddleware` for consistent error response formatting
- Enhanced API error responses with better structured error messages

### Platform-Specific Configurations

- macOS builds use multi-file publishing (resolved .NET 9 memory corruption with single-file mode)
- macOS builds have compression disabled (to resolve Scalar endpoint crashes)

## [1.0.0-alpha.5](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.5) - 2025-12-21

Same as 1.0.0-alpha.4, with the version number raised.

## [1.0.0-alpha.4](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.4) - 2025-12-21

This release focuses on **macOS compatibility improvements** and introduces **advanced CRT effects** for authentic retro display emulation.

### ✨ New Features

#### Advanced CRT Effects
Transform your gameplay experience with authentic CRT display emulation:

- **Barrel Distortion** - Curved glass warping simulating CRT tube geometry
- **Bloom** - Phosphor glow simulation for bright areas creating authentic screen glow
- **Chromatic Aberration** - RGB color separation for realistic lens aberration simulation
- **Screen Curvature** - Rounded container edges simulating the convex glass tube
- **Monochrome Modes** - Classic terminal phosphor styles including:
  - White phosphor (classic monochrome)
  - Amber phosphor (vintage terminal)
  - Green phosphor (classic computer monitor)

All CRT settings persist per device and include preset management with save/load functionality.

### 🔧 Fixes

#### macOS / Homebrew Installation
- **Fixed macOS Homebrew installations** 
  - Resolved issue where app couldn't write data files (logs, cache, settings)
  - Fixed asset loading errors on macOS

## [1.0.0-alpha.3](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.3) - 2025-12-11

### ✨ Features
- **WebGL CRT Emulation**: Added realistic CRT display emulation with phosphor pattern effects and CSS/WebGL toggle option
- **Navigation Rail**: Implemented new left navigation rail component with improved layout for device components and settings view

### 🐛 Bug Fixes  
- **Cross-Platform Paths**: Converted Windows-style backslashes to forward slashes throughout codebase for cross-platform compatibility
- **Error Messages**: Improved error logging and alert messages for device connection issues, making troubleshooting easier
- **Homebrew Release**: Fixed Homebrew formula update workflow to properly commit and push changes

## [1.0.0-alpha.2](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.2) - 2025-12-02

### 🍺 Homebrew Distribution (macOS)

This release adds **macOS Homebrew distribution support** with native builds for both Apple Silicon (M1/M2/M3) and Intel Macs.

- ✅ Native ARM64 (Apple Silicon) and x64 (Intel) support
- ✅ Automatic formula updates when new releases are published

## [1.0.0-alpha.1](https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-alpha.1) - 2025-12-02

First early release alpha!  This build won't work with your TeensyROM unless you have a special FW version which is due to release soon.  Contact me for a copy if you want to try it.

> Note: Only Windows has been tested so far...
