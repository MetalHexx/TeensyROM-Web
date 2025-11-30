# TeensyROM CRT Emulation System

## Overview

The TeensyROM application features a comprehensive CRT (Cathode Ray Tube) emulation system that recreates the authentic visual experience of vintage monitors. This document covers the components, configuration, and best practices for implementing retro CRT visual effects throughout the application.

The CRT system uses **pure CSS** for all effects (scanlines, vignette, curvature, color filters) with no JavaScript animation overhead, making it performant and suitable for real-time video display.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [CRT Effect System](#crt-effect-system)
  - [CrtEffectWrapperComponent](#crteffectwrappercomponent)
  - [CrtSettingsPanelComponent](#crtsettingspanelcomponent)
- [Supporting Video Components](#supporting-video-components)
  - [VideoStreamComponent](#videostreamcomponent)
  - [VideoControlsToolbarComponent](#videocontrolstoolbarcomponent)
  - [VideoDeviceSelectorComponent](#videodeviceselectorcomponent)
  - [ContentOverlayContainerComponent](#contentoverlaycontainercomponent)
- [Configuration Reference](#configuration-reference)
  - [CrtSettings Interface](#crtsettings-interface)
  - [CrtSettingsConfig Interface](#crtsettingsconfig-interface)
  - [Preset Configurations](#preset-configurations)
- [Implementation Patterns](#implementation-patterns)
  - [Basic CRT Overlay](#basic-crt-overlay)
  - [Full Video Dialog Composition](#full-video-dialog-composition)
  - [Fullscreen with Aspect Ratio Handling](#fullscreen-with-aspect-ratio-handling)
- [Visual Effects Reference](#visual-effects-reference)
  - [Scanlines](#scanlines)
  - [Vignette](#vignette)
  - [Screen Curvature](#screen-curvature)
  - [Color Filters](#color-filters)
- [CSS Custom Properties](#css-custom-properties)
- [Best Practices](#best-practices)

---

## Architecture Overview

The CRT emulation system consists of cohesive components that work together:

| Component | Purpose |
|-----------|---------|
| `CrtEffectWrapperComponent` | Core component that applies CRT visual effects to any content |
| `CrtSettingsPanelComponent` | UI panel for real-time CRT effect adjustment |
| `VideoStreamComponent` | Displays MediaStream in video element (common CRT content) |
| `VideoControlsToolbarComponent` | Vertical toolbar with CRT toggle, settings, device, fullscreen controls |
| `VideoDeviceSelectorComponent` | Dropdown for selecting video capture devices |
| `ContentOverlayContainerComponent` | 9-slot layout container with hover-reveal overlays for composing video UIs |

**Typical Composition Pattern**:

```html
<lib-content-overlay-container [showOverlaysOnHover]="true">
  <!-- Video with CRT effects in content slot -->
  <lib-crt-effect-wrapper content [settings]="crtSettings" [contentAspectRatio]="4/3">
    <lib-video-stream [stream]="mediaStream"></lib-video-stream>
  </lib-crt-effect-wrapper>
  
  <!-- Controls toolbar in right slot -->
  <lib-video-controls-toolbar rightControls
    [isCrtEnabled]="crtEnabled()"
    (crtToggleClick)="toggleCrt()">
  </lib-video-controls-toolbar>
  
  <!-- Device selector in left slot -->
  <lib-video-device-selector leftControls
    [devices]="devices()"
    [selectedDeviceId]="selectedId()"
    (deviceSelected)="onDeviceSelected($event)">
  </lib-video-device-selector>
  
  <!-- CRT settings panel in left slot -->
  <lib-crt-settings-panel leftControls
    [settings]="crtSettings()"
    [visible]="showCrtPanel()"
    (settingsChange)="onSettingsChange($event)">
  </lib-crt-settings-panel>
</lib-content-overlay-container>
```

---

## CRT Effect System

The CRT effect system consists of two cohesive components that share the same configuration model:

- **`CrtEffectWrapperComponent`** - Applies CRT visual effects to any content
- **`CrtSettingsPanelComponent`** - UI panel for adjusting CRT settings

Both components accept `CrtSettings` (values) and `CrtSettingsConfig` (feature flags) to work together seamlessly.

### `CrtEffectWrapperComponent`

**Purpose**: A pure presentation wrapper component that applies CRT (cathode ray tube) visual effects to any projected content via CSS custom properties. Encapsulates scanlines, vignette, screen curvature, and color filter effects without any store dependencies. Supports fullscreen mode with proper aspect ratio handling for non-native content (e.g., 4:3 video on 16:9 screen).

**Selector**: `lib-crt-effect-wrapper`

**Properties**:

- `settings` (optional): `CrtSettings` - CRT effect configuration values. Use `CRT_PRESETS` for common configurations or provide custom values. Defaults to `DEFAULT_CRT_SETTINGS` (full CRT experience).
- `config` (optional): `CrtSettingsConfig` - Controls which effect groups are enabled. Use `CRT_CONFIGS` for common configurations. Defaults to `DEFAULT_CRT_CONFIG` (all groups enabled).
- `enabled` (optional): `boolean` - Whether CRT effects are applied. When false, content renders without effects with smooth transition. Defaults to `true`.
- `contentAspectRatio` (optional): `number | null` - Content aspect ratio (width/height) for proper effect positioning in fullscreen. When provided and content uses `object-fit: contain`, CRT effects are constrained to the visible content area via clip-path, avoiding curvature/vignette on black bars. Example: `4/3` for 4:3 video, `16/9` for 16:9 video. Defaults to `null`.

**Usage Examples**:

```html
<!-- Full CRT effects on video -->
<lib-crt-effect-wrapper [settings]="CRT_PRESETS.full" [enabled]="showCrt">
  <lib-video-stream [stream]="mediaStream"></lib-video-stream>
</lib-crt-effect-wrapper>

<!-- Standard preset (no curvature) for embedded previews -->
<lib-crt-effect-wrapper [settings]="CRT_PRESETS.standard">
  <img [src]="screenshot" alt="Screenshot" />
</lib-crt-effect-wrapper>

<!-- Small preset with subtle scanlines for compact displays -->
<lib-crt-effect-wrapper [settings]="CRT_PRESETS.small">
  <lib-video-stream [stream]="retroStream"></lib-video-stream>
</lib-crt-effect-wrapper>

<!-- 4:3 video with proper fullscreen handling (effects constrained to visible area) -->
<lib-crt-effect-wrapper
  [settings]="crtSettings()"
  [contentAspectRatio]="4/3">
  <lib-video-stream [stream]="stream" [objectFit]="'contain'"></lib-video-stream>
</lib-crt-effect-wrapper>

<!-- Custom settings blend -->
<lib-crt-effect-wrapper [settings]="{ ...CRT_PRESETS.standard, brightness: 1.2 }">
  <lib-video-stream [stream]="retroStream"></lib-video-stream>
</lib-crt-effect-wrapper>

<!-- Toggle effects on/off -->
<lib-crt-effect-wrapper [enabled]="crtEnabled()">
  <div class="terminal-output">...</div>
</lib-crt-effect-wrapper>
```

**TypeScript Import**:

```typescript
import {
  CrtEffectWrapperComponent,
  CrtSettings,
  CrtSettingsConfig,
  CRT_PRESETS,
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
} from '@teensyrom-nx/ui/components';
```

**Features**:

- **Content Agnostic**: Wraps any projected content (video, images, text, etc.)
- **Preset System**: Four pre-configured presets for common use cases
- **Config System**: Feature flags control which effect groups are applied
- **Cohesive with Settings Panel**: Same config model works with `lib-crt-settings-panel`
- **Customizable**: Spread presets to override individual values
- **Smooth Transitions**: 300ms CSS transitions for enable/disable toggle
- **CSS-Only Effects**: All effects via pseudo-elements and CSS filters (no JS animation overhead)
- **Effect Isolation**: Scanlines/vignette via ::before/::after, filters on content wrapper
- **Fullscreen Aspect Ratio**: Automatically calculates clip-path to constrain effects to visible content area when `contentAspectRatio` is provided

**Visual Properties**:

- Container fills parent (`width: 100%; height: 100%`)
- Scanlines: Repeating horizontal dark bands via CSS gradient
- Vignette: Radial + linear gradients with blur for edge darkening
- Screen Curvature: CSS border-radius with overflow hidden
- Filters: CSS filter property on content wrapper

**Fullscreen Aspect Ratio Behavior**:

When `contentAspectRatio` is provided and the content uses `object-fit: contain`:

- **Letterboxing** (4:3 on 16:9 screen): CRT effects constrained to visible video area, black bars remain unaffected
- **Pillarboxing** (16:9 on 4:3 screen): Same behavior for vertical black bars
- **Clip-path Calculation**: Automatically computes inset percentages based on container vs. content aspect ratio
- **ResizeObserver Integration**: Updates clip-path dynamically when container resizes

**Best Practice**: Use presets for most scenarios - they cover the common CRT aesthetic needs. Only create custom settings when you need precise control. For fullscreen video with non-native aspect ratios, always provide `contentAspectRatio` to ensure effects don't appear on black letterbox/pillarbox areas.

**Intended Use Cases**:

- Video dialog/capture displays (with full CRT)
- Fullscreen video with proper aspect ratio handling
- Terminal/log output displays
- Retro-themed UI elements
- Any content needing vintage monitor aesthetics

**Used In**:

- [`video-dialog.component.html`](../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.html) - Video capture dialog

---

### `CrtSettingsPanelComponent`

**Purpose**: A configurable settings panel for CRT visual effects. Works cohesively with `lib-crt-effect-wrapper` using the same `CrtSettings` and `CrtSettingsConfig` interfaces. Displays sliders only for effect groups enabled in the `config` input.

**Selector**: `lib-crt-settings-panel`

**Properties**:

- `settings` (optional): `CrtSettings` - Current CRT settings values that populate the sliders. Defaults to `DEFAULT_CRT_SETTINGS`.
- `config` (optional): `CrtSettingsConfig` - Controls which effect groups/sliders are shown. Defaults to `DEFAULT_CRT_CONFIG` (all groups visible).
- `visible` (optional): `boolean` - Controls panel visibility when used in overlay contexts. Defaults to `true`.
- `cardClass` (optional): `string` - Additional CSS class(es) to forward to the inner compact card layout. Use this to apply context-specific styling like height constraints. Defaults to `''`.

**Events**:

| Event | Type | Description |
|-------|------|-------------|
| `settingsChange` | `CrtSettings` | Emits when any slider value changes. Emits complete settings object. |
| `resetRequested` | `void` | Emits when reset button is clicked. Parent should apply `DEFAULT_CRT_SETTINGS`. |
| `presetSelected` | `CrtPresetName` | Emits when preset is selected from menu. Parent should apply `CRT_PRESETS[name]`. |

**Slider Configurations**:

| Setting | Min | Max | Step | Format |
|---------|-----|-----|------|
| Scanline Intensity | 0 | 1.0 | 0.01 | 2 decimals |
| Scanline Size | 1.0 | 6.0 | 0.1 | px suffix |
| Vignette | 0 | 2 | 0.05 | 2 decimals |
| Screen Curvature | 0 | 115 | 5 | px suffix |
| Contrast | 0.8 | 1.5 | 0.05 | 2 decimals |
| Brightness | 0.8 | 2.0 | 0.05 | 2 decimals |
| Saturation | 0.8 | 1.5 | 0.05 | 2 decimals |

**Usage Examples**:

```html
<!-- Full settings panel (all 7 sliders) -->
<lib-crt-settings-panel
  [settings]="crtSettings()"
  (settingsChange)="onSettingsChange($event)"
  (resetRequested)="onReset()"
  (presetSelected)="onPresetSelect($event)">
</lib-crt-settings-panel>

<!-- Standard preset config (no curvature slider) -->
<lib-crt-settings-panel
  [settings]="crtSettings()"
  [config]="CRT_CONFIGS.standard"
  (settingsChange)="onSettingsChange($event)">
</lib-crt-settings-panel>

<!-- With custom card styling -->
<lib-crt-settings-panel
  [settings]="crtSettings()"
  [cardClass]="'max-height-panel'"
  (settingsChange)="onSettingsChange($event)">
</lib-crt-settings-panel>

<!-- In overlay container slot -->
<lib-content-overlay-container>
  <lib-crt-settings-panel leftControls
    [settings]="crtSettings()"
    [visible]="showPanel()"
    (settingsChange)="onSettingsChange($event)">
  </lib-crt-settings-panel>
</lib-content-overlay-container>
```

**Cohesive Usage with CrtEffectWrapper**:

```html
<!-- Both components share the same settings and config -->
<lib-crt-effect-wrapper
  [settings]="crtSettings()"
  [config]="CRT_CONFIGS.standard"
  [enabled]="crtEnabled()">
  <lib-video-stream [stream]="mediaStream"></lib-video-stream>
</lib-crt-effect-wrapper>

<lib-crt-settings-panel
  [settings]="crtSettings()"
  [config]="CRT_CONFIGS.standard"
  (settingsChange)="crtSettings.set($event)">
</lib-crt-settings-panel>
```

**TypeScript Import**:

```typescript
import {
  CrtSettingsPanelComponent,
  CrtPresetName,
  CrtSettings,
  CrtSettingsConfig,
  CRT_PRESETS,
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
} from '@teensyrom-nx/ui/components';
```

**Features**:

- **Config-Driven UI**: Only shows sliders for enabled effect groups
- **Cohesive with Effect Wrapper**: Same config model for consistent behavior
- **Preset Menu**: Quick access to full, standard, small, none presets
- **Reset Button**: Restore defaults with one click
- **Real-time Updates**: Slider changes emit immediately for live preview
- **Compact Design**: Vertical layout suitable for overlay side panels
- **Glassy Styling**: Uses `lib-compact-card-layout` with glassy-card class

**Best Practice**: Use matching `CRT_CONFIGS` with both `lib-crt-effect-wrapper` and `lib-crt-settings-panel` to ensure the displayed sliders match the applied effects. Handle `presetSelected` by applying `CRT_PRESETS[presetName]` to your settings state.

**Intended Use Cases**:

- Video dialog CRT controls overlay
- Settings panels for CRT-themed content
- Image editor filter controls
- Any adjustable CRT effect interface

---

## Supporting Video Components

These components work alongside the CRT system to create complete video display experiences.

### `VideoStreamComponent`

**Purpose**: A pure presentation component that displays a MediaStream in a video element with loading state management. Encapsulates video element lifecycle (autoplay, muted, srcObject binding) and provides a clean interface for displaying video streams without any store dependencies.

**Selector**: `lib-video-stream`

**Properties**:

- `stream` (optional): `MediaStream | null` - The MediaStream to display in the video element - defaults to `null`
- `objectFit` (optional): `'contain' | 'cover' | 'fill'` - CSS object-fit property for the video element - defaults to `'contain'`
- `showLoadingState` (optional): `boolean` - Whether to show loading indicator when stream is null - defaults to `true`

**Events**:

- `streamReady`: `void` - Emits when video element starts playing
- `streamError`: `ErrorEvent` - Emits when video element encounters an error

**Internal Signals** (for advanced use cases):

| Signal/Property | Type | Description |
|-----------------|------|-------------|
| `videoElementRef()` | `ElementRef<HTMLVideoElement>` | ViewChild reference to the native video element |
| `isPlaying()` | `boolean` | Tracks if video is actively playing |
| `showLoading()` | `boolean` | Computed: `showLoadingState && !stream && !isPlaying` |

**Usage Examples**:

```html
<!-- Basic usage - display a MediaStream -->
<lib-video-stream [stream]="mediaStream"></lib-video-stream>

<!-- Cover fit for fullscreen video -->
<lib-video-stream
  [stream]="captureStream"
  [objectFit]="'cover'"
  (streamReady)="onVideoStarted()"
  (streamError)="onVideoError($event)"
></lib-video-stream>

<!-- Hide loading state (useful when parent handles loading UI) -->
<lib-video-stream [stream]="webcamStream" [showLoadingState]="false"></lib-video-stream>

<!-- Compose with CRT effects -->
<lib-crt-effect-wrapper [settings]="crtSettings">
  <lib-video-stream [stream]="retroStream" [objectFit]="'contain'"></lib-video-stream>
</lib-crt-effect-wrapper>

<!-- Full composition with overlay container -->
<lib-content-overlay-container>
  <lib-crt-effect-wrapper content [settings]="crtSettings" [contentAspectRatio]="4/3">
    <lib-video-stream [stream]="stream" [objectFit]="'contain'"></lib-video-stream>
  </lib-crt-effect-wrapper>
  <lib-video-controls-toolbar rightControls (crtToggleClick)="toggleCrt()">
  </lib-video-controls-toolbar>
</lib-content-overlay-container>
```

**TypeScript Import**:

```typescript
import { VideoStreamComponent } from '@teensyrom-nx/ui/components';
```

**Features**:

- **Stream Lifecycle**: Automatically binds/unbinds MediaStream to video element via srcObject
- **Autoplay Support**: Video element includes `autoplay`, `muted`, and `playsinline` attributes for browser autoplay policy compliance
- **Loading State**: Optional loading overlay with animated text when no stream is available
- **Event Emissions**: Notifies parent when video starts playing or encounters an error
- **Accessibility**: Includes `aria-label` and `role="img"` for screen reader support
- **Cleanup on Destroy**: Automatically clears srcObject when component is destroyed

**Visual Properties**:

- Container fills parent (`width: 100%; height: 100%`)
- Black background for letterboxing
- Loading overlay with semi-transparent backdrop and pulsing text animation

**Best Practice**: Use as the foundation for any video display in the application. The component handles null streams gracefully, making it safe for async stream acquisition scenarios. Compose with `lib-content-overlay-container` for hover-revealed controls and `lib-crt-effect-wrapper` for retro visual effects.

**See Also**: [CrtEffectWrapperComponent](#crteffectwrappercomponent), [ContentOverlayContainerComponent](#contentoverlaycontainercomponent)

---

### `VideoControlsToolbarComponent`

**Purpose**: A configurable vertical toolbar for video player controls. Provides toggle buttons for CRT effects, CRT settings panel, device selector, fullscreen mode, and close actions. Buttons show active state styling and automatically adapt icons based on current state (e.g., fullscreen vs exit fullscreen).

**Selector**: `lib-video-controls-toolbar`

**State Inputs** (Reflect current UI state):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isCrtEnabled` | `boolean` | `true` | Whether CRT effect is currently enabled (affects toggle icon) |
| `showCrtControls` | `boolean` | `false` | Whether CRT settings panel is currently visible (affects active styling) |
| `isDeviceSelectorActive` | `boolean` | `false` | Whether device selector panel is currently visible (affects active styling) |
| `isFullscreen` | `boolean` | `false` | Whether currently in fullscreen mode (affects fullscreen icon) |

**Visibility Inputs** (Configure which buttons appear):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `showCrtToggle` | `boolean` | `true` | Show/hide CRT toggle button |
| `showCrtSettings` | `boolean` | `true` | Show/hide CRT settings button (only visible when CRT is enabled) |
| `showDeviceSelector` | `boolean` | `true` | Show/hide device selector toggle button |
| `showFullscreen` | `boolean` | `true` | Show/hide fullscreen toggle button |
| `showClose` | `boolean` | `false` | Show/hide close button |

**Events**:

| Event | Type | Description |
|-------|------|-------------|
| `crtToggleClick` | `void` | Emits when CRT toggle button is clicked |
| `crtSettingsClick` | `void` | Emits when CRT settings button is clicked |
| `deviceSelectorClick` | `void` | Emits when device selector button is clicked |
| `fullscreenClick` | `void` | Emits when fullscreen button is clicked |
| `closeClick` | `void` | Emits when close button is clicked |

**Usage Examples**:

```html
<!-- Embedded video view (no close button) -->
<lib-video-controls-toolbar
  [isCrtEnabled]="isCrtEnabled()"
  [showCrtControls]="showCrtPanel()"
  [isDeviceSelectorActive]="showDeviceSelector()"
  [showFullscreen]="true"
  [showClose]="false"
  (crtToggleClick)="toggleCrt()"
  (crtSettingsClick)="toggleCrtSettings()"
  (deviceSelectorClick)="toggleDeviceSelector()"
  (fullscreenClick)="openDialog()">
</lib-video-controls-toolbar>

<!-- Dialog video view (with fullscreen and close) -->
<lib-video-controls-toolbar
  [isCrtEnabled]="isCrtEnabled()"
  [showCrtControls]="showCrtPanel()"
  [isDeviceSelectorActive]="showDeviceSelector()"
  [isFullscreen]="isFullscreen()"
  [showFullscreen]="true"
  [showClose]="true"
  (crtToggleClick)="toggleCrt()"
  (crtSettingsClick)="toggleCrtSettings()"
  (deviceSelectorClick)="toggleDeviceSelector()"
  (fullscreenClick)="toggleFullscreen()"
  (closeClick)="closeDialog()">
</lib-video-controls-toolbar>

<!-- Minimal toolbar (CRT controls only) -->
<lib-video-controls-toolbar
  [isCrtEnabled]="isCrtEnabled()"
  [showDeviceSelector]="false"
  [showFullscreen]="false"
  (crtToggleClick)="toggleCrt()"
  (crtSettingsClick)="toggleCrtSettings()">
</lib-video-controls-toolbar>
```

**Icon Behavior**:

- **CRT Toggle**: Shows `tv` when enabled, `tv_off` when disabled
- **Fullscreen Toggle**: Shows `fullscreen` in normal mode, `fullscreen_exit` in fullscreen mode

**Features**:

- **Vertical Layout**: Buttons stacked vertically for side-panel placement
- **Active State Styling**: Buttons highlight when their associated panel is open
- **Conditional Visibility**: CRT settings button only appears when CRT is enabled
- **Compact Card Container**: Uses `lib-compact-card-layout` with glassy styling
- **Accessible**: Proper aria-labels for all button states

**TypeScript Import**:

```typescript
import { VideoControlsToolbarComponent } from '@teensyrom-nx/ui/components';
```

**Best Practice**: Use in the `rightControls` slot of `lib-content-overlay-container` for consistent video dialog layouts. Wire up state signals and toggle functions in the parent component to manage panel visibility.

**See Also**: [ContentOverlayContainerComponent](#contentoverlaycontainercomponent), [CrtSettingsPanelComponent](#crtsettingspanelcomponent), [VideoDeviceSelectorComponent](#videodeviceselectorcomponent)

---

### `VideoDeviceSelectorComponent`

**Purpose**: A reusable dropdown for selecting video capture devices. Encapsulates Material select styling, card container, and focus management needed for overlay contexts. Supports visibility animation with configurable slide direction.

**Selector**: `lib-video-device-selector`

**VideoDevice Interface**:

```typescript
interface VideoDevice {
  deviceId: string;
  label: string;
}
```

**Properties**:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `devices` | `VideoDevice[]` | (required) | List of available video devices |
| `selectedDeviceId` | `string` | (required) | Currently selected device ID |
| `visible` | `boolean` | `true` | Controls visibility with slide animation |
| `slideDirection` | `'left' \| 'right'` | `'right'` | Direction the panel slides when hiding |

**Events**:

| Event | Type | Description |
|-------|------|-------------|
| `deviceSelected` | `string` | Emits device ID when a device is selected |
| `openedChange` | `boolean` | Emits when dropdown opens/closes (for pausing hover-based overlays) |

**Usage Examples**:

```html
<!-- Basic device selector -->
<lib-video-device-selector
  [devices]="videoDevices()"
  [selectedDeviceId]="selectedDeviceId()"
  (deviceSelected)="onDeviceSelected($event)">
</lib-video-device-selector>

<!-- With visibility animation (slide right when hidden) -->
<lib-video-device-selector
  [devices]="videoDevices()"
  [selectedDeviceId]="selectedDeviceId()"
  [visible]="showDeviceSelector()"
  [slideDirection]="'right'"
  (deviceSelected)="onDeviceSelected($event)"
  (openedChange)="onSelectorOpenedChange($event)">
</lib-video-device-selector>

<!-- Left-positioned panel (slides left when hidden) -->
<lib-video-device-selector
  [devices]="videoDevices()"
  [selectedDeviceId]="selectedDeviceId()"
  [visible]="showDeviceSelector()"
  [slideDirection]="'left'"
  (deviceSelected)="onDeviceSelected($event)">
</lib-video-device-selector>

<!-- In overlay container slot -->
<lib-content-overlay-container>
  <lib-video-device-selector leftControls
    [devices]="videoDevices()"
    [selectedDeviceId]="selectedDeviceId()"
    [visible]="showDeviceSelector()"
    (deviceSelected)="onDeviceSelected($event)"
    (openedChange)="onSelectorOpenedChange($event)">
  </lib-video-device-selector>
</lib-content-overlay-container>
```

**TypeScript Integration**:

```typescript
export class VideoDialogComponent {
  private readonly videoDevices = signal<VideoDevice[]>([]);
  private readonly selectedDeviceId = signal<string>('');
  private readonly showDeviceSelector = signal<boolean>(false);

  onDeviceSelected(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
    // Switch to new device stream...
  }

  onSelectorOpenedChange(isOpen: boolean): void {
    // Pause hover-based overlay visibility while dropdown is open
    // to prevent the dropdown from closing when mouse moves
  }
}
```

**TypeScript Import**:

```typescript
import { VideoDeviceSelectorComponent, VideoDevice } from '@teensyrom-nx/ui/components';
```

**Features**:

- **Slide Animation**: Smooth slide animation when showing/hiding via `visible` input
- **Configurable Direction**: Slide left or right based on panel position
- **Dropdown State Events**: Emits when dropdown opens/closes for overlay coordination
- **Compact Card Container**: Uses `lib-compact-card-layout` with glassy styling
- **Material Select Integration**: Full Material Design select component with proper styling

**CSS Host Binding Classes**:

- `.panel-hidden`: Applied when `visible` is `false`
- `.slide-left`: Applied when `slideDirection` is `'left'`
- `.slide-right`: Applied when `slideDirection` is `'right'`

**Best Practice**: Use in overlay contexts with `openedChange` event to coordinate with hover-based visibility. When the dropdown is open, the parent should prevent hover-triggered hiding to avoid jarring UX.

**See Also**: [ContentOverlayContainerComponent](#contentoverlaycontainercomponent), [VideoControlsToolbarComponent](#videocontrolstoolbarcomponent)

---

### `ContentOverlayContainerComponent`

**Purpose**: A pure presentation layout container component that manages overlay positioning, hover-to-reveal behavior, and optional fullscreen support via 9 named content projection slots. Enables flexible composition of any content (video, images, documents) with overlays for toolbars, controls, and status indicators.

**Selector**: `lib-content-overlay-container`

**Properties**:

- `showOverlaysOnHover` (optional): `boolean` - Enable hover-to-reveal behavior for all overlay slots. Defaults to `true`.
- `overlayTransitionMs` (optional): `number` - Transition duration in milliseconds for overlay animations. Defaults to `300`.

**Outputs**:

- `fullscreenChange`: `OutputEmitterRef<boolean>` - Emits when fullscreen state changes. `true` when entering, `false` when exiting.

**Public Methods & Signals**:

| Method/Signal | Description |
|---------------|-------------|
| `enterFullscreen()` | Request fullscreen mode on the container element |
| `exitFullscreen()` | Exit fullscreen mode |
| `toggleFullscreen()` | Toggle between fullscreen and normal mode |
| `isFullscreen()` | Signal returning current fullscreen state (`boolean`) |
| `isMouseOver()` | Signal tracking whether mouse is currently over the container (`boolean`) |
| `containerRef()` | ViewChild reference to the container element for advanced use cases |

**Named Content Projection Slots (9 total)**:

| Slot Attribute | Position | Typical Content |
|----------------|----------|-----------------|
| `content` | Background layer | `lib-video-stream`, `lib-crt-effect-wrapper`, images, any element |
| `topLeftCorner` | Top-left corner | Logo, branding |
| `topOverlay` | Top-center | Filter toolbar |
| `topRightCorner` | Top-right corner | Close button |
| `leftControls` | Left side (middle) | Settings panel |
| `rightControls` | Right side (middle) | Action buttons |
| `bottomLeftControls` | Bottom-left | Player controls |
| `bottomOverlay` | Bottom-center | Now playing info |
| `bottomRightControls` | Bottom-right | Extra controls (timer, shuffle) |

**Usage Examples**:

```html
<!-- Video with hover-revealed overlays -->
<lib-content-overlay-container [showOverlaysOnHover]="true" (fullscreenChange)="onFullscreen($event)">
  <lib-video-stream content [stream]="mediaStream"></lib-video-stream>
  <lib-filter-toolbar topOverlay></lib-filter-toolbar>
  <lib-icon-button topRightCorner icon="close" (buttonClick)="close()"></lib-icon-button>
  <lib-player-toolbar bottomOverlay></lib-player-toolbar>
</lib-content-overlay-container>

<!-- Image gallery with overlays -->
<lib-content-overlay-container [showOverlaysOnHover]="true">
  <img content [src]="currentImage" alt="Gallery image" />
  <lib-icon-button topRightCorner icon="close" (buttonClick)="closeGallery()"></lib-icon-button>
  <div bottomOverlay>{{ imageCaption }}</div>
  <div bottomRightControls>
    <lib-icon-button icon="arrow_back" (buttonClick)="prevImage()"></lib-icon-button>
    <lib-icon-button icon="arrow_forward" (buttonClick)="nextImage()"></lib-icon-button>
  </div>
</lib-content-overlay-container>

<!-- Full video dialog composition with CRT effects -->
<lib-content-overlay-container #container [showOverlaysOnHover]="true">
  <!-- Video with CRT effects -->
  <lib-crt-effect-wrapper content [settings]="crtSettings" [enabled]="crtEnabled">
    <lib-video-stream [stream]="mediaStream"></lib-video-stream>
  </lib-crt-effect-wrapper>

  <!-- Top row -->
  <img topLeftCorner src="/logo.png" alt="Logo" />
  <lib-filter-toolbar topOverlay [deviceId]="deviceId"></lib-filter-toolbar>
  <lib-icon-button topRightCorner icon="close" (buttonClick)="close()"></lib-icon-button>

  <!-- Side controls -->
  <lib-crt-settings-panel leftControls [settings]="crtSettings"></lib-crt-settings-panel>
  <lib-compact-card-layout rightControls>
    <lib-icon-button icon="tv" (buttonClick)="toggleCrt()"></lib-icon-button>
    <lib-icon-button icon="fullscreen" (buttonClick)="container.toggleFullscreen()"></lib-icon-button>
  </lib-compact-card-layout>

  <!-- Bottom row -->
  <lib-player-controls bottomLeftControls></lib-player-controls>
  <lib-now-playing bottomOverlay [song]="currentSong"></lib-now-playing>
  <div bottomRightControls>
    <lib-icon-button icon="shuffle"></lib-icon-button>
    <lib-icon-button icon="favorite"></lib-icon-button>
  </div>
</lib-content-overlay-container>

<!-- Always-visible overlays (no hover reveal) -->
<lib-content-overlay-container [showOverlaysOnHover]="false">
  <lib-video-stream content [stream]="mediaStream"></lib-video-stream>
  <lib-player-toolbar bottomOverlay></lib-player-toolbar>
</lib-content-overlay-container>
```

**TypeScript Import**:

```typescript
import { ContentOverlayContainerComponent } from '@teensyrom-nx/ui/components';
```

**Features**:

- **9 Named Slots**: Flexible content projection for any overlay arrangement
- **Hover-to-Reveal**: CSS-based show/hide with slide animations (configurable)
- **Focus Persistence**: Overlays stay visible when child elements have focus (`:focus-within`)
- **Fullscreen Support**: Native Fullscreen API integration with fixed positioning
- **Content Agnostic**: Any content can be projected into any slot (video, images, documents, etc.)
- **Pure Presentation**: No store dependencies - consumer provides all content

**Hover Animation Behavior**:

When `showOverlaysOnHover` is `true`:
- All overlays hidden by default (opacity 0, pointer-events none)
- On container hover: overlays slide in from edges with 300ms transition
- Corner overlays slide diagonally
- Side overlays slide horizontally
- Top/bottom overlays slide vertically
- Overlays remain visible while hovered or focused

**Fullscreen Behavior**:

- Overlays use `position: fixed` in fullscreen mode
- z-index increased to 9999 for visibility
- All hover behaviors work in fullscreen
- `fullscreenChange` event emits on state changes

**CSS Custom Properties**:

| Variable | Purpose |
|----------|---------|
| `--transition-ms` | Animation duration (set via `overlayTransitionMs` input) |

**Best Practice**: Use named slots to separate concerns - the container handles positioning and visibility, consumers handle content. For video dialogs, compose with `lib-video-stream` and `lib-crt-effect-wrapper` in the content slot. For image galleries, project `<img>` directly into the content slot.

**Intended Use Cases**:

- Video dialog with player controls
- Video capture preview with toolbars
- Image galleries with navigation overlays
- Document viewers with toolbars
- Media player overlays
- Any fullscreen-capable content display
- Composable UI patterns with overlays

---

## Configuration Reference

### `CrtSettingsConfig` Interface

Feature flags that control which effect groups are enabled:

| Property | Type | Description |
|----------|------|-----------|
| `showScanlines` | `boolean` | Enable scanline effects (intensity, size) |
| `showVignette` | `boolean` | Enable vignette edge darkening effect |
| `showCurvature` | `boolean` | Enable screen curvature border-radius |
| `showColorFilters` | `boolean` | Enable color filters (contrast, brightness, saturation) |

### `CrtSettings` Interface

Values that control the intensity and appearance of each effect:

| Property | Type | Description |
|----------|------|-----------|
| `scanlineIntensity` | `number` | Opacity of scanline overlay (0-1). Set to 0 to disable. |
| `scanlineSize` | `number` | Size of scanline bands and gaps in pixels (1.0-6.0). Controls both dark band height and spacing with 1:1 ratio. |
| `vignetteStrength` | `number` | Intensity of edge/corner darkening (0-2). Set to 0 to disable. |
| `screenCurvature` | `number` | Border-radius in pixels for curved screen effect. Set to 0 for flat. |
| `contrast` | `number` | CSS filter contrast multiplier. 1 = no change, >1 = increased. |
| `brightness` | `number` | CSS filter brightness multiplier. 1 = no change, >1 = brighter. |
| `saturation` | `number` | CSS filter saturation multiplier. 1 = no change, >1 = more saturated. |

### Preset Configurations

Pre-configured presets available via `CRT_PRESETS` and matching `CRT_CONFIGS`:

| Preset | Description | Use Case |
|--------|-------------|----------|
| `full` | All effects enabled (scanlines, vignette, curvature, color boost) | Video streams, terminal displays, fullscreen video |
| `standard` | Scanlines, vignette, color enhancement (no curvature) | Embedded previews, flat-screen retro aesthetic |
| `small` | Subtle scanlines (1px size) for compact displays | Small video components, thumbnails |
| `none` | All effects neutral (pass-through) | Temporarily disable effects |

---

## Implementation Patterns

### Basic CRT Overlay

Simplest usage - wrap any content with CRT effects:

```html
<lib-crt-effect-wrapper [settings]="CRT_PRESETS.full">
  <video src="retro-game.mp4" autoplay></video>
</lib-crt-effect-wrapper>
```

### Full Video Dialog Composition

Complete video dialog with all CRT controls:

```html
<lib-content-overlay-container #container [showOverlaysOnHover]="true">
  <!-- Video with CRT effects -->
  <lib-crt-effect-wrapper content 
    [settings]="crtSettings()" 
    [enabled]="crtEnabled()"
    [contentAspectRatio]="4/3">
    <lib-video-stream [stream]="mediaStream()"></lib-video-stream>
  </lib-crt-effect-wrapper>

  <!-- Close button -->
  <lib-icon-button topRightCorner icon="close" (buttonClick)="close()"></lib-icon-button>

  <!-- CRT settings panel -->
  <lib-crt-settings-panel leftControls
    [settings]="crtSettings()"
    [visible]="showCrtPanel()"
    (settingsChange)="onCrtSettingsChange($event)"
    (presetSelected)="onPresetSelect($event)">
  </lib-crt-settings-panel>

  <!-- Video controls toolbar -->
  <lib-video-controls-toolbar rightControls
    [isCrtEnabled]="crtEnabled()"
    [showCrtControls]="showCrtPanel()"
    [isFullscreen]="container.isFullscreen()"
    (crtToggleClick)="toggleCrt()"
    (crtSettingsClick)="toggleCrtPanel()"
    (fullscreenClick)="container.toggleFullscreen()">
  </lib-video-controls-toolbar>
</lib-content-overlay-container>
```

### Fullscreen with Aspect Ratio Handling

For 4:3 content on modern 16:9 displays:

```html
<lib-crt-effect-wrapper 
  [settings]="crtSettings()"
  [contentAspectRatio]="4/3">
  <lib-video-stream 
    [stream]="stream" 
    [objectFit]="'contain'">
  </lib-video-stream>
</lib-crt-effect-wrapper>
```

This ensures CRT effects (curvature, vignette) are constrained to the visible video area and don't appear on letterbox black bars.

---

## Visual Effects Reference

### Scanlines

Horizontal dark bands that simulate the scan pattern of a CRT electron gun.

- **Implementation**: CSS repeating linear gradient as `::before` pseudo-element
- **Properties**: `scanlineIntensity` (opacity 0-1), `scanlineSize` (band and gap size in pixels, 1:1 ratio)
- **Visual Effect**: Creates the characteristic horizontal line pattern of CRT displays

### Vignette

Edge and corner darkening that simulates the uneven phosphor glow of curved CRT screens.

- **Implementation**: Radial + linear gradients with blur as `::after` pseudo-element
- **Properties**: `vignetteStrength` controls overall intensity
- **Visual Effect**: Darker edges/corners with gradual fade to center, enhancing the "tube" appearance

### Screen Curvature

Curved edges simulating the bulging glass of vintage CRT monitors.

- **Implementation**: CSS `border-radius` with `overflow: hidden`
- **Properties**: `screenCurvature` in pixels (0 = flat, higher = more curved)
- **Visual Effect**: Rounds the corners to simulate convex glass tube

### Color Filters

Post-processing color adjustments for authentic retro color reproduction.

- **Implementation**: CSS `filter` property on content wrapper
- **Properties**: `contrast`, `brightness`, `saturation` (multipliers, 1 = neutral)
- **Visual Effect**: Enhanced/muted colors typical of vintage displays

---

## CSS Custom Properties

The CRT effect wrapper exposes these CSS custom properties for advanced styling:

| Variable | Maps To |
|----------|---------|
| `--scanline-intensity` | `settings.scanlineIntensity` |
| `--scanline-size` | `settings.scanlineSize` (px) |
| `--vignette-strength` | `settings.vignetteStrength` |
| `--screen-curvature` | `settings.screenCurvature` (px) |
| `--crt-contrast` | `settings.contrast` |
| `--crt-brightness` | `settings.brightness` |
| `--crt-saturation` | `settings.saturation` |

---

## Best Practices

1. **Use Presets First**: Start with `CRT_PRESETS.full`, `standard`, or `small` before customizing individual settings.

2. **Match Config with Settings Panel**: When using `CrtSettingsPanelComponent`, pass the same `CRT_CONFIGS` to both components so sliders match enabled effects.

3. **Provide Aspect Ratio for Fullscreen**: Always set `contentAspectRatio` when displaying non-native aspect ratio content (e.g., 4:3 video) to avoid effects appearing on letterbox areas.

4. **Use Object-Fit Contain**: Pair `contentAspectRatio` with `objectFit="contain"` on video elements for proper effect positioning.

5. **Compose with ContentOverlayContainer**: For complete video UIs, use `lib-content-overlay-container` with named slots for consistent overlay behavior.

6. **Handle Preset Selection**: When using the settings panel's preset menu, apply presets via `CRT_PRESETS[presetName]` in your `presetSelected` handler.

7. **Coordinate Hover States**: Use `openedChange` events from dropdowns to pause hover-based overlay hiding during user interactions.

8. **Performance**: All effects are CSS-based with no JavaScript animation loops - they're efficient even on lower-powered devices.

---

## TypeScript Imports

All CRT-related exports from a single import path:

```typescript
import {
  // Components
  CrtEffectWrapperComponent,
  CrtSettingsPanelComponent,
  VideoStreamComponent,
  VideoControlsToolbarComponent,
  VideoDeviceSelectorComponent,
  ContentOverlayContainerComponent,
  
  // Types
  CrtSettings,
  CrtSettingsConfig,
  CrtPresetName,
  VideoDevice,
  
  // Constants
  CRT_PRESETS,
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
} from '@teensyrom-nx/ui/components';
```

---

## See Also

- [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) - Main UI component catalog
- [STYLE_GUIDE.md](./STYLE_GUIDE.md) - Global styles and theming
- [USB_VIDEO_DEVICE_INFORMATION.md](./USB_VIDEO_DEVICE_INFORMATION.md) - Video capture device integration
