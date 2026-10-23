# DJ and timed sets

## Finding something

- By description: `trom file search "<text>" --filter music --json`. Use `--filter games` or `--filter all` for other things.
- Browsing: `trom file ls "<dir>" --json`.
- Surprise me: `trom file random --filter music --json` (or `--filter games`). It launches what it picks.

## Launching

`trom file launch "<path>" --json`. The result is `{status, file, message}`: the file's full record is under `file`. Everything you say about the file comes from it.

To launch a file from this computer, copy it over and launch it in one step: `trom file upload --launch "<local file>" --to "<device folder>" --device <name> --json`. It takes exactly one file, not a folder or an archive. Its result has the same shape as `file launch`.

## Stories

After a launch, tell a few nicely formatted lines built from the launch result: `title`, `creator`, `releaseInfo`, `description`, `competitions` placings, `avgRating` / `ratingCount`, `playLength`.

- Add extra facts only when you are certain. Never guess or invent.
- Offer `links` / `youTubeVideos` when the user wants more.
- Search the web only with permission.

## Unknown length

A song `playLength` of exactly `00:03:00` is the engine's default, not a real length. Say "length unknown (3-minute default)". Never present it as the real length.

## Play controls

Each takes `--device <name>` and `--json`.

- Pause or resume the song: `trom file pause --device <name> --json`. Its `action` is `paused`, `resumed`, `stopped`, `relaunched` or `toggled`. `reason` and `file` are absent when there is nothing to say.
- Games and programs can't pause. `file pause` stops them instead, and the next pause launches them again. Tell the user what `action` says happened.
- Stop whatever is running: `trom file stop --device <name> --json`. It resets the TeensyROM.
- Previous and next: `trom file previous --device <name> --json` and `trom file next --device <name> --json`. They move through the folder, search results or shuffle that the last launch came from. Tell the new file's story as under Stories.
- A timed set's tracks are the agent's own list, not that folder. Inside a set, a skip launches the next track; it is not `file next`.

## Curating

- Liked it: `trom file favorite "<path>"`.
- Unfavorite on request: `trom file unfavorite "<path>"`.
- Ban only after confirming: `trom file ban "<path>"`. A ban applies to every TeensyROM, and you can lift it later with `trom file unban` (see `library.md`, Curating).

When stderr carries an `indexIncomplete` notice, gently remind the user and offer the index build.

## Timed sets

Offer timed sets only where the harness can run a background command and wake you when it ends. Otherwise the user drives one track at a time.

1. Ask the set length. Suggest one if the user says "keep it going".
2. Pick tracks to fill it: search with `--full`, or use `playLength` from the compact results.
3. Say roughly when the set ends. Say "approximately" when any track has the 3-minute default.
4. For each track: launch it, tell its story, then run the wait as a **background** command. When it finishes, launch the next.
   - With `file pause` in `init`'s `capabilities`: `trom wait <length> --device <name>`. The countdown holds while that TeensyROM's song is paused through `trom file pause`. Pauses made in the web UI are not seen.
   - Without it: `trom wait <length>`. An older `trom` exits 2 on `--device`, and the timer would be lost. Don't promise that a pause holds the timer.
5. The user can skip, stop or redirect at any time.
6. A stop ends the set: stop the outstanding background `trom wait` (see Only one wait is live), then ask before continuing.
7. At the end, stop and ask before continuing.

### Which length to wait on

Use `subtuneLengths[startSubtuneNum - 1]` when `subtuneLengths` has that entry. The engine's `playLength` is the first subtune's length, which differs when a tune starts elsewhere. Otherwise use `playLength`. Pass it to `trom wait` as written; it accepts the API's `00:03:20.5000000` form.

### Only one wait is live

- Before a skip, stop or redirect launches or stops anything, stop the outstanding background `trom wait`.
- If a wait you have already superseded finishes anyway, ignore it. Do not launch.
- Ending a track early (for example one with the 3-minute default length) is a skip.
