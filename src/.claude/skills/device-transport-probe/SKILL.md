---
name: device-transport-probe
description: 'Talk to a real TeensyROM over USB serial or TCP without the API, and run the full/minimal swap routine through the API, to measure what the device actually does. Use when verifying connection, reset, boot, recovery or launch behavior on hardware; when a reviewer or coder must prove a transport change on the bench; when asked to "test serial", "test TCP", "swap test", "Monkey Island then a SID", "check the boot-complete flag", or "why did the device not answer". Includes a bench preflight, raw version/reset/boot/swap probes, and an API-level swap runner.'
---

# Device Transport Probe

Raw, timed access to a TeensyROM on both transports, plus the same routine driven through the API.
The raw probes show what the **device** does; the API runner shows what the **API** makes of it. When
the two disagree, the bug is in the API. Built during CONNECTION-2 (2026-09-23), where TCP passed
15/15 swaps and Serial failed 10/10 on the same device, and only the raw probe explained why.

Pairs with `api-live-debug` (debugger + log tap on the running API). For uploads and downloads, use
`file-transfer-diagnostics`, which builds on this skill's wire library.

## When to Use This Skill

- Proving a connection, recovery, reset or launch change against real hardware - on **both** transports
- A reviewer verifying such a change: run the same commands, compare with "Expected results" below
- Anything that depends on when the device is really ready (the `Boot:` flag, the SID token, stalls)
- Diagnosing "no answer", "Busy!", timeouts, or a transport that works while the other does not

## Setup (once per worktree)

`tools/` is gitignored, so every fresh worktree needs this once:

```
npm install --prefix .claude/skills/device-transport-probe/tools serialport@13.0.0
```

Node 20+. Scripts run from `.claude/skills/device-transport-probe/scripts/` (paths below are relative to it).
`serialport` is loaded only when a script opens a COM port, so the TCP probes (`version.mjs <ip>`, etc.)
work in a fresh worktree without this install.

## Firmware prerequisite

The API requires firmware that reports its own boot state - the version reply's `Boot:
complete|in progress` line (fork `C:\dev\src\TeensyROM-Fork`, branch `boot-complete-flag`, not upstream
yet). Stock firmware never sends that line: reset and recovery have no signal to wait on, so **a
preflight with no `Boot:` line is a stop, not a warning** - fix the bench before testing anything else.

Build: `node tools/build-firmware.mjs --target tr-plus --arduino-user "<Arduino user dir>" --out "<short
path>"`. Flash: `node tools/flash-firmware.mjs --hex <path>` (always pass `--hex`; the newest file may be
the wrong board's image) - both run from the firmware fork, not this repo. **Flashing is the operator's
decision**, never something an agent does on its own. Settings survive a flash.

## Step 1 - Preflight, every time

```
node preflight.mjs --tcp 192.168.1.37 --uid 19277260                  # raw probes: the API must be stopped
node preflight.mjs --tcp 192.168.1.37 --uid 19277260 --api-expected   # before api-swap.mjs (API running)
```

It checks the tooling, the API process, the USB ports and their image (full `0489` / minimal `0483`),
that each port opens and answers, the firmware's `Boot:` line, the TCP session, and that every path
reaches the same chip. **Do not start testing on a FAIL** - fix the bench, or stop and report it.
IP and UID above are this bench's TR+; confirm yours with the preflight output.

## Step 2 - The swap routine (full -> minimal -> full), both transports

A large cart (706 KB Monkey Island) makes the TR reboot into minimal to run it; a SID launched
afterwards needs full firmware, so whoever launches it must bring the device back first. This is the
path where recovery, reconnects and boot readiness all meet.

**Device level (no API)** - stop the API first:

```
node swap.mjs serial --rounds 3 --out swap-serial.log
node swap.mjs tcp 192.168.1.37 --rounds 3 --out swap-tcp.log
```

Prints a timeline per round (ports appearing/vanishing, every line the device prints, first reply,
`Boot:` states, SID token, longest silence) and a summary in ms after the reset.

**API level** - API running, preflight with `--api-expected`:

```
node api-swap.mjs --device 19277260 --rounds 10 --out api-swap.txt
node reset-launch.mjs --device 19277260 --rounds 10 --out reset-launch.txt
```

`api-swap.mjs`'s first line says which transport the API chose (`device 19277260 on Tcp (...)`).
**Check it**: `Connection:PreferredTransport` orders the start/reconnect occasions' own cached-endpoint
attempts and decides the survivor when a scan sees the device on both - see "Transport choice in the
API" under Pitfalls before trusting a run's transport. `reset-launch.mjs` sends a zero-gap
`PUT .../reset` immediately followed by a SID launch, no pause between them; a round passes only when
both return `200`, and the launch only answers `200` once the firmware's `GoodSIDToken` has actually
landed - so 10/10 here is direct proof the boot-complete wait holds at the tightest timing the API can
produce.

## Prove a connection change

The end-to-end procedure a coder or reviewer runs against real hardware, both transports, to back any
change touching reset, recovery, discovery, or launch:

1. `node preflight.mjs --tcp <ip> --uid <chipId>` - fix the bench on any FAIL before continuing.
2. Point the API at the transport under test: set `Connection__PreferredTransport` (`Tcp` or `Serial`),
   start the API, then force a full discovery (`GET /api/devices/?fullScan=true` - `api-swap.mjs` always
   runs one itself) to be certain regardless of what the cache already holds. Confirm `api-swap.mjs`'s
   first line names the transport you meant to test.
3. `node api-swap.mjs --device <chipId> --rounds 10 --out api-swap-<transport>.txt`
4. `node reset-launch.mjs --device <chipId> --rounds 10 --out reset-launch-<transport>.txt`
5. Stop the API - it holds every port during discovery/recovery, and the hardware suite opens its own.
6. Hardware suite, same transport, the class-name filter from P07-T01:
   ```
   cd apps/api/src/TeensyRom.Core.Device.Tests.Integration
   TEENSYROM_BENCH_TRANSPORT=<Serial|Tcp> TEENSYROM_BENCH_CHIP_IDS=<chipId> dotnet test --filter "FullyQualifiedName~ConnectionTransitionsTests|FullyQualifiedName~DiscoveryOccasionsTests"
   ```
7. Repeat steps 2-6 on the other transport.

Reviewers re-run at least steps 3 and 4 on both transports rather than trusting the coder's numbers. A
bench FAIL - a device that never answers, a preflight FAIL, a suite skip - is reported as the bench, not
the code; compare against "Expected results" below before concluding either way.

## Step 3 - Other probes

| Script | Use |
|---|---|
| `version.mjs <COM4 \| ip>` | One version exchange: decoded events + raw hex/text. Byte-for-byte comparisons between firmware builds. |
| `reset.mjs serial \| <COM4 \| ip>` | Back to full from anywhere (minimal, a running cart) and wait until full reports `Boot: complete`. Use after an aborted run. |
| `boot.mjs <COM4 \| ip> --runs 5` | Reset in full, version every 50 ms: when the flag moves, SID token, longest stall, anything wrong after `complete`. |

## Expected results (TR+ on this bench, POC firmware with the boot-complete flag)

| Run | Expected |
|---|---|
| `boot.mjs` (either transport) | `in progress` from ~100 ms, SID token ~560-590 ms, stall ~90-200 ms, `complete` ~880-1030 ms; **about 1 in 20** runs has a ~2.5 s stall (network time sync) and `complete` ~3.4 s. Never a gap after `complete`, never back to `in progress`. |
| `swap.mjs serial` | After the reset: COM7 (minimal) gone ~40 ms, back ~800 ms (minimal boot stage, prints `Jumping to code at ...`, never answers), gone ~1390 ms; COM4 (full) ~1610 ms; first reply ~1750 ms; SID token ~2310 ms; then **no answer for ~2 s** (Ethernet init + time sync; ~4 s in the long case); `complete` ~4.3-4.5 s (6.8 s long case). |
| `swap.mjs tcp` | TCP refuses/times out until the very end of the boot, then accepts ~5-8 s after the reset; the first reply already says `Boot: complete`. |
| `api-swap.mjs` on TCP (boot-complete-flag firmware) | 10/10; SID ~9 s median (device-bound - the boot-complete wait rides the whole menu boot, not a fixed timeout; ~5.5 s when a terminal holds the USB ports with DTR, since the firmware's `Serial.begin()` wait releases early), large ~5.8 s. Bench 2026-09-26: SID min 8.54 / median 9.03 / max 9.14 s, large 5.78-5.85 s. |
| `api-swap.mjs` on Serial (boot-complete-flag firmware) | 10/10; SID ~5.2 s median, large ~3.9 s. Bench 2026-09-26: SID min 5.00 / median 5.30 / max 5.69 s, large 3.85-3.95 s. |
| `reset-launch.mjs` (either transport) | 10/10; reset 1.1-1.5 s including the boot-complete wait (occasionally ~2.5-3.7 s when the menu's network time sync stalls), launch ~150-240 ms. Bench 2026-09-26: TCP reset 1.10-1.51 s / launch 0.19-0.24 s; Serial reset 1.10-3.71 s / launch 0.15-0.17 s. |

## Pitfalls - everything that is not the code under test

**Exclusive access**
- TCP takes **one** client. The API, the UI's API, the hardware integration suite, and these probes all
  compete for it. A refused/timed-out connect usually means someone else holds it.
- A COM port opens once. The API opens **every** COM port during discovery (startup, `FullScan`, UI
  refresh). Never run raw probes while the API is starting or scanning.
- The API runs discovery by itself at startup (~20 s). Wait for "Application started" before calling it.
- **Never run `TeensyRom.Api.Tests.Integration` during bench work.** It boots the real API in-process,
  whose startup discovery opens every COM port and holds the one TCP session, exactly like a second API
  instance would - it will contend with whatever probe or hardware-suite run is already in progress.
- Once the API legitimately holds Serial as its live connection, `preflight.mjs --api-expected` reports
  a **FAIL** on that port (`Access denied` opening it) - expected, not a defect. It cannot open a port
  the API already owns; that FAIL is proof the API is on Serial, not a bench problem.

**Device state**
- Start from full firmware at the menu. After a swap or an aborted run the TR may be in minimal: run
  `node reset.mjs serial`. If the device stops answering altogether, a human must power-cycle it -
  stop and report; do not loop.
- COM numbers differ between machines and images (here: COM4 full, COM7 minimal). Never hardcode them;
  the scripts find ports by USB product id.
- Only the chip under test should be live. Another TR on the network or USB shows up as a second UID
  in preflight; target yours explicitly.
- Node's `serialport` asserts DTR by default when it opens a port, same as the API now does for a port
  already proven a TeensyROM (Full or Minimal image only - never an Unknown row or a blind-scan
  candidate). A raw probe here sees the same fast release out of minimal's `Serial.begin()` wait the API
  sees, so the two are directly comparable again.
- A probe must not poll the version command during a menu boot, before the SID token: a request
  answered in that window can make the Teensy miss a C64 bus cycle and corrupt the menu's copy of itself
  into C64 RAM (bench: every failed boot came from a round that polled then; none from 26 silent
  rounds). Wait for the token first, the same as the API's own reset/recovery does.
- Playing a tune through the **ASID player** takes a unit off TCP entirely while it plays (bench-confirmed,
  2026-10-10, expected) - a TCP probe that can't reach a unit may just mean ASID is active, not a
  connectivity bug.

**Firmware**
- See "Firmware prerequisite" above for what the boot-complete flag is and how to build/flash it. Know
  which firmware the device runs before judging results (`version.mjs`).
- The minimal image prints boot text (`Pre0: ...`, `Loading IO handler: ...`) straight to USB serial,
  interleaved with replies. Parsers must tolerate it; the probes show it as text events.

**Network**
- Never reboot a **static-IP** unit with its cable out: it loops waiting for the network instead of ever
  coming back (a limitation of its Ethernet library) - bench-confirmed, 2026-10-10. Unplug to force serial
  only on a unit already up and running, never across a reset.
- The bench PC must be on the TR's subnet (here 192.168.1.x, TR at 192.168.1.37:2112).

**Transport choice in the API**
- `Connection:PreferredTransport` (`appsettings.json`, default `Tcp`; env var
  `Connection__PreferredTransport`) does three things, not one: it orders the start occasion's own
  cached-row confirm (preferred endpoint first, then the row's other cached endpoint once,
  `DeviceConnectionManager.TryConfirmCachedRow`), orders Reconnect's confirm the same way, and decides
  which transport survives when a scan sees a chip on both (`CartFinder.DeduplicateByDeviceId`).
- Changing the setting and restarting is enough on its own **when the cached row already holds an
  endpoint for the new preferred transport** - the next start tries that endpoint first, no full scan
  needed. A row missing that endpoint still needs a fresh discovery (Discover Devices, or the search a
  Start/Reconnect miss triggers) before the setting can take effect for that unit. Always read
  `api-swap.mjs`'s first line rather than assuming either way.
- The hardware suite's `TEENSYROM_BENCH_TRANSPORT` sets `HardwareFixture`'s own `PreferredTransport`
  directly, not through `appsettings.json` - so `Serial` reliably drives Serial even with Ethernet up,
  no listener toggle needed for this suite.

**Test data on the SD card**
- The swap uses `/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt` and
  `/music/DEMOS/M-R/Melody.sid`. Use fixed paths: `random-launch` depends on the SD index, which a fresh
  API has not built.

**Timing and tools**
- Rounds take 30-60 s each. Keep an agent's shell timeout above rounds x 60 s, or run in the
  background with `--out` and read the file.
- The long time-sync stall hits about 1 run in 20: run at least 10 rounds before calling anything
  stable, and size ceilings for it (Serial reset-from-minimal to `complete` reaches ~6.8 s).
- Paths with spaces, brackets and parentheses: quote them for the shell; `api-swap.mjs` URL-encodes.

**Evidence for review**
- Coders attach the `--out` files (`api-swap.txt`, `reset-launch.txt`) and the preflight output to their
  report. Reviewers re-run preflight and at least `api-swap.mjs` and `reset-launch.mjs` on both
  transports ("Prove a connection change" above), and compare against "Expected results" - on a bench
  FAIL, the review reports the bench, not the code.

## Protocol reference

| Token | Value | Direction | Notes |
|---|---|---|---|
| Version | `64 76` | app -> TR | Reply: Ack, then text: `FW: ...`, build date, `Teensy: ... UID: n`, machine line, `Boot: ...` (flag firmware). Minimal: `FW: ...(minimal)`, ends at the UID line. |
| Reset | `64 EE` | app -> TR | Full: `Reset cmd received`, menu reboots (Teensy keeps running). Minimal: reboots the Teensy. |
| FW check | `64 E0` | app -> TR | Answers `E2 64` (full) or `E1 64` (minimal). |
| Launch | `64 44` | app -> TR | Ack, then drive byte (USB 0, SD 1, Teensy 2) + path + NUL, Ack. |
| Ack | `CC 64` | TR -> app | Tokens arrive low byte first. |
| GoodSid / BadSid | `81 9B` / `80 9B` | TR -> app | A SID header parsed. After a reset this is the menu's startup SID, **not** "ready". |
| Fail / Retry | `7F 9B` / `7E 9B` | TR -> app | |

USB: vendor `16C0`, full firmware product `0489` (Serial+MIDI), minimal `0483`. TCP port 2112.
Firmware source: `C:\dev\src\TeensyROM-Fork` (`Source/Teensy/SerUSBIO.ino` command dispatch,
`MinimalBoot/Min_*.ino` minimal image, `MinimalBoot/Common/Common_Defs.h` tokens).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `serialport is not installed` | Run the Setup line in this worktree |
| `Access denied` / `open failed` on a COM port | The API or another tool holds it |
| TCP `connect timeout` / `ECONNREFUSED` | Another TCP client, the TR mid-boot, listener off, or wrong IP |
| TCP connects at once but the reply is `0 bytes` | The unit's network stack is up but the firmware is not serving this client - it serves one at a time (`Teensy.ino`, `if(!tcpClient)`) and frees the slot only once it sees the old client disconnect (`ServiceTCP.ino`). Confirm from the host: `Get-NetTCPConnection -RemoteAddress <ip>` (PowerShell) shows the closed probe stuck in `FinWait2` - the unit acknowledged our close but the firmware never closed its end. Seen 2026-10-21 on TR-2 with no other client on this PC (CONNECTION-8). Reproduce and verify it in [Dead-link scenarios](#dead-link-scenarios) |
| `no full-firmware Teensy port found` | Device in minimal (`reset.mjs serial`) or not on USB |
| Preflight FAIL "no Boot: line" | Firmware without the boot-complete flag - flash the fork's `boot-complete-flag` branch (see "Firmware prerequisite") |
| Preflight FAIL "Access denied" on a COM port while `--api-expected` | The API legitimately holds Serial as its live connection - expected, not a defect (see "Exclusive access") |
| All hardware tests skipped on a transport | No device confirmed there at all - check the unit is actually reachable on that transport; `TEENSYROM_BENCH_TRANSPORT` alone no longer needs the listener off |

## Dead-link scenarios

Bench checks for the dead-link recovery behavior (CONNECTION-8 P01). Run them one at a time against the unit under test.

- The operator performs and approves every unit action (reboot, unplug, network or internet change). Each scenario needs one, so the agent asks before each one and runs one action per turn.
- Starting state: each scenario begins with the unit online over Tcp, which `trom device list` shows as Online `yes` with Connection `Ethernet <ip>`. A scenario can leave the unit offline or on USB (Connection `USB <COM>`), and a failed recovery leaves it offline, after which `trom` refuses every `--device` command against it. Before the next scenario, the operator restores the unit with the network cable in: `trom device reconnect --device <name>`, then `trom device list`. Continue only once it shows Online `yes` on `Ethernet <ip>`. If it does not come back, stop and report; do not loop.
- Run the log tap for the whole session, because the engine's file log has no timestamps: `node .claude/skills/api-live-debug/scripts/logtap.mjs <out.log>` from `src/` (the Log tap section of `api-live-debug` has the details). The tap needs `@microsoft/signalr`, which a fresh worktree does not have: run `pnpm install` in `src/` first. The tap stamps arrival time and batches lines, so read the order of lines, not the gaps between them.
- Never run `TeensyRom.Api.Tests.Integration` during the bench. It boots its own API in-process and takes the TCP session and every COM port.
- Pass `--device <name>` to every `trom` command. Without it an interactive picker waits for arrow keys.

Log lines below are quoted from the code. `<...>` is filled in by the run, and `Tcp` and `Serial` are the transport names.

### Reboot under an open TCP link, read first

- **Operator:** reboot the unit with its network cable in, then wait for the C64 menu to show. Do not connect a probe to the unit meanwhile; the engine holds the TCP session.
- **Commands:** `trom file ls <dir> --device <name>`, where `<dir>` is a directory the engine has never listed. A cached directory is answered without touching the device.
- **Expected:** the listing succeeds on the first command.
- **Log lines:** one of two shapes, recorded as seen:
  - a reconnect before the command: `Disconnecting from <endpoint>.`, then `TcpObservablePort.OpenPort: Connecting to <endpoint> (bounded, <N>ms)`, then `TcpObservablePort.OpenPort: Successfully connected to <endpoint>`, all before the read;
  - a recovery and re-send: `CommunicationPortBehavior: link <reason> on Tcp: recovered in <N> ms; re-sending GetDirectoryRecursiveCommand once`, then `CommunicationPortBehavior: re-send of GetDirectoryRecursiveCommand succeeded`.

### Reboot under an open TCP link, launch after keep-alive

- **Operator:** reboot the unit with its network cable in, then wait at least 90 s from the reboot (the menu boot plus about 75 s of keep-alive) before the launch.
- **Commands:** `trom file launch /music/DEMOS/M-R/Melody.sid --device <name>`.
- **Expected:** the launch succeeds with no visible failure.
- **Log lines:** before the launch's own lines, `Disconnecting from <endpoint>.`, then `TcpObservablePort.OpenPort: Connecting to <endpoint> (bounded, <N>ms)`, then `TcpObservablePort.OpenPort: Successfully connected to <endpoint>`: the closed link is caught and reconnected before the command. No `DeviceRecovery:` line appears before the launch.
- A launch sent sooner after the reboot may honestly fail with `The network connection to the TeensyROM dropped while this command was being sent. The connection is back, but the command may or may not have run.` The host cannot know the link is dead until keep-alive or a reply says so. If that happens, record the delay from reboot to launch and the result returned.

### Drop mid-command

- **Operator:** unplug the unit's network cable as the command is sent, then re-plug it after a few seconds, well inside the TCP drop ceiling (`ceiling 15000 ms` in the log). Do the read first, then the launch, each with its own unplug.
- **Before the launch:** with the network cable in, run `trom file ls /music/DEMOS/M-R --device <name>` once. The launch reads its parent directory from the device first; with that listing cached, the unplug can only cut the launch's own exchange.
- **Commands:** `trom file ls <dir> --device <name>` (a directory the engine has never listed), then `trom file launch /music/DEMOS/M-R/Melody.sid --device <name>`.
- **Expected:** the read is re-sent and succeeds. The launch fails with `The network connection to the TeensyROM dropped while this command was being sent. The connection is back, but the command may or may not have run.` once its bytes went out, whether the drop came before or after its ack. A launch whose bytes went out is never re-sent. If the unplug landed before any launch bytes were written, the launch is re-sent once and succeeds instead. Record which of the two happened.
- **Log lines, read:** `CommunicationPortBehavior: link <Drop|SuspectLink> on Tcp: recovered in <N> ms; re-sending GetDirectoryRecursiveCommand once`, then `CommunicationPortBehavior: re-send of GetDirectoryRecursiveCommand succeeded`.
- **Log lines, launch, drop before the ack:** `DeviceRecovery: Recovery <Drop|SuspectLink> on Tcp for <id>: ceiling <N> ms`, then `CommunicationPortBehavior: not re-sending LaunchFileCommand: bytes already went out`.
- **Log lines, launch, drop after the ack:** `DeviceRecovery: Recovery Drop on Tcp for <id>: ceiling <N> ms`, with no re-send line.
- **Log lines, launch, nothing written yet:** `DeviceRecovery: Recovery <Drop|SuspectLink> on Tcp for <id>: ceiling <N> ms`, then `CommunicationPortBehavior: link <Drop|SuspectLink> on Tcp: recovered in <N> ms; re-sending LaunchFileCommand once`, then `CommunicationPortBehavior: re-send of LaunchFileCommand succeeded`.

### A slow boot is not mistaken for a stuck session

- **Operator:** cut the internet upstream of the bench switch so the menu's time sync stalls. Reboot the unit with its network cable in and wait a few seconds into the boot, before the menu shows. Restore the internet afterward.
- **Commands:** `trom device ping --device <name>`, sent a few seconds after the reboot.
- **Expected:** either the ping waits and then succeeds, or it fails with `Lost the network connection to the TeensyROM and could not get it back. Check that it is powered on and connected.` because the boot outlasted the recovery ceiling. A failure leaves the unit offline: restore it per the starting-state note before the next scenario.
- **Log lines:** no `DeviceRecovery: Recovery <reason> on Tcp for <id>: stuck TCP session - the unit accepts connections but never answers` line and no `DeviceConnectionManager: fell back to serial on <COM> after a stuck TCP session` line. A failure shows `DeviceRecovery: Recovery <reason> on Tcp for <id> failed after <N> ms (ceiling <N> ms)`.

### Healthy link survives a slow menu boot

- **Operator:** make the menu's boot slow while the unit stays reachable over TCP: turn NFC on with no reader attached, or cut the internet upstream of the bench switch as above. Undo it afterward.
- **Commands:** time `trom device reset --device <name>` from send to reply; the reset returns once the menu's boot wait ends (`Boot: complete`, or the menu-boot ceiling). Then run `trom device ping --device <name>` as the next command.
- **Expected:** the reset completes and the ping succeeds on the same connection. Record the reset time.
- **Log lines:** between the reset and the ping there is no `Disconnecting from <endpoint>.` line, no `TcpObservablePort.OpenPort: Connecting to` line, and no `DeviceRecovery:` line. The keep-alive does not kill the link.

### Stuck TCP session with USB attached

- **Operator:** keep the USB cable in. Reproduce the stuck session through ASID use, or confirm it with `node version.mjs <ip>` returning 0 bytes and `Get-NetTCPConnection -RemoteAddress <ip>` showing `FinWait2`.
- **Commands:** `trom file ls <dir> --device <name>` on an uncached directory.
- **Expected:** the command fails with `The TeensyROM's network session was stuck, so it is now connected over USB instead. Try the command again.` `trom device list` then shows the unit on its COM port (Connection `USB <COM>`). Restore the unit over TCP per the starting-state note before the next scenario.
- **Log lines:** `DeviceRecovery: Recovery <reason> on Tcp for <id>: stuck TCP session - the unit accepts connections but never answers`, then `DeviceConnectionManager: fell back to serial on <COM> after a stuck TCP session`.

### The same stuck session with USB unplugged

- **Operator:** reproduce the stuck session as above, then unplug the USB cable. Keep the network cable in.
- **Commands:** `trom file ls <dir> --device <name>` on an uncached directory.
- **Expected:** the command fails with `The TeensyROM's network session is stuck: it accepts a connection but does not answer. Restart the TeensyROM to clear it.` The response mentions neither serial nor USB. The operator then restarts the unit, and once it is back with the network cable in, restores it per the starting-state note (`trom device reconnect`) before the next scenario.
- **Log lines:** the stuck-session `DeviceRecovery:` line above, and no `fell back to serial` line. The engine also logs the failed fall-back attempt, and that line does name serial: one of `DeviceConnectionManager: no serial connection known for <id>; not falling back` (a unit never seen on USB), `DeviceConnectionManager: serial fall-back for <id> found no answering port in <N> ms`, or `DeviceConnectionManager: serial fall-back miss for <id>: <message>`.

### Failed directory read vs not found

- **Operator:** for the failed read, unplug the network cable and leave it out for the read, then re-plug it, and restore the unit per the starting-state note. For the not-found read, the network cable stays in.
- **Commands:** `trom file ls <dir> --device <name>` on an uncached directory with the network cable out, then `trom device reconnect --device <name>` with it in, then `trom file ls /no/such/dir --device <name>`. The failed read leaves the unit offline, so the reconnect comes before the not-found read.
- **Expected:** the failed read fails with `Lost the network connection to the TeensyROM and could not get it back. Check that it is powered on and connected.` (the API answers 502; the CLI exits 1). The missing path fails with ``The directory /no/such/dir was not found on <name> after 3 attempts — check the path with `trom file ls`.`` (the API answers 404 with `The directory /no/such/dir was not found.`; the CLI retries it three times, rewords it and exits 5). To see the HTTP status, run `curl -i "http://localhost:10213/api/devices/<id>/storage/SD/directories?Path=/no/such/dir"`.
- **Log lines:** the failed read logs `The directory <dir> could not be read: <failure>` and `DeviceRecovery: Recovery <reason> on Tcp for <id> failed after <N> ms (ceiling <N> ms)`. The not-found read logs neither line.

## Healthy-link timing check

Debugger detached; the log tap is optional. No unit action is needed. Use a good TCP link.

1. Time 20 pings, reading curl's `time_total` (seconds):
   ```
   for i in $(seq 20); do curl -s -o /dev/null -w "%{time_total}\n" http://localhost:10213/api/devices/<id>/ping; done
   ```
2. Time 5 SID launches, the same way:
   ```
   for i in $(seq 5); do curl -s -o /dev/null -w "%{time_total}\n" -X POST "http://localhost:10213/api/devices/<id>/storage/SD/launch?FilePath=/music/DEMOS/M-R/Melody.sid"; done
   ```
3. Time directory reads: list `/music/DEMOS/M-R` once to cache it, then time 5 more reads of it (cached). Time one read of a directory the engine has never listed (uncached), and note its path:
   ```
   for i in $(seq 5); do curl -s -o /dev/null -w "%{time_total}\n" "http://localhost:10213/api/devices/<id>/storage/SD/directories?Path=/music/DEMOS/M-R"; done
   ```
4. From `.claude/skills/device-transport-probe/scripts/`, run `node reset-launch.mjs --device <id> --rounds 10 --out reset-launch.txt` and compare it with the Expected results table above.

Report min, median and max for each set: 20 pings, 5 launches, 5 cached directory reads, and the 1 uncached read.

- **Before:** the 2026-10-21 baselines are pings about 0.25 s end to end through curl (the engine-side 44 ms has no log line to reproduce it, so it is a reference only) and SID launches 276-308 ms. There is no directory-read baseline. To re-measure any of them, build base commit `001c5a4b` in a scratch worktree (`git worktree add <scratch> 001c5a4b`) and run the same steps against it, one engine at a time, since only one engine runs per `~/.teensyrom` home.
- **After:** the medians must match "before" within normal run-to-run variation.

## Dead-link results

| Scenario | Unit | Date | Result | Notes |
|---|---|---|---|---|
| Reboot under an open TCP link, read first | | | | |
| Reboot under an open TCP link, launch after keep-alive | | | | |
| Drop mid-command | | | | |
| A slow boot is not mistaken for a stuck session | | | | |
| Healthy link survives a slow menu boot | | | | |
| Stuck TCP session with USB attached | | | | |
| The same stuck session with USB unplugged | | | | |
| Failed directory read vs not found | | | | |
| Healthy-link timing check | | | | |
