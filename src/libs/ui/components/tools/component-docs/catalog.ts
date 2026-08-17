import { CompodocJson, loadCompodocJson, toDocEntries } from './compodoc-source';
import { DocEntry, StoryModuleLoader } from './model';
import { normalizeName } from './resolve';
import {
  StoryMeta,
  findSystemStories,
  loadStoryMeta,
  narrativeOf,
  propDescriptionsOf,
  storyFileExists,
  storyPathFor,
  toSystemEntry,
} from './story-source';

export type CatalogOptions = {
  loadStoryModule: StoryModuleLoader;
  /** `false` → skip the component story modules entirely; systems entries still load. */
  includeComponentNarrative: boolean;
  /** Absolute path to the Nx workspace root; defaults to the process working directory. */
  workspaceRoot?: string;
  /** Supplies compodoc's payload; defaults to reading (and regenerating) documentation.json. */
  loadPayload?: () => Promise<CompodocJson>;
  /** Takes a workspace-relative story path. */
  storyExists?: (storyPath: string) => Promise<boolean>;
  /** Workspace-relative paths of the docs-only system story files. */
  findSystemStoryPaths?: () => Promise<string[]>;
  warn?: (message: string) => void;
};

/**
 * Merge compodoc's structural data with the narrative authored in story files into one entry
 * per documented unit. A story that cannot be evaluated degrades that one entry; it never
 * aborts the catalog.
 */
export async function loadCatalog(options: CatalogOptions): Promise<DocEntry[]> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const warn = options.warn ?? ((message: string) => void process.stderr.write(`${message}\n`));
  const loadPayload = options.loadPayload ?? (() => loadCompodocJson({ workspaceRoot }));
  const storyExists = options.storyExists ?? ((storyPath: string) => storyFileExists(workspaceRoot, storyPath));
  const findSystemStoryPaths = options.findSystemStoryPaths ?? (() => findSystemStories(workspaceRoot));

  const documented = toDocEntries(await loadPayload());
  const entries: DocEntry[] = [];
  for (const entry of documented) {
    entries.push(
      options.includeComponentNarrative
        ? await withStory(entry, { storyExists, loadStoryModule: options.loadStoryModule, warn })
        : entry,
    );
  }

  const systems = await loadSystemEntries(await findSystemStoryPaths(), options.loadStoryModule, warn);
  return unionByName(entries, systems);
}

type StoryDeps = {
  storyExists: (storyPath: string) => Promise<boolean>;
  loadStoryModule: StoryModuleLoader;
  warn: (message: string) => void;
};

async function withStory(entry: DocEntry, deps: StoryDeps): Promise<DocEntry> {
  const storyPath = entry.sourcePath === undefined ? undefined : storyPathFor(entry.sourcePath);
  if (storyPath === undefined || !(await deps.storyExists(storyPath))) {
    return { ...entry, missing: [...entry.missing, 'story'] };
  }

  let meta: StoryMeta | undefined;
  try {
    meta = await loadStoryMeta(storyPath, deps.loadStoryModule);
  } catch (error) {
    deps.warn(`component-docs: could not evaluate ${storyPath} — ${describe(error)}`);
    return { ...entry, missing: [...entry.missing, 'story'] };
  }

  const descriptions = propDescriptionsOf(meta);
  return {
    ...entry,
    storyPath,
    storyTitle: meta?.title,
    narrative: narrativeOf(meta),
    props: entry.props.map((prop) => ({ ...prop, description: descriptions[prop.name] ?? prop.description })),
  };
}

async function loadSystemEntries(
  storyPaths: readonly string[],
  loadStoryModule: StoryModuleLoader,
  warn: (message: string) => void,
): Promise<DocEntry[]> {
  const entries: DocEntry[] = [];
  for (const storyPath of storyPaths) {
    let meta: StoryMeta | undefined;
    try {
      meta = await loadStoryMeta(storyPath, loadStoryModule);
    } catch (error) {
      warn(`component-docs: could not evaluate ${storyPath} — ${describe(error)}`);
      continue;
    }

    const entry = toSystemEntry(meta, storyPath);
    if (entry === undefined) {
      warn(`component-docs: ${storyPath} has no meta title, skipping it.`);
      continue;
    }
    entries.push(entry);
  }
  return entries;
}

/** Union both sources by resolved name so a unit documented twice yields one entry, not two. */
function unionByName(documented: readonly DocEntry[], systems: readonly DocEntry[]): DocEntry[] {
  const byName = new Map<string, number>();
  const merged: DocEntry[] = [];

  for (const entry of [...documented, ...systems]) {
    const key = normalizeName(entry.name);
    const existing = byName.get(key);
    if (existing === undefined) {
      byName.set(key, merged.length);
      merged.push(entry);
      continue;
    }
    merged[existing] = combine(merged[existing], entry);
  }

  return merged;
}

function combine(base: DocEntry, incoming: DocEntry): DocEntry {
  return {
    ...base,
    storyTitle: base.storyTitle ?? incoming.storyTitle,
    narrative: base.narrative ?? incoming.narrative,
    description: base.description ?? incoming.description,
    summary: base.summary || incoming.summary,
    storyPath: base.storyPath ?? incoming.storyPath,
    props: base.props.length > 0 ? base.props : incoming.props,
    missing: base.missing.filter((source) => source !== 'story' || incoming.storyPath === undefined),
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
