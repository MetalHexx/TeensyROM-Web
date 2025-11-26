# Subagent Task Completion Report

## 📋 Report Metadata

**Task ID**: [Copy from INPUT_DOC]  
**Task Name**: [Copy from INPUT_DOC]  
**Completed By**: [Worker agent identifier]  
**Date Completed**: [ISO date]  
**Execution Time**: [Approximate time spent]  
**Report File**: [Path to this report file]  

---

## ✅ Completion Status

**Overall Status**: [COMPLETE | PARTIAL | BLOCKED]

**Success Criteria Met**:
- [ ] Criterion 1 from INPUT_DOC - [PASS/FAIL/PARTIAL]
- [ ] Criterion 2 from INPUT_DOC - [PASS/FAIL/PARTIAL]
- [ ] All tests pass - [PASS/FAIL/PARTIAL]
- [ ] [Additional criteria from INPUT_DOC]

**Completion Percentage**: [0-100%]

---

## 🎯 What Was Accomplished

### Summary
[2-3 sentence summary of what was built/implemented/fixed]

### Detailed Implementation

#### Objective Achievement
[Describe how the task objective was met. Reference the "What" and "Why" from INPUT_DOC]

#### Key Deliverables
1. **[Deliverable 1 Name]**: [Brief description]
2. **[Deliverable 2 Name]**: [Brief description]
3. **[Deliverable 3 Name]**: [Brief description]

---

## 📁 Files Changed

### Files Created

#### New Implementation Files
```
✨ path/to/new-file.ts
   Purpose: [What this file does]
   Key exports: [Main classes/functions/interfaces]
   Dependencies: [What it depends on]

✨ path/to/another-file.ts
   Purpose: [What this file does]
   Key exports: [Main classes/functions/interfaces]
   Dependencies: [What it depends on]
```

#### New Test Files
```
✨ path/to/new-file.spec.ts
   Purpose: Tests for [what]
   Coverage: [Unit/Integration/E2E]
   Test count: [Number of test cases]

✨ path/to/another-file.spec.ts
   Purpose: Tests for [what]
   Coverage: [Unit/Integration/E2E]
   Test count: [Number of test cases]
```

### Files Modified

```
📝 path/to/existing-file.ts
   Changes: [Brief description of what changed]
   Reason: [Why these changes were necessary]
   Impact: [What other code might be affected]

📝 path/to/another-existing-file.ts
   Changes: [Brief description of what changed]
   Reason: [Why these changes were necessary]
   Impact: [What other code might be affected]
```

### Files Reviewed (for context only)
```
👀 path/to/reviewed-file.ts - [How it informed your work]
👀 path/to/another-reviewed-file.ts - [How it informed your work]
```

---

## 🧪 Testing Results

### Test Execution Summary

**Test Framework**: [Jest/Vitest/Cypress/etc.]  
**Total Tests**: [Number]  
**Passed**: [Number]  
**Failed**: [Number]  
**Skipped**: [Number]  
**Coverage**: [Percentage if available]

### Test Categories

#### Unit Tests
```
✅ [Test suite name]
   ✅ [Test case 1 description] - PASS
   ✅ [Test case 2 description] - PASS
   ✅ [Test case 3 description] - PASS

✅ [Another test suite name]
   ✅ [Test case 1 description] - PASS
   ❌ [Test case 2 description] - FAIL [if applicable, with explanation]
```

#### Integration Tests
```
✅ [Integration test suite name]
   ✅ [Test scenario 1] - PASS
   ✅ [Test scenario 2] - PASS
```

#### E2E Tests (if applicable)
```
✅ [E2E test suite name]
   ✅ [User flow 1] - PASS
   ✅ [User flow 2] - PASS
```

### Test Failures (if any)

**Failed Test**: [Test name]  
**Reason**: [Why it failed]  
**Action Needed**: [What needs to be done to fix]  
**Blocker**: [Yes/No - does this prevent task completion?]

---

## 🔍 Technical Decisions Made

### Decision 1: [Decision Title]
**Context**: [What situation required a decision]  
**Options Considered**: 
- Option A: [Brief description]
- Option B: [Brief description]

**Decision**: [Which option was chosen]  
**Rationale**: [Why this option was best]  
**Trade-offs**: [What was gained/lost with this choice]  
**Impact**: [How this affects the codebase]

### Decision 2: [Decision Title]
[Same structure as above]

---

## 💡 Discoveries & Insights

### Code Discoveries
- **[Discovery 1]**: [What was found in the codebase that was unexpected or noteworthy]
- **[Discovery 2]**: [What was found that affected implementation approach]

### Pattern Insights
- **[Insight 1]**: [Understanding gained about existing patterns or architecture]
- **[Insight 2]**: [Useful pattern that could be applied elsewhere]

### Performance Considerations
- **[Consideration 1]**: [Any performance implications of the implementation]
- **[Consideration 2]**: [Optimization opportunities noted]

### Potential Improvements
- **[Improvement 1]**: [Ideas for future refactoring or enhancement]
- **[Improvement 2]**: [Technical debt noted that could be addressed later]

---

## 🚧 Challenges & Blockers

### Challenges Overcome
1. **[Challenge 1 Title]**
   - **Issue**: [What the challenge was]
   - **Solution**: [How it was resolved]
   - **Lesson**: [What was learned]

2. **[Challenge 2 Title]**
   - **Issue**: [What the challenge was]
   - **Solution**: [How it was resolved]
   - **Lesson**: [What was learned]

### Active Blockers (if any)
1. **[Blocker 1 Title]** - **SEVERITY**: [High/Medium/Low]
   - **Issue**: [Detailed description]
   - **Impact**: [How this affects completion]
   - **Needs**: [What is needed to unblock]
   - **Workaround**: [Temporary solution if any]

2. **[Blocker 2 Title]** - **SEVERITY**: [High/Medium/Low]
   - [Same structure as above]

### Questions for Orchestrator
1. **[Question 1]**: [Specific question that needs clarification]
2. **[Question 2]**: [Specific question that needs decision]

---

## 📊 Standards Compliance

### Standards Followed
- ✅ [Coding Standards](./CODING_STANDARDS.md) - All code follows project conventions
- ✅ [Testing Standards](./TESTING_STANDARDS.md) - Behavioral testing approach used
- ✅ [State Standards](./STATE_STANDARDS.md) - Store patterns correctly implemented
- ✅ [Style Guide](./STYLE_GUIDE.md) - UI components follow style guidelines
- ✅ [Additional standards from INPUT_DOC]

### Standards Deviations (if any)
**Deviation**: [What standard was deviated from]  
**Reason**: [Why deviation was necessary]  
**Approval**: [Who approved or needs to approve]  
**Risk**: [What risk this introduces]

---

## 🔗 Integration Points

### Interfaces Created/Modified
```typescript
// List key interfaces that other code will depend on
interface ExampleInterface {
  // Only show structure, not full implementation
  propertyName: Type;
  methodName(): ReturnType;
}
```

### Public API Surface
**Exports Added**:
- `ClassName` - [Brief description and usage]
- `functionName` - [Brief description and usage]
- `CONSTANT_NAME` - [Brief description and usage]

**Exports Modified**:
- `ExistingClass` - [What changed in the public API]

### Dependencies Required
**New Dependencies Introduced**:
- `@package/name` version `x.y.z` - [Why it was added]

**Existing Dependencies Used**:
- `@existing/package` - [How it's used in this implementation]

---

## 🔄 Impact Analysis

### Potential Impact on Other Code

**Direct Impact** (code that will break without updates):
- `path/to/affected-file.ts` - [What needs to change and why]
- `path/to/another-affected-file.ts` - [What needs to change and why]

**Indirect Impact** (code that should be aware of changes):
- `path/to/related-file.ts` - [How it might want to use new features]
- `path/to/another-related-file.ts` - [How it might want to use new features]

**No Impact** (confirmed safe):
- [Area of codebase] - [Why it's not affected]

### Breaking Changes
**Breaking Change**: [Description]  
**Reason**: [Why it was necessary]  
**Migration Path**: [How to update dependent code]  
**Affected Code**: [What needs to change]

---

## 📝 Documentation Updates

### Documentation Created
- `path/to/new-doc.md` - [What it documents]

### Documentation Modified
- `path/to/existing-doc.md` - [What was updated]

### Documentation Needed (future work)
- [Type of documentation] - [What needs to be documented and why]

---

## ✨ Next Steps Recommendations

### Immediate Next Tasks
1. **[Task Title]** - **PRIORITY**: [High/Medium/Low]
   - **Description**: [What should be done next]
   - **Depends On**: This task (TASK-XXX)
   - **Estimated Size**: [Small/Medium/Large]
   - **Rationale**: [Why this should be next]

2. **[Task Title]** - **PRIORITY**: [High/Medium/Low]
   - [Same structure as above]

### Future Considerations
1. **[Future Work Item]**
   - **Description**: [What could be done later]
   - **Value**: [Why it would be beneficial]
   - **Effort**: [Estimated effort]

2. **[Future Work Item]**
   - [Same structure as above]

### Refactoring Opportunities
1. **[Refactoring Item]**
   - **Current State**: [What exists now]
   - **Desired State**: [How it could be improved]
   - **Benefit**: [Why it's worth doing]
   - **Risk**: [What could go wrong]

---

## 🎯 Value Delivered

### User-Facing Value
- [How users will benefit from this work]
- [What user problem is solved]
- [What user experience is improved]

### Technical Value
- [What technical capability was added]
- [What technical debt was reduced]
- [What foundation was laid for future work]

### Quality Improvements
- [Test coverage improvements]
- [Code quality improvements]
- [Maintainability improvements]

---

## 📎 Attachments & References

### Related Reports
- [Link to or inline previous subagent reports that informed this work]

### Reference Materials Used
- [Documentation that was particularly helpful]
- [Examples that were followed]
- [External resources that were consulted]

### Code Examples
[Only if absolutely necessary - link to actual code rather than duplicating]

---

## 🏁 Summary for Orchestrator

### TL;DR
[1-2 sentence summary of what was accomplished and current state]

### Ready for Next Phase
**Yes/No**: [Is this task complete enough to move forward?]

**Reason**: [Why or why not]

### Recommended Next Task
**Task ID**: [Suggest next task ID]  
**Task Name**: [Suggest descriptive name]  
**Rationale**: [Why this should be next based on your work]

### Context to Pass Forward
[Key information that the next subagent should know]
[Decisions made that affect downstream work]
[Gotchas or lessons learned that will help the next agent]

---

## ✍️ Sign-off

**Worker Agent**: [Your identifier]  
**Confidence Level**: [High/Medium/Low - how confident are you in the completion]  
**Timestamp**: [ISO timestamp]  
**Report Version**: 1.0

---

## 📋 Checklist Before Submitting

Before returning this report to the orchestrator, verify:

- [ ] All sections are filled out completely
- [ ] File lists are accurate and complete
- [ ] Test results are documented with actual numbers
- [ ] All blockers are clearly identified
- [ ] Technical decisions are explained with rationale
- [ ] Next steps recommendations are specific and actionable
- [ ] Success criteria from INPUT_DOC are addressed
- [ ] Report is saved to OUTPUT_DOC path specified in handoff
- [ ] Report file path is ready to return to orchestrator

---

**Report Complete** ✅
**Return to Orchestrator**: [Path to this report file]
