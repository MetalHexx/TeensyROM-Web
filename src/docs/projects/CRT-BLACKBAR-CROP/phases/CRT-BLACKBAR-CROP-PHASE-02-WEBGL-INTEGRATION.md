# Phase 2: WebGL Crop Integration

## 🎯 Objective

Integrate crop functionality into the existing WebGL CRT renderer pipeline using UV coordinate manipulation. This phase extends the shader system to accept crop rectangles and apply them before scanline/vignette effects, ensuring clean integration without resampling artifacts.

---

## 📚 Required Reading

- [ ] [Feature Master Plan](../CRT-BLACKBAR-CROP-MASTER-PLAN.md)
- [ ] [Phase 1 Report](../reports/) - Detector implementation outcomes
- [ ] [WebGL Renderer Source](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-effect-wrapper/webgl/
├── crt-renderer.ts                          📝 Modified - Add crop uniforms and UV offset logic
├── crt-renderer.spec.ts                     📝 Modified - Test crop application
└── shaders/
    └── passthrough.vert.ts                  📝 Modified - Add UV crop offset/scale

```

---

## High-Level Tasks

1. **Extend Vertex Shader**: Add `u_cropOffset` and `u_cropScale` uniforms, apply to UV coordinates
2. **Renderer API Extension**: Add crop rect parameter to `updateSettings()`, calculate UV offset/scale, bind uniforms
3. **Aspect Ratio Preservation**: Ensure crop maintains correct aspect when `contentAspectRatio` is set
4. **Integration Tests**: Verify crop applied correctly, downstream effects unaffected

---

## ✅ Success Criteria

- [ ] Crop rect applied via UV coordinates (no resampling)
- [ ] Renderer accepts `CropRect` in settings
- [ ] Existing effects (scanlines, vignette, curvature) work correctly with crop
- [ ] Integration tests pass

</details>
