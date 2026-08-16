/**
 * Markdown rendering for `list`, `get`, and `coverage`. Output is written for a language model
 * reading stdout: proportional to the data, no decoration that isn't load-bearing.
 */
import { CoverageResult } from './coverage';
import { DocEntry, PropDoc } from './model';

/** One line per entry — name, selector, one-line summary, source path — and nothing else. */
export function renderList(entries: readonly DocEntry[]): string {
  if (entries.length === 0) {
    return 'No entries matched.\n';
  }
  return `${entries.map(renderListLine).join('\n')}\n`;
}

function renderListLine(entry: DocEntry): string {
  const selector = entry.selector !== undefined ? ` \`${entry.selector}\`` : '';
  const summary = entry.summary !== '' ? ` — ${entry.summary}` : '';
  const source = entry.sourcePath !== undefined ? ` (${entry.sourcePath})` : '';
  return `- **${entry.name}**${selector}${summary}${source}`;
}

/** One entry in full: heading, paths, description, example, prop table, then the narrative. */
export function renderGetEntry(entry: DocEntry): string {
  const sections: string[] = [renderHeading(entry)];

  if (entry.description !== undefined && entry.description !== '') {
    sections.push(entry.description);
  }
  if (entry.example !== undefined && entry.example !== '') {
    sections.push(`## Example\n\n${entry.example}`);
  }
  sections.push(`## Props\n\n${renderPropTable(entry.props)}`);
  sections.push(`## Narrative\n\n${renderNarrative(entry)}`);

  return `${sections.join('\n\n')}\n`;
}

function renderHeading(entry: DocEntry): string {
  const lines = [`# ${entry.name}`];
  if (entry.selector !== undefined) {
    lines.push(`Selector: \`${entry.selector}\``);
  }
  if (entry.sourcePath !== undefined) {
    lines.push(`Source: ${entry.sourcePath}`);
  }
  if (entry.storyPath !== undefined) {
    lines.push(`Story: ${entry.storyPath}`);
  }
  return lines.join('\n');
}

function renderPropTable(props: readonly PropDoc[]): string {
  if (props.length === 0) {
    return '_No props._';
  }
  const rows = props.map(
    (prop) =>
      `| ${prop.name} | ${escapeCell(prop.type)} | ${prop.default !== undefined ? escapeCell(prop.default) : ''} | ${
        prop.required ? 'Yes' : 'No'
      } | ${escapeCell(prop.description)} |`,
  );
  return ['| Prop | Type | Default | Required | Description |', '| --- | --- | --- | --- | --- |', ...rows].join(
    '\n',
  );
}

function renderNarrative(entry: DocEntry): string {
  if (entry.missing.includes('story')) {
    return '> No story file found — narrative unavailable.';
  }
  if (entry.narrative !== undefined && entry.narrative !== '') {
    return entry.narrative;
  }
  return '_No narrative authored yet._';
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** The gated percentage, the ungated global percentage, and any file below the threshold. */
export function renderCoverage(result: CoverageResult): string {
  const sections: string[] = ['# Documentation coverage'];
  sections.push(
    [
      `Gated (components & directives): ${result.gatedPercent}% — threshold ${result.min}%.`,
      `Global (whole project, informational only, not gated): ${result.globalPercent}%.`,
    ].join('\n'),
  );

  if (result.below.length === 0) {
    sections.push('All gated files meet the threshold.');
  } else {
    const rows = result.below.map((file) => `| ${file.filePath} | ${file.coveragePercent}% (${file.coverageCount}) |`);
    sections.push(
      ['## Below threshold', '', '| File | Coverage |', '| --- | --- |', ...rows].join('\n'),
    );
  }

  return `${sections.join('\n\n')}\n`;
}
