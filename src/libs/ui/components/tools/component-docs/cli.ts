/**
 * Argument parsing, command dispatch, and exit codes for `component-docs`. `run` never imports
 * Vite or spawns compodoc directly — the bootstrap supplies the story loader, and the data-layer
 * defaults handle compodoc — which keeps this module unit-testable with stubs.
 */
import { CatalogOptions, loadCatalog as loadCatalogDefault } from './catalog';
import {
  CompodocJson,
  CompodocSourceOptions,
  CompodocUnavailableError,
  loadCompodocJson as loadCompodocJsonDefault,
} from './compodoc-source';
import { DEFAULT_MIN_COVERAGE, evaluateCoverage } from './coverage';
import { DocEntry, StoryModuleLoader } from './model';
import { renderCoverage, renderGetEntry, renderList } from './render';
import { resolveEntry } from './resolve';

const EXIT_SUCCESS = 0;
/** Answerable no — unknown component name, or coverage below `--min`. */
const EXIT_NO = 1;
/** The CLI could not run — missing compodoc binary, unreadable workspace, bad arguments. */
const EXIT_CANNOT_RUN = 2;

export type CliDeps = {
  /** Path is relative to the Vite root `libs/ui/components`, not the workspace root. */
  loadStoryModule: StoryModuleLoader;
  /** Absolute path to the Nx workspace root; defaults to the process working directory. */
  workspaceRoot?: string;
  /** Defaults to the real catalog loader; overridable so tests never touch Vite or compodoc. */
  loadCatalog?: (options: CatalogOptions) => Promise<DocEntry[]>;
  /** Defaults to the real compodoc reader; overridable so tests never spawn compodoc. */
  loadCompodocJson?: (options?: CompodocSourceOptions) => Promise<CompodocJson>;
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
};

type ResolvedDeps = Required<Omit<CliDeps, 'workspaceRoot'>> & Pick<CliDeps, 'workspaceRoot'>;

const TOP_LEVEL_HELP = `component-docs — component documentation for a language model reading stdout.

Usage:
  component-docs list [--search <term>] [--json]
  component-docs get --component-name <name> [--json]
  component-docs coverage [--min <pct>]
  component-docs --help | component-docs <command> --help

Commands:
  list       Print one line per documented component, directive, and system.
  get        Print one entry in full: description, props, and narrative.
  coverage   Check documentation coverage against a threshold (default ${DEFAULT_MIN_COVERAGE}%).

Exit codes:
  0  success
  1  answerable no — unknown component name, or coverage below --min
  2  the CLI could not run — missing compodoc binary, unreadable workspace, bad arguments

Run 'component-docs <command> --help' for command-specific options.
`;

const LIST_HELP = `component-docs list — print one line per documented component, directive, and system.

Usage:
  component-docs list [--search <term>] [--json]

Options:
  --search <term>  Case-insensitive substring match against name, selector, and summary.
  --json           Emit the entries as JSON instead of markdown.
`;

const GET_HELP = `component-docs get — print one entry in full.

Usage:
  component-docs get --component-name <name> [--json]

Options:
  --component-name <name>  Any spelling that resolves to one entry (class name, selector, kebab-case, etc).
  --json                   Emit the entry as JSON instead of markdown.
`;

const COVERAGE_HELP = `component-docs coverage — check documentation coverage against a threshold.

Usage:
  component-docs coverage [--min <pct>]

Options:
  --min <pct>  Minimum coverage percent required of every component/directive file. Default ${DEFAULT_MIN_COVERAGE}.
`;

export async function run(argv: string[], deps: CliDeps): Promise<number> {
  const resolved: ResolvedDeps = {
    loadStoryModule: deps.loadStoryModule,
    workspaceRoot: deps.workspaceRoot,
    loadCatalog: deps.loadCatalog ?? loadCatalogDefault,
    loadCompodocJson: deps.loadCompodocJson ?? loadCompodocJsonDefault,
    stdout: deps.stdout ?? ((chunk) => void process.stdout.write(chunk)),
    stderr: deps.stderr ?? ((chunk) => void process.stderr.write(chunk)),
  };

  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h') {
    resolved.stdout(TOP_LEVEL_HELP);
    return EXIT_SUCCESS;
  }

  try {
    switch (command) {
      case 'list':
        return await runList(rest, resolved);
      case 'get':
        return await runGet(rest, resolved);
      case 'coverage':
        return await runCoverage(rest, resolved);
      default:
        resolved.stderr(`component-docs: unknown command '${command}'.\n\n${TOP_LEVEL_HELP}`);
        return EXIT_CANNOT_RUN;
    }
  } catch (error) {
    resolved.stderr(`component-docs: ${describeError(error)}\n`);
    return EXIT_CANNOT_RUN;
  }
}

async function runList(args: string[], deps: ResolvedDeps): Promise<number> {
  if (hasHelpFlag(args)) {
    deps.stdout(LIST_HELP);
    return EXIT_SUCCESS;
  }

  const parsed = parseFlags(args, { valueFlags: ['--search'], booleanFlags: ['--json'] });
  if (!parsed.ok) {
    deps.stderr(`component-docs list: ${parsed.message}\n\n${LIST_HELP}`);
    return EXIT_CANNOT_RUN;
  }

  const search = asString(parsed.flags['--search']);
  const entries = await deps.loadCatalog({
    loadStoryModule: deps.loadStoryModule,
    includeComponentNarrative: false,
    workspaceRoot: deps.workspaceRoot,
  });
  const filtered = search === undefined ? entries : filterBySearch(entries, search);

  deps.stdout(parsed.flags['--json'] === true ? `${JSON.stringify(filtered, null, 2)}\n` : renderList(filtered));
  return EXIT_SUCCESS;
}

/** Case-insensitive substring match against name, selector, and summary. */
export function filterBySearch(entries: readonly DocEntry[], term: string): DocEntry[] {
  const needle = term.toLowerCase();
  return entries.filter((entry) =>
    [entry.name, entry.selector, entry.summary].some((field) => field !== undefined && field.toLowerCase().includes(needle)),
  );
}

async function runGet(args: string[], deps: ResolvedDeps): Promise<number> {
  if (hasHelpFlag(args)) {
    deps.stdout(GET_HELP);
    return EXIT_SUCCESS;
  }

  const parsed = parseFlags(args, { valueFlags: ['--component-name'], booleanFlags: ['--json'] });
  if (!parsed.ok) {
    deps.stderr(`component-docs get: ${parsed.message}\n\n${GET_HELP}`);
    return EXIT_CANNOT_RUN;
  }

  const name = asString(parsed.flags['--component-name']);
  if (name === undefined) {
    deps.stderr(`component-docs get: --component-name is required.\n\n${GET_HELP}`);
    return EXIT_CANNOT_RUN;
  }

  const entries = await deps.loadCatalog({
    loadStoryModule: deps.loadStoryModule,
    includeComponentNarrative: true,
    workspaceRoot: deps.workspaceRoot,
  });
  const resolution = resolveEntry(entries, name);
  if (!resolution.matched) {
    const suggestions = resolution.suggestions.length > 0 ? resolution.suggestions.join(', ') : '(no close matches)';
    deps.stderr(`component-docs get: no component named '${name}'. Did you mean: ${suggestions}?\n`);
    return EXIT_NO;
  }

  deps.stdout(
    parsed.flags['--json'] === true ? `${JSON.stringify(resolution.entry, null, 2)}\n` : renderGetEntry(resolution.entry),
  );
  return EXIT_SUCCESS;
}

async function runCoverage(args: string[], deps: ResolvedDeps): Promise<number> {
  if (hasHelpFlag(args)) {
    deps.stdout(COVERAGE_HELP);
    return EXIT_SUCCESS;
  }

  const parsed = parseFlags(args, { valueFlags: ['--min'], booleanFlags: [] });
  if (!parsed.ok) {
    deps.stderr(`component-docs coverage: ${parsed.message}\n\n${COVERAGE_HELP}`);
    return EXIT_CANNOT_RUN;
  }

  const rawMin = asString(parsed.flags['--min']);
  const min = rawMin === undefined ? DEFAULT_MIN_COVERAGE : Number(rawMin);
  if (Number.isNaN(min)) {
    deps.stderr(`component-docs coverage: --min must be a number, got '${rawMin}'.\n\n${COVERAGE_HELP}`);
    return EXIT_CANNOT_RUN;
  }

  const payload = await deps.loadCompodocJson({ workspaceRoot: deps.workspaceRoot });
  const result = evaluateCoverage(payload.coverage, min);
  deps.stdout(renderCoverage(result));
  return result.ok ? EXIT_SUCCESS : EXIT_NO;
}

function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

type FlagSpec = { valueFlags: string[]; booleanFlags: string[] };
type FlagValue = string | true;
type ParseResult = { ok: true; flags: Record<string, FlagValue> } | { ok: false; message: string };

/** Hand-rolled parser for this CLI's small, fixed flag surface — no need for a dependency. */
function parseFlags(args: string[], spec: FlagSpec): ParseResult {
  const flags: Record<string, FlagValue> = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (spec.booleanFlags.includes(token)) {
      flags[token] = true;
      continue;
    }
    if (spec.valueFlags.includes(token)) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { ok: false, message: `${token} requires a value.` };
      }
      flags[token] = value;
      i++;
      continue;
    }
    return { ok: false, message: `unknown flag '${token}'.` };
  }
  return { ok: true, flags };
}

function asString(value: FlagValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function describeError(error: unknown): string {
  if (error instanceof CompodocUnavailableError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
