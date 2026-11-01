# TeensyROM Suite

<img width="2557" height="1301" alt="Trom UI playing a SID" src=".github/images/hero-screenshot.png" />

TeensyROM Suite is everything you need to run your Commodore 64 through a [TeensyROM cartridge](https://github.com/SensoriumEmbedded/TeensyROM): launch games, SID music, demos and images from massive collections, remotely and in an instant.
Use it in your browser, from your terminal, from Claude Code or from your own code, on Windows, macOS and Linux.

## Four apps, one suite

<table>
  <tr>
    <td align="center" width="50%" valign="top">
      <a href="docs/trom-ui.md"><img src=".github/images/hero-screenshot.png" alt="Trom UI" width="320"></a><br>
      <b><a href="docs/trom-ui.md">Trom UI</a></b><br>
      Browse and search your cart, launch games, demos, SIDs and images from any browser, and stream it all like a retro media service.
    </td>
    <td align="center" width="50%" valign="top">

> 🖼️ **Image placeholder:** Trom Terminal main menu

<b><a href="docs/trom-terminal.md">Trom Terminal</a></b><br>
A guided, BBS-style menu and one-line commands for launching, shuffling, searching and scripting your library.
</td>
  </tr>
  <tr>
    <td align="center" width="50%" valign="top">

> 🖼️ **Image placeholder:** Trom Agent in Claude Code

<b><a href="docs/trom-agent.md">Trom Agent</a></b><br>
Your TeensyROM companion in Claude Code: ask it to play, run timed sets, tour your library and check your setup.
</td>
    <td align="center" width="50%" valign="top">
      <a href="docs/trom-api.md"><img src=".github/images/trom-api-docs.png" alt="Trom API documentation page" width="320"></a><br>
      <b><a href="docs/trom-api.md">Trom API</a></b><br>
      Control your cart from your own scripts and tools: launch files, search your library, copy files over and set themes. It's the same server Trom UI and Trom Terminal use.
    </td>
  </tr>
</table>

## One download gets you everything

Download the package for your platform from the [releases page](https://github.com/MetalHexx/TeensyROM-Suite/releases), or install it with Homebrew on a Mac. It holds Trom API, Trom UI and Trom Terminal, and Trom Agent installs the suite for you. [Getting started](docs/getting-started.md) takes you from download to your first launch.

## Highlights

### DJ Mixer

<img width="2501" height="1227" alt="DJ Mixer with a tune loaded on each deck" src=".github/images/dj-mixer.png" />

Two decks of SID music, played live through real C64s. Every note is made by the SID chip itself, and none by an emulator.

- Shape each voice, the filter and the key of a tune
- Loop, cue and scratch
- See each deck's BPM, with loops that land on the beat
- Build sets and mix between decks
- See at a glance how well two keys fit
- Map any control to your MIDI controller

[Read about the DJ Mixer](docs/dj-mixer.md)

### Copying files and watch folders

Send files to your cart from your computer, or let a watch folder send whatever lands in it. [More in Trom UI](docs/trom-ui.md#copy-files-to-your-cart).

### Themes

Pick the colors of your C64's menu, tune your own and apply them to one cart or all of them. [More in Trom UI](docs/trom-ui.md#themes).

### Trom Terminal

A guided menu with a Stream Player that plays through your library, or one-line commands you can pipe into scripts. [Meet Trom Terminal](docs/trom-terminal.md).

### Trom Agent

Type `/trom` in Claude Code and ask for what you want in plain words, from a quick shuffle to a timed set. [Meet Trom Agent](docs/trom-agent.md).

## Discord

Join the TeensyROM community on Discord for support, discussions, and updates:

<p align="left">
  <a href="https://discord.com/invite/ubSAb74S5U">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord&logoColor=white" alt="Join TeensyROM Discord">
  </a>
</p>

## Contributing

This project is mostly a one-person effort, and ideas and testing help are welcome. Come talk to me on Discord, or tag @hExx. To build from source, see [contributing](docs/contributing.md).

## Acknowledgments

- **Travis Smith / Sensorium** - Creator of the [TeensyROM Hardware](https://github.com/SensoriumEmbedded/TeensyROM)
- **Jens-Christian Huus / DeepSID** - [DeepSID Repo](https://github.com/Chordian/deepsid) SID metadata sourced from this projects database.
- **StatMat / Oneload64** - [Oneload64](https://oneload64.github.io/) game image metadata sourced from this project.
- **HVSC Community** - For the amazing SID music collection and SID metadata (STIL) resources.
- **LaLa's SIDList** - [SIDList](https://www.transbyte.org/SID/SIDlist.html) For the handy CSV format HVSC STIL file metadata.
- **Jamie Honn (JTHonn)** - Extensive early Windows and Mac testing.

## Legacy projects

- [TeensyROM-UI](https://github.com/MetalHexx/TeensyROM-UI): the original Windows desktop app.
- [TeensyROM-CLI](https://github.com/MetalHexx/TeensyROM-CLI): the original command-line tool.

## License

See [LICENSE.md](LICENSE.md) for details.

<p align="center">
  <img
    src=".github/images/teensyrom-logo.png"
    alt="TeensyROM logo"
    width="25%"
  />
</p>
