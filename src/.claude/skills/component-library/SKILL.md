---
name: component-library
description: 'Workflow for discovering and using the shared Angular UI components for TeensyROM (cards, animated containers, feedback, forms, links, modals, menus, lists, icons, video/CRT, display, navigation, utilities). Use when asked to add a new shared UI component, use or compose existing components like CardLayoutComponent, ScalingCardComponent, IconButtonComponent, IconLabelComponent, StyledIconComponent, StorageItemComponent, DropdownMenuComponent, InputFieldComponent, ExternalLinkComponent, ActionLinkComponent, or understand component architecture, animation chaining, glassy effects, or import patterns from `@teensyrom-nx/ui/components`.'
---

# Component Library Skill

Workflow for working with the shared UI library at `libs/ui/components/src/lib/`. There is no catalog file to read here — the component index and per-component documentation are generated from source (JSDoc and Storybook `*.stories.ts` narrative) and served by the `component-docs` CLI, so they cannot drift from the code.

## The Four Moves

1. **Reach for the library first.** Before building any new UI, check whether a shared component already covers the need:

   ```
   pnpm component-docs list --search <term>
   pnpm component-docs get --component-name <name>
   ```

2. **Build new shared components in Storybook.** A new shared component ships with a `*.stories.ts` file from the start, so Storybook — and the generated index — stay current by construction rather than by cleanup.

3. **Document what you build.** Creating or changing a shared component means updating its JSDoc and its story narrative (`parameters.docs.description.component`, `argTypes` descriptions) in the same change. Because the index is generated from source, there is no third artifact to keep in sync.

4. **Run Storybook when a visual check is needed.** `pnpm nx run ui-components:storybook` serves on port 4400. Reach for it when you need to see rendered states or interact with controls; reach for the CLI instead when you just need a component's selector, inputs, outputs, or usage prose — it's faster and works headless.

## The CLI Surface

```
pnpm component-docs list [--search <term>] [--json]
pnpm component-docs get --component-name <name> [--json]
pnpm component-docs coverage [--min <pct>]
# exit 0 success · 1 unknown name or below threshold · 2 the CLI could not run
```

`--help` on any subcommand is self-describing — it is not necessary to remember this surface exactly.

Cross-cutting systems that have no single component to live in (animation chaining, CRT effects) are documented the same way: as docs-only story files under `libs/ui/components/src/lib/systems/`, discovered and listed by the same CLI alongside components.

## Related Skills

- **`style-guide`** — design tokens, breakpoints, utility classes, and Material customizations these components consume
- **`crt-webgl-effects`** — the CRT/WebGL effects system in depth, including how to add a new shader effect
