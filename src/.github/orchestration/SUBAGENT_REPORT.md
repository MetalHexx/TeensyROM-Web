# Subagent Task Completion Report

> **⚠️ NAMING CONVENTION**: See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for complete naming rules and file locations.
> - Task ID Pattern: `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>` (e.g., `USER-AUTH-TASK-01-001-DOMAIN-MODELS`)
> - Report File Pattern: `<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md` (e.g., `USER-AUTH-TASK-01-001-REPORT.md`)

## 📋 Report Metadata

**Task ID**: [Copy from INPUT_DOC]  
**Task Name**: [Copy from INPUT_DOC]  
**Completed By**: [Worker agent identifier]  
**Date**: [ISO date] | **Duration**: [Approximate time]  
**Report File**: [Path to this report]

---

## ✅ Completion Status

**Status**: [COMPLETE | PARTIAL | BLOCKED] | **Completion**: [0-100%]

**Success Criteria**:
- [ ] [Criterion 1 from INPUT_DOC] - [PASS/FAIL/PARTIAL]
- [ ] [Criterion 2 from INPUT_DOC] - [PASS/FAIL/PARTIAL]
- [ ] [All tests pass] - [PASS/FAIL/PARTIAL]

---

## 🎯 What Was Accomplished

### Summary
[2-3 sentence summary of what was built/implemented/fixed]

### Key Deliverables
1. **[Deliverable 1]**: [Brief description]
2. **[Deliverable 2]**: [Brief description]
3. **[Deliverable 3]**: [Brief description]

---

## 📁 Files Changed

### Created
```
✨ path/to/new-file.ts - [Purpose] | Exports: [Main exports]
✨ path/to/new-test.spec.ts - [Test purpose] | Coverage: [Unit/Integration/E2E]
```

### Modified
```
📝 path/to/existing-file.ts
   Changes: [What changed]
   Impact: [Affected code]
```

### Reviewed
```
👀 path/to/reviewed-file.ts - [How it informed work]
```

---

## 🧪 Testing Results

**Framework**: [Jest/Vitest/etc.] | **Tests**: [Total] | **Passed**: [#] | **Failed**: [#] | **Coverage**: [%]

### Test Summary
```
✅ [Test suite name]
   ✅ [Test case] - PASS
   ❌ [Test case] - FAIL: [Explanation if applicable]
```

**Failed Tests** (if any):
- **[Test name]**: [Reason] | **Blocker**: [Yes/No] | **Action**: [What's needed]

---

## 🔍 Key Decisions & Insights

### Technical Decision: [Title]
**Context**: [What required decision]  
**Decision**: [Chosen approach] over [Alternative]  
**Rationale**: [Why this was best]  
**Impact**: [Effect on codebase]

### Notable Discoveries
- **[Discovery]**: [What was found and implications]
- **[Pattern Insight]**: [Understanding gained about architecture]
- **[Improvement Opportunity]**: [Future enhancement identified]

---

## 🚧 Challenges & Blockers

### Challenges Overcome
**[Challenge Title]**: [Issue] → [Solution] → [Lesson learned]

### Active Blockers (if any)
**[Blocker]** - **SEVERITY**: [High/Med/Low]  
- **Issue**: [Description]  
- **Impact**: [Effect on completion]  
- **Needs**: [Requirements to unblock]

### Questions for Orchestrator
1. [Specific question requiring clarification/decision]

---

## 📊 Standards & Integration

### Standards Compliance
- ✅ [Coding Standards](../../docs/CODING_STANDARDS.md) - Followed
- ✅ [Testing Standards](../../docs/TESTING_STANDARDS.md) - Applied
- ✅ [Standards from INPUT_DOC] - Adhered to

**Deviations** (if any): [What/Why/Approval/Risk]

### Integration Points
**Key Interfaces**:
```typescript
interface ExampleInterface {
  property: Type;
  method(): ReturnType;
}
```

**Public API Changes**:
- `ExportName` - [Description and usage]

**Dependencies**:
- `@package/name@x.y.z` - [Purpose]

---

## 🔄 Impact Analysis

**Direct Impact**: [Files requiring updates]  
**Indirect Impact**: [Files that should be aware]  
**Breaking Changes**: [Description, reason, migration path]

---

## 📝 Documentation

**Created**: [path/to/doc.md] - [What it documents]  
**Modified**: [path/to/doc.md] - [What changed]  
**Needed**: [What still needs documentation]

---

## ✨ Next Steps

### Immediate Tasks
1. **[Task]** - **PRIORITY**: [High/Med/Low]
   - **Description**: [What to do]
   - **Depends On**: This task
   - **Size**: [Small/Med/Large]

### Future Considerations
- **[Item]**: [Description] | **Value**: [Benefit] | **Effort**: [Estimate]

### Refactoring Opportunities
- **[Item]**: [Current → Desired state] | **Benefit**: [Why worth doing]

---

## 🏁 Summary for Orchestrator

**TL;DR**: [1-2 sentence summary]

**Ready for Next Phase**: [Yes/No] - [Reason]

**Recommended Next**: [Task ID] - [Task Name] - [Rationale]

**Context to Pass Forward**:  
[Key decisions, gotchas, and lessons for next agent]

---

## ✍️ Sign-off

**Agent**: [Identifier] | **Confidence**: [High/Med/Low] | **Timestamp**: [ISO] | **Version**: 1.0

---

## 📋 Pre-Submit Checklist

- [ ] All sections complete
- [ ] Files accurately listed
- [ ] Tests documented
- [ ] Blockers identified
- [ ] Decisions explained
- [ ] Next steps actionable
- [ ] Success criteria addressed
- [ ] Saved to OUTPUT_DOC path

**Report Complete** ✅ | **Return Path**: [This file path]
