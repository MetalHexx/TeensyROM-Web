# Phase 3: CRT Effect Wrapper Orchestration

## 🎯 Objective

Wire the detector and crop stage into the `crt-effect-wrapper` component. This phase manages the detection lifecycle (start/stop/cleanup), feeds video frames to the detector at 2Hz, and applies the resulting crop rect to the WebGL renderer.

---

## 📚 Required Reading

- [ ] [Feature Master Plan](../CRT-BLACKBAR-CROP-MASTER-PLAN.md)
- [ ] [Phase 1 & 2 Reports](../reports/) - Detector and renderer outcomes
- [ ] [CRT Effect Wrapper Source](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts)
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-effect-wrapper.component.ts          📝 Modified - Instantiate detector, manage lifecycle
├── crt-effect-wrapper.component.spec.ts     📝 Modified - Test detection orchestration
└── crt-settings.interface.ts                📝 Modified - Add crop settings to CrtSettings
```

---

## High-Level Tasks

1. **Detection Lifecycle**: Instantiate `BlackbarDetector`, start 2Hz interval when video plays, stop on pause
2. **Frame Capture**: Extract video frames to feed detector without impacting render performance
3. **Crop Application**: Compute `CropRect` from detector or manual value, pass to `CrtRenderer.updateSettings()`
4. **Mode Switching**: Handle Off/Auto/Manual mode transitions cleanly
5. **Smooth Transitions**: Apply EMA smoothing to crop rect changes

---

## ✅ Success Criteria

- [ ] Detector runs at 2Hz when auto mode active
- [ ] Wrapper applies detected crop to renderer
- [ ] Mode switching works without errors
- [ ] CPU overhead <5% during detection
- [ ] Integration tests verify orchestration

</details>
