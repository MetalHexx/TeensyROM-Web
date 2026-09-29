---
name: api-live-debug
description: 'Live-debug the running .NET API against real TeensyROM hardware from Claude Code: pristine restart, capture the API log stream, and attach a scriptable debugger (netcoredbg) to set breakpoints, read locals, evaluate expressions, and step — all driven over a local HTTP control port. Use when chasing a runtime bug in the API that needs variable state or a stack at a specific moment, not just log lines.'
---

# API Live Debug

Attach a real debugger to the running API and drive it from the terminal — no IDE.
Built during the CONNECTION-2 large-launch-loop investigation (2026-09-20); rewritten for the P08
connection-layer changes.

## When to Use This Skill

- A bug in the API only shows against real hardware and log lines aren't enough
- You need a stack or variable state at a precise moment (a breakpoint), or a
  log of variable state every time a line runs without pausing (a tracepoint)
- You want a pristine API state — no remembered devices, caches, or settings

For raw device probes (version/reset/boot/swap, no API), the protocol token table, and exclusive-access
rules (one TCP client, one open COM port), see the `device-transport-probe` skill — this skill only
covers the API side. For the discovery-occasion and recovery *design* behind what you're tracing (the
gate, `DeviceRecovery`, the connection-record cache), see the `backend-architecture` skill; this skill
only tells you where to put the breakpoint, not why the code is shaped that way. **Never run
`TeensyRom.Api.Tests.Integration` while debugging against hardware**: it boots a second in-process API
that contends with this one for every port and the TCP session.

## Pieces

| Piece | Path | Role |
|---|---|---|
| Debugger | `tools/netcoredbg/netcoredbg.exe` (gitignored — see Setup) | Samsung's open-source .NET debugger, speaks the Debug Adapter Protocol |
| Driver | `scripts/dbg.mjs` | Spawns netcoredbg, attaches to the API pid, exposes an HTTP control port |
| Log tap | `scripts/logtap.mjs` | Subscribes to the API's SignalR log hub and appends timestamped lines to a file |

Run both scripts from the repo's `src/` — `dbg.mjs` resolves a relative `file` against
`apps/api/src` from `process.cwd()`, and `logtap.mjs` resolves `@microsoft/signalr` by walking up from
its own location to `src/node_modules`. A relative breakpoint path set from the wrong directory still
gets a 200 from `POST /bp`, but its `verified`/`actualLine` fields say the breakpoint never actually
bound to a line — always check both in the reply after setting one, not just the HTTP status.

## Setup (once per machine)

```
gh release download 3.2.0-1092 -R Samsung/netcoredbg -p netcoredbg-win64.zip -D .claude/skills/api-live-debug/tools --clobber
unzip -qo .claude/skills/api-live-debug/tools/netcoredbg-win64.zip -d .claude/skills/api-live-debug/tools
```

`tools/` is gitignored. Close Visual Studio / VS Code before attaching — a process
takes one debugger at a time. Once unzipped, the debugger's full path (from the repo's `src/`) is
`.claude/skills/api-live-debug/tools/netcoredbg/netcoredbg.exe` — the first argument to `dbg.mjs`.

## Pristine restart

The Debug build's `apps/api/src/TeensyRom.Api/bin/Debug/net9.0/win-x64/Assets/System/` folder (relative
to the repo's `src/`) holds live state. What it has today:

- `Config/Settings.json` and `Config/ConnectionRecords.json` (the discovery cache). `DeviceIps.json` and
  `SerialPorts.json` no longer exist.
- `Cache/Sd-<chipId>.json` and `Cache/Usb-<chipId>.json` (storage indexes), and `Cache/GameImageMetadata.json`.
- `Logs/Logs-<start>.txt` and `Logs/GlobalExceptions-<date>.log`.

Deleting the whole `bin` folder gives a truly pristine API — it self-heals settings on first run and
indexes directories on demand (`GetDirectory`), so no full index is needed. **`TEENSYROM_DATA_DIR`**
(`TeensyRom.Core/Common/AssemblyExtensions.cs`) moves all of the above out of `bin` entirely when it's
set — check for it before assuming this is where a given run actually wrote.

```bash
rm -rf apps/api/src/TeensyRom.Api/bin
dotnet build apps/api/src/TeensyRom.Api
dotnet run --no-build --project apps/api/src/TeensyRom.Api   # port 213
```

(PowerShell's `Remove-Item -Recurse -Force apps/api/src/TeensyRom.Api/bin` works the same if that's the
shell in hand.) To find the running API's pid from a Bash shell — `dbg.mjs`'s second argument —
`ps -W | grep TeensyRom.Api` (Git Bash on Windows) or `pgrep -f TeensyRom.Api` (a real POSIX shell).

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
`LogProduced` line with a **UTC** timestamp — and it's an *arrival* time, not the moment the API logged
it: the API batches at most 20 lines onto the hub, then waits 100 ms
(`TeensyRom.Api/Services/LoggingService.cs`) before the next batch, so "the tap gives millisecond stamps"
overstates its precision. For real timing, use a firmware-side probe (`device-transport-probe`) or a run
with the debugger detached and read the tap's own stamps knowing the ~100 ms batching granularity.

**Nothing reaches the tap before `POST /api/logs`** — that call is what starts the log stream and also
clears whatever was queued before it, so startup discovery's own lines never appear there; they're only
in the file log (`bin/.../Assets/System/Logs/Logs-<start>.txt`, one per run). That file log has no
per-line timestamps of its own (a raw log line, nothing prepended) and flushes to disk every 100 lines or
5 s, whichever comes first — its *file name* is in local time, not UTC.

**The tap file is append-only and now carries raw token bytes** (e.g. the menu-boot SID
token) alongside the timestamped text lines, so plain `grep` reports "Binary file
matches" instead of the line you want — use `grep -a` (or `grep --text`) against it.

## Debugger driver

```
node .claude/skills/api-live-debug/scripts/dbg.mjs <netcoredbg.exe> <pid> <port> <dbg.log>
```

Attaches to the API pid, then listens on `http://127.0.0.1:<port>`. Every call is JSON in / JSON out
(`curl -s`):

| Call | Body | Does |
|---|---|---|
| `GET /status` | — | attached?, current stop (where + frames), breakpoints |
| `POST /bp` | `{file, line, mode: "hold"\|"trace", exprs: [..], condition}` | set/replace a breakpoint; `file` may be relative to `apps/api/src` |
| `DELETE /bp` | `{file, line}` | remove it |
| `POST /continue` `/next` `/stepIn` `/stepOut` | — | resume / step the stopped thread |
| `POST /pause` | — | break in |
| `GET /threads` | — | raw DAP thread list |
| `GET /stack?levels=N` | — | stack of the stopped thread |
| `GET /locals?frame=i&depth=d` | — | locals/args of frame *i*, expanded *d* levels |
| `POST /eval` | `{expr, frame}` | evaluate an expression in a frame |
| `POST /vars` | `{ref, depth}` | expand a `variablesReference` from a previous result |
| `POST /detach` | — | detach, leave the API running |

**Modes.** A `hold` breakpoint pauses the process until you continue — the
firmware and the serial port keep running meanwhile, so ping windows can expire
and ports can re-enumerate underneath you. A `trace` breakpoint evaluates its
`exprs`, writes `[TRACE file:line] expr = value | …` to `dbg.log`, and resumes in
a few milliseconds — use it on timing-sensitive paths (handshake, discovery), but see the read-loop
gotcha below before pointing one inside a byte-pump loop.

## Driving the API

Endpoints a bench session actually drives, with their query-string parameters (enums bind by name — `SD`,
`USB`; paths are URL-encoded):

| Endpoint | Notes |
|---|---|
| `POST /api/devices/{deviceId}/storage/{SD\|USB}/launch?FilePath=` | |
| `POST /api/devices/{deviceId}/storage/{SD\|USB}/random-launch?FilterType=&Scope=&StartingDirectory=` | |
| `POST /api/devices/{deviceId}/storage/{SD\|USB}/index?StartingPath=` | |
| `GET /api/devices/{deviceId}/storage/{SD\|USB}/directories?Path=` | |
| `GET /api/devices/{deviceId}/ping` | user-triggered only — the API never sends this on its own |
| `PUT /api/devices/{deviceId}/reset` | note the verb, `PUT` |
| `GET /api/devices/?FullScan=` | rate-limited to one request per 5 s with a queue of one (`RateLimitHelper.FindDevicesRateLimiter`) |
| `POST /api/devices/{deviceId}/toggle-music` | |
| `POST /api/logs` / `DELETE /api/logs` | starts/stops the log stream; the hub itself is `/api/logHub` |
| `GET /api/devices/{deviceId}/storage/{SD\|USB}/files/content?Path=` | |

## Gotchas

- **Primary-constructor parameters are invisible to `eval`.** `class Foo(IBar bar)`
  stores `bar` in a compiler-hidden field; `eval bar` fails with "does not exist in
  the current context" and it is not listed under `this` either. Classic fields, method parameters, and
  locals all work. Affected classes (their constructor parameters only — a redeclared `private readonly`
  field is fine): `LaunchFileHandler`, `CommunicationPortBehavior`, `DeviceRecovery`, `CartFinder` (its
  `_discoveryStrategies`/`_settingsProvider` fields excepted), `TcpCommunicationPort`,
  `SerialDiscoveryStrategy`, `ResetCommandHandler`, `DeviceInterrogator`, and the endpoints. In
  `DeviceConnectionManager`, `TcpDiscoveryStrategy`, and `TeensyPortLocator` every `_field` is readable —
  those classes take a classic constructor and assign the fields themselves. Pick a breakpoint line
  inside a method that has what you need as a local or parameter instead.
- **Closure variables.** `CommunicationPortBehavior`'s `request`, `device`, and `next` are captured by
  the local function `SendAsync`; check `/locals` there rather than assuming they read the same as the
  outer scope.
- **The reset command handler is sometimes skipped.** `ResetCommandHandler` never runs when the gate's
  own reset (from its minimal→full or busy→idle branch) already put the C64 back in the menu
  (`GateResetWasTheReset`) — trace the gate, not just the handler, when a `Stop`/reset looks like it did
  nothing.
- **Startup takes a different path.** It runs `ConnectAtStartAsync` → `RunConnectAtStart`, not
  `FindDevices` — only a full discovery (`FullScan=true`) reaches `CartFinder.FindDevices`.
- **Never trace inside a read loop.** A tracepoint costs about 12 ms per hit, and TCP's `BytesToRead`
  reports 1 while only socket data is pending — so a byte-pump loop hits once per byte. A tracepoint
  inside `GetDirectoryRecursiveHandler.GetRawDirectoryData`'s read loop turned a 2.6 s directory read into
  about 300 s. The same shape shows up in `WaitForMenuBootToken` and `AwaitResetLines`'s `ReadResetLines` —
  trace at the exchange boundaries (before the loop starts, or at its single exit), never on a line the
  loop body itself runs every iteration.
- **Sweep tracepoints are expensive for the same reason.** One inside `TcpDiscoveryStrategy.SweepRange`'s
  per-address lambda fires up to 254 times per adapter; trace the summary line it logs once the sweep
  finishes instead.
- **Ping.** It sends `64 55` and is only ever user-triggered — the API never sends it on its own.
- **Where raw exceptions come from.** `TcpCommunicationPort` throws a raw `TimeoutException` from
  `WaitForSerialData`, `ReadIntBytes`, `OpenPort(int)`, `EnsureConnection`, and the async reads.
  `ClearBuffers` swallows everything.
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
  debugger detached (the log tap's ~100 ms batching still beats guessing, see "Log tap" above).
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
- **Exclusive access, TCP client limits, and raw probes** are `device-transport-probe`'s territory, not
  this skill's — see its "Pitfalls" section before assuming a refused connect is a bug.
- **The bench endpoints take query-string parameters, not JSON bodies** — e.g.
  `LaunchFileRequest.FilePath` is `[FromQuery]`. Driving one with `curl` needs
  `?FilePath=...` on the URL, not a `-d` JSON payload. See "Driving the API" above for the full list.

## Proven round-trip (2026-09-20)

Breakpoint on `StartLogsEndpoint.cs:22` → started the log tap (its `POST /api/logs`
tripped it) → `GET /status` showed HELD with the stack → `GET /locals?depth=2` and
`POST /eval` read state → `POST /continue` → the tap's POST returned 200 → `DELETE /bp`.

## Worked example — the large-launch investigation (2026-09-20)

The order that worked, one step per turn against real hardware — the method matters here, not that
night's findings (the loop turned out to be a bench problem: two units sharing the factory MAC and one
DHCP lease, not a code bug):

1. Pristine restart (above), then the log tap, then the driver. Verify the round trip
   on a harmless breakpoint before touching a device.
2. Tracepoints on the seams below, so the log shows *who calls what, with what* — request/response
   values, not timings (see the debugger-attached gotcha above).
3. Drive the API with `curl` first (discovery, a directory, the launch endpoint) and
   read the tap and `dbg.log` after each call. Only then add the UI.
4. For the UI, open the tab with Claude in Chrome and let the operator drive it: the
   tab's console (`AppBootstrap`, `PlayerAction`, `PlayerHelper` lines) shows the UI
   side of every call. Network capture only records requests made *after* it was
   first enabled on that tab, so enable it before the page load you care about.
5. Bisect by transport and by driver: the same launch over serial and over TCP, from
   `curl` and from the UI.

For raw device probes when discovery says "found 0" and nothing explains why, the protocol token table,
and exclusive-access rules — see the `device-transport-probe` skill instead of reaching for a one-off
`node -e` socket script here.

### Tracepoint table

Every row names a file, a line that is an executable statement, and expressions in scope there, resolved
against the code at the current CONNECTION-2 HEAD. Re-resolve line numbers against a later HEAD before
trusting them — a coder or reviewer spot-checks by opening the file, not by trusting this table blind.

| File:line | What it shows | `exprs` |
|---|---|---|
| `TeensyRom.Api/Endpoints/Player/LaunchFile/LaunchFileEndpoint.cs:25` | every launch request | `r.DeviceId`, `r.StorageType`, `r.FilePath` |
| `TeensyRom.Core.Serial/Commands/LaunchFile/LaunchFileHandler.cs:21` | handler entry, every launch command | `r.LaunchItem.Size`, `r.LaunchItem.Path`, `r.DeviceId` |
| `…/LaunchFileHandler.cs:27` | the firmware declined the launch (a re-send request, not a failure) | `ack` |
| `…/LaunchFileHandler.cs:37` | image/text/PRG/P00/HEX/small-CRT branch — done at the ack | `r.LaunchItem.FileType`, `r.LaunchItem.Size` |
| `…/LaunchFileHandler.cs:168` | `AwaitResetLines` — how many "Resetting C64" lines a done-at-ack launch still owes | `owed` |
| `…/LaunchFileHandler.cs:50` | `AwaitCartLoad`'s result for an oversized CRT | `load`, `device?.Connection.Mode` |
| `…/LaunchFileHandler.cs:62` | `Watch`'s result — SIDs only | `final`, `dropped` |
| `…/LaunchFileHandler.cs:74` | silence resolved by a version confirm | `reply.IsTeensyRom`, `reply.IsMinimalFirmware`, `dropped` |
| `…/LaunchFileHandler.cs:91` | the only recovery reason a launch ever calls | `device?.Connection.Mode` |
| `…/LaunchFileHandler.cs:292` | `MarkLaunched` — records what the launched item left the firmware doing | `device?.DeviceId`, `item.FileType` |
| `TeensyRom.Core.Serial/Commands/Behaviors/CommunicationPortBehavior.cs:54` | every command entering the gate, before the lock | `request`, `request.DeviceId`, `request.CommunicationPort.IsOpen` |
| `…/CommunicationPortBehavior.cs:64` | past the lock, port resolved | `request`, `lockKey` |
| `…/CommunicationPortBehavior.cs:86` | gate found the device believed Minimal → reset to full, launches included | `request`, `device.Connection.Mode` |
| `…/CommunicationPortBehavior.cs:224` | `GateResetWasTheReset` — a reset command succeeds without its handler because the gate's own reset just did it | *(none — the method takes no parameters, and `log` is a primary-constructor field, see the gotcha above)* |
| `…/CommunicationPortBehavior.cs:111` | an earlier gate reset's menu boot outlasted its wait; checks the boot instead of resetting again | `device.Connection.MenuBootPending` |
| `…/CommunicationPortBehavior.cs:122` | gate found the device believed FullBusy on a non-launch command | `device.Connection.Mode`, `request` |
| `…/CommunicationPortBehavior.cs:162` | gate caught a reactive Busy reply → reset once | `request`, `busyRetries` |
| `…/CommunicationPortBehavior.cs:177` | a transport drop hands the device to recovery | `device`, `request` |
| `TeensyRom.Core.Serial/Recovery/DeviceRecovery.cs:35` | every recovery attempt starts | `reason`, `transport`, `chipId`, `ceiling` |
| `…/DeviceRecovery.cs:63` | the poll loop's reply check — correct chip answered | `reply.IsTeensyRom`, `reply.ChipId`, `chipId` |
| `…/DeviceRecovery.cs:132` | `MenuBootFailure` checks whether the reply already reported boot-complete before waiting on it | `reason`, `reply.BootComplete` |
| `…/DeviceRecovery.cs:255` | `ReacquireCandidates` — the serial listen for the boot token and its result deciding the next ack timeout | `candidate.PortName`, `candidate.Image`, `menuTokenSeen` |
| `…/DeviceRecovery.cs:351` | `Succeed` confirms the device and its mode | `mode`, `transport`, `reason` |
| `…/DeviceRecovery.cs:369` | `Succeed`'s storage writes — Unknown leaves the prior value alone | `sd`, `usb` |
| `TeensyRom.Core.Serial/Routines/TRStreamExtensions.cs:149` | `ResetDevice` sends the reset token, bounded by the menu-boot ceiling | `menuBootTimeoutMs` |
| `…/TRStreamExtensions.cs:178` | `ResetFromMinimal` sends and forgets — the reboot drops the transport before any reply | `communicationPort.GetEndpoint()` |
| `…/TRStreamExtensions.cs:212` | `WaitForBootComplete`'s poll, once per version request | `polls`, `stopwatch.ElapsedMilliseconds`, `reply.BootComplete` |
| `…/TRStreamExtensions.cs:281` | `WaitForMenuBootToken`'s success exit — its read loop itself is off-limits, see the gotcha above | `timeoutMs`, `stopwatch.ElapsedMilliseconds` |
| `TeensyRom.Core.Serial/Commands/Reset/ResetCommandHandler.cs:12` | explicit resets (when the gate doesn't shortcut them) | `request.DeviceId` |
| `TeensyRom.Core.Device/CartFinder.cs:143` | `BuildDevice` — one confirmed endpoint becomes a listed device | `endpoint.Display`, `endpoint.ConnectionType`, `reply.IsMinimalFirmware` |
| `…/CartFinder.cs:289` | `DeduplicateByDeviceId` — a chip found on two transports, the preferred one kept | `group.Key`, `group.Count()`, `match?.ConnectionType` |
| `TeensyRom.Core.Device/DeviceConnectionManager.cs:64` | every `FindDevices` call (page load vs. full scan) | `fullScan`, `_byChip.Count` |
| `…/DeviceConnectionManager.cs:114` | `RunFullDiscovery` starts | `occasion` |
| `…/DeviceConnectionManager.cs:152` | `RunFullDiscovery`'s save — only when the sweep found at least one device | `discovered.Count`, `occasion` |
| `…/DeviceConnectionManager.cs:165` | `RunConnectAtStart` — an empty/missing cache falls back to a full sweep | `cached?.Count` |
| `…/DeviceConnectionManager.cs:171` | `RunConnectAtStart`'s confirm — every cached row tried in parallel | `cached.Count` |
| `…/DeviceConnectionManager.cs:204` | `TryConfirmCachedRow` — one cached row's own confirm attempt | `row.ChipId`, `row.TransportInUse` |
| `TeensyRom.Core.Device/TcpDiscoveryStrategy.cs:117` | `SweepRange`'s summary line — never the per-address lambda, see the gotcha above | `startIp`, `endIp`, `ipRange.Count`, `answered`, `refused`, `timedOut` |
| `TeensyRom.Core.Serial/TcpCommunicationPort.cs:497` | the raw `TimeoutException` `WaitForSerialData` throws | `numBytes`, `timeoutMs`, `sw.ElapsedMilliseconds` |

`request` evaluates to `{…CommandName}` — enough to name the command. Token values print as decimal
(`25804` = `0x64CC` = Ack).
