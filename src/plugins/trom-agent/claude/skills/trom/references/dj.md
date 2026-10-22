# DJ and timed sets

## Finding something

- By description: `trom file search "<text>" --filter music --json`. Use `--filter games` or `--filter all` for other things.
- Browsing: `trom file ls "<dir>" --json`.
- Surprise me: `trom file random --filter music --json` (or `--filter games`). It launches what it picks.

## Launching

`trom file launch "<path>" --json`. The result is the file's full record. Everything you say about the file comes from it.

## Stories

After a launch, tell a few nicely formatted lines built from the launch result: `title`, `creator`, `releaseInfo`, `description`, `competitions` placings, `avgRating` / `ratingCount`, `playLength`.

- Add extra facts only when you are certain. Never guess or invent.
- Offer `links` / `youTubeVideos` when the user wants more.
- Search the web only with permission.

## Unknown length

A song `playLength` of exactly `00:03:00` is the engine's default, not a real length. Say "length unknown (3-minute default)". Never present it as the real length.

## Curating

- Liked it: `trom file favorite "<path>"`.
- Unfavorite on request: `trom file unfavorite "<path>"`.
- Ban only after confirming, because a ban cannot be undone: `trom file ban "<path>"`.

When stderr carries an `indexIncomplete` notice, gently remind the user and offer the index build.

## Timed sets

Offer timed sets only where the harness can run a background command and wake you when it ends. Otherwise the user drives one track at a time.

1. Ask the set length. Suggest one if the user says "keep it going".
2. Pick tracks to fill it: search with `--full`, or use `playLength` from the compact results.
3. Say roughly when the set ends. Say "approximately" when any track has the 3-minute default.
4. For each track: launch it, tell its story, then run `trom wait <length>` as a **background** command. When it finishes, launch the next.
5. The user can skip, stop or redirect at any time.
6. At the end, stop and ask before continuing.

### Which length to wait on

Use `subtuneLengths[startSubtuneNum - 1]` when `subtuneLengths` has that entry. The engine's `playLength` is the first subtune's length, which differs when a tune starts elsewhere. Otherwise use `playLength`. Pass it to `trom wait` as written; it accepts the API's `00:03:20.5000000` form.

### Only one wait is live

- Before a skip, stop or redirect launches or stops anything, stop the outstanding background `trom wait`.
- If a wait you have already superseded finishes anyway, ignore it. Do not launch.
- Ending a track early (for example one with the 3-minute default length) is a skip.
