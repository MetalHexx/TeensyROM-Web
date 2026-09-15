import { InjectionToken } from '@angular/core';
import type { AnalysisScanner } from '@sidablist/analysis';
export type { ScanRequest, ScanMessage, ScanResult, AnalysisScanner } from '@sidablist/analysis';

/**
 * The runner an analysis view goes through to scan a tune.
 *
 * A token rather than a `new Worker` inside a component, for the same reason `REPLAY_RUNNER` is one:
 * a test resolves a scan by hand instead of needing a `Worker` jsdom does not have.
 */
export const ANALYSIS_SCANNER = new InjectionToken<AnalysisScanner>('ANALYSIS_SCANNER');
