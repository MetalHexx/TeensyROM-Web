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
- The C64 menu's "sync time from network at power-up" setting adds a variable, blocking step (a DNS
  lookup plus up to a ~2.5 s NTP wait, `StatusFunctions.c:83,109`) to every reset before the menu's
  listener comes up (`MainMenu.asm:267` runs before `:276`). Record whether it is on or off for any timed
  run — it is not claimed that it must be off, only that a session's numbers are not comparable to one
  taken with the setting in the other state.

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

### 1. Minimal → full: reboot path, now the only path

There used to be a second, faster way a unit left minimal: a small file (a SID) launched straight
into a device already in minimal would answer full directly within `LaunchSettleMs`, no separate
reboot-to-menu step observed on the wire (`RecoveryReason.ChainedLaunch`). That path is gone. The
gate (`CommunicationPortBehavior`) now resets a device it believes is in `Minimal` and recovers it
to full (`RecoveryReason.LeaveMinimal`) before *any* command reaches its handler — a launch
included — so every transition out of minimal is the reboot path; nothing chains any more. The
chained path was abandoned for reachability, not speed: an unexpected reboot-vs-jump outcome could
leave the device unreachable with no way to observe what happened. **Expect the numbers below to
run slower than the superseded chained ones** — that is the deliberate trade, not a regression; the
table keeps both so a future reader does not try to "optimise" it back.

Three stages exercise this, all inside the automated suite's single `[SkippableFact]`,
`ConnectionTransitions_FullMinimalRoundTripsAndReset` — there is no `DirectoryListing_FromMinimal_*`,
`SidLaunch_FromMinimal_*`, or `LargeLaunch_FromFull_*` test method; those names do not exist in
`ConnectionTransitionsTests.cs`. Run the whole fact once on **Serial** here (the automated half
already covers whichever transport `TEENSYROM_BENCH_TRANSPORT` is set to; this measurement wants
the Serial numbers specifically):

- **Non-launch reboot** — stage `"Minimal -> Full (directory listing)"`: a `GetDirectoryRecursiveCommand`
  forces the reboot with no launch involved.
- **SID launch from minimal** — stage `"SidLaunch (minimal -> full, reset-and-recover)"`: the test's
  `EnsureFullAsync` helper stands in for the gate's own reset (it isn't exercised through the gate —
  see the class doc comment), then a SID is launched against the now-full device. The measured span
  covers both the reset-and-recovery and the launch's own `Watch`/version-confirm window.
- **Large launch from minimal** — stage `"LargeLaunch (minimal -> full -> minimal, reset-and-recover)"`:
  same reset first, then a large launch that reboots the device straight back into minimal to
  receive it.

Read from the log tap: `DeviceRecovery: Recovery LeaveMinimal on Serial for <chipId>: ceiling <ms> ms`
followed by `DeviceRecovery: Recovery LeaveMinimal -> FullIdle in <ms> ms` for the reset-and-recovery
portion of every stage above. Each stage's own total (reset-and-recovery plus whatever it does
afterward) is what `HardwareFixture.MeasureAsync` writes to the test's own output as
`<stage name>: <ms> ms` — see "Running the automated half" above for how to see it inline.

### 2. Full → minimal with the listener off

Toggle the listener **off** (F8 → 3 → b), confirm over serial the unit answers, then launch a large file
(`/games/Very Large/Lemmings [EasyFlash].crt`) from the C64 UI or via the automated suite's
`"LargeLaunch (full -> minimal)"` stage (the first stage in
`ConnectionTransitions_FullMinimalRoundTripsAndReset`) against `TEENSYROM_BENCH_TRANSPORT=Serial`. With
the listener off, nothing on the wire can be TCP, so this isolates the serial-only full→minimal reboot
from any TCP retry noise.

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
| Full → minimal (TCP) | 3.56–3.58 s | 5.81 s (2026-09-21 session); reconfirmed 5.82 s (2026-09-23 session) | `Tcp.ToMinimalMs` = 8000 | |
| Minimal → full, non-launch reboot (TCP) | 7.06–7.09 s | 8.62 s (2026-09-21 session); reconfirmed 11.69 s (2026-09-23 session) — see session note | `Tcp.ToFullMs` = 15000 | |
| Large launch from minimal, reset-and-recover (TCP) | superseded chained path: 15.2 s — abandoned for reachability, not speed (see "1. Minimal → full" above) | 17.41 s (2026-09-23 session) | `Tcp.ToFullMs + Tcp.ToMinimalMs + LaunchSettleMs` = 25000 | unchanged — 30% margin (7.6 s) under ceiling seed |
| SID launch from minimal, reset-and-recover (TCP) | superseded chained path: 8.7–8.8 s; a later attempt at the same chained path did not complete — see session note | 12.28 s (2026-09-23 session) | `Tcp.ToFullMs + LaunchSettleMs` = 17000 | unchanged — 28% margin (4.7 s) under ceiling seed |
| 1. Minimal → full, non-launch reboot (Serial) | | | `Serial.ToFullMs` = 15000 (seeded from a 13.7 s serial round trip) | |
| 1. SID launch from minimal, reset-and-recover (Serial) | | | `Serial.ToFullMs + LaunchSettleMs` | |
| 1. Large launch from minimal, reset-and-recover (Serial) | | | `Serial.ToFullMs + Serial.ToMinimalMs + LaunchSettleMs` | |
| 2. Full → minimal, listener off (Serial) | | | `Serial.ToMinimalMs` = 15000 (seeded from a 13.7 s serial round trip) | |
| 3. Both units in minimal at once (Serial) | | | n/a — sanity check, not a ceiling | |
| 4. Serial-only cold start, two dead TCP rows | | | `ConnectTimeoutMs` × dead rows + full discovery | |
| 5. Listener on, unplugged (TCP) | | | `ConnectTimeoutMs` = 2000 per attempt | |

The reset-and-recover rows above measure more than their ceiling seed's formula covers: `EnsureFullAsync`'s
`RecoveryReason.LeaveMinimal` recovery runs two storage probes (`DeviceRecovery.Succeed`, each bounded by
`ProbeStorageRoot`'s 6 s ack timeout) and waits for the menu-boot token (`WaitForMenuBootToken`, 3 s bound)
*after* its own poll ceiling is satisfied — neither is exposed as a `ConnectionOptions` ceiling. Derive the
actual number from what the bench reports rather than the raw `ToFullMs + LaunchSettleMs` /
`ToFullMs + ToMinimalMs + LaunchSettleMs` sum, and note here whether that overhead showed up in practice.

**It does.** Every reset-from-minimal driven through the API logs "the C64 menu did not come up within
3000 ms" twice, not once: the gate's own `ResetDevice` call on a device still in minimal (minimal never
emits the SID token, since it has no menu to boot), and then `WaitForMenuBootToken` again inside the
`LeaveMinimal` recovery's `Succeed` path (by the time TCP recovery reconnects, the token was already
emitted and missed). That is two back-to-back 3 s misses — roughly 6 s of the observed ~12.7 s
reset-from-minimal round trip — which accounts for most of the overhead this note asks about.

### Session note (2026-09-23)

TCP-only session (no serial-capable bench available this day; all five serial measurements and the
Serial `ConnectionTransitions` rows remain unmeasured — a further session with the unit reachable
over serial is still needed). Two units on the bench: TR+ (`19277260`) on TCP at `192.168.1.37:2112`,
TR (`14470230`) on `COM12` — the serial unit was left untouched.

`ConnectionTransitions_FullMinimalRoundTripsAndReset` ran **green** against the TR+ on TCP, in 1 m 11–12 s
total, confirming every stage's own ceiling assertion held. The four TCP numbers above (`LargeLaunch
(full -> minimal)`, `Minimal -> Full (directory listing)`, `SidLaunch (…, reset-and-recover)`,
`LargeLaunch (…, reset-and-recover)`) are read directly from that run's `MeasureAsync` output (captured
via `--logger trx`, since `ITestOutputHelper` lines don't surface at console verbosity `normal`). The
`Minimal -> Full (directory listing)` number came in ~3 s slower than the 2026-09-21 session's (11.69 s
vs 8.62 s) — still well inside the 15 s `Tcp.ToFullMs` ceiling, kept here rather than discarded since
silently dropping a slower rerun would be exactly the kind of guess this table exists to avoid.

**New finding, reproduced twice, since root-caused — not fixed yet, see disposition below.**
Immediately after `ConnectionTransitions` finishes (its own last step is `EnsureFullAsync` -> `Reset
(full)` -> a version-command confirm), `DiscoveryOccasionsTests` runs next in the same
collection/process and — since the device isn't already in `Minimal` — fires a fresh large-file launch
with no gap after that reset. Both runs failed identically: `result.LaunchResult` came back
`Disconnected` instead of `Success`, at `DiscoveryOccasionsTests.cs:92`, ~14 s after the reset, same
failure both times (not flaky).

A same-day corrective first attributed this to the TCP transport itself going stale after a reset (the
Teensy's network stack supposedly restarting on any landing at the menu) and shipped a close/reopen of
the TCP port inside `ForceResetAndReconnectToFullFw` (commit `fab4cd6b`). **That premise was bench-
disproven and the fix reverted.** Traced against the firmware over USB (COM4) while reproducing on the
live TR+ over TCP: a reset in full firmware does *not* restart the network stack — the menu's listener
init calls `EthernetInit`, which returns immediately once the link is up
(`IOH_Swiftlink.c:323-331`), and the fix in place made no difference (same `Disconnected`, same ~14 s).

The real mechanism, read from `MainMenu.asm`'s post-reset order: remote-launch check (`:211`), SID load
(emits the token our `ResetDevice` waits on, `:239`), then — when the C64's "sync time from network at
power-up" setting is on — a network time sync (`:267`, `jsr SetRTCfromEthernet`) *before* the listener
comes up (`:276`) and the menu's main loop starts (`:286`). That sync runs `SetRTCfromNet` on the
Teensy's main loop (`StatusFunctions.c:44`): a DNS lookup plus up to a 2500 ms wait for an NTP reply
(`StatusFunctions.c:83`, timeout logged at `:109`) — during which the Teensy services no command on any
transport. Measured over USB across 20 bare resets: the SID token arrives ~560-575 ms in, then a stall
begins 50-70 ms later, usually 124-133 ms (a fast NTP round trip) but 2543 ms once (the NTP timeout). A
command sent right after `ResetDevice` returns can land inside that stall. It reproduced intermittently
because NTP response time varies — the original failures clustered 04:40-05:28; a later full hardware-
suite run, with the sync-time window accounted for, passed both tests.

Why a launch lands as `Disconnected` rather than merely slow: `RemoteLaunch` needs the C64 menu to
acknowledge an IRQ within 50/200 ms (`RemoteControl.ino:48,61`); missing that window makes the firmware
fall back to resetting the C64 and relaunching (`RemoteControl.ino:295-305`), and in the observed
failure the device went unreachable on TCP for 14+ s and came back in full firmware with nothing
launched. This also bounds P06's own reset-and-recover path: after a minimal->full reboot, TCP recovery
cannot complete until the listener starts at `:276`, which is after the time sync — `ConnectionTransitions`
passed 4/4 the night this was traced. The exposure specific to this finding is an explicit `Reset`
followed within roughly 1-3 s by another command; whether Serial carries the same risk is still an open
question for the pending serial session (USB itself answers ~3.7 s after a reboot, while the DHCP +
time-sync window inside the menu boot may still be running at that point).

**Disposition: pending an operator decision**, not fixed in this corrective — options on the table are a
firmware-side readiness signal the API could wait on, or a follow-up change scoped once that decision is
made. The `Discovery/occasion after-numbers` table below could not be filled in as a result of the
original two failed runs — none of the three occasions were reached in that attempt.

`appsettings.json` is **unchanged**: both new TCP numbers land comfortably inside their ceiling seed
(SID 12.28 s vs 17 s ceiling, 28% margin; large launch 17.41 s vs 25 s ceiling, 30% margin) — the extra
overhead the reset-and-recover rows carry (two storage probes, the menu-boot-token wait) is already
absorbed by the existing `ToFullMs`/`ToMinimalMs`/`LaunchSettleMs` values.

### Session note (2026-09-21)

*Historical record of the now-superseded chained path — the stage names below (`ChainedLaunch (minimal
-> SID)`, `ChainedLaunch (minimal -> large -> minimal)`) no longer exist; this amendment renamed them to
`SidLaunch (minimal -> full, reset-and-recover)` and `LargeLaunch (minimal -> full -> minimal,
reset-and-recover)` and changed what they measure. Left as-is below since it is the only record of the
chained path's cost.*

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

Not run this session either: the 2026-09-21 session's TCP access did not stay up long enough to reach
`DiscoveryOccasionsTests`; the 2026-09-23 session did reach it, twice, but both attempts failed before
the first occasion's assertion — see that session note's "New finding" above. Serial is still
unavailable on this machine.

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
