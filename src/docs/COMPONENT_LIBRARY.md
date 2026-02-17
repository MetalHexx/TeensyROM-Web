# TeensyROM UI Component Library

## Overview

This document catalogs all shared UI components available in the TeensyROM application. All components are located in `libs/ui/components/src/lib/` and follow Angular 19 standalone component architecture with modern signal-based inputs.

---

## Layout Components

Pure layout components without animations. Use these when you need static cards.

### `CardLayoutComponent`

**Purpose**: Card layout with headers, titles, metadata, and corner slots. No animations. **Glassy backdrop effect enabled by default.**

**Selector**: `lib-card-layout`

**Properties**:

- `title`: Header title (optional)
- `subtitle`: Text below title (optional)
- `metadataSource`: Footer attribution (optional)
- `enableOverflow`: Allow scrollbars (default: `true`)
- `cardClass`: Additional CSS classes (optional)
- `glassy`: Enable glassy backdrop effect (default: `true`)
- `glassyIntensity`: Glassy effect intensity - `'subtle'`, `'light'`, `'medium'`, `'strong'`, `'dark'`, or `'default'` (default: `'dark'`)

**Glassy Styling**:

All cards include glassy backdrop effect by default with a dark semi-transparent glass appearance. The system automatically applies the appropriate CSS classes based on your configuration:

- **Default behavior**: Dark intensity glassy effect (40% black overlay) with rounded corners - shows synthwave background beautifully
- **Opt-out**: Set `[glassy]="false"` to disable glassy styling entirely
- **Intensity variations**: Control opacity and blur strength via `glassyIntensity`
  - `'subtle'`: 5% white opacity - barely visible tint
  - `'light'`: 7.5% white opacity - gentle glassy effect
  - `'medium'`: 15% white opacity - balanced glassy effect
  - `'strong'`: 20% white opacity - prominent glassy effect
  - `'dark'`: 40% black opacity - dark semi-transparent glass (default - recommended)
  - `'default'`: Uses `.glassy-card` class (40% black opacity + Material Design tokens)

**Usage**:

```html
<!-- Default: dark glassy effect (shows synthwave beautifully) -->
<lib-card-layout title="File Info" subtitle="v1.2.3">
  <mat-chip slot="corner">C64</mat-chip>
  <p>Content...</p>
</lib-card-layout>

<!-- Light glassy effect (more transparent) -->
<lib-card-layout title="Settings" [glassyIntensity]="'light'">
  <form>...</form>
</lib-card-layout>

<!-- Strong glassy effect -->
<lib-card-layout title="YouTube Video" [glassyIntensity]="'strong'">
  <iframe src="..."></iframe>
</lib-card-layout>

<!-- Disable glassy effect -->
<lib-card-layout title="Plain Card" [glassy]="false">
  <p>No backdrop blur</p>
</lib-card-layout>

<!-- Custom classes still work -->
<lib-card-layout title="Custom" cardClass="my-custom-class">
  <p>Combined with glassy effect</p>
</lib-card-layout>
```

**Content Slots**: 
- Default slot for body content
- `[slot=corner]` for upper-right corner (e.g., close button, status indicator)
- `[slot=header]` for custom header content above title (e.g., navigation controls, action buttons)

**Header Slot** (optional):

Use `slot="header"` to project custom component content into the card header area. Header slot content appears **above** the title/subtitle when both are provided. This enables rich, interactive headers with navigation controls, toolbars, or complex layouts.

**Header Slot Usage Examples**:

```html
<!-- Header slot with title (header content appears above title) -->
<lib-card-layout [title]="cardTitle">
  <div slot="header" class="custom-navigation">
    <button mat-icon-button><mat-icon>arrow_back</mat-icon></button>
    <button mat-icon-button><mat-icon>refresh</mat-icon></button>
  </div>
  <div>Card content here</div>
</lib-card-layout>

<!-- Header slot without title (only custom header content) -->
<lib-card-layout>
  <my-breadcrumb-component slot="header"></my-breadcrumb-component>
  <p>Body content...</p>
</lib-card-layout>

<!-- Header slot with title, subtitle, and corner -->
<lib-card-layout title="Main Title" subtitle="Description">
  <custom-toolbar slot="header"></custom-toolbar>
  <button mat-icon-button slot="corner"><mat-icon>more_vert</mat-icon></button>
  <div>Content...</div>
</lib-card-layout>
```

**Header Slot Styling**:
- **Spacing**: 12px margin-bottom between header slot content and title (when both present)
- **No spacing**: Margin removed when header slot is the only content (no title follows)
- **Auto-hide**: Header section automatically hidden via CSS `:empty` when no title or header slot content exists

**Typical Use Cases**:
- Navigation breadcrumbs in file browsers
- Action toolbars with back/forward/refresh controls
- Complex header layouts with filters and search
- Custom navigation controls integrated into card headers

**Used In**:
- [directory-files.component.html](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-files.component.html) - Embeds directory-trail component in header slot when showing directory contents (storage-level view)

**Spacing Tokens**: This component internally uses `--spacing-card-padding` (12px) for content margins, corner positioning, and header reservation. The `bufferPx = 8` named constant corresponds to `--spacing-sm`. See the [Style Guide](STYLE_GUIDE.md#spacing-tokens) for the full token reference.

**See Also**: [ScalingCardComponent](#scalingcardcomponent) for animated version

### `CompactCardLayoutComponent`

**Purpose**: Minimal card layout for forms and toolbars. No headers, no animations. **Glassy backdrop effect enabled by default.**

**Selector**: `lib-compact-card-layout`

**Properties**:

- `enableOverflow`: Allow scrollbars (default: `true`)
- `cardClass`: Additional CSS classes (optional)
- `glassy`: Enable glassy backdrop effect (default: `true`)
- `glassyIntensity`: Glassy effect intensity - `'subtle'`, `'light'`, `'medium'`, `'strong'`, `'dark'`, or `'default'` (default: `'dark'`)

**Glassy Styling**:

All compact cards include glassy backdrop effect by default with a dark semi-transparent glass appearance. The system automatically applies the appropriate CSS classes:

- **Default behavior**: Dark intensity glassy effect (40% black overlay) with rounded corners - shows synthwave background beautifully
- **Opt-out**: Set `[glassy]="false"` to disable glassy styling entirely
- **Intensity variations**: Control opacity and blur strength via `glassyIntensity`
  - `'subtle'`: 5% white opacity - barely visible tint
  - `'light'`: 7.5% white opacity - gentle glassy effect
  - `'medium'`: 15% white opacity - balanced glassy effect
  - `'strong'`: 20% white opacity - prominent glassy effect
  - `'dark'`: 40% black opacity - dark semi-transparent glass (default - recommended)
  - `'default'`: Uses `.glassy-card` class (40% black opacity + Material Design tokens)

**Usage**:

```html
<!-- Default: dark glassy effect (shows synthwave beautifully) -->
<lib-compact-card-layout>
  <mat-form-field>
    <input matInput />
  </mat-form-field>
</lib-compact-card-layout>

<!-- Light glassy effect for more transparency -->
<lib-compact-card-layout [glassyIntensity]="'light'">
  <div class="toolbar-buttons">...</div>
</lib-compact-card-layout>

<!-- Strong glassy effect for prominent overlays -->
<lib-compact-card-layout [glassyIntensity]="'strong'">
  <div class="overlay-content">...</div>
</lib-compact-card-layout>

<!-- Disable glassy effect -->
<lib-compact-card-layout [glassy]="false">
  <form>Plain card without blur</form>
</lib-compact-card-layout>

<!-- Custom classes still work -->
<lib-compact-card-layout cardClass="custom-toolbar-class">
  <div>Combined with glassy effect</div>
</lib-compact-card-layout>
```

**Spacing Tokens**: Defaults to `--spacing-card-padding-compact` (12px) via the `.compact-card` global class. Consumers can override via the `--compact-card-padding` CSS custom property. See the [Style Guide](STYLE_GUIDE.md#spacing-tokens) for the full token reference.

**See Also**: [ScalingCompactCardComponent](#scalingcompactcardcomponent) for animated version

---

## Animated Card Components

Animated cards that combine layout + animation. See [Animation System](#animation-system) for chaining details.

### `ScalingCardComponent`

**Purpose**: Animated card with scale+fade+slide effects. Composes [CardLayoutComponent](#cardlayoutcomponent) + [ScalingContainerComponent](#scalingcontainercomponent). **Inherits glassy backdrop effect from CardLayoutComponent.**

**Selector**: `lib-scaling-card`

**Properties**:

- Layout props: `title`, `subtitle`, `metadataSource`, `enableOverflow`, `cardClass`, `glassy`, `glassyIntensity`
- Animation props: `animationEntry`, `animationExit`, `animationTrigger`, `animationParent`, `animationDuration`

**Glassy Styling**: 

Inherits all glassy styling options from [CardLayoutComponent](#cardlayoutcomponent). Glassy effect is enabled by default with `'medium'` intensity.

**Usage**:

```html
<!-- Default: medium glassy effect with animation -->
<lib-scaling-card title="Device" animationEntry="from-left">
  <button mat-icon-button slot="corner"><mat-icon>more_vert</mat-icon></button>
  <p>Content...</p>
</lib-scaling-card>

<!-- Custom animation speed with strong glassy effect -->
<lib-scaling-card
  title="YouTube Video"
  [animationDuration]="1200"
  [glassyIntensity]="'strong'"
  animationEntry="from-top"
>
  <iframe src="..."></iframe>
</lib-scaling-card>

<!-- Disable glassy effect -->
<lib-scaling-card title="Plain" [glassy]="false" animationEntry="from-bottom">
  <p>No backdrop blur</p>
</lib-scaling-card>

<!-- Legacy approach still works (but not needed) -->
<lib-scaling-card cardClass="glassy-card" title="Legacy">
  <p>Explicitly passing glassy-card class</p>
</lib-scaling-card>
```

**Consumer Note**: This is the **public-facing card wrapper** consumers should use for standard cards. It composes layout + animation in one component.

**See Also**: [CardLayoutComponent](#cardlayoutcomponent), [ScalingContainerComponent](#scalingcontainercomponent), [Animation System](#animation-system)

### `ScalingCompactCardComponent`

**Purpose**: Animated compact card for forms/toolbars. Composes [CompactCardLayoutComponent](#compactcardlayoutcomponent) + [ScalingContainerComponent](#scalingcontainercomponent). **Inherits glassy backdrop effect from CompactCardLayoutComponent.**

**Selector**: `lib-scaling-compact-card`

**Properties**:

- Layout props: `enableOverflow`, `cardClass`, `glassy`, `glassyIntensity`
- Animation props: `animationEntry`, `animationExit`, `animationTrigger`, `animationParent`, `animationDuration`

**Glassy Styling**: 

Inherits all glassy styling options from [CompactCardLayoutComponent](#compactcardlayoutcomponent). Glassy effect is enabled by default with `'medium'` intensity.

**Usage**:

```html
<!-- Default: medium glassy effect with animation -->
<lib-scaling-compact-card animationEntry="from-top">
  <mat-form-field><input matInput /></mat-form-field>
</lib-scaling-compact-card>

<!-- Custom animation speed with subtle glassy effect -->
<lib-scaling-compact-card 
  [animationDuration]="800" 
  [glassyIntensity]="'subtle'"
  animationEntry="from-left"
>
  <form>...</form>
</lib-scaling-compact-card>

<!-- Strong glassy effect for prominent overlays -->
<lib-scaling-compact-card [glassyIntensity]="'strong'" animationEntry="from-top">
  <div class="overlay-controls">...</div>
</lib-scaling-compact-card>

<!-- Disable glassy effect -->
<lib-scaling-compact-card [glassy]="false" animationEntry="from-right">
  <div>Plain card without blur</div>
</lib-scaling-compact-card>

<!-- Legacy approach still works (but not needed) -->
<lib-scaling-compact-card cardClass="glassy-card" animationEntry="from-top">
  <div>Explicitly passing glassy-card class</div>
</lib-scaling-compact-card>
```

**Consumer Note**: This is the **public-facing compact card wrapper** consumers should use for forms and toolbars. It composes layout + animation in one component.

**See Also**: [CompactCardLayoutComponent](#compactcardlayoutcomponent), [ScalingContainerComponent](#scalingcontainercomponent), [Animation System](#animation-system)

---

## Animation Container Components

Reusable animation wrappers. Can be used directly or composed into other components.

### `SlidingContainerComponent`

**Purpose**: Container slide animation with height/width expansion. Affects document flow - content pushes/pulls surrounding elements. Supports smooth entry and exit animations.

**Selector**: `lib-sliding-container`

**Properties**:

- `containerHeight`: Height (default: `'auto'`)
- `containerWidth`: Width (default: `'auto'`)
- `animationDuration`: Duration in ms (default: `400`)
- `animationDirection`: Direction - `'from-top'`, `'slide-down'`, `'slide-up'`, `'fade'`, etc. (default: `'from-top'`)
- `animationTrigger`: Manual control signal (optional) - **Enables exit animations**
- `animationParent`: Override animation chaining (optional - see [Animation System](#animation-system))
- `showContainer`: Computed signal controlling visibility (internal)

**Events**:

- `animationComplete`: Emitted when animation finishes

**Animation Behavior**:

- **Entry**: Height/width expansion from 0 to target size with opacity fade-in and directional slide. Uses cubic-bezier easing for smooth motion.
- **Exit**: Uses `animationTrigger` to play reverse animation before removing from DOM. Component stays visible during exit animation.
- **Transitions**: `void => visible` (initial), `hidden => visible` (show), `visible => hidden` (hide with animation)

**Usage**:

```html
<!-- Basic entry animation -->
<lib-sliding-container containerHeight="80px" animationDirection="from-top">
  <lib-scaling-compact-card>
    <div class="toolbar">...</div>
  </lib-scaling-compact-card>
</lib-sliding-container>

<!-- With exit animations using animationTrigger -->
<lib-sliding-container
  containerHeight="80px"
  animationDirection="slide-down"
  [animationTrigger]="isVisible()"
>
  <div>Slides in and out smoothly</div>
</lib-sliding-container>

<!-- Nested with auto-chaining -->
<lib-sliding-container [animationTrigger]="isReady()">
  <lib-scaling-compact-card>
    <div>Waits for parent slide animation</div>
  </lib-scaling-compact-card>
</lib-sliding-container>
```

**Exit Animation Pattern**: When using `animationTrigger`, the component will:

1. Play exit animation when trigger becomes `false`
2. Remove from DOM after animation completes
3. Re-appear with entry animation when trigger becomes `true`

**Z-Index Management**: The component automatically manages z-index layering for proper click handling when multiple animated components overlap:

- **Visible state** (`animationTrigger=true`): `z-index: 1000` - Component is on top and fully interactive
- **Hidden state** (`animationTrigger=false`): `z-index: 1` - Component is below and won't block clicks during exit animation

**Comparison**:

- **SlidingContainer**: Height/width expansion, affects layout flow, pushes surrounding content, **supports exit animations**
- **ScalingContainer**: Transform-based, no layout impact, visual "pop" effect

**See Also**: [ScalingContainerComponent](#scalingcontainercomponent), [Animation System](#animation-system)

### `ScalingContainerComponent`

**Purpose**: Scale+fade+slide animation wrapper. Transform-based - doesn't affect document flow. Creates "pop-in" effect with smooth entry and exit animations.

**Selector**: `lib-scaling-container`

**Properties**:

- `animationEntry`: Entry direction - `'random'`, `'from-left'`, `'from-right'`, `'from-top'`, `'from-bottom'`, etc. (default: `'random'`)
- `animationExit`: Exit direction (default: `'random'`)
- `animationTrigger`: Manual control signal (optional) - **Enables exit animations**
- `animationParent`: Override animation chaining (optional - see [Animation System](#animation-system))
- `animationDuration`: Transform animation duration in milliseconds (default: `2000`) - Opacity duration is automatically calculated as 1.5x this value for smoother fade effect

**Events**:

- `animationComplete`: Emitted when animation finishes

**Animation Behavior**:

- **Entry**: 0.8→1.0 scale, opacity 0→1 fade, -40px directional slide. Transform uses `animationDuration` (default 2000ms), opacity uses 1.5x that value (default 3000ms) for smooth reveal.
- **Exit**: Uses `animationTrigger` to play reverse animation before removing from DOM. Component stays visible during exit animation.
- **Transitions**: `void => visible` (initial), `hidden => visible` (show), `visible => hidden` (hide with animation)
- **No Overflow Clipping**: Content is fully visible throughout animation - corner slots (like close buttons) are never clipped

**Usage**:

```html
<!-- Basic entry animation with default duration (2000ms) -->
<lib-scaling-container animationEntry="from-left">
  <div class="panel">Scales in from left</div>
</lib-scaling-container>

<!-- Custom faster animation (1200ms transform, 1800ms opacity) -->
<lib-scaling-container animationEntry="from-top" [animationDuration]="1200">
  <div>Snappy animation</div>
</lib-scaling-container>

<!-- With exit animations using animationTrigger -->
<lib-scaling-container
  animationEntry="from-left"
  animationExit="from-right"
  [animationTrigger]="isVisible()"
>
  <div>Animates in and out smoothly</div>
</lib-scaling-container>

<!-- Toggle between components with exit animations -->
<div style="position: relative">
  <lib-component-a [animationTrigger]="showA()"></lib-component-a>
  <lib-component-b [animationTrigger]="!showA()"></lib-component-b>
</div>

<!-- Nested with auto-chaining -->
<lib-sliding-container [animationTrigger]="isReady()">
  <lib-scaling-container animationEntry="from-top">
    <div>Waits for parent</div>
  </lib-scaling-container>
</lib-sliding-container>
```

**Browser Limitation Note**:

When using CSS `backdrop-filter` (e.g., for glassy effects) on animated content, the blur may not render smoothly during transform animations. This is a browser limitation where GPU-accelerated transforms don't play well with backdrop-filter.

**Workaround**: For dialogs or overlays with glassy effects:

1. Apply `backdrop-filter` to the static dialog container (non-animated parent)
2. Use ScalingContainer for the inner animated card
3. This creates a layered effect where the blur is always visible

Example:

```typescript
// Dialog config
this.dialog.open(MyDialogComponent, {
  panelClass: 'my-glassy-dialog', // Has backdrop-filter on .mat-mdc-dialog-container
  backdropClass: 'my-dialog-backdrop',
});
```

```html
<!-- Dialog template -->
<lib-scaling-card cardClass="glassy-card" [animationDuration]="1200" animationEntry="from-top">
  <div>Content with smooth blur effect</div>
</lib-scaling-card>
```

**Exit Animation Pattern**: When using `animationTrigger`, always render both components and let the trigger control visibility. Position them absolutely if overlapping. The component will:

1. Play exit animation when trigger becomes `false`
2. Remove from DOM after animation completes
3. Re-appear with entry animation when trigger becomes `true`

**Z-Index Management**: The component automatically manages z-index layering for proper click handling when multiple animated components overlap:

- **Visible state** (`animationTrigger=true`): `z-index: 1000` - Component is on top and fully interactive
- **Hidden state** (`animationTrigger=false`): `z-index: 1` - Component is below and won't block clicks during exit animation

**Comparison**:

- **ScalingContainer**: Transform-based, no layout impact, visual "pop" effect, **supports exit animations**
- **SlidingContainer**: Height/width expansion, pushes surrounding content

**Used By**: [ScalingCardComponent](#scalingcardcomponent), [ScalingCompactCardComponent](#scalingcompactcardcomponent)

**See Also**: [SlidingContainerComponent](#slidingcontainercomponent), [FadingContainerComponent](#fadingcontainercomponent), [Animation System](#animation-system)

### `FadingContainerComponent`

**Purpose**: Simple fade + blur animation wrapper. No transforms or directional movement - just smooth opacity fade with blur effect for entry and exit animations. Perfect for subtle transitions and lightweight animations.

**Selector**: `lib-fading-container`

**Properties**:

- `animationTrigger`: Manual control signal (optional) - **Enables exit animations**
- `animationParent`: Override animation chaining (optional - see [Animation System](#animation-system))
- `animationDuration`: Animation duration in milliseconds (default: `200`)

**Events**:

- `animationComplete`: Emitted when animation finishes

**Animation Behavior**:

- **Entry**: 0→1 opacity fade with 10px→0px blur effect. Single smooth transition (default 200ms) with cubic-bezier easing.
- **Exit**: Uses `animationTrigger` to play reverse animation before removing from DOM. Component stays visible during exit animation.
- **Transitions**: `void => visible` (initial), `hidden => visible` (show), `visible => hidden` (hide with animation)
- **No Transforms**: Unlike scaling/sliding containers, this component uses pure opacity and blur - no scale, translate, or layout changes

**Backdrop-Filter Advantage**:

Because FadingContainer uses **no CSS transforms**, it's the best choice for content with `backdrop-filter` (glassy effects). Browsers render backdrop-filter smoothly during opacity-only animations, avoiding the "blur pop-in" issue that occurs with transform-based animations.

**Use FadingContainer when**:

- Content has `.glassy-card` or other backdrop-filter styling
- You want the smoothest possible blur effect throughout animation
- Transform-based "pop" effect is not needed
- Lightweight, subtle transitions are preferred

**Usage**:

```html
<!-- Basic entry animation with default duration (200ms) -->
<lib-fading-container>
  <div class="content">Fades in smoothly</div>
</lib-fading-container>

<!-- Longer animation for dramatic effect (1200ms) -->
<lib-fading-container [animationDuration]="1200">
  <div class="glassy-card">Slower fade with blur</div>
</lib-fading-container>

<!-- With exit animations using animationTrigger -->
<lib-fading-container [animationTrigger]="isVisible()">
  <div>Fades in and out with blur effect</div>
</lib-fading-container>

<!-- Toggle between components with exit animations -->
<div style="position: relative">
  <lib-fading-container [animationTrigger]="showA()">
    <div>Component A</div>
  </lib-fading-container>
  <lib-fading-container [animationTrigger]="!showA()">
    <div>Component B</div>
  </lib-fading-container>
</div>

<!-- Nested with auto-chaining -->
<lib-sliding-container [animationTrigger]="isReady()">
  <lib-fading-container animationParent="auto">
    <div>Waits for parent animation</div>
  </lib-fading-container>
</lib-sliding-container>

<!-- Perfect for glassy dialog overlays (smooth backdrop-filter) -->
<lib-fading-container [animationDuration]="800">
  <lib-card-layout cardClass="glassy-card">
    <div>Blur renders perfectly - no transforms!</div>
  </lib-card-layout>
</lib-fading-container>
```

**Exit Animation Pattern**: When using `animationTrigger`, always render both components and let the trigger control visibility. Position them absolutely if overlapping. The component will:

1. Play exit animation when trigger becomes `false`
2. Remove from DOM after animation completes
3. Re-appear with entry animation when trigger becomes `true`

**Z-Index Management**: The component automatically manages z-index layering for proper click handling when multiple animated components overlap:

- **Visible state** (`animationTrigger=true`): `z-index: 1000` - Component is on top and fully interactive
- **Hidden state** (`animationTrigger=false`): `z-index: 1` - Component is below and won't block clicks during exit animation

**Comparison**:

- **FadingContainer**: Pure opacity + blur, no transforms, no layout impact, subtle lightweight animation
- **ScalingContainer**: Transform-based with scale + directional slide, visual "pop" effect
- **SlidingContainer**: Height/width expansion, pushes surrounding content

**Use Cases**:

- Subtle content transitions where directional movement would be distracting
- Modal overlays and tooltips that need gentle appearance/disappearance
- Content areas where you want smooth transitions without "popping" or sliding
- Lightweight animations for frequently toggled elements
- Cross-fading between different content states

**See Also**: [ScalingContainerComponent](#scalingcontainercomponent), [SlidingContainerComponent](#slidingcontainercomponent), [Animation System](#animation-system)

### `LoadingTextComponent`

**Purpose**: Elegant loading text indicator with fade animation and leet-speak cycling effect. Wraps [LeetTextContainerComponent](#leettextcontainercomponent) with smooth fade-in/fade-out transitions. Perfect for corner slots, loading indicators, and status messages. Displays "Loading..." by default, but supports custom text via input signal for context-specific messages.

**Selector**: `lib-loading-text`

**Properties**:

- `visible`: `boolean` - Controls visibility with fade animation (default: `false`)
- `text`: `string` - Custom text to display (default: `"Loading..."`) - Use for context-specific messages like "Autosaving...", "Processing...", etc.
- `showSpinner`: `boolean` - Show animated spinner before text (default: `true`)
- `animationDuration`: `number` - Duration of leet cycling in ms (default: `1000`)

**Usage**:

```html
<!-- Default "Loading..." text in corner slot -->
<lib-scaling-card title="Data">
  <lib-loading-text slot="corner" [visible]="isLoading()"></lib-loading-text>
  <p>Content...</p>
</lib-scaling-card>

<!-- Custom text via input signal -->
<lib-loading-text [visible]="isProcessing()" [text]="'Processing...'"></lib-loading-text>

<!-- Autosaving indicator -->
<lib-loading-text [visible]="isSaving()" [text]="'Autosaving...'"></lib-loading-text>

<!-- Without spinner -->
<lib-loading-text [visible]="isSaving()" [text]="'Saving...'" [showSpinner]="false"></lib-loading-text>

<!-- Custom animation speed -->
<lib-loading-text [visible]="isLoading()" [text]="'Fast Loading...'" [animationDuration]="500"></lib-loading-text>
```

**Animation Behavior**:

- **Fade In**: 200ms cubic-bezier transition when `visible` becomes `true`
- **Fade Out**: 200ms cubic-bezier transition when `visible` becomes `false`
- **Leet Cycling**: Continuous character transformation while visible
- **Spinner**: Classic `/` `-` `\` `|` rotation at 100ms intervals (when enabled)

**Use Cases**:

- Loading indicators in card corner slots
- Status messages in toolbars and headers  
- Autosaving/processing feedback ("Autosaving...", "Processing...")
- Retro-styled loading states with personality

**Used In**:
- `libs/features/settings/src/lib/settings-view/settings-view.component.html` - Autosaving indicator

**Comparison**:

- **LoadingTextComponent**: Pre-packaged loading indicator with fade animations and leet-speak
- **LeetTextContainerComponent**: Raw leet-speak animation without fade transitions

**See Also**: [LeetTextContainerComponent](#leettextcontainercomponent), [FadingContainerComponent](#fadingcontainercomponent)

### `LeetTextContainerComponent`

**Purpose**: Animated text container with "leet speak" character cycling animation and optional spinner effects. Features a continuous wave animation that cycles through text characters, transforming them into leet-speak variants. Perfect for retro/demoscene-inspired loading indicators and status messages with a cyberpunk aesthetic.

**Selector**: `lib-leet-text-container`

**Properties**:

- `animationTrigger`: Manual control signal (optional) - **Enables exit animations**
- `animationDuration`: `number` - Duration of the leet cycling animation in milliseconds (default: `1000`)
- `animationParent`: Override animation chaining (optional - see [Animation System](#animation-system))
- `showFrontSpinner`: `boolean` - Show animated spinner before the text (default: `false`)
- `showBackSpinner`: `boolean` - Show animated spinner after the text (default: `false`)

**Events**:

- `animationComplete`: Emitted when animations complete

**Animation Behavior**:

- **Continuous Cycling**: One character at a time transforms to leet-speak, creating a wave effect
- **Bidirectional Wave**: Animation moves forward through the text, then reverses and moves backward
- **Smart Character Selection**: Only cycles through characters that have leet mappings, skipping punctuation and spaces
- **Spinner Animation**: Classic `/` `-` `\` `|` text spinner rotates independently at 100ms intervals
- **Gradient Flow**: Continuous gradient animation flows through the text using theme colors
- **Theme Integration**: Uses `--color-highlight` and `--color-primary-bright` for gradient effects

**Usage**:

```html
<!-- Basic usage with ng-content (no spinners) -->
<lib-leet-text-container>Loading...</lib-leet-text-container>

<!-- With front spinner -->
<lib-leet-text-container [showFrontSpinner]="true"> Loading... </lib-leet-text-container>

<!-- With both spinners -->
<lib-leet-text-container [showFrontSpinner]="true" [showBackSpinner]="true">
  Processing...
</lib-leet-text-container>

<!-- With animation trigger control -->
<lib-leet-text-container [showFrontSpinner]="true" [animationTrigger]="isVisible()">
  Status: {{ statusMessage() }}
</lib-leet-text-container>

<!-- Custom animation speed (controls cycling speed) -->
<lib-leet-text-container [showFrontSpinner]="true" [animationDuration]="500">
  Fast Animation
</lib-leet-text-container>
```

**Advanced Usage Patterns**:

```typescript
export class LoadingComponent {
  isLoading = signal(true);

  onAnimationComplete(): void {
    console.log('Leet animation finished');
    // Trigger next action
  }
}
```

```html
<!-- Loading indicator in corner slot -->
<lib-scaling-card title="Data">
  <div slot="corner">
    <lib-leet-text-container [showFrontSpinner]="true"> Loading... </lib-leet-text-container>
  </div>
  <!-- Card content -->
</lib-scaling-card>
```

**Character Mapping**:

The component uses the following leet-speak substitutions:

- `a` → `@`, `4`
- `e` → `3`
- `i` → `1`, `!`
- `o` → `0`
- `s` → `5`, `$`
- `t` → `7`, `+`
- `l` → `1`, `|`
- `g` → `9`, `6`
- `b` → `8`

**Animation Details**:

- **Cycling Speed**: 200ms per character (configurable via `animationDuration`)
- **Wave Direction**: Moves forward through text, then reverses and moves backward continuously
- **Character Selection**: Automatically skips non-translatable characters (punctuation, spaces) for smooth flow
- **Gradient Flow**: 2-second continuous loop with theme-integrated color gradient
- **Spinner Speed**: 100ms rotation cycle through `/` `-` `\` `|` characters
- **Font**: Monospace ('Courier New') for authentic retro terminal aesthetic

**Style Features**:

- **Theme Integration**: Uses `--color-highlight` (cyan) and `--color-primary-bright` (magenta) from design system
- **Gradient Animation**: Linear gradient flows horizontally through text using `background-clip: text`
- **Text Transparency**: `-webkit-text-fill-color: transparent` reveals gradient through text
- **Glow Effect**: Drop shadow using highlight color when animating
- **Responsive Colors**: Automatically adapts to light/dark theme changes

**Animation System Integration**:

The component fully integrates with the animation system:

- Registers as animation parent via DI provider
- Supports `animationParent` for waiting on parent animations
- Emits `animationComplete` when animations finish
- Uses `animationCompleteSignal` for child component coordination

**Content Projection**:

Text is provided via `ng-content` between the component tags. The component automatically extracts the text content and applies the leet-speak animation to it while hiding the original content.

**Use Cases**:

- Loading indicators with retro terminal aesthetic
- Status messages with cyberpunk styling
- Corner indicators in cards showing processing state
- CLI-style notifications and system messages
- Gaming UI elements with demoscene inspiration

**Performance Considerations**:

- Wave animation cycles at 200ms intervals (one character at a time)
- Gradient animation is CSS-based and GPU-accelerated
- Character substitution uses efficient string splitting
- Optimized to only animate characters with leet mappings
- Suitable for text up to ~50 characters for smooth animation

**Best Practice**: Use for short text strings (status messages, loading indicators, labels) where the retro animated aesthetic enhances the user experience. Enable spinners for loading states to provide clear visual feedback. The component automatically handles the continuous cycling animation, creating a mesmerizing effect that works perfectly in card corners, toolbars, or inline status displays. Ideal for CLI-style applications, retro gaming interfaces, or cyberpunk-themed UIs.

**See Also**: [FadingContainerComponent](#fadingcontainercomponent), [ScrollingMarqueeComponent](#scrollingmarqueecomponent), [Animation System](#animation-system)

---

## Animation System

**Purpose**: Automatic animation coordination between components via Angular's dependency injection. Components can chain animations when nested, or use explicit triggers for independent control.

**How It Works**:

Animation components use Angular DI to provide/inject completion signals via `PARENT_ANIMATION_COMPLETE` token. Components **do not auto-chain by default** - you must explicitly opt-in using `animationParent="auto"` or set a custom animation parent. This prevents unintended chaining when nesting components for layout purposes.

**Priority System**:

1. **Explicit trigger** (highest): Use provided `animationTrigger` signal
2. **Custom parent override** (high): Use provided `animationParent` to opt-in or redirect chains
3. **Immediate** (default): Render immediately if no trigger or parent specified

**Controlling Animation Chaining**:

All animatable components support an `animationParent` input for controlling when they wait for parent animations:

- `undefined` (default): No waiting - component animates immediately, ignoring any parent animations
- `null`: Same as undefined - no waiting, immediate animation
- `'auto'`: Opt-in to wait for the nearest animation parent in the DI tree
- `AnimationParent`: Wait for a specific component reference (can be sibling, ancestor, or any component)

**Important**: Components **always register as animation parents** regardless of their `animationParent` setting. The `animationParent` input only controls whether a component **waits for** a parent, not whether it **is available as** a parent to its children.

> **Note**: "Animation parent" refers to the animation chaining relationship, not the DOM parent. You can set any component as an animation parent - siblings, ancestors, or components anywhere in your tree. This decouples animation choreography from component hierarchy.

**Usage**:

```html
<!-- Explicit auto-chaining: nested components opt-in to wait for parent -->
<lib-sliding-container [animationTrigger]="isReady()">
  <!-- Must explicitly use animationParent="auto" to wait for parent -->
  <lib-scaling-compact-card animationEntry="from-top" animationParent="auto">
    <div>Animates after parent (explicit opt-in)</div>
  </lib-scaling-compact-card>
</lib-sliding-container>

<!-- Independent control: components animate immediately by default -->
<div class="layout">
  <lib-scaling-card>Animates immediately</lib-scaling-card>
  <lib-scaling-card>Animates immediately</lib-scaling-card>
  <lib-scaling-card [animationTrigger]="showCard3()">Explicit timing</lib-scaling-card>
</div>

<!-- Multi-level chaining with explicit opt-in -->
<lib-scaling-card title="Parent" [animationTrigger]="show()">
  <!-- Child must opt-in to wait for parent -->
  <lib-sliding-container animationDirection="slide-down" animationParent="auto">
    <!-- Grandchild must opt-in to wait for sliding-container -->
    <lib-scaling-compact-card animationParent="auto">
      <p>Waits for parent, then sliding-container</p>
    </lib-scaling-compact-card>
  </lib-sliding-container>
</lib-scaling-card>

<!-- Nesting for layout without animation chaining -->
<lib-sliding-container [animationTrigger]="isReady()">
  <!-- These don't wait - they're just using the container for layout -->
  <lib-scaling-card>Animates immediately</lib-scaling-card>
  <lib-scaling-card>Animates immediately</lib-scaling-card>

  <!-- This one opts into waiting for parent -->
  <lib-scaling-card animationParent="auto">Waits for parent animation</lib-scaling-card>
</lib-sliding-container>

<!-- Custom parent: redirect animation chain to any component -->
<div class="layout">
  <!-- Master timeline controller (animation parent for coordination) -->
  <lib-sliding-container #masterTimeline [animationTrigger]="show()"> </lib-sliding-container>

  <!-- Elsewhere in the tree - siblings sync to same animation parent -->
  <div class="section-a">
    <lib-scaling-card [animationParent]="masterTimeline">Card A</lib-scaling-card>
  </div>

  <div class="section-b">
    <lib-scaling-card [animationParent]="masterTimeline">Card B</lib-scaling-card>
  </div>
</div>
```

**Flexibility**: By default, components animate immediately. Use `animationParent="auto"` for parent/child coordination, explicit `animationTrigger` signals for any timing pattern, or `animationParent` with a component reference to create custom choreography - sequenced animations, parallel animations, conditional animations, independent timelines, etc.

**Applies To**: All animation components - [ScalingCardComponent](#scalingcardcomponent), [ScalingCompactCardComponent](#scalingcompactcardcomponent), [ScalingContainerComponent](#scalingcontainercomponent), [SlidingContainerComponent](#slidingcontainercomponent), [FadingContainerComponent](#fadingcontainercomponent)

---

## Feedback Components

### `EmptyStateMessageComponent`

**Purpose**: A reusable component for displaying centered empty state messages with an icon, title, and optional descriptive text. Commonly used for "no data" scenarios like empty lists, no search results, or missing connections. Provides consistent UX for empty states throughout the application.

**Selector**: `lib-empty-state-message`

**Properties**:

- `icon` (required): `string` - Material Design icon name to display (e.g., 'devices', 'search_off', 'folder_open')
- `title` (required): `string` - Primary title text displayed prominently below the icon
- `message` (optional): `string` - Optional message text displayed below the title for additional context
- `secondaryMessage` (optional): `string` - Optional secondary message text, typically dimmed and smaller (supports HTML like `<strong>`)
- `size` (optional): `'small' | 'medium' | 'large'` - Size variant controlling icon size and text sizing - defaults to 'medium'

**Usage Examples**:

```html
<!-- Basic usage with required fields only -->
<lib-empty-state-message icon="devices" title="No Connected Devices"> </lib-empty-state-message>

<!-- With all optional fields -->
<lib-empty-state-message
  icon="search_off"
  title="No Results Found"
  message="Try adjusting your search terms or filter settings."
  secondaryMessage="Visit the <strong>Device View</strong> to manage your devices."
>
</lib-empty-state-message>

<!-- Small size for compact areas -->
<lib-empty-state-message
  icon="folder_open"
  title="Empty Folder"
  message="This folder contains no files."
  size="small"
>
</lib-empty-state-message>

<!-- Large size for prominent empty states -->
<lib-empty-state-message
  icon="cloud_off"
  title="No Connection"
  message="Unable to connect to the device."
  secondaryMessage="Check your USB connection and try again."
  size="large"
>
</lib-empty-state-message>
```

**Advanced Usage Patterns**:

```typescript
export class FileListComponent {
  files = signal<File[]>([]);
  isLoading = signal(false);

  emptyStateConfig = computed(() => {
    if (this.isLoading()) {
      return null; // Show loading spinner instead
    }

    const fileCount = this.files().length;

    if (fileCount === 0) {
      return {
        icon: 'folder_open',
        title: 'No Files Found',
        message: 'This directory is empty.',
        secondaryMessage: 'Upload files to get started.',
      };
    }

    return null; // Files exist, show file list
  });
}
```

```html
@if (emptyStateConfig()) {
<lib-empty-state-message
  [icon]="emptyStateConfig()!.icon"
  [title]="emptyStateConfig()!.title"
  [message]="emptyStateConfig()!.message"
  [secondaryMessage]="emptyStateConfig()!.secondaryMessage"
>
</lib-empty-state-message>
} @else if (isLoading()) {
<mat-spinner></mat-spinner>
} @else {
<!-- File list content -->
}
```

**Size Variants**:

- **Small** (`size="small"`):

  - Icon: 2rem (32px)
  - Title: 1rem
  - Padding: 1rem
  - Gap: 0.5rem
  - Use case: Compact areas, sidebar panels, small containers

- **Medium** (`size="medium"`) - Default:

  - Icon: 4rem (64px)
  - Title: 1.5rem
  - Padding: 2rem
  - Gap: 1rem
  - Use case: Standard empty states, main content areas

- **Large** (`size="large"`):
  - Icon: 6rem (96px)
  - Title: 2rem
  - Padding: 3rem
  - Gap: 1.5rem
  - Use case: Full-page empty states, prominent messaging

**Styling Integration**:

- **Icon Color**: Uses `--color-dimmed` for subtle, non-intrusive appearance
- **Title Color**: Uses `--mat-sys-on-surface` for proper contrast in all themes
- **Message Color**: Uses `--mat-sys-on-surface` for readable secondary content
- **Secondary Message**: Uses `--color-dimmed` with support for `<strong>` tags that use `--mat-sys-on-surface`
- **Layout**: Flexbox centered layout that fills parent container (100% height/width)
- **Responsive**: Text and spacing scale appropriately with size variants

**Accessibility Features**:

- Semantic HTML structure with proper heading hierarchy (`<h2>` for title)
- High contrast color scheme compatible with accessibility standards
- Icon uses Material Design icons with proper ARIA support
- Text content is screen reader friendly
- No interactive elements to maintain focus management simplicity

**Best Practice**:

- Use for all empty state scenarios to maintain consistent UX patterns
- Choose size based on container: small for panels, medium for content areas, large for full pages
- Provide meaningful, actionable messages that guide users on what to do next
- Use `secondaryMessage` for additional context or navigation hints with `<strong>` for emphasis
- Always include both icon and title (required) for clear communication

**Common Use Cases**:

- No connected devices
- Empty search results
- Empty file/folder listings
- No data in tables/lists
- Missing configurations
- Disconnected states
- No items in cart/playlist
- Uninitialized views

**Used In**:

- [`player-view.component.html`](../libs/features/player/src/lib/player-view/player-view.component.html) - No connected devices state

**See Also**: Loading spinners for async operations, error dialogs for failures

---

## Form Components

### `InputFieldComponent`

**Purpose**: A lightweight, versatile input field component with built-in search icon, optional clear button, and tooltip support. Implements `ControlValueAccessor` for seamless form integration.

**Selector**: `lib-input-field`

**Properties**:

- `placeholder` (required): `string` - Placeholder text displayed in the input field
- `tooltip` (optional): `TooltipConfig | undefined` - Tooltip configuration for the input wrapper (shows on hover over entire input area)
- `clearTooltip` (optional): `TooltipConfig | undefined` - Tooltip configuration for the clear button (shows when hovering clear button)
- `inputType` (optional): `string` - HTML input type (text, search, email, number, password, etc.) - defaults to `'text'`
- `disabled` (optional): `boolean` - Whether the input is disabled - defaults to `false`
- `clearable` (optional): `boolean` - Whether to show clear button when input has value - defaults to `false`

**Events**:

- `valueChange`: Emitted on every keystroke with current input value
- `inputFocus`: Emitted when input receives focus
- `inputBlur`: Emitted when input loses focus
- `cleared`: Emitted when clear button is clicked

**Visual Behavior**:

- **Search Icon**: Displays `search` icon on left when input is empty
- **Clear Button**: Displays `close` icon button on right when `clearable` is `true` and input has value
- **Tooltips**: Supports separate tooltips for input area and clear button

**Usage Examples**:

```html
<!-- Basic search input -->
<lib-input-field placeholder="Search files..." [clearable]="true"> </lib-input-field>

<!-- Search with input tooltip -->
<lib-input-field
  placeholder="Search"
  [clearable]="true"
  [tooltip]="{ body: 'Enter search terms', position: TooltipPosition.Top }"
>
</lib-input-field>

<!-- Search with both tooltips -->
<lib-input-field
  placeholder="Search"
  [clearable]="true"
  [tooltip]="searchHintTooltip"
  [clearTooltip]="{ body: 'Clear search', position: TooltipPosition.Top }"
  (valueChange)="onSearch($event)"
  (cleared)="onClearSearch()"
>
</lib-input-field>

<!-- Email input -->
<lib-input-field placeholder="Enter email" inputType="email"> </lib-input-field>

<!-- Password input -->
<lib-input-field placeholder="Password" inputType="password"> </lib-input-field>

<!-- Disabled input -->
<lib-input-field placeholder="Read-only" [disabled]="true"> </lib-input-field>
```

**Component Integration Example**:

```typescript
import { Component } from '@angular/core';
import { InputFieldComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';

@Component({
  selector: 'app-search',
  imports: [InputFieldComponent],
  template: `
    <lib-input-field
      placeholder="Search"
      [clearable]="true"
      [tooltip]="searchTooltip"
      [clearTooltip]="clearTooltip"
      (valueChange)="onSearchChange($event)"
      (cleared)="onClearSearch()"
    >
    </lib-input-field>
  `,
})
export class SearchComponent {
  readonly searchTooltip: TooltipConfig = {
    title: 'Search Files',
    body: 'Enter search terms. Use + for required, - to exclude.',
    position: TooltipPosition.Top,
  };

  readonly clearTooltip: TooltipConfig = {
    body: 'Clear search',
    position: TooltipPosition.Top,
  };

  onSearchChange(searchText: string): void {
    console.log('Search:', searchText);
  }

  onClearSearch(): void {
    console.log('Search cleared');
  }
}
```

**Form Integration**:

Implements `ControlValueAccessor` for full reactive forms support:

```typescript
import { FormControl } from '@angular/forms';

export class MyFormComponent {
  searchControl = new FormControl('');

  ngOnInit() {
    // Reactive forms integration
    this.searchControl.valueChanges.subscribe(value => {
      console.log('Form value:', value);
    });
  }
}
```

```html
<!-- Reactive forms usage -->
<lib-input-field
  placeholder="Search"
  [clearable]="true"
  [formControl]="searchControl"
>
</lib-input-field>
```

**Accessibility Features**:

- Proper `aria-label` attributes on input and clear button
- Keyboard navigation support (Tab, Enter)
- Clear button has `aria-label="Clear search"` for screen readers
- Focus management for optimal accessibility

**Best Practice**: Use for search inputs, filters, and simple text fields. For complex form layouts with labels and validation messages, consider using Material form fields directly.

**Used In**:

- [`search-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/search-toolbar/search-toolbar.component.html) - File and folder search functionality

---

## Link Components

### `LinkComponent`

**Purpose**: A pure presentation component for displaying links with icon + label rendering. Serves as a reusable base for link-based components. Composes `IconLabelComponent` for consistent icon and text display.

**Selector**: `lib-link`

**Properties**:

- `label` (required): `string` - Link text displayed to the user
- `icon` (optional): `string` - Material Design icon name to display next to label - defaults to 'link'
- `iconColor` (optional): `StyledIconColor` - Icon color variant (`'primary'`, `'error'`, `'normal'`, etc.) - defaults to 'primary'

**Usage Examples**:

```html
<!-- Basic link component (used internally by other link types) -->
<lib-link label="Learn More" icon="help"></lib-link>

<!-- With error color -->
<lib-link label="Delete" icon="delete" iconColor="error"></lib-link>

<!-- With custom icon -->
<lib-link label="External" icon="open_in_new" iconColor="highlight"></lib-link>
```

**Design Purpose**: `LinkComponent` is a presentational-only component designed to be composed into higher-level link components (`ExternalLinkComponent`, `ActionLinkComponent`) rather than used directly. It provides reusable icon + label rendering logic, reducing duplication.

**Best Practice**: Use `ExternalLinkComponent` for navigation links and `ActionLinkComponent` for button-style action triggers. `LinkComponent` is primarily for internal composition.

**Composition Pattern**: This component exemplifies the composition pattern used throughout the TeensyROM UI library:

- Base presentation component handles display logic
- Wrapper components add specific behaviors (navigation, event emission, etc.)
- Reduces code duplication while maintaining single responsibility principle

**See Also**: [ActionLinkComponent](#actionlinkcomponent), [ExternalLinkComponent](#externallinkcomponent)

### `ActionLinkComponent`

**Purpose**: A button-based link component for triggering actions or opening modals. Semantically uses `<button>` instead of `<a>` for non-navigational interactions. Provides event emission for action handling and keyboard accessibility (Enter/Space keys). Composes `LinkComponent` for consistent icon and label styling.

**Selector**: `lib-action-link`

**Properties**:

- `label` (required): `string` - Button text displayed to the user
- `icon` (optional): `string` - Material Design icon name to display next to label - defaults to 'link'
- `iconColor` (optional): `StyledIconColor` - Icon color variant (`'primary'`, `'error'`, `'normal'`, etc.) - defaults to 'primary'
- `disabled` (optional): `boolean` - Whether the button is disabled - defaults to false

**Events**:

- `linkClick`: Emitted when the button is clicked (only when not disabled)

**Usage Examples**:

```html
<!-- Basic action link -->
<lib-action-link label="Open Video" (linkClick)="openVideo()"></lib-action-link>

<!-- YouTube video link in file metadata -->
<lib-action-link
  label="Watch Tutorial"
  icon="play_circle"
  iconColor="primary"
  (linkClick)="openYouTubeDialog(video)"
>
</lib-action-link>

<!-- Disabled state -->
<lib-action-link
  label="Delete"
  icon="delete"
  iconColor="error"
  [disabled]="!canDelete"
  (linkClick)="deleteItem()"
>
</lib-action-link>

<!-- With custom icon color -->
<lib-action-link label="Archive" icon="archive" iconColor="highlight" (linkClick)="archiveItem()">
</lib-action-link>
```

**Advanced Usage Patterns**:

```typescript
// In component - opening modal on action-link click
export class FileOtherComponent {
  private readonly dialog = inject(MatDialog);

  openYouTubeDialog(video: YouTubeVideo): void {
    this.dialog.open(YouTubeDialogComponent, {
      data: { video },
      width: '800px',
      maxWidth: '90vw',
    });
  }
}
```

```html
<!-- In template -->
@for (video of youtubeVideos(); track video.videoId) {
<lib-action-link [label]="video.channel" icon="play_circle" (linkClick)="openYouTubeDialog(video)">
</lib-action-link>
}
```

**Semantic Difference from ExternalLinkComponent**:

- **ActionLinkComponent**: Uses `<button>` - for actions, events, modal triggers
- **ExternalLinkComponent**: Uses `<a>` - for navigation to URLs

**Keyboard Accessibility**:

- **Enter Key**: Activates button (standard `<button>` behavior)
- **Space Key**: Activates button (standard `<button>` behavior)
- **Disabled State**: Cannot be focused when disabled (set via `tabindex="-1"`)

**Styling Integration**:

- Uses `.selectable-item` mixin from style guide for consistent hover/active states
- Inherits `iconColor` styling from composed `LinkComponent`
- Semantic `<button>` styling for proper focus/active states

**Best Practice**: Use whenever you need a link-style UI that triggers an action or opens a modal/dialog. Always prefer semantic `<button>` over `<a>` for non-navigational interactions to maintain proper HTML semantics and accessibility.

**Used In**:

- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - YouTube video triggers that open dialog

**See Also**: [LinkComponent](#linkcomponent), [ExternalLinkComponent](#externallinkcomponent)

### `ExternalLinkComponent`

**Purpose**: A reusable external link component that displays links with consistent styling, security attributes, and icon+label rendering. Automatically applies security attributes (`rel="noopener noreferrer"`) to external links opening in new tabs. Provides full keyboard and screen reader accessibility.

**Selector**: `lib-external-link`

**Properties**:

- `href` (required): `string` - URL to navigate to (can be absolute or relative)
- `label` (required): `string` - Link text displayed to the user
- `icon` (optional): `string` - Material Design icon name to display next to label - defaults to 'link'
- `iconColor` (optional): `StyledIconColor` - Icon color variant (`'primary'`, `'error'`, `'normal'`, etc.) - defaults to 'primary'
- `target` (optional): `'_blank' | '_self'` - Link target behavior (new window vs current) - defaults to '\_blank'
- `ariaLabel` (optional): `string` - Custom accessibility label for screen readers. Auto-generated if not provided with "(opens in new window)" suffix for external \_blank links

**Computed Signals** (Internal):

- `isExternal()`: Detects if URL starts with http:// or https://
- `relAttribute()`: Returns 'noopener noreferrer' for external \_blank links, undefined otherwise
- `effectiveTarget()`: Returns the target value
- `ariaLabelText()`: Returns descriptive aria-label for accessibility

**Usage Examples**:

```html
<!-- Basic external link with defaults -->
<lib-external-link href="https://example.com" label="Visit Example"> </lib-external-link>

<!-- Internal link (same tab) -->
<lib-external-link href="/documentation" label="Read Docs" target="_self" icon="description">
</lib-external-link>

<!-- YouTube link with custom icon and error color -->
<lib-external-link
  href="https://youtube.com/watch?v=xyz"
  label="Watch Tutorial"
  icon="play_circle"
  iconColor="error"
>
</lib-external-link>

<!-- CSDb link with custom aria-label -->
<lib-external-link
  href="https://csdb.dk/entry.php?id=123"
  label="CSDb Entry"
  ariaLabel="View this entry on CSDb database"
>
</lib-external-link>

<!-- In a file metadata context -->
<div class="metadata-links">
  <lib-external-link [href]="file.deepSidUrl" label="DeepSID" icon="music_note">
  </lib-external-link>
</div>
```

**Advanced Usage Patterns**:

```typescript
// In a component displaying file metadata
export class FileMetadataComponent {
  file = input.required<FileItem>();

  deepSidLinks = computed(() => {
    return this.file().deepSidLinks.map((link) => ({
      url: link.url,
      name: link.name,
    }));
  });
}
```

```html
<!-- Rendering multiple links -->
@for (link of deepSidLinks(); track link.url) {
<lib-external-link [href]="link.url" [label]="link.name"> </lib-external-link>
}
```

**Security Features**:

- **Automatic Security Attributes**: For external links (`https://` or `http://`) with `target="_blank"`, automatically applies `rel="noopener noreferrer"` to prevent:
  - Opener tab access via `window.opener`
  - Referrer information leakage
  - Backwards navigation attacks
- **Internal Links**: Internal links (relative URLs) do not receive security attributes
- **Same-Tab Links**: External links with `target="_self"` do not receive security attributes

**Accessibility Features**:

- **Native Anchor Element**: Uses semantic `<a>` tag for proper link semantics
- **Keyboard Accessible**: Full keyboard navigation support (Tab key focus, Enter key activation)
- **Screen Reader Support**:
  - Auto-generated aria-label with "(opens in new window)" suffix for external \_blank links
  - Custom ariaLabel input for overriding auto-generated labels
  - Title attribute for browser tooltips
- **Semantic HTML**: Proper role and ARIA attributes via native anchor element
- **Visual State Support**: Color styling works for all link states (`:visited`, `:hover`, `:active`, `:focus`)

**Styling Integration**:

- **Link Text Color**: Uses `--mat-sys-primary` (magenta in dark mode, adjusts per theme)
- **Hover/Focus States**: Color maintained across all states for consistency
- **Icon Color**: Inherits from `iconColor` input, maps to semantic color system
- **Selectable Item Pattern**: Uses `.selectable-item` mixin for consistent interaction feedback

**Template Composition**:

The component composes two child elements:

- `<a>` - Semantic anchor element with href, target, rel, aria-label, and title bindings
- `<lib-icon-label>` - Displays icon and label side-by-side

**Best Practice**:

- Use for all external links (documentation, resources, videos, etc.) to maintain consistent security and styling
- Use `target="_blank"` for external URLs to prevent navigation away from the app
- Use `target="_self"` for internal navigation links
- Provide custom `ariaLabel` for clarity when auto-generated label isn't sufficiently descriptive
- Choose appropriate `iconColor` to communicate link intent (error for destructive, success for positive actions, etc.)
- Combine with `iconColor="error"` for YouTube/video links to indicate destructive/external content

**Used In**:

- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - DeepSID and YouTube external links

---

## Modal Components

### `YouTubeDialogComponent`

**Purpose**: A Material Dialog component for displaying embedded YouTube videos within the TeensyROM player. Uses `ScalingCardComponent` with smooth animations (from-top entry, from-bottom exit) to provide an elegant modal experience for watching YouTube content linked to file metadata. Properly sanitizes YouTube embed URLs and handles responsive sizing.

**Selector**: `lib-youtube-dialog`

**Properties** (Provided via MatDialog data):

- `data.video` (required): `YouTubeVideo` - Video object containing:
  - `videoId` (required): `string` - YouTube video ID (e.g., 'dQw4w9WgXcQ')
  - `url` (optional): `string` - Full YouTube URL
  - `channel` (required): `string` - Channel name displayed as dialog title
  - `subtune` (optional): `number` - Associated subtune index

**Dialog Configuration**:

When opening the dialog via `MatDialog.open()`, provide these configuration options:

```typescript
{
  data: { video: YouTubeVideo },
  width: '800px',           // Default width
  maxWidth: '90vw',         // Max width on small screens
  panelClass: 'youtube-dialog'
}
```

**Usage Example**:

```typescript
// In component
export class FileOtherComponent {
  private readonly dialog = inject(MatDialog);

  openYouTubeDialog(video: YouTubeVideo): void {
    this.dialog.open(YouTubeDialogComponent, {
      data: { video },
      width: '800px',
      maxWidth: '90vw',
      panelClass: 'youtube-dialog',
    });
  }
}
```

```html
<!-- In template - triggered via ActionLinkComponent -->
@for (video of youtubeVideos(); track video.videoId) {
<lib-action-link [label]="video.channel" icon="play_circle" (linkClick)="openYouTubeDialog(video)">
</lib-action-link>
}
```

**Component Template Structure**:

The component uses a `ScalingCardComponent` with:

- **Title**: Video channel name (from `data.video.channel`)
- **Content**: Responsive iframe container with 16:9 aspect ratio
- **Actions**: Close button via `lib-icon-button` in corner slot
- **Animations**: Entry from top (`animationEntry="from-top"`), exit from bottom (`animationExit="from-bottom"`)

**Responsive Sizing**:

- **Desktop** (800px): Full YouTube embed with smooth animations
- **Tablet/Mobile** (90vw max): Scales to viewport width with proper padding
- **Aspect Ratio**: Maintains 16:9 ratio using CSS padding-bottom technique

**Security**:

- **URL Sanitization**: Uses `DomSanitizer.bypassSecurityTrustResourceUrl()` to safely render YouTube embed URLs
- **iframe Attributes**:
  - `allow="autoplay"` - Permits video autoplay in iframe
  - `referrerpolicy="strict-origin-when-cross-origin"` - Controls referrer information
  - `allowfullscreen=""` - Enables full-screen mode

**Animation Details**:

- **Entry Animation**: Scales in from top with 400ms duration, creating smooth appearance
- **Exit Animation**: Slides down with 300ms duration for smooth dismissal
- **Animation Framework**: Uses `ScalingCardComponent` with built-in animation system (see [Animation System](#animation-system))
- **Testing**: Uses `provideNoopAnimations()` to disable animations in test environment

**Accessibility Features**:

- **Semantic HTML**: Proper iframe with accessibility attributes
- **Keyboard Navigation**: Close button is keyboard accessible (Enter/Space)
- **ARIA Labels**: Icon buttons include proper aria-labels
- **Screen Reader Support**: Dialog properly announces via Angular Material

**Best Practice**:

- Open via `ActionLinkComponent` click handlers - maintains semantic button/link distinction
- Always provide both `videoId` and `channel` in video data object
- Use consistent `width` and `maxWidth` settings across the application for uniform modal sizing
- Leverage Material Dialog's modal backdrop for focus management - only the dialog receives keyboard focus

**Used In**:

- [`file-other.component.html`](../libs/features/player/src/lib/player-view/player-device-container/file-other/file-other.component.html) - Opens when clicking YouTube video links in file metadata

**See Also**: [ActionLinkComponent](#actionlinkcomponent), [ScalingCardComponent](#scalingcardcomponent), [IconButtonComponent](#iconbuttoncomponent)

---

## Menu Components

### `DropdownMenuComponent`

**Purpose**: Custom dropdown menu using CDK Overlay. Provides smooth animations and avoids Material's mat-menu flicker issues by explicitly managing overlay lifecycle.

**Architecture**: Internally composes `lib-dropdown-dialog` for positioning (71% code reduction, 100% API compatible).

**Selector**: `lib-dropdown-menu`

**Properties**:
- `isOpen`: `Signal<boolean>` - Read-only signal for current open/closed state

**Methods**:
- `toggle()`: Toggle dropdown open/closed
- `open()`: Open dropdown
- `close()`: Close dropdown

**Events**:
- `opened`: Emitted when dropdown opens
- `closed`: Emitted when dropdown closes

**Usage Examples**:

```html
<!-- Basic dropdown with toggle -->
<lib-dropdown-menu #dropdown>
  <lib-icon-button
    icon="more_vert"
    ariaLabel="Options"
    (buttonClick)="dropdown.toggle()"
  >
  </lib-icon-button>

  <div dropdown-content>
    <lib-dropdown-menu-item [selected]="false" (itemClick)="onOption1()">
      Option 1
    </lib-dropdown-menu-item>
    <lib-dropdown-menu-item [selected]="true" (itemClick)="onOption2()">
      Option 2
    </lib-dropdown-menu-item>
  </div>
</lib-dropdown-menu>

<!-- With timer menu example -->
<lib-dropdown-menu #timerDropdown>
  <lib-icon-button
    icon="timer"
    ariaLabel="Custom Play Timer"
    [matBadge]="timerBadgeText()"
    (buttonClick)="timerDropdown.toggle()"
  >
  </lib-icon-button>

  <div dropdown-content>
    <lib-dropdown-menu-item 
      [selected]="!isTimerEnabled()"
      (itemClick)="disableTimer()"
    >
      Off
    </lib-dropdown-menu-item>

    @for (option of durationOptions; track option.value) {
      <lib-dropdown-menu-item
        [selected]="isTimerEnabled() && selectedDuration() === option.value"
        (itemClick)="setDuration(option.value)"
      >
        {{ option.label }}
      </lib-dropdown-menu-item>
    }
  </div>
</lib-dropdown-menu>
```

**Advanced Usage with Programmatic Control**:

```typescript
export class ToolbarComponent {
  dropdown = viewChild<DropdownMenuComponent>('dropdown');

  openMenu() {
    this.dropdown()?.open();
  }

  closeMenu() {
    this.dropdown()?.close();
  }

  onMenuItemClick(action: string) {
    // Perform action
    console.log('Action:', action);
    
    // Explicitly close dropdown after action
    this.dropdown()?.close();
  }
}
```

**Animation Behavior**:

- **Entry**: 150ms fade-in with scale (0.95 → 1.0) and opacity (0 → 1)
- **Exit**: 100ms fade-out with scale (1.0 → 0.95) and opacity (1 → 0)
- **Easing**: Smooth cubic-bezier transitions
- **No Flicker**: Explicitly managed lifecycle prevents browser repaint issues

**Positioning**:

Uses Angular CDK's flexible positioning with fallback options:

1. **Primary**: Below trigger element, aligned to start (left edge)
   - `originY: 'bottom'`, `overlayY: 'top'`, `offsetY: 8px`
2. **Fallback**: Above trigger element if insufficient space below
   - `originY: 'top'`, `overlayY: 'bottom'`, `offsetY: -8px`

**Backdrop Behavior**:

- **Transparent Backdrop**: Invisible backdrop that closes menu on outside click
- **Click-to-Close**: Clicking outside menu automatically closes it
- **No Visual Overlay**: Unlike dialogs, dropdown doesn't dim background

**Styling Integration**:

- **Glassy Effect**: Uses `CompactCardLayoutComponent` with `glassy-card` class
- **Theme Integration**: Automatically adapts to light/dark theme
- **Shadow**: Material Design elevation shadow (0 8px 24px rgba(0, 0, 0, 0.3))
- **Sizing**: Min-width 120px, max-width 280px with automatic content sizing

**Content Projection**:

Uses two content projection slots:

1. **Default slot**: Trigger element (button, icon, etc.)
2. **`[dropdown-content]` slot**: Menu items wrapped in a div with this attribute

**Best Practices**:
- Use `#templateRef` to access component reference for method calls
- Wrap menu items in `<div dropdown-content>`
- Call `dropdown.close()` after handling item clicks
- Use `lib-dropdown-menu-item` for consistent styling

**Used In**: `player-toolbar-actions.component.html` - Custom play timer menu

**See Also**: [DropdownMenuItemComponent](#dropdownmenuitemcomponent), [DropdownDialogComponent](#dropdowndialogcomponent), [Composition Pattern](#composition-pattern-dropdown-menu--dropdown-dialog)

---

## Composition Patterns

### Composition Pattern: Dropdown Menu + Dropdown Dialog

**What**: Dropdown menu delegates overlay positioning to dropdown dialog internally, eliminating code duplication while maintaining 100% API compatibility.

**Why It Works**:
- Clear separation: Dialog owns positioning/overlay, Menu owns content/styling
- Zero breaking changes: All public APIs identical
- Single source of truth: Future overlay components reuse same positioning logic
- Code reduction: 142 duplicate lines eliminated (71%)

**Pattern Structure**:
```
DropdownMenuComponent
  └─ DropdownDialogComponent (internal composition)
       ├─ Overlay creation & lifecycle
       ├─ Positioning strategy
       ├─ Backdrop management
       └─ Fullscreen support
```

**Implementation Approach**:
```typescript
// Menu delegates to internal dialog
private dialogRef = viewChild.required<DropdownDialogComponent>('dialogRef');

open(): void { this.dialogRef().open(); }
close(): void { this.dialogRef().close(); }
isOpen = computed(() => this.dialogRef().isOpen());
```

**When to Use This Pattern**:
- Multiple components need same complex infrastructure
- Clear delegation boundaries exist
- Can maintain identical public API
- Infrastructure is stable and reusable

**See Also**: [DropdownMenuComponent](#dropdownmenucomponent), [DropdownDialogComponent](#dropdowndialogcomponent)

---

### `DropdownDialogComponent`

**Purpose**: Pure positioning container for dialogs and overlays using CDK. No styling opinions—projects any content via `ng-content`.

**Selector**: `lib-dropdown-dialog`

**Properties**:
- `isOpen`: `Signal<boolean>` - Current open/closed state

**Methods**:
- `open()`: Open overlay with positioning
- `close()`: Close and dispose overlay

**Events**:
- `opened`: Emitted when dialog opens
- `closed`: Emitted when dialog closes

**Usage Examples**:

```html
<!-- Basic dialog with any content -->
<lib-dropdown-dialog #dialog>
  <button (click)="dialog.open()">Open Dialog</button>
  
  <div dialog-content>
    <lib-preset-name-dialog
      title="Save Preset"
      [initialValue]="''"
      (save)="onSave($event); dialog.close()"
      (cancel)="dialog.close()"
    >
    </lib-preset-name-dialog>
  </div>
</lib-dropdown-dialog>

<!-- With confirmation dialog -->
<lib-dropdown-dialog #confirmDialog>
  <button (click)="confirmDialog.open()">Delete Item</button>
  
  <div dialog-content>
    <lib-confirmation-dialog
      title="Confirm Delete"
      message="Are you sure you want to delete this item?"
      (confirm)="onDelete(); confirmDialog.close()"
      (cancel)="confirmDialog.close()"
    >
    </lib-confirmation-dialog>
  </div>
</lib-dropdown-dialog>

<!-- Programmatic control -->
<lib-dropdown-dialog #saveDialog>
  <lib-icon-button
    icon="save"
    ariaLabel="Save"
    (buttonClick)="saveDialog.open()"
  >
  </lib-icon-button>
  
  <div dialog-content>
    <!-- Any dialog component or custom content -->
  </div>
</lib-dropdown-dialog>
```

**Advanced Usage with Programmatic Control**:

```typescript
export class SettingsComponent {
  dialog = viewChild<DropdownDialogComponent>('saveDialog');
  
  openDialog() {
    this.dialog()?.open();
  }
  
  closeDialog() {
    this.dialog()?.close();
  }
  
  handleSave(name: string) {
    // Perform save operation
    console.log('Saving:', name);
    
    // Explicitly close dialog
    this.dialog()?.close();
  }
}
```

**Animation Behavior**:

- **Entry**: 150ms fade-in with scale (0.95 → 1.0) and opacity (0 → 1)
- **Exit**: 100ms fade-out with scale (1.0 → 0.95) and opacity (1 → 0)
- **Easing**: Smooth cubic-bezier transitions matching dropdown menu
- **No Styling**: Container only handles positioning - projected content controls appearance

**Positioning**:

Uses Angular CDK's flexible positioning with fallback options (same as dropdown menu):

1. **Primary**: Below trigger element, aligned to start (left edge)
   - `originY: 'bottom'`, `overlayY: 'top'`, `offsetY: 8px`
2. **Secondary**: Below trigger element, aligned to end (right edge)
3. **Tertiary**: Above trigger element, aligned to start
4. **Quaternary**: Above trigger element, aligned to end

**Fullscreen Support**:

Automatically detects and handles fullscreen mode:
- Attaches overlay to fullscreen container when active
- Calculates position relative to fullscreen bounds
- Restores overlay to body when exiting fullscreen
- Prevents position miscalculation in fullscreen contexts

**Backdrop Behavior**:

- **Transparent Backdrop**: Invisible backdrop that closes dialog on outside click
- **Click-to-Close**: Clicking outside dialog automatically closes it
- **No Visual Overlay**: Unlike Material dialogs, doesn't dim background

**Content Projection**:

Uses two content projection slots:

1. **Default slot**: Trigger element (button, icon, link, etc.)
2. **`[dialog-content]` slot**: Dialog content wrapped in a div with this attribute

**Composability**:

Designed to wrap existing dialog components without modification:
- Works with `lib-preset-name-dialog` for text input dialogs
- Works with `lib-confirmation-dialog` for yes/no confirmations
- Works with any custom content (forms, cards, panels)
- Projected content maintains its own styling and behavior

**Design Philosophy**:

This is a **pure positioning container** with zero styling opinions:
- Only handles overlay lifecycle and positioning
- No card layouts, borders, shadows, or colors
- Projected content controls all visual aspects
- Enables consistent positioning behavior across all dialog types

**Best Practices**:

- Always use `#templateRef` to get component reference for open/close methods
- Wrap dialog content in a `<div dialog-content>` element
- Call `dialog.close()` explicitly in event handlers (save, cancel, confirm)
- Project existing dialog components rather than creating new ones
- Use for positioned dialogs that need to appear near trigger elements

**Comparison**:

- **DropdownDialogComponent**: Positioned near trigger, transparent backdrop, for dialogs/forms
- **DropdownMenuComponent**: Positioned near trigger, transparent backdrop, for menus/lists
- **Material Dialog**: Centered on screen, dimmed backdrop, for modal dialogs

**Use Cases**:

- Preset save/rename dialogs in settings panels
- Confirmation dialogs for delete actions
- Form inputs that appear near trigger buttons
- Context-sensitive dialogs that need to position near specific elements
- Any overlay content that should close on outside click

**Used In**:

- `libs/ui/components/src/lib/crt-settings-panel/` - CRT preset management (planned)

**See Also**: [DropdownMenuComponent](#dropdownmenucomponent), [PresetNameDialogComponent](#presetnamedialogcomponent), [ConfirmationDialogComponent](#confirmationdialogcomponent)

---

### `DropdownMenuItemComponent`

**Purpose**: Menu item component for use with `lib-dropdown-menu`. Provides consistent styling, selection state indicators, and click handling for dropdown menu items. Displays a check icon when selected and emits events on click.

**Selector**: `lib-dropdown-menu-item`

**Properties**:

- `selected`: `boolean` - Whether this item is currently selected (shows check icon) - defaults to `false`
- `testId`: `string` - Data-testid attribute for testing - defaults to empty string

**Events**:

- `itemClick`: Emitted when menu item is clicked

**Usage Examples**:

```html
<!-- Basic menu item -->
<lib-dropdown-menu-item (itemClick)="handleClick()">
  Action
</lib-dropdown-menu-item>

<!-- Selected item with check icon -->
<lib-dropdown-menu-item [selected]="true" (itemClick)="handleClick()">
  Current Selection
</lib-dropdown-menu-item>

<!-- With test ID for e2e testing -->
<lib-dropdown-menu-item 
  [testId]="'menu-delete'"
  (itemClick)="deleteItem()"
>
  Delete
</lib-dropdown-menu-item>

<!-- Dynamic selection state -->
<lib-dropdown-menu-item
  [selected]="currentValue() === option.value"
  (itemClick)="selectOption(option)"
>
  {{ option.label }}
</lib-dropdown-menu-item>
```

**Advanced Usage in Loop**:

```typescript
export class MenuComponent {
  options = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' }
  ];

  selectedSize = signal<string>('medium');

  selectSize(size: string) {
    this.selectedSize.set(size);
    // Dropdown will close automatically after click
  }
}
```

```html
<lib-dropdown-menu #sizeMenu>
  <lib-icon-button icon="format_size" (buttonClick)="sizeMenu.toggle()">
  </lib-icon-button>

  <div dropdown-content>
    @for (option of options; track option.value) {
      <lib-dropdown-menu-item
        [selected]="selectedSize() === option.value"
        [testId]="'size-' + option.value"
        (itemClick)="selectSize(option.value)"
      >
        {{ option.label }}
      </lib-dropdown-menu-item>
    }
  </div>
</lib-dropdown-menu>
```

**Visual States**:

- **Normal**: Default appearance with hover effect (10% white overlay)
- **Hover**: Light background (10% white overlay) on mouse over
- **Active**: Slightly darker background (15% white overlay) on click
- **Selected**: Subtle background (8% white overlay) with check icon

**Check Icon**:

- **Color**: Uses `--color-highlight` (cyan/magenta based on theme)
- **Size**: 18px × 18px Material icon
- **Position**: Left side of menu item before label text
- **Visibility**: Only shown when `[selected]="true"`

**Styling Integration**:

- **Font**: Roboto sans-serif, 0.875rem (14px)
- **Spacing**: 12px vertical padding, 16px horizontal padding, 12px gap between icon and text
- **Colors**: Uses `--mat-sys-on-surface` for text, theme-aware colors
- **Transitions**: Smooth 0.2s ease background color transitions
- **Layout**: Flexbox with full-width button, left-aligned text

**Accessibility Features**:

- **Semantic Button**: Uses native `<button>` element for proper semantics
- **Keyboard Support**: Full keyboard navigation (Enter/Space to activate)
- **Type Safety**: `type="button"` prevents form submission
- **Test Integration**: `data-testid` attribute for e2e testing

**Best Practice**:

- Always use inside `lib-dropdown-menu` with `dropdown-content` wrapper
- Set `[selected]="true"` for currently active option to show check icon
- Provide `testId` for menu items used in e2e tests
- Keep menu item labels concise (1-3 words) for optimal layout
- Emit events and let parent component handle logic + dropdown closing

**Used In**:

- `player-toolbar-actions.component.html` - Timer duration options menu

**See Also**: [DropdownMenuComponent](#dropdownmenucomponent), [IconButtonComponent](#iconbuttoncomponent)

---

## List Components

### `StorageItemComponent`

**Purpose**: A reusable list item component for displaying storage entries (files, folders, etc.) with icon, label, selection state, and optional action buttons. Provides full keyboard navigation and accessibility support.

**Selector**: `lib-storage-item`

**Properties**:

- `icon` (required): `string` - Material Design icon name to display
- `iconColor` (optional): `StyledIconColor` - Icon color variant (`'normal'`, `'directory'`, `'primary'`, etc.) - defaults to `'normal'`
- `label` (required): `string` - Primary text label displayed next to the icon
- `selected` (optional): `boolean` - Whether the item is currently selected - defaults to `false`
- `active` (optional): `boolean` - Whether the item is currently active/focused/highlighted - defaults to `false`
- `disabled` (optional): `boolean` - Whether the item is disabled - defaults to `false`

**Events**:

- `activated`: Emitted on double-click or Enter key press (primary action)
- `selectedChange`: Emitted on single click or Space key press (selection toggle)

**Usage Examples**:

```html
<!-- Basic file item -->
<lib-storage-item icon="insert_drive_file" label="readme.txt"> </lib-storage-item>

<!-- Folder with directory color -->
<lib-storage-item
  icon="folder"
  iconColor="directory"
  label="Documents"
  (activated)="openFolder()"
  (selectedChange)="toggleSelection()"
>
</lib-storage-item>

<!-- Selected item with actions -->
<lib-storage-item
  icon="music_note"
  iconColor="primary"
  label="Song.sid"
  [selected]="isSelected()"
  (activated)="playSong()"
  (selectedChange)="toggleSelection()"
>
  <lib-storage-item-actions label="1.5 KB">
    <lib-icon-button icon="play_arrow" ariaLabel="Play" (buttonClick)="play()"></lib-icon-button>
    <lib-icon-button
      icon="download"
      ariaLabel="Download"
      (buttonClick)="download()"
    ></lib-icon-button>
  </lib-storage-item-actions>
</lib-storage-item>

<!-- Disabled item -->
<lib-storage-item icon="lock" label="Protected.dat" [disabled]="true"> </lib-storage-item>

<!-- Active/focused item in list -->
<lib-storage-item
  icon="image"
  label="screenshot.png"
  [active]="currentIndex() === 0"
  [selected]="selectedIds().includes('img1')"
>
</lib-storage-item>
```

**Advanced Usage with Selection Management**:

```typescript
export class FileListComponent {
  selectedIds = signal<string[]>([]);
  activeIndex = signal<number>(0);

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSelection(id: string): void {
    const current = this.selectedIds();
    if (current.includes(id)) {
      this.selectedIds.set(current.filter((x) => x !== id));
    } else {
      this.selectedIds.set([...current, id]);
    }
  }

  openItem(item: FileItem): void {
    // Handle double-click/Enter activation
    console.log('Opening:', item.name);
  }
}
```

```html
@for (item of files(); track item.id) {
<lib-storage-item
  [icon]="item.icon"
  [iconColor]="item.type === 'folder' ? 'directory' : 'normal'"
  [label]="item.name"
  [selected]="isSelected(item.id)"
  [active]="$index === activeIndex()"
  (selectedChange)="toggleSelection(item.id)"
  (activated)="openItem(item)"
>
  @if (item.size) {
  <lib-storage-item-actions [label]="item.size">
    <lib-icon-button
      icon="more_vert"
      ariaLabel="More options"
      (buttonClick)="showOptions(item)"
    ></lib-icon-button>
  </lib-storage-item-actions>
  }
</lib-storage-item>
}
```

**Keyboard Navigation**:

- **Enter**: Triggers `activated` event (primary action like opening file/folder)
- **Space**: Triggers `selectedChange` event (selection toggle)
- **Tab**: Moves focus between items (automatic via `tabindex`)
- **Disabled State**: Sets `tabindex="-1"` to exclude from tab order

**Accessibility Features**:

- **ARIA Role**: Automatically sets `role="button"` for proper semantics
- **ARIA Selected**: Exposes `aria-selected` state for screen readers
- **ARIA Disabled**: Exposes `aria-disabled` when item is disabled
- **Keyboard Support**: Full keyboard navigation with Enter/Space handling
- **Focus Management**: Proper `tabindex` handling for focus control
- **Visual States**: Clear visual feedback for selected, active, and disabled states

**Visual States**:

- **Normal**: Default appearance with hover effect
- **Selected**: Visual highlight indicating item is selected (`.selected` class)
- **Active**: Additional highlight for current focused/active item (`.active` class)
- **Disabled**: Dimmed appearance with no interaction (`.disabled` class)

**Styling Integration**:

Uses the `@include styles.selectable-item` mixin from the style guide, which provides:

- Consistent hover/focus/active states
- Selection highlighting
- Smooth transitions
- Proper spacing and layout

**Content Projection**:

The component uses `ng-content` to project `lib-storage-item-actions` into the right side of the item for action buttons and metadata.

**Best Practice**: Use for all list-based storage items (files, folders, carts, etc.) to maintain consistent interaction patterns and accessibility throughout the application. For animating groups of storage items, wrap the container in a [FadingContainerComponent](#fadingcontainercomponent) or other animation container rather than animating individual items.

**See Also**: [StorageItemActionsComponent](#storageitemactionscomponent), [IconLabelComponent](#iconlabelcomponent)

---

### `StorageItemActionsComponent`

**Purpose**: A directive component for projecting action buttons and metadata into the right side of a storage item. Follows the Angular Material card actions pattern (`mat-card-actions`).

**Selector**: `lib-storage-item-actions`

**Properties**:

- `label` (optional): `string` - Optional text label to display before action buttons (e.g., file size, item count)

**Usage Examples**:

```html
<!-- File size with action buttons -->
<lib-storage-item icon="music_note" label="Song.sid">
  <lib-storage-item-actions label="1.5 KB">
    <lib-icon-button icon="play_arrow" ariaLabel="Play" (buttonClick)="play()"></lib-icon-button>
    <lib-icon-button
      icon="download"
      ariaLabel="Download"
      (buttonClick)="download()"
    ></lib-icon-button>
  </lib-storage-item-actions>
</lib-storage-item>

<!-- Item count in folder -->
<lib-storage-item icon="folder" iconColor="directory" label="Games">
  <lib-storage-item-actions label="42 items">
    <lib-icon-button icon="open_in_new" ariaLabel="Open" (buttonClick)="open()"></lib-icon-button>
  </lib-storage-item-actions>
</lib-storage-item>

<!-- Just actions without label -->
<lib-storage-item icon="image" label="screenshot.png">
  <lib-storage-item-actions>
    <lib-icon-button icon="visibility" ariaLabel="View" (buttonClick)="view()"></lib-icon-button>
    <lib-icon-button
      icon="delete"
      ariaLabel="Delete"
      color="error"
      (buttonClick)="delete()"
    ></lib-icon-button>
  </lib-storage-item-actions>
</lib-storage-item>

<!-- Multiple metadata points -->
<lib-storage-item icon="insert_drive_file" label="document.pdf">
  <lib-storage-item-actions label="2.3 MB • Modified 2h ago">
    <lib-icon-button icon="edit" ariaLabel="Edit" (buttonClick)="edit()"></lib-icon-button>
    <lib-icon-button icon="share" ariaLabel="Share" (buttonClick)="share()"></lib-icon-button>
  </lib-storage-item-actions>
</lib-storage-item>
```

**Advanced Usage Patterns**:

```typescript
export class FileListItemComponent {
  file = input.required<FileItem>();

  // Computed metadata label
  metadataLabel = computed(() => {
    const file = this.file();
    const size = this.formatSize(file.size);
    const date = this.formatDate(file.modified);
    return `${size} • ${date}`;
  });

  formatSize(bytes: number): string {
    // Format bytes to KB/MB/GB
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(date: Date): string {
    // Format relative date
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }
}
```

```html
<lib-storage-item [icon]="file().icon" [label]="file().name">
  <lib-storage-item-actions [label]="metadataLabel()">
    <lib-icon-button
      icon="play_arrow"
      ariaLabel="Play"
      [disabled]="!file().canPlay"
      (buttonClick)="playFile()"
    ></lib-icon-button>
    <lib-icon-button
      icon="more_vert"
      ariaLabel="More options"
      (buttonClick)="showMenu($event)"
    ></lib-icon-button>
  </lib-storage-item-actions>
</lib-storage-item>
```

**Layout Behavior**:

- Actions are positioned at the right end of the storage item with `margin-left: auto`
- Items are displayed in a horizontal row with `0.5rem` gap
- Actions container does not wrap (uses `flex-shrink: 0`)
- Label text is styled with dimmed color and smaller font size

**Styling**:

- **Label**: Uses `--color-dimmed` with `0.875rem` font size and `nowrap`
- **Container**: Flexbox layout with center alignment and consistent spacing
- **Integration**: Seamlessly integrates with parent storage item layout

**Best Practice**:

- Use for all action buttons and metadata in storage items
- Keep the number of actions minimal (2-3 buttons max) for clean UI
- Use `label` for contextual metadata (size, date, count, etc.)
- Combine with `IconButtonComponent` for consistent button styling

**Required Parent**: Must be used as a child of `lib-storage-item` component

**See Also**: [StorageItemComponent](#storageitemcomponent), [IconButtonComponent](#iconbuttoncomponent)

---

### `IconButtonComponent`

**Purpose**: A reusable icon button component that provides consistent Material Design button styling with configurable appearance, state management, and accessibility features. Supports two different ways to display icons: Material Design icons or custom icon components via content projection.

**Selector**: `lib-icon-button`

**Properties**:

- `icon` (optional): `string` - Material Design icon name to display in the button. Use this OR ng-content for custom icons.
- `ariaLabel` (required): `string` - Accessibility label for screen readers (required for proper accessibility)
- `tooltip` (optional): `string` - Tooltip text displayed on hover using Material Design tooltip - defaults to empty string
- `color` (optional): `'normal' | 'highlight' | 'success' | 'error' | 'dimmed'` - Semantic color variant that maps to [STYLE_GUIDE.md](STYLE_GUIDE.md) color system - defaults to 'normal'
- `size` (optional): `'small' | 'medium' | 'large'` - Size variant that maps to existing style classes - defaults to 'medium'
- `variant` (optional): `'standard' | 'rounded-primary' | 'rounded-transparent'` - Style variant from [STYLE_GUIDE.md](STYLE_GUIDE.md) - defaults to 'standard'
- `disabled` (optional): `boolean` - Whether the button is disabled - defaults to false

**Events**:

- `buttonClick`: Emitted when the button is clicked (only when not disabled)

**Usage Examples**:

```html
<!-- 1. Material Design Icons (traditional approach) -->
<lib-icon-button
  icon="power_settings_new"
  ariaLabel="Power"
  [color]="connectionStatus() ? 'highlight' : 'normal'"
  size="medium"
  (buttonClick)="connectionStatus() ? onDisconnect() : onConnect()"
>
</lib-icon-button>

<!-- 2. Custom Icon Components (recommended for reusable custom icons) -->
<lib-icon-button ariaLabel="Games Filter" size="large" (buttonClick)="onGamesClick()">
  <lib-joystick-icon></lib-joystick-icon>
</lib-icon-button>

<lib-icon-button ariaLabel="Images Filter" size="large" (buttonClick)="onImagesClick()">
  <lib-image-icon></lib-image-icon>
</lib-icon-button>

<!-- Log control buttons (from device-logs component) -->
<lib-icon-button
  icon="play_arrow"
  ariaLabel="Start Logs"
  color="success"
  (buttonClick)="startLogs()"
>
</lib-icon-button>

<lib-icon-button icon="stop" ariaLabel="Stop Logs" color="error" (buttonClick)="stopLogs()">
</lib-icon-button>

<!-- Settings button with rounded primary style -->
<lib-icon-button
  icon="settings"
  ariaLabel="Open Settings"
  variant="rounded-primary"
  color="highlight"
  (buttonClick)="openSettings()"
>
</lib-icon-button>

<!-- Delete button with error color -->
<lib-icon-button
  icon="delete"
  ariaLabel="Delete Item"
  color="error"
  [disabled]="!canDelete"
  (buttonClick)="deleteItem()"
>
</lib-icon-button>

<!-- Small dimmed action button -->
<lib-icon-button
  icon="edit"
  ariaLabel="Edit"
  size="small"
  color="dimmed"
  (buttonClick)="editItem()"
>
</lib-icon-button>

<!-- Dynamic color based on state -->
<lib-icon-button
  icon="favorite"
  ariaLabel="Add to Favorites"
  [color]="isFavorite ? 'success' : 'normal'"
  (buttonClick)="toggleFavorite()"
>
</lib-icon-button>

<!-- Button with tooltip -->
<lib-icon-button
  icon="power_settings_new"
  ariaLabel="Toggle Power"
  [tooltip]="isEnabled() ? 'Disable device' : 'Enable device'"
  [color]="isEnabled() ? 'highlight' : 'normal'"
  (buttonClick)="onTogglePower()"
>
</lib-icon-button>
```

**Icon Display Options**:

The component supports two mutually exclusive ways to display icons:

1. **Material Icons** (`icon` property): Use for standard Material Design icons from Google Fonts
2. **Custom Icon Components** (`ng-content`): **Recommended** for reusable custom icons - creates dedicated components for better maintainability, type safety, and code organization

**Style Integration**:

The component automatically maps to existing classes from [STYLE_GUIDE.md](STYLE_GUIDE.md):

- **Size Mapping**:

  - `small` → `.icon-button-small`
  - `medium` → `.icon-button-medium`
  - `large` → `.icon-button-large`

- **Variant Mapping**:

  - `rounded-primary` → `.icon-button-rounded-primary`
  - `rounded-transparent` → `.icon-button-rounded-transparent`
  - `standard` → Default Material Design styling

- **Color Mapping** (references [STYLE_GUIDE.md](STYLE_GUIDE.md) semantic colors):
  - `normal` → `.normal` (default inherit color)
  - `highlight` → `.highlight` (cyan accent color from `--color-highlight`)
  - `success` → `.success` (green color from `--color-success`)
  - `error` → `.error` (red color from `--color-error`)
  - `dimmed` → `.dimmed` (gray color from `--color-dimmed`)

**Accessibility Features**:

- **Required ARIA Label**: Always requires `ariaLabel` for screen reader compatibility
- **Proper Button Semantics**: Uses semantic `<button>` element with `mat-icon-button`
- **Disabled State Handling**: Properly handles disabled state with both visual and functional changes
- **Focus Management**: Maintains proper focus behavior and keyboard navigation
- **High Contrast Support**: Compatible with high contrast modes through Material Design

**Type Safety**:

```typescript
import { IconButtonSize, IconButtonVariant, IconButtonColor } from '@teensyrom-nx/ui/components';

// Component usage with full type safety
export class MyComponent {
  buttonSize: IconButtonSize = 'medium';
  buttonVariant: IconButtonVariant = 'rounded-primary';
  buttonColor: IconButtonColor = 'success';

  onButtonClick(): void {
    console.log('Button clicked!');
  }
}
```

**Best Practice**: Use for all icon-based actions throughout the application to maintain consistent styling, behavior, and accessibility patterns. Always provide meaningful `ariaLabel` values.

**Used In**:

- [`device-item.component.html`](../libs/features/devices/src/lib/device-view/device-item/device-item.component.html) - Power button for device connection control

### `ActionButtonComponent`

**Purpose**: A reusable action button component that combines Material Design buttons with icon and text in a standardized, accessible pattern. Integrates with design tokens for consistent semantic coloring.

**Selector**: `lib-action-button`

**Properties**:

- `icon` (required): `string` - Material Design icon name to display in the button
- `label` (required): `string` - Button text content that appears next to the icon
- `variant` (optional): `'stroked' | 'flat' | 'raised' | 'fab'` - Material button style variant - defaults to 'stroked'
- `color` (optional): `'primary' | 'success' | 'error' | 'highlight' | 'normal'` - Semantic color variant using [STYLE_GUIDE.md](STYLE_GUIDE.md) design tokens - defaults to 'primary'
- `disabled` (optional): `boolean` - Whether the button is disabled - defaults to false
- `ariaLabel` (optional): `string` - Accessibility label for screen readers (defaults to label value)
- `tooltip` (optional): `string` - Tooltip text displayed on hover - defaults to empty string (no tooltip)

**Events**:

- `buttonClick`: Emitted when the button is clicked (only when not disabled)

**Usage Examples**:

```html
<!-- Basic usage -->
<lib-action-button icon="refresh" label="Refresh Data" (buttonClick)="refresh()">
</lib-action-button>

<!-- Success action with semantic color -->
<lib-action-button icon="download" label="Index All" color="success" (buttonClick)="indexAll()">
</lib-action-button>

<!-- Destructive action -->
<lib-action-button
  icon="reset_tv"
  label="Reset Devices"
  color="error"
  variant="raised"
  (buttonClick)="resetDevices()"
>
</lib-action-button>

<!-- Disabled state -->
<lib-action-button
  icon="upload"
  label="Upload Files"
  [disabled]="!hasFiles"
  ariaLabel="Upload selected files to server"
  (buttonClick)="upload()"
>
</lib-action-button>

<!-- With tooltip -->
<lib-action-button
  icon="info"
  label="Details"
  tooltip="View detailed information about this item"
  (buttonClick)="showDetails()"
>
</lib-action-button>

<!-- Conditional tooltip -->
<lib-action-button
  icon="power_settings_new"
  label="Toggle Power"
  [tooltip]="isPowered ? 'Turn off device' : 'Turn on device'"
  (buttonClick)="togglePower()"
>
</lib-action-button>
```

**Style Integration**:

The component automatically maps to design token colors from [STYLE_GUIDE.md](STYLE_GUIDE.md#action-button-color-classes):

- **Color Mapping**:

  - `primary` → Uses Material Design's natural primary color (no custom classes applied)
  - `success` → [`.action-button-success`](STYLE_GUIDE.md#action-button-color-classes) (green text color from `--color-success`)
  - `error` → [`.action-button-error`](STYLE_GUIDE.md#action-button-color-classes) (red text color from `--color-error`)
  - `highlight` → [`.action-button-highlight`](STYLE_GUIDE.md#action-button-color-classes) (cyan text color from `--color-highlight`)
  - `normal` → Uses Material Design's default styling (no custom classes applied)

- **Variant Mapping**:
  - `stroked` → `mat-stroked-button` (outlined button - default)
  - `flat` → `mat-flat-button` (text button)
  - `raised` → `mat-raised-button` (elevated button)
  - `fab` → `mat-fab` (floating action button)

**Styling Philosophy**: The component preserves Material Design's natural button appearance and only overrides text color for semantic colors (`success`, `error`, `highlight`). This ensures buttons maintain proper borders, spacing, and Material styling while providing semantic color feedback through text color changes.

**Accessibility Features**:

- **Automatic ARIA handling**: Uses label as aria-label unless explicit ariaLabel provided
- **Proper button semantics**: Uses semantic `<button>` element with Material directives
- **Disabled state support**: Prevents interaction and provides visual feedback when disabled
- **Keyboard navigation**: Full keyboard accessibility support
- **Screen reader compatibility**: Meaningful labels and proper role semantics

**Type Safety**:

```typescript
import { ActionButtonVariant, ActionButtonColor } from '@teensyrom-nx/ui/components';

export class MyComponent {
  buttonVariant: ActionButtonVariant = 'raised';
  buttonColor: ActionButtonColor = 'success';

  onActionButtonClick(): void {
    console.log('Action button clicked!');
  }
}
```

**Best Practice**: Use for all action-oriented buttons with icons and text throughout the application. Replaces manual `mat-stroked-button` + `lib-icon-label` patterns. Choose semantic colors that match the action's intent (error for destructive actions, success for positive actions, etc.).

**Used In**:

- [`device-toolbar.component.html`](../libs/features/devices/src/lib/device-view/device-toolbar/device-toolbar.component.html) - Device management action buttons

---

## Icon Components

### `JoystickIconComponent`

**Purpose**: A custom SVG icon component that displays a joystick/controller icon for gaming-related UI elements. Designed for use with the `IconButtonComponent` content projection pattern.

**Selector**: `lib-joystick-icon`

**Properties**: None - Pure presentational component

**Usage Examples**:

```html
<!-- In icon buttons (recommended pattern) -->
<lib-icon-button ariaLabel="Games Filter" size="large" (buttonClick)="onGamesClick()">
  <lib-joystick-icon></lib-joystick-icon>
</lib-icon-button>

<!-- Standalone usage -->
<lib-joystick-icon></lib-joystick-icon>

<!-- In other components -->
<div class="game-section">
  <lib-joystick-icon></lib-joystick-icon>
  <span>Games</span>
</div>
```

**Features**:

- **Responsive Sizing**: Automatically inherits size from parent button (18px for small, 24px for medium, 36px for large)
- **Theme Integration**: Uses `fill: currentColor` to inherit text color from parent for consistent theming
- **High Quality SVG**: Vector-based icon that scales cleanly at any size
- **Accessibility Ready**: Works seamlessly with `IconButtonComponent` accessibility features

**Used In**:

- [`filter-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/filter-toolbar/filter-toolbar.component.html) - Games filter button

### `ImageIconComponent`

**Purpose**: A custom SVG icon component that displays an image/photo icon for image-related UI elements. Designed for use with the `IconButtonComponent` content projection pattern.

**Selector**: `lib-image-icon`

**Properties**: None - Pure presentational component

**Usage Examples**:

```html
<!-- In icon buttons (recommended pattern) -->
<lib-icon-button ariaLabel="Images Filter" size="large" (buttonClick)="onImagesClick()">
  <lib-image-icon></lib-image-icon>
</lib-icon-button>

<!-- Standalone usage -->
<lib-image-icon></lib-image-icon>

<!-- In gallery components -->
<div class="image-section">
  <lib-image-icon></lib-image-icon>
  <span>Photos</span>
</div>
```

**Features**:

- **Responsive Sizing**: Automatically inherits size from parent button (18px for small, 24px for medium, 36px for large)
- **Theme Integration**: Uses `fill: currentColor` to inherit text color from parent for consistent theming
- **High Quality SVG**: Vector-based icon with detailed image/photo representation
- **Accessibility Ready**: Works seamlessly with `IconButtonComponent` accessibility features

**Used In**:

- [`filter-toolbar.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/filter-toolbar/filter-toolbar.component.html) - Images filter button

### `ThumbnailImageComponent`

**Purpose**: A compact image thumbnail component for displaying cover art, album artwork, or file previews. Designed for use in media players, file listings, and anywhere a small preview image is needed.

**Selector**: `lib-thumbnail-image`

**Properties**:

- `imageUrl` (optional): `string | null` - URL of the image to display. Component renders nothing when null.
- `size` (optional): `'small' | 'medium' | 'large'` - Size variant - defaults to 'medium'

**Usage Examples**:

```html
<!-- Basic usage with medium size (default) -->
<lib-thumbnail-image [imageUrl]="file.coverArtUrl"></lib-thumbnail-image>

<!-- Small thumbnail for compact lists -->
<lib-thumbnail-image [imageUrl]="album.thumbnailUrl" size="small"></lib-thumbnail-image>

<!-- Large thumbnail for detailed views -->
<lib-thumbnail-image [imageUrl]="track.artworkUrl" size="large"></lib-thumbnail-image>

<!-- Conditional rendering (only shows when URL exists) -->
<lib-thumbnail-image [imageUrl]="file.images[0]?.url ?? null" size="medium"></lib-thumbnail-image>
```

**Advanced Usage Patterns**:

```typescript
// Component with computed thumbnail URL
export class FileInfoComponent {
  fileItem = input<FileItem | null>();

  // Get the first available image
  thumbnailUrl = computed(() => {
    const item = this.fileItem();
    if (!item?.images || item.images.length === 0) {
      return null;
    }
    return item.images[0].url;
  });
}
```

```html
<!-- In template -->
<lib-thumbnail-image [imageUrl]="thumbnailUrl()" size="medium"></lib-thumbnail-image>
```

**Features**:

- **Conditional Rendering**: Only renders when imageUrl is provided (not null)
- **Responsive Sizing**: Three size variants for different UI contexts
- **Object Fit**: Uses `object-fit: cover` for proper image scaling without distortion
- **Rounded Corners**: 4px border radius for modern card-style appearance
- **Fallback Background**: Subtle background color when image is loading

**Style Details**:

- **Size Mapping**:

  - `small` → 32px × 32px (compact lists, inline previews)
  - `medium` → 48px × 48px (standard player controls, file listings)
  - `large` → 64px × 64px (detailed views, featured content)

- **Visual Properties**:
  - `object-fit: cover` - Maintains aspect ratio, crops to fit
  - `border-radius: 4px` - Subtle rounded corners
  - `background-color: rgba(255, 255, 255, 0.05)` - Loading state indicator

**Best Practice**: Use for any thumbnail image display throughout the application. The component handles null URLs gracefully, making it safe to use with optional image data. Perfect for media player controls, file browsers, and anywhere visual preview enhances UX.

**Used In**:

- [`file-info.component.html`](../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/file-info/file-info.component.html) - Media player file information display

---

## Video & CRT Components

📺 **See [COMPONENT_LIBRARY_CRT.md](./COMPONENT_LIBRARY_CRT.md) for comprehensive CRT emulation documentation.**

The CRT emulation system includes components for video display, capture device management, and retro CRT visual effects:

| Component | Purpose |
|-----------|---------|
| `CrtEffectWrapperComponent` | Applies CRT visual effects (scanlines, vignette, curvature, color filters) to any content |
| `CrtSettingsPanelComponent` | UI panel for real-time CRT effect adjustment with presets |
| `VideoStreamComponent` | Displays MediaStream in video element with loading states |
| `VideoControlsToolbarComponent` | Vertical toolbar for video player controls (CRT, device, fullscreen) |
| `VideoDeviceSelectorComponent` | Dropdown for selecting video capture devices |
| `ContentOverlayContainerComponent` | 9-slot layout container with hover-reveal overlays and inactivity timer |

### `ContentOverlayContainerComponent`

**Purpose**: A sophisticated layout container for video players and media displays that provides 9 named content projection slots with smart hover-to-reveal behavior, inactivity timer, CDK overlay awareness, and fullscreen support. Perfect for building Netflix-style video interfaces.

**Selector**: `lib-content-overlay-container`

**Properties**:

- `showOverlaysOnHover`: Enable hover-reveal behavior (default: `true`)
- `overlayTransitionMs`: Transition duration in ms (default: `300`)
- `inactivityTimeoutMs`: Milliseconds of no mouse movement before hiding overlays (default: `3000`). Set to `0` to disable timer.

**Events**:

- `fullscreenChange`: Emitted when fullscreen state changes (`boolean`)

**Computed Signals**:

- `isFullscreen()`: Current fullscreen state
- `shouldShowOverlays()`: Whether overlays are currently visible

**Content Slots** (9 named projection slots):

```
┌─────────────────────────────────────┐
│ topLeftCorner  topOverlay  topRight │  ← Top row
├─────────────────────────────────────┤
│ leftControls   content   rightCtrl  │  ← Middle (content + sides)
├─────────────────────────────────────┤
│ btmLeftCtrls  btmOverlay  btmRight  │  ← Bottom row
└─────────────────────────────────────┘
```

**Smart Behavior**:

- **Hover-Reveal**: Overlays hidden by default, shown on mouse enter
- **Inactivity Timer**: Overlays auto-hide after 3 seconds of no mouse movement (configurable)
- **CDK Overlay Awareness**: Overlays stay visible when tooltips/dropdowns are open
- **Fullscreen Support**: Built-in fullscreen API integration
- **Manual Lock**: Use `overlayLockCount` signal to programmatically keep overlays visible

**Usage**:

```html
<!-- Basic video player with inactivity timer -->
<lib-content-overlay-container 
  [showOverlaysOnHover]="true"
  [inactivityTimeoutMs]="3000"
  (fullscreenChange)="onFullscreen($event)"
>
  <!-- Background content -->
  <lib-video-stream content [stream]="mediaStream"></lib-video-stream>
  
  <!-- Top overlays -->
  <lib-filter-toolbar topOverlay></lib-filter-toolbar>
  <lib-icon-button topRightCorner icon="close" (buttonClick)="close()"></lib-icon-button>
  
  <!-- Side controls -->
  <lib-crt-settings-panel leftControls [settings]="crtSettings"></lib-crt-settings-panel>
  
  <!-- Bottom overlays -->
  <lib-player-controls bottomLeftControls></lib-player-controls>
  <lib-now-playing bottomOverlay [song]="currentSong"></lib-now-playing>
</lib-content-overlay-container>

<!-- Disable inactivity timer (overlays stay visible on hover) -->
<lib-content-overlay-container [inactivityTimeoutMs]="0">
  <img content src="photo.jpg" />
  <div topOverlay>Photo metadata</div>
</lib-content-overlay-container>

<!-- Custom inactivity timeout (5 seconds) -->
<lib-content-overlay-container [inactivityTimeoutMs]="5000">
  <video content src="video.mp4"></video>
  <div bottomOverlay>Video controls</div>
</lib-content-overlay-container>
```

**Advanced CDK Overlay Handling**:

The component automatically detects when CDK overlays (Material tooltips, custom dropdowns) are opened from within its content and keeps overlays visible. This works correctly whether used standalone or inside Material Dialogs.

```typescript
// Component tracks overlay state automatically
export class VideoPlayerComponent {
  // Manual overlay lock example (rare - usually not needed)
  lockOverlays() {
    this.overlayLockCount.update(c => c + 1);
  }
  
  unlockOverlays() {
    this.overlayLockCount.update(c => Math.max(0, c - 1));
  }
}
```

**Inactivity Timer Behavior**:

- Mouse enters → overlays appear, timer starts (3 seconds)
- Mouse moves → timer resets (another 3 seconds)
- No movement for 3 seconds → overlays fade out
- Mouse leaves → overlays immediately hide, timer cleared
- Dropdown/tooltip opens → timer ignored, overlays stay visible
- Set to `0` → timer disabled, overlays stay visible while hovering

**Used In**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

---

## Display Components

### `CycleImageComponent`

**Purpose**: An advanced image carousel component that automatically cycles through multiple images with smooth fade transitions and optional blurred background effects. Supports multiple size variants from small thumbnails to large detail views.

**Selector**: `lib-cycle-image`

**Properties**:

- `images` (required): `string[]` - Array of image URLs to cycle through
- `intervalMs` (optional): `number` - Milliseconds between image transitions - defaults to 8000 (8 seconds)
- `placeholderUrl` (optional): `string` - Fallback image when no images provided - defaults to '/placeholder.jpg'
- `size` (optional): `'thumbnail' | 'small' | 'medium' | 'large'` - Size variant - defaults to 'large'
- `width` (optional): `string` - Custom width override (e.g., '76.8px') - takes precedence over size preset
- `height` (optional): `string` - Custom height override (e.g., '48px') - takes precedence over size preset

**Usage Examples**:

```html
<!-- Large detail view with blurred background (default) -->
<lib-cycle-image [images]="albumArtUrls"></lib-cycle-image>

<!-- Small thumbnail for player toolbar (simple mode - no blur) -->
<lib-cycle-image [images]="fileItem.images.map(img => img.url)" size="thumbnail"> </lib-cycle-image>

<!-- Custom dimensions for C64 aspect ratio (320x200 = 1.6:1) -->
<lib-cycle-image 
  [images]="imageUrls()" 
  size="thumbnail" 
  width="76.8px" 
  height="48px">
</lib-cycle-image>

<!-- Medium size with custom interval -->
<lib-cycle-image [images]="galleryImages" size="medium" [intervalMs]="5000"> </lib-cycle-image>

<!-- With placeholder for empty state -->
<lib-cycle-image [images]="screenshots" placeholderUrl="/assets/no-image.png" size="large">
</lib-cycle-image>
```

**Advanced Usage Patterns**:

```typescript
// Component with computed image URLs from FileItem
export class FileInfoComponent {
  fileItem = input<FileItem | null>();

  // Extract all image URLs for cycling
  imageUrls = computed(() => {
    const item = this.fileItem();
    if (!item?.images || item.images.length === 0) {
      return [];
    }
    return item.images.map((img) => img.url);
  });
}
```

```html
<!-- In template - conditional rendering with cycling -->
@if (imageUrls().length > 0) {
<lib-cycle-image [images]="imageUrls()" size="thumbnail"></lib-cycle-image>
}
```

**Features**:

- **Automatic Cycling**: Smoothly transitions between images at specified interval
- **Fade Animations**: 1-second fade transitions with opacity and blur effects
- **Blurred Background**: Large/medium sizes show artistic blurred background (complex mode)
- **Simple Mode**: Thumbnail/small sizes disable blur effects for clean thumbnails
- **Single Image Support**: Works perfectly with single image (no cycling)
- **Empty State Handling**: Shows placeholder when images array is empty
- **Responsive Sizing**: Four size variants for different UI contexts

**Size Variants**:

- **`thumbnail`** (48px × 48px):

  - Simple mode (no blur effects)
  - `object-fit: cover` for clean thumbnails
  - 4px border radius
  - Perfect for: Player toolbars, compact lists, inline previews

- **`small`** (80px × 80px):

  - Simple mode (no blur effects)
  - `object-fit: cover`
  - 6px border radius
  - Perfect for: Card thumbnails, small galleries

- **`medium`** (160px × 160px):

  - Complex mode with blurred background
  - `object-fit: contain` with clip-path
  - 8px border radius
  - Perfect for: Album art displays, featured content

- **`large`** (full width/height):
  - Complex mode with blurred background
  - `object-fit: contain` with clip-path
  - 16px border radius
  - Perfect for: Full detail views, main content displays

**Animation Details**:

- **Fade Duration**: 1 second for smooth transitions
- **Blur Animation**: 1.5 seconds fade-in-from-blur effect (complex mode only)
- **Background Blur**: 20px gaussian blur at 80% opacity
- **Layer Management**: Z-index controlled layering for smooth overlays

**Complex vs Simple Mode**:

- **Complex Mode** (medium/large):

  - Dual-layer blurred backgrounds for depth
  - Fade-in-from-blur animation
  - Artistic presentation with `object-fit: contain`
  - 16px clip-path rounded corners

- **Simple Mode** (thumbnail/small):
  - Single image layer only
  - Standard fade animation
  - Clean presentation with `object-fit: cover`
  - No blur effects for performance

**Best Practice**:

- Use `size="thumbnail"` in player toolbars and compact UI
- Use `size="medium"` or `size="large"` for detail views and galleries
- Provide multiple images for automatic cycling effect
- Works seamlessly with single image (no cycling needed)
- The component automatically selects simple vs complex mode based on size

**Used In**:

- [`file-info.component.html`](../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/file-info/file-info.component.html) - Player toolbar cycling thumbnails
- File detail views with multiple screenshots/artwork

**Custom Icon Best Practices**:

1. **Component Structure**: Follow the established pattern with minimal SCSS (just `:host` flex properties and `svg` size/color)
2. **Naming Convention**: Use `lib-[name]-icon` selector pattern for consistency
3. **Size Inheritance**: Always use `fill: currentColor` and size inheritance from parent components
4. **Content Projection**: Design icons specifically for use with `IconButtonComponent` ng-content pattern
5. **Export Path**: Add new icon components to `libs/ui/components/src/index.ts` for easy importing
6. **Documentation**: Document each icon's purpose and usage patterns in this component library

---

## Display Components

### `ScrollingMarqueeComponent`

**Purpose**: A reusable scrolling marquee component that displays smooth horizontal scrolling text when content overflows its container. Uses CSS-based animation for hardware-accelerated performance.

**Selector**: `lib-scrolling-marquee`

**Properties**:

- `text` (optional): `string` - Text content to display in the marquee - defaults to empty string
- `speed` (optional): `number` - Scroll speed in pixels per second - defaults to 50
- `direction` (optional): `'left' | 'right'` - Scroll direction - defaults to 'left'
- `pauseOnHover` (optional): `boolean` - Pause animation when mouse hovers over the marquee - defaults to true
- `effect` (optional): `MarqueeEffect` - Visual effect to apply to the text - defaults to 'none'
  - `'none'` - Basic scroll only
  - `'wave'` - Sine wave vertical motion
  - `'rainbow'` - Color spectrum cycling
  - `'glitch'` - Random displacement (CRT interference)
  - `'bounce'` - Elastic squash/stretch
  - `'copper'` - Copper bar sweep (Amiga style)
  - `'spiral'` - 3D rotation twist
  - `'random'` - Randomly selects one of the effects above (excludes 'none')

**Usage Examples**:

```html
<!-- Basic usage with default settings -->
<lib-scrolling-marquee [text]="fileDescription()"></lib-scrolling-marquee>

<!-- With retro demo effect -->
<lib-scrolling-marquee [text]="fileDescription()" effect="wave"> </lib-scrolling-marquee>

<!-- Random effect (selects different effect each time) -->
<lib-scrolling-marquee [text]="fileDescription()" effect="random"> </lib-scrolling-marquee>

<!-- Custom speed and direction with rainbow effect -->
<lib-scrolling-marquee [text]="longText" [speed]="100" direction="right" effect="rainbow">
</lib-scrolling-marquee>

<!-- Disable pause on hover with glitch effect -->
<lib-scrolling-marquee [text]="notification" [pauseOnHover]="false" effect="glitch">
</lib-scrolling-marquee>
```

**Advanced Usage Patterns**:

```typescript
// Component with computed text from player state
export class PlayerDeviceContainerComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);

  deviceId = input.required<string>();

  fileDescription = computed(() => {
    const currentFile = this.playerContext.getCurrentFile(this.deviceId())();
    return currentFile?.file?.description ?? '';
  });
}
```

```html
<!-- In template - reactive text from signals -->
<lib-scrolling-marquee [text]="fileDescription()"></lib-scrolling-marquee>
```

**Features**:

- **Automatic Overflow Detection**: Only scrolls when text width exceeds container width
- **CSS Animation**: Hardware-accelerated GPU transforms for smooth 60fps animation
- **Dynamic Duration**: Automatically calculates animation duration based on content width and speed
- **Pause on Hover**: Optional mouse hover pause for better readability
- **Bidirectional**: Supports both left-to-right and right-to-left scrolling
- **Responsive**: Automatically re-checks overflow when text content changes
- **Retro Demo Effects**: Six classic demoscene-inspired visual effects
  - **Wave**: Characters undulate in a smooth sine wave pattern
  - **Rainbow**: Full color spectrum cycling through the text
  - **Glitch**: CRT-style interference with random character displacement
  - **Bounce**: Elastic squash and stretch animation
  - **Copper**: Amiga-style copper bar sweep with glow effects
  - **Spiral**: 3D rotation twist effect
  - **Random**: Automatically selects a different effect

**Animation Details**:

- Uses CSS `@keyframes` with `transform: translateX()` for GPU acceleration
- Animation duration dynamically calculated: `width / speed = duration`
- Smooth transitions with `linear` timing function for scrolling
- Automatic browser optimization when tab is inactive
- Effects use character-level animations with staggered delays via CSS custom properties
- Scrolling and effects work simultaneously - effects animate individual characters while the container scrolls

**Performance Considerations**:

- Effects split text into individual character spans for animation
- GPU-accelerated transforms used for all animations
- Suitable for text up to ~100 characters with effects
- For longer text with effects, consider increasing animation speed
- Effects automatically disable when `effect="none"` to optimize performance

**Best Practice**: Use for displaying long text content that doesn't fit in constrained spaces like file descriptions, notifications, or status messages. The component handles empty text gracefully and only animates when necessary, making it efficient for reactive content. Use `effect="random"` for dynamic visual interest, or choose a specific effect that matches your app's aesthetic.

**Used In**:

- Player UI for file descriptions
- Notification banners
- Status bars with dynamic content

### `StyledIconComponent`

**Purpose**: A reusable styled icon component that displays Material Design icons with consistent sizing and semantic coloring from the design system.

**Selector**: `lib-styled-icon`

**Properties**:

- `icon` (required): `string` - Material Design icon name to display
- `color` (optional): `'normal' | 'primary' | 'highlight' | 'success' | 'error' | 'dimmed' | 'directory'` - Semantic color variant from design system - defaults to 'normal'
- `size` (optional): `'small' | 'medium' | 'large'` - Size variant - defaults to 'medium'

**Usage Examples**:

```html
<!-- Directory icon with directory color (yellow/gold) -->
<lib-styled-icon icon="folder" color="directory" size="medium"> </lib-styled-icon>

<!-- Device icon with primary color -->
<lib-styled-icon icon="devices" color="primary" size="large"> </lib-styled-icon>

<!-- Storage type icon with highlight color -->
<lib-styled-icon icon="sd_card" color="highlight"> </lib-styled-icon>

<!-- Success icon with success color -->
<lib-styled-icon icon="check_circle" color="success" size="small"> </lib-styled-icon>

<!-- Error icon with error color -->
<lib-styled-icon icon="error" color="error"> </lib-styled-icon>

<!-- Simple icon without color -->
<lib-styled-icon icon="info"> </lib-styled-icon>
```

**Advanced Usage Patterns**:

```html
<!-- Directory listing with styled icons -->
@for (item of directoryItems; track item.id) {
<div class="directory-item">
  @if (item.isDirectory) {
  <lib-styled-icon icon="folder" color="directory" size="medium"></lib-styled-icon>
  } @else {
  <lib-styled-icon icon="insert_drive_file" color="normal" size="medium"></lib-styled-icon>
  }
  <span>{{ item.name }}</span>
</div>
}

<!-- Navigation tree with different icon types -->
<lib-styled-icon [icon]="nodeIcon()" [color]="nodeColor()" [size]="nodeSize()"></lib-styled-icon>
```

**Style Integration**:

The component automatically maps to design system colors and global style classes from [STYLE_GUIDE.md](STYLE_GUIDE.md#styled-icon-classes):

- **Size Mapping**:

  - `small` → [`.styled-icon-small`](STYLE_GUIDE.md#styled-icon-classes) (16px font, 14px dimensions)
  - `medium` → [`.styled-icon-medium`](STYLE_GUIDE.md#styled-icon-classes) (24px font, 20px dimensions - matches directory tree icons)
  - `large` → [`.styled-icon-large`](STYLE_GUIDE.md#styled-icon-classes) (32px font, 28px dimensions)

- **Color Mapping** (references design system CSS variables):
  - `normal` → Default Material icon color
  - `primary` → [`.styled-icon-primary`](STYLE_GUIDE.md#styled-icon-classes) (uses `--color-primary-bright`)
  - `highlight` → [`.styled-icon-highlight`](STYLE_GUIDE.md#styled-icon-classes) (uses `--color-highlight`)
  - `success` → [`.styled-icon-success`](STYLE_GUIDE.md#styled-icon-classes) (uses `--color-success`)
  - `error` → [`.styled-icon-error`](STYLE_GUIDE.md#styled-icon-classes) (uses `--color-error`)
  - `dimmed` → [`.styled-icon-dimmed`](STYLE_GUIDE.md#styled-icon-classes) (uses `--color-dimmed`)
  - `directory` → [`.styled-icon-directory`](STYLE_GUIDE.md#styled-icon-classes) (uses `--color-directory`)

**Type Safety**:

```typescript
import { StyledIconSize, StyledIconColor } from '@teensyrom-nx/ui/components';

export class MyComponent {
  iconSize: StyledIconSize = 'medium';
  iconColor: StyledIconColor = 'directory';
}
```

**Best Practice**: Use for all standalone icon displays throughout the application to maintain consistent sizing and semantic coloring. Ideal for directory listings, file browsers, navigation trees, and any context where icons need standardized appearance.

**Used In**:

- Directory tree components for folder/device/storage icons
- File listing components for file type icons
- Navigation components for visual indicators

### `IconLabelComponent`

**Purpose**: A versatile component that displays a styled icon alongside text with preset size variations, color options, and text truncation controls. Built on [StyledIconComponent](COMPONENT_LIBRARY.md#stylediconcomponent) for consistent icon styling. Uses [Design Tokens](STYLE_GUIDE.md#design-tokens) for typography and spacing to ensure consistency across the application.

**Selector**: `lib-icon-label`

**Properties**:

- `icon` (optional): `string` - Material Design icon name to display - defaults to empty string
- `label` (optional): `string` - Primary text label to display next to the icon - defaults to empty string
- `secondaryLabel` (optional): `string` - Optional secondary text displayed below primary label - defaults to empty string
- `labelClass` (optional): `string` - Optional CSS class applied to primary text - defaults to empty string
- `secondaryLabelClass` (optional): `string` - Optional CSS class applied to secondary text - defaults to empty string
- `color` (optional): `'normal' | 'primary' | 'highlight' | 'success' | 'error' | 'dimmed' | 'directory'` - Icon color from design system - defaults to 'normal'
- `size` (optional): `'small' | 'medium' | 'large' | 'extra-large'` - Size preset that controls icon size, text size, font weight, and gap spacing - defaults to 'medium'
- `truncate` (optional): `boolean` - Enable text truncation with ellipsis (20ch max width) - defaults to true

**Size Presets**:

The `size` parameter automatically adjusts multiple styling aspects for cohesive visual hierarchy. All typography values are derived from [Design Tokens](STYLE_GUIDE.md#design-tokens):

| Preset | Icon | Font Size Token | Font Weight Token | Spacing Token | Use Case |
|--------|------|-----------------|-------------------|---------------|----------|
| `'small'` | small | `--font-size-sm` | `--font-weight-normal` | `--spacing-inline-xs` | Compact lists, secondary info |
| `'medium'` | medium | `--font-size-md` | `--font-weight-normal` | `--spacing-inline-sm` | Default, body content |
| `'large'` | large | `--font-size-lg` | `--font-weight-normal` | `--spacing-inline-md` | Section headers, emphasis |
| `'extra-large'` | extra-large | `--font-size-xl` | `--font-weight-medium` | `--spacing-inline-lg` | Page titles, headings |

**Secondary Text Scaling**:

When using `secondaryLabel`, the secondary text automatically scales proportionally with size presets:

| Size Preset | Primary Text | Secondary Text |
|-------------|--------------|----------------|
| `small` | `sm` | `xs` |
| `medium` | `md` | `sm` |
| `large` | `lg` | `md` |
| `extra-large` | `xl` | `lg` |

See [Typography Tokens](STYLE_GUIDE.md#typography-tokens) and [Spacing Tokens](STYLE_GUIDE.md#spacing-tokens) for actual values.

**Usage Examples**:

```html
<!-- Single-line (backward compatible) -->
<lib-icon-label icon="usb" label="USB Stick"></lib-icon-label>

<!-- Two-line with status -->
<lib-icon-label 
  icon="usb" 
  label="USB Stick"
  secondaryLabel="Available"
  secondaryLabelClass="success"
></lib-icon-label>

<!-- Different sizes with secondary text -->
<lib-icon-label 
  icon="music_note" 
  label="Summer of '69"
  secondaryLabel="Bryan Adams • 1984"
  size="large"
></lib-icon-label>

<!-- Medium size (default) - general purpose -->
<lib-icon-label icon="folder" label="Documents"></lib-icon-label>

<!-- Small size - for tight layouts and secondary info -->
<lib-icon-label icon="info" label="Details" size="small"></lib-icon-label>

<!-- Large size - for section headers and emphasized content -->
<lib-icon-label 
  icon="desktop_windows" 
  label="Device Settings" 
  size="large" 
  color="primary">
</lib-icon-label>

<!-- Extra-large size - for page titles and major headings -->
<lib-icon-label 
  icon="devices" 
  label="Connected Devices" 
  size="extra-large" 
  color="highlight">
</lib-icon-label>

<!-- Directory tree node pattern with default medium size -->
<lib-icon-label 
  icon="folder" 
  label="Games" 
  color="directory" 
  [truncate]="false">
</lib-icon-label>

<!-- File listing in table (no truncation) -->
<lib-icon-label
  [icon]="file.isDirectory ? 'folder' : 'insert_drive_file'"
  [label]="file.name"
  [color]="file.isDirectory ? 'directory' : 'normal'"
  [truncate]="false">
</lib-icon-label>

<!-- Device info with truncation and extra-large sizing -->
<lib-icon-label 
  icon="tag" 
  [label]="'Device ID: ' + deviceId" 
  size="extra-large">
</lib-icon-label>
```

**Migration Pattern - Before/After**:

```html
<!-- OLD: Nested containers with manual positioning -->
<div class="container">
  <div class="left">
    <lib-icon-label icon="usb" label="USB"></lib-icon-label>
    <span style="margin-left: 2rem; margin-top: -0.2rem;">Available</span>
  </div>
</div>

<!-- NEW: Clean layout with secondary label -->
<lib-icon-label 
  icon="usb" 
  label="USB"
  secondaryLabel="Available"
  secondaryLabelClass="success"
></lib-icon-label>
```

**Advanced Usage Patterns**:

```typescript
// Dynamic icon and color based on file type
export class FileListComponent {
  getFileIcon(file: FileInfo): string {
    if (file.isDirectory) return 'folder';
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'png':
        return 'image';
      case 'mp3':
        return 'audio_file';
      default:
        return 'insert_drive_file';
    }
  }

  getFileColor(file: FileInfo): StyledIconColor {
    return file.isDirectory ? 'directory' : 'normal';
  }
}
```

```html
<!-- In template with default medium size -->
<lib-icon-label
  [icon]="getFileIcon(file)"
  [label]="file.name"
  [color]="getFileColor(file)"
  [truncate]="false">
</lib-icon-label>

<!-- Device section header with extra-large sizing -->
<lib-icon-label
  icon="desktop_windows"
  [label]="deviceName"
  size="extra-large"
  color="primary"
  [truncate]="true">
</lib-icon-label>
```

**Features**:

- **Styled Icons**: Uses [StyledIconComponent](COMPONENT_LIBRARY.md#stylediconcomponent) internally for consistent icon appearance
- **Design Token Integration**: Typography and spacing use [Design Tokens](STYLE_GUIDE.md#design-tokens) for consistency
- **Preset Sizing System**: Four size presets that automatically adjust icon, text, weight, and spacing for proper visual hierarchy
- **Flexible Layout**: Icon and text horizontally aligned with preset-based gap spacing
- **Text Truncation**: Optional ellipsis truncation for long labels (enabled by default)
- **Accessibility**: Text includes `title` attribute for tooltips on hover
- **Backward Compatible**: Maintains original `small`, `medium`, `large` size values with new `extra-large` option

**Style Integration**:

The component leverages:

- [StyledIconComponent](COMPONENT_LIBRARY.md#stylediconcomponent) for icon styling
- [Design Tokens](STYLE_GUIDE.md#design-tokens) for typography and spacing values
- Size-specific CSS classes for text styling (`.text-small`, `.text-medium`, `.text-large`, `.text-extra-large`)
- Size-specific gap classes for spacing (`.gap-small`, `.gap-medium`, `.gap-large`, `.gap-extra-large`)
- Conditional `.truncate` class for text overflow handling

**Visual Hierarchy Guidance**:

- **`small`**: Use for secondary information, metadata labels, or when space is constrained
- **`medium`**: Default for most UI elements - body content, lists, navigation items
- **`large`**: Section headers, category titles, device names - commands attention without overwhelming
- **`extra-large`**: Page titles, major headings, primary focal points - use sparingly for maximum impact

**Best Practice**: Choose size based on content hierarchy, not personal preference. The preset system ensures consistent visual language across the application:

- **Device settings sections** - `extra-large` for device names that group related settings
- **Directory trees** - `medium` (default) with colored icons for file/folder browsing
- **File tables** - `medium` or `small` with dynamic icons based on file type
- **Navigation menus** - `medium` for consistent menu item appearance
- **Page headers** - `extra-large` for main page titles, `large` for subsection headers

**Used In**:

- `libs/features/settings/src/lib/settings-view/device-settings-section/device-settings-section.component.html` - Device section headers (extra-large size)
- [`device-item.component.html`](../libs/features/devices/src/lib/device-view/device-item/device-item.component.html) - Device information labels
- [`storage-item.component.html`](../libs/features/devices/src/lib/device-view/storage-item/storage-item.component.html) - Storage information labels with status as secondary label
- [`action-button.component.html`](../libs/ui/components/src/lib/action-button/action-button.component.html) - Button labels with icons
- [`directory-tree-node.component.html`](../libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree-node/directory-tree-node.component.html) - Tree node labels with semantic colors

### `StatusIconLabelComponent`

**Purpose**: An enhanced icon-label component that adds status indicators with success/error icons.

**Selector**: `lib-status-icon-label`

**Properties**:

- `icon`: `string` - Primary Material Design icon name (defaults to empty string)
- `label`: `string` - Text label to display (defaults to empty string)
- `status`: `boolean | undefined` - Status indicator:
  - `true`: Shows green check circle icon
  - `false`: Shows red cancel icon
  - `undefined`: No status icon displayed

**Usage Example**:

```html
<!-- Success status -->
<lib-status-icon-label icon="wifi" label="Network Connection" [status]="true">
</lib-status-icon-label>

<!-- Error status -->
<lib-status-icon-label icon="storage" label="USB Storage" [status]="false"> </lib-status-icon-label>

<!-- No status -->
<lib-status-icon-label icon="settings" label="Configuration"> </lib-status-icon-label>
```

**Features**:

- Extends `IconLabelComponent` functionality
- Conditional status icons based on boolean state
- Uses semantic color classes (`.success`, `.error`) from [global styles](STYLE_GUIDE.md#icon-color-classes)

**Best Practice**: Use for device status, connection states, or any scenario where you need to show success/failure alongside descriptive text.

---

## Navigation Components

### `MenuItemComponent`

**Purpose**: A standardized menu item component for consistent navigation and menu styling across the application.

**Selector**: `lib-menu-item`

**Properties**:

- `menuItem`: `MenuItem` - Configuration object that defines the menu item's appearance and behavior

**MenuItem Interface**:

```typescript
export interface MenuItem {
  icon?: string; // Material Design icon name
  label: string; // Display text for the menu item
  route?: string; // Angular route for navigation
  action?: () => void; // Custom action function
  disabled?: boolean; // Whether the item is disabled
  children?: MenuItem[]; // Nested menu items for submenus
}
```

**Usage Example**:

```typescript
// Component
export class NavigationComponent {
  menuItems: MenuItem[] = [
    {
      icon: 'dashboard',
      label: 'Dashboard',
      route: '/dashboard',
    },
    {
      icon: 'devices',
      label: 'Devices',
      children: [
        { label: 'Connected Devices', route: '/devices/connected' },
        { label: 'Device Logs', route: '/devices/logs' },
      ],
    },
    {
      icon: 'settings',
      label: 'Settings',
      action: () => this.openSettings(),
      disabled: !this.hasPermission,
    },
  ];
}
```

```html
<!-- Template -->
@for (item of menuItems; track item.label) {
<lib-menu-item [menuItem]="item"></lib-menu-item>
}
```

**Features**:

- Supports both routing and custom actions
- Handles nested menu structures for submenus
- Automatic disabled state styling
- Consistent icon and text alignment
- Keyboard navigation support

**Best Practice**: Use for all navigation menus, context menus, and action lists to maintain consistent interaction patterns.

---

## Utilities

Angular-specific utilities for common UI patterns. Located in `libs/ui/components/src/lib/utils/`.

### TooltipDirective

**Selector:** `[libTooltip]`

**Purpose:** Custom tooltip directive built to replace Angular Material tooltips and eliminate CDK overlay conflicts. Provides rich tooltip functionality via attribute directive with support for titles, body text, custom colors, and flexible positioning. Tooltips are rendered by `TooltipRendererService` using direct DOM manipulation (no overlay) and automatically positioned relative to trigger elements.

**Why Custom?** 
Material Design's `matTooltip` uses CDK overlay, which created z-index conflicts and positioning issues with our custom modal dialogs and animated containers. This lightweight directive provides the same UX without CDK dependencies.

**Inputs:**

- `libTooltip` (required): `TooltipConfig` - Tooltip configuration object

#### TooltipConfig Interface

```typescript
export interface TooltipConfig {
  title?: string;                  // Optional title (larger, bolder text)
  titleColor?: TooltipTitleColor; // Optional title color variant
  body?: string;                   // Optional body text
  position?: TooltipPosition;      // Tooltip position (default: Top)
  delay?: number;                  // Delay in ms before showing (default: 500)
  alwaysShow?: boolean;            // Always show, ignoring preferences (default: false)
}
```

**Properties:**

- `title` (optional): Title text displayed at top of tooltip. Larger font size (16px) and heavier weight (500) than body text. Omit for body-only tooltips.
- `titleColor` (optional): Title color variant. Default uses theme text color, highlight uses cyan accent color. Only applies when title is provided.
- `body` (optional): Body text content. Smaller font size (12px). Omit for title-only tooltips.
- `position` (optional): Tooltip position relative to trigger element. Defaults to `TooltipPosition.Top`. Tooltip automatically adjusts to stay within viewport bounds.
- `delay` (optional): Milliseconds to wait after mouseenter before showing tooltip. Defaults to 500ms (industry standard). Set to 0 for instant display.
- `alwaysShow` (optional): When `true`, tooltip displays even if user has disabled tooltips via preferences. Use sparingly for critical UI hints (e.g., the tooltip toggle button itself). Defaults to `false`.

**Note:** At least one of `title` or `body` must be provided for tooltip to render.

#### TooltipPosition Enum

```typescript
export enum TooltipPosition {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right'
}
```

**Values:**

- `Top`: Tooltip appears above the trigger element, centered horizontally
- `Bottom`: Tooltip appears below the trigger element, centered horizontally
- `Left`: Tooltip appears to the left of the trigger element, centered vertically
- `Right`: Tooltip appears to the right of the trigger element, centered vertically

#### TooltipTitleColor Enum

```typescript
export enum TooltipTitleColor {
  Default = 'default',
  Highlight = 'highlight'
}
```

**Values:**

- `Default`: Uses theme text color (adapts to light/dark mode)
- `Highlight`: Uses cyan accent color for emphasis

#### Usage Examples

**Import statements:**

```typescript
import { Component, signal } from '@angular/core';
import { TooltipConfig, TooltipPosition, TooltipTitleColor } from '@teensyrom-nx/ui-components';
```

**Body-only tooltip:**

```typescript
@Component({
  template: `<button [libTooltip]="saveTooltip()">Save</button>`
})
export class MyComponent {
  saveTooltip = signal<TooltipConfig>({
    body: 'Click to save your changes',
    position: TooltipPosition.Top
  });
}
```

**Title-only tooltip:**

```typescript
@Component({
  template: `<button [libTooltip]="closeTooltip()">×</button>`
})
export class MyComponent {
  closeTooltip = signal<TooltipConfig>({
    title: 'Close',
    position: TooltipPosition.Bottom
  });
}
```

**Title + body tooltip with highlight color:**

```typescript
@Component({
  template: `<button [libTooltip]="deleteTooltip()">Delete</button>`
})
export class MyComponent {
  deleteTooltip = signal<TooltipConfig>({
    title: 'Delete',
    titleColor: TooltipTitleColor.Highlight,
    body: 'Permanently remove this item',
    position: TooltipPosition.Right
  });
}
```

**Computed tooltip config (transforming string input):**

```typescript
@Component({
  template: `<button [libTooltip]="tooltipConfig()">Action</button>`
})
export class MyComponent {
  tooltip = input<string>(''); // External API

  tooltipConfig = computed<TooltipConfig>(() => ({
    body: this.tooltip(),
    position: TooltipPosition.Top
  }));
}
```

**Custom delay for instant tooltips:**

```typescript
@Component({
  template: `<button [libTooltip]="quickTooltip()">Help</button>`
})
export class MyComponent {
  quickTooltip = signal<TooltipConfig>({
    title: 'Need Help?',
    body: 'Click for documentation',
    position: TooltipPosition.Bottom,
    delay: 0 // Shows immediately on hover
  });
}
```

**Always-show tooltip (bypasses user preferences):**

```typescript
@Component({
  template: `<button [libTooltip]="criticalTooltip()">?</button>`
})
export class MyComponent {
  // This tooltip always shows, even if user disables tooltips globally
  // Use sparingly for critical UI affordances (e.g., the tooltip toggle itself)
  criticalTooltip = signal<TooltipConfig>({
    title: 'Tooltips',
    body: 'Toggle tooltips on/off',
    position: TooltipPosition.Bottom,
    alwaysShow: true // Ignores preference setting
  });
}
```

#### Accessibility

**Automatic ARIA Support**: The directive automatically sets `aria-describedby` on the host element, pointing to the tooltip element ID when visible. This ensures screen readers announce tooltip content to users navigating with assistive technologies.

**Keyboard Navigation**: Currently mouse-hover only. For keyboard-accessible tooltips, use native `title` attribute or Material's `matTooltip` on non-conflicting elements.

**Best Practices**:
- Tooltips supplement but don't replace visible labels
- Keep tooltip text concise (under 150 characters)
- Don't rely solely on tooltips for critical information
- Use `title` property for icon-only buttons to provide context
- Consider using `delay: 0` for tooltips on frequently-used controls

#### Migration from Phase 2 (String API)

Phase 2.1 introduced breaking changes to the tooltip API. Update your components as follows:

**Before (Phase 2):**

```typescript
// Old string-based API
<button 
  [libTooltip]="'Click to save'" 
  [libTooltipPosition]="'above'">
  Save
</button>
```

**After (Phase 2.1):**

```typescript
import { TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui-components';

@Component({
  template: `<button [libTooltip]="saveTooltip()">Save</button>`
})
export class MyComponent {
  saveTooltip = signal<TooltipConfig>({
    body: 'Click to save',
    position: TooltipPosition.Top // 'above' → Top
  });
}
```

**Key Changes:**

- `libTooltip` now accepts `TooltipConfig` object instead of string
- `libTooltipPosition` input removed (now part of config)
- Position values: `'above'` → `TooltipPosition.Top`, `'below'` → `TooltipPosition.Bottom`
- All tooltip properties strongly typed with enums (no magic strings)

#### Used In

**Reusable Components:**

- [`action-button.component.ts`](../libs/ui/components/src/lib/action-button/action-button.component.ts) - All 4 button variants (stroked, flat, raised, fab)
- [`icon-button.component.ts`](../libs/ui/components/src/lib/icon-button/icon-button.component.ts) - Icon button component
- [`storage-item-actions.component.ts`](../libs/ui/components/src/lib/storage-item/storage-item-actions.component.ts) - Storage type icon (SD Card/USB Storage)

**Pattern:** Components accept simple string inputs and internally transform them to `TooltipConfig` using computed signals, maintaining backward-compatible external APIs.

---

## Component Architecture

### Design Principles

All shared components follow these architectural patterns:

1. **Standalone Components**: No NgModule dependencies, import directly into consuming components
2. **Signal-Based Inputs**: Use `input()` function instead of `@Input()` decorators for better type safety
3. **Modern Control Flow**: Leverage `@if`, `@for`, `@switch` syntax for template logic
4. **Content Projection**: Support flexible content via `<ng-content>` where appropriate
5. **Material Design Integration**: Built on Angular Material foundation with custom styling

### Import Pattern

```typescript
// Components
import { CardLayoutComponent } from '@teensyrom-nx/ui/components';
import { CompactCardLayoutComponent } from '@teensyrom-nx/ui/components';
import { InputFieldComponent } from '@teensyrom-nx/ui/components';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';
import { ScrollingMarqueeComponent } from '@teensyrom-nx/ui/components';
import { StyledIconComponent } from '@teensyrom-nx/ui/components';
import { IconLabelComponent } from '@teensyrom-nx/ui/components';
import { StatusIconLabelComponent } from '@teensyrom-nx/ui/components';
import { MenuItemComponent } from '@teensyrom-nx/ui/components';
import { FadingContainerComponent } from '@teensyrom-nx/ui/components';

@Component({
  // ...
  imports: [
    CardLayoutComponent,
    CompactCardLayoutComponent,
    InputFieldComponent,
    IconButtonComponent,
    ScrollingMarqueeComponent,
    StyledIconComponent,
    IconLabelComponent,
    StatusIconLabelComponent,
    MenuItemComponent,
    FadingContainerComponent,
    // other imports...
  ],
})
```

### Testing Support

All components include comprehensive unit tests using Vitest:

- **Basic rendering tests**: Verify component creation and initial state
- **Input property tests**: Validate signal-based input handling
- **Content projection tests**: Ensure ng-content works correctly
- **Conditional rendering tests**: Test dynamic show/hide behavior
- **Accessibility tests**: Verify proper ARIA attributes and keyboard support

### Global Styling Integration

Components are designed to work seamlessly with the global style system:

- **Design Tokens**: Use CSS custom properties for consistent theming
- **Utility Classes**: Apply global classes like [`.stretch-card`](STYLE_GUIDE.md#stretch-card) automatically
- **Theme Support**: Full light/dark mode compatibility
- **Material Customizations**: Leverage custom Material component styles

---

## Usage Guidelines

### When to Use Shared Components

- **Consistency**: Use shared components for any UI pattern that appears in multiple places
- **Maintenance**: Prefer shared components over duplicating similar code across features
- **Theming**: Shared components ensure consistent application of global themes and styles

### When to Create New Components

Consider adding to the shared library when you find yourself:

- Creating similar components in multiple feature libraries
- Needing to style Material components consistently across the app
- Building reusable layout patterns that could benefit other developers

### Documentation Maintenance

**IMPORTANT**: This document must be updated whenever new shared components are added.

**Update Requirements**:

1. **Document new components** with complete property/event listings
2. **Provide usage examples** showing real-world implementation
3. **Include TypeScript interfaces** for complex input types
4. **Cross-reference** with [STYLE_GUIDE.md](STYLE_GUIDE.md) for related styling
5. **Update import patterns** and architecture notes as needed

---

## Related Files

- **Component Library**: `libs/ui/components/src/lib/`
- **Global Styles**: [STYLE_GUIDE.md](STYLE_GUIDE.md) - Utility classes and Material customizations
- **Barrel Exports**: `libs/ui/components/src/index.ts` - Public API for importing components
- **Component Tests**: Individual `.spec.ts` files with comprehensive test coverage
