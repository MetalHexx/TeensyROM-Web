---
name: device-transport-probe
description: 'Talk to a real TeensyROM over USB serial or TCP without the API, and run the full/minimal swap routine through the API, to measure what the device actually does. Use when verifying connection, reset, boot, recovery or launch behavior on hardware; when a reviewer or coder must prove a transport change on the bench; when asked to "test serial", "test TCP", "swap test", "Monkey Island then a SID", "check the boot-complete flag", or "why did the device not answer". Includes a bench preflight, raw version/reset/boot/swap probes, and an API-level swap runner.'
---

# Device Transport Probe

Raw, timed access to a TeensyROM on both transports, plus the same routine driven through the API.
The raw probes show what the **device** does; the API runner shows what the **API** makes of it. When
the two disagree, the bug is in the API. Built during CONNECTION-2 (2026-09-23), where TCP passed
15/15 swaps and Serial failed 10/10 on the same device, and only the raw probe explained why.

Pairs with `api-live-debug` (debugger + log tap on the running API).

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
**Check it**: `Connection:PreferredTransport` decides the transport when the device answers on both, but
a cached connection row keeps whatever transport it cached regardless of the setting - see "Transport
choice in the API" under Pitfalls before trusting a run's transport. `reset-launch.mjs` sends a zero-gap
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
   runs one itself). Confirm `api-swap.mjs`'s first line names the transport you meant to test.
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

**Firmware**
- See "Firmware prerequisite" above for what the boot-complete flag is and how to build/flash it. Know
  which firmware the device runs before judging results (`version.mjs`).
- The minimal image prints boot text (`Pre0: ...`, `Loading IO handler: ...`) straight to USB serial,
  interleaved with replies. Parsers must tolerate it; the probes show it as text events.

**Network**
- Never unplug Ethernet to force serial: with a static IP the TR blocks at boot looking for the link
  (a limitation of its Ethernet library).
- The bench PC must be on the TR's subnet (here 192.168.1.x, TR at 192.168.1.37:2112).

**Transport choice in the API**
- `Connection:PreferredTransport` (`appsettings.json`, default `Tcp`; env var
  `Connection__PreferredTransport`) decides which transport wins when a chip answers on both
  (`CartFinder.DeduplicateByDeviceId`).
- **A cached connection row keeps the transport it cached.** Changing the setting and restarting the API
  is not enough by itself: the cache-first start (`DeviceConnectionManager.RunConnectAtStart`) just
  reconfirms whatever transport the last run wrote to `ConnectionRecords.json`. The change only takes
  effect at the next full discovery - `GET /api/devices/?fullScan=true`, which `api-swap.mjs` always
  triggers first. Always read `api-swap.mjs`'s first line rather than trusting the setting alone.
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
| `no full-firmware Teensy port found` | Device in minimal (`reset.mjs serial`) or not on USB |
| Preflight FAIL "no Boot: line" | Firmware without the boot-complete flag - flash the fork's `boot-complete-flag` branch (see "Firmware prerequisite") |
| Preflight FAIL "Access denied" on a COM port while `--api-expected` | The API legitimately holds Serial as its live connection - expected, not a defect (see "Exclusive access") |
| All hardware tests skipped on a transport | No device confirmed there at all - check the unit is actually reachable on that transport; `TEENSYROM_BENCH_TRANSPORT` alone no longer needs the listener off |
