# TeensyROM UI Controls Reference

> **Purpose**: Quick-lookup reference for AI agents navigating the TeensyROM UI via Chrome DevTools MCP.
> Always snapshot before interacting. UIDs are ephemeral — re-snapshot after navigation or async operations.

## Quick Start

| Step | Tool | Notes |
|------|------|-------|
| Open page | `mcp_chrome-devtoo_new_page` or `navigate_page` | URL: `http://localhost:4200` — default route redirects to `/devices` |
| Snapshot | `mcp_chrome-devtoo_take_snapshot` | Returns accessibility tree with UIDs. **Always do this first.** |
| Click | `mcp_chrome-devtoo_click(uid)` | Use UID from latest snapshot |
| Fill text | `mcp_chrome-devtoo_fill(uid, value)` | For search fields, inputs |
| Wait | `mcp_chrome-devtoo_wait_for(text, timeout)` | Wait for text to appear in DOM |
| Screenshot | `mcp_chrome-devtoo_take_screenshot()` | Visual capture for verification |

---

## Critical: Blocking Dialogs

The app shows **modal busy dialogs** that block ALL interaction. You **must** wait for these to clear before interacting with any view.

| Dialog Title | Trigger | Wait Strategy |
|---|---|---|
| `"Finding Devices"` | App startup, Discover Devices button | Wait 15-20s, re-snapshot after |
| `"Indexing Storage"` | Index storage button | Wait 30-60s+ |
| `"Slow Launch Detected"` | File launch with firmware swap | Wait 10-15s |
| `"Updating Favorites"` | Toggle favorite | Wait 5-10s |

**Detection**: Snapshot shows `dialog` role with the title text. Wait for it to disappear, then re-snapshot.

---

## Routes

| Path | View | Ready Signal |
|------|------|-------------|
| `/devices` | Device management | `data-testid="device-view"` or text `"Discover Devices"` |
| `/player` | File browser + playback | `data-testid="player-toolbar"` or tree nodes visible |
| `/settings` | App/device/search config | Text `"Player Settings"` or section nav buttons |

---

## Global Shell

### Header (`lib-header`)

| Element | Identifier | Icon |
|---------|-----------|------|
| App title | Text `"TeensyROM"` | — |
| Version | Text `"vX.X.X"` | — |
| Theme toggle | Aria `"Toggle dark/light theme"` | `dark_mode` / `light_mode` |
| Tooltip toggle | Aria `"Toggle tooltips"` | `question_mark` |

### Navigation (Desktop: `lib-nav-rail` · Mobile: `lib-bottom-bar`)

| Item | Icon | Aria Label | Route |
|------|------|-----------|-------|
| Player | `play_arrow` | `"Player"` | `/player` |
| Devices | `devices` | `"Devices"` | `/devices` |
| Settings | `settings` | `"Settings"` | `/settings` |

Active item: `aria-current="page"`. Nav rail is hover-expandable (600ms) and pinnable via `"Pin navigation rail"`.

---

## Devices View (`/devices`)

### Device Card (`lib-device-item`)

| Element | Identifier | Example |
|---------|-----------|---------|
| Card | `data-testid="device-card"` | — |
| Power toggle | Aria `"Toggle Enabled"`, `data-testid="device-power-button"` | Highlighted = on |
| Device ID | `data-testid="device-id-label"` | `"Device ID: L5ZMCNBR"` |
| Firmware | `data-testid="device-firmware-label"` | `"Firmware: 0.7.0"` |
| IP Address | `data-testid="device-address-label"` | `"192.168.1.62:2112"` |
| COM Port | `data-testid="device-port-label"` | `"Port: COM3"` |
| Compatible | `data-testid="device-compatible-label"` | `"Compatible: Yes"` |
| USB Storage | `data-testid="usb-storage-status"` | `"USB Stick"` + Available/Unavailable |
| SD Storage | `data-testid="sd-storage-status"` | `"SD Card"` + Available/Unavailable |
| Index USB | `data-testid="storage-index-button-usb"` | Icon `download` |
| Index SD | `data-testid="storage-index-button-sd"` | Icon `download` |

Empty state: `"No devices found"` (`data-testid="empty-state-message"`)

### Device Toolbar (`lib-device-toolbar`)

| Button | Label | data-testid |
|--------|-------|-------------|
| Discover | `"Discover Devices"` | `"toolbar-button-discover-devices"` |
| Reset | `"Reset Devices"` | `"toolbar-button-reset-devices"` |
| Ping | `"Ping Devices"` | `"toolbar-button-ping-devices"` |
| Index All | `"Index All"` | `"toolbar-button-index-all"` |

### Device Logs (`lib-device-logs`)

| Button | Aria Label | When Visible |
|--------|-----------|-------------|
| Start | `"Start Logs"` | Disconnected |
| Stop | `"Stop Logs"` | Connected |
| Clear | `"Clear Logs"` | Always |

Empty: `"No logs to display."`

---

## Player View (`/player`)

**Empty state** (no enabled device): Title `"No Enabled Devices"`, message `"Enable a TeensyROM device to get started."`

### Image Panel (`lib-file-image`)

`lib-scaling-card` with creator name title, CRT effect wrapper around `lib-cycle-image` (8s auto-cycle). CRT settings available via `lib-video-controls-toolbar` overlay.

### Metadata Panel (`lib-file-other`)

| Section | Heading | Content |
|---------|---------|---------|
| Chips | *(corner slot)* | PAL/NTSC, SID chip type |
| Description | `"HVSC STIL"` | Song database info |
| Rating | *(star icon)* | `"X.X/5.0"` |
| Links | `"Links"` | External link items |
| YouTube | `"Related Videos"` | Play icon links |
| Competitions | `"Competition Results"` | Inline results |
| Tags | `"Tags"` | Chip set |

Empty: `"Try launching a file from the device."`

### Player Toolbar (`lib-player-toolbar`, `data-testid="player-toolbar"`)

Responsive: Desktop >900px, Tablet 641-900px, Mobile ≤640px

#### Playback Controls

| Button | Icon | Aria Hint |
|--------|------|----------|
| Previous | `skip_previous` | `"...launch the previous file..."` |
| Play/Pause | `play_arrow`/`pause` | `"Play"`/`"Pause"` (music files) |
| Stop | `stop` | `"Stops the current file..."` (non-music) |
| Next | `skip_next` | `"...launch the next random file..."` |

#### Toolbar Actions (`lib-player-toolbar-actions`)

| Button | Icon | Aria Label | data-testid |
|--------|------|-----------|-------------|
| Timer | `timer` | `"Enable/Disable Play Timer"` | `"timer-button"` |
| History | `history` | `"Toggle Play History"` | — |
| Shuffle | `shuffle` | `"Toggle Shuffle Mode"` | — |
| Favorite | `favorite`/`favorite_border` | `"Add/Remove from Favorites"` | `"favorite-button"` |

Timer menu items: `data-testid="timer-menu-off"`, `"timer-menu-15s"`, `"timer-menu-30s"`, `"timer-menu-1m"`, `"timer-menu-3m"`, `"timer-menu-5m"`, `"timer-menu-10m"`, `"timer-menu-30m"`, `"timer-menu-1h"`

### Filter Toolbar (`lib-filter-toolbar`)

| Button | Aria Hint | data-testid |
|--------|----------|-------------|
| All files | `"Filter: Allow All Files..."` | `"filter-all-button"` |
| Games | `"Filter Games/Programs Only..."` | `"filter-games-button"` |
| Music | `"Filter: Music Only..."` | `"filter-music-button"` |
| Images | `"Filter: Images / Text files..."` | `"filter-images-button"` |
| Random | `"Launch a random file..."` | `"random-launch-button"` |

### Storage Browser (`lib-storage-container`)

Left panel = directory tree · Right panel = files / search / history (conditional).

#### Directory Tree (`lib-directory-tree`)

`mat-tree` with expandable nodes. Toggle: `expand_more`/`chevron_right`, aria `"Toggle {name}"`. Nodes: `role="treeitem"`, `aria-label="{name}"`, `aria-pressed="{selected}"`.

#### Directory Navigation (`lib-directory-navigate`)

| Button | Icon | Aria Label |
|--------|------|-----------|
| Back | `arrow_back` | `"Previous directory in your navigation history"` |
| Forward | `arrow_forward` | `"Next directory in your navigation history"` |
| Up | `arrow_upward` | `"Go to parent directory..."` |
| Refresh | `refresh` | `"Synchronizes the current directory..."` |

#### Breadcrumb (`lib-directory-breadcrumb`)

`mat-chip` per path segment (clickable). Hidden segments: icon `folder`, aria `"Show hidden path segments"`.

#### Search (`lib-search-toolbar` + `lib-search-results`)

`lib-input-field` placeholder `"Search"`, clearable, Enter to execute. Results heading: `"Search Results"`. Empty states: `"Ready to Search"` or `"No Files Found"`.

#### Play History (`lib-play-history`)

Heading: `"Launch History"`. Empty: `"No Launch History"`.

#### File List (`lib-directory-files`)

Virtual scroll with `lib-file-item` entries. Attributes: `data-item-path`, `data-is-playing`, `data-has-error`. Click to launch.

---

## Settings View (`/settings`)

### Section Navigation

| Button | Label | Aria Label |
|--------|-------|-----------|
| Player | `"Player"` | `"Navigate to player settings"` |
| Devices | `"Devices"` | `"Navigate to device settings"` |
| Search | `"Search"` | `"Navigate to search settings"` |

### Toolbar

| Element | Label | Aria Label |
|---------|-------|-----------|
| Auto-save | `"Auto-save"` | — (`mat-slide-toggle`) |
| Save | `"Save"` | `"Save all changes"` |
| Undo | `"Undo"` | `"Undo the last saved change"` |
| Redo | `"Redo"` | `"Redo the last undone change"` |

### Player Settings (`lib-player-settings-section`, title `"Player Settings"`)

Dropdown: `"Startup Filter"`. Toggles: `"Enable repeat mode on startup"`, `"Enable play timer on startup"`, `"Mute on fast forward"`, `"Mute on random seek"`, `"Launch file on startup"`, `"Launch random file"`.

### Device Settings (`lib-device-settings-section`, title `"Device Settings"`)

Per-device sections. Toggle: `"Enable Video Overlay"`. Empty: `"No devices have been connected yet."`

### Search Settings (`lib-search-settings-section`, title `"Search Settings"`)

Sliders (0-10): `"File Name"`, `"Title"`, `"Creator"`, `"Release Info"`, `"Description"`. Textareas: `"Stop Words"`, `"Banned Directories"`, `"Banned Files"`.

### App Settings (`lib-app-settings-section`, title `"Application Settings"`)

Toggle: `"Initial setup completed"`.

---

## Common Recipes

### Navigate to a View
1. Snapshot → find nav item (aria `"Player"` / `"Devices"` / `"Settings"`)
2. Click it → wait for `"Finding Devices"` dialog to clear if present
3. Re-snapshot → verify ready signal from Routes table

### Launch a File
1. Player view → expand storage node (aria `"Toggle SD Card"`)
2. Click folder nodes to navigate
3. Click `lib-file-item` → wait for playback controls to update

### Search for a File
1. Player view → find `lib-input-field` (placeholder `"Search"`)
2. Fill text + Enter → wait for `"Search Results"` heading
3. Click result to launch

### Enable a Device
1. Devices view → find `data-testid="device-power-button"`
2. Click → highlighted = enabled

### Change Settings
1. Settings view → click section button (e.g., aria `"Navigate to player settings"`)
2. Modify controls → Save (aria `"Save all changes"`) or enable Auto-save

---

## Component Selectors (Quick Ref)

| Selector | Purpose |
|----------|---------|
| `lib-layout` | Main layout |
| `lib-header` | Top toolbar |
| `lib-nav-rail` | Desktop nav |
| `lib-bottom-bar` | Mobile nav |
| `lib-device-view` | Devices page |
| `lib-device-item` | Device card |
| `lib-device-toolbar` | Device actions |
| `lib-device-logs` | Log viewer |
| `lib-player-view` | Player page |
| `lib-file-image` | Image panel |
| `lib-file-other` | Metadata panel |
| `lib-video-capture` | Video panel |
| `lib-player-toolbar` | Playback controls |
| `lib-player-toolbar-actions` | Toolbar actions |
| `lib-filter-toolbar` | Filter bar |
| `lib-storage-container` | Storage browser |
| `lib-directory-tree` | Folder tree |
| `lib-directory-files` | File listing |
| `lib-directory-navigate` | Nav buttons |
| `lib-directory-breadcrumb` | Path chips |
| `lib-search-toolbar` | Search input |
| `lib-search-results` | Search results |
| `lib-play-history` | History list |
| `lib-settings-view` | Settings page |
| `lib-scaling-card` | Card container |
| `lib-icon-button` | Icon button |
| `lib-action-button` | Labeled button |
| `lib-input-field` | Text input |
| `lib-empty-state-message` | Empty state |
| `lib-crt-effect-wrapper` | CRT effect |
| `lib-crt-settings-panel` | CRT controls |
