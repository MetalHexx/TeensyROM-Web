/**
 * Shared vocabulary of the component documentation layer: the entry shape the command
 * surface renders, and the pure helpers both data sources need.
 */

/** Workspace-relative root of the component library; also the Vite root story loading resolves against. */
export const LIBRARY_ROOT = 'libs/ui/components';

/** One documented unit of the library — a component, a directive, or a cross-cutting system. */
export type DocEntry = {
  kind: 'component' | 'directive' | 'system';
  /** `'CardLayoutComponent'` for a class, the last title segment for a system. */
  name: string;
  /** Absent for systems, which have no element or attribute of their own. */
  selector?: string;
  storyTitle?: string;
  /** First sentence of the description; `''` when unknown. */
  summary: string;
  /** Class-level JSDoc as markdown. */
  description?: string;
  /** The `@example` block, when compodoc surfaces one. */
  example?: string;
  /** `meta.parameters.docs.description.component` from the story file. */
  narrative?: string;
  props: PropDoc[];
  /** Workspace-relative. */
  sourcePath?: string;
  /** Workspace-relative. */
  storyPath?: string;
  /** Sources that were read and failed — never one that was skipped. */
  missing: ('compodoc' | 'story')[];
};

export type PropDoc = {
  name: string;
  type: string;
  default?: string;
  required: boolean;
  description: string;
  kind: 'input' | 'output';
};

/**
 * Injected by the bootstrap so this layer never imports Vite.
 * The path is relative to the **Vite root**, which is {@link LIBRARY_ROOT} —
 * e.g. `'./src/lib/card-layout/card-layout.component.stories.ts'`.
 */
export type StoryModuleLoader = (libRelativePath: string) => Promise<Record<string, unknown>>;

/**
 * Convert a workspace-relative path onto the Vite-root-relative base a {@link StoryModuleLoader}
 * expects. The two bases are not interchangeable: passing a workspace-relative path straight to
 * the loader resolves to `libs/ui/components/libs/ui/components/…` and always fails.
 */
export function toViteRootRelative(workspaceRelativePath: string): string {
  const normalized = workspaceRelativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const prefix = `${LIBRARY_ROOT}/`;
  const withinLibrary = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  return `./${withinLibrary}`;
}

/**
 * First sentence of a description — everything up to the first `. ` or line break, trimmed.
 * Markdown syntax is left intact so the caller decides how to render it.
 */
export function summarize(description: string | undefined): string {
  const trimmed = (description ?? '').trim();
  if (trimmed === '') {
    return '';
  }

  const boundary = /\.\s|\n/.exec(trimmed);
  if (boundary === null) {
    return trimmed;
  }

  const includesPeriod = boundary[0].startsWith('.') ? 1 : 0;
  return trimmed.slice(0, boundary.index + includesPeriod).trim();
}

/** True when a filesystem rejection means "the path is not there" rather than a real failure. */
export function isPathNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
}
