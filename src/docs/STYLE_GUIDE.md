# TeensyROM UI Style Guide

## Overview

This document catalogs all global styles, utility classes, and Material Design customizations available in the TeensyROM application. All styles are defined in `libs/ui/styles/src/lib/theme/styles.scss`.

---

## Color Schemes & Themes

### Light Mode

- **Material Palette**: `mat.$azure-palette`
- **Typography**: Roboto
- **Surface Container**: `#cdcdcd`

### Dark Mode

- **Material Palette**: `mat.$magenta-palette`
- **Typography**: Roboto
- **Surface Container**: `#231e22`

### Custom Color Variables

Available color variables for semantic styling:

- `--color-primary`: Purple brand color for primary actions and branding
- `--color-success`: Green variants for success states
- `--color-error`: Red variants for error states
- `--color-highlight`: Cyan accent color
- `--color-dimmed`: Gray for secondary content

**Usage Example:**

```scss
.my-icon {
  color: var(--color-success);
}

.primary-button {
  background-color: var(--color-primary);
}
```

**Best Practice:** Use these semantic color classes instead of hardcoded colors for consistency and proper theme support.

---

## Design Tokens

Design tokens are CSS custom properties that provide consistent, reusable values across the application. They are defined in `libs/ui/styles/src/lib/theme/styles.scss` and support both light and dark themes.

### Spacing Tokens

Spacing tokens provide consistent inline spacing for gaps, margins, and padding:

| Token | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `--spacing-inline-xs` | 0.375rem | 6px | Tight spacing for compact layouts |
| `--spacing-inline-sm` | 0.5rem | 8px | Default comfortable spacing |
| `--spacing-inline-md` | 0.625rem | 10px | Breathing room for larger elements |
| `--spacing-inline-lg` | 1rem | 16px | Generous spacing for prominent displays |

**Usage Example:**

```scss
.my-container {
  gap: var(--spacing-inline-sm);
  padding: var(--spacing-inline-md);
}
```

### Typography Tokens

#### Font Size Tokens

Font size tokens provide a consistent type scale:

| Token | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `--font-size-sm` | 0.875rem | 14px | Smaller text for compact layouts, captions |
| `--font-size-md` | 1rem | 16px | Base text size, default body text |
| `--font-size-lg` | 1.25rem | 20px | Larger text for emphasis, subheadings |
| `--font-size-xl` | 1.75rem | 28px | Prominent headings, hero text |

**Usage Example:**

```scss
.caption {
  font-size: var(--font-size-sm);
}

.heading {
  font-size: var(--font-size-xl);
}
```

#### Font Weight Tokens

Font weight tokens ensure consistent text emphasis:

| Token | Value | Use Case |
|-------|-------|----------|
| `--font-weight-normal` | 400 | Default body text |
| `--font-weight-medium` | 500 | Slightly emphasized text, labels |
| `--font-weight-semibold` | 600 | Subheadings, important labels |
| `--font-weight-bold` | 700 | Headings, strong emphasis |

**Usage Example:**

```scss
.label {
  font-weight: var(--font-weight-medium);
}

.section-title {
  font-weight: var(--font-weight-semibold);
}
```

#### Border Radius Tokens

Border radius tokens provide consistent rounded corners across UI elements:

| Token | Value | Use Case |
|-------|-------|----------|
| `--border-radius-sm` | 6px | Small elements, chips, badges |
| `--border-radius-md` | 10px | Buttons, list items, nav items |
| `--border-radius-lg` | 16px | Cards, dialogs, panels |
| `--border-radius-xl` | 24px | Large cards, hero sections |

**Usage Example:**

```scss
.nav-item {
  border-radius: var(--border-radius-md);
}

.card {
  border-radius: var(--border-radius-lg);
}

.chip {
  border-radius: var(--border-radius-sm);
}
```

**Used In:**

- [`nav-rail-item.component.scss`](../libs/ui/components/src/lib/nav-rail/nav-rail-item.component.scss) - Nav rail items use `--border-radius-md`
- Global `.glassy-card` class - Uses Material's `--mat-sys-corner-large` (similar to `--border-radius-lg`)

### Using Design Tokens

**Best Practices:**

1. **Always prefer tokens over hardcoded values** for consistency across the application
2. **Tokens work in both themes** - values are defined in both `html` and `html.dark-mode` blocks
3. **Combine tokens for compound styles**:

```scss
.prominent-label {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  gap: var(--spacing-inline-md);
}
```

4. **Use semantic meaning** - choose tokens based on intent (e.g., `--font-size-lg` for emphasis, not just "20px")

**Component Integration:**

Design tokens are used by reusable components like [IconLabelComponent](COMPONENT_LIBRARY.md#iconlabelcomponent) to provide size presets. See the Component Library for components that leverage these tokens.

---

## Utility Classes

### `.dimmed`

**Purpose**: Reduces opacity to 50% for disabled or secondary content

**Usage Example:**

```html
<mat-icon class="dimmed">settings</mat-icon>
<p class="dimmed">Secondary text</p>
```

**Used In:**

- [`device-logs.component.html`](../libs/features/devices/src/lib/device-view/device-logs/device-logs.component.html) - For "No logs to display" message
- [`storage-item.component.html`](../libs/features/devices/src/lib/device-view/storage-item/storage-item.component.html) - For disabled storage items
- [`device-item.component.html`](../libs/features/devices/src/lib/device-view/device-item/device-item.component.html) - For disconnected devices

### `.no-text-selection`

**Purpose**: Prevents text selection on interactive elements to avoid unwanted text highlighting during double-clicks and rapid user interactions

**Usage Example:**

```html
<!-- For buttons and interactive list items -->
<div class="file-item no-text-selection" (dblclick)="openFile()">
  <span>filename.txt</span>
</div>

<!-- For tree nodes and clickable elements -->
<div class="directory-tree-node no-text-selection" (click)="selectNode()">
  <span>Folder Name</span>
</div>
```

**Used In:**

- [`file-item.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/file-item/file-item.component.html) - Prevents text selection on file double-click
- [`directory-item.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-item/directory-item.component.html) - Prevents text selection on directory double-click
- [`directory-tree-node.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree-node/directory-tree-node.component.html) - Prevents text selection on tree node interactions

**Best Practice**: Apply to any interactive element that users might double-click or rapidly interact with where text selection would be distracting or interfere with the intended user action. Essential for components using the `selectable-item` mixin that need clean double-click behavior.

### `.list-item-highlight`

**Purpose**: Provides pulsing highlight effect for active items in lists with automatic error state handling.

**Usage Example:**

```html
<div
  class="file-list-item list-item-highlight"
  [attr.data-is-playing]="isActive(item)"
  [attr.data-has-error]="hasError() && isActive(item)"
>
  <!-- item content -->
</div>
```

**Data Attribute Contract:**

- `data-is-playing="true"` - Triggers cyan pulsing highlight border for active item
- `data-is-playing="true"` + `data-has-error="true"` - Triggers red error pulsing highlight border for active item with error

**Visual Effect:**

- Cyan pulsing border (left side) for active items
- Red pulsing border (left side) for active items with errors
- 10px border radius for modern rounded appearance
- 15% opacity pulsing animation

**Used In:**

- [`directory-files.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-files.component.html) - Active file in directory
- [`search-results.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/search-results/search-results.component.html) - Active search result
- [`play-history.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/play-history/play-history.component.html) - Active history entry

**Best Practice**: Use this utility class for any list that displays items with an active state and potential error states. Apply it alongside component-specific classes (e.g., `class="file-list-item list-item-highlight"`). The data attributes provide semantic meaning and enable consistent visual feedback across all lists in the application.

**Implementation Note**: This class works in conjunction with the `pulsing-highlight` mixin and requires theme color variables (`--color-highlight`, `--color-error`) to be defined.

### Glassy Effect Variations

**Purpose**: Utility classes that apply glassmorphism effects with varying opacity levels. All classes use the [glassy effect mixins](#glassy-effect-mixins) internally.

#### `.glassy-subtle`

**Usage Example:**

```html
<div class="glassy-subtle">Minimal overlay content</div>
```

**Implementation**: Uses [`@mixin glassy-subtle-effect`](#mixin-glassy-subtle-effect) (5% opacity)

**Best Practice**: Use for barely-visible background separation or subtle depth effects where minimal visual weight is desired.

#### `.glassy-light`

**Usage Example:**

```html
<div class="glassy-light">Light overlay content</div>
```

**Implementation**: Uses [`@mixin glassy-light-effect`](#mixin-glassy-light-effect) (7.5% opacity)

**Best Practice**: Use for subtle glassmorphism on secondary UI elements that need slight visual separation without being prominent.

#### `.glassy-default` / `.glassy`

**Usage Example:**

```html
<!-- Preferred for new code -->
<div class="glassy-default">Overlay content</div>

<!-- Legacy - still works but prefer .glassy-default -->
<div class="glassy">Overlay content</div>
<mat-dialog class="glassy-dialog">...</mat-dialog>
```

**Implementation**: Uses [`@mixin glassy-default-effect`](#mixin-glassy-default-effect) (10% opacity)

**Used In:**

- [`layout.component.html`](../libs/app/shell/src/lib/layout/layout.component.html) - Navigation sidenav
- [`layout.component.ts`](../libs/app/shell/src/lib/layout/layout.component.ts) - Modal dialogs (via `panelClass: 'glassy-dialog'`)

**Best Practice**: Default glassmorphism effect for standard overlays, navigation elements, and modal dialogs. Use `.glassy-default` for new code.

**Migration Note**: `.glassy` is the legacy name maintained for backward compatibility. Both classes are functionally identical. New code should use `.glassy-default` to follow the established naming pattern.

#### `.glassy-medium`

**Usage Example:**

```html
<div class="glassy-medium">Medium overlay content</div>
```

**Implementation**: Uses [`@mixin glassy-medium-effect`](#mixin-glassy-medium-effect) (15% opacity)

**Best Practice**: Use for more prominent glassmorphism effects where the overlay needs to be clearly visible.

#### `.glassy-strong`

**Usage Example:**

```html
<div class="glassy-strong">Strong overlay content</div>
```

**Implementation**: Uses [`@mixin glassy-strong-effect`](#mixin-glassy-strong-effect) (20% opacity)

**Best Practice**: Use for high-emphasis glassmorphism where the overlay needs maximum visibility while maintaining the blur effect.

#### `.glassy-dark`

**Usage Example:**

```html
<div class="glassy-dark">Dark overlay content</div>
```

**Implementation**: Uses [`@mixin glassy-dark-effect`](#mixin-glassy-dark-effect) (40% black opacity)

**Best Practice**: Use as the default for cards and prominent UI elements. The dark semi-transparent effect is sophisticated and modern, allowing background patterns to enhance visual depth while maintaining excellent readability. Recommended for all primary card components.

#### `.glassy-dark`

**Usage Example:**

```html
<div class="glassy-dark">Dark overlay content</div>
```

**Implementation**: Uses [`@mixin glassy-dark-effect`](#mixin-glassy-dark-effect) (40% black opacity)

**Best Practice**: Use as the default for cards and prominent UI elements. The dark semi-transparent effect is sophisticated and modern, allowing background patterns to enhance the visual depth while maintaining excellent readability. Recommended for all primary card components.

#### `.glassy-card`

**Usage Example:**

```html
<mat-card class="glassy-card">Card with glassy effect</mat-card>

<!-- Or via cardClass input on card components -->
<lib-scaling-card cardClass="glassy-card" title="Glassy Card"> Content </lib-scaling-card>
```

**Implementation**: Uses [`@mixin glassy-dark-effect`](#mixin-glassy-dark-effect) (40% black opacity) with Material Design styling

**Visual Effects:**

- Dark glassy background (40% black overlay) - lets synthwave pattern shine through
- 12px backdrop blur
- Large rounded corners (`var(--mat-sys-corner-large)`)
- Material elevation shadow (`var(--mat-sys-level4)`)
- Overflow hidden for clean edges

**Used In:**

- [`youtube-dialog.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/youtube-dialog/youtube-dialog.component.html) - YouTube video dialog card
- Video player CRT controls overlay
- Player toolbar and filter toolbar cards

**Best Practice**: Use for cards that need a prominent glassmorphism effect, such as modal dialog content, overlay cards, or featured content cards. The dark semi-transparent effect provides a polished, modern appearance with proper Material Design integration while allowing the synthwave background to shine through. Apply via the `cardClass` input on card components to avoid wrapper elements.

---

**For detailed opacity levels, theme support, and implementation details, see [Glassy Effect Mixins](#glassy-effect-mixins).**

**Migration Path:**

1. **Phase 1** (Current): Both `.glassy` and `.glassy-default` work identically
2. **Phase 2**: Gradually migrate existing components to use `.glassy-default`
3. **Phase 3**: Deprecate `.glassy` with console warnings (future release)
4. **Phase 4**: Remove `.glassy` in breaking change release (future major version)

---

## Mixins

### Glassy Effect Mixins

**Purpose**: Reusable SCSS mixins that create glassmorphism effects with varying opacity levels. These mixins provide a single source of truth for all glassy styling in the application.

#### `@mixin glassy-default-effect`

**Opacity**: 10% white overlay
**Blur**: 10px backdrop blur
**Theme Support**: Hardcoded white (legacy compatibility)

**Usage:**

```scss
.my-overlay {
  @include glassy-default-effect;
}
```

#### `@mixin glassy-subtle-effect`

**Opacity**: 5% white overlay (ultra-light)
**Blur**: 10px backdrop blur
**Theme Support**: White tint in both light and dark modes

**Usage:**

```scss
.my-subtle-overlay {
  @include glassy-subtle-effect;
}
```

#### `@mixin glassy-light-effect`

**Opacity**: 7.5% white overlay (light)
**Blur**: 10px backdrop blur
**Theme Support**: White tint in both light and dark modes

**Usage:**

```scss
.my-light-overlay {
  @include glassy-light-effect;
}
```

#### `@mixin glassy-medium-effect`

**Opacity**: 15% white overlay (pronounced)
**Blur**: 10px backdrop blur
**Theme Support**: White tint in both light and dark modes

**Usage:**

```scss
.my-medium-overlay {
  @include glassy-medium-effect;
}
```

#### `@mixin glassy-strong-effect`

**Opacity**: 20% white overlay (bold)
**Blur**: 10px backdrop blur
**Theme Support**: White tint in both light and dark modes

**Usage:**

```scss
.my-strong-overlay {
  @include glassy-strong-effect;
}
```

#### `@mixin glassy-dark-effect`

**Opacity**: 40% black overlay (sophisticated dark glassy effect)
**Blur**: 12px backdrop blur (enhanced blur for dark variant)
**Theme Support**: Pure black in both light and dark modes - designed to showcase background patterns

**Usage:**

```scss
.my-dark-overlay {
  @include glassy-dark-effect;
}
```

**Key Characteristics:**

- Uses **black** instead of white for a premium, modern aesthetic
- 40% opacity provides excellent contrast while remaining transparent enough for backgrounds to show through
- 12px blur (vs 10px for other variants) enhances the frosted glass effect
- Perfect for dark-themed applications and showcasing animated backgrounds (e.g., synthwave pattern)
- Recommended as the **default** for card components and primary UI elements

**Color Theory:**

- **White mixins** (subtle→strong): Ideal for light backgrounds; create airy, translucent effects
- **Black mixin** (dark): Ideal for layered backgrounds; creates depth and sophistication while maintaining readability

**Used In:**

- `.glassy-dark` CSS class - Primary card styling across the application
- `.glassy-card` CSS class - Material card components with enhanced dark styling
- `card-layout.component.ts` - Default glassy intensity for CardLayout components
- `compact-card-layout.component.ts` - Default glassy intensity for CompactCardLayout components

**Implementation Details:**

- All glassy mixins use CSS custom property `--glassy-color` for consistent glassmorphism effect (except `glassy-default-effect` which is hardcoded for legacy compatibility)
- White mixins (subtle→strong): `--glassy-color: 255, 255, 255` (white) in both themes
- Dark mixin: `rgba(0, 0, 0, 0.4)` hardcoded for maximum compatibility and consistency
- Using different color approaches (white vs black) allows developers to choose the aesthetic that best suits their layout

**Selection Guide:**

- **Subtle (5%)**: Barely visible, minimal visual weight
- **Light (7.5%)**: Subtle effect, low emphasis
- **Default (10%)**: Standard glassmorphism, balanced visibility
- **Medium (15%)**: Pronounced effect, higher emphasis
- **Strong (20%)**: Bold effect, maximum visibility (white)
- **Dark (40% black)**: Premium dark glassmorphism, perfect for showcasing backgrounds - **recommended as default for modern applications**

**Used In:**

- [Glassy utility classes](#glassy-effect-variations) - All glassy utility classes use these mixins
- [`selectable-item` mixin](#mixin-selectable-item) - Uses `glassy-subtle-effect` for hover and `glassy-strong-effect` for selected states

---

### `@mixin bounce-hover`

**Purpose**: Provides a sleek, springy scale effect on hover for interactive elements like nav items, buttons, and cards. Creates a polished, modern feel with satisfying tactile feedback.

**Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `$scale` | 1.05 | Scale factor on hover (1.05 = 5% larger) |
| `$duration` | 0.2s | Animation duration |

**Usage Example:**

```scss
@use 'libs/ui/styles/src/lib/theme/styles' as styles;

.my-interactive-item {
  @include styles.bounce-hover;
}

// Custom scale and duration
.my-card {
  @include styles.bounce-hover($scale: 1.08, $duration: 0.3s);
}
```

**Visual Effect:**

- **Hover**: Element scales up with a springy bounce (uses `cubic-bezier(0.34, 1.56, 0.64, 1)` for overshoot effect)
- **Active/Click**: Element scales down slightly (0.95) for tactile press feedback
- Smooth transition creates a satisfying, polished interaction

**Used In:**

- [`nav-rail-item.component.scss`](../libs/ui/components/src/lib/nav-rail/nav-rail-item.component.scss) - Nav rail items bounce on hover

**Best Practice**: Use for navigation items, icon buttons, and interactive cards where you want to draw attention and provide clear hover feedback. The bounce effect is subtle enough for professional UIs but adds a touch of delight.

---

### `@mixin selectable-item`

**Purpose**: Provides consistent hover, selection, and active state styling for interactive list items, tree nodes, and selectable UI elements

**Usage Example:**

```scss
@use 'path/to/styles.scss' as styles;

.my-selectable-item {
  @include styles.selectable-item;
  display: flex;
  align-items: center;
  // Add component-specific styles
}
```

**Used In:**

- [`storage-item.component.scss`](../libs/ui/components/src/lib/storage-item/storage-item.component.scss) - Base storage item component with hover/selection/active states
- [`directory-tree-node.component.scss`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree-node/directory-tree-node.component.scss) - Tree node selection and hover
- [`directory-item.component.scss`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-item/directory-item.component.scss) - Directory list item selection
- [`file-item.component.scss`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/file-item/file-item.component.scss) - File list item selection

**Best Practice:** Use this mixin for any interactive list item that needs hover feedback, selection state, and/or active highlighting. The mixin provides:

- Consistent 8px padding
- 10px border radius for modern rounded appearance
- Smooth 0.2s transition for hover/selection/active changes
- Three distinct visual states:
  - **Hover**: Subtle glassy effect (5% opacity)
  - **Selected**: Strong glassy effect (20% opacity) for user selections
  - **Active**: Subtle glassy effect + cyan pulsing border for currently active/playing items

**State Classes:**

- Apply `.selected` class when the item is the currently selected item (user click)
- Apply `.active` class when the item is currently active/playing/highlighted (automatic state)

**Recommended Pairing:** Combine with `.no-text-selection` utility class for elements that support double-click interactions to prevent unwanted text highlighting:

```html
<div
  class="my-item no-text-selection"
  [class.selected]="isSelected"
  [class.active]="isActive"
  (dblclick)="onAction()"
>
  <!-- content -->
</div>
```

### `@mixin pulsing-highlight`

**Purpose**: Creates a reusable pulsing animation effect with colored borders for highlighting active or important elements

**Usage Example:**

```scss
@use 'path/to/styles.scss' as styles;

.my-active-item {
  @include styles.pulsing-highlight(); // Default: cyan highlight, left border
}

.my-error-item {
  @include styles.pulsing-highlight(
    $color: var(--color-error),
    $opacity: 20%,
    $border-side: all,
    $duration: 1.5s
  );
}

.my-success-notification {
  @include styles.pulsing-highlight(
    $color: var(--color-success),
    $opacity: 10%,
    $border-side: top,
    $border-width: 2px
  );
}
```

**Parameters:**

- `$color`: Border and pulse color (default: `var(--color-highlight)`)
- `$opacity`: Opacity percentage for pulse effect (default: `15%`)
- `$duration`: Animation duration (default: `2s`)
- `$timing`: Animation timing function (default: `ease-in-out`)
- `$border-width`: Border thickness (default: `3px`)
- `$border-side`: Border placement - `left`, `right`, `top`, `bottom`, or `all` (default: `left`)

**Used In:**

- [`directory-files.component.scss`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-files.component.scss) - Currently playing file highlighting

**Best Practice**: Use for drawing attention to active states, currently playing items, notifications, or temporary highlights. The mixin adapts to any component's existing shape and styling - just apply it and it will pulse within the component's borders and dimensions. Combine with semantic color variables for consistent theming.

**Technical Note**: Uses CSS custom properties internally (`--pulsing-color`, `--pulsing-opacity`) to enable dynamic color/opacity combinations while maintaining a single set of keyframes for performance.

---

### `.corner-chips`

**Purpose**: Positions chip sets in the upper right corner of relatively positioned containers

**Usage Example:**

```html
<mat-card style="position: relative;">
  <mat-chip-set class="corner-chips">
    <mat-chip>Tag 1</mat-chip>
    <mat-chip>Tag 2</mat-chip>
  </mat-chip-set>
  <!-- card content -->
</mat-card>
```

**Used In:**

- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - Metadata chips in file info cards

**Best Practice:** Ensure the parent container has `position: relative` for proper absolute positioning. Use for non-intrusive metadata or tag display that shouldn't interfere with main content layout.

### `.metadata-source`

**Purpose**: Styles metadata source text with right-aligned, subtle appearance for card footers

**Usage Example:**

```html
<mat-card-footer>
  <p class="metadata-source">Source: Database Name</p>
</mat-card-footer>
```

**Used In:**

- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - Metadata source attribution in card footer

**Best Practice:** Use for displaying data source attribution or metadata origin information. The light grey, italic styling ensures it remains subtle and doesn't compete with main content.

---

## Material Component Customizations

### Cards

#### `.compact-card`

**Purpose**: Creates cards with proper spacing for Material form fields

**Usage Example:**

```html
<mat-card class="compact-card">
  <mat-form-field>
    <input matInput placeholder="Search" />
  </mat-form-field>
</mat-card>
```

**Used In:**

- [`search-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/search-toolbar/search-toolbar.component.html) - Search input field container

#### `.stretch-card`

**Purpose**: Creates full-height cards with flex layout for components that need to fill available container space with scrollable content

**Usage Example:**

```html
<mat-card class="stretch-card">
  <mat-card-header>
    <mat-card-title>Directory Tree</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    <!-- Scrollable content that fills remaining height -->
    <mat-tree>...</mat-tree>
  </mat-card-content>
</mat-card>
```

**Used In:**

- [`directory-tree.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree.component.html) - Directory tree component
- [`directory-files.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-files.component.html) - Directory files component
- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - File info component

**Best Practice:** Use `.stretch-card` for cards that need to fill container height with scrollable content. This ensures consistent behavior and proper flex layout handling.

#### `mat-card-title`

**Purpose**: Adds consistent bottom padding to card titles

**Used In:**

- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - File info card title
- [`file-image.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.html) - Image viewer card title
- [`directory-tree.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree.component.html) - Directory tree card title
- [`directory-files.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-files.component.html) - Directory files card title
- [`player-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.html) - Player toolbar card title
- [`device-logs.component.html`](../libs/features/devices/src/lib/device-view/device-logs/device-logs.component.html) - Device logs card title
- [`device-item.component.html`](../libs/features/devices/src/lib/device-view/device-item/device-item.component.html) - Device item card title

### Toolbars

#### `.mat-toolbar`

**Purpose**: Customizes Material toolbar height and styling

**Used In:**

- [`header.component.html`](../libs/app/shell/src/lib/components/header/header.component.html) - Main application header

#### `.mat-toolbar.mat-primary`

**Purpose**: Custom background color for primary toolbars

**Used In:**

- [`header.component.html`](../libs/app/shell/src/lib/components/header/header.component.html) - Primary toolbar styling

### Buttons & Icons

#### `.icon-button-small`

**Purpose**: Standardized small-sized icon buttons for compact layouts

**Usage Example:**

```html
<button mat-icon-button class="icon-button-small">
  <mat-icon>edit</mat-icon>
</button>
```

**Used In:**

- Compact toolbars and inline actions
- Secondary actions in dense layouts

#### `.icon-button-medium`

**Purpose**: Standardized medium-sized icon buttons (default size)

**Usage Example:**

```html
<button mat-icon-button class="icon-button-medium">
  <mat-icon>settings</mat-icon>
</button>
```

**Used In:**

- [`device-logs.component.html`](../libs/features/devices/src/lib/device-view/device-logs/device-logs.component.html) - Log control buttons (clear, start/stop logging, download)
- [`storage-item.component.html`](../libs/features/devices/src/lib/device-view/storage-item/storage-item.component.html) - Storage action buttons
- [`device-item.component.html`](../libs/features/devices/src/lib/device-view/device-item/device-item.component.html) - Device power button

#### `.icon-button-large`

**Purpose**: Standardized large-sized icon buttons for prominent actions

**Usage Example:**

```html
<button mat-icon-button class="icon-button-large">
  <mat-icon>play_arrow</mat-icon>
</button>
```

**Used In:**

- Primary action buttons
- Media controls
- Main navigation actions

#### `.icon-button-rounded-primary`

**Purpose**: Rounded icon buttons with primary background color for main actions

**Usage Example:**

```html
<button mat-icon-button class="icon-button-rounded-primary">
  <mat-icon>play_arrow</mat-icon>
</button>
```

**Used In:**

- [`player-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.html) - Primary play/pause button

**Best Practice:** Use for primary actions in media controls or other prominent interactive elements that need to stand out with brand color.

#### `.icon-button-rounded-transparent`

**Purpose**: Rounded icon buttons with transparent background for secondary actions

**Usage Example:**

```html
<button mat-icon-button class="icon-button-rounded-transparent">
  <mat-icon>skip_next</mat-icon>
</button>
```

**Used In:**

- [`player-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.html) - Secondary media control buttons (previous, fast forward, next)

**Best Practice:** Use for secondary actions that should maintain visual consistency with primary rounded buttons but remain subtle.

#### Icon Color Classes

**Purpose**: Semantic icon colors using custom variables

**Usage Example:**

```html
<mat-icon class="success">check_circle</mat-icon>
<mat-icon class="error">error</mat-icon>
<mat-icon class="highlight">star</mat-icon>
<mat-icon class="dimmed">info</mat-icon>
```

**Used In:**

- [`device-logs.component.html`](../libs/features/devices/src/lib/device-view/device-logs/device-logs.component.html) - Success (play) and error (stop) icons for log controls

**Best Practice:** Use these semantic icon classes instead of hardcoded colors to ensure proper theme support and consistent visual language.

#### Styled Icon Classes

**Purpose**: Size and color styling for the [StyledIconComponent](COMPONENT_LIBRARY.md#stylediconcomponent)

**Size Classes**:

```scss
.styled-icon-small {
  font-size: 16px;
  width: 14px;
  height: 14px;
}

.styled-icon-medium {
  font-size: 24px;
  width: 20px;
  height: 20px;
}

.styled-icon-large {
  font-size: 32px;
  width: 28px;
  height: 28px;
}
```

**Color Classes**:

```scss
.styled-icon-primary {
  color: var(--color-primary-bright);
}

.styled-icon-highlight {
  color: var(--color-highlight);
}

.styled-icon-success {
  color: var(--color-success);
}

.styled-icon-error {
  color: var(--color-error);
}

.styled-icon-dimmed {
  color: var(--color-dimmed);
}

.styled-icon-directory {
  color: var(--color-directory);
}
```

**Usage Example**:

```html
<!-- Via StyledIconComponent (preferred) -->
<lib-styled-icon icon="folder" color="directory" size="medium"> </lib-styled-icon>

<!-- Direct class usage (advanced) -->
<mat-icon class="styled-icon-medium styled-icon-directory">folder</mat-icon>
```

**Used In**:

- [StyledIconComponent](COMPONENT_LIBRARY.md#stylediconcomponent) - Automatically applied based on `size` and `color` props
- Directory tree components for folder/device/storage icons
- File listing components for file type icons

**Best Practice:** Use [StyledIconComponent](COMPONENT_LIBRARY.md#stylediconcomponent) instead of applying these classes directly. The component provides type safety, proper defaults, and automatic class application based on semantic props.

#### Action Button Color Classes

**Purpose**: Bridge design tokens to Material button styling for ActionButtonComponent

**Usage Example:**

```html
<lib-action-button icon="save" label="Save" color="success" (buttonClick)="save()">
</lib-action-button>

<lib-action-button icon="delete" label="Delete" color="error" (buttonClick)="delete()">
</lib-action-button>
```

**Available Classes:**

- **`.action-button-success`**: Maps `--color-success` to Material button text color (green success color)

  - Only changes text color via `--mdc-outlined-button-label-text-color`
  - Preserves Material Design borders and styling
  - Includes hover and focus state overrides

- **`.action-button-error`**: Maps `--color-error` to Material button text color (red error color)

  - Only changes text color via `--mdc-outlined-button-label-text-color`
  - Preserves Material Design borders and styling
  - Includes hover and focus state overrides

- **`.action-button-highlight`**: Maps `--color-highlight` to Material button text color (cyan accent color)
  - Only changes text color via `--mdc-outlined-button-label-text-color`
  - Preserves Material Design borders and styling
  - Includes hover and focus state overrides

**Note**: `primary` and `normal` colors use Material Design's natural styling without any custom CSS classes applied.

**Styling Philosophy**: These classes preserve Material Design's natural button appearance while providing semantic color feedback through text color changes only. This approach maintains proper button borders, spacing, and Material styling consistency.

**Used In:**

- [`device-toolbar.component.html`](../libs/features/devices/src/lib/device-view/device-toolbar/device-toolbar.component.html) - Device management action buttons with semantic colors

**Best Practice:** These classes are automatically applied by [ActionButtonComponent](COMPONENT_LIBRARY.md#actionbuttoncomponent) when using the `color` property. Use semantic colors that match the action's intent (error for destructive actions, success for positive actions, primary for main actions, etc.). The component only applies custom classes for non-primary/normal colors to maintain Material Design consistency.

### Dialogs

#### `.glassy-dialog`

**Purpose**: Creates glass-morphism effect for modal dialogs

**Usage Example:**

```html
<mat-dialog class="glassy-dialog">
  <mat-dialog-content>Dialog content</mat-dialog-content>
</mat-dialog>
```

**Used In:**

- [`layout.component.ts`](../libs/app/shell/src/lib/layout/layout.component.ts) - Modal dialogs via `panelClass: 'glassy-dialog'` configuration

#### `.youtube-dialog`

**Purpose**: Specialized dialog styling for YouTube video modals with transparent container and backdrop blur for smooth glassy effect

**Implementation Details:**

```scss
.youtube-dialog {
  .mat-mdc-dialog-container {
    padding: 0 !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    overflow: visible !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}
```

**Features:**

- **Transparent Container**: Removes default Material dialog background to show only inner card
- **Backdrop Blur**: Applies 10px blur to static dialog container for consistent glassy effect
- **No Overflow Clipping**: Allows corner slot content (close button) to be fully visible
- **Zero Padding**: Inner card controls all spacing
- **Custom Backdrop Animation**: 1200ms fade-in via `.youtube-dialog-backdrop` class

**Usage Example:**

```typescript
// In component
this.dialog.open(YouTubeDialogComponent, {
  data: { video },
  width: '800px',
  maxWidth: '90vw',
  panelClass: 'youtube-dialog',
  backdropClass: 'youtube-dialog-backdrop',
});
```

```html
<!-- In dialog template -->
<lib-scaling-card cardClass="glassy-card" [animationDuration]="1200" animationEntry="from-top">
  <iframe src="youtube-embed-url"></iframe>
</lib-scaling-card>
```

**Why Backdrop Blur on Container?**

The dialog container is static (not animated), so applying `backdrop-filter: blur(10px)` to it ensures the blur effect is visible immediately without being affected by the card's transform animation. This creates a layered effect:

1. **Dialog container blur** - Static, visible from dialog open
2. **Card glassy effect** - Animates in with scale/fade
3. **Combined effect** - Smooth, consistent blur throughout animation

**Used In:**

- [`file-other.component.ts`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.ts) - YouTube video dialog
- [`youtube-dialog.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/youtube-dialog/youtube-dialog.component.html) - YouTube video card with iframe

#### `.youtube-dialog-backdrop`

**Purpose**: Custom backdrop fade animation for YouTube dialog

**Implementation:**

```scss
.cdk-overlay-backdrop.cdk-overlay-backdrop-showing.youtube-dialog-backdrop {
  transition: opacity 1200ms cubic-bezier(0.35, 0, 0.25, 1) !important;
}
```

**Usage**: Automatically applied via `backdropClass: 'youtube-dialog-backdrop'` in dialog configuration. Synchronizes backdrop fade (1200ms) with card animation duration for cohesive visual effect.

### Overlays & Backdrop System

#### Global Dialog Backdrop (Default)

**Purpose**: Provides a strong black overlay backdrop for content-focused dialogs (video, YouTube) to create maximum visual contrast between dialog content and the underlying UI.

**Implementation**: Global CSS custom property `--dialog-backdrop-color` set to `rgba(0, 0, 0, 0.85)` (85% opacity black) in both light and dark themes.

**Technical Details:**

```scss
// Applied globally to all Material dialog backdrops by default
.cdk-overlay-backdrop {
  background-color: var(--dialog-backdrop-color) !important;
}

// Theme definitions
html {
  --dialog-backdrop-color: rgba(0, 0, 0, 0.85);
}

html.dark-mode {
  --dialog-backdrop-color: rgba(0, 0, 0, 0.85);
}
```

**Key Features:**

- **Strong contrast**: 85% opacity black provides maximum separation for video/media content
- **Theme-independent**: Same backdrop color in both light and dark modes for predictable UX
- **Automatic application**: All Material dialogs inherit this backdrop automatically
- **No per-dialog configuration**: No need to specify `backdropClass` for standard black backdrop

**Usage Example:**

```typescript
// Video dialog - black backdrop applied automatically
this.dialog.open(VideoDialogComponent, {
  data: { stream, deviceLabel, deviceId },
  width: '85vw',
  height: '85vh',
  panelClass: 'video-dialog-fullscreen',
  // No backdropClass needed - global black backdrop applies
});
```

**Used In:**

- [`video-capture.component.ts`](../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts) - Video capture dialog
- [`file-other.component.ts`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.ts) - YouTube video dialog
- All content-focused dialogs (default behavior)

#### Busy/Loading Dialog Backdrop

**Purpose**: Provides a lighter, semi-transparent backdrop for busy/loading dialogs that need to communicate status without dominating the user's attention.

**Class**: `.busy-dialog-backdrop`

**Implementation**: Uses Material Design's default semi-transparent color-mix formula for a softer, less imposing overlay.

```scss
.cdk-overlay-backdrop.busy-dialog-backdrop {
  background-color: var(
    --mat-sidenav-scrim-color,
    color-mix(in srgb, var(--mat-sys-neutral-variant20) 40%, transparent)
  ) !important;
}
```

**Key Features:**

- **Lighter overlay**: ~40% opacity provides subtle background dimming
- **Theme-adaptive**: Uses Material's neutral-variant colors that adjust per theme
- **Non-intrusive**: Maintains visibility of background context during loading states
- **Fast visibility**: Lighter backdrop appears quickly, communicating status immediately

**Usage Example:**

```typescript
// Busy dialog with lighter backdrop
this.dialog.open(BusyDialogComponent, {
  data: { title: 'Loading', message: 'Please wait...' },
  disableClose: true,
  panelClass: 'glassy-dialog',
  backdropClass: 'busy-dialog-backdrop', // Lighter backdrop for busy states
});
```

**Used In:**

- [`layout.component.ts`](../libs/app/shell/src/lib/layout/layout.component.ts) - Busy dialogs (device indexing, finding devices)

**Design Rationale:**

- **Content dialogs** (video, YouTube) use **dark backdrop** (85% black) for maximum focus and contrast
- **Status dialogs** (busy, loading) use **lighter backdrop** (~40% neutral) for non-intrusive communication
- Different UX contexts justify different backdrop weights

#### Custom Backdrop Animation

**Purpose**: Provides slower backdrop fade-in animation for video-focused dialogs to create a more dramatic, cinematic entrance effect.

**Class**: `.youtube-dialog-backdrop`

**Implementation:**

```scss
.cdk-overlay-backdrop.cdk-overlay-backdrop-showing.youtube-dialog-backdrop {
  transition: opacity 1200ms cubic-bezier(0.35, 0, 0.25, 1) !important;
}
```

**Usage Example:**

```typescript
// YouTube dialog with slow backdrop animation
this.dialog.open(YouTubeDialogComponent, {
  data: { video },
  width: '800px',
  maxWidth: '90vw',
  panelClass: 'youtube-dialog',
  backdropClass: 'youtube-dialog-backdrop', // Slow animation timing
});
```

**Timing Comparison:**

- **Default backdrop**: ~200ms (fast, immediate feedback for busy dialogs)
- **YouTube backdrop**: 1200ms (slow, dramatic for video content)

**Used In:**

- [`file-other.component.ts`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.ts) - YouTube video dialog

**Best Practice:** Use custom `backdropClass` only when you need to override the default animation timing. The backdrop color is always black (from global system) - custom classes only affect animation behavior.

#### Sidenav Overlays

**Purpose**: Dialog backdrop styling also applies to Material sidenav overlays for navigation consistency.

**Used In:**

- [`layout.component.html`](../libs/app/shell/src/lib/layout/layout.component.html) - Navigation sidenav overlay

---

## Layout & Typography

### `.section`

**Purpose**: Standardized section container with title styling

**Usage Example:**

```html
<div class="section">
  <h3 class="section-title">Settings</h3>
  <!-- section content -->
</div>
```

**Used In:** Currently not used in any component templates (available for future use)

---

## Theme Examples

### `.example-bright-container`

**Purpose**: Demonstration of custom theme application

**Usage Example:**

```html
<div class="example-bright-container">
  <!-- Uses cyan palette theme -->
</div>
```

**Used In:** Currently not used in any component templates (available for theme testing and demonstrations)

---

## Usage Guidelines

### Documentation Maintenance

**IMPORTANT**: This document must be updated whenever new global styles are added to the application.

**When to Update:**

- Adding new utility classes to `styles.scss`
- Creating new Material component customizations
- Introducing new color variables or theme tokens
- Adding new layout patterns or reusable styles

**Update Requirements:**

1. **Document the new style** in the appropriate section with:

   - Purpose and description
   - Complete SCSS code example
   - List of components/features that use it
   - Usage examples where applicable

2. **Update "Used In" sections** for existing styles when they are applied to new components

3. **Add cross-references** between related styles and components

4. **Test examples** to ensure they work correctly in both light and dark themes

**Review Process:**

- All style additions should include documentation updates in the same PR/commit
- Code reviews should verify documentation completeness
- Periodic audits should ensure this guide reflects the current codebase

### Angular Material Best Practices

1. **NO `::ng-deep`** - This is deprecated and breaks component encapsulation

   - Use global styles in `styles.scss` for cross-component styling
   - Create utility classes like `.compact-card` for reusable patterns
   - Override Material components through theme configuration when possible

2. **Follow Material Design Guidelines**

   - Use Material's built-in spacing system (`mat-spacing`)
   - Stick to Material's color palette and semantic naming
   - Respect Material's component hierarchy and structure
   - Use Material's typography scale for consistent text sizing

3. **Component Encapsulation**

   - Keep component-specific styles in component SCSS files
   - Use global styles only for truly shared patterns
   - Prefer composition over style overrides
   - Use Material's appearance variants before custom styling

4. **Theme Integration**
   - Always use CSS custom properties for colors that need theme support
   - Test styling in both light and dark modes
   - Use Material's built-in theming mixins when extending components
   - Leverage Material's density and typography configuration

---

## Background Patterns

### Synthwave Neo-Retro Grid

The application layout features a subtle animated synthwave-inspired background pattern that shines through glassy cards for a neo-retro aesthetic.

**Implementation**: `libs/app/shell/src/lib/layout/layout.component.scss`

**Features**:
- Animated radial gradients in primary purple and highlight cyan colors
- Subtle grid pattern (50px spacing) with minimal opacity
- Animated scanlines that drift slowly (20s cycle)
- Gentle pulsing effect (8s cycle) for ambient depth
- Fixed positioning with `z-index: -1` - never interferes with UI

**Design Philosophy**:
- Opacity kept very low (0.015-0.15) to avoid distraction
- Works with both light and dark themes using CSS custom properties
- Enhances glassy card effects by providing visual interest through transparency
- Performance-optimized using CSS animations only (no JavaScript)

**Visual Elements**:
1. **Grid Pattern**: Horizontal/vertical lines create retro grid aesthetic
2. **Radial Gradients**: Purple (primary) and cyan (highlight) ellipses for depth
3. **Scanlines**: Horizontal accent lines with subtle drift animation
4. **Pulsing**: Gentle opacity animation for ambient movement

**SVG Asset**: `apps/teensyrom-ui/public/synthwave-grid.svg`
- Optional detailed synthwave grid with perspective
- Animated scan line effect
- Can be used as alternative background via CSS `background-image`

**Accessibility**: Background opacity ensures WCAG contrast ratios are maintained for all text and interactive elements.

**Used In**: Main application layout (all views)

### Styling Hierarchy

1. **Material Design tokens** (highest priority)
2. **Global utility classes** (`.glassy`, `.compact-card`, etc.)
3. **Component-specific styles** (component SCSS files)
4. **Inline styles** (avoid except for dynamic values)

### Component Integration

- Import global styles are automatically available to all components
- Use theme variables for consistent color schemes
- Apply utility classes for common styling patterns
- Extend base styles rather than overriding when possible

### Maintenance Notes

- All custom color variables support both light and dark modes
- Material component overrides use `!important` sparingly and only when necessary
- Glass effects require backdrop-filter support (modern browsers)
- Icon sizing follows Material Design specifications

---

## CRT Effect CSS Variables

The `lib-crt-effect-wrapper` component exposes CSS custom properties that can be styled or inspected for debugging. These variables are set on the `.crt-wrapper` element.

### Variable Reference

| Variable | Type | Description |
|----------|------|-------------|
| `--scanline-intensity` | `0-1` | Opacity of scanline overlay. 0 = hidden |
| `--scanline-thickness` | `px` | Height of dark scanline bands |
| `--scanline-spacing` | `px` | Gap between scanline bands |
| `--vignette-strength` | `0-2` | Edge/corner darkening intensity. 0 = hidden |
| `--screen-curvature` | `px` | Border-radius for curved screen effect. 0 = flat |
| `--crt-contrast` | `1+` | CSS filter contrast. 1 = no change |
| `--crt-brightness` | `1+` | CSS filter brightness. 1 = no change |
| `--crt-saturation` | `1+` | CSS filter saturation. 1 = no change |

### Usage in Custom Styles

While these variables are typically set by the component's `[settings]` input, they can be inspected or overridden for special cases:

```scss
// Override specific variable in parent context
.my-container lib-crt-effect-wrapper {
  .crt-wrapper {
    --crt-brightness: 1.8; // Extra bright for this context
  }
}
```

### Transition Behavior

All CRT effect variables transition smoothly over 300ms when the `[enabled]` input changes:
- `border-radius` - screen curvature morphs smoothly
- `filter` - color effects fade in/out
- `opacity` - scanlines and vignette overlays fade in/out

**See Also**: [CrtEffectWrapperComponent](./COMPONENT_LIBRARY.md#crteffectwrappercomponent) in Component Library

---

## Related Files

- **Main Styles**: `libs/ui/styles/src/lib/theme/styles.scss`
- **Theme Configuration**: Angular Material theme setup
- **Component Styles**: Individual component SCSS files extend these base styles
