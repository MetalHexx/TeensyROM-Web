---
name: cli
description: 'Routing reference for the TeensyROM CLI (src/apps/cli), the terminal client that ships inside tr-web with the engine. Use when working on, running, testing or packaging the CLI, or when a task mentions TeensyRom.Cli, the engine lifecycle (start, restart, stop), the ~/.teensyrom home, or the CLI API client. NOT for engine internals — use backend-architecture; NOT for building a release — use release or release-local.'
---

# CLI Skill

Routing reference for the TeensyROM CLI, the terminal client of the engine's API, built from `src/apps/cli`.

## When to Use This Skill

- Working on, running, testing, or packaging the CLI (`src/apps/cli`)
- Starting, restarting, or stopping the engine through the CLI, or working out why an engine did or did not start
- Questions about the `~/.teensyrom` home, `TEENSYROM_DATA_DIR`, or which files the CLI and the engine write
- Regenerating or reading the CLI's API client
- Following device logs from a CLI listener through the log hub

**Not for**: engine internals (use `backend-architecture`); building a release (use `release` or `release-local`).

## Overview

- **One tool, one version**: the CLI ships with the engine and the web app as one package, and the engine and the CLI share `<Version>` in `src/apps/Version.props`.
- **Client of the API only**: the CLI calls the engine's HTTP API and its log hub. It never references an engine project.
- **Grammar**: `trom <noun> <verb>`, with the nouns `device`, `file`, `index`, `settings`, `engine`, `chipsynth` and `path`, plus the top-level `init` (an agent's orientation report) and `wait <duration>` (a cross-platform timer). `trom` alone opens the TUI. Every command takes `--json`; results go to stdout and diagnostics to stderr; exit codes are 0–5; no command prompts outside a terminal; `-` reads paths from stdin.
- **Orientation**: `trom init` starts (or replaces) the engine like any engine command, then reports versions, engine, web UI, devices, storage and index state, commands and problems; it changes nothing. A failed engine start is a problem in the report, and only then does it exit 3. When the engine runs but does not serve the web UI, `problems` says why: for a source engine whose `wwwroot` (under the API project) has no `index.html`, the front end was never built, so run `pnpm run build:frontend` from `src/`, then `trom engine stop` and `trom init`.
- **Wait**: `trom wait <DURATION>` accepts `45s`, `3m`, `3m20s`, `1h2m3s` (case-insensitive) and clock strings, where `3:20` is minutes:seconds and `00:03:20` hours:minutes:seconds, optionally with fractional seconds (`00:03:20.5000000`). The range is 1 second to 6 hours; anything else exits 2. It never starts the engine; Ctrl+C exits 1; `--json` writes `{"waited":"00:03:20"}`, otherwise stdout stays empty.
- **Full file records**: `file launch` and `file random` write the engine's full file record in their JSON; `file search` and `file ls` stay compact (and include `playLength`) unless given `--full`. Fields the engine leaves null are omitted (for example `avgRating` for an unrated file), and `title`/`creator` in the full record are the engine's values, which for games, images and firmware can differ from the compact form's labels.
- **Stderr under `--json`**: stderr may end with one compact JSON object, either the error `{"error":{"code","exitCode","message","details"?}}` or a notice `{"notice":{"code","message","device","deviceId","storage","fix"}}`. `details` (`path`, `device`, `attempts`, `possibleCauses`) is present only for errors that have one, such as a directory that was not found after three reads. Stdout stays the bare result.
- **Index notice**: `file search` and `file random` read only what the engine has cached until a full index exists. On a storage whose index is incomplete they add a one-line notice on stderr (code `indexIncomplete`) naming the device, the storage and the exact `trom index build --device <name> --storage <sd|usb>` command; exit code and stdout are unchanged, and a fully indexed storage gets no notice. `device list` (and `--json`) reports this per storage as `sdIndexed` and `usbIndexed`, taken from the engine's `indexExists`.
- **Directory reads**: `file ls` and the parent lookup behind `file launch`, `favorite` and `unfavorite` retry a failed directory read (the engine answers 404) up to two more times, because a stale device link fails the first reads and heals on a later one. A directory that still fails exits 5 with "not found, or the device did not answer".
- **Engine lifecycle**: a packaged CLI starts the engine from beside itself; from source, the CLI builds the engine and starts it. A running engine whose version or build differs from the CLI's is restarted. `trom engine stop` shuts the engine down. Only one engine runs per home (the lock is `<home>/api/engine.lock`), and the engine keeps running after the CLI exits until it is stopped.
- **Device-free commands**: `chipsynth`, `settings`, `path`, `wait`, `engine status`, `engine stop`, and the help and version flags (`-h`/`--help`, `-v`/`--version`) run without starting an engine.
- **Home**: the CLI keeps its state in `~/.teensyrom/cli` and the engine keeps its in `~/.teensyrom/api`. `TEENSYROM_DATA_DIR` moves the whole home; set it to a temp folder whenever you run the CLI by hand during development.
- **Source runs**: from source, the CLI rebuilds and restarts the engine when the engine's sources have changed, recording the sources it built from in `<home>/cli/source-engine.json`. A source-mode engine is built and run as Release (`bin/Release`) so an install from source runs what a user should; developers get Debug by setting `TROM_ENGINE_CONFIGURATION=Debug` (any other value means Release). The recorded sources include the configuration, so a checkout that only has a Debug build rebuilds and restarts into Release on the next engine command, and switching the variable switches the engine the same way. The CLI passes the engine `--webroot` pointing at the API project's `wwwroot`, and it serves the built front end from there. The source fingerprint covers only the API and `Version.props`, so after a CLI-only change stop the engine (or use a fresh `TEENSYROM_DATA_DIR`) to relaunch it.
- **Windows file locks**: on Windows a running engine locks the DLLs in its `bin/Release` folder (`bin/Debug` when `TROM_ENGINE_CONFIGURATION=Debug`). Stop it with `trom engine stop` (from source, run `dotnet run --project apps/cli/src/TeensyRom.Cli -- engine stop` in `src/`) before you build the engine yourself, for example for engine tests or `generate-api-client.ps1`.
- **Non-interactive shells**: without a terminal, a direct command runs and exits instead of showing the menu.
- **Log following**: a listener calls the log hub's `Subscribe` and `Unsubscribe` on `/api/logHub`, and lines arrive as `LogProduced`.
- **File verbs**: `file upload` and `file download` copy between this computer and the TeensyROM; `file upload --launch` launches the one file once it lands. `file next` and `file previous` step through the folder, search or shuffle the last launch came from; `file pause` and `file stop` control playback. `file banned` and `file unban` list and lift bans and take no `--device`, since bans are engine-wide.
- **Copy conventions**: `--to` names the destination, the device folder for upload and the local folder for download. Download defaults to the current folder. Upload with no paths sends the current folder's contents, and asks first unless `--yes` (the guard). A copy replaces a same-named file at the destination. An upload's first admitted file resets the device, which stops playback. Upload requires `--to`.
- **Last launch and the player**: each TeensyROM's last launch is kept in `<home>/cli/last-launch.json`. The player restores its state from that file and writes every change through, so `next`, `previous`, `pause`, `stop` and `wait --device` carry on across processes.
- **Wait and pause**: `wait --device <name>` holds the countdown while that TeensyROM's song is paused through trom, reading the last-launch record. Pauses made in the web app aren't seen.
- **Index build**: `index build` indexes every available storage, or the one `--storage` names. `index build --all` indexes every storage on every connected TeensyROM.
- **Engine logs**: `engine status --json` reports `logFolder` and `logFile`, the folder the engine writes to and its newest log file. `logFile` is absent unless an engine answers and has written one.
- **Hand-written client code**: `Api/TeensyRomApiClient.Upload.cs` is a hand-written partial of the API client, next to the generated `Api/Generated/`. Regeneration never touches it.
- **Rate limits**: only full scans of `/api/devices` (device discovery) are rate limited, to one per 5 seconds; a request over the limit is answered 503. A plain listing is never limited.

## Routing

Paths are relative to `src/` unless noted.

| Task | Where to go |
|------|-------------|
| CLI code: commands, engine lifecycle, services | `apps/cli/src/TeensyRom.Cli` (commands under `Commands/`, engine lifecycle under `Engine/`, home rules in `Common/TeensyRomHome.cs`) |
| API client | Regenerate with `pnpm run generate:cli-api-client` (runs `apps/cli/scripts/generate-api-client.ps1`). Never hand-edit `apps/cli/src/TeensyRom.Cli/Api/Generated/`. |
| Build and tests | `dotnet build apps/cli/TeensyRom.Cli.sln`; unit tests `dotnet test apps/cli/src/TeensyRom.Cli.Tests`; real-engine suite `dotnet test apps/cli/src/TeensyRom.Cli.Tests.Integration --filter "Category!=Hardware"`. The real-engine suite drives an engine through its `TestEngine` helper. `Category=Hardware` marks bench-only scenarios that need a TeensyROM attached. CI runs these in the repo-root `.github/workflows/pr-cli-checks.yml`. |
| Packaging the CLI | `distribution` skill (package layout, Homebrew formula); `release` for an official release, `release-local` for a local test build |
| Engine endpoints and hubs | `backend-architecture`; live debugging of a running engine against hardware: `api-live-debug` |
| Adding a reference file to this skill | `make-skill-template` |

## References

None yet. Future reference files go in `references/` beside this file.
