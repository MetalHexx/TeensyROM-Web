# Assertion Inventory — player-view component specs (pre-deletion record)

Written before any of the 29 files below are touched, so the P04 rebuild is a translation of
existing coverage rather than a reconstruction from memory. Same row-per-`it()` shape as
`src/libs/application/src/lib/player/ASSERTION-INVENTORY.md` (P03-T01), plus one column this
phase needs: **assertion style**.

## Measured before-figures (inside `libs/features/player`)

R11's 1,889 DOM-reach / ~100 files figures are workspace-wide totals and overstate this library
by roughly 3x. The figures below are measured directly against the 29 files this task owns
(`src/libs/features/player/src/lib/player-view/**/*.spec.ts`):

| | Count |
|---|---:|
| Spec files | 29 |
| `it()` tests | 694 |
| Lines (`wc -l`, all 29 files) | 12,322 |
| `nativeElement` occurrences | 233 |
| `querySelector`/`querySelectorAll` occurrences | 171 |
| `By.css` occurrences | 131 |
| **DOM-reach total** (nativeElement + querySelector + By.css) | **535** |
| `toContain(` occurrences (not all copy assertions — classified per row) | 33 |
| Files calling `compileComponents()` | 29 / 29 |
| Files using `vi.useFakeTimers()` | 0 |
| Files using `NO_ERRORS_SCHEMA` / `overrideComponent` | 1 (`directory-files.component.spec.ts`) |

These match the handoff's stated figures exactly (measured independently via `grep -c` per
pattern across the 29 files), confirming the corpus boundary.

## Disposition legend

- **port** — rebuild this behavior in the proposed target file. Where the original assertion
  style is `dom-copy` but the underlying state-driven fact matters, the row is ported
  **re-expressed** as a `state` or `dom-structural` assertion instead of the literal text check —
  flagged inline as "(re-expressed as state)" / "(re-expressed as dom-structural)".
- **merge** — folded into another row's test (parameterized/table-driven case or a multi-assertion
  flow test); the `Target file` column points at the row it merges into.
- **drop** — not rebuilt. Every drop falls into one of these categories, stated per row:
  (a) `dom-copy` asserting literal user-facing text with no state claim behind it (default for
  this style per the phase charter); (b) `dom-structural` asserting layout/class names that carry
  no behavior; (c) the assertion is on a mocked collaborator being called with exactly what the
  test just passed it, proving nothing about production behavior; (d) genuine duplicate coverage
  of a behavior already exercised elsewhere in the same file.

## Assertion style legend

- **state** — asserts a signal, computed value, or component property directly (no DOM read).
- **dom-structural** — asserts an element/attribute exists or is absent (presence, not content).
- **dom-copy** — asserts specific user-facing text (`textContent`, rendered strings).

## Counts

_(filled in after all 29 files are inventoried — see bottom of document)_

## Proposed target file split

_(filled in after all 29 files are inventoried — see bottom of document)_

---

## 1. file-description-mini.component.spec.ts (4 tests)

Public surface: `PLAYER_CONTEXT.getCurrentFile()` (mocked signal), `displayTitle()`, `creator()`,
`hasFile()`.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 1 | Component instantiates | component | truthy | state | port | file-description-mini.component.spec.ts |
| 2 | Current file's title is exposed as displayTitle | displayTitle() | equals 'Test Song' | state | port | file-description-mini.component.spec.ts |
| 3 | Current file's creator is exposed | creator() | equals 'Test Composer' | state | port | file-description-mini.component.spec.ts |
| 4 | With no current file, hasFile reports false | hasFile(), getCurrentFile (null) | false | state | port | file-description-mini.component.spec.ts |

## 2. file-description/youtube-dialog/youtube-dialog.component.spec.ts (6 tests)

Public surface: `component.youtubeEmbedUrl`, `onClose()`, `MatDialogRef.close`, rendered
`lib-scaling-card` / `iframe`. Note: this component's `.ts` is byte-identical to
`file-other/youtube-dialog/youtube-dialog.component.ts` (verified via diff) — a genuine
duplicate-component pair, flagged in Execution Notes as out of this task's scope to resolve.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 5 | Component instantiates | component | truthy | state | port | youtube-dialog.component.spec.ts |
| 6 | Channel name is passed to the scaling card as its title | nativeElement.querySelector('lib-scaling-card'), `ng-reflect-title` attribute | element truthy; attribute equals 'Test Channel' | dom-structural | drop — asserts an Angular debug-mode `ng-reflect-*` attribute, which doesn't exist in production builds and proves nothing about rendered output; the same title-passthrough is exercised for real via the rendered iframe URL (row 8) | — |
| 7 | The embed URL is constructed from the video id | component.youtubeEmbedUrl | truthy | state | port | youtube-dialog.component.spec.ts |
| 8 | The iframe renders with the constructed embed URL | nativeElement.querySelector('iframe') | element truthy; src contains the video's embed URL | dom-structural | port | youtube-dialog.component.spec.ts |
| 9 | Clicking close invokes the dialog's close | onClose(), MatDialogRef.close spy | close spy called | state | port | youtube-dialog.component.spec.ts |
| 10 | The iframe carries required security/functionality attributes | nativeElement.querySelector('iframe') attributes | allow contains 'autoplay'; referrerpolicy exact value; allowfullscreen present | dom-structural | port | youtube-dialog.component.spec.ts |

## 3. file-image.component.spec.ts (11 tests)

Public surface: `ICrtStorage` (mocked), `onCrtPresetSelected()`, `onCrtSettingsChange()`,
`component['crtSettings']()` (private signal accessed via bracket notation).

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 11 | Component instantiates | component | truthy | state | port | file-image.component.spec.ts |
| 12 | Saved CRT settings from storage are loaded on init | ICrtStorage.load (mocked), crtSettings() | settings equal saved settings | state | port | file-image.component.spec.ts |
| 13 | With no saved settings, the SMALL_IMAGE_WEBGL preset is used | ICrtStorage.load (null), crtSettings() | phosphorPattern/bloomIntensity match preset | state | port | file-image.component.spec.ts |
| 14 | Storage is queried under the 'file-image' key | ICrtStorage.load | called with (deviceId, 'file-image') | state | port | file-image.component.spec.ts |
| 15 | Selecting a built-in preset applies it unmodified | onCrtPresetSelected(), crtSettings() | phosphorPattern/bloomIntensity match preset | state | port | file-image.component.spec.ts |
| 16 | Selecting a custom preset applies its settings unmodified | onCrtPresetSelected(), crtSettings() | scanlineIntensity/brightness/screenCurvature match custom preset | state | port | file-image.component.spec.ts |
| 17 | Selecting a custom preset triggers a load of the custom presets list | onCrtPresetSelected(), ICrtStorage.loadCustomPresets | called | state | drop — asserts a mocked collaborator was called with nothing but the trigger the test itself made; the resulting settings application is already proven by row 16 | — |
| 18 | Selecting a custom preset persists it to storage | onCrtPresetSelected(), ICrtStorage.save | called with (deviceId, 'file-image', matching settings) | state | port | file-image.component.spec.ts |
| 19 | An unknown custom preset logs a warning and leaves settings unchanged | onCrtPresetSelected(), console.warn, crtSettings() | warning message contains preset name; settings unchanged | state | port (console.warn assertion dropped as implementation detail; settings-unchanged assertion kept) | file-image.component.spec.ts |
| 20 | An unknown custom preset is a true no-op on current settings | onCrtSettingsChange(), onCrtPresetSelected(), crtSettings() | settings identical to what was set immediately before | state | merge (see row 19) — same no-op claim as row 19 without the console assertion | — |
| 21 | Selecting a preset from an empty custom-presets array doesn't throw and leaves settings unchanged | onCrtPresetSelected(), crtSettings() | no throw; settings unchanged | state | merge (see row 19) — duplicate of the empty/unknown-preset no-op already covered | — |

## 4. file-time.component.spec.ts (10 tests)

Public surface: `currentTime`/`totalTime`/`show`/`displayMode` inputs, rendered `.file-time` text.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 22 | Component instantiates | component | truthy | state | port | file-time.component.spec.ts |
| 23 | Sub-hour times format as M:SS / M:SS | inputs, `.file-time` textContent | '0:04 / 8:34' | dom-copy | port (re-expressed as state) — format via a component method/computed rather than the literal rendered string | file-time.component.spec.ts |
| 24 | Zero time formats as 0:00 / 0:00 | inputs, `.file-time` textContent | '0:00 / 0:00' | dom-copy | drop — duplicate of the formatting behavior in row 23; a zero-value edge case is better asserted on the formatting function's return value than a second full-render round trip | — |
| 25 | Times >= 1 hour format with an hours component | inputs, `.file-time` textContent | '1:01:01 / 2:00:00' | dom-copy | port (re-expressed as state) — distinct formatting branch (hours) from row 23, worth its own state-level assertion | file-time.component.spec.ts |
| 26 | show=false hides the time element entirely | inputs, `.file-time` | element absent | dom-structural | port | file-time.component.spec.ts |
| 27 | Negative current time clamps to 0:00 in the display | inputs, `.file-time` textContent | '0:00 / 1:40' | dom-copy | port (re-expressed as state) — clamping is a real formatting-function behavior distinct from rows 23/25 | file-time.component.spec.ts |
| 28 | displayMode defaults to showing both times | inputs, `.file-time` textContent | '1:35 / 8:34' | dom-copy | drop — duplicate of the 'both' behavior asserted explicitly in row 29; default-vs-explicit 'both' is the same formatting path | — |
| 29 | displayMode='both' shows both times | inputs, `.file-time` textContent | '1:35 / 8:34' | dom-copy | port (re-expressed as state) | file-time.component.spec.ts |
| 30 | displayMode='current' shows only the current time | inputs, `.file-time` textContent | '1:35' | dom-copy | port (re-expressed as state) | file-time.component.spec.ts |
| 31 | displayMode='total' shows only the total time | inputs, `.file-time` textContent | '8:34' | dom-copy | port (re-expressed as state) | file-time.component.spec.ts |

## 5. volume-control/volume-popup/volume-popup.component.spec.ts (11 tests)

Public surface: `AudioStore` (mocked), `onTriggerClick()`, `onToggleMute()`,
`onVolumeChange()`, computed `isMuted()`/`currentVolume()`/`volumeIcon()`/`muteAriaLabel()`.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 32 | Component instantiates | component | truthy | state | port | volume-popup.component.spec.ts |
| 33 | Muted state shows the volume_off icon | AudioStore.isMuted, rendered mat-icon textContent | 'volume_off' | dom-copy | drop — the icon identity is a state-driven fact re-proven directly by row 39's `volumeIcon()` computed-signal assertion for the same muted case | — |
| 34 | Volume >= 0.5 unmuted shows volume_up | AudioStore.masterVolume/isMuted, rendered mat-icon textContent | 'volume_up' | dom-copy | port (re-expressed as state) — assert `component.volumeIcon()` directly; no existing state-level test covers this threshold | volume-popup.component.spec.ts |
| 35 | Volume < 0.5 and > 0 shows volume_down | AudioStore.masterVolume/isMuted, rendered mat-icon textContent | 'volume_down' | dom-copy | port (re-expressed as state) — assert `volumeIcon()` directly | volume-popup.component.spec.ts |
| 36 | Volume exactly 0 and unmuted shows volume_mute | AudioStore.masterVolume/isMuted, rendered mat-icon textContent | 'volume_mute' | dom-copy | port (re-expressed as state) — assert `volumeIcon()` directly | volume-popup.component.spec.ts |
| 37 | Clicking the trigger opens the dropdown | nativeElement click, `component['dropdown']()?.isOpen()` | true | state | port | volume-popup.component.spec.ts |
| 38 | The mute toggle calls the store's toggleMute | onToggleMute(), AudioStore.toggleMute | called once | state | port | volume-popup.component.spec.ts |
| 39 | The volume slider forwards its value to the store | onVolumeChange(), AudioStore.setMasterVolume | called with 0.42 | state | port | volume-popup.component.spec.ts |
| 40 | Computed signals reflect store state (muted, 0 volume) | isMuted(), currentVolume(), volumeIcon(), muteAriaLabel() | true; 0; 'volume_off'; 'Unmute audio' | state | port | volume-popup.component.spec.ts |
| 41 | Unmuted state uses the 'Mute audio' aria label | muteAriaLabel() | 'Mute audio' | state | port | volume-popup.component.spec.ts |
| 42 | The disabled input disables the trigger button | inputs, nativeElement.querySelector button.disabled | true | dom-structural | port | volume-popup.component.spec.ts |

## 6. storage-container/random-roll-button/random-roll-button.component.spec.ts (7 tests)

Public surface: `onButtonClick()`, `buttonClick` output, `animateDiceRoll()`, `getButtonColor` input.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 43 | Component instantiates | component | truthy | state | port | random-roll-button.component.spec.ts |
| 44 | Clicking the button emits buttonClick | onButtonClick(), buttonClick.emit | emit spy called | state | port | random-roll-button.component.spec.ts |
| 45 | Triggering the dice-roll animation adds the dice-roll class to the icon | animateDiceRoll(mockEvent) | icon's classList contains 'dice-roll' | dom-structural | port | random-roll-button.component.spec.ts |
| 46 | Button color defaults to 'normal' | getButtonColor() | 'normal' | state | port | random-roll-button.component.spec.ts |
| 47 | Button color accepts an 'error' input | input, getButtonColor() | 'error' | state | merge (see row 49) — subsumed by the color round-trip test | — |
| 48 | Button color is forwarded to the icon-button child | input, By.css('lib-icon-button'), componentInstance.color() | 'error' | state | port | random-roll-button.component.spec.ts |
| 49 | Button color updates across normal/error/highlight | input, getButtonColor() | tracks each set value in sequence | state | port | random-roll-button.component.spec.ts |

## 7. storage-container.component.spec.ts (7 tests)

Public surface: `IPlayerContext` (mocked, partial), `shouldShowHistory()`,
`historyViewVisible()`, `hasPlayHistory()`, `onDirectoryNavigated()`, `toggleHistoryView`.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 50 | Component instantiates | component | truthy | state | port | storage-container.component.spec.ts |
| 51 | History shows when the toggle is on and entries exist | isHistoryViewVisible, getPlayHistory, shouldShowHistory() | true | state | port | storage-container.component.spec.ts |
| 52 | History hides when the toggle is off, even with entries | isHistoryViewVisible, getPlayHistory, shouldShowHistory() | false | state | port | storage-container.component.spec.ts |
| 53 | History stays visible when no active search is present (toggle on, entries exist) | historyViewVisible(), hasPlayHistory(), shouldShowHistory() | true, true, true | state | merge (see row 51) — same toggle-on/entries-exist/no-search precondition as row 51, restated via the intermediate computed signals | — |
| 54 | History hides when there are no entries, even with the toggle on | isHistoryViewVisible, getPlayHistory (null), shouldShowHistory() | false | state | port | storage-container.component.spec.ts |
| 55 | Directory navigation toggles history off when history is currently visible | onDirectoryNavigated(), IPlayerContext.toggleHistoryView | called with deviceId | state | port | storage-container.component.spec.ts |
| 56 | Directory navigation is a no-op on history when history isn't visible | onDirectoryNavigated(), IPlayerContext.toggleHistoryView | not called | state | port | storage-container.component.spec.ts |

## 9. file-description/file-description.component.spec.ts (28 tests)

Public surface: `IPlayerContext.getCurrentFile()` (mocked signal), `displayTitle()`, `creator()`,
`hasFile()`, `meta1()`/`meta2()`, `links()`, `youTubeVideos()`, `competitions()`, `tags()`,
`avgRating()`/`ratingCount()`, `hasContent()`/`hasExtendedContent()`, rendered sections
(`.description-text`, `.links-section`, `.youtube-section`, `.competitions-section`,
`.tags-section`, `.rating-section`, `mat-chip`). Row heuristic applied throughout this file: where
a row asserts both a component signal/property **and** the DOM, the signal assertion is the
authoritative proof and is what's ported; duplicate DOM text/structure checks on the same data are
noted as dropped-in-rebuild rather than separately numbered.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 57 | Component instantiates | component | truthy | state | port | file-description.component.spec.ts |
| 58 | No current file shows the empty state | getCurrentFile (null), hasFile(), `.empty-icon` | hasFile false; empty icon present | dom-structural | port | file-description.component.spec.ts |
| 59 | Title is exposed from the current file's metadata | displayTitle() | 'Test Song Title' | state | port | file-description.component.spec.ts |
| 60 | Creator is exposed from the current file's metadata | creator() | 'Test Artist' | state | port | file-description.component.spec.ts |
| 61 | Title/creator are forwarded to the scaling-card child | By.css('lib-scaling-card').componentInstance | title()/subtitle() equal metadata values | state | port | file-description.component.spec.ts |
| 62 | The description renders from file metadata | `.description-text` textContent | exact description string | dom-copy | port (re-expressed as dom-structural) — assert the description block renders when metadata has a description, not the literal string | file-description.component.spec.ts |
| 63 | An HVSC STIL label shows for songs | `.section-label` textContent | 'HVSC STIL' | dom-copy | port (re-expressed as dom-structural) — the conditional-for-songs presence is the real behavior, not the static label text | file-description.component.spec.ts |
| 64 | Falls back to the filename when no title is set | displayTitle() | 'test-file.sid' | state | port | file-description.component.spec.ts |
| 65 | Release info renders when present | `.release-info` textContent | '2024 Test Release' | dom-copy | port (re-expressed as dom-structural) — assert the release-info block renders when present | file-description.component.spec.ts |
| 66 | meta1 renders as a chip when present | meta1(), `.tags-section` chip count/text | 'PRG'; 1 chip; chip text 'PRG' | state | port | file-description.component.spec.ts |
| 67 | meta2 renders as a chip when present | meta2(), `.tags-section` chip count/text | 'C64'; 1 chip; chip text 'C64' | state | port | file-description.component.spec.ts |
| 68 | Both chips render together when meta1 and meta2 are both present | `.tags-section` chip count/text | 2 chips; texts 'PRG', 'C64' | dom-copy | port (re-expressed as dom-structural) — assert chip count is 2, drop the literal text duplication of rows 66/67 | file-description.component.spec.ts |
| 69 | No tags section renders when meta1/meta2/tags are all empty | `.tags-section` | null | dom-structural | port | file-description.component.spec.ts |
| 70 | Links section renders with items when links exist | links(), `.links-section`, heading text, `lib-external-link` items | length 2; section truthy; heading 'Links'; 2 items containing each link's name | state | port (heading text and per-item name-copy checks dropped as redundant with the `links()` state assertion) | file-description.component.spec.ts |
| 71 | No links section renders when links is empty | links(), `.links-section` | length 0; null | state | port | file-description.component.spec.ts |
| 72 | YouTube videos section renders with items when videos exist | youTubeVideos(), `.youtube-section`, heading text, `lib-action-link` items | length 2; section truthy; heading 'Related Videos'; 2 items containing each channel name | state | port (heading/per-item text checks dropped as redundant with the `youTubeVideos()` state assertion) | file-description.component.spec.ts |
| 73 | No YouTube section renders when videos is empty | youTubeVideos(), `.youtube-section` | length 0; null | state | port | file-description.component.spec.ts |
| 74 | Competitions section renders with items when competitions exist | competitions(), `.competitions-section`, heading text, `.competition-item`s | length 2; section truthy; heading 'Competition Results'; item text contains name and 'Place 1' | state | port (heading/per-item text checks dropped as redundant with the `competitions()` state assertion) | file-description.component.spec.ts |
| 75 | A competition without a place renders without a position element | `.competition-item` textContent, `.position` | text 'Demo Scene Awards'; position element absent | dom-structural | port (re-expressed — drop the literal name text, keep the position-absent assertion) | file-description.component.spec.ts |
| 76 | No competitions section renders when competitions is empty | competitions(), `.competitions-section` | length 0; null | state | port | file-description.component.spec.ts |
| 77 | Tags section renders with typed chips when tags exist | tags(), `.tags-section`, heading, chip texts/classes | length 2; section truthy; heading 'Tags'; chip text + `tag-genre`/`tag-era` classes | state | port (heading/literal chip-text checks dropped; type-indicating class assertion kept as it reflects real conditional class binding) | file-description.component.spec.ts |
| 78 | No tags section renders when tags is empty | tags(), `.tags-section` | length 0; null | state | port | file-description.component.spec.ts |
| 79 | Rating section renders with formatted values when avgRating exists | avgRating(), ratingCount(), `.rating-section` textContent | 4.5; 42; section truthy; text contains '4.5/5.0' and '(42 ratings)' | state | port | file-description.component.spec.ts |
| 80 | No rating section renders when avgRating is undefined | avgRating(), `.rating-section` | undefined; null | state | port | file-description.component.spec.ts |
| 81 | hasContent is true when title exists | hasContent() | true | state | port | file-description.component.spec.ts |
| 82 | hasContent and hasExtendedContent are true when links exist | hasContent(), hasExtendedContent() | true; true | state | port | file-description.component.spec.ts |
| 83 | hasExtendedContent is true when avgRating exists | hasExtendedContent() | true | state | port | file-description.component.spec.ts |
| 84 | All metadata sections render together when all data is present | `.links-section`, `.youtube-section`, `.competitions-section`, `.tags-section` | all truthy | dom-structural | drop — each section's independent conditional rendering is already proven per-section (rows 70, 72, 74, 77); the sections don't interact, so testing them simultaneously present adds no new code path | — |

## 10. file-other/file-other.component.spec.ts (36 tests)

Public surface: mirrors file-description.component.spec.ts almost exactly (`getCurrentFile()`,
`meta1()`/`meta2()`, `hasContent()`, `links()`/`youTubeVideos()`/`competitions()`/`tags()`,
`avgRating()`/`ratingCount()`, rendered sections) plus its own empty-state copy, a metadata-grid
wrapper, and video-subtune display. Same row heuristic as file-description applies.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 85 | Component instantiates | component | truthy | state | port | file-other.component.spec.ts |
| 86 | deviceId input is reflected on the component | deviceId() | 'test-device' | state | port | file-other.component.spec.ts |
| 87 | No current file shows the empty state | getCurrentFile (null), `lib-empty-state-message`, hasFile() | element truthy; hasFile false | dom-structural | port | file-other.component.spec.ts |
| 88 | Empty state shows "No File Launched" copy | `lib-empty-state-message` textContent | contains 'No File Launched' and 'Launch a file from the file browser below.' | dom-copy | drop — static UI copy, not a unit-test concern; presence already proven by row 87 | — |
| 89 | Empty state shows a secondary dice-button hint | `lib-empty-state-message` textContent | contains 'Try clicking the dice button...' | dom-copy | drop — static UI copy, duplicate presence claim of row 87/88 | — |
| 90 | Meta chips and content flag populate from DeepSID data | meta1(), meta2(), hasContent(), hasFile() | 'SID'; '6581'; true; true | state | port | file-other.component.spec.ts |
| 91 | meta1 renders as a chip when present | meta1(), chip count/text | 'PRG'; 1 chip; text 'PRG' | state | port | file-other.component.spec.ts |
| 92 | meta2 renders as a chip when present | meta2(), chip count/text | 'C64'; 1 chip; text 'C64' | state | port | file-other.component.spec.ts |
| 93 | Both chips render together when meta1 and meta2 are both present | chip count/text | 2 chips; texts 'PRG', 'C64' | dom-copy | port (re-expressed as dom-structural) — assert chip count is 2, drop the literal text duplication of rows 91/92 | file-other.component.spec.ts |
| 94 | No chip-set renders when meta1 and meta2 are both empty | `mat-chip-set` | null | dom-structural | port | file-other.component.spec.ts |
| 95 | A no-metadata message shows when the file has no DeepSID content | hasContent(), `.no-metadata` presence/text | false; truthy; exact text | state | port (literal message text dropped; hasContent()/presence kept) | file-other.component.spec.ts |
| 96 | hasContent is true when links exist | hasContent() | true | state | port | file-other.component.spec.ts |
| 97 | hasContent is true when avgRating exists | hasContent() | true | state | port | file-other.component.spec.ts |
| 98 | Meta signals are empty strings when no file is loaded | meta1(), meta2() | '', '' | state | port | file-other.component.spec.ts |
| 99 | Computed meta values update when the current file changes | meta1(), meta2() across two file sets | 'PRG'/'C64' then 'D64'/'VIC20' | state | port | file-other.component.spec.ts |
| 100 | Links section renders with items when links exist | links(), `.links-section`, heading, `lib-external-link` items | length 2; section truthy; heading 'Links'; 2 items | state | port (heading/per-item name-copy checks dropped as redundant with `links()`) | file-other.component.spec.ts |
| 101 | No links section renders when links is empty | links(), `.links-section` | length 0; null | state | port | file-other.component.spec.ts |
| 102 | A link element renders for an external link | `lib-external-link` | truthy | dom-structural | drop — duplicate of row 100's link-presence assertion; the test's own title claims a `target="_blank"` behavior that the assertion never actually checks (no attribute read) | — |
| 103 | YouTube videos section renders with items when videos exist | youTubeVideos(), `.youtube-section`, heading, `lib-action-link` items | length 2; section truthy; heading 'Related Videos'; 2 items | state | port (heading/per-item text checks dropped as redundant with `youTubeVideos()`) | file-other.component.spec.ts |
| 104 | Clicking a video link opens the YouTube dialog | `lib-action-link` | truthy | dom-structural | drop — duplicate of row 103's link-presence assertion; the test's own title claims a dialog-opens-on-click behavior that is never triggered (no `.click()`) or asserted (no dialog spy) — coverage gap, see Execution Notes | — |
| 105 | Subtune info shows for a video with subtune > 0 | `lib-action-link` textContent | truthy; contains channel name | dom-copy | drop — duplicate of row 103's channel-name text; the assertion never reads the subtune number itself despite the test's title — coverage gap, see Execution Notes | — |
| 106 | Subtune info is absent for a video with subtune = 0 | `lib-action-link` textContent | truthy; contains channel name | dom-copy | drop — same as row 105: asserts only the channel name, never the claimed subtune-absence — coverage gap, see Execution Notes | — |
| 107 | No YouTube section renders when videos is empty | youTubeVideos(), `.youtube-section` | length 0; null | state | port | file-other.component.spec.ts |
| 108 | Competitions section renders with items when competitions exist | competitions(), `.competitions-section`, heading, `.competition-item`s | length 2; section truthy; heading 'Competition Results'; item text contains name and 'Place 1' | state | port (heading/per-item text checks dropped as redundant with `competitions()`) | file-other.component.spec.ts |
| 109 | A competition without a place renders without a position element | `.competition-item` textContent, `.position` | text 'Demo Scene Awards'; position absent | dom-structural | port (re-expressed — drop the literal name text, keep the position-absent assertion) | file-other.component.spec.ts |
| 110 | No competitions section renders when competitions is empty | competitions(), `.competitions-section` | length 0; null | state | port | file-other.component.spec.ts |
| 111 | Tags section renders with typed chips when tags exist | tags(), `.tags-section`, heading, chip texts/classes | length 2; section truthy; heading 'Tags'; chip text + `tag-genre`/`tag-era` classes | state | port (heading/literal chip-text checks dropped; type-indicating class assertion kept) | file-other.component.spec.ts |
| 112 | No tags section renders when tags is empty | tags(), `.tags-section` | length 0; null | state | port | file-other.component.spec.ts |
| 113 | Rating section renders with formatted values when avgRating exists | avgRating(), ratingCount(), `.rating-section` textContent | 4.5; 42; section truthy; text contains '4.5/5.0' and '(42 ratings)' | state | port | file-other.component.spec.ts |
| 114 | No rating section renders when avgRating is undefined | avgRating(), `.rating-section` | undefined; null | state | port | file-other.component.spec.ts |
| 115 | The metadata grid renders when any section exists | `.metadata-grid` | truthy | dom-structural | port | file-other.component.spec.ts |
| 116 | All metadata sections render together when all data is present | `.links-section`, `.youtube-section`, `.competitions-section`, `.tags-section` | all truthy | dom-structural | drop — each section's independent conditional rendering is already proven per-section (rows 100, 103, 108, 111) | — |
| 117 | hasContent is true when links exist (DeepSID-sourced file) | hasContent() | true | state | drop — duplicate of row 96, same public claim on the same signal | — |
| 118 | hasContent is true when tags exist | hasContent() | true | state | port | file-other.component.spec.ts |
| 119 | hasContent is true when YouTube videos exist | hasContent() | true | state | port | file-other.component.spec.ts |
| 120 | hasContent is true when competitions exist | hasContent() | true | state | port | file-other.component.spec.ts |

## 11. file-other/youtube-dialog/youtube-dialog.component.spec.ts (6 tests)

Byte-identical `.ts` and `.spec.ts` to `file-description/youtube-dialog/youtube-dialog.component.spec.ts`
(row 33's note — genuine duplicate component, out of this task's scope to resolve). Same rows.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 121 | Component instantiates | component | truthy | state | port | youtube-dialog.component.spec.ts |
| 122 | Channel name is passed to the scaling card as its title | `ng-reflect-title` attribute | 'Test Channel' | dom-structural | drop — Angular debug-mode `ng-reflect-*` attribute, not production output; passthrough exercised for real by row 124's iframe URL | — |
| 123 | The embed URL is constructed from the video id | component.youtubeEmbedUrl | truthy | state | port | youtube-dialog.component.spec.ts |
| 124 | The iframe renders with the constructed embed URL | `iframe` | truthy; src contains embed URL | dom-structural | port | youtube-dialog.component.spec.ts |
| 125 | Clicking close invokes the dialog's close | onClose(), MatDialogRef.close spy | called | state | port | youtube-dialog.component.spec.ts |
| 126 | The iframe carries required security/functionality attributes | `iframe` attributes | allow/referrerpolicy/allowfullscreen values | dom-structural | port | youtube-dialog.component.spec.ts |

## 8. player-view.component.spec.ts (3 tests)

Public surface: `deviceStore`, `enabledDevices`.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 692 | Component instantiates | component | truthy | state | port | player-view.component.spec.ts |
| 693 | The device store is injected | component.deviceStore | truthy | state | port | player-view.component.spec.ts |
| 694 | Enabled devices is computed from the store | component.enabledDevices | function truthy; evaluates to [] for empty store | state | port | player-view.component.spec.ts |

---

