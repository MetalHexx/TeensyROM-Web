import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DocEntry, LIBRARY_ROOT, StoryModuleLoader, isPathNotFound, summarize, toViteRootRelative } from './model';

/**
 * The slice of a Storybook `meta` this layer reads. Every level is optional: no story file in the
 * library sets `parameters` today, and `argTypes` entries carry descriptions only sometimes.
 */
export type StoryMeta = {
  title?: string;
  component?: { name?: string };
  parameters?: { docs?: { description?: { component?: string } } };
  argTypes?: Record<string, { description?: string; options?: unknown[]; control?: unknown } | undefined>;
};

/**
 * Docs-only story files describing cross-cutting systems. Discovery is by directory convention so
 * a new system doc appears with no index to update; the directory need not exist.
 */
export const SYSTEMS_DIRECTORY = `${LIBRARY_ROOT}/src/lib/systems`;

/** Workspace-relative path of the sibling story file for a component or directive source file. */
export function storyPathFor(sourcePath: string): string {
  return sourcePath.replace(/\.ts$/, '.stories.ts');
}

export async function storyFileExists(workspaceRoot: string, storyPath: string): Promise<boolean> {
  try {
    await stat(join(workspaceRoot, storyPath));
    return true;
  } catch (error) {
    if (isPathNotFound(error)) {
      return false;
    }
    throw error;
  }
}

/** Evaluate a story module through the injected loader and return its default-exported meta. */
export async function loadStoryMeta(
  storyPath: string,
  loadStoryModule: StoryModuleLoader,
): Promise<StoryMeta | undefined> {
  const module = await loadStoryModule(toViteRootRelative(storyPath));
  return readStoryMeta(module);
}

export function readStoryMeta(module: Record<string, unknown>): StoryMeta | undefined {
  const meta = module['default'];
  return typeof meta === 'object' && meta !== null ? (meta as StoryMeta) : undefined;
}

export function narrativeOf(meta: StoryMeta | undefined): string | undefined {
  const narrative = meta?.parameters?.docs?.description?.component?.trim();
  return narrative ? narrative : undefined;
}

/** Prop descriptions authored on the story's `argTypes`, which layer over the compodoc JSDoc. */
export function propDescriptionsOf(meta: StoryMeta | undefined): Record<string, string> {
  const descriptions: Record<string, string> = {};
  for (const [prop, argType] of Object.entries(meta?.argTypes ?? {})) {
    const description = argType?.description?.trim();
    if (description) {
      descriptions[prop] = description;
    }
  }
  return descriptions;
}

/** Workspace-relative paths of the system story files; empty when the directory does not exist. */
export async function findSystemStories(workspaceRoot: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(join(workspaceRoot, SYSTEMS_DIRECTORY));
  } catch (error) {
    if (isPathNotFound(error)) {
      return [];
    }
    throw error;
  }

  return names
    .filter((name) => name.endsWith('.stories.ts'))
    .sort()
    .map((name) => `${SYSTEMS_DIRECTORY}/${name}`);
}

/**
 * Build a system entry from a docs-only story meta. The name is the last segment of the title —
 * `'Systems/Animation Chaining'` becomes `'Animation Chaining'`. An untitled meta yields nothing.
 */
export function toSystemEntry(meta: StoryMeta | undefined, storyPath: string): DocEntry | undefined {
  const title = meta?.title?.trim();
  if (!title) {
    return undefined;
  }

  const segments = title.split('/');
  const narrative = narrativeOf(meta);
  return {
    kind: 'system',
    name: segments[segments.length - 1].trim(),
    storyTitle: title,
    summary: summarize(narrative),
    description: narrative,
    narrative,
    props: [],
    storyPath,
    missing: [],
  };
}
