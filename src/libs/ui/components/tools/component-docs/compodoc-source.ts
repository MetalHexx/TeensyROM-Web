import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DocEntry, LIBRARY_ROOT, PropDoc, isPathNotFound, summarize } from './model';

/** An input or output as compodoc emits it. */
export type CompodocMember = {
  name: string;
  type: string;
  /** Stringified, e.g. `"'dark'"` or `'true'`. */
  defaultValue?: string;
  /** Rendered to HTML. */
  description: string;
  /** Raw markdown; preferred over {@link CompodocMember.description} for terminal output. */
  rawdescription?: string;
  line: number;
  required?: boolean;
  deprecated?: boolean;
};

export type CompodocJsdocTag = {
  /** compodoc forwards the TypeScript AST node, which names the tag under `escapedText`. */
  tagName?: { text?: string; escapedText?: string };
  comment?: string;
};

export type CompodocEntity = {
  name: string;
  id: string;
  /** Workspace-relative, e.g. `libs/ui/components/src/lib/card-layout/card-layout.component.ts`. */
  file: string;
  selector: string;
  /** Class JSDoc, rendered to HTML. */
  description: string;
  /** Class JSDoc, raw markdown — includes the `@example` body as a trailing fenced block. */
  rawdescription: string;
  inputsClass?: CompodocMember[];
  outputsClass?: CompodocMember[];
  jsdoctags?: CompodocJsdocTag[];
};

export type CompodocCoverage = {
  /** Whole-project percentage. */
  count: number;
  status: string;
  files: {
    filePath: string;
    type: string;
    linktype: string;
    name: string;
    coveragePercent: number;
    /** e.g. `'3/7'`. */
    coverageCount: string;
    status: string;
  }[];
};

export type CompodocJson = {
  components: CompodocEntity[];
  directives: CompodocEntity[];
  classes?: unknown[];
  injectables?: unknown[];
  interfaces?: unknown[];
  miscellaneous?: unknown;
  coverage?: CompodocCoverage;
};

/** The compodoc CLI could not be run at all — distinct from documentation.json being absent. */
export class CompodocUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompodocUnavailableError';
  }
}

const COMPODOC_BIN = 'node_modules/@compodoc/compodoc/bin/index-cli.js';

/** Mirrors the `compodocArgs` of the storybook targets so both produce the same payload. */
const COMPODOC_ARGS = ['-p', `${LIBRARY_ROOT}/tsconfig.lib.json`, '-e', 'json', '-d', LIBRARY_ROOT];

const DOCUMENTATION_FILE = `${LIBRARY_ROOT}/documentation.json`;

const SOURCE_ROOT = `${LIBRARY_ROOT}/src/lib`;

export type CompodocSourceOptions = {
  /** Absolute path to the Nx workspace root; defaults to the process working directory. */
  workspaceRoot?: string;
  /** Regenerates documentation.json; defaults to spawning the compodoc CLI. */
  regenerate?: () => Promise<void>;
  /** Epoch ms of documentation.json, or `undefined` when it is absent. */
  documentationMtime?: () => Promise<number | undefined>;
  /** Newest epoch ms across compodoc's source scope, or `undefined` when nothing is in scope. */
  sourcesMtime?: () => Promise<number | undefined>;
  /** Reads and parses documentation.json. */
  readPayload?: () => Promise<CompodocJson>;
};

/**
 * Read compodoc's payload, regenerating it first when it is absent or older than the sources
 * it documents. Every side effect is an injectable seam so callers can drive the staleness
 * branches without spawning compodoc.
 */
export async function loadCompodocJson(options: CompodocSourceOptions = {}): Promise<CompodocJson> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const documentationPath = join(workspaceRoot, DOCUMENTATION_FILE);
  const documentationMtime = options.documentationMtime ?? (() => mtimeOf(documentationPath));
  const sourcesMtime = options.sourcesMtime ?? (() => newestSourceMtime(join(workspaceRoot, SOURCE_ROOT)));
  const regenerate = options.regenerate ?? (() => runCompodoc(workspaceRoot));
  const readPayload = options.readPayload ?? (() => readCompodocJson(documentationPath));

  const generatedAt = await documentationMtime();
  if (generatedAt === undefined || (await isStale(generatedAt, sourcesMtime))) {
    await regenerate();
  }

  return readPayload();
}

async function isStale(generatedAt: number, sourcesMtime: () => Promise<number | undefined>): Promise<boolean> {
  const newestSource = await sourcesMtime();
  return newestSource !== undefined && generatedAt < newestSource;
}

/**
 * Newest mtime across the files compodoc actually documents. Specs and stories are outside its
 * scope, so a change to either must not make the payload look stale.
 */
export async function newestSourceMtime(directory: string): Promise<number | undefined> {
  let newest: number | undefined;

  const walk = async (current: string): Promise<void> => {
    const entries = await readDirectory(current);
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!isDocumentedSource(entry.name)) {
        continue;
      }
      const mtime = await mtimeOf(path);
      if (mtime !== undefined && (newest === undefined || mtime > newest)) {
        newest = mtime;
      }
    }
  };

  await walk(directory);
  return newest;
}

function isDocumentedSource(fileName: string): boolean {
  return fileName.endsWith('.ts') && !fileName.endsWith('.spec.ts') && !fileName.endsWith('.stories.ts');
}

async function readDirectory(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isPathNotFound(error)) {
      return [];
    }
    throw error;
  }
}

async function mtimeOf(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mtimeMs;
  } catch (error) {
    if (isPathNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

async function readCompodocJson(path: string): Promise<CompodocJson> {
  return parseCompodocJson(await readFile(path, 'utf8'));
}

/** Parse and shape-check the payload; a malformed file is a clearer failure than a later TypeError. */
export function parseCompodocJson(text: string): CompodocJson {
  const payload: unknown = JSON.parse(text);
  const candidate = payload as Partial<CompodocJson>;
  if (!Array.isArray(candidate?.components) || !Array.isArray(candidate.directives)) {
    throw new Error(
      `${DOCUMENTATION_FILE} is not a compodoc payload: expected \`components\` and \`directives\` arrays.`,
    );
  }
  return candidate as CompodocJson;
}

async function runCompodoc(workspaceRoot: string): Promise<void> {
  const bin = join(workspaceRoot, COMPODOC_BIN);
  if ((await mtimeOf(bin)) === undefined) {
    throw new CompodocUnavailableError(
      `compodoc could not run: ${COMPODOC_BIN} is not installed. Run \`pnpm install\` at the workspace root and retry.`,
    );
  }

  // stdout belongs to the command's own output, so the progress note goes to stderr and
  // compodoc's own chatter is dropped.
  process.stderr.write('component-docs: regenerating documentation.json (compodoc)…\n');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...COMPODOC_ARGS], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    child.on('error', (error) => reject(new CompodocUnavailableError(`compodoc could not run: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new CompodocUnavailableError(`compodoc could not run: the CLI exited with code ${code}.`));
    });
  });
}

/** Project the payload's components and directives onto the shared entry shape. */
export function toDocEntries(payload: CompodocJson): DocEntry[] {
  return [
    ...payload.components.map((entity) => toDocEntry(entity, 'component')),
    ...payload.directives.map((entity) => toDocEntry(entity, 'directive')),
  ];
}

function toDocEntry(entity: CompodocEntity, kind: 'component' | 'directive'): DocEntry {
  const { description, example } = splitExample(entity);
  return {
    kind,
    name: entity.name,
    selector: entity.selector || undefined,
    summary: summarize(description),
    description: description || undefined,
    example,
    props: [
      ...(entity.inputsClass ?? []).map((member) => toPropDoc(member, 'input')),
      ...(entity.outputsClass ?? []).map((member) => toPropDoc(member, 'output')),
    ],
    sourcePath: entity.file,
    missing: [],
  };
}

function toPropDoc(member: CompodocMember, kind: PropDoc['kind']): PropDoc {
  const raw = (member.rawdescription ?? '').trim();
  return {
    name: member.name,
    type: member.type,
    default: member.defaultValue,
    required: member.required === true,
    description: raw !== '' ? raw : (member.description ?? '').trim(),
    kind,
  };
}

/**
 * compodoc folds the `@example` body into `rawdescription` as a fenced block after the prose —
 * the `jsdoctags` copy is pre-rendered HTML, so the raw text is the better source. The tag is
 * what tells us a fence is an example rather than part of the prose.
 */
function splitExample(entity: CompodocEntity): { description: string; example?: string } {
  const raw = (entity.rawdescription || entity.description || '').trim();
  if (!hasExampleTag(entity)) {
    return { description: raw };
  }

  const fence = raw.search(/^```/m);
  if (fence < 0) {
    return { description: raw };
  }

  return { description: raw.slice(0, fence).trim(), example: raw.slice(fence).trim() };
}

function hasExampleTag(entity: CompodocEntity): boolean {
  return (entity.jsdoctags ?? []).some((tag) => (tag.tagName?.escapedText ?? tag.tagName?.text) === 'example');
}
