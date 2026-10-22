# Setup doctor

Run the five checks in order. For each, report fine, fixed, or what to try. Ask before any fix that changes something.

1. **`trom` is installed.** `trom --version` prints its version. Missing: offer `references/install.md`.
2. **Engine running and matching.** `trom engine status --json`.
   - Not running (`engine status` exits 3): relay the matching entry of `init`'s `problems`. It carries the reason the engine could not start (no engine beside the CLI, a failed source build and its log, the port in use). Then retry with `trom init --json`, which starts the engine.
   - Mismatched versions: the next engine command restarts the engine, so `trom init --json` fixes it.
3. **Device known and online.** `trom device list --json`.
   - Known but offline: offer `trom device reconnect --device <name>`.
   - None known: `trom device discover`.
4. **Device answers.** `trom device ping --device <name>`. No answer: offer `trom device reset --device <name>`.
5. **Storage indexed.** For every storage that is available (`sdAvailable` / `usbAvailable` true), check `sdIndexed` / `usbIndexed`. Offer `trom index build --device <name> --storage <sd|usb>` for each that is not fully indexed. Never offer a storage that is not available.

When the checks run out, say what was checked and point to the documentation links in `SKILL.md`.
