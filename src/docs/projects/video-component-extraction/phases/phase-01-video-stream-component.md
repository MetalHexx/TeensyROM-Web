# Phase 1: Core Video Stream Component

## 🎯 Objective

Create the foundational `lib-video-stream` component that encapsulates the HTML5 video element and stream attachment logic. This component is completely "dumb"—it accepts a `MediaStream` input and displays it, with no knowledge of device enumeration, stores, or business logic.

---

## 📚 Required Reading

- [ ] [Master Plan](../master-plan.md) - Overall architecture and decisions
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Existing patterns to follow

---

## 📂 File Structure

```
libs/ui/components/src/lib/
├── video-stream/                            ✨ New folder
│   ├── video-stream.component.ts            ✨ New
│   ├── video-stream.component.html          ✨ New
│   ├── video-stream.component.scss          ✨ New
│   └── video-stream.component.spec.ts       ✨ New

libs/ui/components/src/index.ts              📝 Add export
```

---

<details open>
<summary><h3>Task 1: Create Component Structure</h3></summary>

**Purpose**: Set up component files following existing UI component conventions.

- [ ] Create component folder and files
- [ ] Define inputs: `stream` (MediaStream), `objectFit`, `showLoadingState`
- [ ] Define outputs: `streamReady`, `streamError`
- [ ] Export from barrel file

</details>

<details open>
<summary><h3>Task 2: Implement Stream Binding</h3></summary>

**Purpose**: Reactive stream attachment with proper lifecycle management.

- [ ] Attach stream to video element on input change
- [ ] Cleanup on stream change and component destroy
- [ ] Handle video play with error handling
- [ ] **Test**: Stream attach/detach, null handling

</details>

<details open>
<summary><h3>Task 3: Loading State and Events</h3></summary>

**Purpose**: Optional loading indicator and parent notification events.

- [ ] Track internal playing state from video events
- [ ] Show/hide loading overlay based on state
- [ ] Emit events at appropriate times
- [ ] **Test**: Loading visibility, event timing

</details>

<details open>
<summary><h3>Task 4: Styling and Documentation</h3></summary>

**Purpose**: Style component and document for reuse.

- [ ] Style video to fill container with object-fit support
- [ ] Add fade-in animation matching existing patterns
- [ ] Update COMPONENT_LIBRARY.md

</details>

---

## ✅ Success Criteria

- [ ] Accepts MediaStream and displays video
- [ ] Stream lifecycle managed correctly
- [ ] No store dependencies (pure presentation)
- [ ] All tests pass, lint passes
- [ ] Documentation updated

---

**Estimated Size**: Small (4 files) | **Dependencies**: None
