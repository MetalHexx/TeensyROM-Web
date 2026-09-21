---
name: api-live-debug
description: 'Live-debug the running .NET API against real TeensyROM hardware from Claude Code: pristine restart, capture the API log stream, and attach a scriptable debugger (netcoredbg) to set breakpoints, read locals, evaluate expressions, and step — all driven over a local HTTP control port. Use when chasing a runtime bug in the API that needs variable state or a stack at a specific moment, not just log lines.'
---

# API Live Debug

Attach a real debugger to the running API and drive it from the terminal — no IDE.
Built during the CONNECTION-2 large-launch-loop investigation (2026-09-20).

## When to Use This Skill

- A bug in the API only shows against real hardware and log lines aren't enough
- You need a stack or variable state at a precise moment (a breakpoint), or a
  log of variable state every time a line runs without pausing (a tracepoint)
- You want a pristine API state — no remembered devices, caches, or settings

## Pieces

| Piece | Path | Role |
|---|---|---|
| Debugger | `tools/netcoredbg/netcoredbg.exe` (gitignored — see Setup) | Samsung's open-source .NET debugger, speaks the Debug Adapter Protocol |
| Driver | `scripts/dbg.mjs` | Spawns netcoredbg, attaches to the API pid, exposes an HTTP control port |
| Log tap | `scripts/logtap.mjs` | Subscribes to the API's SignalR log hub and appends timestamped lines to a file |

## Setup (once per machine)

```
gh release download 3.2.0-1092 -R Samsung/netcoredbg -p netcoredbg-win64.zip -D .claude/skills/api-live-debug/tools --clobber
unzip -qo .claude/skills/api-live-debug/tools/netcoredbg-win64.zip -d .claude/skills/api-live-debug/tools
```

`tools/` is gitignored. Close Visual Studio / VS Code before attaching — a process
takes one debugger at a time.

## Pristine restart

The Debug build's `bin/.../Assets/System` holds live state: `Config/Settings.json`,
`Config/ConnectionRecords.json` (discovery cache),
`Cache/Sd-<chipId>.json` (storage indexes), `Logs/`. Deleting the whole `bin`
folder gives a truly pristine API — it self-heals settings on first run and
indexes directories on demand (`GetDirectory`), so no full index is needed.

```
Remove-Item -Recurse -Force apps/api/src/TeensyRom.Api/bin
dotnet build apps/api/src/TeensyRom.Api
dotnet run --no-build --project apps/api/src/TeensyRom.Api   # port 213
```

**Startup runs discovery by itself** (`ApplicationBootstrap: Scanning for devices...`,
right after "Now listening") — the start occasion confirms cached endpoints by chip id and
only falls back to a full discovery sweep on a miss. A *pristine* start has no cache at all
(the whole `bin` folder, and `ConnectionRecords.json` with it, is gone), so it always takes
the miss path: opens every COM port and sweeps the /24, ~18 s with two units on serial, then
writes a fresh `ConnectionRecords.json`. The only other occasion that contacts a device is the
device toolbar's Discover Devices action — `GET /api/devices/?FullScan=true` (that call *is*
discovery). The UI's own bootstrap call (`GET /api/devices/`, `FullScan=false`) is a page-load
listing, not a discovery: it returns whatever the manager already knows without opening a
port. The console shows none of this — app log lines go only to the file log and the SignalR
hub.

## Log tap

```
node .claude/skills/api-live-debug/scripts/logtap.mjs <out.log>
```

Connects to `/api/logHub`, POSTs `/api/logs` to enable streaming, appends every
`LogProduced` line with a millisecond timestamp. The API also writes
`bin/.../Assets/System/Logs/Logs-<start>.txt` per run.

## Debugger driver

```
node .claude/skills/api-live-debug/scripts/dbg.mjs <netcoredbg.exe> <pid> <port> <dbg.log>
```

Attaches to the API (`Get-Process TeensyRom.Api`), then listens on
`http://127.0.0.1:<port>`. Every call is JSON in / JSON out (`curl -s`):

| Call | Body | Does |
|---|---|---|
| `GET /status` | — | attached?, current stop (where + frames), breakpoints |
| `POST /bp` | `{file, line, mode: "hold"\|"trace", exprs: [..], condition}` | set/replace a breakpoint; `file` may be relative to `apps/api/src` |
| `DELETE /bp` | `{file, line}` | remove it |
| `POST /continue` `/next` `/stepIn` `/stepOut` | — | resume / step the stopped thread |
| `POST /pause` | — | break in |
| `GET /stack?levels=N` | — | stack of the stopped thread |
| `GET /locals?frame=i&depth=d` | — | locals/args of frame *i*, expanded *d* levels |
| `POST /eval` | `{expr, frame}` | evaluate an expression in a frame |
| `POST /vars` | `{ref, depth}` | expand a `variablesReference` from a previous result |
| `POST /detach` | — | detach, leave the API running |

**Modes.** A `hold` breakpoint pauses the process until you continue — the
firmware and the serial port keep running meanwhile, so ping windows can expire
and ports can re-enumerate underneath you. A `trace` breakpoint evaluates its
`exprs`, writes `[TRACE file:line] expr = value | …` to `dbg.log`, and resumes in
a few milliseconds — use it on timing-sensitive paths (handshake, discovery).

## Gotchas

- **Primary-constructor parameters are invisible to `eval`.** `class Foo(IBar bar)`
  stores `bar` in a compiler-hidden field; `eval bar` fails with "does not exist in
  the current context" and it is not listed under `this` either. Classic fields,
  method parameters, and locals all work. Pick a breakpoint line inside a method
  that has what you need as a local or parameter.
- **Pass file paths with forward slashes** in the JSON body; backslashes get
  mangled by shell quoting on the way to `curl`.
- **Frames without symbols print as `?:0`** (framework, NuGet packages). Only the
  `TeensyRom.*` assemblies carry PDBs in a Debug build.
- **A held breakpoint blocks the HTTP request that tripped it** — the caller waits
  until you `POST /continue`. Fine for a curl; a UI call will look hung.
- **Attached, the debugger slows exception-heavy paths badly.** Every first-chance
  exception is reported to the debugger even with no exception breakpoints set.
  The TCP subnet sweep (254 refused connects, one `SocketException` each) went from
  ~2 s to 28 s. Port-open retries and port-closed handling on the launch path throw
  too. Use tracepoints for *sequence and state*; take *timings* from a run with the
  debugger detached (the log tap alone gives millisecond stamps).
- **Discovery bypasses the command pipeline.** `CartFinder` and the strategies talk
  to the port through `TRStreamExtensions` directly; tracepoints in
  `CommunicationPortBehavior` see only MediatR commands.
- **The API no longer sends `FwCheck` or `Ping` on its own** — if you see `64 E0` in a
  trace it came from your probe, not the API; discovery and recovery both confirm a
  device with the version command (`64 76`) instead.
- **Chasing a "device not found" bug?** Serial recovery and discovery find a device's
  current port by chip id via `TeensyPortLocator`
  (`apps/api/src/TeensyRom.Core.Serial/Usb/TeensyPortLocator.cs`), which classifies
  COM ports by USB VID/PID before opening any of them — breakpoint there, not just
  in `CartFinder` or `DeviceRecovery`, when a port isn't being matched.

## Proven round-trip (2026-09-20)

Breakpoint on `StartLogsEndpoint.cs:22` → started the log tap (its `POST /api/logs`
tripped it) → `GET /status` showed HELD with the stack → `GET /locals?depth=2` and
`POST /eval` read state → `POST /continue` → the tap's POST returned 200 → `DELETE /bp`.

## Worked example — the large-launch investigation (2026-09-20)

The order that worked, one step per turn against real hardware:

1. Pristine restart (above), then the log tap, then the driver. Verify the round trip
   on a harmless breakpoint before touching a device.
2. Tracepoints on the seams, so the log shows *who calls what, with what*:

   | File:line | What it shows | `exprs` |
   |---|---|---|
   | `TeensyRom.Api/Endpoints/Player/LaunchFile/LaunchFileEndpoint.cs:24` | every launch request | `r.DeviceId`, `r.StorageType`, `r.FilePath` |
   | `TeensyRom.Core.Serial/Commands/Behaviors/CommunicationPortBehavior.cs:36` | every command entering the gate | `request`, `request.DeviceId`, `request.CommunicationPort.IsOpen` |
   | `…/CommunicationPortBehavior.cs:68` | gate found minimal → reset to full | `request`, `device.Connection.Mode` |
   | `…/CommunicationPortBehavior.cs:101` | gate found busy → reset once | `request`, `busyRetries` |
   | `TeensyRom.Core.Serial/Commands/LaunchFile/LaunchFileHandler.cs:18,21,27,41,69` | handler entry, minimal-chain check, retry-token check, watch result, recovery call | `r.LaunchItem.Size`, `fromMinimal`, `ack`, `final`/`dropped`, `reason` |
   | `TeensyRom.Core.Serial/Recovery/DeviceRecovery.cs:35` | every recovery attempt starts | `reason`, `transport`, `chipId`, `ceiling` |
   | `TeensyRom.Core.Serial/Commands/Reset/ResetCommandHandler.cs:11` | explicit resets | `request.DeviceId` |
   | `TeensyRom.Core.Device/CartFinder.cs:52` | every discovery sweep starts | `_discoveryStrategies.Count()` |
   | `TeensyRom.Core.Device/DeviceConnectionManager.cs:62` | every `FindDevices` call (page load vs. full scan) | `fullScan`, `_byChip.Count` |

   `request` evaluates to `{…CommandName}` — enough to name the command. Token values
   print as decimal (`25804` = `0x64CC` = Ack).
3. Drive the API with `curl` first (discovery, a directory, the launch endpoint) and
   read `tr.log` + `dbg.log` after each call. Only then add the UI.
4. For the UI, open the tab with Claude in Chrome and let the operator drive it: the
   tab's console (`AppBootstrap`, `PlayerAction`, `PlayerHelper` lines) shows the UI
   side of every call. Network capture only records requests made *after* it was
   first enabled on that tab, so enable it before the page load you care about.
5. Bisect by transport and by driver: the same launch over serial and over TCP, from
   `curl` and from the UI. Tonight all four were clean; the reported loop turned out
   to be a bench problem (two units sharing the factory MAC and one DHCP lease).

Useful direct probes when discovery says "found 0" and nothing explains why — the
same exchange the scan does, one address, with timing:

```
node -e 'const s=require("net").connect(2112,"192.168.1.37",()=>s.write(Buffer.from([0x64,0xE0])));s.on("data",d=>{console.log(d.toString("hex"));s.destroy()})'
```

`64 E0` is the FW-check token (reply `E1 64` = minimal, `E2 64` = full); `64 76` is
the version command (text reply, includes `UID:`). The API's own discovery/recovery paths
only ever send the version command — see the gotcha below.
