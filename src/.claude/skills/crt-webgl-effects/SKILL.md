---
name: crt-webgl-effects
description: 'CRT (cathode ray tube) emulation and WebGL post-processing effects system for TeensyROM. Use when working with CrtEffectWrapperComponent, CrtSettingsPanelComponent, VideoStreamComponent, or other video/overlay components; when reading or editing CrtSettings/CrtSettingsConfig, CRT_PRESETS, or CSS custom properties; or when adding a brand-new WebGL shader effect (scanlines, vignette, barrel distortion, bloom, chromatic aberration, screen curvature, phosphor patterns, color filters) across the domain model, GLSL fragment shader, CrtRenderer uniforms, and settings-panel UI layers.'
---

# CRT & WebGL Effects Skill

The TeensyROM CRT emulation system recreates the visual experience of vintage monitors using WebGL-based post-processing (scanlines, vignette, phosphor patterns, barrel distortion, bloom, chromatic aberration, color filters) layered with CSS (screen curvature, container styling).

This skill covers two related but distinct concerns:

1. **Using/understanding the CRT component catalog** - the components, their inputs/outputs, configuration interfaces, presets, and composition patterns.
2. **Adding a brand-new WebGL effect** - the step-by-step recipe for wiring a new effect through the domain model, shader, renderer, and settings UI.

## When to Use Each Reference

| Reference | Use when... |
|-----------|--------------|
| [`references/COMPONENT_LIBRARY_CRT.md`](references/COMPONENT_LIBRARY_CRT.md) | Composing UI with `lib-crt-effect-wrapper`, `lib-crt-settings-panel`, `lib-video-stream`, `lib-video-controls-toolbar`, `lib-video-device-selector`, or `lib-content-overlay-container`; looking up `CrtSettings`/`CrtSettingsConfig` fields, presets (`CRT_PRESETS`, `CRT_CONFIGS`), CSS custom properties, or existing visual-effect behavior/algorithms. |
| [`references/HOW_TO_ADD_WEBGL_EFFECT.md`](references/HOW_TO_ADD_WEBGL_EFFECT.md) | Implementing a **new** WebGL effect end-to-end: adding a `CrtSettings` property, writing the GLSL fragment shader function, binding a `CrtRenderer` uniform, and adding a settings-panel slider. Also covers the required test coverage and naming conventions for each layer. |

These two docs are consolidated into one skill because adding a new effect (doc 2) explicitly requires updating the Visual Effects Reference section of the component catalog (doc 1) as its final documentation step.

## Architecture Overview

| Component | Purpose |
|-----------|---------|
| `CrtEffectWrapperComponent` | Applies CRT visual effects to any projected content via WebGL post-processing |
| `CrtSettingsPanelComponent` | UI panel for real-time CRT effect adjustment (sliders driven by config flags) |
| `VideoStreamComponent` | Displays a `MediaStream` in a video element |
| `VideoControlsToolbarComponent` | Vertical toolbar with CRT/settings/device/fullscreen controls |
| `VideoDeviceSelectorComponent` | Dropdown for selecting video capture devices |
| `ContentOverlayContainerComponent` | 9-slot layout container with hover-reveal overlays |

All CRT-related exports come from `@teensyrom-nx/ui/components` (components, `CrtSettings`, `CrtSettingsConfig`, `CRT_PRESETS`, `CRT_PRESET_KEYS`, `CRT_CONFIGS`, `DEFAULT_CRT_SETTINGS`, `DEFAULT_CRT_CONFIG`).

## Adding a New Effect - 4 Layers

1. **Domain Model** - add the property to `CrtSettings` (and `CrtSettingsConfig` if it needs a visibility toggle) in `libs/domain/src/lib/models/crt-settings.model.ts`, plus preset defaults.
2. **WebGL Shader** - declare the uniform and implement the effect function (with a zero-intensity early return) in `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`.
3. **Renderer** - add the uniform location, retrieve it in `setupShaders()`, bind it in `updateSettings()`, and reset it in `destroy()` in `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`.
4. **UI** - add a `SliderConfig` in `crt-slider-configs.ts` and wire it into the settings panel component/template.

See `references/HOW_TO_ADD_WEBGL_EFFECT.md` for the full recipe, test patterns, naming conventions, and two complete reference implementations (barrel distortion, chromatic aberration).

## Critical Rules

- **Zero-intensity optimization is mandatory** in every shader effect function - `if (intensity == 0.0) return color;` (or equivalent) before any per-pixel work.
- **Naming conventions**: domain property `camelCase`; shader uniform `u_camelCase`; shader function `applyCamelCase`; slider config `SCREAMING_SNAKE_CASE`; config flag `showCamelCase`.
- Match `CRT_CONFIGS` between `lib-crt-effect-wrapper` and `lib-crt-settings-panel` so displayed sliders match applied effects.
- Always provide `contentAspectRatio` on `CrtEffectWrapperComponent` for non-native aspect ratio content in fullscreen, so effects don't render on letterbox/pillarbox bars.
