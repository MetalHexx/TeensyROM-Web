# TeensyROM Web

A mashup of ancient hardware and modern technology, this cross-platform desktop app controls your Commodore 64/128 using the [TeensyROM Hardware Cartridge](https://github.com/SensoriumEmbedded/TeensyROM). Unlock lightning-fast exploration and instant remote launching of your favorite games, SID music, scene demos, and images—all from massive file collections stored on your TeensyROM cartridge.

> **Note**: This project is the spiritual successor to the original [TeensyROM-UI WPF desktop application](https://github.com/MetalHexx/TeensyROM-UI). It is a cross-platform Electron desktop app for Windows, macOS, and Linux. Electron owns the application window and runs the local .NET device service privately; there is no browser or fixed localhost port to manage.

<img width="2557" height="1301" alt="image" src=".github/images/hero-screenshot.png" />

<table style="width: 100%; border:none;">
  <tr>
    <td align="center">
      <b>Launch Games and SIDs</b><br>
      <div style="width: 250px; height: 200px; margin: 0 auto; overflow: hidden;">
        <img src=".github/images/hero-screenshot.png" object-fit: cover;">
      </div>
    </td>
    <td align="center">
      <b>With CRT Emulation</b><br>
      <div style="width: 250px; height: 200px; margin: 0 auto; overflow: hidden;">
        <img width="2553" height="1297" alt="image" src=".github/images/crt-emulation.png" style="width: 105%; height: 105%; margin: 0 auto; overflow: hidden;"/>
      </div>
    </td>
    <td align="center">
      <b>And Full Screen Immersion</b><br>
      <div style="width: 250px; height: 200px; margin: 0 auto; overflow: hidden;">
        <img width="2550" height="1437" alt="image" src=".github/images/fullscreen-immersion.png" style="width: 90%; height: 90%; margin: 0 auto; overflow: hidden;"/>
      </div>
    </td>
  </tr>
</table>

<br>

## 📱 Mobile Demo

<p align="center">
  <a href="https://www.youtube.com/shorts/hcfaokI_lHw" target="_blank">
    <img src="https://img.youtube.com/vi/hcfaokI_lHw/maxresdefault.jpg" alt="Watch TeensyROM Web Phone Demo" width="480" />
  </a>
  <br>
  <em>▶ Watch the phone demo</em>
</p>

## ✨ Features

### Media Player & Playback
- **File Launch**: Remote launching of Games, Demos, SID music, and images
- **Random Launch**: Random launching of all file types across storage devices.
- **Playback Controls**: Play, pause, stop, next, and previous navigation
- **Launch Modes**: 
  - **Sequential Mode**: Navigate through files in directory order
  - **Shuffle Mode**: Random file playback with customizable scope and filters
- **Progress Bar**: Visual playback progress with elapsed/total time
- **Auto-Play**: Continuous playback through directories or shuffle queues
- **File Compatibility**: Real-time validation and error feedback for incompatible files
- **Incompatible File Auto-Advance**: Automatically skips incompatible files and advances to the next one
- **Custom Play Timer**: Custom auto-advance timer for continuous streaming of games, demos and images.
- **Current File Info**: Display file metadata, creator, release info, and status

### Video Integration & CRT Emulation
> **Note**:  The video integration is completely optional, but highly recommended!
- **Modern Meets Retro**: Seamlessly blend modern streaming control overlays with authentic CRT Video aesthetics to recreate the authentic Commodore 64 experience
- **Live Video Capture**: Real-time video stream from connected video capture devices
- **WebGL-Powered Rendering**: Hardware-accelerated GPU effects for authentic CRT emulation
- **Authentic CRT Effects**:
  - **Scanlines**: Horizontal scanlines with size and intensity controls.
  - **Vignette**: Rounded-box edge darkening matching screen curvature
  - **Barrel Distortion**: Curved glass warping simulating CRT tube geometry
  - **Bloom**: Phosphor glow simulation for bright areas
  - **Chromatic Aberration**: RGB color separation for lens aberration simulation
  - **Screen Curvature**: Rounded container edges simulating convex glass tube
- **Phosphor Emulation**:
  - **RGB Patterns**: Aperture Grille (Trinitron), Shadow Mask (Traditional), Dot Triad (Arcade)
  - **Monochrome Modes**: White, Amber, Green terminal phosphor styles
- **Color Adjustments**: Contrast, brightness, saturation, hue for authentic retro color reproduction
- **Multiple Display Modes**:
  - **Compact Integrated View**: Watch gameplay inline within the player interface
  - **Dialog Mode**: Expanded "Theatre Style" video dialog
  - **Fullscreen Mode**: Immersive full-screen experience
- **CRT Presets**: Save and load custom CRT effect configurations
- **Auto Black Bar/Border Cropping**: GPU-accelerated detection removes black bars/borders with smooth animated transitions, PAL/NTSC aware

### Search & Filter
- **Global Cross-Device Search**: Search across all indexed files on both SD and USB storage simultaneously, returning unified results from your entire library
- **Boolean / Phrase Search**: Group phrases in quotes or add a plus for required terms/phrases E.g., `Iron +Maiden +"Aces High"`
- **Search Results View**: Dedicated view for browsing and launching search results
- **File Type Filters**: Filter by All, Games, Music, Images, or Demos

### Play History & Favorites
- **Play History Tracking**: Complete history of all launched files with timestamps
- **History Navigation**: Browse backwards and forwards through play history
- **History View**: Dedicated panel for viewing and launching files from play history.
- **Favorites System**: Mark files as favorites and toggle favorite status

### File Browser & Navigation
- **Dual Storage**: Navigate both SD and USB storage with independent directory trees
- **Directory Tree**: Collapsible tree view for hierarchical folder navigation
- **File Listings**: Virtual scrolling file lists optimized for large directories (2000+ items)
- **Breadcrumb Navigation**: Collapsible directory breadcrumb with quick navigation to parent folders
- **Browser-like Directory Nav**: Backtrack backward or forward through your directory navigation history
- **Multi-Device Views**: Simultaneous file browsing across multiple connected devices

### Mobile & Responsive Design
- **Works on Any Device**: Fully usable on any screen from the smallest smartphones to large desktop monitors
- **Touch-Optimized**: Swipe gestures, touch-friendly controls, and long-press interactions throughout
- **Adaptive Layouts**: The UI intelligently reorganizes itself for phone, tablet, and desktop screen sizes
- **No App Install Required**: Access from any device browser on your local network

### Mobile Audio Streaming
- **Wireless C64 Audio**: Stream your C64's audio straight to your phone or tablet, no cables needed
- **Configurable Audio Source**: Pick which host audio input to stream from in Settings
- **Low-Latency Playback**: Compressed streaming keeps sound in sync with what's happening on your device

### Tooltip System
- **Custom Tooltips**: Touch-friendly tooltips with long-press activation on mobile
- **Global Toggle**: Enable/disable tooltips from the header
- **CRT Overlay Compatible**: Works correctly alongside the CRT effect overlay

### Device Management
- **Auto-Discovery**: Automatic detection of TeensyROM devices via TCP (Ethernet/Wireless) and Serial (COM port)
- **Multi-Device Support**: Connect and manage multiple TeensyROM cartridges simultaneously with any mix of TCP and Serial connections
- **Real-Time Device Logs**: Live device log debug monitoring of backend / serial operations
- **Device Controls**: Ping and reset operations across all connected devices
- **Storage Indexing**: Index SD and USB storage for fast file access, random launches and search

### API & Integration
- **RESTful API**: Complete REST API with Scalar documentation (available at `/scalar/v1`)
- **OpenAPI Integration**: Auto-generated TypeScript client from .NET API specification
- **SignalR Hubs**: Real-time bidirectional communication for device events and logs
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## 🚧 Roadmap

Features planned for future releases:

- **SID DJ Controls**: Advanced controls for live SID music mixing and performance
- **MIDI Integration**: Full application control from MIDI devices
- **Cross-Storage Random Launch**: Random selection across both SD and USB storage simultaneously
- **Playlists**: Create, manage, and play custom playlists of games, music, and images
- **File Transfer**: Drag-and-drop file uploads to device storage with progress tracking
- **Theme System**: Light/dark mode with custom color schemes and Material theme customization
- **Keyboard Controls**: Keyboard shortcuts for playback, navigation, and common operations
- **Directory Pinning**: Search/shuffle scoped to a specific directory and children.

## 🏗️ Architecture

TeensyROM is a desktop application combining:

- **Desktop shell**: Electron
  - Starts and stops the bundled backend, selects an ephemeral loopback port, and opens the application window
  - Keeps the Angular renderer sandboxed with no Node.js APIs exposed

- **Backend**: .NET 9 local API
  - Cross-platform serial and network device management
  - Stores user-writable settings and transfer staging in the OS application-data directory

- **Frontend**: Angular 19 with Nx monorepo architecture
  - Renderer served by the local API and displayed by Electron

## 🎯 Desktop packaging

The Electron package bundles the Angular app and the self-contained .NET backend into one desktop application. Build it from `src/` on each target platform:

```bash
pnpm desktop:start        # local desktop development run
pnpm desktop:package      # host-platform installer/package
pnpm desktop:package:dir  # unpacked smoke-test build
```

The API remains independently runnable for automation and integrations, but the supported interactive experience is the desktop app.

## 🚀 Quick Start

### Prerequisites

- **TeensyROM Hardware**: You'll need a [TeensyROM cartridge](https://github.com/SensoriumEmbedded/TeensyROM) connected to your computer
- **Firmware**: TeensyROM firmware **v0.7.1** or higher (required for both Serial and TCP connectivity)

### Installation & Setup

#### Windows

1. Download the Windows installer (`.exe`) from the [Releases page](https://github.com/MetalHexx/TeensyROM-Web/releases/latest).
2. Run the installer and open `TeensyROM` from the Start menu.

> **Note**: Windows may show a security warning. Click "More info" then "Run anyway".

#### macOS

1. Download the `.dmg` matching your Mac from the [Releases page](https://github.com/MetalHexx/TeensyROM-Web/releases/latest).
2. Drag `TeensyROM` to Applications, then open it from Applications.

> **Note**: macOS may block the app on first run. Go to System Settings > Privacy & Security and click "Open Anyway".

#### Linux

1. Download the `.AppImage` or `.deb` package from the [Releases page](https://github.com/MetalHexx/TeensyROM-Web/releases/latest).
2. Install or mark the AppImage executable, then run `TeensyROM` from your application launcher.

## 🔌 Device Discovery & Connectivity

TeensyROM Web supports automatic discovery and connection to TeensyROM devices using both **Ethernet/Wireless (TCP)** and **Serial (COM port)** connectivity. Multiple devices can be connected simultaneously using any combination of connection types.

### How to Connect
- On startup, the backend API automatically scans for TeensyROM devices on your network (TCP) or USB (Serial) connnected devices.
- Discovered devices are connected to the backend API automatically
- Device IPs and COM ports are remembered for faster reconnection on subsequent app launches
- When you start up the Web UI, this will also trigger a fast device discovery scan for remembered devices
- Refreshing the browser will also re-trigger fast device discovery for remembered devices
- When connecting new devices, manually trigger a full device discovery scan from the Web UI device panel

### Ethernet/TCP Devices

TeensyROM devices with Ethernet / TCP connectivity are discovered automatically through network port scanning:

- The API scans the same subnet it's running on for TeensyROM devices
  - So if the Host the API is running on 192.168.1.33, it will scan 192.168.1.0/24 for TR devices on port `2112`
- Full device scanning over the network can take anywhere from 900ms to 30s depending on the number of cores on your host machine.
- Previously connected devices will always be prioritized for fast reconnection on subsequent scans

**Setting Up Ethernet on TeensyROM:**

- You'll need to configure your TeensyROM device to enable the Ethernet TCP listener. 
- If setting up multiple TeensyROM devices:
  - Ensure each device has a unique MAC address. By default, TR devices ship with the same MAC address
  - Ensure each device has a unique IP address.
- Instructions for configuring Ethernet on TeensyROM can be found here:
📖 [External App Control via TCP](https://github.com/SensoriumEmbedded/TeensyROM/blob/main/docs/Ethernet_Usage.md#external-app-control-via-tcp)

> 💡 **Performance Tip:** <br>
For optimal performance when loading extra large CRT files, set a static IP address on your TeensyROM device.  Large CRT files require the TR device to reset into `Minimal Boot` firmware mode, which can take several seconds.  A static IP will reduce the TR reset delays caused by DHCP IP discovery when switching FW modes.  

### Serial/COM Port Devices

- TeensyROM devices connected via USB are automatically discovered and connected to through COM port scanning.
- If both Serial and TCP are connected for a given device, the application will prefer TCP and drop the Serial connection.

> ⚠️ **Performance Tip:** <br>
If you **disconnect your ethernet cable or NFC reader device**, I recommend you disable `TCP Listener` and/or `Host Serial Device` on your TeensyROM. Unused connection modes can cause delays as the TR device times out searching for them.  This is particularly impactful when launching extra large CRT files which triggers a FW mode swap to `Minimal Boot` FW mode on the TR. While the app usually handles this gracefully, disabling unused modes will greatly improve the overall performance and connection reliability.

### Multi-Device Operation

The TeensyROM Web application supports connecting to and interacting with multiple devices simultaneously:

- Mix TCP and Serial connected devices if needed
- Each connected device will render unique panels to allow you to interact with in parallel (DJs, let's go!)
- All TR devices are tagged with an ID `cart-tag.txt` on your device storage to uniquely identify them -- keep this file.
- The tags allows for identification of specific devices.  This ensures your index and preferences are preserved
- Devices are remembered across connection types (e.g., switching from TCP to Serial)

### Accessing the Application

The desktop application opens its own window and does not expose a fixed port.
For an API-only development run, the startup log prints the random loopback URL;
append `/scalar/v1` to that address for Scalar API documentation. To use a
specific local endpoint for automation, set `TEENSYROM_URL` explicitly (for
example, `http://127.0.0.1:45123`).

## 🤝 Contributing

This project is currently in active development. Come talk to me about contributions.  It's mostly a one-person project at the moment, but I'm open to ideas and testing help!  Tag @hExx to reach me.

## 💬 Discord

Join the TeensyROM community on Discord for support, discussions, and updates:

<p align="left">
  <a href="https://discord.com/invite/ubSAb74S5U">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord&logoColor=white" alt="Join TeensyROM Discord">
  </a>
</p>

## 🙏 Acknowledgments

- **Travis Smith / Sensorium** - Creator of the [TeensyROM Hardware](https://github.com/SensoriumEmbedded/TeensyROM)
- **Jens-Christian Huus / DeepSID** - [DeepSID Repo](https://github.com/Chordian/deepsid) SID metadata sourced from this projects database.
- **StatMat / Oneload64** - [Oneload64](https://oneload64.github.io/) game image metadata sourced from this project.  
- **HVSC Community** - For the amazing SID music collection and SID metadata (STIL) resources.
- **LaLa's SIDList** - [SIDList](https://www.transbyte.org/SID/SIDlist.html) For the handy CSV format HVSC STIL file metadata.
- **Jamie Honn (JTHonn)** - Extensive early Windows and Mac testing.

## 🔗 Related Projects

- [TeensyROM Hardware](https://github.com/SensoriumEmbedded/TeensyROM) - The hardware cartridge this application controls
- [TeensyROM-UI](https://github.com/MetalHexx/TeensyROM-UI) - The original Windows desktop UI application
- [TeensyROM-CLI](https://github.com/MetalHexx/TeensyROM-CLI) - Cross-platform command-line interface for TeensyROM device management

## 📜 License

See [LICENSE.md](LICENSE.md) for details.

<p align="center">
  <img
    src=".github/images/teensyrom-logo.png"
    alt="image"
    width="25%"
  />
</p>
