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

| Target file | Tests | Sourced from |
|---|---:|---|
| `player-context-lifecycle.spec.ts` | 21 | monolith: Init & Cleanup, Phase 1 Launching, Signal API, Multi-Device Isolation, Error Recovery; `player-context-initialization.spec.ts` (whole) |
| `player-context-navigation-shuffle.spec.ts` | 29 | monolith: Phase 2 Random/Shuffle, Phase 3 File Navigation, Phase 4 Filter System |
| `player-context-playback.spec.ts` | 22 | monolith: Phase 3 Play/Pause/Stop Control, State Transitions |
| `player-context-incompatible-marking.spec.ts` | 11 | `player-context-incompatible-files.service.spec.ts`: File marking consistency cross-scenario |
| `player-context-incompatible-sync.spec.ts` | 14 | `player-context-incompatible-files.service.spec.ts`: Storage Store Synchronization; monolith: Incompatible File Playback Prevention, Timer's Incompatible File Handling |
| `player-context-timer-lifecycle.spec.ts` | 20 | monolith: Timer Creation & Lifecycle, Playback Control Integration, Navigation Timer Tests, Store Integration, Edge Cases & Error Handling |
| `player-context-timer-progression.spec.ts` | 18 | monolith: Auto-Progression Tests, Timer Error Handling Tests, Multi-Device Timer Tests |
| `player-context-custom-play-timer.spec.ts` | 21 | `player-context-playTimer.service.spec.ts` (whole) |
| `player-context-history-recording.spec.ts` | 31 | monolith: Phase 1 Play History Tracking minus Timeline Integrity |
| `player-context-history-timeline.spec.ts` | 5 | monolith: History Timeline Integrity (Behaviors A–E) |
| `player-context-history-back-forward.spec.ts` | 14 | `player-context-history.service.spec.ts`: Previous/Next Button with History |
| `player-context-history-edge-cases.spec.ts` | 13 | `player-context-history.service.spec.ts`: Edge Cases & Error Handling, Complete Workflow Scenarios |
| `player-context-history-view.spec.ts` | 6 | `player-context-history.service.spec.ts`: History View Visibility |
| `player-context-auto-advancement-behavior.spec.ts` | 8 | `player-context-auto-advancement.service.spec.ts`: surviving Handler Integration tests, End-to-End Scenarios |
| `player-context-auto-advancement-navigation.spec.ts` | 11 | `player-context-auto-advancement.service.spec.ts`: Launch Operations (Phase 1), Navigation Consistency (Phase 5), retry-delay override |
| `player-context-favorite.spec.ts` | 7 | `player-context-favorite.service.spec.ts` (whole) |
| `player-context-loading.spec.ts` | 13 | `player-context-loading.service.spec.ts` (whole) |
| `player-context-settings.spec.ts` | 14 (12 physical after merge) | `player-context-settings.service.spec.ts` (whole) |
| **Total** | **278** rows (276 port + 2 merge) | |

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
| 1 | Initializing a device creates player state with no current file, Stopped status | initializePlayer, getCurrentFile, getStatus | currentFile null; status Stopped | port | player-context-lifecycle.spec.ts |
| 2 | Removing a player clears its current file | initializePlayer, removePlayer, getCurrentFile | currentFile null after removal | port | player-context-lifecycle.spec.ts |
| 3 | Two devices initialize independently; removing one doesn't affect the other | initializePlayer, removePlayer, getCurrentFile, getStatus | both null/Stopped; device2 unaffected by device1 removal | port | player-context-lifecycle.spec.ts |
| 4 | Launching a file with directory context sets current file, mode, context; clears loading/error | launchFileWithContext, getCurrentFile, getLaunchMode, getFileContext, isLoading, getError | launchFile called with file; currentFile equals file; mode Directory; fileContext files/path/index correct; not loading; error null | port | player-context-lifecycle.spec.ts |
| 5 | A launch API failure still records the attempted file and sets error | launchFileWithContext, getError, isLoading, getCurrentFile | error truthy; not loading; currentFile set to attempted file | port | player-context-lifecycle.spec.ts |
| 6 | Omitting launchMode on launch defaults to Directory | launchFileWithContext, getLaunchMode | mode Directory | port | player-context-lifecycle.spec.ts |
| 7 | isLoading is true while the launch observable is pending, false once resolved | launchFileWithContext, isLoading | true mid-flight, false after completion | port | player-context-lifecycle.spec.ts |
| 8 | Random launch sets current file and Shuffle launch mode | launchRandomFile, getCurrentFile, getLaunchMode, isLoading, getError | launchRandom called with scope/filter/undefined; currentFile equals random file; mode Shuffle; not loading; error null | port | player-context-navigation-shuffle.spec.ts |
| 9 | After a random launch, service aligns storage to the launched file's parent directory | launchRandomFile, StorageStore.alignToPlayingFile | alignToPlayingFile called with deviceId/storageType/path | port | player-context-navigation-shuffle.spec.ts |
| 10 | A failed directory alignment after random launch doesn't throw; current file still updates | launchRandomFile, getCurrentFile | resolves without throw; currentFile set | port | player-context-navigation-shuffle.spec.ts |
| 11 | When alignment resolves with no directory state available, launch still completes | launchRandomFile, getCurrentFile, getLaunchMode | alignToPlayingFile called; currentFile set; mode Shuffle | port | player-context-navigation-shuffle.spec.ts |
| 12 | A failed random launch sets error state and leaves no current file | launchRandomFile, getError, getCurrentFile, isLoading | error truthy; currentFile null; not loading | port | player-context-navigation-shuffle.spec.ts |
| 13 | Toggling shuffle mode switches launch mode and persists settings | toggleShuffleMode, getLaunchMode | mode becomes Shuffle; storage save called | port | player-context-navigation-shuffle.spec.ts |
| 14 | Toggling twice returns to Directory mode | toggleShuffleMode, getLaunchMode | mode Shuffle then Directory | port | player-context-navigation-shuffle.spec.ts |
| 15 | Setting shuffle scope updates shuffle settings and persists | setShuffleScope, getShuffleSettings | settings.scope updated; storage save called | port | player-context-navigation-shuffle.spec.ts |
| 16 | Setting filter mode updates shuffle settings' filter | setFilterMode, getShuffleSettings | settings.filter updated | port | player-context-navigation-shuffle.spec.ts |
| 17 | Scope/filter set on one device don't affect another device | setShuffleScope, setFilterMode, getShuffleSettings | each device's settings reflect only its own updates | port | player-context-navigation-shuffle.spec.ts |
| 18 | play() while stopped invokes toggleMusic and transitions to Playing | play, stop, getPlayerStatus, getError | toggleMusic called with deviceId; status Playing; error null | port | player-context-playback.spec.ts |
| 19 | play() while paused resumes to Playing | play, pause, getPlayerStatus | status Playing; error null | port | player-context-playback.spec.ts |
| 20 | play() while already playing is a no-op | play, getPlayerStatus | toggleMusic not called; status stays Playing; error null | port | player-context-playback.spec.ts |
| 21 | A play() API failure sets error state | play, getError | error truthy | port | player-context-playback.spec.ts |
| 22 | pause() while playing invokes toggleMusic and transitions to Paused | pause, getPlayerStatus, getError | toggleMusic called; status Paused; error null | port | player-context-playback.spec.ts |
| 23 | pause() while already paused is a no-op | pause, getPlayerStatus | toggleMusic not called; status stays Paused | port | player-context-playback.spec.ts |
| 24 | pause() while stopped is a no-op | pause, getPlayerStatus | toggleMusic not called; status stays Stopped | port | player-context-playback.spec.ts |
| 25 | A pause() API failure sets error state | pause, getError | error truthy | port | player-context-playback.spec.ts |
| 26 | play() is inert on an incompatible file but works once auto-advancement lands on a compatible one | launchFileWithContext, play, pause, getCurrentFile | after auto-advance, toggleMusic called on play() | port | player-context-incompatible-sync.spec.ts |
| 27 | pause() mirrors the play() case after auto-advancement to a compatible file | launchFileWithContext, pause, getCurrentFile | toggleMusic called on pause() once compatible file is current | port | player-context-incompatible-sync.spec.ts |
| 28 | stop() is always allowed regardless of compatibility | stop, getCurrentFile | resetDevice called | port | player-context-incompatible-sync.spec.ts |
| 29 | stop() resets the device and clears error | stop, getError | resetDevice called with deviceId; error null | port | player-context-playback.spec.ts |
| 30 | A failed device reset sets error state | stop, getError | error truthy | port | player-context-playback.spec.ts |
| 31 | next() in directory mode launches the following file in the context array | next, getCurrentFile | launchFile called with file2; currentFile equals file2 | port | player-context-navigation-shuffle.spec.ts |
| 32 | previous() launches the preceding file in the context array | previous, getCurrentFile | launchFile called with file1; currentFile equals file1 | port | player-context-navigation-shuffle.spec.ts |
| 33 | previous() from the first file wraps to the last file | previous, getCurrentFile | launchFile called with file3 (last); currentFile equals file3 | port | player-context-navigation-shuffle.spec.ts |
| 34 | next() from the last file wraps to the first file | next, getCurrentFile | launchFile last called with file1 | port | player-context-navigation-shuffle.spec.ts |
| 35 | next() in shuffle mode launches a random file | next, getCurrentFile, getLaunchMode | launchRandom called; currentFile equals random file; mode Shuffle | port | player-context-navigation-shuffle.spec.ts |
| 36 | previous() in shuffle mode also launches a random file | previous, getCurrentFile, getLaunchMode | launchRandom called; currentFile equals random file; mode Shuffle | port | player-context-navigation-shuffle.spec.ts |
| 37 | A shuffle next() aligns and loads the containing directory as file context | next, getFileContext, StorageStore.alignToPlayingFile | alignToPlayingFile called with path; fileContext files/currentIndex reflect directory listing | port | player-context-navigation-shuffle.spec.ts |
| 38 | Mirrors #37 for previous() | previous, getFileContext | alignToPlayingFile called with path; fileContext matches directory | port | player-context-navigation-shuffle.spec.ts |
| 39 | A failed directory load during shuffle next() doesn't block the launch or set an error | next, getCurrentFile, getError | launchRandom still called; currentFile set; error null | port | player-context-navigation-shuffle.spec.ts |
| 40 | A failed next() launch sets error state | next, getError | error truthy | port | player-context-navigation-shuffle.spec.ts |
| 41 | A failed previous() launch sets error state | previous, getError | error truthy | port | player-context-navigation-shuffle.spec.ts |
| 42 | next()/previous() on a freshly (re)initialized device with no context resolve without throwing | next, previous | both calls resolve, no throw | port | player-context-navigation-shuffle.spec.ts |
| 43 | All per-device state accessors return signal functions | getCurrentFile, getFileContext, isLoading, getError, getStatus, getShuffleSettings, getLaunchMode, getPlayerStatus | each accessor's return type is a function | port | player-context-lifecycle.spec.ts |
| 44 | getStatus and getPlayerStatus expose the same underlying status | getStatus, getPlayerStatus | both equal Stopped initially | port | player-context-lifecycle.spec.ts |
| 45 | Querying an uninitialized device returns null for file/context/error/shuffle-settings | getCurrentFile, getFileContext, getError, getShuffleSettings | each is null | port | player-context-lifecycle.spec.ts |
| 46 | Uninitialized device reports not-loading, Stopped, Directory mode by default | isLoading, getStatus, getLaunchMode | false / Stopped / Directory | port | player-context-lifecycle.spec.ts |
| 47 | Two devices launching different files keep separate current files | launchFileWithContext, getCurrentFile | each device's currentFile equals its own launched file | port | player-context-lifecycle.spec.ts |
| 48 | Shuffle scope/filter set on one device don't affect another (service-level isolation) | setShuffleScope, setFilterMode, getShuffleSettings | each device keeps its own scope/filter | port | player-context-lifecycle.spec.ts |
| 49 | Toggling shuffle on one device doesn't change another device's mode | toggleShuffleMode, getLaunchMode | device1 Shuffle, device2 stays Directory | port | player-context-lifecycle.spec.ts |
| 50 | An error on one device doesn't leak to another device's error state | launchFileWithContext, getError | device1 error truthy, device2 error null | port | player-context-lifecycle.spec.ts |
| 51 | A subsequent successful launch clears a prior error | launchFileWithContext, getError, getCurrentFile | error becomes null; currentFile set after the successful retry | port | player-context-lifecycle.spec.ts |
| 52 | isLoading toggles true then false around a delayed launch | launchFileWithContext, isLoading | true mid-flight, false after completion | port | player-context-lifecycle.spec.ts |
| 53 | A second concurrent launch is blocked with a warning while the first wins | launchFileWithContext, getCurrentFile, isLoading, getError, IAlertService.warning | currentFile is file1; not loading; error null; warning alert shown | port | player-context-lifecycle.spec.ts |
| 54 | Launching a music file moves status Stopped→Playing | launchFileWithContext, getPlayerStatus | status Playing after launch | port | player-context-playback.spec.ts |
| 55 | Launching a non-music (game) file also results in Playing status | launchFileWithContext, getPlayerStatus | status Playing regardless of file type | port | player-context-playback.spec.ts |
| 56 | pause() then play() round-trips status correctly | pause, play, getPlayerStatus | Paused after pause(), Playing after play() | port | player-context-playback.spec.ts |
| 57 | play() from Stopped resumes playback | stop, play, getPlayerStatus | Stopped then Playing | port | player-context-playback.spec.ts |
| 58 | stop() moves Playing to Stopped | stop, getPlayerStatus | status Stopped | port | player-context-playback.spec.ts |
| 59 | Calling stop() twice keeps status Stopped | stop, getPlayerStatus | status stays Stopped | port | player-context-playback.spec.ts |
| 60 | next() while playing keeps status Playing | next, getPlayerStatus | status remains Playing | port | player-context-playback.spec.ts |
| 61 | previous() while playing keeps status Playing | previous, getPlayerStatus | status remains Playing | port | player-context-playback.spec.ts |
| 62 | next() from Stopped resumes playback | stop, next, getPlayerStatus | Stopped then Playing | port | player-context-playback.spec.ts |
| 63 | A launch→pause→play→stop→previous sequence produces the expected status at each step | launchFileWithContext, pause, play, stop, previous, getPlayerStatus | status sequence Playing, Paused, Playing, Stopped, Playing | port | player-context-playback.spec.ts |
| 64 | Switching from a music file to a game file keeps status Playing | launchFileWithContext, getPlayerStatus | status Playing after both launches | port | player-context-playback.spec.ts |
| 65 | A pause() API failure leaves status in a valid value and records an error | pause, getPlayerStatus, getError | status is one of Playing/Paused/Stopped; error truthy | port | player-context-playback.spec.ts |
| 66 | The active filter is forwarded to the random-launch API call | setFilterMode, launchRandomFile | launchRandom called with Games filter | port | player-context-navigation-shuffle.spec.ts |
| 67 | Filter is forwarded on shuffle next() | setFilterMode, next | launchRandom called with Music filter | port | player-context-navigation-shuffle.spec.ts |
| 68 | Filter is forwarded on shuffle previous() | setFilterMode, previous | launchRandom called with Images filter | port | player-context-navigation-shuffle.spec.ts |
| 69 | Changing the filter mid-session changes the filter used by the next random launch | setFilterMode, launchRandomFile | first call uses All, second uses Games after update | port | player-context-navigation-shuffle.spec.ts |
| 70 | Filter set in Directory mode survives a switch into Shuffle | setFilterMode, toggleShuffleMode, getShuffleSettings | filter unchanged after toggling | port | player-context-navigation-shuffle.spec.ts |
| 71 | Filter survives a Directory→Shuffle→Directory round-trip toggle | setFilterMode, toggleShuffleMode, getShuffleSettings | filter identical before and after round-trip | port | player-context-navigation-shuffle.spec.ts |
| 72 | Two devices keep separate filters | setFilterMode, getShuffleSettings | each device's filter matches only its own setting | port | player-context-navigation-shuffle.spec.ts |
| 73 | Launching a music file with a valid playLength creates a timer sized to that duration | launchFileWithContext, getTimerState | totalTime equals parsed ms (225000) | port | player-context-timer-lifecycle.spec.ts |
| 74 | Non-music files never get a timer | launchFileWithContext, getTimerState | timerState null | port | player-context-timer-lifecycle.spec.ts |
| 75 | An unparsable playLength falls back to a 3-minute timer and logs a warning | launchFileWithContext, getTimerState | totalTime 180000; console.warn mentions invalid format | port | player-context-timer-lifecycle.spec.ts |
| 76 | An empty playLength also falls back to 3 minutes with a warning | launchFileWithContext, getTimerState | totalTime 180000; warning mentions empty playLength | port | player-context-timer-lifecycle.spec.ts |
| 77 | The running timer's currentTime advances over real elapsed time | getTimerState | currentTime increases between two reads a second apart | port | player-context-timer-lifecycle.spec.ts |
| 78 | An H:MM:SS playLength parses into the correct millisecond duration | launchFileWithContext, getTimerState | totalTime 5025000 for '1:23:45' | port | player-context-timer-lifecycle.spec.ts |
| 79 | pause() stops the running timer | pause, getTimerState | isRunning false | port | player-context-timer-lifecycle.spec.ts |
| 80 | play() after pause resumes the timer | pause, play, getTimerState | isRunning true | port | player-context-timer-lifecycle.spec.ts |
| 81 | stop() resets the timer's currentTime to 0 and stops it | stop, getTimerState | currentTime 0; isRunning false | port | player-context-timer-lifecycle.spec.ts |
| 82 | currentTime is frozen while paused | pause, getTimerState | currentTime unchanged across a wait while paused | port | player-context-timer-lifecycle.spec.ts |
| 83 | Playback controls on a non-music file leave the (nonexistent) timer null | pause, play, stop, getTimerState | timerState stays null | port | player-context-timer-lifecycle.spec.ts |
| 84 | next() into another music file creates a fresh timer sized to the new file | next, getTimerState | totalTime updates to new file's duration; currentTime near 0 | port | player-context-timer-lifecycle.spec.ts |
| 85 | Navigating from music to a non-music file destroys the timer | next, getTimerState | timerState becomes null | port | player-context-timer-lifecycle.spec.ts |
| 86 | Navigating from non-music to music creates a timer for the destination | next, getTimerState | timerState non-null with correct totalTime | port | player-context-timer-lifecycle.spec.ts |
| 87 | When the timer completes in Directory mode, the service auto-launches the next file | launchFileWithContext, getCurrentFile | launchFile called twice; currentFile becomes the second file | port | player-context-timer-progression.spec.ts |
| 88 | Timer completion in Shuffle mode triggers a random launch instead | launchFileWithContext, getCurrentFile | launchRandom called once; currentFile becomes the random file | port | player-context-timer-progression.spec.ts |
| 89 | The file that auto-progression lands on gets its own timer | getTimerState | totalTime reflects the second file's duration; currentTime reset | port | player-context-timer-progression.spec.ts |
| 90 | Timer completion chains across three consecutive files | getCurrentFile | current file advances music1→music2→music3; launchFile called 3 times | port | player-context-timer-progression.spec.ts |
| 91 | A paused timer never triggers auto-progression | pause, getCurrentFile | launchFile called only once even after the completion window passes | port | player-context-timer-progression.spec.ts |
| 92 | A launch attempt made while one is still in flight is rejected with a warning | launchFileWithContext, getCurrentFile, IAlertService.warning | warning shown; only one launchFile call; first file wins once it resolves | port | player-context-timer-progression.spec.ts |
| 93 | A failed launch never creates a timer | launchFileWithContext, getTimerState | timerState null | port | player-context-timer-progression.spec.ts |
| 94 | A failed random launch never creates a timer and sets error | launchRandomFile, getTimerState, getError | timerState null; error truthy | port | player-context-timer-progression.spec.ts |
| 95 | A failed next() leaves the prior file's timer untouched and sets error | next, getTimerState, getError | timer (if present) still shows first file's totalTime; error truthy | port | player-context-timer-progression.spec.ts |
| 96 | Mirrors #95 for previous() | previous, getTimerState, getError | timer unchanged from first file; error truthy | port | player-context-timer-progression.spec.ts |
| 97 | A failed launch still records the attempted file as current, with the error message | launchFileWithContext, getCurrentFile, getError | currentFile matches attempted file; error contains failure message | port | player-context-timer-progression.spec.ts |
| 98 | A failed launch still populates the file context from the given directory | launchFileWithContext, getFileContext | fileContext.files length/currentIndex/directoryPath correct | port | player-context-timer-progression.spec.ts |
| 99 | A second, failing launch tears down the timer left by the first successful one | launchFileWithContext, getTimerState | timerState null after the failing launch | port | player-context-timer-progression.spec.ts |
| 100 | A subsequent successful launch after a failure clears the error and creates a new timer | launchFileWithContext, getCurrentFile, getError, getTimerState | currentFile updates; error null; timer created with new totalTime | port | player-context-timer-progression.spec.ts |
| 101 | A failed shuffle-mode launch keeps the directory context available for the next attempt | launchFileWithContext, getFileContext, launchRandomFile, getCurrentFile | fileContext retains files/path after failure; subsequent random launch succeeds | port | player-context-timer-progression.spec.ts |
| 102 | Two devices' timers reflect their own file durations | getTimerState | device1 totalTime 180000, device2 300000 | port | player-context-timer-progression.spec.ts |
| 103 | Removing one device clears only its timer | removePlayer, getTimerState | removed device's timer null; other device's timer intact | port | player-context-timer-progression.spec.ts |
| 104 | Pausing one device's timer doesn't pause another's | pause, getTimerState | device1 isRunning false, device2 isRunning true | port | player-context-timer-progression.spec.ts |
| 105 | Rapid pause/play/pause/play/stop leaves the timer in a clean stopped state | pause, play, stop, getTimerState | currentTime 0; isRunning false | port | player-context-timer-lifecycle.spec.ts |
| 106 | Timer query for an unknown device returns null | getTimerState | null | port | player-context-timer-lifecycle.spec.ts |
| 107 | A freshly initialized device has no timer | getTimerState | null | port | player-context-timer-lifecycle.spec.ts |
| 108 | pause/play/stop never throw on a non-music file | pause, play, stop | all three resolve without throwing | port | player-context-timer-lifecycle.spec.ts |
| 109 | getTimerState reflects the underlying store's timer state after creation | getTimerState | non-null with correct totalTime | port | player-context-timer-lifecycle.spec.ts |
| 110 | getTimerState tracks isRunning/currentTime correctly across launch→pause→stop | pause, stop, getTimerState | isRunning true→false; currentTime 0 and isRunning false after stop | port | player-context-timer-lifecycle.spec.ts |
| 111 | An incompatible launchFile result auto-advances to the next compatible file, then times it | launchFileWithContext, getCurrentFile, getError, getTimerState | currentFile.isCompatible true after auto-advance; error null; timer created | port | player-context-incompatible-sync.spec.ts |
| 112 | An incompatible random-launch result still loads directory context, no timer/error | launchRandomFile, getCurrentFile, getError, getTimerState | alignToPlayingFile called; currentFile.isCompatible false; error null; timer null | port | player-context-incompatible-sync.spec.ts |
| 113 | Navigating next() onto an incompatible file clears the timer without setting an error | next, getCurrentFile, getError, getTimerState | currentFile is the incompatible file; error null; timer null | port | player-context-incompatible-sync.spec.ts |
| 114 | Mirrors #113 for previous() | previous, getCurrentFile, getError, getTimerState | same as #113 | port | player-context-incompatible-sync.spec.ts |
| 115 | Manually navigating next() off an incompatible file recovers to a compatible one with a timer | launchFileWithContext, next, getError, getCurrentFile, getTimerState | error null throughout; currentFile becomes compatible; timer created | port | player-context-incompatible-sync.spec.ts |
| 116 | A freshly initialized device has no play history | getPlayHistory | null | port | player-context-history-recording.spec.ts |
| 117 | History position defaults to -1 (end marker) with no history | getCurrentHistoryPosition | -1 | port | player-context-history-recording.spec.ts |
| 118 | canNavigateBackwardInHistory is false with no history | canNavigateBackwardInHistory | false | port | player-context-history-recording.spec.ts |
| 119 | canNavigateForwardInHistory is false with no history | canNavigateForwardInHistory | false | port | player-context-history-recording.spec.ts |
| 120 | A successful directory launch appends a history entry at end position | launchFileWithContext, getPlayHistory | 1 entry matching launched file; currentPosition -1 | port | player-context-history-recording.spec.ts |
| 121 | A successful random launch also records a history entry | launchRandomFile, getPlayHistory | 1 entry matching random file | port | player-context-history-recording.spec.ts |
| 122 | A failed launch does not create a history entry | launchFileWithContext, getPlayHistory | history stays null | port | player-context-history-recording.spec.ts |
| 123 | An incompatible file launch does not create a history entry | launchFileWithContext, getPlayHistory | history stays null | port | player-context-history-recording.spec.ts |
| 124 | A compatible launch following an incompatible one records exactly one entry | launchFileWithContext, getPlayHistory | null after incompatible; 1 entry (compatible file) after | port | player-context-history-recording.spec.ts |
| 125 | Three consecutive incompatible launches record nothing | launchFileWithContext, getPlayHistory | history stays null throughout | port | player-context-history-recording.spec.ts |
| 126 | History count grows only on compatible launches across an alternating sequence | launchFileWithContext, getPlayHistory | entry count progresses 1,1,2,2,3 with correct names in order | port | player-context-history-recording.spec.ts |
| 127 | An incompatible launch after two compatible ones leaves existing entries untouched | launchFileWithContext, getPlayHistory | entries unchanged (same names) before/after the incompatible launch | port | player-context-history-recording.spec.ts |
| 128 | A failed launch doesn't crash history recording; service still works on next success | launchFileWithContext, getPlayHistory | history null after failure; 1 entry after subsequent success | port | player-context-history-recording.spec.ts |
| 129 | next() from an existing file appends a new history entry | next, getPlayHistory | 2 entries, in launch order | port | player-context-history-recording.spec.ts |
| 130 | previous() also appends a new history entry (browsing, not history-navigation) | previous, getPlayHistory | 2 entries in order launched | port | player-context-history-recording.spec.ts |
| 131 | Navigating next() in shuffle mode records history too | toggleShuffleMode, next, getPlayHistory | 2 entries | port | player-context-history-recording.spec.ts |
| 132 | Re-launching the same file back-to-back doesn't add a second entry | launchFileWithContext, getPlayHistory | 1 entry after two identical launches | port | player-context-history-recording.spec.ts |
| 133 | Replaying a file after an intervening different file does add a new entry | launchFileWithContext, getPlayHistory | 3 entries: file1, file2, file1 | port | player-context-history-recording.spec.ts |
| 134 | History grows with each distinct launch (smoke test standing in for the 1000-entry cap) | launchFileWithContext, getPlayHistory | 3 entries after 3 launches; position -1 (note: doesn't exercise the cap itself) | port | player-context-history-recording.spec.ts |
| 135 | A history entry captures the file's name/path/parentPath/compatibility/timestamp | getPlayHistory | entry fields match the launched file; timestamp > 0 | port | player-context-history-recording.spec.ts |
| 136 | A history entry's storageKey encodes the device and storage type | getPlayHistory | storageKey truthy, contains deviceId and 'SD' | port | player-context-history-recording.spec.ts |
| 137 | clearHistory() empties an existing history | clearHistory, getPlayHistory | history null after clear | port | player-context-history-recording.spec.ts |
| 138 | A launch after clearHistory() starts a fresh single-entry history | clearHistory, launchFileWithContext, getPlayHistory | 1 entry matching the new launch | port | player-context-history-recording.spec.ts |
| 139 | Clearing an already-null history is a no-op that doesn't throw | clearHistory, getPlayHistory | no throw; history stays null | port | player-context-history-recording.spec.ts |
| 140 | Across 5 launches alternating compatible/incompatible, only the 3 compatible ones appear, in order (Behavior A) | launchFileWithContext, getPlayHistory | 3 entries named game1/game3/game5 | port | player-context-history-timeline.spec.ts |
| 141 | Recorded entries' timestamps are strictly non-decreasing and unique (Behavior B) | getPlayHistory | 3 entries; timestamps ascending and unique | port | player-context-history-timeline.spec.ts |
| 142 | An incompatible file between two compatible ones is skipped; nav flags reflect remainder (Behavior C) | getPlayHistory, canNavigateBackwardInHistory, canNavigateForwardInHistory | 2 entries (track1, track3); canNavigateBackward true, canNavigateForward false | port | player-context-history-timeline.spec.ts |
| 143 | Across 6 files (2 incompatible), the 4 compatible entries are ordered by timestamp (Behavior D) | getPlayHistory | 4 entries in ascending timestamp/launch order | port | player-context-history-timeline.spec.ts |
| 144 | An incompatible file is excluded from history regardless of Shuffle/Directory/Search mode (Behavior E) | launchFileWithContext, getPlayHistory | history stays null across all 3 incompatible-mode launches; 1 all-compatible entry after the compatible launch | port | player-context-history-timeline.spec.ts |
| 145 | Removing a device clears its history | removePlayer, getPlayHistory | history null after removal | port | player-context-history-recording.spec.ts |
| 146 | Re-initializing a removed device starts a fresh history on next launch | removePlayer, initializePlayer, launchFileWithContext, getPlayHistory | 1 entry for the new launch | port | player-context-history-recording.spec.ts |
| 147 | Two devices' histories track only their own launches | launchFileWithContext, getPlayHistory | each device shows only its own file | port | player-context-history-recording.spec.ts |
| 148 | Clearing one device's history leaves another device's history intact | clearHistory, getPlayHistory | device1 null, device2 still 1 entry | port | player-context-history-recording.spec.ts |
| 149 | After one launch, position is -1 (at end) | getCurrentHistoryPosition | -1 | port | player-context-history-recording.spec.ts |
| 150 | With entries and at end position, backward navigation is possible | canNavigateBackwardInHistory | true | port | player-context-history-recording.spec.ts |
| 151 | At end position there's nothing to navigate forward to | canNavigateForwardInHistory | false | port | player-context-history-recording.spec.ts |

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
| 171 | launchFileWithContext still sets current file/name normally when the handler runs | launchFileWithContext, getCurrentFile | currentFile defined with expected name; launchFile called | port | player-context-auto-advancement-behavior.spec.ts |
| 172 | handleIncompatibleFile fires after a random launch completes | launchRandomFile (trigger only) | handleIncompatibleFile spy called with deviceId | drop — assertion is on a private spy only | — |
| 173 | handleIncompatibleFile fires only after directory context loading completes (call-order) | launchRandomFile (trigger only) | navigateSpy (public) called before private handleIncompatibleFile spy | drop — core assertion is private-spy call-order, not observable behavior | — |
| 174 | launchRandomFile still sets current file/name normally when the handler runs | launchRandomFile, getCurrentFile | currentFile defined with expected name; launchRandom called | port | player-context-auto-advancement-behavior.spec.ts |
| 175 | An incompatible shuffle launch retries via launchRandomFile until a compatible file lands as current | launchFileWithContext, getCurrentFile | launchRandom called once; currentFile becomes the compatible file | port | player-context-auto-advancement-behavior.spec.ts |
| 176 | An incompatible directory launch auto-advances to the next compatible file | launchFileWithContext, getCurrentFile | launchFile called twice; currentFile is the compatible file | port | player-context-auto-advancement-behavior.spec.ts |
| 177 | Auto-advancement wraps to the first file when the incompatible file is last | launchFileWithContext, getCurrentFile | currentFile becomes the first (compatible) file | port | player-context-auto-advancement-behavior.spec.ts |
| 178 | When every directory file is incompatible, the service warns and falls back to a random launch | launchFileWithContext, IAlertService.warning, launchRandomFile | warning shown with "all incompatible" message; launchRandom called once | port | player-context-auto-advancement-behavior.spec.ts |
| 179 | A compatible launch never triggers the advancement handler's effects | launchFileWithContext, getCurrentFile | currentFile stays the compatible file launched | port | player-context-auto-advancement-behavior.spec.ts |
| 180 | A random launch that returns an incompatible file still completes successfully (Playing, no error) | launchRandomFile, getStatus, getCurrentFile, getLaunchMode, getError, isLoading | status Playing; currentFile.isCompatible false; mode Shuffle; error null; not loading | port | player-context-auto-advancement-navigation.spec.ts |
| 181 | An incompatible random launch still sets Shuffle mode with an empty file context | launchRandomFile, getLaunchMode, getFileContext | mode Shuffle; fileContext matches empty-files shuffle shape | port | player-context-auto-advancement-navigation.spec.ts |
| 182 | A directory launch of an incompatible file completes successfully | launchFileWithContext, getStatus, getCurrentFile, getLaunchMode, getError, isLoading | status Playing; currentFile.isCompatible false; mode Directory; error null; not loading | port | player-context-auto-advancement-navigation.spec.ts |
| 183 | An incompatible directory launch still populates file context correctly | launchFileWithContext, getFileContext | directoryPath/files/currentIndex correct | port | player-context-auto-advancement-navigation.spec.ts |
| 184 | The backend's incompatible verdict overwrites the launched file's compatibility inside file context | launchFileWithContext, getFileContext | matching file in fileContext.files has isCompatible false | port | player-context-auto-advancement-navigation.spec.ts |
| 185 | Marking one file incompatible doesn't change compatibility of sibling files in context | launchFileWithContext, getFileContext | target file false; other files retain original compatibility | port | player-context-auto-advancement-navigation.spec.ts |
| 186 | Marking works correctly when the incompatible file sits in the middle of the context array | launchFileWithContext, getFileContext | currentIndex 1; files[1] incompatible; files[0]/[2] unaffected | port | player-context-auto-advancement-navigation.spec.ts |
| 187 | next() then previous() through a mixed compatible/incompatible array returns to the starting file | next, previous, getCurrentFile | file name sequence game1→game4→game1 | port | player-context-auto-advancement-navigation.spec.ts |
| 188 | The same incompatible files are skipped symmetrically going forward and backward | next, previous, getCurrentFile | file sequence file1→file3→file5→file3→file1 | port | player-context-auto-advancement-navigation.spec.ts |
| 189 | From the only compatible file, both next() and previous() wrap through incompatible files and land back on it | next, previous, getCurrentFile | current file stays 'good.prg' after both directions | port | player-context-auto-advancement-navigation.spec.ts |
| 190 | A longer alternating array navigates correctly forward and backward with varying skip counts | next, previous, getCurrentFile | file name sequence matches expected compatible files at each step | port | player-context-auto-advancement-navigation.spec.ts |
| 191 | Overriding PLAYER_INCOMPATIBLE_RETRY_DELAY_MS makes the directory-mode retry fire on the next macrotask instead of after 1000ms | launchFileWithContext, getCurrentFile | launchFile called twice without needing timer advancement; currentFile becomes the compatible file | port | player-context-auto-advancement-navigation.spec.ts |

## 3. player-context-history.service.spec.ts (33 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 192 | previous() from the end-of-history marker launches the most recent entry via launchFile, not random | previous, getCurrentHistoryPosition, getCurrentFile | position becomes 2; launchFile called with file3; launchRandom not called; currentFile is file3 | port | player-context-history-back-forward.spec.ts |
| 193 | previous() from the oldest entry wraps to the newest entry without adding a new entry | previous, getCurrentHistoryPosition, getPlayHistory | position wraps 0→2; entry count stays 3; currentFile is file3 | port | player-context-history-back-forward.spec.ts |
| 194 | previous() with cleared history falls back to a random launch | clearHistory, previous, getCurrentFile | launchRandom called; currentFile is the random file | port | player-context-history-back-forward.spec.ts |
| 195 | Backward history navigation doesn't grow the history | previous, getPlayHistory | entry count unchanged (3) after two backward navigations | port | player-context-history-back-forward.spec.ts |
| 196 | previous() in Directory mode uses ordinary file-context navigation, not history | toggleShuffleMode, launchFileWithContext, previous, getCurrentFile, getLaunchMode | launchFile called with the directory-previous file; mode stays Directory | port | player-context-history-back-forward.spec.ts |
| 197 | Backward history navigation re-aligns and loads the file context for the target file's directory | previous, StorageStore.alignToPlayingFile, getFileContext | alignToPlayingFile called with directory path; fileContext reflects it with correct currentIndex | port | player-context-history-back-forward.spec.ts |
| 198 | Navigating backward to a music history entry creates a running timer for it | previous, getTimerState | timerState non-null, isRunning true, totalTime > 0 | port | player-context-history-back-forward.spec.ts |
| 199 | next() from a middle history position launches the following entry via launchFile | next, getCurrentFile, getPlayHistory | launchFile called with file3; launchRandom not called; position becomes 2 | port | player-context-history-back-forward.spec.ts |
| 200 | next() once at the newest entry launches a brand-new random file instead of reusing history | next, getCurrentFile | launchRandom called; launchFile call count unchanged from the prior forward nav | port | player-context-history-back-forward.spec.ts |
| 201 | Forward history navigation doesn't add a new entry | next, getPlayHistory | entry count stays 3; position becomes 2 | port | player-context-history-back-forward.spec.ts |
| 202 | A random launch triggered from the end of history appends a new entry | next, getPlayHistory | entry count 3→4; new entry at end (position -1) matches the new file | port | player-context-history-back-forward.spec.ts |
| 203 | A brand-new random launch appends after existing entries rather than truncating forward history | next, getPlayHistory | entries grow to 4 with the new file appended at the end | port | player-context-history-back-forward.spec.ts |
| 204 | next() in Directory mode uses file-context navigation, unaffected by history position | toggleShuffleMode, launchFileWithContext, next, getCurrentFile, getLaunchMode | launchFile called with the directory-next file; mode stays Directory | port | player-context-history-back-forward.spec.ts |
| 205 | Forward history navigation also re-aligns and loads file context for the target entry's directory | next, StorageStore.alignToPlayingFile, getFileContext | alignToPlayingFile called with path; fileContext matches | port | player-context-history-back-forward.spec.ts |
| 206 | With one history entry, previous() lands on it and next() launches a new random file | previous, next, getPlayHistory, getCurrentFile | position sequence -1→0→-1; entry count 1 then 2 | port | player-context-history-edge-cases.spec.ts |
| 207 | previous() with no history is a safe no-op; next() with no history behaves like a normal new launch | previous, next, getPlayHistory | previous() resolves without throw; next() creates the first entry | port | player-context-history-edge-cases.spec.ts |
| 208 | A launchFile failure during backward navigation leaves history position unchanged and sets an error | previous, getPlayHistory, getError, getTimerState | position stays -1; error truthy; timer null | port | player-context-history-edge-cases.spec.ts |
| 209 | Mirrors #208 for forward navigation | next, getPlayHistory, getError | position stays at 1; error truthy | port | player-context-history-edge-cases.spec.ts |
| 210 | Navigating one device's history doesn't affect another device's history | previous, getPlayHistory | device1 position changes; device2 history unchanged (deep-equal to prior snapshot) | port | player-context-history-edge-cases.spec.ts |
| 211 | A failed alignToPlayingFile during backward navigation doesn't block the file launch itself | previous, getCurrentFile, getPlayHistory | currentFile updates to target file; history position updates despite the directory-load rejection | port | player-context-history-edge-cases.spec.ts |
| 212 | A rapid back/forward/back/forward/back sequence over a 5-entry history ends at the expected state | previous, next, getPlayHistory, getCurrentFile | final position 4; currentFile matches files[4] | port | player-context-history-edge-cases.spec.ts |
| 213 | Toggling between shuffle and directory mode doesn't alter existing history | toggleShuffleMode, getPlayHistory, previous | history entries equal (deep) across mode switches; position updates correctly on subsequent previous() | port | player-context-history-edge-cases.spec.ts |
| 214 | An end-to-end shuffle session (5 launches, 3 back, 2 forward, 1 new) tracks position/file at every step | next, previous, getPlayHistory, getCurrentFile | position and current file name checked after every step; final state has 6 entries at position -1 | port | player-context-history-edge-cases.spec.ts |
| 215 | A browser-style session (launch 4, back twice, forward once, new launch) appends rather than discards forward history | next, previous, getPlayHistory | final entry count 5 with the new file appended at position -1 | port | player-context-history-edge-cases.spec.ts |
| 216 | Switching between shuffle and directory mode mid-session keeps history growing and navigable | toggleShuffleMode, next, getPlayHistory, getCurrentFile, canNavigateBackwardInHistory | history length non-decreasing across mode switches; canNavigateBackward true at the end | port | player-context-history-edge-cases.spec.ts |
| 217 | Backward navigation through 3 music entries keeps history position and current file in sync at each step | previous, getPlayHistory, getCurrentFile | position 2→1→0 with matching file names at each step | port | player-context-history-edge-cases.spec.ts |
| 218 | A 10-entry history navigated back 5, forward 3, back 2 ends at the correct position with matching current file | previous, next, getPlayHistory, getCurrentFile | position sequence 5→8→6; currentFile name matches history.entries at each stop | port | player-context-history-edge-cases.spec.ts |
| 219 | History view visibility defaults to hidden | isHistoryViewVisible | false | port | player-context-history-view.spec.ts |
| 220 | Toggling once shows the history view | toggleHistoryView, isHistoryViewVisible | true | port | player-context-history-view.spec.ts |
| 221 | Toggling twice hides it again | toggleHistoryView, isHistoryViewVisible | true then false | port | player-context-history-view.spec.ts |
| 222 | History view visibility is tracked per device | toggleHistoryView, isHistoryViewVisible | toggling device1 doesn't affect device2 and vice versa | port | player-context-history-view.spec.ts |
| 223 | Navigating to a specific history position doesn't hide an open history view, and doesn't add a new entry | toggleHistoryView, navigateToHistoryPosition, isHistoryViewVisible, getCurrentHistoryPosition, getPlayHistory | view stays visible; position becomes 0; currentFile matches; entry count unchanged (3) | port | player-context-history-view.spec.ts |
| 224 | Launching a new file via launchFileWithContext closes an open history view | toggleHistoryView, launchFileWithContext, isHistoryViewVisible | view visible before launch, hidden after | port | player-context-history-view.spec.ts |

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
| 231 | A directory launch of an incompatible file marks it false in fileContext while siblings stay compatible | launchFileWithContext, getFileContext | fileContext 3 files; matched file isCompatible false; sibling file1 stays true | port | player-context-incompatible-marking.spec.ts |
| 232 | Marking a rich single-file context as incompatible doesn't corrupt state after auto-advancement clears it | launchFileWithContext, getFileContext | fileContext non-null; files.length >= 0 after auto-advance finds nothing compatible | port | player-context-incompatible-marking.spec.ts |
| 233 | A random launch of an incompatible file marks it false in the resulting directory-loaded fileContext | launchRandomFile, getFileContext | fileContext 3 files; matched file false; others true | port | player-context-incompatible-marking.spec.ts |
| 234 | The backend's incompatible verdict overrides a directory listing that claimed the file was compatible | launchRandomFile, getFileContext | fileContext.files[0].isCompatible false | port | player-context-incompatible-marking.spec.ts |
| 235 | Directory-launch and random-launch marking produce equivalent fileContext shapes for the same file | launchFileWithContext, launchRandomFile, getFileContext | both contexts have 3 files; marked file identical (isCompatible/name/path) between scenarios | port | player-context-incompatible-marking.spec.ts |
| 236 | Marking correctly matches a file path containing spaces/parentheses in both launch types | launchFileWithContext, launchRandomFile, getFileContext | both scenarios mark the special-path file false; sibling file defined/untouched | port | player-context-incompatible-marking.spec.ts |
| 237 | A launched file absent from the directory listing produces an empty fileContext identically for both launch types | launchFileWithContext, launchRandomFile, getFileContext | both contexts have 0 files | port | player-context-incompatible-marking.spec.ts |
| 238 | A backend response with no isCompatible field defaults to compatible identically in both launch types | launchFileWithContext, launchRandomFile, getFileContext | both contexts' first file isCompatible true | port | player-context-incompatible-marking.spec.ts |
| 239 | An explicit backend isCompatible:true wins on directory launch; random launch doesn't rewrite a stale directory false | launchFileWithContext, launchRandomFile, getFileContext | directory-launch context true; random-launch context still shows the directory's stale false value | port | player-context-incompatible-marking.spec.ts |
| 240 | The original Phase 1 directory-marking behavior still holds after later changes (regression) | launchFileWithContext, getFileContext | 3 files; marked file false; file1 stays true; file2 still present | port | player-context-incompatible-marking.spec.ts |
| 241 | Alternating directory/random launches of different incompatible files don't leave stale or duplicate marks | launchFileWithContext, launchRandomFile, getFileContext | each launch's fileContext shows the correct file marked false; final file set has no duplicate paths | port | player-context-incompatible-marking.spec.ts |
| 242 | A random launch of an incompatible file syncs the mark back to StorageStore | launchRandomFile, StorageStore.updateFileCompatibility | updateFileCompatibility called once with deviceId/storageType/filePath/isCompatible:false | port | player-context-incompatible-sync.spec.ts |
| 243 | The storage sync call derives storageType from the device's storage key | launchRandomFile, StorageStore.updateFileCompatibility | call's storageType is Sd | port | player-context-incompatible-sync.spec.ts |
| 244 | A compatible random launch never syncs to StorageStore | launchRandomFile, StorageStore.updateFileCompatibility | not called | port | player-context-incompatible-sync.spec.ts |
| 245 | An undefined isCompatible result also skips the storage sync | launchRandomFile, StorageStore.updateFileCompatibility | not called | port | player-context-incompatible-sync.spec.ts |
| 246 | Storage sync happens after the player's fileContext is updated with the incompatible mark | launchRandomFile, getFileContext, StorageStore.updateFileCompatibility | fileContext marked false; updateFileCompatibility called once | port | player-context-incompatible-sync.spec.ts |
| 247 | Each of two sequential incompatible random launches syncs its own file to StorageStore | launchRandomFile, StorageStore.updateFileCompatibility | called with bad1 then bad2; called twice total | port | player-context-incompatible-sync.spec.ts |

## 5. player-context-settings.service.spec.ts (14 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 248 | initializePlayer reads the startup filter from SettingsStore and applies it | initializePlayer, PlayerStore.initializePlayer | called with defaultFilter Games, playTimerEnabled true | port | player-context-settings.spec.ts |
| 249 | Null settings fall back to the All filter and disabled timer | initializePlayer | called with defaultFilter All, playTimerEnabled false | port | player-context-settings.spec.ts |
| 250 | Missing playerSettings sub-object also falls back to All/disabled | initializePlayer | called with defaultFilter All, playTimerEnabled false | port | player-context-settings.spec.ts |
| 251 | The Music startup filter is applied | initializePlayer | called with defaultFilter Music, playTimerEnabled true | port | player-context-settings.spec.ts |
| 252 | The Hex startup filter is applied | initializePlayer | called with defaultFilter Hex, playTimerEnabled true | merge → #251 (identical shape besides the enum literal; collapses into one parameterized filter-value test) | player-context-settings.spec.ts |
| 253 | The Images startup filter is applied | initializePlayer | called with defaultFilter Images, playTimerEnabled true | merge → #251 (same reason as #252) | player-context-settings.spec.ts |
| 254 | initializePlayer applies filter and timer setting together in one store call | initializePlayer | called exactly once with All/true | port | player-context-settings.spec.ts |
| 255 | Two devices each get their own initializePlayer call carrying the same settings-derived filter | initializePlayer | called twice, once per deviceId, both with Games/true | port | player-context-settings.spec.ts |
| 256 | Re-initializing an already-initialized device doesn't reset a filter the user changed manually | initializePlayer, PlayerStore.updateShuffleSettings | second call still reflects original Games filter; updateShuffleSettings only called for the manual change | port | player-context-settings.spec.ts |
| 257 | A true playTimerEnabled setting is passed through to store initialization | initializePlayer | called with playTimerEnabled true | port | player-context-settings.spec.ts |
| 258 | A false playTimerEnabled setting is passed through as false | initializePlayer | called with playTimerEnabled false | port | player-context-settings.spec.ts |
| 259 | Null settings default the timer to disabled | initializePlayer | playTimerEnabled false | port | player-context-settings.spec.ts |
| 260 | Missing playerSettings also defaults the timer to disabled | initializePlayer | playTimerEnabled false | port | player-context-settings.spec.ts |
| 261 | Two devices each receive the same settings-derived timer flag via their own initializePlayer call | initializePlayer | called twice, once per device, both with playTimerEnabled true | port | player-context-settings.spec.ts |

## 6. player-context-playTimer.service.spec.ts (21 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 262 | A newly initialized device gets a default (disabled, DEFAULT_TIMER_MS) custom timer config | initializePlayer, getPlayTimerConfig | enabled false; durationMs DEFAULT_TIMER_MS | port | player-context-custom-play-timer.spec.ts |
| 263 | The default timer config survives a subsequent file launch | launchFileWithContext, getPlayTimerConfig | config unchanged (disabled, default duration) after launch | port | player-context-custom-play-timer.spec.ts |
| 264 | setCustomTimer enables the timer and sets its duration | setCustomTimer, getPlayTimerConfig | enabled true, durationMs 30000 | port | player-context-custom-play-timer.spec.ts |
| 265 | Calling setCustomTimer again while enabled changes only the duration | setCustomTimer, getPlayTimerConfig | durationMs updates to 60000, still enabled | port | player-context-custom-play-timer.spec.ts |
| 266 | Disabling the custom timer keeps the last duration but flips enabled off | setCustomTimer, getPlayTimerConfig | enabled false; durationMs persists (30000) | port | player-context-custom-play-timer.spec.ts |
| 267 | A single setCustomTimer call updates both enabled and duration at once | setCustomTimer, getPlayTimerConfig | enabled true, durationMs 45000 | port | player-context-custom-play-timer.spec.ts |
| 268 | Updating the custom timer config doesn't disturb the currently playing file or status | setCustomTimer, getCurrentFile, getPlayerStatus | file name unchanged; status stays Playing | port | player-context-custom-play-timer.spec.ts |
| 269 | For a music file, metadata playLength wins over an enabled custom timer | setCustomTimer, launchFileWithContext, getTimerState | totalTime 225000 (metadata), not the custom 30000 | port | player-context-custom-play-timer.spec.ts |
| 270 | A non-timer file type (game) gets the custom-timer duration when enabled | setCustomTimer, launchFileWithContext, getTimerState | totalTime 60000 | port | player-context-custom-play-timer.spec.ts |
| 271 | Image files also receive the custom-timer duration when enabled | setCustomTimer, launchFileWithContext, getTimerState | totalTime 10000 | port | player-context-custom-play-timer.spec.ts |
| 272 | Hex files are excluded from timers regardless of the custom timer setting | setCustomTimer, launchFileWithContext, getTimerState | timerState null | port | player-context-custom-play-timer.spec.ts |
| 273 | With the custom timer disabled, music files still time via metadata | launchFileWithContext, getTimerState | totalTime 225000 | port | player-context-custom-play-timer.spec.ts |
| 274 | Game files get no timer when the custom timer is off | launchFileWithContext, getTimerState | timerState null | port | player-context-custom-play-timer.spec.ts |
| 275 | Image files also get no timer when the custom timer is off | launchFileWithContext, getTimerState | timerState null | port | player-context-custom-play-timer.spec.ts |
| 276 | Enabling the custom timer mid-session applies it to the next non-timer-file launch | setCustomTimer, launchFileWithContext, getTimerState | no timer before enabling; totalTime 20000 after enabling and relaunching | port | player-context-custom-play-timer.spec.ts |
| 277 | Disabling the custom timer mid-session removes it from the next non-timer-file launch | setCustomTimer, launchFileWithContext, getTimerState | timer present (15000) while enabled; null after disabling and relaunching | port | player-context-custom-play-timer.spec.ts |
| 278 | A set custom duration applies consistently across successive launches | setCustomTimer, launchFileWithContext, getTimerState | totalTime 25000 for both launches | port | player-context-custom-play-timer.spec.ts |
| 279 | Updating the custom duration mid-session affects only the following launch | setCustomTimer, launchFileWithContext, getTimerState | 30000 then 5000 after the update | port | player-context-custom-play-timer.spec.ts |
| 280 | Querying config for an unknown device returns null | getPlayTimerConfig | null | port | player-context-custom-play-timer.spec.ts |
| 281 | A newly initialized device has a default config available | getPlayTimerConfig | enabled false; durationMs DEFAULT_TIMER_MS | port | player-context-custom-play-timer.spec.ts |
| 282 | The same signal instance reflects config changes made via setCustomTimer | getPlayTimerConfig, setCustomTimer | signal value updates from disabled to enabled/50000 in place | port | player-context-custom-play-timer.spec.ts |

## 7. player-context-loading.service.spec.ts (13 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 283 | isSlowLoading is false with no devices | isSlowLoading | false | port | player-context-loading.spec.ts |
| 284 | isSlowLoading stays false for idle devices | initializePlayer, isSlowLoading | false | port | player-context-loading.spec.ts |
| 285 | isSlowLoading() returns a stable, memoized signal | isSlowLoading | two calls return the same reference | port | player-context-loading.spec.ts |
| 286 | A device loading past the 2s threshold flips the global slow-loading signal true | isSlowLoading | signal true after the delay observable resolves | port | player-context-loading.spec.ts |
| 287 | Loading that finishes inside the 2-second window never trips the slow-loading signal | isSlowLoading | stays false throughout and after completion | port | player-context-loading.spec.ts |
| 288 | Completing a slow load flips the signal back to false immediately | isSlowLoading | true while loading, false right after completion | port | player-context-loading.spec.ts |
| 289 | The global signal is true if any one of several devices is slow-loading | isSlowLoading | true once device2 crosses the threshold | port | player-context-loading.spec.ts |
| 290 | The signal returns to false only once every loading device finishes | isSlowLoading | true while both loading, false once both complete | port | player-context-loading.spec.ts |
| 291 | Removing one slow-loading device while another remains loading keeps the signal true until that one also stops | removePlayer, isSlowLoading | true after removal (device2 still loading); false once device2 stops | port | player-context-loading.spec.ts |
| 292 | isSlowLoading is safe to call with no devices at all | isSlowLoading | false | port | player-context-loading.spec.ts |
| 293 | Many short back-to-back loading spans that individually stay under 2s never trip the signal | isSlowLoading | false after 10 rapid 150ms load/50ms-gap cycles | port | player-context-loading.spec.ts |
| 294 | A real launchFileWithContext call that takes over 2s trips the slow-loading signal, then clears | launchFileWithContext, isSlowLoading | true mid-launch, false after the launch promise resolves | port | player-context-loading.spec.ts |
| 295 | A real launch under 2 seconds never trips the signal | launchFileWithContext, isSlowLoading | false even after waiting past the 2-second mark | port | player-context-loading.spec.ts |

## 8. player-context-favorite.service.spec.ts (7 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 296 | Marking a file favorite updates both the current-file signal and the matching entry in file context | updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | currentFile.file.isFavorite true; matching context entry also true | port | player-context-favorite.spec.ts |
| 297 | Marking a favorite updates every context entry sharing that file's path | updateCurrentFileFavoriteStatus, getFileContext | both duplicate-path entries become favorite | port | player-context-favorite.spec.ts |
| 298 | Marking a path that isn't loaded leaves current file/context untouched | updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | both stay false | port | player-context-favorite.spec.ts |
| 299 | Calling the update again with false clears the favorite flag it just set | updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | both false after the second call | port | player-context-favorite.spec.ts |
| 300 | Calling the update for an unknown device is a safe no-op | updateCurrentFileFavoriteStatus | does not throw | port | player-context-favorite.spec.ts |
| 301 | Calling the update before any file is launched leaves state null | initializePlayer, updateCurrentFileFavoriteStatus, getCurrentFile, getFileContext | both remain null | port | player-context-favorite.spec.ts |
| 302 | Marking a favorite on one device's file doesn't affect another device's file | updateCurrentFileFavoriteStatus, getCurrentFile | primary device true, secondary device false | port | player-context-favorite.spec.ts |

## 9. player-context-initialization.spec.ts (3 tests)

| # | Behavior | Public surface | Asserts | Disposition | Target file |
|---|---|---|---|---|---|
| 303 | initializePlayer reads default settings and forwards defaultFilter/playTimerEnabled to the store | initializePlayer, PlayerStore.initializePlayer | called with deviceId, defaultFilter All, playTimerEnabled false | port | player-context-lifecycle.spec.ts |
| 304 | A custom startup filter/timer setting is forwarded as-is | initializePlayer | called with defaultFilter Games, playTimerEnabled true | port | player-context-lifecycle.spec.ts |
| 305 | Null settings from SettingsStore fall back to defaults | initializePlayer | called with defaultFilter All, playTimerEnabled false | port | player-context-lifecycle.spec.ts |

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
