---
name: file-transfer-diagnostics
description: 'Test and diagnose file transfers (uploads and downloads) between the engine and a real TeensyROM, over USB and the network: a regression set to run after a firmware update, raw upload and download probes that bypass the engine, a .NET USB reader that isolates the engine from the USB path, and an engine download loop that reads the stall and retry lines back from the log. Use when a firmware update touches FileTransfer.ino, when an upload or download fails, stalls, hangs or arrives wrong, when asked to "test file transfers", "check downloads over USB", "why did the download fail", or to prove a change to GetFile, SaveFiles or TransferFiles on hardware.'
---

# File Transfer Diagnostics

Built during the firmware 0.9 catch-up (2026-10-28), when Kelly Fox's upstream PR #40 changed
`FileTransfer.ino`. The baseline-then-retest found no firmware regressions, but three API problems and a
USB data loss below the firmware's own code. Everything here is what found them.

Pairs with `device-transport-probe`, which this skill borrows from: its wire library
(`scripts/lib/wire.mjs`), its `serialport` install, and its preflight and exclusive-access rules. It also
pairs with `api-live-debug`, which provides the debugger and the timestamped log tap.

## When to Use This Skill

- A firmware update changes `FileTransfer.ino` (uploads, downloads, deletes): run the regression set
- A download fails, hangs, is slow, or arrives with wrong bytes; an upload leaves a partial file
- Proving a change to `GetFileCommandHandler`, the ports' reads, `SaveFiles` or `TransferFiles` on hardware

## Pieces

Paths are relative to this skill's folder; run the scripts from `scripts/`.

| Piece | Path | What it does |
|---|---|---|
| Download loop | `scripts/download-loop.mjs` | Downloads one file through the engine (`trom file download`) N times, compares each copy, prints the engine log lines that explain a slow or failed run |
| Download probe | `scripts/download-probe.mjs` | Raw GetFile, engine stopped: when each part arrives, gaps over 200 ms, where the body first differs, what follows it. Optional deliberate reader pause |
| Upload probe | `scripts/upload-probe.mjs` | Raw broken uploads, engine stopped: `stall`, `window`, `checksum`, each ending with a check for a partial file |
| USB reader | `scripts/usb-reader/` | .NET console program: GetFile over USB with only `SerialPort`, the engine's settings, reads back to back; reports each missing block's offset |

## Setup (once per worktree)

```
npm install --prefix .claude/skills/device-transport-probe/tools serialport@13.0.0
dotnet build -c Release .claude/skills/file-transfer-diagnostics/scripts/usb-reader
```

The first line is `device-transport-probe`'s own setup; TCP probes work without it. The reader lands in
`scripts/usb-reader/bin/Release/net9.0/UsbReader.exe` (`bin/` and `obj/` are gitignored).

**Test files.** Put these on each board's SD card, in a scratch folder per board (`/tr-fix-TR-1`,
`/tr-fix-TR-2` below), with `trom file upload <files> --to /tr-fix-TR-1 --device TR-1`:

- an 8 MB file of random bytes, named `.crt` so the CLI accepts it (the endpoint's limit is 10 MB):
  `node -e "require('fs').writeFileSync('big.crt', require('crypto').randomBytes(8*1024*1024))"`
- a ~1 MB cart (the bench used `ABEECS.CRT`) and two SIDs.

**Turn auto-launch off first**, or every upload launches a file, and a random-bytes `.crt` is not one to
launch: save `GET http://localhost:10213/api/settings`, set `autoLaunchOnCopyEnabled` to false, and POST
the saved copy back when the session ends. Delete the scratch folders afterwards.

## Bench rules

- **One device action per turn.** Report, then ask before touching a device. Flashing, unplugging and
  power-cycling are the operator's.
- **Raw probes and the USB reader need the engine stopped** (`trom engine stop`). The engine holds every
  COM port and the board's single TCP session.
- **Choose the engine's transport** before the command that starts it, then confirm it:
  ```
  trom engine stop
  $env:Connection__PreferredTransport = 'Serial'      # PowerShell; leave it unset for the network
  trom device list --json                              # "connection": "USB COM12" or "Ethernet 192.168.1.38"
  ```
- **Preflight the engine log** (`trom engine status --json` gives `logFile`): `wrong chip` means two boards
  share a MAC (bench identity, not code); `start confirm miss for <id>: no answer` means a board did not
  answer on USB at start and the engine took the network instead. Restart the engine and check again.
- **Run this checkout's `trom`.** A `trom` on PATH from another worktree runs another branch's engine:
  check `(Get-Command trom).Source`. From source, `trom` rebuilds the engine when the API's sources changed.
- **Never run `TeensyRom.Api.Tests.Integration`** with boards attached: it starts a second engine.

## Regression set after a firmware update

Run it once on the old firmware (the baseline) and once on the new, same boards, same files. Network is the
default link; USB rows need the engine restarted on `Serial`.

| # | Test | Boards / link | How | Pass |
|---|---|---|---|---|
| 1 | Upload two SIDs and the 1 MB cart to a new folder, then upload one again | both, network | `trom file upload` | All copied. A replace logs `already exists`, a delete and a resend: that is the API's normal replace |
| 2a | 1 MB download ×3, then a ping | both, network and USB | `download-loop.mjs --runs 3`, `trom device ping` | All match, ping `Success!` |
| 2b | 8 MB download | both, network and USB | `download-loop.mjs --runs 10` on USB | All match; compare the times below |
| 2c | 1 MB download ×10 | TR-1, network and USB | `download-loop.mjs --runs 10` | 10/10 |
| 3/4 | Broken uploads | TR-1 USB, TR-2 network, engine stopped | `upload-probe.mjs <target> stall`, `window`, `checksum` | See the expected results |
| 5 | Kill the engine 1.5 s into an 8 MB upload, restart, upload again, download and compare | TR-2, network | The snippet below | No `already exists` on the re-upload; the download matches |
| 6 | List an empty folder | both | `trom file ls /tr-probe --device <name>` | `/tr-probe is empty.`, exit 0, no `error parsing` or `No data` in the log |

`download-loop.mjs` example (from `scripts/`):

```
node download-loop.mjs --device TR-1 --path /tr-fix-TR-1/big.crt --local C:\bench\big.crt --runs 10
```

**Test 5, timed from the log.** The board transfer starts 3-4 s after the CLI does (the CLI starts, sends the
file to the engine, the engine stages it), so killing 1.5 s after the CLI starts kills the engine before the
board sees a byte. Wait for the log's `TransferFilesCommand Started`, then kill (PowerShell):

```
$log = (trom engine status --json | ConvertFrom-Json).logFile
$enginePid = (Get-NetTCPConnection -LocalPort 10213 -State Listen).OwningProcess | Select-Object -First 1
$before = (Get-Content $log).Count
$up = Start-Process trom -ArgumentList 'file','upload','C:\bench\big.crt','--to','/tr-kill','--device','TR-2' -PassThru -NoNewWindow
while (-not (Get-Content $log | Select-Object -Skip $before | Select-String 'TransferFilesCommand Started')) { Start-Sleep -Milliseconds 50 }
Start-Sleep -Milliseconds 1500; Stop-Process -Id $enginePid -Force
```

Then `trom device list` (restarts the engine), upload the same file again, and grep the log for
`already exists`: firmware 0.8 left the partial file and the re-upload deleted it first; 0.9 removes it itself.

## Diagnosing a download that stalls or arrives wrong

1. **Repeat it through the engine** with `download-loop.mjs`, at least 10 runs; losses are random.
2. **Read the engine log lines** the loop prints (meanings below). The stall line says how far the body got.
3. **Take the engine out:** stop it and run the USB reader (USB) or `download-probe.mjs` (either link)
   20 times against the same file:
   ```
   scripts\usb-reader\bin\Release\net9.0\UsbReader.exe COM12 /tr-fix-TR-1/big.crt C:\bench\big.crt 20
   ```
   If they lose data at the engine's rate, the loss is below the engine. If they never do, it is the engine.
4. **Read the shape of the loss:**

| What you see | What it means |
|---|---|
| Stall `Read X of Y` with X = Y − 1,534; reader: `missing 1,536`, `ends with Ack: True`, `offset mod 2048 = 0` | The USB block loss below (known issue). The board sent everything and its Ack; 1,536 bytes vanished on the way. The engine retries this once by itself |
| A stall far from the end, no Ack | The board stopped sending: its own 2 s no-progress rule sent Fail and `SendFileData timeout: no progress for 2s`, or the link died |
| Full length, `Checksum Mismatch` | Corrupted bytes. Never seen on this bench |
| No reply at all to the first request after opening a port, or `7f 9b` (Fail) | Seen once from the USB reader right after opening TR-1's port; the next 19 were fine |

## Engine log lines

| Line | Meaning |
|---|---|
| `GetFileCommand Completed in <N>ms (Success)` | A whole download. 8 MB takes ~4.2-4.4 s over USB, ~13.6 s when retried |
| `Read <X> of <Y> bytes, then nothing arrived for 5000 ms` | The body stalled (in the exception dump) |
| `GetFileCommandHandler: The download arrived <N> bytes short: the closing Ack came after <X> of <Y> bytes; asking for <path> once more` | The retry. A second short answer fails the download |
| `DeviceRecovery: Recovery SuspectLink on <link> for <id> ... answered on the existing link in <N> ms; it was only slow` | A timeout the retry did not cover; the command pipeline probed the board and fails the command without re-sending |
| `TransferFilesCommand Started`, `Saving File: <path>`, `TransferFilesCommand Completed in <N>ms` | An upload reaching the board |
| `already exists` | The board already had a file at that path; the API deletes and resends |

## Expected results (firmware 0.9, built Oct 27 11:46:44; bench 2026-10-28)

| Run | Expected |
|---|---|
| 1 MB download, network | ~0.7-0.8 s engine time |
| 1 MB download, USB | ~1.4-1.5 s from the CLI |
| 8 MB download, network | ~6-7 s from the CLI (engine 5.9-6.3 s); the firmware sums the file before sending the checksum, ~3.05 s of that |
| 8 MB download, USB | ~5.0-5.3 s from the CLI; ~14.5 s when the retry fires |
| USB reader, 8 MB | Body ~0.81-0.92 s (~9.5 MB/s). Losses: TR-1 5/19, TR-2 1/20 (before TR-1's reflash) |
| Upload probe `stall` | `versionRepliesFromLeftover: 0`, `nextCommand: 1`, `no file left` |
| Upload probe `window` | `at500ms: 0` (discarded), `at2500ms: 1`, `no file left` |
| Upload probe `checksum` | `reply: Fail`, `no file left` |
| Test 5 | Re-upload saves straight away; download matches |

Firmware 0.8 differed on every upload probe: the stall's leftover bytes ran as commands (hundreds of version
replies), the request at +0.5 s was answered, and every broken upload left a partial file.

## Known issue: USB block loss

Over USB, an 8 MB download now and then loses exactly 1,536 bytes: the first three 512-byte packets of one
of the board's 2,048-byte send buffers, at a body offset that is a multiple of 2,048. The buffer's last
packet and the closing Ack still arrive. The network never lost a byte.

- **Not the engine:** the USB reader (.NET, nothing else running) and a Node reader lose it the same way,
  on both boards. A reader that is slow, or pauses, loses more.
- **Not the firmware's send loop:** a test build that honoured `write()`'s return in `SendFileData` and
  resent what it skipped still lost it (2/20). The loss is past the point the board hands bytes to the
  Teensy USB core: the core, the USB hardware, or the Windows driver. Untested: a Mac or Linux host.
- **Rate varies with board state:** TR-1 lost ~1 in 4 all day, then 0 in 30 after a reflash.
- **Handled in the API:** `GetFileCommandHandler` asks once more when a stalled body ends with the
  closing Ack. Without it, a loss fails the download after the 5 s stall (before the deadlines, it hung).

## Pitfalls

- **PowerShell variables ignore case:** `$file` and `$File` are one variable. A loop that names both
  overwrites its own parameter.
- **Git Bash rewrites `/paths`** passed to Windows programs: prefix with `MSYS_NO_PATHCONV=1`.
- **A slow probe causes the loss it looks for:** copying each chunk into a growing buffer (`Buffer.concat`)
  slowed the first download probe enough to lose blocks. The probes copy into one buffer set aside up front.
- **Only the CLI's `--to` folder is yours;** `trom file download` replaces a same-named file there.
- **8 MB downloads need the checksum wait:** the engine allows 5 s plus 1 s per MB for the checksum; if a
  firmware change makes the sum slower, `ChecksumWaitMs` is the constant to look at.

## Protocol reference

The board sends values low byte first; the host sends upload headers high byte first.

| Command | Token | Exchange |
|---|---|---|
| GetFile | `64 B0` | Ack (`CC 64`); host: storage (SD `01`, USB `00`) + path + NUL; Ack, or Fail (`7F 9B`) + `Error 1-5` text; length (4); checksum (4, low 16 bits of the byte sum); body; Ack |
| PostFile | `64 BB` | Ack; host: length (4), checksum (2), storage (1), path + NUL; Ack; body; Ack, or Fail with text (`Timeout!`, `Rec n of m`) |
| DeleteFile | `64 CF` | Ack; host: storage + path + NUL; Ack (deleted) or Fail + `File not found: <path>` |
| Version | `64 76` | Ack, then the version text (see `device-transport-probe`) |

Firmware: `C:\dev\src\TeensyROM-Fork\Source\Teensy\FileTransfer.ino` (`GetFileCommand`, `SendFileData`,
`CalculateChecksum`) and the Teensy core's `usb_serial.c` (`usb_serial_write`: 4 buffers of 2,048 bytes,
gives up after 120 ms). API: `TeensyRom.Core.Serial/Commands/GetFile/GetFileCommandHandler.cs` (waits,
retry), `SerialCommunicationPort.ReadExactlyAsync` (USB body read), `ICommunicationPort.ReadExactlyAsync`
(network body read), `Commands/Behaviors/CommunicationPortBehavior.cs` (recovery and re-send).
