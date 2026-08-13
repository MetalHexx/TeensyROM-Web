import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA, type Provider, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PLAYER_CONTEXT, type IPlayerContext } from '@teensyrom-nx/application';
import { createMockPlayerContext } from '@teensyrom-nx/testing/app-mocks';

/** Handle onto a component rendered by {@link renderPlayerComponent}. */
export interface RenderResult<T> {
  fixture: ComponentFixture<T>;
  component: T;
  /** Assigns a signal input and flushes change detection. */
  setInput(name: string, value: unknown): void;
}

/** Options accepted by {@link renderPlayerComponent}. */
export interface RenderPlayerComponentOptions {
  /** Signal inputs assigned before the first change-detection pass. */
  inputs?: Record<string, unknown>;
  /** Members to override on the default `createMockPlayerContext()` stub. */
  playerContext?: Partial<IPlayerContext>;
  /** Extra providers. Later entries win, so these may replace the defaults. */
  providers?: Provider[];
  /**
   * Escape hatch that disables stubbing entirely, compiling the component under test's whole
   * real descendant tree. Reserved for cases {@link realChildren} can't cover (see its doc);
   * prefer `realChildren` in every other case, since this reintroduces the JIT-heavy compiles
   * the harness exists to avoid.
   */
  stubChildren?: boolean;
  /**
   * Named children to leave real while everything else stays stubbed under `NO_ERRORS_SCHEMA`.
   *
   * The default stub (dropping the component's `imports` and applying `NO_ERRORS_SCHEMA`) hides
   * any behavior a child itself is responsible for: a `@HostBinding`-driven class, a `viewChild`
   * template-ref call, an `@Output` a child re-emits from its own host listener, or an
   * `injector.get()` on a directive that has to actually be attached. When the assertion under
   * test is genuinely about one of those facts, name the specific child (and any directive it
   * needs, e.g. `TooltipDirective`) here instead of reaching for `stubChildren: false` — that
   * keeps every other descendant, and any deep/expensive subtree a sibling child would otherwise
   * drag in (WebGL canvases, nested feature components), safely stubbed out. This is the shared
   * convention every spec should converge on rather than inventing its own escape hatch.
   */
  realChildren?: Type<unknown>[];
}

/**
 * Renders a player feature component in isolation: no descendant component is compiled,
 * `PLAYER_CONTEXT` and animations are provided by default, and inputs are assigned before
 * the first change-detection pass.
 *
 * Because children are stubbed, assertions that reach through a child into its DOM will not
 * work — that behavior belongs in the child's own spec. Assert on this component's state, or
 * name the specific child via {@link RenderPlayerComponentOptions.realChildren} if the assertion
 * is genuinely about that child's own contribution.
 */
export function renderPlayerComponent<T>(
  componentType: Type<T>,
  options: RenderPlayerComponentOptions = {}
): RenderResult<T> {
  const { inputs, playerContext, providers = [], stubChildren = true, realChildren = [] } = options;

  TestBed.configureTestingModule({
    imports: [componentType],
    providers: [
      provideNoopAnimations(),
      { provide: PLAYER_CONTEXT, useValue: createMockPlayerContext(playerContext) },
      ...providers,
    ],
  });

  if (stubChildren) {
    // Replacing the component's own `imports` is what keeps the descendant tree out of the
    // JIT compiler; NO_ERRORS_SCHEMA alone would still compile every child, and only silences
    // the unknown elements and bindings that dropping them leaves behind. CommonModule stays
    // in because its pipes and structural directives are template syntax rather than children,
    // and an unresolved pipe is a hard template error the schema cannot absorb. `realChildren`
    // are added back individually so their own behavior still compiles.
    TestBed.overrideComponent(componentType, {
      set: { imports: [CommonModule, ...realChildren], schemas: [NO_ERRORS_SCHEMA] },
    });
  }

  const fixture = TestBed.createComponent(componentType);

  for (const [name, value] of Object.entries(inputs ?? {})) {
    fixture.componentRef.setInput(name, value);
  }

  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    setInput: (name: string, value: unknown) => {
      fixture.componentRef.setInput(name, value);
      fixture.detectChanges();
    },
  };
}
