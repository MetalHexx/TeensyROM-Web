# Phase 4: Settings UI & User Controls

## 🎯 Objective

Add crop mode selector (Off/Auto/Manual), video standard toggle (PAL/NTSC defaulting to PAL), and three manual sliders (Left/Right, Top, Bottom) to the CRT settings panel. Manual controls allow PAL-correct asymmetric crops or creative effects. Wire controls to the application store with proper persistence and form validation.

---

## 📚 Required Reading

- [ ] [Feature Master Plan](../CRT-BLACKBAR-CROP-MASTER-PLAN.md)
- [ ] [Phase 1-3 Reports](../reports/) - Foundation, renderer, wrapper outcomes
- [ ] [CRT Settings Panel Source](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)
- [ ] [State Standards](../../../STATE_STANDARDS.md)
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts          📝 Modified - Add mode dropdown and manual slider
├── crt-settings-panel.component.html        📝 Modified - UI controls template
├── crt-settings-panel.component.scss        📝 Modified - Styles for new controls
├── crt-settings-panel.component.spec.ts     📝 Modified - Test UI interactions

libs/application/crt/
├── crt-store.ts                             📝 Modified - Add crop settings to store
├── crt-store.spec.ts                        📝 Modified - Test store crop behavior
```

---

## High-Level Tasks

1. **UI Controls**: Add mode dropdown (Off/Auto/Manual), video standard toggle (PAL/NTSC), and three manual sliders (Left/Right, Top, Bottom: -30% to +40% each)
2. **Video Standard Indicator**: Visual indicator showing PAL (asymmetric) vs NTSC (symmetric) with tooltip
3. **Conditional Visibility**: Show manual sliders only when Manual mode selected
4. **Slider Layout**: Left/Right slider controls both sides equally (horizontal symmetry), Top/Bottom sliders control vertical crop independently (supports PAL asymmetry)
4. **Store Integration**: Extend CRT store with crop mode, video standard, and manual value
5. **Persistence**: Ensure crop settings persist via existing localStorage mechanism
6. **Help Text**: Add tooltips explaining each mode and video standard differences
7. **Form Validation**: Prevent invalid states

---

## ✅ Success Criteria

- [ ] Mode dropdown integrated into settings panel
- [ ] Video standard toggle (PAL/NTSC) integrated with visual indicator
- [ ] Manual slider appears conditionally
- [ ] Settings persist across sessions
- [ ] Store tests verify crop behavior with PAL/NTSC switching
- [ ] UI tests verify mode and video standard interactions
- [ ] Tooltips explain PAL (asymmetric) vs NTSC (symmetric) differences

</details>
