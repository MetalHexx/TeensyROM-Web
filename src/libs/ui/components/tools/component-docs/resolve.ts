import { DocEntry } from './model';

export const MAX_SUGGESTIONS = 5;

export type Resolution =
  | { readonly matched: true; readonly entry: DocEntry }
  | { readonly matched: false; readonly suggestions: string[] };

/**
 * Collapse every way a user might name one entry onto a single key: `CardLayoutComponent`,
 * `card-layout`, `lib-card-layout`, `CardLayout` and `card-layout.component` all become
 * `cardlayout`.
 */
export function normalizeName(candidate: string): string {
  const lowered = candidate.trim().toLowerCase();
  const withoutPrefix = lowered.startsWith('lib-') ? lowered.slice('lib-'.length) : lowered;
  return withoutPrefix.replace(/[^a-z0-9]/g, '').replace(/(component|directive)$/, '');
}

/** Exact normalized match, or a ranked shortlist of near misses — never a throw. */
export function resolveEntry(entries: readonly DocEntry[], candidate: string): Resolution {
  const key = normalizeName(candidate);
  const entry = entries.find((current) => normalizeName(current.name) === key);
  return entry ? { matched: true, entry } : { matched: false, suggestions: suggestNames(entries, key) };
}

function suggestNames(entries: readonly DocEntry[], key: string): string[] {
  return entries
    .map((entry) => {
      const normalized = normalizeName(entry.name);
      return {
        name: entry.name,
        related: normalized.includes(key) || key.includes(normalized) ? 0 : 1,
        distance: editDistance(normalized, key),
      };
    })
    .sort((a, b) => a.related - b.related || a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, MAX_SUGGESTIONS)
    .map((scored) => scored.name);
}

/** Levenshtein distance over two rows. */
function editDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1);
    }
    previous = current;
  }
  return previous[right.length];
}
