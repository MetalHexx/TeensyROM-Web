# Task: Renderer Uniform Integration

**Task ID**: BARREL-DISTORTION-TASK-02-002-RENDERER-INTEGRATION  
**Task Name**: Bind Barrel Distortion Uniform in CrtRenderer  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (2 files)  
**Estimated Effort**: 45-60 minutes

---

## 📋 Task Overview

### What

Bind the `u_barrelDistortion` uniform in the CrtRenderer class, retrieve its location after shader compilation, and update the uniform value when CRT settings change. Ensure proper coordination with other geometric effect uniforms (vignette, curvature).

### Why

The shader implementation from Task 1 declares the uniform, but the renderer must bind it with actual values from the settings. Without this integration, the shader will use a default value (likely 0), and user settings won't affect the visual output. This task connects the domain model → renderer → shader pipeline.

### Success Criteria

- [ ] `barrelDistortionUniform` property added to CrtRenderer class
- [ ] Uniform location retrieved in `init()` method after shader compilation
- [ ] `gl.uniform1f()` called in `updateSettings()` to bind barrel distortion value
- [ ] Uniform binding follows existing pattern (consistent with vignette, curvature)
- [ ] Error handling implemented for null uniform location
- [ ] All renderer tests pass with >90% coverage
- [ ] Integration test verifies settings → uniform flow works end-to-end

---

## 🔗 Context & Dependencies

### Prerequisites Completed

- **BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION**: Domain model has `barrelDistortion` property
- **BARREL-DISTORTION-TASK-02-001-SHADER-IMPLEMENTATION**: Shader declares `u_barrelDistortion` uniform

### Dependencies

- **CrtRenderer Class**: `crt-renderer.ts` manages WebGL context and shader uniforms
- **CrtSettings Interface**: `crt-settings.model.ts` defines `barrelDistortion: number` property
- **Existing Uniform Pattern**: `vignetteUniform`, `curvatureUniform` show binding pattern to follow

### Constraints

- **Uniform Binding Order**: Order doesn't matter, but group with geometric effects for clarity
- **Null Checks**: Must handle case where shader doesn't have uniform (defensive programming)
- **Performance**: Uniform updates happen on every settings change; must be efficient
- **WebGL Context**: Uniform binding requires active WebGL context (check before binding)

---

## 📂 File Scope

### Files to Create

None - modifying existing renderer file only.

### Files to Modify

- **`libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`**
  - Add `barrelDistortionUniform` property declaration
  - Retrieve uniform location in `init()` method
  - Bind uniform value in `updateSettings()` method
  - Add null checks for uniform location

- **`libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`**
  - Add tests for uniform location retrieval
  - Test uniform binding in updateSettings()
  - Test null uniform location handling
  - Integration test for settings → uniform flow

### Files to Review (for context)

- **`libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`** - Shader uniform declaration
- **`libs/domain/src/lib/models/crt-settings.model.ts`** - Settings interface with barrelDistortion property
- **Existing uniform bindings** - `vignetteUniform`, `curvatureUniform`, `scanlineIntensityUniform` patterns

---

## 🛠️ Implementation Steps

### Step 1: Add Uniform Location Property

**Location**: CrtRenderer class properties section (group with other uniform locations)

**Action**: Add `private barrelDistortionUniform: WebGLUniformLocation | null = null;`

**Pattern to Follow** (existing code):
```typescript
export class CrtRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  
  // Uniform locations
  private vignetteUniform: WebGLUniformLocation | null = null;
  private curvatureUniform: WebGLUniformLocation | null = null;
  private barrelDistortionUniform: WebGLUniformLocation | null = null; // ADD THIS
  // ... other uniforms
}
```

**Notes**:
- Use `| null` type to handle case where uniform doesn't exist in shader
- Group with geometric effect uniforms (vignette, curvature) for organization
- Use `private` visibility (uniform locations are internal implementation detail)

### Step 2: Retrieve Uniform Location in init()

**Location**: `init()` method, after shader program compilation, with other uniform retrievals

**Action**: Call `gl.getUniformLocation(this.program, 'u_barrelDistortion')`

**Pattern to Follow** (existing code):
```typescript
init(canvas: HTMLCanvasElement): boolean {
  // ... WebGL context setup, shader compilation ...
  
  // Get uniform locations
  this.vignetteUniform = this.gl.getUniformLocation(this.program, 'u_vignetteStrength');
  this.curvatureUniform = this.gl.getUniformLocation(this.program, 'u_screenCurvature');
  this.barrelDistortionUniform = this.gl.getUniformLocation(this.program, 'u_barrelDistortion'); // ADD THIS
  
  // ... rest of init ...
  return true;
}
```

**Notes**:
- Uniform name string must match shader declaration exactly (`'u_barrelDistortion'`)
- `getUniformLocation()` returns `null` if uniform not found (not an error - shader optimizer may remove unused uniforms)
- Retrieve all uniform locations together (one place for maintenance)
- No need to check for null here (checked before binding in updateSettings())

### Step 3: Bind Uniform in updateSettings()

**Location**: `updateSettings()` method, with other uniform bindings

**Action**: Call `gl.uniform1f(this.barrelDistortionUniform, settings.barrelDistortion)` with null check

**Pattern to Follow** (existing code):
```typescript
updateSettings(settings: CrtSettings): void {
  if (!this.gl || !this.program) return;
  
  this.gl.useProgram(this.program);
  
  // Bind geometric effect uniforms
  if (this.vignetteUniform) {
    this.gl.uniform1f(this.vignetteUniform, settings.vignetteStrength);
  }
  
  if (this.curvatureUniform) {
    this.gl.uniform1f(this.curvatureUniform, settings.screenCurvature);
  }
  
  if (this.barrelDistortionUniform) { // ADD THIS
    this.gl.uniform1f(this.barrelDistortionUniform, settings.barrelDistortion);
  }
  
  // ... other uniform bindings ...
}
```

**Implementation Requirements**:
1. **Null Check**: Only bind if `this.barrelDistortionUniform` is not null
2. **Type Safety**: Use `settings.barrelDistortion` (TypeScript ensures property exists)
3. **Correct Method**: Use `uniform1f()` for single float value (not `uniform1fv()` or other variants)
4. **Group Logically**: Place with other geometric effect uniform bindings (vignette, curvature)

**Why Null Check**: Shader optimizer may remove uniform if:
- Uniform is declared but never used in shader
- Shader compilation optimizes away dead code
- Shader variant doesn't include distortion effect

### Step 4: Handle WebGL Context Validation

**Location**: Top of `updateSettings()` method

**Action**: Verify this guard already exists (should be in existing code)

**Required Guard**:
```typescript
updateSettings(settings: CrtSettings): void {
  if (!this.gl || !this.program) {
    console.warn('Cannot update settings: WebGL context or program not initialized');
    return;
  }
  
  this.gl.useProgram(this.program); // Ensure program is active before binding uniforms
  
  // ... uniform bindings ...
}
```

**Notes**:
- This guard should already exist in current renderer code
- Prevents crashes if updateSettings() called before init()
- `useProgram()` activates shader program (required before binding uniforms)

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests** (renderer uniform binding):

- [ ] **Uniform Location Retrieval**: `init()` successfully retrieves `barrelDistortionUniform` location
- [ ] **Uniform Binding**: `updateSettings()` calls `gl.uniform1f()` with correct value
- [ ] **Null Uniform Handling**: Renderer doesn't crash when uniform location is null
- [ ] **Settings Update Flow**: Changing `barrelDistortion` property triggers uniform update
- [ ] **WebGL Context Guard**: `updateSettings()` returns early if WebGL context not initialized

**Behavioral Test Suite**:

```typescript
describe('CrtRenderer - Barrel Distortion Uniform', () => {
  let renderer: CrtRenderer;
  let mockGl: jasmine.SpyObj<WebGLRenderingContext>;
  let mockProgram: WebGLProgram;

  beforeEach(() => {
    renderer = new CrtRenderer();
    mockGl = jasmine.createSpyObj('WebGLRenderingContext', [
      'getUniformLocation',
      'uniform1f',
      'useProgram'
    ]);
    mockProgram = {} as WebGLProgram;
    
    // Inject mocks (implementation-specific)
    renderer['gl'] = mockGl;
    renderer['program'] = mockProgram;
  });

  it('should retrieve barrelDistortion uniform location in init()', () => {
    const mockLocation = {} as WebGLUniformLocation;
    mockGl.getUniformLocation.and.returnValue(mockLocation);
    
    renderer.init(document.createElement('canvas'));
    
    expect(mockGl.getUniformLocation).toHaveBeenCalledWith(mockProgram, 'u_barrelDistortion');
    expect(renderer['barrelDistortionUniform']).toBe(mockLocation);
  });

  it('should bind barrelDistortion uniform in updateSettings()', () => {
    const mockLocation = {} as WebGLUniformLocation;
    renderer['barrelDistortionUniform'] = mockLocation;
    
    const settings: CrtSettings = {
      barrelDistortion: 0.25,
      // ... other settings ...
    };
    
    renderer.updateSettings(settings);
    
    expect(mockGl.uniform1f).toHaveBeenCalledWith(mockLocation, 0.25);
  });

  it('should handle null uniform location gracefully', () => {
    renderer['barrelDistortionUniform'] = null;
    
    const settings: CrtSettings = {
      barrelDistortion: 0.15,
      // ... other settings ...
    };
    
    expect(() => renderer.updateSettings(settings)).not.toThrow();
    expect(mockGl.uniform1f).not.toHaveBeenCalled();
  });

  it('should update uniform when barrelDistortion setting changes', () => {
    const mockLocation = {} as WebGLUniformLocation;
    renderer['barrelDistortionUniform'] = mockLocation;
    
    const settings1: CrtSettings = { barrelDistortion: 0.1, /* ... */ };
    const settings2: CrtSettings = { barrelDistortion: 0.3, /* ... */ };
    
    renderer.updateSettings(settings1);
    expect(mockGl.uniform1f).toHaveBeenCalledWith(mockLocation, 0.1);
    
    renderer.updateSettings(settings2);
    expect(mockGl.uniform1f).toHaveBeenCalledWith(mockLocation, 0.3);
  });
});
```

**Integration Test**:

```typescript
describe('CrtRenderer - Barrel Distortion Integration', () => {
  it('should flow settings through renderer to shader uniform', () => {
    const renderer = new CrtRenderer();
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    
    // Initialize renderer with real WebGL context
    renderer.init(canvas);
    
    // Spy on gl.uniform1f to track uniform bindings
    spyOn(gl, 'uniform1f');
    
    // Update settings with barrel distortion value
    const settings: CrtSettings = {
      barrelDistortion: 0.2,
      screenCurvature: 0.15,
      // ... other settings ...
    };
    
    renderer.updateSettings(settings);
    
    // Verify uniform was bound with correct value
    expect(gl.uniform1f).toHaveBeenCalledWith(
      jasmine.any(WebGLUniformLocation),
      0.2
    );
  });
});
```

**Testing Notes**:
- Mock WebGL context for unit tests (avoid browser dependencies)
- Use real WebGL context for integration tests (verify actual WebGL behavior)
- Test both happy path (uniform exists) and edge case (uniform is null)
- Verify uniform binding happens after `useProgram()` call

---

## 📚 Standards to Follow

- **[Coding Standards](../../../CODING_STANDARDS.md)** - TypeScript/WebGL conventions
- **[Testing Standards](../../../TESTING_STANDARDS.md)** - Behavioral testing approaches
- **[Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)** - CRT effect system architecture

### WebGL Renderer Standards

1. **Uniform Location Storage**: Store as class properties (typed `WebGLUniformLocation | null`)
2. **Uniform Retrieval**: Get all locations in `init()` after shader compilation
3. **Uniform Binding**: Check for null before calling `gl.uniform*()` methods
4. **Error Handling**: Log warnings for missing uniforms (not errors - shader optimization is valid)
5. **Method Grouping**: Group related uniforms in `updateSettings()` (geometric, color, texture, etc.)
6. **Program Activation**: Always call `useProgram()` before binding uniforms

---

## ⚠️ Anti-Patterns to Avoid

- ❌ **Missing Null Checks**: Calling `gl.uniform1f(null, value)` crashes (check uniform location first)
- ❌ **Retrieving in Wrong Place**: Don't get uniform location in `updateSettings()` (retrieve once in `init()`)
- ❌ **Wrong Uniform Method**: Use `uniform1f()` for single float, not `uniform1fv()` or `uniform2f()`
- ❌ **Forgetting useProgram()**: Uniforms must be bound after `gl.useProgram(this.program)` call
- ❌ **Throwing on Missing Uniform**: Null uniform location is not an error (shader optimizer may remove it)
- ❌ **Inconsistent Naming**: Uniform name string must match shader exactly (case-sensitive)

---

## 🎯 Acceptance Criteria

Before marking this task complete, verify:

1. ✅ **Uniform Property Added**: `barrelDistortionUniform` declared in CrtRenderer class
2. ✅ **Location Retrieved**: `init()` calls `getUniformLocation('u_barrelDistortion')`
3. ✅ **Uniform Bound**: `updateSettings()` calls `uniform1f()` with `settings.barrelDistortion`
4. ✅ **Null Checks Present**: Uniform binding guarded by null check
5. ✅ **Pattern Consistency**: Implementation follows existing uniform pattern (vignette, curvature)
6. ✅ **All Tests Pass**: Unit and integration tests pass with >90% coverage
7. ✅ **Visual Validation**: Changing barrel distortion slider updates visual effect in real-time
8. ✅ **Code Review**: Code follows renderer standards and WebGL best practices

---

## 📖 Related Documentation

### Planning Documents

- **[Master Plan](../BARREL-DISTORTION-MASTER-PLAN.md)** - Complete project overview
- **[Phase 2 Plan](../phases/BARREL-DISTORTION-PHASE-02-WEBGL-SHADER.md)** - This phase's detailed plan
- **[Task 1 Report](../reports/BARREL-DISTORTION-TASK-02-001-REPORT.md)** - Shader implementation results (prerequisite)

### Technical References

- **[CRT Renderer](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)** - Existing renderer implementation
- **[Fragment Shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts)** - Uniform declaration
- **[CrtSettings Model](../../../../libs/domain/src/lib/models/crt-settings.model.ts)** - Settings interface

### Related Tasks

- **BARREL-DISTORTION-TASK-02-001-SHADER-IMPLEMENTATION**: Implemented shader uniform (completed before this task)
- **BARREL-DISTORTION-TASK-03-001-SETTINGS-PANEL-UI**: Will add UI slider for barrel distortion (executes in Phase 3)

---

## 💡 Implementation Hints

### Debugging Uniform Binding Issues

1. **Check Uniform Name**: Verify string matches shader declaration exactly (`'u_barrelDistortion'`)
2. **Console Logging**: Log uniform location to verify it's not null: `console.log('Barrel distortion uniform:', this.barrelDistortionUniform);`
3. **WebGL Inspector**: Use browser extensions like Spector.js to inspect WebGL state and uniform values
4. **Shader Compilation**: Ensure shader from Task 1 compiles without errors (check console for WebGL errors)

### Testing WebGL Code

- **Mock Strategy**: Use Jasmine/Vitest spies for WebGL context methods
- **Real Context**: Create real WebGL context for integration tests (validates actual WebGL behavior)
- **Uniform Validation**: Spy on `uniform1f()` to verify correct values passed
- **Error Simulation**: Test with null program/context to verify error handling

### Common WebGL Uniform Pitfalls

- **Timing**: Uniforms must be bound after `useProgram()` and before `drawArrays()`
- **Type Mismatch**: `uniform1f()` for float, `uniform2f()` for vec2, `uniform3f()` for vec3, etc.
- **Null Returns**: `getUniformLocation()` returns null if uniform not found (not an error)
- **Active Program**: Wrong program active when binding uniforms causes silent failure

---

## 📊 Output Report

**Output Report Location**: `docs/projects/BARREL-DISTORTION/reports/BARREL-DISTORTION-TASK-02-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**What to Include in Report**:
- Renderer code changes made (property, init(), updateSettings())
- Test results (all passing tests with coverage metrics)
- Integration test validation (settings → uniform flow confirmed)
- Visual validation (barrel distortion slider works in UI)
- Any challenges encountered (WebGL context issues, uniform binding)
- Recommendations for Phase 3 (settings panel UI integration ready)
- Confirmation that Phase 2 is complete and ready for Phase 3

---

**Return Value**: Return the file path when complete: `docs/projects/BARREL-DISTORTION/reports/BARREL-DISTORTION-TASK-02-002-REPORT.md`
