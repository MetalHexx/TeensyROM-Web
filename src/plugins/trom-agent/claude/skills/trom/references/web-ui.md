# The web UI

The web UI is the visual front of the same engine `trom` talks to. Whatever the user does there, `trom` sees, and the other way round.

## Open it

1. When `capabilities` lists `ui`, run `trom ui --json`. It starts Trom API if needed, opens the web UI in the browser and reports `address`, `networkAddresses`, `available`, `opened`, `problem` and `openFailure`. Say `address` in your reply so the user can reuse it.
   - `opened` false with an `openFailure` (no browser on this machine, a remote session): give the user `address` to open themselves. Exit 0.
   - `available` false (exit 1): go to "When it isn't served" below.
2. Without `ui` in `capabilities`: check `init`'s `webUi.available`. When it is false, go to "When it isn't served" below. Otherwise open `webUi.address` with the OS opener (`start` / `open` / `xdg-open`) and say the address in your reply.
3. Offer the tour once: "Want a quick tour of what it can do?" Don't recite it unasked.

## The tour

Give the headline list below, one line each, then ask which one the user wants more on. Dig into one at a time, in a few lines.

- **Play.** Launch games, SIDs, demos and images. Shuffle with file-type filters. Play, pause, next and previous. A custom timer advances games, demos and images on its own, and files the cart can't run are skipped.
- **Search.** One search across the SD and USB storage of every cart. Quotes and plus signs for exact phrases and must-haves, like `Iron +Maiden +"Aces High"`. Filter by games, music, images or demos.
- **Favorites and history.** Star favorites. Every launch is kept in a play history with timestamps, browsable and re-launchable.
- **Browse.** SD and USB side by side with a folder tree, breadcrumbs and back and forward, built for folders with thousands of files.
- **Several carts.** One panel per cart, any mix of Ethernet and USB, all playing in parallel. DJs, this one is yours.
- **Banned list.** Hide files and folders from browse, search and shuffle. Manage it in Settings → Search.
- **CRT and video.** With a video capture device: live video with scanlines, curvature, bloom, phosphor looks and saved presets, in a compact view, a theatre dialog or fullscreen.
- **Phone and audio.** The same UI on a phone over the local network at one of `trom ui`'s `networkAddresses` (`http://<this computer's address>:10213`), with the C64's audio streamed to it. The firewall may ask for permission the first time.

## When it isn't served

`init`'s `problems` names the cause; relay it in plain words. Then classify the install the way "Update" in `references/install.md` does:

- **Release or Homebrew install:** the web UI ships inside the suite, so a missing one means a damaged or partial install. Relay the problem, then offer the reinstall or update from `references/install.md`. Afterwards run `trom engine stop`, then `trom init --json`, and check `webUi.available` again.
- **Source build:** point to https://github.com/MetalHexx/TeensyROM-Suite/blob/main/docs/contributing.md and change nothing.

Still not served: go to `references/doctor.md`, then point to the documentation links in `SKILL.md`.
