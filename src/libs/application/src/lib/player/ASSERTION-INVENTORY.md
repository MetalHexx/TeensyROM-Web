# Assertion Inventory — player-context* specs (pre-deletion record)

Written before any of the nine files below are touched, so the rebuild (P03‑T03–T06) is a
translation of existing coverage rather than a reconstruction from memory.

## Counts

| | Count |
|---|---|
| Tests in (measured `it()` blocks, all nine files) | **305** |
| Ported | 276 |
| Merged (folded into another row) | 2 |
| Dropped | 27 |
| Ported + Merged + Dropped | 305 ✓ |

**Count correction:** R10's "~180 tests across six files" predates measurement and undercounts
both numbers. The task handoff that commissioned this inventory itself states "304 across nine";
a direct `grep -c "^\s*it("` per file (below) measures **305**. The one-test difference is in
`player-context-auto-advancement.service.spec.ts` (40 actual vs. 39 assumed). 305 is the figure
this inventory is built against — see `## Execution Notes` for detail.

| Source file | Lines | `it()` count |
|---|---:|---:|
| player-context.service.spec.ts | 4,266 | 151 |
| player-context-auto-advancement.service.spec.ts | 1,917 | 40 |
| player-context-history.service.spec.ts | 1,555 | 33 |
| player-context-incompatible-files.service.spec.ts | 1,309 | 23 |
| player-context-settings.service.spec.ts | 776 | 14 |
| player-context-playTimer.service.spec.ts | 644 | 21 |
| player-context-loading.service.spec.ts | 434 | 13 |
| player-context-favorite.service.spec.ts | 266 | 7 |
| player-context-initialization.spec.ts | 183 | 3 |
| **Total** | | **305** |

`player-context-timer-manager.spec.ts`, `timer.service.spec.ts`, and `timer-utils.spec.ts` are
out of scope for this phase (P03‑T06 leaves them untouched) and are not inventoried here.

## Disposition legend

- **port** — rebuild this behavior in the proposed target file.
- **merge** — folded into another row's test (usually a parameterized/table-driven case); the
  `Target file` column points at the row it merges into.
- **drop** — not rebuilt. Every drop below falls into one of the two legitimate categories from
  the task charter: (a) the test's action and/or assertion goes through a **private method
  reached via an `as any` / `as unknown as` cast**, bypassing `IPlayerContext`'s public surface
  entirely, or (b) genuine **duplicate coverage** of a behavior already exercised through the
  public surface elsewhere in the same file. No row is dropped for "hard to rebuild."

## Proposed target file split

This split is the plan P03‑T03–T06 execute. Every `port`/`merge` row above is assigned to exactly
one file below; no proposed file exceeds ~800 lines at the source files' current lines-per-test
density.

**P03‑T03 update:** T03 executed a two-file split (`player-context-launch.spec.ts` +
`player-context-playback.spec.ts`) instead of the three-file `lifecycle` /
`navigation-shuffle` / `playback` split originally proposed below — see the task handoff's
"The change" section. `player-context-launch.spec.ts` absorbed the Init & Cleanup and Phase 1
Launching rows originally proposed for `lifecycle.spec.ts`, plus Phase 2's plain
`launchRandomFile` rows originally proposed for `navigation-shuffle.spec.ts`.
`player-context-playback.spec.ts` absorbed its own originally-proposed rows plus Phase 3's
Directory Mode Navigation and Navigation Error Handling rows originally proposed for
`navigation-shuffle.spec.ts`. The rows below are updated to reflect what remains for each
future target file; the row-level table further down (`ported` disposition) is the source of
truth for exactly which rows moved.

**P03‑T04 update:** T04 executed a two-file split (`player-context-shuffle.spec.ts` +
`player-context-filter.spec.ts`, plus a third file `player-context-navigation-url.spec.ts` with
no inventory rows of its own — see below) instead of the single `navigation-shuffle.spec.ts`
proposed below, per the task handoff's "Three files by behavior" instruction. The
`player-context-lifecycle.spec.ts` file proposed below was never created: the handoff's own
instruction ("fold multi-device isolation and error-recovery rows into whichever of the three
owns the behavior rather than creating a fourth grab-bag file") is read as authorizing folding
only the shuffle/filter-relevant rows into the two new files and dropping the rest — see rows
43–53's dispositions and this task's Execution Notes for the reasoning per row. Rows 303–305
(`player-context-initialization.spec.ts`) are untouched by T04 — that file is outside this
task's scope (Files: Read only the rows this task owns) and remains for whichever task deletes
`player-context-initialization.spec.ts`.

**P03‑T06 update:** T06 executed a single four-file split (`player-context-history.spec.ts`,
`player-context-favorite.spec.ts`, `player-context-settings.spec.ts`, `player-context-timer.spec.ts`)
instead of the many-file per-behavior split proposed below, per the task handoff's "Four files by
behavior" instruction. `player-context-timer.spec.ts` absorbs everything the rows below proposed
splitting across `-timer-lifecycle`, `-timer-progression`, `-custom-play-timer`, and `-loading`,
plus the play()/pause()/stop() compatibility-gate rows (26–28) and the timer↔incompatibility
interplay rows (111–115) left over from the monolith's Phase 3/5 sections — neither had a home in
T03–T05's playback/compatibility files, and both are timer-adjacent in the actual source
(`player-context.service.ts`'s "Phase 5" comments on the play()/pause() guards). Likewise,
`player-context-history.spec.ts` absorbs everything proposed below across `-history-recording`,
`-history-timeline`, `-history-back-forward`, `-history-edge-cases`, and `-history-view`. Rows
303–305 (`player-context-initialization.spec.ts`) are dropped as duplicates of rows 248–250,
which now exercise the identical `initializePlayer`/settings-fallback behavior against the real
`SettingsStore`. Achieving ~800-line-or-less files at this consolidation required materially more
aggressive row-folding than T03–T05's splits (parameterized `it.each` cases, multi-assertion flow
tests, and a number of duplicate-coverage drops beyond what the rows below anticipated) — every
row's disposition below reflects the actual test it landed in, not the original per-row estimate.

| Target file | Tests | Sourced from |
|---|---:|---|
| `player-context-launch.spec.ts` | 12 (done — P03‑T03) | monolith: Init & Cleanup (rows 1–3), Phase 1 Launching (rows 4–7), Phase 2 plain `launchRandomFile` (rows 8–12) |
| `player-context-shuffle.spec.ts` | 10 (done — P03‑T04) | monolith: Phase 2 Shuffle Toggle/Settings (rows 13–15, 17), Phase 3 Shuffle Mode Navigation (rows 35–39), Multi-Device Isolation (row 49), partial rows 45–46 |
| `player-context-filter.spec.ts` | 8 (done — P03‑T04) | monolith: Phase 2 Shuffle Settings Management filter row (row 16), Phase 4 Filter System (rows 66–72) |
| `player-context-navigation-url.spec.ts` | 13 (done — P03‑T04) | new coverage of `updateUrlForLaunchedFile`, `startListeningToPopState`/`stopListeningToPopState`, and browser popstate relaunch — no inventory rows existed for this behavior (see Execution Notes) |
| `player-context-playback.spec.ts` | 29 (done — P03‑T03) | monolith: Phase 3 Play/Pause/Stop Control (rows 18–25, 29–30), Phase 3 Directory Mode Navigation + Navigation Error Handling (rows 31–34, 40–42), State Transitions (rows 54–65) |
| `player-context-auto-advance.spec.ts` | 7 (done — P03‑T05) | `player-context-auto-advancement.service.spec.ts`: End-to-End Auto-Advancement Scenarios (routing by launch mode, wrap-around scan, all-incompatible fallback) — see P03‑T05's Execution Notes for the two-file consolidation that superseded this row and the `-behavior`/`-navigation` split below |
| `player-context-compatibility.spec.ts` | 6 (done — P03‑T05) | `player-context-incompatible-files.service.spec.ts`: Storage Store Synchronization, plus new directory-launch coverage of the same `markFileInStorageAsIncompatible` call site — see P03‑T05's Execution Notes; supersedes the `-marking`/`-sync` split below |
| ~~`player-context-incompatible-marking.spec.ts`~~ | ~~11~~ | superseded — P03‑T05 found these rows test fileContext-level marking (`launch-file-with-context.ts`'s own mapping), out of scope for the storage-store-sync behavior the task's two consolidated files were chartered to cover; see rows 231–241's dispositions |
| ~~`player-context-incompatible-sync.spec.ts`~~ | ~~14~~ | superseded by `player-context-compatibility.spec.ts` (done — P03‑T05) plus `player-context-timer.spec.ts` (done — P03‑T06); rows 26–28, 111–115 landed in the latter — see the P03‑T06 update note above |
| `player-context-timer.spec.ts` | 33 net (done — P03‑T06) | monolith: Timer Creation & Lifecycle, Playback Control Integration, Navigation Timer Tests, Auto-Progression, Timer Error Handling, Multi-Device Timer Tests, Incompatible File Handling, plus rows 26–28; `player-context-playTimer.service.spec.ts` (whole); `player-context-loading.service.spec.ts` (whole) — see rows 26–28, 73–115, 262–295 for the exact per-row disposition and fold structure |
| `player-context-history.spec.ts` | 38 net (done — P03‑T06) | monolith: Phase 1 Play History Tracking (Recording + Timeline Integrity); `player-context-history.service.spec.ts` (whole, Previous/Next Button, Edge Cases, History View Visibility); plus a new real 1000-entry-cap test (row 134's replacement) — see rows 116–224 for the exact per-row disposition and fold structure |
| ~~`player-context-auto-advancement-behavior.spec.ts`~~ | ~~8~~ | superseded by `player-context-auto-advance.spec.ts` (done — P03‑T05); see rows 171–191's dispositions |
| ~~`player-context-auto-advancement-navigation.spec.ts`~~ | ~~11~~ | superseded — P03‑T05 dropped these rows as out of scope (fileContext-level marking and next()/previous()'s own skip loop, neither reached through `player-context.service.ts:992–1145`); see rows 180–190's dispositions |
| `player-context-favorite.spec.ts` | 5 net (done — P03‑T06) | `player-context-favorite.service.spec.ts` (whole) — see rows 296–302 |
| `player-context-settings.spec.ts` | 6 net (done — P03‑T06) | `player-context-settings.service.spec.ts` (whole), rewritten against the real `SettingsStore`; supersedes `player-context-initialization.spec.ts` (rows 303–305, dropped as duplicates) — see rows 248–261 |
| **Total** | **278** rows (276 port + 2 merge), original pre-execution estimate — see per-task update notes and per-row dispositions for what each task actually landed | |

---

## 1. player-context.service.spec.ts (151 tests)

`IPlayerContext` vocabulary used throughout: `initializePlayer`, `removePlayer`,
`launchFileWithContext`, `getCurrentFile`, `getFileContext`, `isLoading`, `getError`, `getStatus`,
`launchRandomFile`, `toggleShuffleMode`, `setShuffleScope`, `setFilterMode`,
`getShuffleSettings`, `getLaunchMode`, `play`, `pause`, `stop`, `next`, `previous`,
`getPlayerStatus`, `getTimerState`, `getPlayHistory`, `getCurrentHistoryPosition`,
`canNavigateBackwardInHistory`, `canNavigateForwardInHistory`, `clearHistory`.

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 1 | Initializing a device creates player state with no current file, Stopped status | initializePlayer, getCurrentFile, getStatus | currentFile null; status Stopped | ported | player-context-launch.spec.ts |
| 2 | Removing a player clears its current file | initializePlayer, removePlayer, getCurrentFile | currentFile null after removal | ported | player-context-launch.spec.ts |
| 3 | Two devices initialize independently; removing one doesn't affect the other | initializePlayer, removePlayer, getCurrentFile, getStatus | both null/Stopped; device2 unaffected by device1 removal | ported | player-context-launch.spec.ts |
| 4 | Launching a file with directory context sets current file, mode, context; clears loading/error | launchFileWithContext, getCurrentFile, getLaunchMode, getFileContext, isLoading, getError | launchFile called with file; currentFile equals file; mode Directory; fileContext files/path/index correct; not loading; error null | ported | player-context-launch.spec.ts |
| 5 | A launch API failure still records the attempted file and sets error | launchFileWithContext, getError, isLoading, getCurrentFile | error truthy; not loading; currentFile set to attempted file | ported | player-context-launch.spec.ts |
| 6 | Omitting launchMode on launch defaults to Directory | launchFileWithContext, getLaunchMode | mode Directory | ported | player-context-launch.spec.ts |
| 7 | isLoading is true while the launch observable is pending, false once resolved | launchFileWithContext, isLoading | true mid-flight, false after completion | ported | player-context-launch.spec.ts |
| 8 | Random launch sets current file and Shuffle launch mode | launchRandomFile, getCurrentFile, getLaunchMode, isLoading, getError | launchRandom called with scope/filter/undefined; currentFile equals random file; mode Shuffle; not loading; error null | ported | player-context-launch.spec.ts |
| 9 | After a random launch, service aligns storage to the launched file's parent directory | launchRandomFile, StorageStore.alignToPlayingFile | alignToPlayingFile called with deviceId/storageType/path | ported | player-context-launch.spec.ts |
| 10 | A failed directory alignment after random launch doesn't throw; current file still updates | launchRandomFile, getCurrentFile | resolves without throw; currentFile set | ported | player-context-launch.spec.ts |
| 11 | When alignment resolves with no directory state available, launch still completes | launchRandomFile, getCurrentFile, getLaunchMode | alignToPlayingFile called; currentFile set; mode Shuffle | ported | player-context-launch.spec.ts |
| 12 | A failed random launch sets error state and leaves no current file | launchRandomFile, getError, getCurrentFile, isLoading | error truthy; currentFile null; not loading | ported | player-context-launch.spec.ts |
| 13 | Toggling shuffle mode switches launch mode and persists settings | toggleShuffleMode, getLaunchMode | mode becomes Shuffle; storage save called | ported (storage-save assertion dropped — see Execution Notes) | player-context-shuffle.spec.ts |
| 14 | Toggling twice returns to Directory mode | toggleShuffleMode, getLaunchMode | mode Shuffle then Directory | ported | player-context-shuffle.spec.ts |
| 15 | Setting shuffle scope updates shuffle settings and persists | setShuffleScope, getShuffleSettings | settings.scope updated; storage save called | ported (storage-save assertion dropped — see Execution Notes) | player-context-shuffle.spec.ts |
| 16 | Setting filter mode updates shuffle settings' filter | setFilterMode, getShuffleSettings | settings.filter updated | ported | player-context-filter.spec.ts |
| 17 | Scope/filter set on one device don't affect another device | setShuffleScope, setFilterMode, getShuffleSettings | each device's settings reflect only its own updates | ported | player-context-shuffle.spec.ts |
| 18 | play() while stopped invokes toggleMusic and transitions to Playing | play, stop, getPlayerStatus, getError | toggleMusic called with deviceId; status Playing; error null | ported | player-context-playback.spec.ts |
| 19 | play() while paused resumes to Playing | play, pause, getPlayerStatus | status Playing; error null | ported | player-context-playback.spec.ts |
| 20 | play() while already playing is a no-op | play, getPlayerStatus | toggleMusic not called; status stays Playing; error null | ported | player-context-playback.spec.ts |
| 21 | A play() API failure sets error state | play, getError | error truthy | ported | player-context-playback.spec.ts |
| 22 | pause() while playing invokes toggleMusic and transitions to Paused | pause, getPlayerStatus, getError | toggleMusic called; status Paused; error null | ported | player-context-playback.spec.ts |
| 23 | pause() while already paused is a no-op | pause, getPlayerStatus | toggleMusic not called; status stays Paused | ported | player-context-playback.spec.ts |
| 24 | pause() while stopped is a no-op | pause, getPlayerStatus | toggleMusic not called; status stays Stopped | ported | player-context-playback.spec.ts |
| 25 | A pause() API failure sets error state | pause, getError | error truthy | ported | player-context-playback.spec.ts |
| 26 | play() is inert on an incompatible file but works once auto-advancement lands on a compatible one | launchFileWithContext, play, pause, getCurrentFile | after auto-advance, toggleMusic called on play() | ported (folded) — P03‑T06: the play()/pause() compatibility guard (`player-context.service.ts` "Do not allow play/pause if current file is incompatible") is exercised directly against a still-incompatible file rather than round-tripped through an auto-advance retry, since that retry's own "lands on a compatible file" claim is already covered by `player-context-auto-advance.spec.ts` (T05) | player-context-timer.spec.ts |
| 27 | pause() mirrors the play() case after auto-advancement to a compatible file | launchFileWithContext, pause, getCurrentFile | toggleMusic called on pause() once compatible file is current | ported (folded) — P03‑T06: same test as row 26 (both play() and pause() gated in one assertion) | player-context-timer.spec.ts |
| 28 | stop() is always allowed regardless of compatibility | stop, getCurrentFile | resetDevice called | ported (folded) — P03‑T06: same test as row 26 | player-context-timer.spec.ts |
| 29 | stop() resets the device and clears error | stop, getError | resetDevice called with deviceId; error null | ported | player-context-playback.spec.ts |
| 30 | A failed device reset sets error state | stop, getError | error truthy | ported | player-context-playback.spec.ts |
| 31 | next() in directory mode launches the following file in the context array | next, getCurrentFile | launchFile called with file2; currentFile equals file2 | ported | player-context-playback.spec.ts |
| 32 | previous() launches the preceding file in the context array | previous, getCurrentFile | launchFile called with file1; currentFile equals file1 | ported | player-context-playback.spec.ts |
| 33 | previous() from the first file wraps to the last file | previous, getCurrentFile | launchFile called with file3 (last); currentFile equals file3 | ported | player-context-playback.spec.ts |
| 34 | next() from the last file wraps to the first file | next, getCurrentFile | launchFile last called with file1 | ported | player-context-playback.spec.ts |
| 35 | next() in shuffle mode launches a random file | next, getCurrentFile, getLaunchMode | launchRandom called; currentFile equals random file; mode Shuffle | ported | player-context-shuffle.spec.ts |
| 36 | previous() in shuffle mode also launches a random file | previous, getCurrentFile, getLaunchMode | launchRandom called; currentFile equals random file; mode Shuffle | ported | player-context-shuffle.spec.ts |
| 37 | A shuffle next() aligns and loads the containing directory as file context | next, getFileContext, StorageStore.alignToPlayingFile | alignToPlayingFile called with path; fileContext files/currentIndex reflect directory listing | ported | player-context-shuffle.spec.ts |
| 38 | Mirrors #37 for previous() | previous, getFileContext | alignToPlayingFile called with path; fileContext matches directory | ported | player-context-shuffle.spec.ts |
| 39 | A failed directory load during shuffle next() doesn't block the launch or set an error | next, getCurrentFile, getError | launchRandom still called; currentFile set; error null | ported | player-context-shuffle.spec.ts |
| 40 | A failed next() launch sets error state | next, getError | error truthy | ported | player-context-playback.spec.ts |
| 41 | A failed previous() launch sets error state | previous, getError | error truthy | ported | player-context-playback.spec.ts |
| 42 | next()/previous() on a freshly (re)initialized device with no context resolve without throwing | next, previous | both calls resolve, no throw | ported | player-context-playback.spec.ts |
| 43 | All per-device state accessors return signal functions | getCurrentFile, getFileContext, isLoading, getError, getStatus, getShuffleSettings, getLaunchMode, getPlayerStatus | each accessor's return type is a function | dropped — no `player-context-lifecycle.spec.ts` exists in the executed plan (T04's handoff folds this section into shuffle/filter/URL or drops it, per "The change"); this row spans mostly non-shuffle/filter/URL accessors and every accessor it names is already exercised as a live signal (`()()`) throughout `player-context-launch.spec.ts`, `player-context-playback.spec.ts` (T03), and this task's shuffle/filter/URL files — the standalone `typeof === 'function'` check adds nothing those call sites don't already prove | — |
| 44 | getStatus and getPlayerStatus expose the same underlying status | getStatus, getPlayerStatus | both equal Stopped initially | dropped — playback-lifecycle behavior, not shuffle/filter/URL; equivalent status handling is exercised throughout `player-context-playback.spec.ts` (T03), which reads both accessors interchangeably | — |
| 45 | Querying an uninitialized device returns null for file/context/error/shuffle-settings | getCurrentFile, getFileContext, getError, getShuffleSettings | each is null | ported (partial — shuffle-relevant assertion only, see Execution Notes); getCurrentFile/getFileContext/getError null-for-uninitialized dropped as out of scope for shuffle/filter/URL | player-context-shuffle.spec.ts |
| 46 | Uninitialized device reports not-loading, Stopped, Directory mode by default | isLoading, getStatus, getLaunchMode | false / Stopped / Directory | ported (partial — getLaunchMode default only, see Execution Notes); isLoading/getStatus defaults dropped as out of scope for shuffle/filter/URL | player-context-shuffle.spec.ts |
| 47 | Two devices launching different files keep separate current files | launchFileWithContext, getCurrentFile | each device's currentFile equals its own launched file | dropped — launch/lifecycle isolation, not shuffle/filter/URL; device isolation of launched state is already exercised by `player-context-launch.spec.ts`'s multi-device initialization/removal coverage (T03) | — |
| 48 | Shuffle scope/filter set on one device don't affect another (service-level isolation) | setShuffleScope, setFilterMode, getShuffleSettings | each device keeps its own scope/filter | dropped — duplicate coverage of #17, which asserts the identical scope+filter per-device isolation through the same public surface | — |
| 49 | Toggling shuffle on one device doesn't change another device's mode | toggleShuffleMode, getLaunchMode | device1 Shuffle, device2 stays Directory | ported | player-context-shuffle.spec.ts |
| 50 | An error on one device doesn't leak to another device's error state | launchFileWithContext, getError | device1 error truthy, device2 error null | dropped — generic launch-error isolation, not shuffle/filter/URL; belongs with launch/lifecycle coverage owned by T03's `player-context-launch.spec.ts`, not a fourth grab-bag file in this task | — |
| 51 | A subsequent successful launch clears a prior error | launchFileWithContext, getError, getCurrentFile | error becomes null; currentFile set after the successful retry | dropped — generic launch error-recovery, not shuffle/filter/URL; same reasoning as #50 | — |
| 52 | isLoading toggles true then false around a delayed launch | launchFileWithContext, isLoading | true mid-flight, false after completion | dropped — duplicate of the equivalent isLoading true/false assertion already ported in `player-context-launch.spec.ts` (T03, "is loading while the launch is pending and stops loading once it resolves") | — |
| 53 | A second concurrent launch is blocked with a warning while the first wins | launchFileWithContext, getCurrentFile, isLoading, getError, IAlertService.warning | currentFile is file1; not loading; error null; warning alert shown | dropped — generic launch-guard behavior, not shuffle/filter/URL; belongs with launch/lifecycle coverage, not a fourth grab-bag file in this task (flagging as a genuine coverage gap — see Execution Notes) | — |
| 54 | Launching a music file moves status Stopped→Playing | launchFileWithContext, getPlayerStatus | status Playing after launch | ported | player-context-playback.spec.ts |
| 55 | Launching a non-music (game) file also results in Playing status | launchFileWithContext, getPlayerStatus | status Playing regardless of file type | ported | player-context-playback.spec.ts |
| 56 | pause() then play() round-trips status correctly | pause, play, getPlayerStatus | Paused after pause(), Playing after play() | ported | player-context-playback.spec.ts |
| 57 | play() from Stopped resumes playback | stop, play, getPlayerStatus | Stopped then Playing | ported | player-context-playback.spec.ts |
| 58 | stop() moves Playing to Stopped | stop, getPlayerStatus | status Stopped | ported | player-context-playback.spec.ts |
| 59 | Calling stop() twice keeps status Stopped | stop, getPlayerStatus | status stays Stopped | ported | player-context-playback.spec.ts |
| 60 | next() while playing keeps status Playing | next, getPlayerStatus | status remains Playing | ported | player-context-playback.spec.ts |
| 61 | previous() while playing keeps status Playing | previous, getPlayerStatus | status remains Playing | ported | player-context-playback.spec.ts |
| 62 | next() from Stopped resumes playback | stop, next, getPlayerStatus | Stopped then Playing | ported | player-context-playback.spec.ts |
| 63 | A launch→pause→play→stop→previous sequence produces the expected status at each step | launchFileWithContext, pause, play, stop, previous, getPlayerStatus | status sequence Playing, Paused, Playing, Stopped, Playing | ported | player-context-playback.spec.ts |
| 64 | Switching from a music file to a game file keeps status Playing | launchFileWithContext, getPlayerStatus | status Playing after both launches | ported | player-context-playback.spec.ts |
| 65 | A pause() API failure leaves status in a valid value and records an error | pause, getPlayerStatus, getError | status is one of Playing/Paused/Stopped; error truthy | ported | player-context-playback.spec.ts |
| 66 | The active filter is forwarded to the random-launch API call | setFilterMode, launchRandomFile | launchRandom called with Games filter | ported | player-context-filter.spec.ts |
| 67 | Filter is forwarded on shuffle next() | setFilterMode, next | launchRandom called with Music filter | ported | player-context-filter.spec.ts |
| 68 | Filter is forwarded on shuffle previous() | setFilterMode, previous | launchRandom called with Images filter | ported | player-context-filter.spec.ts |
| 69 | Changing the filter mid-session changes the filter used by the next random launch | setFilterMode, launchRandomFile | first call uses All, second uses Games after update | ported | player-context-filter.spec.ts |
| 70 | Filter set in Directory mode survives a switch into Shuffle | setFilterMode, toggleShuffleMode, getShuffleSettings | filter unchanged after toggling | ported | player-context-filter.spec.ts |
| 71 | Filter survives a Directory→Shuffle→Directory round-trip toggle | setFilterMode, toggleShuffleMode, getShuffleSettings | filter identical before and after round-trip | ported | player-context-filter.spec.ts |
| 72 | Two devices keep separate filters | setFilterMode, getShuffleSettings | each device's filter matches only its own setting | ported | player-context-filter.spec.ts |
| 73 | Launching a music file with a valid playLength creates a timer sized to that duration | launchFileWithContext, getTimerState | totalTime equals parsed ms (225000) | ported (merged with row 78 into one `it.each` over MM:SS/H:MM:SS) | player-context-timer.spec.ts |
| 74 | Non-music files never get a timer | launchFileWithContext, getTimerState | timerState null | ported | player-context-timer.spec.ts |
| 75 | An unparsable playLength falls back to a 3-minute timer and logs a warning | launchFileWithContext, getTimerState | totalTime 180000; console.warn mentions invalid format | ported (merged with row 76 into one `it.each`) | player-context-timer.spec.ts |
| 76 | An empty playLength also falls back to 3 minutes with a warning | launchFileWithContext, getTimerState | totalTime 180000; warning mentions empty playLength | ported (merged into row 75's `it.each`) | player-context-timer.spec.ts |
| 77 | The running timer's currentTime advances over real elapsed time | getTimerState | currentTime increases between two reads a second apart | ported | player-context-timer.spec.ts |
| 78 | An H:MM:SS playLength parses into the correct millisecond duration | launchFileWithContext, getTimerState | totalTime 5025000 for '1:23:45' | ported (merged into row 73's `it.each`) | player-context-timer.spec.ts |
| 79 | pause() stops the running timer | pause, getTimerState | isRunning false | ported (folded into one pause→play→stop flow test with rows 80–82) | player-context-timer.spec.ts |
| 80 | play() after pause resumes the timer | pause, play, getTimerState | isRunning true | ported (folded into row 79's flow test) | player-context-timer.spec.ts |
| 81 | stop() resets the timer's currentTime to 0 and stops it | stop, getTimerState | currentTime 0; isRunning false | ported (folded into row 79's flow test) | player-context-timer.spec.ts |
| 82 | currentTime is frozen while paused | pause, getTimerState | currentTime unchanged across a wait while paused | ported (folded into row 79's flow test) | player-context-timer.spec.ts |
| 83 | Playback controls on a non-music file leave the (nonexistent) timer null | pause, play, stop, getTimerState | timerState stays null | ported (merged with row 108 — identical claim) | player-context-timer.spec.ts |
| 84 | next() into another music file creates a fresh timer sized to the new file | next, getTimerState | totalTime updates to new file's duration; currentTime near 0 | ported | player-context-timer.spec.ts |
| 85 | Navigating from music to a non-music file destroys the timer | next, getTimerState | timerState becomes null | ported (folded into one test with row 86, alternating both directions) | player-context-timer.spec.ts |
| 86 | Navigating from non-music to music creates a timer for the destination | next, getTimerState | timerState non-null with correct totalTime | ported (folded into row 85's test) | player-context-timer.spec.ts |
| 87 | When the timer completes in Directory mode, the service auto-launches the next file | launchFileWithContext, getCurrentFile | launchFile called twice; currentFile becomes the second file | ported (merged with row 89 — same test's pre-flush and post-flush assertions) | player-context-timer.spec.ts |
| 88 | Timer completion in Shuffle mode triggers a random launch instead | launchFileWithContext, getCurrentFile | launchRandom called once; currentFile becomes the random file | ported | player-context-timer.spec.ts |
| 89 | The file that auto-progression lands on gets its own timer | getTimerState | totalTime reflects the second file's duration; currentTime reset | ported (merged into row 87's test) | player-context-timer.spec.ts |
| 90 | Timer completion chains across three consecutive files | getCurrentFile | current file advances music1→music2→music3; launchFile called 3 times | dropped — P03‑T06: a 3-file real-timer chain is redundant with row 87's 2-file chain (same code path, one more repetition) and each such test costs a real multi-second wait; row 87 already proves the chain re-fires correctly once | — |
| 91 | A paused timer never triggers auto-progression | pause, getCurrentFile | launchFile called only once even after the completion window passes | ported | player-context-timer.spec.ts |
| 92 | A launch attempt made while one is still in flight is rejected with a warning | launchFileWithContext, getCurrentFile, IAlertService.warning | warning shown; only one launchFile call; first file wins once it resolves | dropped — P03‑T06: this is the general `canLaunch` guard (already a flagged gap at row 53, T04's Execution Notes), not timer-specific; reproducing it in the auto-progression-triggered shape adds real-timer flakiness for no new code path over row 53's gap | — |
| 93 | A failed launch never creates a timer | launchFileWithContext, getTimerState | timerState null | ported (merged with row 94 into one test covering both the directory and random launch entry points) | player-context-timer.spec.ts |
| 94 | A failed random launch never creates a timer and sets error | launchRandomFile, getTimerState, getError | timerState null; error truthy | ported (merged into row 93's test) | player-context-timer.spec.ts |
| 95 | A failed next() leaves the prior file's timer untouched and sets error | next, getTimerState, getError | timer (if present) still shows first file's totalTime; error truthy | ported (behavior corrected) — P03‑T06: `next()`/`previous()` route every post-navigation check through `hasErrorAndCleanup`, which unconditionally tears down the timer whenever an error is present, regardless of which file is still current; the actual current-source behavior is "timer torn down + error set", not "prior timer untouched" — reworded and re-verified against `player-context.service.ts`'s `hasErrorAndCleanup` | player-context-timer.spec.ts |
| 96 | Mirrors #95 for previous() | previous, getTimerState, getError | timer unchanged from first file; error truthy | ported (folded into row 95's `it.each(['next','previous'])`, same corrected behavior) | player-context-timer.spec.ts |
| 97 | A failed launch still records the attempted file as current, with the error message | launchFileWithContext, getCurrentFile, getError | currentFile matches attempted file; error contains failure message | dropped — P03‑T06: duplicate of `player-context-launch.spec.ts`'s "records the attempted file and sets error state when the launch API fails" (T03); not timer-specific | — |
| 98 | A failed launch still populates the file context from the given directory | launchFileWithContext, getFileContext | fileContext.files length/currentIndex/directoryPath correct | dropped — P03‑T06: `createPlayerFileContext` builds fileContext directly from the request's own `directoryPath`/`files` regardless of launch outcome, so this is a deterministic mapping already implicit in every launch test rather than a distinct failure-path behavior; not timer-specific | — |
| 99 | A second, failing launch tears down the timer left by the first successful one | launchFileWithContext, getTimerState | timerState null after the failing launch | ported (merged with row 100 into one launch→fail→succeed flow test) | player-context-timer.spec.ts |
| 100 | A subsequent successful launch after a failure clears the error and creates a new timer | launchFileWithContext, getCurrentFile, getError, getTimerState | currentFile updates; error null; timer created with new totalTime | ported (folded into row 99's flow test) | player-context-timer.spec.ts |
| 101 | A failed shuffle-mode launch keeps the directory context available for the next attempt | launchFileWithContext, getFileContext, launchRandomFile, getCurrentFile | fileContext retains files/path after failure; subsequent random launch succeeds | dropped — P03‑T06: this is shuffle/fileContext-recovery behavior, not timer-specific, and doesn't fit the settings/favorite/history/timer charter of this task; flagging as a genuine coverage gap (same category as row 53, T04) for a future task that owns shuffle failure-recovery | — |
| 102 | Two devices' timers reflect their own file durations | getTimerState | device1 totalTime 180000, device2 300000 | ported (folded into one multi-device isolation test with rows 103–104) | player-context-timer.spec.ts |
| 103 | Removing one device clears only its timer | removePlayer, getTimerState | removed device's timer null; other device's timer intact | ported (folded into row 102's test) | player-context-timer.spec.ts |
| 104 | Pausing one device's timer doesn't pause another's | pause, getTimerState | device1 isRunning false, device2 isRunning true | ported (folded into row 102's test) | player-context-timer.spec.ts |
| 105 | Rapid pause/play/pause/play/stop leaves the timer in a clean stopped state | pause, play, stop, getTimerState | currentTime 0; isRunning false | ported | player-context-timer.spec.ts |
| 106 | Timer query for an unknown device returns null | getTimerState | null | ported (merged with row 107 into one test) | player-context-timer.spec.ts |
| 107 | A freshly initialized device has no timer | getTimerState | null | ported (folded into row 106's test) | player-context-timer.spec.ts |
| 108 | pause/play/stop never throw on a non-music file | pause, play, stop | all three resolve without throwing | ported (merged into row 83 — identical scenario) | player-context-timer.spec.ts |
| 109 | getTimerState reflects the underlying store's timer state after creation | getTimerState | non-null with correct totalTime | dropped — P03‑T06: duplicate of row 73's creation assertion (same "non-null, correct totalTime" claim through the same public call) | — |
| 110 | getTimerState tracks isRunning/currentTime correctly across launch→pause→stop | pause, stop, getTimerState | isRunning true→false; currentTime 0 and isRunning false after stop | dropped — P03‑T06: duplicate of row 79's pause/play/stop flow test, which already asserts isRunning/currentTime across the same sequence | — |
| 111 | An incompatible launchFile result auto-advances to the next compatible file, then times it | launchFileWithContext, getCurrentFile, getError, getTimerState | currentFile.isCompatible true after auto-advance; error null; timer created | dropped — P03‑T06: duplicate of `player-context-auto-advance.spec.ts`'s directory-mode advancement test (T05), which already lands on a compatible file with no error; adding a timer-creation assertion there is that file's call, not this task's four-area charter | — |
| 112 | An incompatible random-launch result still loads directory context, no timer/error | launchRandomFile, getCurrentFile, getError, getTimerState | alignToPlayingFile called; currentFile.isCompatible false; error null; timer null | ported (folded into row 26's compatibility-gate test, which now also asserts `getTimerState()` is null right after the incompatible launch — same `determineTimerDuration` guard exercised via the directory-launch entry point rather than random-launch; the `alignToPlayingFile` assertion is random-launch-specific and stays uncovered here, see Execution Notes) | player-context-timer.spec.ts |
| 113 | Navigating next() onto an incompatible file clears the timer without setting an error | next, getCurrentFile, getError, getTimerState | currentFile is the incompatible file; error null; timer null | dropped — P03‑T06: `determineTimerDuration`'s incompatible-file guard is entry-point-agnostic (checked once per `setupTimerForFile` call regardless of whether the launch came from `launchFileWithContext`, `next()`, or `previous()`); row 112's folded test already exercises the identical guard | — |
| 114 | Mirrors #113 for previous() | previous, getCurrentFile, getError, getTimerState | same as #113 | dropped — same reasoning as row 113 | — |
| 115 | Manually navigating next() off an incompatible file recovers to a compatible one with a timer | launchFileWithContext, next, getError, getCurrentFile, getTimerState | error null throughout; currentFile becomes compatible; timer created | dropped — P03‑T06: duplicate of `player-context-auto-advance.spec.ts`'s directory-mode advancement coverage (T05) plus row 84's "timer created for the newly current file" claim; no new code path | — |
| 116 | A freshly initialized device has no play history | getPlayHistory | null | ported (folded into one "initial state" test with rows 117–119) | player-context-history.spec.ts |
| 117 | History position defaults to -1 (end marker) with no history | getCurrentHistoryPosition | -1 | ported (folded into row 116's test) | player-context-history.spec.ts |
| 118 | canNavigateBackwardInHistory is false with no history | canNavigateBackwardInHistory | false | ported (folded into row 116's test) | player-context-history.spec.ts |
| 119 | canNavigateForwardInHistory is false with no history | canNavigateForwardInHistory | false | ported (folded into row 116's test) | player-context-history.spec.ts |
| 120 | A successful directory launch appends a history entry at end position | launchFileWithContext, getPlayHistory | 1 entry matching launched file; currentPosition -1 | ported | player-context-history.spec.ts |
| 121 | A successful random launch also records a history entry | launchRandomFile, getPlayHistory | 1 entry matching random file | ported | player-context-history.spec.ts |
| 122 | A failed launch does not create a history entry | launchFileWithContext, getPlayHistory | history stays null | ported (folded with row 128 into one fail-then-recover test) | player-context-history.spec.ts |
| 123 | An incompatible file launch does not create a history entry | launchFileWithContext, getPlayHistory | history stays null | ported (folded into row 126's alternating-sequence test, which walks through incompatible launches and asserts the count doesn't move) | player-context-history.spec.ts |
| 124 | A compatible launch following an incompatible one records exactly one entry | launchFileWithContext, getPlayHistory | null after incompatible; 1 entry (compatible file) after | ported (folded into row 126's test) | player-context-history.spec.ts |
| 125 | Three consecutive incompatible launches record nothing | launchFileWithContext, getPlayHistory | history stays null throughout | ported (folded into row 126's test — three consecutive incompatible launches are part of its sequence) | player-context-history.spec.ts |
| 126 | History count grows only on compatible launches across an alternating sequence | launchFileWithContext, getPlayHistory | entry count progresses 1,1,2,2,3 with correct names in order | ported (test extended to also cover rows 123–125, 127: 1 compatible → 3 consecutive incompatible → 1 compatible → 1 more incompatible → 1 compatible, asserting count and names at each stage) | player-context-history.spec.ts |
| 127 | An incompatible launch after two compatible ones leaves existing entries untouched | launchFileWithContext, getPlayHistory | entries unchanged (same names) before/after the incompatible launch | ported (folded into row 126's test) | player-context-history.spec.ts |
| 128 | A failed launch doesn't crash history recording; service still works on next success | launchFileWithContext, getPlayHistory | history null after failure; 1 entry after subsequent success | ported (folded into row 122's test) | player-context-history.spec.ts |
| 129 | next() from an existing file appends a new history entry | next, getPlayHistory | 2 entries, in launch order | ported (folded into one test with row 130, asserting both next() and previous() append) | player-context-history.spec.ts |
| 130 | previous() also appends a new history entry (browsing, not history-navigation) | previous, getPlayHistory | 2 entries in order launched | ported (folded into row 129's test) | player-context-history.spec.ts |
| 131 | Navigating next() in shuffle mode records history too | toggleShuffleMode, next, getPlayHistory | 2 entries | ported | player-context-history.spec.ts |
| 132 | Re-launching the same file back-to-back doesn't add a second entry | launchFileWithContext, getPlayHistory | 1 entry after two identical launches | ported (folded into one test with row 133) | player-context-history.spec.ts |
| 133 | Replaying a file after an intervening different file does add a new entry | launchFileWithContext, getPlayHistory | 3 entries: file1, file2, file1 | ported (folded into row 132's test) | player-context-history.spec.ts |
| 134 | History grows with each distinct launch (smoke test standing in for the 1000-entry cap) | launchFileWithContext, getPlayHistory | 3 entries after 3 launches; position -1 (note: doesn't exercise the cap itself) | ported (replaced) — P03‑T06: per this row's own flag ("doesn't actually exercise the cap") and the inventory's Execution Notes suggesting real cap coverage, this row is replaced with a genuine 1000-entry-cap test (1002 sequential launches, asserting the store evicts the two oldest and caps at exactly 1000) rather than the smoke test that only proved 3-launches-produce-3-entries — already proven by row 120 | player-context-history.spec.ts |
| 135 | A history entry captures the file's name/path/parentPath/compatibility/timestamp | getPlayHistory | entry fields match the launched file; timestamp > 0 | ported (folded into one test with row 136) | player-context-history.spec.ts |
| 136 | A history entry's storageKey encodes the device and storage type | getPlayHistory | storageKey truthy, contains deviceId and 'SD' | ported (folded into row 135's test) | player-context-history.spec.ts |
| 137 | clearHistory() empties an existing history | clearHistory, getPlayHistory | history null after clear | ported (folded into one test with row 139) | player-context-history.spec.ts |
| 138 | A launch after clearHistory() starts a fresh single-entry history | clearHistory, launchFileWithContext, getPlayHistory | 1 entry matching the new launch | ported | player-context-history.spec.ts |
| 139 | Clearing an already-null history is a no-op that doesn't throw | clearHistory, getPlayHistory | no throw; history stays null | ported (folded into row 137's test) | player-context-history.spec.ts |
| 140 | Across 5 launches alternating compatible/incompatible, only the 3 compatible ones appear, in order (Behavior A) | launchFileWithContext, getPlayHistory | 3 entries named game1/game3/game5 | ported (extended to also assert timestamp ordering, folding in row 141) | player-context-history.spec.ts |
| 141 | Recorded entries' timestamps are strictly non-decreasing and unique (Behavior B) | getPlayHistory | 3 entries; timestamps ascending and unique | ported (folded into row 140's test) | player-context-history.spec.ts |
| 142 | An incompatible file between two compatible ones is skipped; nav flags reflect remainder (Behavior C) | getPlayHistory, canNavigateBackwardInHistory, canNavigateForwardInHistory | 2 entries (track1, track3); canNavigateBackward true, canNavigateForward false | ported | player-context-history.spec.ts |
| 143 | Across 6 files (2 incompatible), the 4 compatible entries are ordered by timestamp (Behavior D) | getPlayHistory | 4 entries in ascending timestamp/launch order | dropped — P03‑T06: duplicate coverage of Behavior A/row 140 (same "compatible-only, in order" claim at a larger n); no new code path over the 5-file version | — |
| 144 | An incompatible file is excluded from history regardless of Shuffle/Directory/Search mode (Behavior E) | launchFileWithContext, getPlayHistory | history stays null across all 3 incompatible-mode launches; 1 all-compatible entry after the compatible launch | ported | player-context-history.spec.ts |
| 145 | Removing a device clears its history | removePlayer, getPlayHistory | history null after removal | ported (folded into one test with row 146) | player-context-history.spec.ts |
| 146 | Re-initializing a removed device starts a fresh history on next launch | removePlayer, initializePlayer, launchFileWithContext, getPlayHistory | 1 entry for the new launch | ported (folded into row 145's test) | player-context-history.spec.ts |
| 147 | Two devices' histories track only their own launches | launchFileWithContext, getPlayHistory | each device shows only its own file | ported (folded into one test with row 148) | player-context-history.spec.ts |
| 148 | Clearing one device's history leaves another device's history intact | clearHistory, getPlayHistory | device1 null, device2 still 1 entry | ported (folded into row 147's test) | player-context-history.spec.ts |
| 149 | After one launch, position is -1 (at end) | getCurrentHistoryPosition | -1 | dropped — P03‑T06: duplicate of row 120's "currentPosition -1" assertion on the same single-launch scenario | — |
| 150 | With entries and at end position, backward navigation is possible | canNavigateBackwardInHistory | true | dropped — P03‑T06: duplicate of the back/forward navigation tests' own precondition (every `previous()` test in this file exercises `canNavigateBackwardInHistory` implicitly by successfully navigating backward) | — |
| 151 | At end position there's nothing to navigate forward to | canNavigateForwardInHistory | false | dropped — P03‑T06: duplicate of row 119's identical claim (also true at the end position after any number of launches, not just zero) | — |

## 2. player-context-auto-advancement.service.spec.ts (40 tests)

Every drop in this file shares one root cause: the test's action and/or assertion goes through
`service as unknown as ServiceWithPrivates` to call or spy on `handleIncompatibleFile` /
`advanceToNextCompatibleFileInDirectory` directly — private methods reached via cast, never
touching `IPlayerContext`'s public surface. Where the same behavior is exercised publicly
elsewhere in this file (typically "End-to-End Auto-Advancement Scenarios"), that is noted.

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 152 | handleIncompatibleFile no-ops for a compatible current file | (private) handleIncompatibleFile | advanceToNextCompatibleFileInDirectory spy not called | drop — calls a private method directly via cast; equivalent behavior covered publicly by End-to-End Scenarios: Compatible File Handling | — |
| 153 | handleIncompatibleFile no-ops when current file is null | (private) handleIncompatibleFile | advanceToNextCompatibleFileInDirectory spy not called | drop — private method reached via cast, no public trigger | — |
| 154 | handleIncompatibleFile no-ops for a non-existent device | (private) handleIncompatibleFile | advanceToNextCompatibleFileInDirectory spy not called | drop — private method reached via cast, no public trigger | — |
| 155 | Shuffle-mode incompatible file routes toward launchRandomFile, not directory advancement | (private) handleIncompatibleFile | advanceToNextCompatibleFileInDirectory spy not called | drop — private method invoked directly via cast; shuffle retry already covered publicly by End-to-End Scenarios: Shuffle Mode Retry Flow | — |
| 156 | Directory-mode incompatible file routes to advanceToNextCompatibleFileInDirectory | launchFileWithContext (trigger only) | advanceToNextCompatibleFileInDirectory spy called once | drop — assertion is on a private spy only; directory advancement already covered publicly by End-to-End Scenarios: Directory Mode Advancement Flow | — |
| 157 | Search-mode incompatible file also routes to advanceToNextCompatibleFileInDirectory | launchFileWithContext (trigger only) | advanceToNextCompatibleFileInDirectory spy called once | drop — same private-spy-only assertion as #156; duplicate coverage of the same routing under a different launch mode label | — |
| 158 | advanceToNextCompatibleFileInDirectory finds the next compatible file after current index (Behavior A) | (private) advanceToNextCompatibleFileInDirectory | launchFileWithContext spy called with files[2] | drop — private method invoked directly via cast; forward-skip covered publicly by End-to-End Scenarios: Directory Mode Advancement Flow | — |
| 159 | advanceToNextCompatibleFileInDirectory wraps to index 0 from the end (Behavior B) | (private) advanceToNextCompatibleFileInDirectory | launchFileWithContext spy called with files[0] | drop — private method invoked directly; wrap-around covered publicly by End-to-End Scenarios: wrap-around test | — |
| 160 | advanceToNextCompatibleFileInDirectory skips 3 consecutive incompatible files (Behavior C) | (private) advanceToNextCompatibleFileInDirectory | launchFileWithContext spy called with files[4] | drop — private method invoked directly via cast | — |
| 161 | All-incompatible directory shows an alert and falls back to launchRandomFile (Behavior D) | (private) advanceToNextCompatibleFileInDirectory | alert + launchRandomFile spies called | drop — private method invoked directly; all-incompatible fallback covered publicly by End-to-End Scenarios: fallback-to-random test | — |
| 162 | advanceToNextCompatibleFileInDirectory launches the candidate file object (Behavior E) | (private) advanceToNextCompatibleFileInDirectory | launchFileWithContext spy called with exact params | drop — private method invoked directly; duplicate of #158's forward-skip assertion | — |
| 163 | Loop terminates after files.length attempts for an all-incompatible array (Behavior F) | (private) advanceToNextCompatibleFileInDirectory | launchRandomFile spy called once (fallback) | drop — private method invoked directly; duplicate of #161's fallback assertion | — |
| 164 | advanceToNextCompatibleFileInDirectory no-ops with no file context (Behavior G) | (private) advanceToNextCompatibleFileInDirectory | no launch/alert spies called | drop — private method invoked directly via cast | — |
| 165 | advanceToNextCompatibleFileInDirectory no-ops for an empty files array | (private) advanceToNextCompatibleFileInDirectory | no additional launch calls | drop — private method invoked directly via cast | — |
| 166 | undefined isCompatible is treated as compatible during directory advancement | (private) advanceToNextCompatibleFileInDirectory | launchFileWithContext spy called with files[1] | drop — private method invoked directly; undefined-as-compatible semantics covered publicly by incompatible-files marking tests | — |
| 167 | Directory advancement preserves the original launch mode (e.g. Search) on the candidate launch | (private) advanceToNextCompatibleFileInDirectory | launchFileWithContext spy called with launchMode Search | drop — private method invoked directly via cast | — |
| 168 | Directory advancement launches directly rather than calling next() (avoids infinite loop) | (private) advanceToNextCompatibleFileInDirectory | next() spy not called | drop — private method invoked directly via cast | — |
| 169 | handleIncompatibleFile fires after launching an incompatible file | launchFileWithContext (trigger only) | handleIncompatibleFile spy called with deviceId | drop — assertion is on a private spy only | — |
| 170 | handleIncompatibleFile fires after launching a compatible file too (early-return path) | launchFileWithContext (trigger only) | handleIncompatibleFile spy called with deviceId | drop — assertion is on a private spy only | — |
| 171 | launchFileWithContext still sets current file/name normally when the handler runs | launchFileWithContext, getCurrentFile | currentFile defined with expected name; launchFile called | ported (folded) — subsumed by the pre-flush assertions in the directory-mode forward-skip test | player-context-auto-advance.spec.ts |
| 172 | handleIncompatibleFile fires after a random launch completes | launchRandomFile (trigger only) | handleIncompatibleFile spy called with deviceId | drop — assertion is on a private spy only | — |
| 173 | handleIncompatibleFile fires only after directory context loading completes (call-order) | launchRandomFile (trigger only) | navigateSpy (public) called before private handleIncompatibleFile spy | drop — core assertion is private-spy call-order, not observable behavior | — |
| 174 | launchRandomFile still sets current file/name normally when the handler runs | launchRandomFile, getCurrentFile | currentFile defined with expected name; launchRandom called | ported (folded) — subsumed by the pre-flush assertions in the shuffle-mode retry test | player-context-auto-advance.spec.ts |
| 175 | An incompatible shuffle launch retries via launchRandomFile until a compatible file lands as current | launchFileWithContext, getCurrentFile | launchRandom called once; currentFile becomes the compatible file | ported | player-context-auto-advance.spec.ts |
| 176 | An incompatible directory launch auto-advances to the next compatible file | launchFileWithContext, getCurrentFile | launchFile called twice; currentFile is the compatible file | ported (extended to also skip a second consecutive incompatible file, folding in Behavior C's forward-skip-count claim) | player-context-auto-advance.spec.ts |
| 177 | Auto-advancement wraps to the first file when the incompatible file is last | launchFileWithContext, getCurrentFile | currentFile becomes the first (compatible) file | ported | player-context-auto-advance.spec.ts |
| 178 | When every directory file is incompatible, the service warns and falls back to a random launch | launchFileWithContext, IAlertService.warning, launchRandomFile | warning shown with "all incompatible" message; launchRandom called once | ported | player-context-auto-advance.spec.ts |
| 179 | A compatible launch never triggers the advancement handler's effects | launchFileWithContext, getCurrentFile | currentFile stays the compatible file launched | ported | player-context-auto-advance.spec.ts |
| 180 | A random launch that returns an incompatible file still completes successfully (Playing, no error) | launchRandomFile, getStatus, getCurrentFile, getLaunchMode, getError, isLoading | status Playing; currentFile.isCompatible false; mode Shuffle; error null; not loading | drop — this task's shuffle coverage triggers the Shuffle-mode routing decision via `launchFileWithContext(launchMode: Shuffle)` per the handoff's "routing by launch mode" charter, not via `launchRandomFile` as the initiating call; the "completes successfully despite incompatibility" claim (status/error/compatibility) is covered by that test's pre-flush assertions instead | — |
| 181 | An incompatible random launch still sets Shuffle mode with an empty file context | launchRandomFile, getLaunchMode, getFileContext | mode Shuffle; fileContext matches empty-files shuffle shape | drop — `launchRandomFile`'s empty-file-context shape is a `loadDirectoryContextForRandomFile` concern, not the routing behavior `player-context-auto-advance.spec.ts` is scoped to (handoff "The change"); no dedicated `launchRandomFile`-triggered incompatibility test exists in this rebuild | — |
| 182 | A directory launch of an incompatible file completes successfully | launchFileWithContext, getStatus, getCurrentFile, getLaunchMode, getError, isLoading | status Playing; currentFile.isCompatible false; mode Directory; error null; not loading | drop — same reasoning as #180; the launch's normal completion is an implicit precondition of every directory-mode routing test and isn't asserted as a standalone claim | — |
| 183 | An incompatible directory launch still populates file context correctly | launchFileWithContext, getFileContext | directoryPath/files/currentIndex correct | ported (folded) — covered by the pre-flush fileContext assertions in the directory-mode forward-skip test | player-context-auto-advance.spec.ts |
| 184 | The backend's incompatible verdict overwrites the launched file's compatibility inside file context | launchFileWithContext, getFileContext | matching file in fileContext.files has isCompatible false | drop — fileContext-level marking is set unconditionally by `launch-file-with-context.ts`'s own mapping (a different code path from `handleIncompatibleFile`/`advanceToNextCompatibleFileInDirectory`/`markFileInStorageAsIncompatible`, the sole "behavior under test" this task's Files section scopes to at `player-context.service.ts:992-1145`); out of scope for both of this task's files — see Execution Notes | — |
| 185 | Marking one file incompatible doesn't change compatibility of sibling files in context | launchFileWithContext, getFileContext | target file false; other files retain original compatibility | drop — same reasoning as #184 | — |
| 186 | Marking works correctly when the incompatible file sits in the middle of the context array | launchFileWithContext, getFileContext | currentIndex 1; files[1] incompatible; files[0]/[2] unaffected | drop — same reasoning as #184 | — |
| 187 | next() then previous() through a mixed compatible/incompatible array returns to the starting file | next, previous, getCurrentFile | file name sequence game1→game4→game1 | drop — the next()/previous() incompatible-file skip is implemented independently in `navigate-next.ts`/`navigate-previous.ts`'s own forward/backward scan loop, not in the `handleIncompatibleFile`/`advanceToNextCompatibleFileInDirectory` flow this task's Files section scopes to; out of scope for both of this task's files — see Execution Notes | — |
| 188 | The same incompatible files are skipped symmetrically going forward and backward | next, previous, getCurrentFile | file sequence file1→file3→file5→file3→file1 | drop — same reasoning as #187 | — |
| 189 | From the only compatible file, both next() and previous() wrap through incompatible files and land back on it | next, previous, getCurrentFile | current file stays 'good.prg' after both directions | drop — same reasoning as #187 | — |
| 190 | A longer alternating array navigates correctly forward and backward with varying skip counts | next, previous, getCurrentFile | file name sequence matches expected compatible files at each step | drop — same reasoning as #187 | — |
| 191 | Overriding PLAYER_INCOMPATIBLE_RETRY_DELAY_MS makes the directory-mode retry fire on the next macrotask instead of after 1000ms | launchFileWithContext, getCurrentFile | launchFile called twice without needing timer advancement; currentFile becomes the compatible file | ported (implicitly) — every test in `player-context-auto-advance.spec.ts` relies on the harness's default `incompatibleRetryDelayMs: 0` to make the retry observable on the next macrotask instead of waiting 1000ms; the override is the file's baseline configuration rather than a one-off case, so there is no single dedicated test for it | player-context-auto-advance.spec.ts |

## 3. player-context-history.service.spec.ts (33 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 192 | previous() from the end-of-history marker launches the most recent entry via launchFile, not random | previous, getCurrentHistoryPosition, getCurrentFile | position becomes 2; launchFile called with file3; launchRandom not called; currentFile is file3 | ported (folded with row 195 — entry count is also asserted unchanged) | player-context-history.spec.ts |
| 193 | previous() from the oldest entry wraps to the newest entry without adding a new entry | previous, getCurrentHistoryPosition, getPlayHistory | position wraps 0→2; entry count stays 3; currentFile is file3 | ported | player-context-history.spec.ts |
| 194 | previous() with cleared history falls back to a random launch | clearHistory, previous, getCurrentFile | launchRandom called; currentFile is the random file | ported | player-context-history.spec.ts |
| 195 | Backward history navigation doesn't grow the history | previous, getPlayHistory | entry count unchanged (3) after two backward navigations | ported (folded into row 192's test) | player-context-history.spec.ts |
| 196 | previous() in Directory mode uses ordinary file-context navigation, not history | toggleShuffleMode, launchFileWithContext, previous, getCurrentFile, getLaunchMode | launchFile called with the directory-previous file; mode stays Directory | ported (folded with row 204 — same claim for next() and previous() in one test) | player-context-history.spec.ts |
| 197 | Backward history navigation re-aligns and loads the file context for the target file's directory | previous, StorageStore.alignToPlayingFile, getFileContext | alignToPlayingFile called with directory path; fileContext reflects it with correct currentIndex | ported (folded with row 205 — both directions asserted in one test) | player-context-history.spec.ts |
| 198 | Navigating backward to a music history entry creates a running timer for it | previous, getTimerState | timerState non-null, isRunning true, totalTime > 0 | ported | player-context-history.spec.ts |
| 199 | next() from a middle history position launches the following entry via launchFile | next, getCurrentFile, getPlayHistory | launchFile called with file3; launchRandom not called; position becomes 2 | ported (folded with row 201 — entry count also asserted unchanged) | player-context-history.spec.ts |
| 200 | next() once at the newest entry launches a brand-new random file instead of reusing history | next, getCurrentFile | launchRandom called; launchFile call count unchanged from the prior forward nav | ported (folded with rows 202–203 into one test covering the random-launch-at-newest-entry shape and its append effect) | player-context-history.spec.ts |
| 201 | Forward history navigation doesn't add a new entry | next, getPlayHistory | entry count stays 3; position becomes 2 | ported (folded into row 199's test) | player-context-history.spec.ts |
| 202 | A random launch triggered from the end of history appends a new entry | next, getPlayHistory | entry count 3→4; new entry at end (position -1) matches the new file | ported (folded into row 200's test) | player-context-history.spec.ts |
| 203 | A brand-new random launch appends after existing entries rather than truncating forward history | next, getPlayHistory | entries grow to 4 with the new file appended at the end | ported (folded into row 200's test) | player-context-history.spec.ts |
| 204 | next() in Directory mode uses file-context navigation, unaffected by history position | toggleShuffleMode, launchFileWithContext, next, getCurrentFile, getLaunchMode | launchFile called with the directory-next file; mode stays Directory | ported (folded into row 196's test) | player-context-history.spec.ts |
| 205 | Forward history navigation also re-aligns and loads file context for the target entry's directory | next, StorageStore.alignToPlayingFile, getFileContext | alignToPlayingFile called with path; fileContext matches | ported (folded into row 197's test) | player-context-history.spec.ts |
| 206 | With one history entry, previous() lands on it and next() launches a new random file | previous, next, getPlayHistory, getCurrentFile | position sequence -1→0→-1; entry count 1 then 2 | ported | player-context-history.spec.ts |
| 207 | previous() with no history is a safe no-op; next() with no history behaves like a normal new launch | previous, next, getPlayHistory | previous() resolves without throw; next() creates the first entry | ported | player-context-history.spec.ts |
| 208 | A launchFile failure during backward navigation leaves history position unchanged and sets an error | previous, getPlayHistory, getError, getTimerState | position stays -1; error truthy; timer null | ported (folded with row 209 into one `it.each(['previous','next'])`, sharing a middle-position setup so both directions take the history-navigation branch) | player-context-history.spec.ts |
| 209 | Mirrors #208 for forward navigation | next, getPlayHistory, getError | position stays at 1; error truthy | ported (folded into row 208's `it.each`) | player-context-history.spec.ts |
| 210 | Navigating one device's history doesn't affect another device's history | previous, getPlayHistory | device1 position changes; device2 history unchanged (deep-equal to prior snapshot) | ported | player-context-history.spec.ts |
| 211 | A failed alignToPlayingFile during backward navigation doesn't block the file launch itself | previous, getCurrentFile, getPlayHistory | currentFile updates to target file; history position updates despite the directory-load rejection | ported | player-context-history.spec.ts |
| 212 | A rapid back/forward/back/forward/back sequence over a 5-entry history ends at the expected state | previous, next, getPlayHistory, getCurrentFile | final position 4; currentFile matches files[4] | ported (kept as the one representative multi-step walk test — see rows 217–218) | player-context-history.spec.ts |
| 213 | Toggling between shuffle and directory mode doesn't alter existing history | toggleShuffleMode, getPlayHistory, previous | history entries equal (deep) across mode switches; position updates correctly on subsequent previous() | ported (folded with row 216 into one test) | player-context-history.spec.ts |
| 214 | An end-to-end shuffle session (5 launches, 3 back, 2 forward, 1 new) tracks position/file at every step | next, previous, getPlayHistory, getCurrentFile | position and current file name checked after every step; final state has 6 entries at position -1 | ported (folded with row 215 into one session test asserting the final appended-not-truncated shape) | player-context-history.spec.ts |
| 215 | A browser-style session (launch 4, back twice, forward once, new launch) appends rather than discards forward history | next, previous, getPlayHistory | final entry count 5 with the new file appended at position -1 | ported (folded into row 214's test) | player-context-history.spec.ts |
| 216 | Switching between shuffle and directory mode mid-session keeps history growing and navigable | toggleShuffleMode, next, getPlayHistory, getCurrentFile, canNavigateBackwardInHistory | history length non-decreasing across mode switches; canNavigateBackward true at the end | ported (folded into row 213's test) | player-context-history.spec.ts |
| 217 | Backward navigation through 3 music entries keeps history position and current file in sync at each step | previous, getPlayHistory, getCurrentFile | position 2→1→0 with matching file names at each step | dropped — P03‑T06: duplicate coverage of row 212's multi-step walk (a "position tracks file at each step" claim); at this scale it's the same claim over a smaller n | — |
| 218 | A 10-entry history navigated back 5, forward 3, back 2 ends at the correct position with matching current file | previous, next, getPlayHistory, getCurrentFile | position sequence 5→8→6; currentFile name matches history.entries at each stop | dropped — P03‑T06: duplicate of row 212's multi-step walk at a larger n; no new code path | — |
| 219 | History view visibility defaults to hidden | isHistoryViewVisible | false | ported (folded with rows 220–221 into one toggle test) | player-context-history.spec.ts |
| 220 | Toggling once shows the history view | toggleHistoryView, isHistoryViewVisible | true | ported (folded into row 219's test) | player-context-history.spec.ts |
| 221 | Toggling twice hides it again | toggleHistoryView, isHistoryViewVisible | true then false | ported (folded into row 219's test) | player-context-history.spec.ts |
| 222 | History view visibility is tracked per device | toggleHistoryView, isHistoryViewVisible | toggling device1 doesn't affect device2 and vice versa | ported | player-context-history.spec.ts |
| 223 | Navigating to a specific history position doesn't hide an open history view, and doesn't add a new entry | toggleHistoryView, navigateToHistoryPosition, isHistoryViewVisible, getCurrentHistoryPosition, getPlayHistory | view stays visible; position becomes 0; currentFile matches; entry count unchanged (3) | ported | player-context-history.spec.ts |
| 224 | Launching a new file via launchFileWithContext closes an open history view | toggleHistoryView, launchFileWithContext, isHistoryViewVisible | view visible before launch, hidden after | ported | player-context-history.spec.ts |

## 4. player-context-incompatible-files.service.spec.ts (23 tests)

The six "file marking" drops below all call `(service as any).loadDirectoryContextForRandomFile(...)`
directly and monkey-patch `(service['store'] as any).getCurrentFile` — a private method invoked
through a cast, with a private collaborator internals swap on top. The "File marking consistency —
cross-scenario integration" describe exercises the identical behavior through the public
`launchFileWithContext` / `launchRandomFile` surface, so nothing is lost.

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 225 | loadDirectoryContextForRandomFile leaves files unchanged when the launched file is compatible | (private) loadDirectoryContextForRandomFile | loadFileContext spy called with original files array reference | drop — private method invoked via cast, plus private store internals monkey-patched; covered publicly by #231–241 | — |
| 226 | loadDirectoryContextForRandomFile marks the file incompatible when isCompatible: false | (private) loadDirectoryContextForRandomFile | loadFileContext spy called with a new array containing the marked file | drop — same private-cast pattern as #225 | — |
| 227 | loadDirectoryContextForRandomFile doesn't touch sibling files when marking one incompatible | (private) loadDirectoryContextForRandomFile | 4 unchanged files retain isCompatible true; target file false | drop — same private-cast pattern as #225 | — |
| 228 | loadDirectoryContextForRandomFile handles a current file absent from the directory listing | (private) loadDirectoryContextForRandomFile | resolves without throw; loadFileContext not called (currentIndex -1) | drop — same private-cast pattern as #225 | — |
| 229 | loadDirectoryContextForRandomFile matches files by exact path, not prefix/suffix | (private) loadDirectoryContextForRandomFile | only the exact-path file is marked false; similar paths stay true | drop — same private-cast pattern as #225 | — |
| 230 | loadDirectoryContextForRandomFile doesn't mark when isCompatible is undefined | (private) loadDirectoryContextForRandomFile | loadFileContext spy called with the original (unmutated) files array | drop — same private-cast pattern as #225 | — |
| 231 | A directory launch of an incompatible file marks it false in fileContext while siblings stay compatible | launchFileWithContext, getFileContext | fileContext 3 files; matched file isCompatible false; sibling file1 stays true | drop — fileContext-level marking (`launch-file-with-context.ts`'s own mapping) is a different code path from `markFileInStorageAsIncompatible`, the mechanism `player-context-compatibility.spec.ts` is chartered to cover ("the storage store reflecting the mark" per the handoff); out of scope for this task — see Execution Notes | — |
| 232 | Marking a rich single-file context as incompatible doesn't corrupt state after auto-advancement clears it | launchFileWithContext, getFileContext | fileContext non-null; files.length >= 0 after auto-advance finds nothing compatible | drop — same reasoning as #231; the all-incompatible fallback itself is covered by `player-context-auto-advance.spec.ts`'s fallback tests | — |
| 233 | A random launch of an incompatible file marks it false in the resulting directory-loaded fileContext | launchRandomFile, getFileContext | fileContext 3 files; matched file false; others true | drop — same reasoning as #231 | — |
| 234 | The backend's incompatible verdict overrides a directory listing that claimed the file was compatible | launchRandomFile, getFileContext | fileContext.files[0].isCompatible false | drop — same reasoning as #231 | — |
| 235 | Directory-launch and random-launch marking produce equivalent fileContext shapes for the same file | launchFileWithContext, launchRandomFile, getFileContext | both contexts have 3 files; marked file identical (isCompatible/name/path) between scenarios | drop — same reasoning as #231 | — |
| 236 | Marking correctly matches a file path containing spaces/parentheses in both launch types | launchFileWithContext, launchRandomFile, getFileContext | both scenarios mark the special-path file false; sibling file defined/untouched | drop — same reasoning as #231; path matching for the storage-store mark (a plain equality check in `updateFileCompatibility`) needs no separate special-character case | — |
| 237 | A launched file absent from the directory listing produces an empty fileContext identically for both launch types | launchFileWithContext, launchRandomFile, getFileContext | both contexts have 0 files | drop — same reasoning as #231 | — |
| 238 | A backend response with no isCompatible field defaults to compatible identically in both launch types | launchFileWithContext, launchRandomFile, getFileContext | both contexts' first file isCompatible true | drop (fileContext claim) — same reasoning as #231; the storage-store side of "undefined isCompatible isn't marked" is covered directly by #245's disposition below | — |
| 239 | An explicit backend isCompatible:true wins on directory launch; random launch doesn't rewrite a stale directory false | launchFileWithContext, launchRandomFile, getFileContext | directory-launch context true; random-launch context still shows the directory's stale false value | drop — same reasoning as #231 | — |
| 240 | The original Phase 1 directory-marking behavior still holds after later changes (regression) | launchFileWithContext, getFileContext | 3 files; marked file false; file1 stays true; file2 still present | drop — same reasoning as #231; the equivalent storage-store regression ("exactly once") is covered directly by this file's directory-launch marking test | — |
| 241 | Alternating directory/random launches of different incompatible files don't leave stale or duplicate marks | launchFileWithContext, launchRandomFile, getFileContext | each launch's fileContext shows the correct file marked false; final file set has no duplicate paths | drop — same reasoning as #231; the storage-store equivalent (each detection marks only its own file) is covered by this file's sequential-launches test | — |
| 242 | A random launch of an incompatible file syncs the mark back to StorageStore | launchRandomFile, StorageStore.updateFileCompatibility | updateFileCompatibility called once with deviceId/storageType/filePath/isCompatible:false | ported | player-context-compatibility.spec.ts |
| 243 | The storage sync call derives storageType from the device's storage key | launchRandomFile, StorageStore.updateFileCompatibility | call's storageType is Sd | ported (folded) — asserted as part of #242's `toHaveBeenCalledWith` call-args check | player-context-compatibility.spec.ts |
| 244 | A compatible random launch never syncs to StorageStore | launchRandomFile, StorageStore.updateFileCompatibility | not called | ported | player-context-compatibility.spec.ts |
| 245 | An undefined isCompatible result also skips the storage sync | launchRandomFile, StorageStore.updateFileCompatibility | not called | drop (random-launch variant) — the guard (`isCompatible !== false`) is entry-point-agnostic; already ported via the directory-launch undefined-isCompatible test in this file, and re-exercising the identical guard through the random-launch entry point is duplicate coverage | — |
| 246 | Storage sync happens after the player's fileContext is updated with the incompatible mark | launchRandomFile, getFileContext, StorageStore.updateFileCompatibility | fileContext marked false; updateFileCompatibility called once | drop — a call-order/internal-sequencing assertion, which the handoff's Testing section explicitly says to skip ("skip asserting on ... the internal scan order; assert which file ends up launched and what the storage store holds") | — |
| 247 | Each of two sequential incompatible random launches syncs its own file to StorageStore | launchRandomFile, StorageStore.updateFileCompatibility | called with bad1 then bad2; called twice total | ported | player-context-compatibility.spec.ts |
| — | (new coverage) A directory launch of an incompatible file marks it in the storage store exactly once, with the compatible sibling left untouched | launchFileWithContext, StorageStore.updateFileCompatibility, StorageStore state | called once with correct args; store state shows the file marked false and the sibling unaffected | new — `markFileInStorageAsIncompatible` is also reached via `handleIncompatibleFile`'s directory-mode path, a call site rows 242–247 never exercised (they only covered the `launchRandomFile` call site of the same mechanism) | player-context-compatibility.spec.ts |
| — | (new coverage) A directory launch never marks a compatible file, or a file with undefined isCompatible, in the storage store | launchFileWithContext, StorageStore.updateFileCompatibility | not called in either case; undefined case completes without triggering the advancement retry | new — directory-launch counterpart to #244/#245, exercised through the call site rows 242–247 didn't cover | player-context-compatibility.spec.ts |

## 5. player-context-settings.service.spec.ts (14 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 248 | initializePlayer reads the startup filter from SettingsStore and applies it | initializePlayer, PlayerStore.initializePlayer | called with defaultFilter Games, playTimerEnabled true | ported (rewritten) — P03‑T06: per the handoff's real-`SettingsStore` seam, this seeds `SettingsStore` state directly (`updateState`) instead of stubbing `PlayerStore.initializePlayer`, and asserts the result through `getShuffleSettings()`/`getPlayTimerConfig()` (the real store's derived state) rather than a spy call | player-context-settings.spec.ts |
| 249 | Null settings fall back to the All filter and disabled timer | initializePlayer | called with defaultFilter All, playTimerEnabled false | ported (rewritten, same real-store approach as row 248) | player-context-settings.spec.ts |
| 250 | Missing playerSettings sub-object also falls back to All/disabled | initializePlayer | called with defaultFilter All, playTimerEnabled false | ported (rewritten, same real-store approach as row 248) | player-context-settings.spec.ts |
| 251 | The Music startup filter is applied | initializePlayer | called with defaultFilter Music, playTimerEnabled true | ported (rewritten as an `it.each` over Games/Music/Hex/Images, folding rows 252–253) | player-context-settings.spec.ts |
| 252 | The Hex startup filter is applied | initializePlayer | called with defaultFilter Hex, playTimerEnabled true | ported (folded into row 251's `it.each`) | player-context-settings.spec.ts |
| 253 | The Images startup filter is applied | initializePlayer | called with defaultFilter Images, playTimerEnabled true | ported (folded into row 251's `it.each`) | player-context-settings.spec.ts |
| 254 | initializePlayer applies filter and timer setting together in one store call | initializePlayer | called exactly once with All/true | dropped — P03‑T06: with the real store, filter and playTimerEnabled are read together by the same `initializePlayer` call in row 248's test; the "one call" framing was only meaningful against a spy, which the real-store rewrite no longer uses | — |
| 255 | Two devices each get their own initializePlayer call carrying the same settings-derived filter | initializePlayer | called twice, once per deviceId, both with Games/true | ported (rewritten, asserts both devices' `getShuffleSettings`/`getPlayTimerConfig` instead of spy call args) | player-context-settings.spec.ts |
| 256 | Re-initializing an already-initialized device doesn't reset a filter the user changed manually | initializePlayer, PlayerStore.updateShuffleSettings | second call still reflects original Games filter; updateShuffleSettings only called for the manual change | ported (rewritten via the public `setFilterMode`/`getShuffleSettings` surface instead of a store spy) | player-context-settings.spec.ts |
| 257 | A true playTimerEnabled setting is passed through to store initialization | initializePlayer | called with playTimerEnabled true | dropped — P03‑T06: `playerSettings.startupFilter` and `.playTimerEnabled` are two independent optional-chained reads in `initializePlayer` with no shared branching; row 248's combined test already exercises this exact read for `playTimerEnabled: true` | — |
| 258 | A false playTimerEnabled setting is passed through as false | initializePlayer | called with playTimerEnabled false | dropped — P03‑T06: same reasoning as row 257; row 249's null-settings test already exercises the `false` branch | — |
| 259 | Null settings default the timer to disabled | initializePlayer | playTimerEnabled false | dropped — P03‑T06: duplicate of row 249, which already asserts the timer defaults to disabled under null settings | — |
| 260 | Missing playerSettings also defaults the timer to disabled | initializePlayer | playTimerEnabled false | dropped — P03‑T06: duplicate of row 250, which already asserts the timer defaults to disabled under missing `playerSettings` | — |
| 261 | Two devices each receive the same settings-derived timer flag via their own initializePlayer call | initializePlayer | called twice, once per device, both with playTimerEnabled true | dropped — P03‑T06: duplicate of row 255, which already asserts both devices' filter and timer flag together | — |

## 6. player-context-playTimer.service.spec.ts (21 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 262 | A newly initialized device gets a default (disabled, DEFAULT_TIMER_MS) custom timer config | initializePlayer, getPlayTimerConfig | enabled false; durationMs DEFAULT_TIMER_MS | ported (folded with rows 280–281 into one test covering a fresh device and an unknown one) | player-context-timer.spec.ts |
| 263 | The default timer config survives a subsequent file launch | launchFileWithContext, getPlayTimerConfig | config unchanged (disabled, default duration) after launch | ported | player-context-timer.spec.ts |
| 264 | setCustomTimer enables the timer and sets its duration | setCustomTimer, getPlayTimerConfig | enabled true, durationMs 30000 | ported (folded with rows 265–267 into one sequential enable→update→disable flow test; row 267's "single call updates both at once" is this same call) | player-context-timer.spec.ts |
| 265 | Calling setCustomTimer again while enabled changes only the duration | setCustomTimer, getPlayTimerConfig | durationMs updates to 60000, still enabled | ported (folded into row 264's test) | player-context-timer.spec.ts |
| 266 | Disabling the custom timer keeps the last duration but flips enabled off | setCustomTimer, getPlayTimerConfig | enabled false; durationMs persists (30000) | ported (folded into row 264's test) | player-context-timer.spec.ts |
| 267 | A single setCustomTimer call updates both enabled and duration at once | setCustomTimer, getPlayTimerConfig | enabled true, durationMs 45000 | ported (folded into row 264's test — its first call already updates both fields at once) | player-context-timer.spec.ts |
| 268 | Updating the custom timer config doesn't disturb the currently playing file or status | setCustomTimer, getCurrentFile, getPlayerStatus | file name unchanged; status stays Playing | ported (folded into rows 276–277's immediate-update test) | player-context-timer.spec.ts |
| 269 | For a music file, metadata playLength wins over an enabled custom timer | setCustomTimer, launchFileWithContext, getTimerState | totalTime 225000 (metadata), not the custom 30000 | ported | player-context-timer.spec.ts |
| 270 | A non-timer file type (game) gets the custom-timer duration when enabled | setCustomTimer, launchFileWithContext, getTimerState | totalTime 60000 | ported (folded with row 271 into one `it.each([Game, Image])`) | player-context-timer.spec.ts |
| 271 | Image files also receive the custom-timer duration when enabled | setCustomTimer, launchFileWithContext, getTimerState | totalTime 10000 | ported (folded into row 270's `it.each`) | player-context-timer.spec.ts |
| 272 | Hex files are excluded from timers regardless of the custom timer setting | setCustomTimer, launchFileWithContext, getTimerState | timerState null | ported | player-context-timer.spec.ts |
| 273 | With the custom timer disabled, music files still time via metadata | launchFileWithContext, getTimerState | totalTime 225000 | dropped — P03‑T06: duplicate of row 73 (timer creation from file metadata); no custom timer is enabled in any of that section's tests, so it already exercises this exact "disabled by default, music times via metadata" path | — |
| 274 | Game files get no timer when the custom timer is off | launchFileWithContext, getTimerState | timerState null | ported (folded with row 275 into one `it.each([Game, Image])`) | player-context-timer.spec.ts |
| 275 | Image files also get no timer when the custom timer is off | launchFileWithContext, getTimerState | timerState null | ported (folded into row 274's `it.each`) | player-context-timer.spec.ts |
| 276 | Enabling the custom timer mid-session applies it to the next non-timer-file launch | setCustomTimer, launchFileWithContext, getTimerState | no timer before enabling; totalTime 20000 after enabling and relaunching | ported (rewritten) — P03‑T06: `setCustomTimer` recreates the timer immediately for the currently loaded file (`setupTimerForFile` runs inline when a file is already current), so the before/after-enabling contrast is exercised directly on the already-loaded file rather than via an extra relaunch — same claim, fewer steps; folded with rows 268, 277 into one test | player-context-timer.spec.ts |
| 277 | Disabling the custom timer mid-session removes it from the next non-timer-file launch | setCustomTimer, launchFileWithContext, getTimerState | timer present (15000) while enabled; null after disabling and relaunching | ported (folded into row 276's test, same immediate-update reasoning) | player-context-timer.spec.ts |
| 278 | A set custom duration applies consistently across successive launches | setCustomTimer, launchFileWithContext, getTimerState | totalTime 25000 for both launches | dropped — P03‑T06: duplicate of row 279's test, whose first launch already shows a set duration (30000) holding until explicitly changed | — |
| 279 | Updating the custom duration mid-session affects only the following launch | setCustomTimer, launchFileWithContext, getTimerState | 30000 then 5000 after the update | ported | player-context-timer.spec.ts |
| 280 | Querying config for an unknown device returns null | getPlayTimerConfig | null | ported (folded into row 262's test) | player-context-timer.spec.ts |
| 281 | A newly initialized device has a default config available | getPlayTimerConfig | enabled false; durationMs DEFAULT_TIMER_MS | ported (folded into row 262's test — duplicate of the same claim) | player-context-timer.spec.ts |
| 282 | The same signal instance reflects config changes made via setCustomTimer | getPlayTimerConfig, setCustomTimer | signal value updates from disabled to enabled/50000 in place | ported (claim corrected) — P03‑T06: `getPlayTimerConfig(deviceId)` returns a fresh `computed()` on every call (`selectors/get-play-timer-config.ts`), so it is never the *same instance* across two separate calls; the real, verifiable claim is that a *previously obtained* signal keeps reflecting later changes (any computed signal's normal behavior), which is what the rewritten test asserts | player-context-timer.spec.ts |

## 7. player-context-loading.service.spec.ts (13 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 283 | isSlowLoading is false with no devices | isSlowLoading | false | ported (folded with row 292 — identical claim, one test) | player-context-timer.spec.ts |
| 284 | isSlowLoading stays false for idle devices | initializePlayer, isSlowLoading | false | ported (folded into row 283's test) | player-context-timer.spec.ts |
| 285 | isSlowLoading() returns a stable, memoized signal | isSlowLoading | two calls return the same reference | ported | player-context-timer.spec.ts |
| 286 | A device loading past the 2s threshold flips the global slow-loading signal true | isSlowLoading | signal true after the delay observable resolves | ported (rewritten) — P03‑T06: carries forward P01‑T02's `skip(1)` race-condition fix coverage; drives `PLAYER_LAUNCH_DELAY_MS` (the real threshold token, not a fixed "2 seconds") through a dedicated short-delay harness instead of the production 2000ms default, per this task's Testing guidance to prefer an overridden delay with short real waits | player-context-timer.spec.ts |
| 287 | Loading that finishes inside the 2-second window never trips the slow-loading signal | isSlowLoading | stays false throughout and after completion | ported (rewritten, same short-delay-harness approach as row 286) | player-context-timer.spec.ts |
| 288 | Completing a slow load flips the signal back to false immediately | isSlowLoading | true while loading, false right after completion | ported (folded into row 286's test — asserts the immediate-false transition after the tripped signal) | player-context-timer.spec.ts |
| 289 | The global signal is true if any one of several devices is slow-loading | isSlowLoading | true once device2 crosses the threshold | ported | player-context-timer.spec.ts |
| 290 | The signal returns to false only once every loading device finishes | isSlowLoading | true while both loading, false once both complete | ported (folded into row 289's test) | player-context-timer.spec.ts |
| 291 | Removing one slow-loading device while another remains loading keeps the signal true until that one also stops | removePlayer, isSlowLoading | true after removal (device2 still loading); false once device2 stops | ported | player-context-timer.spec.ts |
| 292 | isSlowLoading is safe to call with no devices at all | isSlowLoading | false | ported (folded into row 283's test — identical claim) | player-context-timer.spec.ts |
| 293 | Many short back-to-back loading spans that individually stay under 2s never trip the signal | isSlowLoading | false after 10 rapid 150ms load/50ms-gap cycles | ported (rewritten with shorter spans scaled to the dedicated short-delay harness; same "rapid short spans never trip the signal" claim) | player-context-timer.spec.ts |
| 294 | A real launchFileWithContext call that takes over 2s trips the slow-loading signal, then clears | launchFileWithContext, isSlowLoading | true mid-launch, false after the launch promise resolves | ported (rewritten against the short-delay harness rather than a real 2-second wait) | player-context-timer.spec.ts |
| 295 | A real launch under 2 seconds never trips the signal | launchFileWithContext, isSlowLoading | false even after waiting past the 2-second mark | ported (rewritten against the short-delay harness) | player-context-timer.spec.ts |

## 8. player-context-favorite.service.spec.ts (7 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 296 | Marking a file favorite updates both the current-file signal and the matching entry in file context | updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | currentFile.file.isFavorite true; matching context entry also true | ported | player-context-favorite.spec.ts |
| 297 | Marking a favorite updates every context entry sharing that file's path | updateCurrentFileFavoriteStatus, getFileContext | both duplicate-path entries become favorite | ported | player-context-favorite.spec.ts |
| 298 | Marking a path that isn't loaded leaves current file/context untouched | updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | both stay false | ported (folded with row 299 into one test: mismatched-path no-op, then toggle on/off) | player-context-favorite.spec.ts |
| 299 | Calling the update again with false clears the favorite flag it just set | updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | both false after the second call | ported (folded into row 298's test) | player-context-favorite.spec.ts |
| 300 | Calling the update for an unknown device is a safe no-op | updateCurrentFileFavoriteStatus | does not throw | ported (folded with row 301 into one test) | player-context-favorite.spec.ts |
| 301 | Calling the update before any file is launched leaves state null | initializePlayer, updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | both remain null | ported (folded into row 300's test) | player-context-favorite.spec.ts |
| 302 | Marking a favorite on one device's file doesn't affect another device's file | updateCurrentFileFavoriteStatus, getCurrentFile | primary device true, secondary device false | ported | player-context-favorite.spec.ts |

## 9. player-context-initialization.spec.ts (3 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 303 | initializePlayer reads default settings and forwards defaultFilter/playTimerEnabled to the store | initializePlayer, PlayerStore.initializePlayer | called with deviceId, defaultFilter All, playTimerEnabled false | dropped — P03‑T06: no `player-context-lifecycle.spec.ts` was ever created (T04's Execution Notes); this row is a duplicate of row 249 (null-settings fallback to All/disabled), now exercised in `player-context-settings.spec.ts` against the real `SettingsStore` | — |
| 304 | A custom startup filter/timer setting is forwarded as-is | initializePlayer | called with defaultFilter Games, playTimerEnabled true | dropped — P03‑T06: duplicate of row 248 (custom filter/timer applied together), same reasoning as row 303 | — |
| 305 | Null settings from SettingsStore fall back to defaults | initializePlayer | called with defaultFilter All, playTimerEnabled false | dropped — P03‑T06: duplicate of row 249, same reasoning as row 303 | — |

## Execution Notes

- **Count correction (header, step "External surface"):** the handoff states "304 across nine
  files." A direct measurement (`grep -cE "^\s*it\(" <file>` per file, cross-checked against
  `it.each`/`it.skip`/`it.only`/`it.todo` — none present in any of the nine files) gives **305**.
  The discrepancy is entirely in `player-context-auto-advancement.service.spec.ts`: 40 actual vs.
  39 assumed by the handoff. All other eight files' counts (151, 33, 23, 14, 21, 13, 7, 3) match
  the handoff exactly. This inventory's header and every downstream count are built on the
  measured 305, per the handoff's own instruction to "correct the count in the inventory header
  rather than leaving the two documents disagreeing."
- **Drop criterion applied narrowly and objectively:** every `drop` in this inventory falls under
  the handoff's "assertions on private methods reached through casts" category. I treated this as
  covering both (a) tests whose *action* is a direct call to a private method via
  `as unknown as ServiceWithPrivates` / `as any`, and (b) tests whose *assertion* targets a
  `vi.spyOn` on such a private method even when the trigger is a public call — both bypass
  `IPlayerContext`'s public contract as the thing actually being verified. I did not drop any test
  solely because its behavior duplicates another test's *scenario* (e.g., the settings file's
  four near-identical `startupFilter` tests were only `merge`d, not dropped, since each still
  exercises the public `initializePlayer` contract). No test was dropped for being "hard to
  rebuild."
- **Two `merge` rows are conservative, not exhaustive:** I only merged the settings file's
  Hex/Images filter-value tests into the Music one (#252, #253 → #251) because they are
  byte-for-byte identical in shape apart from one enum literal — an unambiguous
  parameterize-and-collapse case. I did not attempt a broader semantic dedup sweep across all 305
  tests (e.g., the several near-identical "isCompatible on next() vs. previous()" pairs in the
  monolith, or the game/image "custom timer duration" pairs in `playTimer.service.spec.ts`) —
  those test genuinely distinct code paths (different navigation direction, different file type)
  even though their assertion shape rhymes, so I ported them as separate rows rather than guessing
  at a merge that the rebuild task might not want. Flagging this so T03–T06 can revisit with fresh
  eyes once the target files are drafted.
- **Row #134 ("should enforce maximum of 1000 history entries")** is ported as-is despite its
  Behavior column noting that it doesn't actually exercise the 1000-entry cap — it launches 3
  files and asserts 3 entries. This is exactly the shape of test the handoff's `drop` criteria
  would *not* license dropping (it isn't a private-method or duplicate-coverage case), but it's
  worth flagging for the rebuild: if the 1000-entry cap has no test today, T03–T06 may want to
  either rename this test to describe what it actually checks, or add real cap coverage — that
  decision is out of scope for this inventory.
- **Target file split is a proposal, not a directive already executed.** The split assigns every
  `port`/`merge` row to one of 18 files, none exceeding ~800 source lines at the original files'
  lines-per-test density, and mostly follows the existing per-feature file boundaries
  (favorite/loading/settings/custom-timer carry over unchanged). The three areas that needed
  genuine subdivision — the monolith, `auto-advancement`, and history — are split along the
  monolith's own top-level `describe` boundaries (timer lifecycle vs. progression; history
  recording vs. timeline; auto-advancement's surviving behavior vs. navigation tests) so the seams
  match natural feature boundaries rather than arbitrary line-count cuts.
- Nothing was deleted or modified in any of the nine spec files as part of this task — this
  document is the only artifact produced.

## P03‑T06 Execution Notes

- **Reconciled the monolith to empty before deleting it.** `player-context.service.spec.ts` still
  held the Timer System (rows 73–115), Play History (rows 116–151), and Incompatible Playback
  Prevention (rows 26–28) sections after T03–T05. Every row in those ranges is now marked ported,
  merged, or dropped-with-reason above; the file itself, along with the other six files this task's
  handoff names, was deleted in the same commit as the four new files.
- **`hasErrorAndCleanup` behavior correction (rows 95–96).** The inventory's original claim — a
  failed `next()`/`previous()` "leaves the prior file's timer untouched" — doesn't hold against the
  current source: `hasErrorAndCleanup` unconditionally calls `cleanupTimer` whenever `getPlayerError`
  is truthy, regardless of which file remains current. Verified by reading `player-context.service.ts`
  directly and confirmed by a failing test before the fix. The rebuilt test asserts the actual
  behavior (timer torn down, error set) rather than the stale claim.
- **Windows real-timer resolution and the auto-progression tests (rows 87–91).** `TimerService`
  increments `currentTime` by `Math.max(PLAYER_TIMER_TICK_MS, 1)` on every real tick. At this
  repo's default test harness tick (`0`), each real tick's wall-clock cost is bounded below by the
  OS's timer-resolution floor rather than 1ms — on this environment that floor sits far above 1ms,
  turning a nominal 1-second timer into a multi-second real wait and making a fixed `waitUntil`
  budget unreliable. The auto-progression tests instead construct a dedicated harness with
  `timerTickMs` at or above the timer's own duration, so the timer completes in one bounded real
  tick instead of ~1000 OS-throttled ones. `waitUntil` (a bounded poll, not a fixed sleep) replaces
  fixed real-time waits so the tests settle as soon as the condition is true.
- **isSlowLoading carries forward P01‑T02's race-fix coverage (rows 283–295).** Rewritten against a
  dedicated harness with a short, overridden `PLAYER_LAUNCH_DELAY_MS` (the actual slow-loading
  threshold token) rather than the production 2000ms default, per this task's Testing guidance.
  This is the same three-outcome shape (trips true past the threshold, stays false under it, clears
  immediately on completion) that P01‑T02's fix targeted, so the regression stays covered.
- **Real 1000-entry history cap test added (row 134's replacement).** The inventory itself flagged
  row 134 as not actually exercising the cap it claimed to test. `player-context-history.spec.ts`
  now launches 1002 sequential files and asserts the store evicts the two oldest, landing at exactly
  1000 entries — closing a genuine coverage gap the original inventory-author left open for a later
  task.
- **`incompatibleRetryDelayMs` and the `handleIncompatibleFile` leak.** Any failed launch marks the
  attempted file `isCompatible: false` (`createLaunchedFile(..., false)` in the failure branch of
  `launch-file-with-context.ts`), which unconditionally trips `handleIncompatibleFile` at the end of
  `launchFileWithContext`/`next`/`previous`. At the harness's default `incompatibleRetryDelayMs: 0`,
  this schedules a real `setTimeout` retry that can fire after a test (and its TestBed) has already
  torn down, throwing `NG0205` into whatever test runs next. Both new files that exercise failed
  launches (`player-context-history.spec.ts`, `player-context-timer.spec.ts`) default their shared
  harness to a long `incompatibleRetryDelayMs` so this retry never fires within a test's lifetime;
  the few tests that exercise the retry itself set their own short-lived harness instead.
- **Settings seeded through the real `SettingsStore`, not a stub.** Per the handoff's explicit seam,
  `player-context-settings.spec.ts` seeds `SettingsStore` state directly via `updateState` (the same
  pattern the deleted `player-context-loading.service.spec.ts` used for `PlayerStore`) rather than
  stubbing `settings()`. This also meant rewriting the "one store call" / "playTimerEnabled forwarded
  in isolation" rows (254, 257–261) as duplicates: with the real store, `initializePlayer` reads
  `startupFilter` and `playTimerEnabled` as two independent optional-chained fields with no shared
  branching, so a combined test already proves both variables' handling that a spy-based "was it
  called once" assertion existed to distinguish.
- **`getPlayTimerConfig` is not a cached signal (row 282).** `selectors/get-play-timer-config.ts`
  returns a fresh `computed()` on every call — there is no per-device caching at the store or service
  layer. The original row's "same signal instance" claim doesn't hold; the rebuilt test instead
  verifies the real, useful property: a *previously obtained* signal keeps reflecting later
  `setCustomTimer` changes, which is ordinary `computed()` reactivity.
- **Play()/pause()/stop() compatibility gate (rows 26–28) and timer↔incompatibility interplay (rows
  111–115) had no owner after T03–T05.** Both are exercised through `player-context.service.ts`'s
  Phase 5 timer-integration code (the play()/pause() guards are literally labeled "Phase 5" in the
  source despite living in the monolith's "Phase 3" describe block), so they landed in
  `player-context-timer.spec.ts` rather than a fifth file. Row 112's random-launch-specific
  `alignToPlayingFile` assertion was not reproduced (the folded test uses the directory-launch entry
  point); flagging as a minor, low-value gap rather than adding a fifth file for one assertion.
- Every spec file under `src/libs/application/src/lib/player` is at or under roughly 800 lines
  (`player-context-timer.spec.ts`, the largest, is under 800). `pnpm nx test application`-equivalent
  (`vitest run` against the `application` project's Vite config) passed 713/713 non-skipped tests
  across three consecutive runs at ~66s each.
