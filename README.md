# TeensyROM Web

A cross-platform web application for controlling your Commodore 64/128 through the [TeensyROM Hardware Cartridge](https://github.com/SensoriumEmbedded/TeensyROM). This modern web-based interface enables lightning-fast exploration and remote launching of Games, SID music, Scene Demos, and Images from large file collections.

> **Note**: This project is the spiritual successor to the original [TeensyROM-UI WPF desktop application](https://github.com/MetalHexx/TeensyROM-UI). While the original application provided a Windows-only desktop experience, this new implementation offers cross-platform compatibility through a modern web architecture that can run on Windows, macOS, and Linux.

<img width="2506" height="1280" alt="image" src="https://github.com/user-attachments/assets/c716e1a7-1a63-4dde-8702-c387812b5f37" />

## ✨ Features

### Media Player & Playback
- **File Launch**: Remote launching of games, SID music, and images
- **Random Launch**: Random launching of all file types across storage devices.
- **Playback Controls**: Play, pause, stop, next, and previous navigation
- **Launch Modes**: 
  - **Sequential Mode**: Navigate through files in directory order
  - **Shuffle Mode**: Random file playback with customizable scope and filters
- **Progress Bar**: Visual playback progress with elapsed/total time for SID music
- **Auto-Play**: Continuous playback through directories or shuffle queues
- **File Compatibility**: Real-time validation and error feedback for incompatible files
- **Current File Info**: Display file metadata, creator, release info, and status

### Search & Filter
- **Full-Text Search**: Search across all indexed files on SD or USB storage (per storage type)
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
- **Breadcrumb Navigation**: Directory breadcrumb with quick navigation to parent folders
- **Browser-like Directory Nav:**: Backtrack backward or forward through your directory navigation history
- **Multi-Device Views**: Simultaneous file browsing across multiple connected devices

### Device Management
- **Auto-Discovery**: Automatic detection of connected TeensyROM devices via serial ports
- **Multi-Device Support**: Connect and manage multiple TeensyROM cartridges simultaneously
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

- **Official Releases**: Installable binaries without need to compile source
- **SID DJ Controls**: Advanced controls for live SID music mixing and performance
- **MIDI Integration**: Full application control from MIDI devices
- **Cross-Storage Random Launch**:  Random selection across both SD and USB storage
- **Cross-Storage Search**: Search across both SD and USB storage simultaneously
- **Playlists**: Create, manage, and play custom playlists of games, music, and images
- **File Transfer**: Drag-and-drop file uploads to device storage with progress tracking
- **Settings Management**: User preferences, default behaviors, and application configuration
- **Theme System**: Light/dark mode with custom color schemes and Material theme customization
- **Keyboard Controls**: Keyboard shortcuts for playback, navigation, and common operations
- **Cross Storage Scope Selection**: Search/shuffle across all connected device storage (per device, per storage type)
- **Scope Selection**: 
  - **Storage Scope**: Search/shuffle across all storage devices SD or USB storage
  - **Directory Pinning**: Search/shuffle scoped to a specific directory and children.

## 🏗️ Architecture

TeensyROM Web is built as a hybrid application combining:

- **Backend**: .NET 9 Web API 
  - Cross-platform serial port management

- **Frontend**: Angular 19 with Nx monorepo architecture
  - Frontend Web Application that communicates with API

## 🎯 Deployment Modes

This application can be deployed in two ways:

1. **Standalone Web Application** - Full-stack application with integrated API and web UI
2. **API-Only Mode** - Headless API server for integration with custom clients or automation

## 🚀 Quick Start

_For now, if you want to try it out, you'll have to compile and run from source. An installable binary release will be available later in Q4._

### Prerequisites
- .NET 9 SDK
- Node.js 18+ (includes npm)
- PNPM package manager
- Talk to Travis or I for a pre-release FW if you want to try this out.

### Install Node.js and npm

Node.js includes npm (Node Package Manager) which is required to install PNPM.

#### Windows

Install Node.js LTS using Windows Package Manager (winget):

```bash
winget install OpenJS.NodeJS.LTS
```

After installation, restart your terminal to ensure npm is available in your PATH.

#### macOS

_Coming soon_

#### Linux

_Coming soon_

### Install PNPM

This project uses PNPM as the package manager. Install it globally using npm:

```bash
npm install -g pnpm
```

After installation, restart your terminal to ensure pnpm is available in your PATH.

Or using other installation methods from [pnpm.io](https://pnpm.io/installation).

### Setup Instructions

```bash
# Clone the repository
git clone https://github.com/MetalHexx/TeensyROM-Web.git
cd TeensyROM-Web/src

# Install Node.js dependencies
pnpm install
```

### Running the Application

You'll need two terminal windows to run both the backend API and frontend simultaneously.

**Terminal 1 - Start the API Backend:**
```bash
cd TeensyROM-Web/src/apps/api/src/TeensyRom.Api
dotnet run
```

**Terminal 2 - Start the Frontend:**
```bash
cd TeensyROM-Web/src
pnpm start
```

### Access the Application

**Web UI:**
```
http://localhost:4200
```

**API Documentation (Scalar):**
```
http://localhost:5168/scalar/v1
```

## 🤝 Contributing

This project is currently in active development. Come talk to me about contributions.  It's mostly a one-person project at the moment, but I'm open to ideas and testing help!

## 💬 Discord

Join the TeensyROM community on Discord for support, discussions, and updates:

<p align="left">
  <a href="https://discord.com/invite/ubSAb74S5U">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord&logoColor=white" alt="Join TeensyROM Discord">
  </a>
</p>

## 🙏 Acknowledgments

- **Travis Smith / Sensorium** - Creator of the [TeensyROM Hardware](https://github.com/SensoriumEmbedded/TeensyROM)
- **Jens-Christian Huus / DeepSID** - [DeepSID Repo](https://github.com/Chordian/deepsid) lots of metadata sourced from this project.
- **StatMat / Oneload64** - [Oneload64](https://oneload64.github.io/) lots of metadata sourced from this project.

## 🔗 Related Projects

- [TeensyROM Hardware](https://github.com/SensoriumEmbedded/TeensyROM) - The hardware cartridge this application controls
- [TeensyROM-UI](https://github.com/MetalHexx/TeensyROM-UI) - The original Windows desktop UI application
- [TeensyROM-CLI](https://github.com/MetalHexx/TeensyROM-CLI) - Cross-platform command-line interface for TeensyROM device management

## 📜 License

See [LICENSE.md](LICENSE.md) for details.

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/d330fa67-5902-4765-ad32-b56cfd6bec0b"
    alt="image"
    width="25%"
  />
</p>

