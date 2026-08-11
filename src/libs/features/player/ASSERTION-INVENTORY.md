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

## 12. player-device-container.component.spec.ts (43 tests)

Public surface: `IPlayerContext`/`SettingsStore`/`BreakpointObserver` (mocked), `enableVideo()`,
`isPhone`, `paneIndicators()`, `hasStorageIndex()`, `emptyStateIcon()`/`emptyStateTitle()`,
rendered child components (`lib-video-capture`, `lib-file-image`, `lib-file-description`,
`lib-player-toolbar`, `lib-filter-toolbar`, `lib-player-toolbar-mini`, `lib-empty-state-message`,
`lib-file-description-mini`).

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 127 | Component instantiates | component | truthy | state | port | player-device-container.component.spec.ts |
| 128 | isPhone defaults to false | isPhone() | false | state | port | player-device-container.component.spec.ts |
| 129 | enableVideo signal is defined as a function | enableVideo | defined; typeof function | state | drop — weak type-of check subsumed by every value-level enableVideo() assertion that follows | — |
| 130 | enableVideo defaults to false before settings load | enableVideo() | false | state | port | player-device-container.component.spec.ts |
| 131 | enableVideo reflects true from settings | enableVideo() | true | state | port | player-device-container.component.spec.ts |
| 132 | enableVideo reflects false from settings | enableVideo() | false | state | drop — duplicate of row 130's default-false claim | — |
| 133 | enableVideo updates reactively across true/false/true | enableVideo() | tracks each setting change | state | port | player-device-container.component.spec.ts |
| 134 | video-capture renders when enableVideo is true | `lib-video-capture` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 135 | video-capture is absent when enableVideo is false | `lib-video-capture` | null | dom-structural | port | player-device-container.component.spec.ts |
| 136 | video-capture is added to the DOM when toggled false→true | `lib-video-capture` | null then truthy | dom-structural | drop — duplicate of rows 134/135's static before/after states | — |
| 137 | video-capture is removed from the DOM when toggled true→false | `lib-video-capture` | truthy then null | dom-structural | drop — duplicate of rows 134/135's static before/after states | — |
| 138 | file-image still renders when video-capture is hidden | `lib-file-image` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 139 | file-description still renders when video-capture is hidden | `lib-file-description` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 140 | device-header layout is maintained when video-capture is hidden | `.device-header`, nested `lib-file-image`/`lib-file-description` | all truthy | dom-structural | drop — duplicate combination of rows 138/139 | — |
| 141 | SettingsStore injects successfully | TestBed.inject(SettingsStore) | defined | state | drop — trivial DI-truthy check, no behavior claim | — |
| 142 | enableVideo reflects the store value across changes | enableVideo() | true then false | state | drop — duplicate of row 133's reactive-update claim | — |
| 143 | Rapid setting toggling doesn't throw | 5x setEnableVideo() | no throw | state | drop — resilience smoke test with no new observable claim beyond row 133 | — |
| 144 | isPhone is true when the phone breakpoint matches | BreakpointObserver, isPhone() | true | state | port | player-device-container.component.spec.ts |
| 145 | isPhone is false when the breakpoint doesn't match | BreakpointObserver, isPhone() | false | state | drop — duplicate of row 128's default-false claim | — |
| 146 | paneIndicators is empty on desktop without video | paneIndicators() | [] | state | port | player-device-container.component.spec.ts |
| 147 | paneIndicators lists image/description/video on desktop with video | paneIndicators() | 3-entry array with expected labels/indices | state | port | player-device-container.component.spec.ts |
| 148 | paneIndicators lists 3 panes on phone without video | paneIndicators() | storage/image/description | state | port | player-device-container.component.spec.ts |
| 149 | paneIndicators lists 4 panes on phone with video | paneIndicators() | storage/image/description/video | state | port | player-device-container.component.spec.ts |
| 150 | hasStorageIndex is false when device is undefined | device input, hasStorageIndex() | false | state | port | player-device-container.component.spec.ts |
| 151 | hasStorageIndex is false when device has no storage properties | device input, hasStorageIndex() | false | state | port | player-device-container.component.spec.ts |
| 152 | hasStorageIndex is true when sdStorage has indexExists | device input, hasStorageIndex() | true | state | port | player-device-container.component.spec.ts |
| 153 | hasStorageIndex is true when usbStorage has indexExists | device input, hasStorageIndex() | true | state | port | player-device-container.component.spec.ts |
| 154 | hasStorageIndex is true when both storages have indexExists | device input, hasStorageIndex() | true | state | drop — duplicate OR-combination of rows 152/153, no new code path | — |
| 155 | hasStorageIndex is false when both storages have indexExists false | device input, hasStorageIndex() | false | state | port | player-device-container.component.spec.ts |
| 156 | combined-toolbar renders when no file is launched | `.combined-toolbar` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 157 | player-toolbar renders when no file is launched | `lib-player-toolbar` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 158 | filter-toolbar renders when no file is launched | `lib-filter-toolbar` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 159 | player-toolbar receives disabled=true when no file is launched | `lib-player-toolbar` componentInstance.disabled() | true | state | port | player-device-container.component.spec.ts |
| 160 | player-toolbar receives disabled=false when a file is launched | `lib-player-toolbar` componentInstance.disabled() | false | state | port | player-device-container.component.spec.ts |
| 161 | filter-toolbar isn't disabled when storage isn't indexed | `lib-filter-toolbar` componentInstance.disabled() | false | state | port | player-device-container.component.spec.ts |
| 162 | filter-toolbar disabled=false when storage is indexed | `lib-filter-toolbar` componentInstance.disabled() | false | state | merge (see row 161) — same "filter-toolbar always enabled regardless of index state" claim under a different device config | — |
| 163 | filter-toolbar stays enabled with an indexed device and no file launched, while player-toolbar stays disabled | both toolbars' componentInstance.disabled() | filter false; player true | state | port | player-device-container.component.spec.ts |
| 164 | Phone-layout toolbars render on the phone breakpoint | `lib-player-toolbar-mini` | truthy | dom-structural | port | player-device-container.component.spec.ts |
| 165 | Empty-state shows the storage-not-indexed icon/title | `lib-empty-state-message`, emptyStateIcon(), emptyStateTitle() | truthy; 'sd_storage'; 'Index Your Storage' | state | port | player-device-container.component.spec.ts |
| 166 | Empty-state shows the ready-to-play icon/title when indexed with no file | `lib-empty-state-message`, emptyStateIcon(), emptyStateTitle() | truthy; 'play_circle'; 'Ready to Play' | state | port | player-device-container.component.spec.ts |
| 167 | file-description replaces the empty-state once a file is launched | `lib-empty-state-message`, `lib-file-description` | null; truthy | dom-structural | port | player-device-container.component.spec.ts |
| 168 | file-description-mini is hidden on phone when no file is launched | `lib-file-description-mini` | null | dom-structural | port | player-device-container.component.spec.ts |
| 169 | file-description-mini shows on phone once a file is launched | `lib-file-description-mini` | truthy | dom-structural | port | player-device-container.component.spec.ts |

## 13. player-toolbar-mini/player-toolbar-mini.component.spec.ts (32 tests)

Public surface: `playPause()`, `stop()`, `next()`, `previous()`, `getPlayPauseIconComputed()`,
`getPlayPauseLabelComputed()`, `isCurrentFileMusicTypeComputed()`, `isPlayerLoadedComputed()`,
`canNavigateComputed()`, `disabled` input, rendered playback buttons, `lib-volume-popup`.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 170 | Component instantiates | component | truthy | state | port | player-toolbar-mini.component.spec.ts |
| 171 | playPause() calls pause while playing | playPause(), IPlayerContext.pause/play | pause called with deviceId; play not called | state | port | player-toolbar-mini.component.spec.ts |
| 172 | playPause() calls play while stopped | playPause(), IPlayerContext.play/pause | play called with deviceId; pause not called | state | port | player-toolbar-mini.component.spec.ts |
| 173 | playPause() is a no-op with an empty deviceId | playPause(), IPlayerContext.play/pause | neither called | state | port | player-toolbar-mini.component.spec.ts |
| 174 | stop() calls the context's stop with the deviceId | stop(), IPlayerContext.stop | called with deviceId | state | port | player-toolbar-mini.component.spec.ts |
| 175 | stop() is a no-op with an empty deviceId | stop(), IPlayerContext.stop | not called | state | port | player-toolbar-mini.component.spec.ts |
| 176 | next() calls the context's next with the deviceId | next(), IPlayerContext.next | called with deviceId | state | port | player-toolbar-mini.component.spec.ts |
| 177 | previous() calls the context's previous with the deviceId | previous(), IPlayerContext.previous | called with deviceId | state | port | player-toolbar-mini.component.spec.ts |
| 178 | Play/pause icon is play_arrow when stopped | getPlayPauseIconComputed() | 'play_arrow' | state | port | player-toolbar-mini.component.spec.ts |
| 179 | Play/pause icon is pause when playing | getPlayPauseIconComputed() | 'pause' | state | port | player-toolbar-mini.component.spec.ts |
| 180 | Play/pause label is 'Play' when stopped | getPlayPauseLabelComputed() | 'Play' | state | port | player-toolbar-mini.component.spec.ts |
| 181 | Play/pause label is 'Pause' when playing | getPlayPauseLabelComputed() | 'Pause' | state | port | player-toolbar-mini.component.spec.ts |
| 182 | Detects a music-type current file | isCurrentFileMusicTypeComputed() | true | state | port | player-toolbar-mini.component.spec.ts |
| 183 | Detects a non-music-type current file | isCurrentFileMusicTypeComputed() | false | state | port | player-toolbar-mini.component.spec.ts |
| 184 | isPlayerLoaded is true when a current file exists | isPlayerLoadedComputed() | true | state | port | player-toolbar-mini.component.spec.ts |
| 185 | isPlayerLoaded is false when there's no current file | isPlayerLoadedComputed() | false | state | port | player-toolbar-mini.component.spec.ts |
| 186 | Navigation is allowed with multiple files in context | canNavigateComputed() | true | state | port | player-toolbar-mini.component.spec.ts |
| 187 | Navigation is allowed in shuffle mode regardless of file count | canNavigateComputed() | true | state | port | player-toolbar-mini.component.spec.ts |
| 188 | Navigation is disallowed with a single file in directory mode | canNavigateComputed() | false | state | port | player-toolbar-mini.component.spec.ts |
| 189 | disabled input defaults to false | disabled() | false | state | port | player-toolbar-mini.component.spec.ts |
| 190 | disabled input accepts true | disabled() | true | state | port | player-toolbar-mini.component.spec.ts |
| 191 | disabled-state class is added to the host when disabled | nativeElement.classList | contains 'disabled-state' | dom-structural | port | player-toolbar-mini.component.spec.ts |
| 192 | disabled-state class is absent when not disabled | nativeElement.classList | doesn't contain 'disabled-state' | dom-structural | port | player-toolbar-mini.component.spec.ts |
| 193 | All playback buttons are disabled when disabled=true | Previous/Next/Stop icon-button componentInstance.disabled() | all true | state | port | player-toolbar-mini.component.spec.ts |
| 194 | Playback buttons are enabled when disabled=false and navigation is possible | Previous/Next/Play-Pause componentInstance.disabled() | all false | state | port | player-toolbar-mini.component.spec.ts |
| 195 | Volume popup renders when audio streaming is enabled for the device | SettingsStore.enableAudioStreamForDevice, `lib-volume-popup` | truthy | dom-structural | port | player-toolbar-mini.component.spec.ts |
| 196 | Volume popup is absent when audio streaming is disabled | `lib-volume-popup` | null | dom-structural | port | player-toolbar-mini.component.spec.ts |
| 197 | Volume popup receives disabled=true matching the toolbar's disabled state | `lib-volume-popup` componentInstance.disabled() | true | state | port | player-toolbar-mini.component.spec.ts |
| 198 | Volume popup receives disabled=false when the toolbar is enabled | `lib-volume-popup` componentInstance.disabled() | false | state | port | player-toolbar-mini.component.spec.ts |
| 199 | Audio-stream-enabled lookup uses the component's deviceId | SettingsStore.enableAudioStreamForDevice | called with 'test-device-id' | state | drop — asserts a mocked collaborator called with exactly the input the test set; the resulting show/hide behavior is already proven by rows 195/196 | — |
| 200 | Volume popup shows/hides reactively as the audio-stream setting changes | `lib-volume-popup` | null then truthy | dom-structural | drop — duplicate of rows 195/196's static before/after states | — |
| 201 | Volume popup renders inside the playback-controls container | `.playback-controls` containing `lib-volume-popup` | both truthy | dom-structural | port | player-toolbar-mini.component.spec.ts |

## 14. player-toolbar/file-info/file-info.component.spec.ts (29 tests)

Public surface: `fileItem` input, `fileTypeName()`, `imageUrls()`, rendered `.file-title`/
`.file-creator`/`.file-info`/`.file-text`, `lib-cycle-image` child. Row 211 collapses a 16-case
`typeTestCases.forEach(...)` table into a single row (one textual `it()` in source, matching this
inventory's grep-based `it()` count) — note its span explicitly.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 202 | Component instantiates | component | truthy | state | port | file-info.component.spec.ts |
| 203 | Accepts a null fileItem input | fileItem() | null | state | port | file-info.component.spec.ts |
| 204 | Title and creator render from the file item | `.file-title`/`.file-creator` textContent | 'Test Song'; 'Test Artist' | dom-copy | port (re-expressed as dom-structural) — assert the title/creator elements render when the input has data, not the literal strings | file-info.component.spec.ts |
| 205 | The file-info block is absent with a null fileItem | `.file-info` | null | dom-structural | port | file-info.component.spec.ts |
| 206 | The file-info container renders when fileItem exists | `.file-info` | truthy | dom-structural | port | file-info.component.spec.ts |
| 207 | Title renders empty when the title field is empty | `.file-title` textContent | '' | dom-structural | port (re-expressed) — the element still renders with an empty title; literal empty-string equality is trivial | file-info.component.spec.ts |
| 208 | Creator renders when provided | `.file-creator` textContent | 'Rob Hubbard' | dom-copy | drop — duplicate of row 204's "creator renders when provided" claim with different fixture data | — |
| 209 | Creator falls back to the file-type name when creator is empty | meta1, `.file-creator` textContent | 'Program' | dom-copy | port (re-expressed as dom-structural) — assert the creator div falls back to rendering `fileTypeName()`'s value rather than re-checking the exact mapped string, which row 211 already covers | file-info.component.spec.ts |
| 210 | Neither creator nor fileTypeName renders a creator div when both are empty | `.file-creator` | null | dom-structural | port | file-info.component.spec.ts |
| 211 | meta1 extension maps to its display type name across 16 known extensions (sid, crt, prg, p00, hex, kla, koa, art, aas, hpi, d64, seq, txt, zip, nfo, unknown) | fileTypeName() | each extension's expected label | state | port | file-info.component.spec.ts |
| 212 | Uppercase meta1 is normalized to lowercase before mapping | fileTypeName() | 'Music' for 'SID' | state | port | file-info.component.spec.ts |
| 213 | Mixed-case meta1 is normalized before mapping | fileTypeName() | 'Program' for 'PrG' | state | drop — duplicate of row 212's case-normalization claim | — |
| 214 | An unmapped extension returns its uppercased form | fileTypeName() | 'XYZ' for 'xyz' | state | port | file-info.component.spec.ts |
| 215 | Empty meta1 returns an empty type name | fileTypeName() | '' | state | port | file-info.component.spec.ts |
| 216 | Undefined meta1 returns an empty type name | fileTypeName() | '' | state | merge (see row 215) — same falsy-meta1 empty-result claim | — |
| 217 | imageUrls is empty when fileItem is null | imageUrls() | [] | state | port | file-info.component.spec.ts |
| 218 | imageUrls is empty when the images array is empty | imageUrls() | [] | state | port | file-info.component.spec.ts |
| 219 | imageUrls is empty when images is undefined | imageUrls() | [] | state | merge (see row 218) — same empty-result claim, different falsy input shape | — |
| 220 | imageUrls extracts the URL from a single image | imageUrls() | one-element array | state | port | file-info.component.spec.ts |
| 221 | imageUrls extracts URLs from multiple images, in order | imageUrls() | three-element array in order | state | merge (see row 220) — same extraction logic, no new code path | — |
| 222 | imageUrls is forwarded to the CycleImageComponent child | `lib-cycle-image` componentInstance.images() | matches imageUrls() | state | port | file-info.component.spec.ts |
| 223 | CycleImageComponent receives a fixed 4000ms interval | `lib-cycle-image` componentInstance.intervalMs() | 4000 | state | port | file-info.component.spec.ts |
| 224 | CycleImageComponent receives the 'thumbnail' size | `lib-cycle-image` componentInstance.size() | 'thumbnail' | state | port | file-info.component.spec.ts |
| 225 | imageUrls updates reactively when fileItem changes | imageUrls() before/after | tracks the new file's images | state | port | file-info.component.spec.ts |
| 226 | fileTypeName updates reactively when fileItem changes | fileTypeName() before/after | tracks the new file's meta1 | state | drop — duplicate reactivity claim of row 225 (same input-change-drives-computed-update pattern) | — |
| 227 | DOM re-renders title/creator when fileItem changes | `.file-title`/`.file-creator` textContent before/after | tracks the new file's title/creator | dom-copy | drop — duplicate of row 225's reactivity claim plus row 204's text-copy concern | — |
| 228 | CycleImageComponent renders when the file has images | `lib-cycle-image` | truthy | dom-structural | merge (see row 222) — same child-presence precondition as the passthrough test | — |
| 229 | CycleImageComponent still renders with an empty images array | `lib-cycle-image`, componentInstance.images() | truthy; [] | dom-structural | port | file-info.component.spec.ts |
| 230 | file-info/file-text/file-title carry their styling CSS classes | `.file-info`/`.file-text`/`.file-title` | all truthy | dom-structural | drop — duplicate of rows 205/206's structural presence; class-existence-for-styling carries no behavior | — |

## 15. player-toolbar/player-toolbar-actions/player-toolbar-actions.component.spec.ts (69 tests)

Public surface: `toggleShuffleMode()`, `isShuffleMode()`, `isFavorite()`,
`isFavoriteOperationInProgress()`, `toggleFavorite()`, `currentFile`, `durationOptions`,
`customTimerConfig()`, `isCustomTimerEnabled()`, `selectedDurationMs()`, `onTimerMenuItemClick()`,
`timerBadgeText()`. A recurring gap in the "Template Integration" describe: several tests titled
around icon/color/disabled DOM state only re-assert the same underlying signal already proven
elsewhere, never actually reading the rendered DOM — flagged once here and in Execution Notes
rather than per-row.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 231 | Component instantiates | component | truthy | state | port | player-toolbar-actions.component.spec.ts |
| 232 | The test's mock playerContext is defined | mockPlayerContext | defined | state | drop — asserts the test's own mock variable, not the component | — |
| 233 | The test's mock StorageStore is defined | mockStorageStore | defined | state | drop — asserts the test's own mock variable, not the component | — |
| 234 | toggleShuffleMode() forwards to the context with the deviceId | toggleShuffleMode(), IPlayerContext.toggleShuffleMode | called with deviceId | state | port | player-toolbar-actions.component.spec.ts |
| 235 | isShuffleMode reflects the context's launch mode | getLaunchMode, isShuffleMode() | true for Shuffle, false for Directory | state | port | player-toolbar-actions.component.spec.ts |
| 236 | isFavorite is false when no file is loaded | isFavorite() | false | state | port | player-toolbar-actions.component.spec.ts |
| 237 | isFavorite is true when the current file's flag is true | isFavorite() | true | state | port | player-toolbar-actions.component.spec.ts |
| 238 | isFavorite is false when the current file's flag is false | isFavorite() | false | state | port | player-toolbar-actions.component.spec.ts |
| 239 | isFavoriteOperationInProgress is false when idle | isFavoriteOperationInProgress() | false | state | port | player-toolbar-actions.component.spec.ts |
| 240 | isFavoriteOperationInProgress is true mid-save | isFavoriteOperationInProgress() | true | state | port | player-toolbar-actions.component.spec.ts |
| 241 | isFavoriteOperationInProgress is true mid-remove | isFavoriteOperationInProgress() | true | state | drop — duplicate of row 240; the two operations share one `isProcessing` flag with no distinguishing behavior | — |
| 242 | toggleFavorite() saves and updates the context when not favorited | toggleFavorite(), StorageStore.saveFavorite, IPlayerContext.updateCurrentFileFavoriteStatus | called with correct storage key/path; status set true | state | port | player-toolbar-actions.component.spec.ts |
| 243 | toggleFavorite() removes and updates the context when favorited | toggleFavorite(), StorageStore.removeFavorite, IPlayerContext.updateCurrentFileFavoriteStatus | called with correct storage key/path; status set false | state | port | player-toolbar-actions.component.spec.ts |
| 244 | toggleFavorite() is a no-op with no current file | toggleFavorite(), save/remove/update spies | none called | state | port | player-toolbar-actions.component.spec.ts |
| 245 | toggleFavorite() derives deviceId/storageType from the storage key | toggleFavorite(), StorageStore.saveFavorite | called with parsed identifiers | state | drop — duplicate of row 242's save-favorite wiring claim with different fixture data | — |
| 246 | toggleFavorite() doesn't update the context when the save operation errors | toggleFavorite(), updateCurrentFileFavoriteStatus | saveFavorite called; status update not called | state | port | player-toolbar-actions.component.spec.ts |
| 247 | toggleFavorite() returns early when an operation is already in progress | toggleFavorite(), save/remove/update spies | none called | state | port | player-toolbar-actions.component.spec.ts |
| 248 | currentFile computed signal is defined | currentFile | defined | state | drop — trivial existence check subsumed by every value-level currentFile() assertion that follows | — |
| 249 | currentFile is null when no file is loaded | currentFile() | null | state | port | player-toolbar-actions.component.spec.ts |
| 250 | currentFile returns the file from the context | currentFile() | equals the launched file | state | port | player-toolbar-actions.component.spec.ts |
| 251 | currentFile updates when the underlying signal changes | currentFile() before/after | tracks each set value | state | port | player-toolbar-actions.component.spec.ts |
| 252 | currentFile/isFavorite reactively track a nested favorite-flag update | currentFile(), isFavorite() before/after | false then true after the file object is replaced | state | port | player-toolbar-actions.component.spec.ts |
| 253 | At least one icon-button renders | `lib-icon-button` count | >= 1 | dom-structural | drop — superseded by row 254's exact-count assertion | — |
| 254 | Exactly 4 icon-buttons render (timer, history, shuffle, favorite) | `lib-icon-button` count | 4 | dom-structural | port | player-toolbar-actions.component.spec.ts |
| 255 | favorite_border icon shows when not favorited | isFavorite() | false | state | merge (see row 238) — the test never reads the icon element despite its title; duplicate of the isFavorite()=false claim | — |
| 256 | favorite icon shows when favorited | isFavorite() | true | state | merge (see row 237) — same gap; duplicate of isFavorite()=true | — |
| 257 | favorite button is disabled when no file is loaded | !currentFile() | true | state | merge (see row 249) — never reads the button's disabled attribute despite its title; duplicate of currentFile()===null | — |
| 258 | favorite button is disabled during an in-progress operation | isFavoriteOperationInProgress() | true | state | merge (see row 240) — never reads the button's disabled attribute; duplicate of the in-progress signal | — |
| 259 | Highlight color shows when favorited | isFavorite() | true | state | merge (see row 237) — never reads the button's color/class; duplicate of isFavorite()=true | — |
| 260 | Normal color shows when not favorited | isFavorite() | false | state | merge (see row 238) — never reads the button's color/class; duplicate of isFavorite()=false | — |
| 261 | durationOptions exposes 8 entries (test title claims 10 — stale name, see Execution Notes) | durationOptions | length 8 | state | port | player-toolbar-actions.component.spec.ts |
| 262 | durationOptions values are strictly ascending | durationOptions | each valueMs > the previous | state | port | player-toolbar-actions.component.spec.ts |
| 263 | durationOptions labels use s/m/h suffixes | durationOptions | each label matches its constant value | state | drop — pins the literal content of a static constant array; the format invariant (s/m/h shape) isn't asserted, just the exact strings | — |
| 264 | durationOptions millisecond values match the expected constants | durationOptions | each valueMs matches its constant value | state | drop — pins the literal content of the same static constant array as row 263 | — |
| 265 | customTimerConfig computed signal is defined | customTimerConfig | defined | state | drop — trivial existence check subsumed by every value-level assertion that follows | — |
| 266 | customTimerConfig is null when no config exists | customTimerConfig() | null | state | port | player-toolbar-actions.component.spec.ts |
| 267 | customTimerConfig returns the context's config | customTimerConfig() | equals the config | state | port | player-toolbar-actions.component.spec.ts |
| 268 | isCustomTimerEnabled defaults to false | isCustomTimerEnabled() | false | state | port | player-toolbar-actions.component.spec.ts |
| 269 | isCustomTimerEnabled is true when the config is enabled | isCustomTimerEnabled() | true | state | port | player-toolbar-actions.component.spec.ts |
| 270 | isCustomTimerEnabled is false when the config is disabled | isCustomTimerEnabled() | false | state | drop — duplicate of row 268's default-false claim | — |
| 271 | selectedDurationMs defaults to 180000 | selectedDurationMs() | 180000 | state | port | player-toolbar-actions.component.spec.ts |
| 272 | selectedDurationMs returns the config's duration | selectedDurationMs() | matches config | state | port | player-toolbar-actions.component.spec.ts |
| 273 | isCustomTimerEnabled updates reactively across config changes | isCustomTimerEnabled() across 3 sets | false, true, false | state | port | player-toolbar-actions.component.spec.ts |
| 274 | selectedDurationMs updates reactively across config changes | selectedDurationMs() across 3 sets | 180000, 30000, 3600000 | state | port | player-toolbar-actions.component.spec.ts |
| 275 | A null config yields default values for all three computeds together | customTimerConfig(), isCustomTimerEnabled(), selectedDurationMs() | null; false; 180000 | state | drop — duplicate combination of rows 266/268/271, each independently proven with a null config | — |
| 276 | onTimerMenuItemClick method is defined | onTimerMenuItemClick | defined | state | drop — trivial existence check subsumed by every call-level assertion that follows | — |
| 277 | Selecting 'Off' disables the timer via setCustomTimer | onTimerMenuItemClick(null), setCustomTimer | called with (deviceId, false, existingDuration) | state | port | player-toolbar-actions.component.spec.ts |
| 278 | Selecting a duration enables the timer via setCustomTimer | onTimerMenuItemClick(ms), setCustomTimer | called with (deviceId, true, ms) | state | port | player-toolbar-actions.component.spec.ts |
| 279 | Selecting 'Off' preserves the existing duration | onTimerMenuItemClick(null), setCustomTimer | called with (deviceId, false, 30000) | state | merge (see row 277) — same call pattern with a different starting duration | — |
| 280 | The timer button renders in the template | `[data-testid="timer-button"]` | truthy | dom-structural | port | player-toolbar-actions.component.spec.ts |
| 281 | Highlight color shows when the timer is enabled | isCustomTimerEnabled() | true | state | merge (see row 269) — never reads the button's color/class; duplicate of the enabled signal | — |
| 282 | Normal color shows when the timer is disabled | isCustomTimerEnabled() | false | state | merge (see row 268) — never reads the button's color/class; duplicate of the disabled signal | — |
| 283 | onTimerMenuItemClick() is a no-op with an empty deviceId | onTimerMenuItemClick(null), setCustomTimer | not called; no throw | state | port | player-toolbar-actions.component.spec.ts |
| 284 | timerBadgeText computed signal is defined | timerBadgeText | defined | state | drop — trivial existence check subsumed by every value-level assertion that follows | — |
| 285 | timerBadgeText reflects the selected duration (30s/3m/1h) | timerBadgeText() | '30s', '3m', '1h' across three durations | state | port | player-toolbar-actions.component.spec.ts |
| 286 | timerBadgeText defaults to '3m' when config is null | timerBadgeText() | '3m' | state | port | player-toolbar-actions.component.spec.ts |
| 287 | The timer dropdown menu renders in the template | `lib-dropdown-menu` | truthy | dom-structural | port | player-toolbar-actions.component.spec.ts |
| 288 | Invoking onTimerMenuItemClick(null) via a spy calls setCustomTimer | vi.spyOn(setCustomTimer) | called with (deviceId, false, 180000) | state | drop — duplicate of row 277, spy-wrapped variant of the same call | — |
| 289 | Invoking onTimerMenuItemClick(duration) via a spy calls setCustomTimer | vi.spyOn(setCustomTimer) | called with (deviceId, true, 30000) | state | drop — duplicate of row 278, spy-wrapped variant of the same call | — |
| 290 | Selecting a new duration keeps the timer enabled | onTimerMenuItemClick(ms), setCustomTimer | called with (deviceId, true, 60000) | state | merge (see row 278) — same enable-with-duration call pattern | — |
| 291 | Selecting a duration while off enables the timer | onTimerMenuItemClick(ms), setCustomTimer | called with (deviceId, true, 30000) | state | merge (see row 278) — duplicate of the enable-with-duration claim | — |
| 292 | A null config in the timer menu doesn't throw and reports disabled | onTimerMenuItemClick(null), isCustomTimerEnabled() | no throw; false | state | drop — duplicate combination of rows 268/283's null-safety claims | — |
| 293 | Empty deviceId is a no-op for a duration click | onTimerMenuItemClick(ms), setCustomTimer | not called | state | merge (see row 283) — same empty-deviceId guard, different click variant | — |
| 294 | Empty deviceId is a no-op for an 'Off' click | onTimerMenuItemClick(null), setCustomTimer | not called | state | merge (see row 283) — same empty-deviceId guard | — |
| 295 | Two devices maintain independent timer configs | getPlayTimerConfig (per-device), isCustomTimerEnabled(), selectedDurationMs(), timerBadgeText() | device-1: true/30000/'30s'; device-2: false/180000/'3m' | state | port | player-toolbar-actions.component.spec.ts |
| 296 | Component destruction doesn't throw | fixture.destroy() | no throw | state | drop — generic lifecycle smoke test, no distinct behavioral claim | — |
| 297 | durationOptions values are all positive and unique | durationOptions | every value > 0; no duplicates | state | drop — invariant implied by row 262's strictly-ascending-order assertion | — |
| 298 | selectedDurationMs defaults to 180000 when config is null | selectedDurationMs() | 180000 | state | drop — duplicate of row 271's default-duration claim | — |
| 299 | isCustomTimerEnabled defaults to false when config is null | isCustomTimerEnabled() | false | state | drop — duplicate of row 268's default-enabled claim | — |

## 16. player-toolbar/player-toolbar.component.spec.ts (58 tests)

Public surface: `playPause()`/`stop()`/`next()`/`previous()`, `getPlayPauseIconComputed()`,
`getPlayPauseLabelComputed()`, `isCurrentFileMusicTypeComputed()`, `canNavigateComputed()`,
`canNavigatePreviousComputed()`, `getPlayerStatus()`, `getPlayButtonColorComputed()`,
`hasError()`, `disabled` input, rendered playback buttons via `IconButtonComponent` query,
`lib-volume-control`. The full-size sibling of `player-toolbar-mini`; same behavior family, more
states (paused, error-color, click-triggers-method).

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 300 | Component instantiates | component | truthy | state | port | player-toolbar.component.spec.ts |
| 301 | playPause() calls pause while playing | playPause(), pause/play | pause called; play not called | state | port | player-toolbar.component.spec.ts |
| 302 | playPause() calls play while stopped | playPause(), play/pause | play called; pause not called | state | port | player-toolbar.component.spec.ts |
| 303 | playPause() calls play while paused | playPause(), play/pause | play called; pause not called | state | port | player-toolbar.component.spec.ts |
| 304 | playPause() is a no-op with an empty deviceId | playPause(), play/pause | neither called | state | port | player-toolbar.component.spec.ts |
| 305 | stop() calls the context's stop with the deviceId | stop(), IPlayerContext.stop | called with deviceId | state | port | player-toolbar.component.spec.ts |
| 306 | stop() is a no-op with an empty deviceId | stop(), IPlayerContext.stop | not called | state | port | player-toolbar.component.spec.ts |
| 307 | next() calls the context's next with the deviceId | next(), IPlayerContext.next | called with deviceId | state | port | player-toolbar.component.spec.ts |
| 308 | next() is a no-op with an empty deviceId | next(), IPlayerContext.next | not called | state | port | player-toolbar.component.spec.ts |
| 309 | previous() calls the context's previous with the deviceId | previous(), IPlayerContext.previous | called with deviceId | state | port | player-toolbar.component.spec.ts |
| 310 | previous() is a no-op with an empty deviceId | previous(), IPlayerContext.previous | not called | state | port | player-toolbar.component.spec.ts |
| 311 | Play/pause icon is play_arrow when Stopped | getPlayPauseIconComputed() | 'play_arrow' | state | port | player-toolbar.component.spec.ts |
| 312 | Play/pause icon is play_arrow when Paused | getPlayPauseIconComputed() | 'play_arrow' | state | port | player-toolbar.component.spec.ts |
| 313 | Play/pause icon is pause when Playing | getPlayPauseIconComputed() | 'pause' | state | port | player-toolbar.component.spec.ts |
| 314 | Play/pause icon is play_arrow with an empty deviceId | getPlayPauseIconComputed() | 'play_arrow' | state | port | player-toolbar.component.spec.ts |
| 315 | Play/pause label is 'Play' when Stopped | getPlayPauseLabelComputed() | 'Play' | state | port | player-toolbar.component.spec.ts |
| 316 | Play/pause label is 'Play' when Paused | getPlayPauseLabelComputed() | 'Play' | state | port | player-toolbar.component.spec.ts |
| 317 | Play/pause label is 'Pause' when Playing | getPlayPauseLabelComputed() | 'Pause' | state | port | player-toolbar.component.spec.ts |
| 318 | Play/pause label is 'Play' with an empty deviceId | getPlayPauseLabelComputed() | 'Play' | state | port | player-toolbar.component.spec.ts |
| 319 | Music-type detection is true for a Song | isCurrentFileMusicTypeComputed() | true | state | port | player-toolbar.component.spec.ts |
| 320 | Music-type detection is false for a Game | isCurrentFileMusicTypeComputed() | false | state | port | player-toolbar.component.spec.ts |
| 321 | Music-type detection is false for an Image | isCurrentFileMusicTypeComputed() | false | state | port | player-toolbar.component.spec.ts |
| 322 | Music-type detection is false with no current file | isCurrentFileMusicTypeComputed() | false | state | port | player-toolbar.component.spec.ts |
| 323 | Music-type detection is false with an empty deviceId | isCurrentFileMusicTypeComputed() | false | state | port | player-toolbar.component.spec.ts |
| 324 | canNavigate is true with multiple files in context | canNavigateComputed() | true | state | port | player-toolbar.component.spec.ts |
| 325 | canNavigate is false with a single file in context | canNavigateComputed() | false | state | port | player-toolbar.component.spec.ts |
| 326 | canNavigate is true in shuffle mode regardless of context | canNavigateComputed() | true | state | port | player-toolbar.component.spec.ts |
| 327 | canNavigate is false with no context outside shuffle mode | canNavigateComputed() | false | state | port | player-toolbar.component.spec.ts |
| 328 | canNavigate is false with an empty deviceId | canNavigateComputed() | false | state | port | player-toolbar.component.spec.ts |
| 329 | canNavigatePrevious delegates to canNavigate | canNavigatePreviousComputed(), canNavigateComputed() | equal; both true | state | drop — proves delegation to an already-fully-covered computed (rows 324-328), no independent behavior | — |
| 330 | getPlayerStatus returns the context's status | getPlayerStatus() | Playing | state | port | player-toolbar.component.spec.ts |
| 331 | getPlayerStatus returns Stopped with an empty deviceId | getPlayerStatus() | Stopped | state | port | player-toolbar.component.spec.ts |
| 332 | Play/pause button shows for music files | icon-button (Play\|Pause label) | truthy; icon matches play_arrow/pause | dom-structural | port | player-toolbar.component.spec.ts |
| 333 | Stop button shows for non-music files | icon-button ('Stop Playback' label) | truthy; icon 'stop' | dom-structural | port | player-toolbar.component.spec.ts |
| 334 | Navigation buttons are disabled when canNavigate is false | next/previous icon-buttons | both truthy; disabled() true | state | port | player-toolbar.component.spec.ts |
| 335 | Navigation buttons are enabled when canNavigate is true | next/previous icon-buttons | both truthy; disabled() false | state | port | player-toolbar.component.spec.ts |
| 336 | Clicking the play/pause button triggers playPause() | native button click, playPause spy | called | state | port | player-toolbar.component.spec.ts |
| 337 | Clicking the next button triggers next() | native button click, next spy | called | state | port | player-toolbar.component.spec.ts |
| 338 | Clicking the previous button triggers previous() | native button click, previous spy | called | state | port | player-toolbar.component.spec.ts |
| 339 | Play button shows error color when the file is incompatible | getPlayButtonColorComputed() | 'error' | state | port | player-toolbar.component.spec.ts |
| 340 | Play button shows normal color when the file is compatible | getPlayButtonColorComputed() | 'normal' | state | port | player-toolbar.component.spec.ts |
| 341 | Play button shows normal color when no file is loaded | getPlayButtonColorComputed() | 'normal' | state | port | player-toolbar.component.spec.ts |
| 342 | Play button shows normal color when disabled, even if the file is incompatible | getPlayButtonColorComputed() | 'normal' | state | port | player-toolbar.component.spec.ts |
| 343 | hasError is true when an error is set | hasError() | true | state | port | player-toolbar.component.spec.ts |
| 344 | hasError is false when the error is null | hasError() | false | state | port | player-toolbar.component.spec.ts |
| 345 | disabled input defaults to false | disabled() | false | state | port | player-toolbar.component.spec.ts |
| 346 | disabled input accepts true | disabled() | true | state | port | player-toolbar.component.spec.ts |
| 347 | disabled-state class is added to the host when disabled | nativeElement.classList | contains 'disabled-state' | dom-structural | port | player-toolbar.component.spec.ts |
| 348 | disabled-state class is absent when not disabled | nativeElement.classList | doesn't contain 'disabled-state' | dom-structural | port | player-toolbar.component.spec.ts |
| 349 | All playback buttons are disabled when disabled=true | previous/next/play-pause componentInstance.disabled() | all true | state | port | player-toolbar.component.spec.ts |
| 350 | Playback buttons are enabled when disabled=false and navigation is possible | previous/next/play-pause componentInstance.disabled() | all false | state | port | player-toolbar.component.spec.ts |
| 351 | Volume control renders when audio streaming is enabled | `lib-volume-control` count | > 0 | dom-structural | port | player-toolbar.component.spec.ts |
| 352 | Volume control is absent when audio streaming is disabled | `lib-volume-control` count | 0 | dom-structural | port | player-toolbar.component.spec.ts |
| 353 | Volume control receives disabled=true matching the toolbar's disabled state | `lib-volume-control` componentInstance.disabled() | true | state | port | player-toolbar.component.spec.ts |
| 354 | Volume control receives disabled=false when the toolbar is enabled | `lib-volume-control` componentInstance.disabled() | false | state | port | player-toolbar.component.spec.ts |
| 355 | Audio-stream-enabled lookup uses the component's deviceId | SettingsStore.enableAudioStreamForDevice | called with 'test-device-id' | state | drop — asserts a mocked collaborator called with exactly the input the test set; show/hide behavior already proven by rows 351/352 | — |
| 356 | Volume control shows/hides reactively as the audio-stream setting changes | `lib-volume-control` count | 0 then > 0 | dom-structural | drop — duplicate of rows 351/352's static before/after states | — |
| 357 | Volume control renders inside a `.volume-control-section` wrapper | `.volume-control-section`, nested `lib-volume-control` | both truthy | dom-structural | port | player-toolbar.component.spec.ts |

## 17. player-toolbar/volume-control/volume-control.component.spec.ts (18 tests)

Public surface: `AudioStore` (mocked), rendered mute icon-button/`.volume-slider`, `compact`/
`disabled` inputs. Sibling of `volume-popup.component.spec.ts` (rows 32-42) but this spec never
asserts a computed icon/aria signal directly — every icon claim is read from DOM textContent only,
unlike volume-popup's `volumeIcon()`/`muteAriaLabel()` tests. Flagged in Execution Notes as a
candidate to gain the same computed-signal coverage during the rebuild if the component exposes
(or can expose) an equivalent internal computed.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 358 | Component instantiates | component | truthy | state | port | volume-control.component.spec.ts |
| 359 | Muted state shows the volume_off icon | mat-icon textContent | 'volume_off' | dom-copy | port (re-expressed as state if an icon-selection computed exists; otherwise dom-structural presence) | volume-control.component.spec.ts |
| 360 | Volume >= 0.5 unmuted shows volume_up | mat-icon textContent | 'volume_up' | dom-copy | port (re-expressed as state, see row 359's note) | volume-control.component.spec.ts |
| 361 | Volume < 0.5 and > 0 unmuted shows volume_down | mat-icon textContent | 'volume_down' | dom-copy | port (re-expressed as state, see row 359's note) | volume-control.component.spec.ts |
| 362 | Volume exactly 0 unmuted shows volume_mute | mat-icon textContent | 'volume_mute' | dom-copy | port (re-expressed as state, see row 359's note) | volume-control.component.spec.ts |
| 363 | Volume exactly 0.5 (boundary) shows volume_up | mat-icon textContent | 'volume_up' | dom-copy | port (re-expressed as state, see row 359's note) | volume-control.component.spec.ts |
| 364 | Clicking the mute button calls toggleMute | native button click, AudioStore.toggleMute | called once | state | port | volume-control.component.spec.ts |
| 365 | Changing the slider calls setMasterVolume with the new value | slider input event, AudioStore.setMasterVolume | called with 0.42 | state | port | volume-control.component.spec.ts |
| 366 | The slider's value reflects the masterVolume signal | `.volume-slider` value | ~0.6 | dom-structural | port | volume-control.component.spec.ts |
| 367 | Slider shows by default (compact not provided) | `.volume-slider` | truthy | dom-structural | port | volume-control.component.spec.ts |
| 368 | Slider shows when compact is explicitly false | `.volume-slider` | truthy | dom-structural | drop — duplicate of row 367's default-false claim | — |
| 369 | Slider is hidden when compact is true | `.volume-slider` | null | dom-structural | port | volume-control.component.spec.ts |
| 370 | Mute icon-button still shows in compact mode | `lib-icon-button` | truthy | dom-structural | port | volume-control.component.spec.ts |
| 371 | Clicking the mute button calls toggleMute in compact mode | native button click, AudioStore.toggleMute | called once | state | drop — duplicate of row 364's click-wiring claim; compact mode doesn't affect this handler | — |
| 372 | Muted state shows volume_off in compact mode | mat-icon textContent | 'volume_off' | dom-copy | drop — duplicate of row 359's muted-icon claim; compact mode doesn't affect icon-selection logic | — |
| 373 | Mute button is disabled when the disabled input is true | native button.disabled | true | dom-structural | port | volume-control.component.spec.ts |
| 374 | Slider is disabled when the disabled input is true | `.volume-slider`.disabled | true | dom-structural | port | volume-control.component.spec.ts |
| 375 | The container carries a disabled CSS class when disabled | `.volume-control`.classList | contains 'disabled' | dom-structural | port | volume-control.component.spec.ts |

## 18. storage-container/directory-files/directory-files.component.spec.ts (34 tests)

Public surface: `directoriesAndFiles()`, `isDirectory()`, `onItemSelected()`/`selectedItem()`,
`onDirectoryDoubleClick()`/`onFileDoubleClick()`, `isSelected()`, `isCurrentlyPlaying()`,
`hasCurrentFileError()`, `isDeviceLevelView()`, `storageDevices()`,
`onStorageDeviceSelected()`/`onStorageDeviceDoubleClick()`/`isStorageDeviceSelected()`,
rendered `cdk-virtual-scroll-viewport`, `lib-directory-trail-container` (mocked),
`lib-search-toolbar` (mocked). The one file in this corpus using `NO_ERRORS_SCHEMA`-style
`overrideComponent` (stub replacements for `DirectoryTrailContainerComponent`/
`SearchToolbarComponent` to avoid their store dependencies) — noted per the handoff's measured
baseline. Several tests explicitly comment that virtual-scroll DOM rendering can't be relied on in
the test environment and fall back to asserting component state instead; those DOM-title claims
are noted per row.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 376 | Component instantiates | component | truthy | state | port | directory-files.component.spec.ts |
| 377 | Directories and files combine into one tagged data source | directoriesAndFiles() | 2 items; itemType 'directory' then 'file' | state | port | directory-files.component.spec.ts |
| 378 | The directory type guard correctly discriminates entries | isDirectory() | true for the directory entry, false for the file entry | state | port | directory-files.component.spec.ts |
| 379 | Clicking an item updates the selection | onItemSelected(), selectedItem() | equals the clicked item | state | port | directory-files.component.spec.ts |
| 380 | Double-clicking a directory navigates into it | onDirectoryDoubleClick(), StorageStore.navigateToDirectory | called with deviceId/storageType/path | state | port | directory-files.component.spec.ts |
| 381 | Navigating into a directory clears the current selection | onItemSelected(), onDirectoryDoubleClick(), selectedItem() | truthy then null | state | port | directory-files.component.spec.ts |
| 382 | Double-clicking a file launches it via the player context | onFileDoubleClick(), IPlayerContext.launchFileWithContext | called with deviceId/storageType/file/directoryPath/files/launchMode | state | port | directory-files.component.spec.ts |
| 383 | A real dblclick DOM event on the rendered file item triggers the launch | dblclick dispatch on `lib-storage-item`, launchFileWithContext | called | state | port | directory-files.component.spec.ts |
| 384 | Items render inside the virtual scroll viewport | `.file-list-item` count | between 0 and 2 (inclusive) | dom-structural | drop — the asserted range is satisfied even by zero rendered items, so the test's own comment admits it proves nothing in this environment | — |
| 385 | isSelected correctly reports selection state per item | onItemSelected(), isSelected() | true for the selected item, false for others | state | port | directory-files.component.spec.ts |
| 386 | isCurrentlyPlaying reflects the context's current file | getCurrentFile (mocked), isCurrentlyPlaying() | false before, true after the mock updates | state | port | directory-files.component.spec.ts |
| 387 | The currently playing file is auto-selected when directory context is available | getCurrentFile, getFileContext (mocked), selectedItem() | path matches the playing file | state | port | directory-files.component.spec.ts |
| 388 | hasCurrentFileError is false with no error | hasCurrentFileError() | false | state | port | directory-files.component.spec.ts |
| 389 | hasCurrentFileError is true when the context reports an error | getError (mocked), hasCurrentFileError() | true | state | port | directory-files.component.spec.ts |
| 390 | The playing file's data-is-playing attribute reflects its state | isCurrentlyPlaying() (DOM attribute check explicitly skipped per the test's own comment) | true | state | drop — duplicate of row 386; the test's title claims a DOM attribute it never actually reads | — |
| 391 | The erroring file's data-has-error attribute reflects its state | hasCurrentFileError(), isCurrentlyPlaying() (DOM attribute check explicitly skipped per the test's own comment) | true; true | state | drop — duplicate combination of rows 386/389; doesn't verify the DOM attribute its title claims | — |
| 392 | The virtual scroll viewport initializes with the correct item size | `cdk-virtual-scroll-viewport` itemsize attribute | '42' | dom-structural | port | directory-files.component.spec.ts |
| 393 | The viewport automatically scrolls to the playing file | rendered `.file-list-item[data-item-path]` OR selectedItem() fallback | either branch | dom-structural | drop — the assertion branches on an environment-dependent rendering condition, and its fallback duplicates row 387's selectedItem() claim | — |
| 394 | The directory trail renders in the header slot at storage level | `lib-directory-trail-container`, `.header-toolbar[slot="header"]` | both truthy | dom-structural | port | directory-files.component.spec.ts |
| 395 | The directory trail is absent at device level | `lib-directory-trail-container` | falsy | dom-structural | port | directory-files.component.spec.ts |
| 396 | A 'Storage Devices' title renders at device level | `lib-scaling-card` textContent | contains 'Storage Devices' | dom-copy | port (re-expressed as dom-structural) — assert the card title area renders in the device-level state | directory-files.component.spec.ts |
| 397 | No card title renders at storage level since the trail replaces it | `.card-header .card-title` | empty/absent | dom-structural | port | directory-files.component.spec.ts |
| 398 | isDeviceLevelView reflects the store's device-level flag | StorageStore.isDeviceLevelView, isDeviceLevelView() | true | state | port | directory-files.component.spec.ts |
| 399 | storageDevices lists SD/USB entries at device level | storageDevices() | 2 entries with correct name/icon/deviceId/itemType | state | port | directory-files.component.spec.ts |
| 400 | storageDevices is empty when not at device level | storageDevices() | [] | state | port | directory-files.component.spec.ts |
| 401 | Selecting a storage device sets it as the selected item | onStorageDeviceSelected(), selectedItem() | storageType matches selected device | state | port | directory-files.component.spec.ts |
| 402 | Double-clicking a storage device navigates to its root | onStorageDeviceDoubleClick(), StorageStore.navigateToDirectory, selectedItem() | called with path '/'; selection cleared | state | port | directory-files.component.spec.ts |
| 403 | isStorageDeviceSelected correctly identifies the selected device | onStorageDeviceSelected(), isStorageDeviceSelected() | true for selected, false for the other | state | port | directory-files.component.spec.ts |
| 404 | The search toolbar renders in the header slot | `lib-search-toolbar` | truthy | dom-structural | port | directory-files.component.spec.ts |
| 405 | The deviceId is passed to the search toolbar | `lib-search-toolbar` presence (mocked component's input value never read) | truthy | dom-structural | drop — duplicate of row 404; despite its title, never reads the mock's `deviceId` input | — |
| 406 | The search toolbar renders inside the header-toolbar wrapper | `.header-toolbar`, nested `lib-search-toolbar` | both truthy | dom-structural | drop — duplicate combination of rows 394/404 | — |
| 407 | The header-toolbar wrapper carries slot="header" | `.header-toolbar[slot="header"]` | truthy | dom-structural | port | directory-files.component.spec.ts |
| 408 | The search toolbar renders at storage level (default state) | `lib-search-toolbar` | truthy | dom-structural | drop — duplicate of row 404's default-state precondition | — |
| 409 | The search toolbar also renders at device level | `lib-search-toolbar` | truthy | dom-structural | port | directory-files.component.spec.ts |

## 8. player-view.component.spec.ts (3 tests)

Public surface: `deviceStore`, `enabledDevices`.

| # | Behavior | Public surface | Asserts | Style | Disposition | Target file |
|---|---|---|---|---|---|---|
| 692 | Component instantiates | component | truthy | state | port | player-view.component.spec.ts |
| 693 | The device store is injected | component.deviceStore | truthy | state | port | player-view.component.spec.ts |
| 694 | Enabled devices is computed from the store | component.enabledDevices | function truthy; evaluates to [] for empty store | state | port | player-view.component.spec.ts |

---

