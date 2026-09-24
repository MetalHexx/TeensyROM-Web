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
```

Its first line says which transport the API chose (`device 19277260 on Tcp (...)`). **Check it**: the
API keeps TCP whenever the device answers on both, so without a way to prefer Serial (see Pitfalls) an
"API on Serial" run silently tests TCP.

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
| `api-swap.mjs` on TCP (API at 1b1e7703) | Large ~6.0 s, SID ~12.0-12.8 s, 10/10. |
| `api-swap.mjs` on Serial (API at 1b1e7703) | 0/10: SID step 502 in ~3.3 s ("A device attached to the system is not functioning"). Known defect, see Pitfalls. |

## Pitfalls - everything that is not the code under test

**Exclusive access**
- TCP takes **one** client. The API, the UI's API, the hardware integration suite, and these probes all
  compete for it. A refused/timed-out connect usually means someone else holds it.
- A COM port opens once. The API opens **every** COM port during discovery (startup, `FullScan`, UI
  refresh). Never run raw probes while the API is starting or scanning.
- The API runs discovery by itself at startup (~20 s). Wait for "Application started" before calling it.

**Device state**
- Start from full firmware at the menu. After a swap or an aborted run the TR may be in minimal: run
  `node reset.mjs serial`. If the device stops answering altogether, a human must power-cycle it -
  stop and report; do not loop.
- COM numbers differ between machines and images (here: COM4 full, COM7 minimal). Never hardcode them;
  the scripts find ports by USB product id.
- Only the chip under test should be live. Another TR on the network or USB shows up as a second UID
  in preflight; target yours explicitly.

**Firmware**
- `Boot: complete|in progress` exists only on firmware with the boot-complete flag (fork branch
  `boot-complete-flag`, not upstream yet). Without it, preflight WARNs and boot waits fall back to the
  SID token. Know which firmware the device runs before judging results (`version.mjs`).
- Flashing is a human decision: `node tools/flash-firmware.mjs --hex <path>` in the firmware fork
  (always pass `--hex`; the newest file may be the wrong board's image). Settings survive a flash.
- The minimal image prints boot text (`Pre0: ...`, `Loading IO handler: ...`) straight to USB serial,
  interleaved with replies. Parsers must tolerate it; the probes show it as text events.

**Network**
- Never unplug Ethernet to force serial: with a static IP the TR blocks at boot looking for the link
  (a limitation of its Ethernet library).
- The bench PC must be on the TR's subnet (here 192.168.1.x, TR at 192.168.1.37:2112).

**Transport choice in the API**
- The API keeps TCP whenever a device answers on both (`CartFinder.DeduplicateByDeviceId`).
- The hardware suite's `TEENSYROM_BENCH_TRANSPORT=Serial` does **not** override that: with Ethernet up
  the fixture finds no Serial device and every test **skips** ("no device confirmed on Serial"). A run
  of skips is not a pass.
- Until the API has a supported transport preference, Serial through the API needs either the TR's TCP
  listener switched off in the C64 menu (F8 -> 3 -> b; a human action, and it changes the boot) or a
  temporary local edit that must never be committed.

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
- Coders attach the `--out` files and the preflight output to their report. Reviewers re-run preflight
  and at least the swap on both transports, and compare against "Expected results" - on a bench FAIL,
  the review reports the bench, not the code.

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
| Preflight WARN "no Boot: line" | Firmware without the boot-complete flag |
| All hardware tests skipped on Serial | Ethernet is up; see "Transport choice in the API" |
