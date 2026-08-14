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
      ['cancelling', 'Cancelling'],
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

      expect(q('metric-rate')?.textContent).toContain('9.8/s');
      expect(q('metric-rate')?.textContent).toContain('1.5 MB/s');
    });

    it('reads 0.0/s and 0 B/s when stalled, not a held prior value', async () => {
      await setup(baseVm({ state: 'receiving', filesPerSecond: 0, bytesPerSecond: 0 }));

      expect(q('metric-rate')?.textContent).toContain('0.0/s');
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
  });

  describe('cancelling', () => {
    it('mutes the tiles, drops the feed, and disables the cancel control', async () => {
      await setup(baseVm({ state: 'cancelling' }));

      expect(q('transfer-progress-metrics')?.classList.contains('metrics-muted')).toBe(true);
      expect(q('transfer-progress-feed')).toBeFalsy();

      const cancelButton = buttonByLabel('Cancel transfer');
      expect(cancelButton?.disabled).toBe(true);

      const spy = vi.fn();
      component.cancelRequested.subscribe(spy);
      cancelButton?.click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('orders the tiles Uploaded, Completed, Failed, Rate, in step with the active shape', async () => {
      await setup(baseVm({ state: 'cancelling' }));

      const labels = Array.from(qAll('.metric-label')).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['Uploaded', 'Completed', 'Failed', 'Rate']);
    });

    it('renders uploaded-of-total and completed-of-total as one unbroken run, matching the active shape', async () => {
      await setup(baseVm({ state: 'cancelling', uploaded: 40000, scanTotal: 60000, written: 6977 }));

      const uploaded = q('metric-uploaded')?.querySelector('.metric-value');
      expect(uploaded?.textContent?.replace(/\s+/g, ' ').trim()).toBe('40,000/ 60,000');
      const written = q('metric-written')?.querySelector('.metric-value');
      expect(written?.textContent?.replace(/\s+/g, ' ').trim()).toBe('6,977/ 60,000');
    });

    it('renders no current-file element in the cancelling state', async () => {
      await setup(baseVm({ state: 'cancelling' }));

      expect(q('transfer-progress-current-file')).toBeFalsy();
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
    it('exposes an aria-live region that updates on a meaningful delta but not on a trivial one', async () => {
      await setup(baseVm({ state: 'receiving', devicePercent: 56 }));

      const region = q('transfer-progress-live-region');
      expect(region?.getAttribute('aria-live')).toBe('polite');
      const firstAnnouncement = region?.textContent;
      expect(firstAnnouncement).toBeTruthy();

      fixture.componentRef.setInput('vm', baseVm({ state: 'receiving', devicePercent: 57 }));
      fixture.detectChanges();
      expect(q('transfer-progress-live-region')?.textContent).toBe(firstAnnouncement);

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
      ['completed', 'Transfer complete. 100 written, 2 failed.'],
      ['cancelled', 'Transfer cancelled. 100 written, 2 failed.'],
      ['aborted', 'Transfer stopped. Device lost. 100 written, 2 failed.'],
      ['abandoned', 'Transfer wound up. Connection lost. 100 written, 2 failed.'],
    ])('keeps the %s announcement text unchanged by the visual restructure', async (state, expected) => {
      await setup(baseVm({ state, written: 100, failed: 2, reason: 'stopped at your request' }));

      expect(q('transfer-progress-live-region')?.textContent).toBe(expected);
    });
  });
});
