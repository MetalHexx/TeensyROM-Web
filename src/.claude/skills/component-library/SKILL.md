---
name: component-library
description: 'Catalog of shared Angular UI components for TeensyROM (cards, animated containers, feedback, forms, links, modals, menus, lists, icons, video/CRT, display, navigation, utilities). Use when asked to add a new shared UI component, use or compose existing components like CardLayoutComponent, ScalingCardComponent, IconButtonComponent, IconLabelComponent, StyledIconComponent, StorageItemComponent, DropdownMenuComponent, InputFieldComponent, ExternalLinkComponent, ActionLinkComponent, or understand component architecture, animation chaining, glassy effects, or import patterns from `@teensyrom-nx/ui/components`.'
---

# Component Library Skill

Catalog of all shared UI components in `libs/ui/components/src/lib/` for the TeensyROM Angular application.

## When to Use This Skill

- Before adding a new shared UI component — check whether one already exists
- When using an existing shared component and you need its selector, inputs, outputs, or usage examples
- Understanding component architecture, composition patterns, or the animation chaining system
- Fixing import errors or wiring up `@teensyrom-nx/ui/components` exports

## Catalog Overview

See [references/COMPONENT_LIBRARY.md](references/COMPONENT_LIBRARY.md) for the full catalog, organized by category:

- **Layout Components** — `CardLayoutComponent`, `CompactCardLayoutComponent`
- **Animated Card Components** — `ScalingCardComponent`, `ScalingCompactCardComponent`
- **Animation Container Components** — `SlidingContainerComponent`, `ScalingContainerComponent`, `FadingContainerComponent`, `LoadingTextComponent`, `LeetTextContainerComponent`
- **Animation System** — DI-based animation chaining via `PARENT_ANIMATION_COMPLETE`
- **Feedback Components** — `EmptyStateMessageComponent`
- **Form Components** — `InputFieldComponent`
- **Link Components** — `LinkComponent`, `ActionLinkComponent`, `ExternalLinkComponent`
- **Modal Components** — `YouTubeDialogComponent`
- **Menu Components** — `DropdownMenuComponent`, `DropdownDialogComponent`, `DropdownMenuItemComponent`
- **List Components** — `StorageItemComponent`, `StorageItemActionsComponent`, `IconButtonComponent`, `ActionButtonComponent`
- **Icon Components** — `JoystickIconComponent`, `ImageIconComponent`, `ThumbnailImageComponent`
- **Video & CRT Components** — see `COMPONENT_LIBRARY_CRT.md` for the full CRT emulation system
- **Display & Label Components** — `CycleImageComponent`, `ScrollingMarqueeComponent`, `StyledIconComponent`, `IconLabelComponent`, `StatusIconLabelComponent`
- **Navigation Components** — `MenuItemComponent`
- **Utilities** — `TooltipDirective`

## Component Architecture

**Design Principles** — all shared components follow these patterns:

1. **Standalone Components** — no NgModule dependencies, import directly into consuming components
2. **Signal-Based Inputs** — use `input()` instead of `@Input()` decorators for type safety
3. **Modern Control Flow** — `@if`, `@for`, `@switch` in templates
4. **Content Projection** — flexible content via `<ng-content>` where appropriate
5. **Material Design Integration** — built on Angular Material with custom styling

**Import Pattern** — all components are exported from the single barrel:

```typescript
import { CardLayoutComponent, IconButtonComponent, IconLabelComponent } from '@teensyrom-nx/ui/components';

@Component({
  imports: [CardLayoutComponent, IconButtonComponent, IconLabelComponent],
})
```

**Testing Support** — every component has comprehensive unit tests using Vitest covering rendering, signal-based inputs, content projection, conditional rendering, and accessibility.

## Related Skills

- **`style-guide`** — design tokens, breakpoints, utility classes, and Material customizations these components consume
