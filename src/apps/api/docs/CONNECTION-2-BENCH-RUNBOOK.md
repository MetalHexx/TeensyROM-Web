# CONNECTION-2 Bench Runbook

**Timings are taken with the log tap only.** A debugger attached to the API inflates exception-heavy
paths badly — the TCP subnet sweep alone went from ~2 s to 28 s under first-chance exception reporting
during the large-launch-loop investigation (2026-09-20). Use `netcoredbg`/the `api-live-debug` skill for
*sequence and state* (tracepoints), never for a number that goes in the tables below. Every number here
comes from the log tap's millisecond timestamps against a pristine, undebugged API.

## Prerequisites

- Two TeensyROM units on the bench (one is enough for the transition/discovery tests; the two-units
  measurement below needs both).
- The `.claude/skills/api-live-debug` skill available in this checkout (log tap script, pristine-restart
  steps).
- `dotnet test` access to `TeensyRom.Core.Device.Tests.Integration` for the automated half of this runbook
  (`Hardware/ConnectionTransitionsTests.cs`, `Hardware/DiscoveryOccasionsTests.cs`).

## Pristine restart

Live state lives under the Debug build's `bin/.../Assets/System`: `Config/Settings.json`,
`Config/ConnectionRecords.json` (the discovery cache), `Cache/Sd-<chipId>.json` (storage indexes), and
`Logs/`. Deleting the whole `bin` folder gives a truly pristine API — it self-heals settings on first run.

```
Remove-Item -Recurse -Force apps/api/src/TeensyRom.Api/bin
dotnet build apps/api/src/TeensyRom.Api
dotnet run --no-build --project apps/api/src/TeensyRom.Api   # port 213
```

Start the log tap before triggering anything you want timed:

```
node .claude/skills/api-live-debug/scripts/logtap.mjs <out.log>
```

Startup itself runs discovery (`ApplicationBootstrap: Scanning for devices...`, right after "Now
listening"), so a pristine start already opens every COM port and sweeps the local subnet with no IP
cache. Let that first sweep finish and `ConnectionRecords.json` get written before starting a timed
measurement — you want a warm cache for anything that is not itself a cold-start measurement.

## Running the automated half

```
cd src/apps/api/src/TeensyRom.Core.Device.Tests.Integration
TEENSYROM_BENCH_TRANSPORT=Tcp TEENSYROM_BENCH_CHIP_IDS=<chipId1>,<chipId2> dotnet test --filter "FullyQualifiedName~ConnectionTransitionsTests|FullyQualifiedName~DiscoveryOccasionsTests"
```

`TEENSYROM_BENCH_TRANSPORT` selects `Serial` or `Tcp` (default `Tcp`) — whichever transport the bench is
wired for that day; `TEENSYROM_BENCH_CHIP_IDS` is a comma-separated list the fixture prefers when more
than one device answers on that transport. Neither variable set, or no unit attached, and every test in
`ConnectionTransitionsTests` and `DiscoveryOccasionsTests` reports **skipped**, not failed or passed —
that is the contract this suite is built on (`HardwareFixture.HasHardware`), not an accident. `dotnet test`
on the whole project is always green regardless of what is plugged in.

Each test writes `<name>: <ms> ms` to the test's own output (`dotnet test -l "console;verbosity=normal"`
to see it inline, or the generated `.trx`) — those lines are the source for the "after" columns below.
Expect the fixture's own startup (a cold `ConnectAtStartAsync`, no cache) to dominate wall-clock time on a
bench with no cache primed yet; that cost is the cold-start discovery sweep itself, not a test bug.

## The five serial measurements

These need a person at the bench — a debugger-free log tap, the physical unit(s), and the C64's settings
page. The listener toggle lives at **F8 → 3 → b** on the C64 settings page (F8 opens the settings menu,
`3` selects the connection page, `b` toggles the Ethernet listener on/off).

### 1. Minimal → full: reboot path and jump path

Two distinct ways a unit leaves minimal, both already covered by the automated suite on whichever
transport is wired — run each once on **Serial** here:

- **Reboot path** (`RecoveryReason.LeaveMinimal`): device is in minimal, a non-launch command (or the
  bench operator resetting it directly) forces a real reboot back to the menu.
  `Hardware/ConnectionTransitionsTests.cs`'s `DirectoryListing_FromMinimal_*` test exercises exactly this.
- **Jump path** (`RecoveryReason.ChainedLaunch`, settle rule): a small file (a SID) launched from minimal
  answers Full directly within `LaunchSettleMs` — no separate reboot-to-menu step observed on the wire.
  `SidLaunch_FromMinimal_*` exercises this.

Read from the log tap: `DeviceRecovery: Recovery LeaveMinimal on Serial for <chipId>: ceiling <ms> ms`
followed by `DeviceRecovery: Recovery LeaveMinimal -> FullIdle in <ms> ms` for the reboot path; the
`ChainedLaunch` pair of log lines for the jump path.

### 2. Full → minimal with the listener off

Toggle the listener **off** (F8 → 3 → b), confirm over serial the unit answers, then launch a large file
(`/games/Very Large/Lemmings [EasyFlash].crt`) from the C64 UI or via `LargeLaunch_FromFull_*`
against `TEENSYROM_BENCH_TRANSPORT=Serial`. With the listener off, nothing on the wire can be TCP, so this
isolates the serial-only full→minimal reboot from any TCP retry noise.

Read: `DeviceRecovery: Recovery LargeLaunch on Serial for <chipId>: ceiling <ms> ms` /
`-> Minimal in <ms> ms`.

### 3. Both units in minimal at once

Requires both bench units. Launch a large file on each (staggered by a couple of seconds is fine) so both
sit in minimal simultaneously, then run a full scan (`FindDevices(fullScan: true)`, e.g. the Discover
Devices UI action or `DeviceConnectionManagerTests`'s endpoint) and confirm both come back to the menu.
This is not covered by the automated suite — `HardwareFixture.Device` picks a single device by transport,
not a specific pair — so time it manually from the log tap.

Read: two `DeviceRecovery: Recovery LeaveMinimal ...` pairs (one per chip id), and
`DeviceConnectionManager.FindDevices: Discovery (FullScan): 2 device(s) ready in <ms> ms`.

### 4. Serial-only cold start with two dead cached TCP rows

Edit `Assets/System/Config/ConnectionRecords.json` by hand so both units' rows carry a `TcpEndpoint` that
is no longer live (an IP neither unit currently holds) and no usable `SerialPortName`, or a serial port
name that is stale too — the point is both cached rows must fail to confirm. Restart the API (pristine
restart, but only after re-seeding the doctored cache file) with the listener off or the units off the
network, so only serial can find them. `DeviceConnectionManager.RunConnectAtStart` will fail both rows via
`TryConfirmCachedRow` and fall through to a full discovery sweep that finds them on serial.

Read: two `DeviceConnectionManager: start confirm miss for <chipId>: ...` lines, then
`DeviceConnectionManager.FindDevices: Discovery (Start): 2 device(s) ready in <ms> ms`.

### 5. The listener-on-but-unplugged penalty

Toggle the listener **on** (F8 → 3 → b), then physically unplug the unit's Ethernet cable (or otherwise
make the address unreachable) so the listener claims availability but nothing answers. Trigger a TCP
connect attempt (a full discovery sweep, or a cached-row confirm against that unit's TCP endpoint) and
time how long the connect attempt takes to give up versus a plain refused/no-listener connect. This is the
`ConnectTimeoutMs` / TCP sweep per-address timeout in practice, not a fast refusal.

Read: `TCP sweep <start>–<end>: <n> addresses, <a> answered, <r> refused, <t> timed out, in <ms> ms` from
`TcpDiscoveryStrategy`, or `DeviceConnectionManager: start confirm miss for <chipId>: open failed: ...` for
the cached-row variant.

## Measurement table

Fill in **after** once the bench run above is done. **Before** is the Ground Truth bench session
(2026-09-20, TCP with static IPs) or the current `ConnectionOptions` seed comment where noted; leave a row
blank rather than guess. **Ceiling set** is what actually gets written to `appsettings.json` — the
measured value plus margin, never the raw number.

| Measurement | Before | After | Ceiling seed | Ceiling set |
|---|---|---|---|---|
| Full → minimal (TCP) | 3.56–3.58 s | 5.81 s (2026-09-21 session) | `Tcp.ToMinimalMs` = 8000 | |
| Minimal → full (TCP) | 7.06–7.09 s | 8.62 s (2026-09-21 session) | `Tcp.ToFullMs` = 15000 | |
| Large launch from minimal (TCP, chained) | 15.2 s | | `Tcp.ToFullMs + Tcp.ToMinimalMs + LaunchSettleMs` | |
| Directory listing / SID launch from minimal (TCP) | 8.7–8.8 s | directory listing 8.62 s (see row above); SID chain did not complete — see session note | `Tcp.ToFullMs + LaunchSettleMs` | |
| 1. Minimal → full: reboot path (Serial) | | | `Serial.ToFullMs` = 15000 (seeded from a 13.7 s serial round trip) | |
| 1. Minimal → full: jump path (Serial) | | | `Serial.ToFullMs + LaunchSettleMs` | |
| 2. Full → minimal, listener off (Serial) | | | `Serial.ToMinimalMs` = 15000 (seeded from a 13.7 s serial round trip) | |
| 3. Both units in minimal at once (Serial) | | | n/a — sanity check, not a ceiling | |
| 4. Serial-only cold start, two dead TCP rows | | | `ConnectTimeoutMs` × dead rows + full discovery | |
| 5. Listener on, unplugged (TCP) | | | `ConnectTimeoutMs` = 2000 per attempt | |

### Session note (2026-09-21)

One bench session against real hardware on this machine's LAN produced the two TCP "after" numbers
above before the run stopped early: the chained SID launch (minimal → full, jump path) did not answer
within the current `Tcp.ToFullMs + Tcp.ToMinimalMs + LaunchSettleMs` = 18 s ceiling (it ran 27.3 s and
came back `Disconnected`), so `ConnectionTransitions_FullMinimalRoundTripsAndReset` stopped there and
never reached the chained-large-launch or reset steps in that run. Three follow-up automated attempts
(two on TCP, one on Serial) found no device to test against at all. The Serial attempt is expected to
dead-end whenever Ethernet is also reachable: `CartFinderIntegrationTests` already covers that the finder
prefers Ethernet and disposes the serial port when the same chip answers on both, so a fixture filtered to
`ConnectionType.Serial` sees nothing until someone disables the C64's Ethernet listener for real serial
testing (exactly what measurement #2 below already asks a bench operator to do). TCP access did not come
back within the session — plausibly because the listener (`F8 → 3 → b`) needs a person to re-enable it
after a reboot cycle, which an automated test run cannot do. The one SID-chain miss is worth a deliberate
re-measurement (it may mean
`Tcp.ToFullMs + Tcp.ToMinimalMs + LaunchSettleMs` is genuinely too tight for the jump path now), but one
non-completion is not a bench number — no ceiling is set from it here. The remaining TCP row, all five
serial measurements, and the discovery/occasion table below need a further bench session with a person
at the C64 to toggle the listener and drive the physical settings menu; none of that is achievable from
this environment alone.

## Discovery/occasion after-numbers

Mirrors `Hardware/DiscoveryOccasionsTests.cs`'s scripted flow and the Ground Truth bench rows for the
three discovery occasions. Run with `TEENSYROM_BENCH_TRANSPORT` set to whichever transport is wired.

Not run this session — see the session note above; TCP access did not stay up long enough to reach
`DiscoveryOccasionsTests`, and serial is currently unavailable on this machine.

| Occasion | Assertion | After |
|---|---|---|
| `FindDevices(fullScan: false)` while a unit is in minimal | listed as minimal, no contact (version command afterwards still reports minimal) | |
| `FindDevices(fullScan: true)` from minimal | unit back at the menu (`FullIdle`/`FullBusy`) | |
| Second `ConnectAtStartAsync` (new manager, same cache path) | no sweep — every cached row confirmed, under `ConnectTimeoutMs + 4 s` | |

## Updating the ceilings

Once every row above that this bench session could run has an **after** number:

1. Open `apps/api/src/TeensyRom.Api/appsettings.json`'s `Connection` section.
2. For `Connection:Serial` (`ToMinimalMs`, `ToFullMs`) — and `Connection:Tcp` if this session's numbers
   supersede the Ground Truth ones — set each value to the measured **after** number plus a margin (the
   existing TCP ceilings run roughly 2× the measured round trip; hold that ratio unless a specific
   measurement's variance says otherwise).
3. Record the new value in this runbook's **Ceiling set** column alongside the measurement that justified
   it, so the next iteration can see what changed and why.
4. Leave `PollIntervalMs`, `LaunchSettleMs`, and `ConnectTimeoutMs` alone unless a specific row above
   measured one of them directly (SID/jump-path timing bears on `LaunchSettleMs`; the unplugged-listener
   penalty bears on `ConnectTimeoutMs`).

Do not commit a ceiling change without the measurement that produced it recorded in the tables above — a
ceiling with no bench number behind it is just a guess with extra steps.
