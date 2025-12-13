# Task Handoff: Dialog Component Exports

**Task ID**: CRT-CUSTOM-PRESETS-TASK-02-005-DIALOG-EXPORTS  
**Task Name**: Export Dialog Components from UI Library  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Low  
**Estimated Context Size**: Small (~2 files)

---

## 🎯 Objective

**What**: Add the preset name dialog and confirmation dialog to the UI component library barrel exports, making them easily consumable by feature modules.

**Why**: Proper barrel exports follow Angular and Nx best practices, enabling clean imports like `import { PresetNameDialogComponent } from '@teensyrom-nx/ui/components'` instead of deep path imports.

**Success Criteria**:
- [ ] `PresetNameDialogComponent` exported from `preset-name-dialog/index.ts`
- [ ] `ConfirmationDialogComponent` exported from `confirmation-dialog/index.ts`
- [ ] Both components exported from root `libs/ui/components/src/lib/index.ts`
- [ ] Components can be imported from `@teensyrom-nx/ui/components`
- [ ] No circular dependency warnings
- [ ] Linting passes without errors
- [ ] Build succeeds without errors

---

## 📋 Prerequisites Completed

- ✅ **CRT-CUSTOM-PRESETS-TASK-02-001 through 02-003**: Preset name dialog fully implemented
- ✅ **CRT-CUSTOM-PRESETS-TASK-02-004**: Confirmation dialog fully implemented

---

## 📦 Dependencies

**Nx Library Structure**:
- `libs/ui/components/` - UI component library
- Barrel export pattern for clean imports

**Constraints**:
- Must follow existing barrel export patterns in library
- Must maintain alphabetical ordering in root index.ts
- Must not create circular dependencies
- Must export component class (not re-export Angular modules)

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/preset-name-dialog/index.ts` - Preset name dialog barrel export
- `libs/ui/components/src/lib/confirmation-dialog/index.ts` - Confirmation dialog barrel export

**Files to Modify**:
- `libs/ui/components/src/lib/index.ts` - Root barrel export

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/icon-button/index.ts` - Example barrel export
- `libs/ui/components/src/lib/scaling-compact-card/index.ts` - Example barrel export
- `libs/ui/components/src/lib/index.ts` - Root exports structure

---

## 🔧 Implementation Guidance

### Step 1: Create Component Barrel Exports

**File**: `libs/ui/components/src/lib/preset-name-dialog/index.ts`

```typescript
export * from './preset-name-dialog.component';
```

**File**: `libs/ui/components/src/lib/confirmation-dialog/index.ts`

```typescript
export * from './confirmation-dialog.component';
```

**Pattern Explanation**:
- Use `export *` to re-export all public exports from component file
- Exports component class and any related types/interfaces
- Keeps component folder encapsulated (consumers import from folder, not file)

### Step 2: Add to Root Barrel Export

**File**: `libs/ui/components/src/lib/index.ts`

Find the alphabetical position and add the exports:

```typescript
// ... existing exports ...

export * from './confirmation-dialog'; // After 'crt-effect-wrapper'
// ... other exports ...

export * from './preset-name-dialog'; // After 'icon-label'

// ... remaining exports ...
```

**Alphabetical Ordering**:
- Confirmation dialog comes alphabetically before most components
- Preset name dialog comes after icon-label, before scaling-compact-card (likely)
- Maintain existing ordering pattern in file

**Full Context Example**:

```typescript
// CRT components
export * from './crt-effect-wrapper';

// Dialog components
export * from './confirmation-dialog';

// Icon components
export * from './icon-button';
export * from './icon-label';

// Other components
export * from './preset-name-dialog';
export * from './scaling-compact-card';
// ... etc
```

### Step 3: Verify Import Paths

**Test Import** (in any feature module):

```typescript
import {
  PresetNameDialogComponent,
  ConfirmationDialogComponent,
} from '@teensyrom-nx/ui/components';
```

**Should work after exports**:
- No TypeScript errors
- IntelliSense autocomplete shows components
- Linting passes

---

## 🧪 Testing Requirements

### Verification Steps

**Build Test**:
```bash
pnpm nx build ui-components
```
- [ ] Build succeeds without errors
- [ ] No circular dependency warnings
- [ ] Output bundle includes both components

**Lint Test**:
```bash
pnpm nx lint ui-components
```
- [ ] Linting passes without errors
- [ ] No unused export warnings
- [ ] No import/export violations

**Import Test** (manual):
```typescript
// Create test file: libs/ui/components/src/lib/test-imports.ts
import {
  PresetNameDialogComponent,
  ConfirmationDialogComponent,
} from '@teensyrom-nx/ui/components';

// Verify types are accessible
const _nameDialog: PresetNameDialogComponent = {} as any;
const _confirmDialog: ConfirmationDialogComponent = {} as any;
```
- [ ] File compiles without errors
- [ ] IntelliSense shows component types
- [ ] (Delete test file after verification)

**Circular Dependency Check**:
```bash
pnpm nx graph
```
- [ ] No circular dependency warnings in output
- [ ] Dependency graph shows clean structure

### Testing Reference

- See [Testing Standards](../../../TESTING_STANDARDS.md)
- See [Nx Library Standards](../../../NX_LIBRARY_STANDARDS.md)

---

## 📚 Related Documentation

**Planning Documents**:
- [Phase 2: UI Dialog Components](../phases/CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Standards**:
- [Nx Library Standards](../../../NX_LIBRARY_STANDARDS.md) - Library organization patterns
- [Coding Standards](../../../CODING_STANDARDS.md) - Import/export conventions

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-02-001 through 02-003: Preset name dialog implementation
- CRT-CUSTOM-PRESETS-TASK-02-004: Confirmation dialog implementation
- CRT-CUSTOM-PRESETS-TASK-03-XXX: Settings panel integration (will import these exports)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-005-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 🎯 Anti-Patterns to Avoid

❌ **Don't use default exports** - Use named exports (`export *`)  
❌ **Don't skip alphabetical ordering** - Maintain consistent structure  
❌ **Don't create circular dependencies** - Check dependency graph  
❌ **Don't export implementation details** - Only export public API  
❌ **Don't forget both component barrels** - Need index.ts for each component folder  
❌ **Don't skip verification** - Always test imports after adding exports  

---

## 💡 Implementation Tips

1. **Start with component barrels** - Create index.ts in each component folder first
2. **Then update root barrel** - Add exports to root index.ts
3. **Verify alphabetical order** - Use IDE search to find correct position
4. **Test imports immediately** - Catch issues early
5. **Check dependency graph** - Use `pnpm nx graph` to verify clean structure
6. **Run full build** - Ensure no breaking changes

---

## 📝 Example Import Usage

After completing this task, consumers can import components cleanly:

**Feature Module** (Phase 3):
```typescript
import { Component } from '@angular/core';
import {
  PresetNameDialogComponent,
  ConfirmationDialogComponent,
} from '@teensyrom-nx/ui/components';

@Component({
  selector: 'app-crt-settings-manager',
  standalone: true,
  imports: [
    PresetNameDialogComponent,
    ConfirmationDialogComponent,
  ],
  // ... component definition
})
export class CrtSettingsManagerComponent {
  // Use dialog components in template
}
```

**Clean Import Benefits**:
- ✅ Single import location for all UI components
- ✅ IntelliSense autocomplete works
- ✅ Refactoring safe (IDE can update imports)
- ✅ Follows Angular and Nx best practices

---

## 🔍 Troubleshooting

**Issue**: "Module not found" error after adding exports  
**Solution**: Run `pnpm nx build ui-components` to rebuild library

**Issue**: Circular dependency warning  
**Solution**: Check if components import each other - they shouldn't

**Issue**: TypeScript error on import  
**Solution**: Verify component class is exported from `.component.ts` file

**Issue**: Linting error about unused exports  
**Solution**: Wait for Phase 3 to consume exports, or add linting exception

---

**Ready to implement?** Add barrel exports for both dialog components and verify clean imports. This is a simple but critical task for Phase 3 integration.
