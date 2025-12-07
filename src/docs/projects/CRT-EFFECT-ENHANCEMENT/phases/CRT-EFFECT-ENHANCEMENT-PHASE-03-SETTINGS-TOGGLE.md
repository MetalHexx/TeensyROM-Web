# Phase 3: Render Mode Toggle & Settings Panel

## 🎯 Objective

Add user-facing controls to switch between CSS and WebGL render modes, with intelligent defaults based on device capabilities.

> **⚠️ DEPENDENCY**: This phase requires Phase 2 (WebGL Renderer) to be complete.

---

## 📚 Required Reading

- [ ] [CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md)
- [ ] [Phase 2 Report](../reports/) - WebGL implementation complete
- [ ] [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md)

---

## 📂 File Structure Overview

```
libs/domain/src/lib/models/
└── crt-settings.model.ts                 📝 Modified - Add renderMode property

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.interface.ts             📝 Modified - Add renderMode type
└── crt-settings.defaults.ts              📝 Modified - Add renderMode defaults

libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts       📝 Modified - Add mode toggle
└── crt-settings-panel.component.html     📝 Modified - Add toggle UI
```

---

## 📋 High-Level Tasks

1. **Extend Domain Model** - Add `renderMode: 'css' | 'webgl' | 'auto'` to CrtSettings
2. **Update Settings Interface** - Add type and defaults for renderMode
3. **Add Toggle to Panel** - Dropdown or toggle switch for mode selection
4. **Implement Auto-Detection** - Detect WebGL availability for 'auto' mode
5. **Persist Preference** - Store render mode in settings
6. **Update Documentation** - Document new render mode feature

---

## ✅ Success Criteria

- [ ] Users can toggle between CSS and WebGL modes
- [ ] 'Auto' mode selects best available option
- [ ] Preference persisted across sessions
- [ ] Settings panel clearly indicates current mode
- [ ] Documentation updated

---

## 📝 Notes

**To be detailed after Phase 2 completion.** Task decomposition will be created when this phase begins.

---

## 🔗 Related Tasks

Tasks will be created when this phase begins:

- CRT-EFFECT-ENHANCEMENT-TASK-03-001-DOMAIN-MODEL
- CRT-EFFECT-ENHANCEMENT-TASK-03-002-SETTINGS-TOGGLE
- CRT-EFFECT-ENHANCEMENT-TASK-03-003-AUTO-DETECTION
