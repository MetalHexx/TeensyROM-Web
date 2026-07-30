---
name: style-guide
description: 'Global styles, design tokens, and Material Design customizations for TeensyROM, defined in `libs/ui/styles/src/lib/theme/styles.scss`. Use when asked to style a component, add new global CSS/SCSS, create utility classes or mixins, work with design tokens (spacing, typography, border-radius), responsive breakpoints (`screen-tablet`, `below-desktop`, `_mixins.scss`), glassy/glassmorphism effects, Material component overrides (cards, dialogs, buttons, toolbars), color schemes/themes (light/dark mode, `--color-*` variables), or CRT effect CSS variables.'
---

# Style Guide Skill

Catalog of all global styles, utility classes, design tokens, and Material Design customizations for the TeensyROM Angular application.

## When to Use This Skill

- Before styling a component — check whether a design token, utility class, or mixin already covers it
- Adding new global styles, utility classes, or SCSS mixins to `styles.scss`
- Working with design tokens (spacing, typography, border-radius) or the 3-tier responsive breakpoint system
- Applying or extending Material Design component customizations (cards, dialogs, toolbars, buttons)
- Implementing glassmorphism effects or working with the synthwave background pattern
- Inspecting or overriding CRT effect CSS variables (`--scanline-intensity`, `--crt-brightness`, etc.)

## Catalog Overview

See [references/STYLE_GUIDE.md](references/STYLE_GUIDE.md) for the full guide, covering:

- **Color Schemes & Themes** — light/dark mode Material palettes, `--color-*` semantic variables
- **Design Tokens** — spacing scale (4px grid), layout spacing aliases, typography (font size/weight), border-radius
- **Responsive Breakpoints** — 3-tier system (Phone/Tablet/Desktop) via `_mixins.scss` (`screen-tablet`, `screen-desktop`, `below-tablet`, `below-desktop`, `screen-between`)
- **Utility Classes** — `.dimmed`, `.no-text-selection`, `.list-item-highlight`, glassy effect variations (`.glassy-subtle` through `.glassy-dark`), `.glassy-card`, `.elevated-card`
- **Mixins** — glassy effect mixins, `bounce-hover`, `selectable-item`, `pulsing-highlight`
- **Material Component Customizations** — cards (`.compact-card`, `.stretch-card`), toolbars, buttons/icons (icon button sizes, action button colors), dialogs (`.glassy-dialog`, `.youtube-dialog`), overlay/backdrop system
- **Layout & Typography** — `.section` container patterns
- **Background Patterns** — synthwave neo-retro grid
- **CRT Effect CSS Variables** — scanline, vignette, curvature, and color-filter custom properties exposed by `lib-crt-effect-wrapper`

## Key Conventions

- **Design tokens over hardcoded values** — always prefer CSS custom properties (`var(--spacing-md)`, `var(--font-size-lg)`) for consistency and theme support across light/dark modes
- **No `::ng-deep`** — deprecated and breaks component encapsulation; use global styles in `styles.scss` or utility classes instead
- **No raw pixel `@media` queries** — always use the shared breakpoint mixins from `_mixins.scss`
- **Document new styles here** — this guide must be updated whenever new global styles, utility classes, or Material customizations are added

## Related Skills

- **`component-library`** — shared Angular UI components that consume these tokens, utility classes, and mixins
