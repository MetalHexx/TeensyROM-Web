import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { TransferFeedEntry, TransferModalState } from '@teensyrom-nx/application';
import { TransferProgressComponent, TransferProgressVm } from './transfer-progress.component';

function feedEntry(index: number, success = true): TransferFeedEntry {
  return {
    relativePath: `HVSC/MUSICIANS/H/Hubbard_Rob/file-${index}.sid`,
    fileName: `file-${index}.sid`,
    success,
    reason: success ? null : `device write failed — timeout ${index}`,
  };
}

function baseVm(overrides: Partial<TransferProgressVm> = {}): TransferProgressVm {
  return {
    state: 'receiving',
    deviceName: 'Unnamed',
    destinationLabel: 'SD Card · /music/',
    droppedRootName: 'HVSC',
    scanFound: 12480,
    scanTotal: 12480,
    uploaded: 8412,
    written: 6977,
    failed: 4,
    apiPercent: 67,
    devicePercent: 56,
    hasArchive: false,
    expansionPercent: 0,
    expandingArchive: null,
    expansionComplete: false,
    expandedTotal: null,
    filesPerSecond: 9.8,
    bytesPerSecond: 1_500_000,
    feed: [feedEntry(1), feedEntry(2, false)],
    failures: [feedEntry(2, false)],
    failureOverflow: 0,
    elapsedLabel: '14:22 elapsed',
    reason: null,
    ...overrides,
  };
}

describe('TransferProgressComponent', () => {
  let fixture: ComponentFixture<TransferProgressComponent>;
  let component: TransferProgressComponent;

  const setup = async (vm: TransferProgressVm) => {
    await TestBed.configureTestingModule({
      imports: [TransferProgressComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferProgressComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('vm', vm);
    fixture.detectChanges();
  };

  const native = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => native().querySelector(`[data-testid="${testId}"]`);
  const qAll = (selector: string) => native().querySelectorAll(selector);
  const buttonByLabel = (label: string): HTMLButtonElement | null => {
    const match = Array.from(qAll('lib-action-button')).find(
      (host) => host.querySelector('.icon-label-text.primary')?.textContent?.trim() === label
    );
    return match?.querySelector('button') ?? null;
  };

  it('creates with no store or service dependency, purely from its input', async () => {
    await setup(baseVm());
    expect(component).toBeTruthy();
  });

  describe('state coverage', () => {
    it.each<[TransferModalState, string]>([
      ['scanning', 'Scanning Files'],
      ['starting', 'Starting transfer'],
      ['device-busy', 'Device Busy'],
      ['nothing-to-transfer', 'Nothing to transfer'],
      ['failed', "Transfer couldn't start"],
      ['receiving', 'Transferring to Unnamed'],
      ['draining', 'Transferring to Unnamed'],
      ['completed', 'Transfer Completed'],
      ['cancelled', 'Transfer cancelled'],
      ['aborted', 'Transfer Stopped: Device Lost'],
      ['abandoned', 'Transfer Stopped: Connection Lost'],
    ])('renders its frame for %s', async (state, expectedTitle) => {
      await setup(baseVm({ state, reason: 'the destination directory was rejected' }));

      expect(q('transfer-progress-title')?.textContent?.trim()).toBe(expectedTitle);
      // Every state renders through a known shape — none falls through to an empty dialog.
      expect(q('transfer-progress')?.textContent?.trim().length).toBeGreaterThan(expectedTitle.length);
    });
  });

  describe('scanning / starting', () => {
    it('shows the found count and a single Cancel action', async () => {
      await setup(baseVm({ state: 'scanning', scanFound: 8214 }));

      expect(native().querySelector('.scan-count')?.textContent?.trim()).toBe('8,214');
      expect(buttonByLabel('Cancel')).toBeTruthy();
      expect(buttonByLabel('Close')).toBeFalsy();
    });

    it('shows the manifest total while starting', async () => {
      await setup(baseVm({ state: 'starting', scanTotal: 12480 }));

      expect(native().querySelector('.scan-count')?.textContent?.trim()).toBe('12,480');
    });
  });

  describe('device-busy', () => {
    it('renders both banners and offers Close and Retry', async () => {
      await setup(baseVm({ state: 'device-busy', deviceName: 'Unnamed', scanTotal: 12480 }));

      expect(q('transfer-progress-banner')).toBeTruthy();
      expect(q('transfer-progress-banner-neutral')).toBeTruthy();
      expect(buttonByLabel('Close')).toBeTruthy();
      expect(buttonByLabel('Retry')).toBeTruthy();
    });
  });

  describe('failed', () => {
    it('renders the reason banner without a Retry action', async () => {
      await setup(baseVm({ state: 'failed', reason: 'the destination directory was rejected' }));

      expect(q('transfer-progress-banner')?.textContent).toContain('the destination directory was rejected');
      expect(buttonByLabel('Close')).toBeTruthy();
      expect(buttonByLabel('Retry')).toBeFalsy();
    });
  });

  describe('nothing-to-transfer', () => {
    it('renders a neutral banner and only Close', async () => {
      await setup(baseVm({ state: 'nothing-to-transfer' }));

      expect(q('transfer-progress-banner')).toBeTruthy();
      expect(buttonByLabel('Close')).toBeTruthy();
      expect(buttonByLabel('Cancel')).toBeFalsy();
    });
  });

  describe('receiving / draining', () => {
    it('renders the supplied figures verbatim, not recomputed', async () => {
      await setup(
        baseVm({
          state: 'receiving',
          uploaded: 8412,
          written: 6977,
          failed: 4,
          scanTotal: 12480,
          apiPercent: 67,
          devicePercent: 56,
        })
      );

      expect(q('metric-uploaded')?.textContent).toContain('8,412');
      expect(q('metric-uploaded')?.textContent).toContain('12,480');
      expect(q('metric-written')?.textContent).toContain('6,977');
      expect(q('metric-failed')?.textContent?.trim()).toContain('4');
      expect(q('api-bar-pct')?.textContent?.trim()).toBe('67%');
      expect(q('device-bar-pct')?.textContent?.trim()).toBe('56%');
    });

    it('orders the tiles Uploaded, Completed, Failed, Rate', async () => {
      await setup(baseVm({ state: 'receiving' }));

      const labels = Array.from(qAll('.metric-label')).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['Uploaded', 'Completed', 'Failed', 'Rate']);
    });

    it('renders both rate figures, formatted', async () => {
      await setup(baseVm({ state: 'receiving', filesPerSecond: 9.8, bytesPerSecond: 1_572_864 }));

      expect(q('metric-rate')?.textContent).toContain('9.8 Files/s');
      expect(q('metric-rate')?.textContent).toContain('1.5 MB/s');
    });

    it('reads 0.0/s and 0 B/s when stalled, not a held prior value', async () => {
      await setup(baseVm({ state: 'receiving', filesPerSecond: 0, bytesPerSecond: 0 }));

      expect(q('metric-rate')?.textContent).toContain('0.0 Files/s');
      expect(q('metric-rate')?.textContent).toContain('0 B/s');
    });

    it('labels the rate tile "Rate" while running', async () => {
      await setup(baseVm({ state: 'receiving' }));
      expect(q('metric-rate')?.querySelector('.metric-label')?.textContent?.trim()).toBe('Rate');
    });

    it('labels the rate tile "Avg Rate" once terminal', async () => {
      await setup(baseVm({ state: 'completed' }));
      expect(q('metric-rate')?.querySelector('.metric-label')?.textContent?.trim()).toBe('Avg Rate');
    });

    it('renders a large uploaded-of-total value as one unbroken run', async () => {
      await setup(baseVm({ state: 'receiving', uploaded: 40000, scanTotal: 60000 }));

      // The gap before "/" is CSS margin, not a text character — the DOM text is unbroken.
      const value = q('metric-uploaded')?.querySelector('.metric-value');
      expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('40,000/ 60,000');
    });

    it('carries no denominator on the Completed tile until expandedTotal exists', async () => {
      await setup(baseVm({ state: 'receiving', written: 6977, expandedTotal: null }));

      const value = q('metric-written')?.querySelector('.metric-value');
      expect(value?.textContent?.trim()).toBe('6,977');
      const spoken = q('metric-written')?.querySelector('.visually-hidden');
      expect(spoken?.textContent?.trim()).toBe('6,977');
    });

    it('carries the composed expandedTotal denominator on the Completed tile once it exists', async () => {
      await setup(baseVm({ state: 'receiving', written: 842, expandedTotal: 1204 }));

      const value = q('metric-written')?.querySelector('.metric-value');
      expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('842/ 1,204');
      const spoken = q('metric-written')?.querySelector('.visually-hidden');
      expect(spoken?.textContent?.trim()).toBe('842 of 1,204');
    });

    it('captions the device bar "Transferred to TR"', async () => {
      await setup(baseVm({ state: 'receiving' }));

      const deviceCaption = q('device-bar-pct')?.parentElement;
      expect(deviceCaption?.textContent).toContain('Transferred to TR');
      expect(deviceCaption?.textContent).not.toContain('Transferred to TR Device');
    });

    it('gives draining the same title format as receiving, not "Writing to"', async () => {
      await setup(baseVm({ state: 'draining', deviceName: 'Widget' }));

      expect(q('transfer-progress-title')?.textContent?.trim()).toBe('Transferring to Widget');
    });

    it('renders no current-file element in the active state', async () => {
      await setup(baseVm({ state: 'receiving' }));

      expect(q('transfer-progress-current-file')).toBeFalsy();
    });

    it('renders the feed newest-first, as supplied, with the full relative path and no cap caption', async () => {
      const feed = [feedEntry(1), feedEntry(2, false), feedEntry(3)];
      await setup(baseVm({ state: 'receiving', feed }));

      const rows = qAll('.feed-row');
      expect(rows.length).toBe(feed.length);
      expect(rows[0].textContent).toContain('HVSC/MUSICIANS/H/Hubbard_Rob/file-1.sid');
      expect(rows[1].textContent).toContain('HVSC/MUSICIANS/H/Hubbard_Rob/file-2.sid');
      expect(rows[1].classList.contains('feed-row-fail')).toBe(true);
      expect(rows[1].querySelector('.feed-row-reason')).toBeFalsy();
      expect(native().querySelector('.feed-cap-note')).toBeFalsy();
      expect(q('transfer-progress-feed')?.textContent).not.toContain('last 20');
    });

    it('shows at most 5 feed rows, the cap the store already applied', async () => {
      const feed = Array.from({ length: 5 }, (_, i) => feedEntry(i + 1));
      await setup(baseVm({ state: 'receiving', feed }));

      expect(qAll('.feed-row').length).toBe(5);
    });

    it('shows the elapsed readout', async () => {
      await setup(baseVm({ state: 'receiving', elapsedLabel: '3:07 elapsed' }));

      expect(q('transfer-progress-elapsed')?.textContent).toContain('3:07 elapsed');
    });

    it('gives the Uploaded tile and the API bar the success treatment while draining', async () => {
      await setup(baseVm({ state: 'draining', uploaded: 12480, scanTotal: 12480, apiPercent: 100 }));

      expect(q('metric-uploaded')?.classList.contains('metric-success')).toBe(true);
      expect(q('api-bar')?.classList.contains('progress-success')).toBe(true);
      expect(q('api-bar-pct')?.textContent?.trim()).toBe('100%');
    });

    it('emits cancelRequested from the Cancel transfer action', async () => {
      await setup(baseVm({ state: 'receiving' }));
      const spy = vi.fn();
      component.cancelRequested.subscribe(spy);

      buttonByLabel('Cancel transfer')?.click();

      expect(spy).toHaveBeenCalled();
    });

    it('names each write bar with a distinct accessible name', async () => {
      await setup(baseVm({ state: 'receiving' }));

      const apiLabel = q('api-bar')?.getAttribute('aria-label');
      const deviceLabel = q('device-bar')?.getAttribute('aria-label');
      expect(apiLabel).toBeTruthy();
      expect(deviceLabel).toBeTruthy();
      expect(apiLabel).not.toBe(deviceLabel);
    });

    it('associates each metric label with its value through dt/dd', async () => {
      await setup(baseVm({ state: 'receiving' }));

      const tile = q('metric-uploaded');
      expect(tile?.tagName).toBe('DIV');
      expect(tile?.querySelector('dt.metric-label')).toBeTruthy();
      expect(tile?.querySelector('dd.metric-value')).toBeTruthy();
      expect(q('transfer-progress-metrics')?.tagName).toBe('DL');
    });

    it('gives the rate tile a spoken form for both figures with no raw slash-s glyph', async () => {
      await setup(baseVm({ state: 'receiving', filesPerSecond: 9.8, bytesPerSecond: 1_572_864 }));

      const spoken = q('metric-rate')?.querySelector('.visually-hidden');
      expect(spoken?.textContent).toBeTruthy();
      expect(spoken?.textContent).not.toContain('/s');
      expect(spoken?.textContent).toContain('9.8');
      expect(spoken?.textContent).toContain('1.5');
    });

    it('renders the recent feed as a named list of items matching the entries supplied', async () => {
      const feed = [feedEntry(1), feedEntry(2, false), feedEntry(3)];
      await setup(baseVm({ state: 'receiving', feed }));

      const list = q('transfer-progress-feed')?.querySelector('ul');
      expect(list?.getAttribute('aria-label')).toBeTruthy();
      expect(list?.querySelectorAll('li').length).toBe(feed.length);
    });
  });

  describe('expansion track', () => {
    it('is absent when the job has no archive, leaving the view pixel-identical to today', async () => {
      await setup(baseVm({ state: 'receiving', hasArchive: false }));

      expect(q('expansion-bar')).toBeFalsy();
      expect(q('expansion-bar-pct')).toBeFalsy();
      const labels = Array.from(qAll('.write-bar-caption span')).map((el) => el.textContent?.trim());
      expect(labels).not.toContain('Expanding archives');
    });

    it('renders as the first bar, showing the archive name while expanding', async () => {
      await setup(
        baseVm({
          state: 'receiving',
          hasArchive: true,
          expansionPercent: 41,
          expandingArchive: 'HVSC-79.zip',
          expansionComplete: false,
        })
      );

      const bars = qAll('.write-bar-caption span:first-child');
      expect(bars[0]?.textContent?.trim()).toBe('Expanding archives');

      expect(q('expansion-bar-pct')?.textContent?.trim()).toBe('HVSC-79.zip');
      expect(q('expansion-bar-pct')?.classList.contains('write-bar-pct-success')).toBe(false);
      expect(q('expansion-bar')?.getAttribute('aria-valuenow')).toBe('41');
      expect(q('expansion-bar')?.getAttribute('aria-label')).toBe('Expanding archives');
    });

    it('shows a success 100% once expansion is finished', async () => {
      await setup(
        baseVm({
          state: 'receiving',
          hasArchive: true,
          expansionPercent: 100,
          expandingArchive: null,
          expansionComplete: true,
        })
      );

      expect(q('expansion-bar-pct')?.textContent?.trim()).toBe('100%');
      expect(q('expansion-bar-pct')?.classList.contains('write-bar-pct-success')).toBe(true);
      expect(q('expansion-bar')?.classList.contains('progress-success')).toBe(true);
    });

    it('shows the bar at 0%, not a success 100%, before the first archive has started', async () => {
      await setup(
        baseVm({
          state: 'receiving',
          hasArchive: true,
          expansionPercent: 0,
          expandingArchive: null,
          expansionComplete: false,
        })
      );

      expect(q('expansion-bar')?.getAttribute('aria-valuenow')).toBe('0');
      expect(q('expansion-bar-pct')?.textContent?.trim()).not.toBe('100%');
      expect(q('expansion-bar-pct')?.classList.contains('write-bar-pct-success')).toBe(false);
    });

    it('resets and never moves backwards within one archive, including across a nested archive', async () => {
      await setup(
        baseVm({ state: 'receiving', hasArchive: true, expandingArchive: 'HVSC-79.zip', expansionPercent: 41 })
      );
      expect(q('expansion-bar')?.getAttribute('aria-valuenow')).toBe('41');

      fixture.componentRef.setInput(
        'vm',
        baseVm({ state: 'receiving', hasArchive: true, expandingArchive: 'HVSC-79.zip', expansionPercent: 78 })
      );
      fixture.detectChanges();
      expect(q('expansion-bar')?.getAttribute('aria-valuenow')).toBe('78');

      // A nested archive starts: the bar resets to that archive's own progress, not the job's.
      fixture.componentRef.setInput(
        'vm',
        baseVm({
          state: 'receiving',
          hasArchive: true,
          expandingArchive: 'HVSC-79/DEMOS/oldschool-pack.rar',
          expansionPercent: 12,
        })
      );
      fixture.detectChanges();
      expect(q('expansion-bar')?.getAttribute('aria-valuenow')).toBe('12');
      expect(q('expansion-bar-pct')?.textContent?.trim()).toBe('HVSC-79/DEMOS/oldschool-pack.rar');
    });

    it('mentions expansion in the live region while expanding, on the existing throttle, not a second channel', async () => {
      await setup(
        baseVm({ state: 'receiving', hasArchive: true, expandingArchive: 'HVSC-79.zip', expansionComplete: false })
      );

      const region = q('transfer-progress-live-region');
      expect(region?.textContent).toContain('Expanding archives');
      // Still exactly one live region in the whole component.
      expect(qAll('[aria-live]').length).toBe(1);
    });

    it('does not mention expansion once expansion has finished', async () => {
      await setup(
        baseVm({ state: 'receiving', hasArchive: true, expandingArchive: null, expansionComplete: true })
      );

      expect(q('transfer-progress-live-region')?.textContent).not.toContain('Expanding archives');
    });
  });

  describe('terminal states', () => {
    it('carries no banner when completed', async () => {
      await setup(baseVm({ state: 'completed', reason: null }));
      expect(q('transfer-progress-banner')).toBeFalsy();
    });

    it.each<TransferModalState>(['cancelled', 'aborted', 'abandoned'])(
      'carries the reason banner when %s',
      async (state) => {
        await setup(baseVm({ state, reason: 'stopped at your request' }));
        expect(q('transfer-progress-banner')?.textContent).toContain('stopped at your request');
      }
    );

    it('renders the active layout — tiles, bars, and elapsed — not the old summary hero', async () => {
      await setup(baseVm({ state: 'completed', written: 12474, failed: 6, elapsedLabel: '14:22 elapsed' }));

      expect(q('transfer-progress-summary')).toBeFalsy();
      const labels = Array.from(qAll('.metric-label')).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['Uploaded', 'Completed', 'Failed', 'Avg Rate']);
      expect(q('metric-written')?.textContent).toContain('12,474');
      expect(q('metric-failed')?.textContent).toContain('6');
      expect(q('api-bar')).toBeTruthy();
      expect(q('device-bar')).toBeTruthy();
      expect(q('transfer-progress-elapsed')?.textContent).toContain('14:22 elapsed');
    });

    it('omits the current-file row entirely — there is no current file in a terminal state', async () => {
      await setup(baseVm({ state: 'completed' }));
      expect(q('transfer-progress-current-file')).toBeFalsy();
    });

    // A wrong denominator here is the specific lie the separate denominators exist to prevent —
    // the written count measured against the browser's upload total on the screen read longest.
    it('carries the composed expandedTotal denominator, not the upload scanTotal, once an archive job settles', async () => {
      await setup(baseVm({ state: 'completed', written: 12474, scanTotal: 12480, expandedTotal: 12474 }));

      const value = q('metric-written')?.querySelector('.metric-value');
      expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('12,474/ 12,474');
      const spoken = q('metric-written')?.querySelector('.visually-hidden');
      expect(spoken?.textContent?.trim()).toBe('12,474 of 12,474');
    });

    it('carries no denominator on the Completed tile for an archive-free job', async () => {
      await setup(baseVm({ state: 'completed', written: 12474, scanTotal: 12480, expandedTotal: null }));

      const value = q('metric-written')?.querySelector('.metric-value');
      expect(value?.textContent?.trim()).toBe('12,474');
    });

    it('keeps the Uploaded tile on the browser scan total even when expandedTotal exists', async () => {
      await setup(baseVm({ state: 'completed', uploaded: 1204, scanTotal: 1204, expandedTotal: 1197 }));

      const value = q('metric-uploaded')?.querySelector('.metric-value');
      expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1,204/ 1,204');
    });

    it('caps the failure list and shows the overflow remainder', async () => {
      const failures = [feedEntry(1, false), feedEntry(2, false), feedEntry(3, false)];
      await setup(baseVm({ state: 'completed', failures, failureOverflow: 3 }));

      expect(qAll('.failure-row').length).toBe(3);
      expect(q('transfer-progress-failures-overflow')?.textContent?.trim()).toBe('and 3 more');
    });

    it('omits the overflow line when nothing overflowed', async () => {
      await setup(baseVm({ state: 'completed', failures: [feedEntry(1, false)], failureOverflow: 0 }));
      expect(q('transfer-progress-failures-overflow')).toBeFalsy();
    });

    it('names each write bar with a distinct accessible name in the terminal shape', async () => {
      await setup(baseVm({ state: 'completed' }));

      const apiLabel = q('api-bar')?.getAttribute('aria-label');
      const deviceLabel = q('device-bar')?.getAttribute('aria-label');
      expect(apiLabel).toBeTruthy();
      expect(deviceLabel).toBeTruthy();
      expect(apiLabel).not.toBe(deviceLabel);
    });

    it('renders the failures list as a named list whose item count matches overflow + entries', async () => {
      const failures = [feedEntry(1, false), feedEntry(2, false), feedEntry(3, false)];
      await setup(baseVm({ state: 'completed', failures, failureOverflow: 3 }));

      const list = q('transfer-progress-failures')?.querySelector('ul');
      expect(list?.getAttribute('aria-label')).toBeTruthy();
      // 3 failure rows plus the overflow row — every rendered row is a list item.
      expect(list?.querySelectorAll('li').length).toBe(4);
      expect(q('transfer-progress-failures-overflow')?.tagName).toBe('LI');
    });

    it('renders the empty failures row as a list item too', async () => {
      await setup(baseVm({ state: 'completed', failures: [], failureOverflow: 0 }));

      const list = q('transfer-progress-failures')?.querySelector('ul');
      expect(list?.querySelectorAll('li').length).toBe(1);
      expect(q('transfer-progress-no-failures')?.tagName).toBe('LI');
    });

    it('renders a long path and its reason as two separate, unellipsised lines', async () => {
      const relativePath = 'HVSC/'.repeat(15) + 'A_Very_Long_File_Name_That_Keeps_Going.sid'; // 90+ chars
      const reason = 'device write failed — the connection timed out after multiple retries'; // 40+ chars
      await setup(
        baseVm({
          state: 'completed',
          failures: [{ relativePath, fileName: 'A_Very_Long_File_Name_That_Keeps_Going.sid', success: false, reason }],
          failureOverflow: 0,
        })
      );

      const row = native().querySelector('.failure-row');
      const name = row?.querySelector('.failure-row-name');
      const rowReason = row?.querySelector('.failure-row-reason');
      expect(name?.textContent?.trim()).toBe(relativePath);
      expect(rowReason?.textContent?.trim()).toBe(reason);
      expect(name?.getAttribute('title')).toBeFalsy();
    });

    it('renders a compact success line when a completed job has no failures', async () => {
      await setup(baseVm({ state: 'completed', failures: [], failureOverflow: 0 }));

      expect(qAll('.failure-row').length).toBe(1);
      const emptyRow = q('transfer-progress-no-failures');
      expect(emptyRow?.textContent).toContain('No failures');
      expect(q('transfer-progress-failures-overflow')).toBeFalsy();
    });

    it('emits closeRequested from Close', async () => {
      await setup(baseVm({ state: 'completed' }));
      const spy = vi.fn();
      component.closeRequested.subscribe(spy);

      buttonByLabel('Close')?.click();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('emits retryRequested from Retry', async () => {
      await setup(baseVm({ state: 'device-busy' }));
      const spy = vi.fn();
      component.retryRequested.subscribe(spy);

      buttonByLabel('Retry')?.click();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('live region', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('exposes an aria-live region that updates on a meaningful delta but not on a trivial one', async () => {
      vi.useFakeTimers();
      await setup(baseVm({ state: 'receiving', devicePercent: 56 }));

      const region = q('transfer-progress-live-region');
      expect(region?.getAttribute('aria-live')).toBe('polite');
      const firstAnnouncement = region?.textContent;
      expect(firstAnnouncement).toBeTruthy();

      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 57 }));
      fixture.detectChanges();
      expect(q('transfer-progress-live-region')?.textContent).toBe(firstAnnouncement);

      vi.setSystemTime(Date.now() + 1100);
      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 75 }));
      fixture.detectChanges();
      expect(q('transfer-progress-live-region')?.textContent).not.toBe(firstAnnouncement);
    });

    it('announces immediately on a state transition regardless of the interval', async () => {
      await setup(baseVm({ state: 'receiving', devicePercent: 56 }));
      const firstAnnouncement = q('transfer-progress-live-region')?.textContent;

      fixture.componentRef.setInput('vm', baseVm({ state: 'draining', devicePercent: 56 }));
      fixture.detectChanges();

      expect(q('transfer-progress-live-region')?.textContent).not.toBe(firstAnnouncement);
    });

    // Regression guard: the terminal restructure (item 4) is a visual change only — the
    // announcement text screen readers rely on must stay exactly as it was.
    it.each<[TransferModalState, string]>([
      ['completed', 'Transfer complete. 100 written, 2 failed, averaging 9.8 files per second.'],
      ['cancelled', 'Transfer cancelled. 100 written, 2 failed.'],
      ['aborted', 'Transfer stopped. Device lost. 100 written, 2 failed.'],
      ['abandoned', 'Transfer wound up. Connection lost. 100 written, 2 failed.'],
    ])('keeps the %s announcement text unchanged by the visual restructure', async (state, expected) => {
      await setup(baseVm({ state, written: 100, failed: 2, reason: 'stopped at your request' }));

      expect(q('transfer-progress-live-region')?.textContent).toBe(expected);
    });

    it('paces a small transfer to at most one announcement per second even when every file crosses the delta threshold', async () => {
      vi.useFakeTimers();
      await setup(baseVm({ state: 'receiving', devicePercent: 10 }));
      const firstAnnouncement = q('transfer-progress-live-region')?.textContent;

      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 20 }));
      fixture.detectChanges();
      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 30 }));
      fixture.detectChanges();

      expect(q('transfer-progress-live-region')?.textContent).toBe(firstAnnouncement);
    });

    it('still announces a state change immediately inside the delta floor window', async () => {
      vi.useFakeTimers();
      await setup(baseVm({ state: 'receiving', devicePercent: 10 }));
      const firstAnnouncement = q('transfer-progress-live-region')?.textContent;

      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 20 }));
      fixture.detectChanges();
      fixture.componentRef.setInput('vm', baseVm({ state: 'draining', devicePercent: 20 }));
      fixture.detectChanges();

      expect(q('transfer-progress-live-region')?.textContent).not.toBe(firstAnnouncement);
    });

    it('paces a large transfer by the multi-second interval, unaffected by the delta floor', async () => {
      vi.useFakeTimers();
      await setup(baseVm({ state: 'receiving', devicePercent: 10, scanTotal: 60_000 }));
      const firstAnnouncement = q('transfer-progress-live-region')?.textContent;

      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 12, scanTotal: 60_000 }));
      fixture.detectChanges();
      expect(q('transfer-progress-live-region')?.textContent).toBe(firstAnnouncement);

      vi.setSystemTime(Date.now() + 4100);
      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 14, scanTotal: 60_000 }));
      fixture.detectChanges();
      expect(q('transfer-progress-live-region')?.textContent).not.toBe(firstAnnouncement);
    });

    it('never mentions rate in a running state announcement', async () => {
      await setup(baseVm({ state: 'receiving' }));
      expect(q('transfer-progress-live-region')?.textContent).not.toContain('per second');

      fixture.componentRef.setInput('vm', baseVm({ state: 'draining' }));
      fixture.detectChanges();
      expect(q('transfer-progress-live-region')?.textContent).not.toContain('per second');
    });
  });
});
