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
    staged: 5231,
    failed: 4,
    apiPercent: 67,
    devicePercent: 56,
    currentFile: 'HVSC/MUSICIANS/H/Hubbard_Rob/Commando.sid',
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
      ['scanning', 'Scanning dropped folder'],
      ['starting', 'Starting transfer'],
      ['device-busy', 'Device is busy'],
      ['nothing-to-transfer', 'Nothing to transfer'],
      ['failed', "Transfer couldn't start"],
      ['receiving', 'Transferring to Unnamed'],
      ['draining', 'Writing to Unnamed'],
      ['cancelling', 'Cancelling — finishing current file'],
      ['completed', 'Transfer complete'],
      ['cancelled', 'Transfer cancelled'],
      ['aborted', 'Transfer stopped — device lost'],
      ['abandoned', 'Transfer wound up — connection lost'],
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
          staged: 5231, // deliberately not scanTotal - uploaded - failed, to prove no recomputation
          failed: 4,
          scanTotal: 12480,
          apiPercent: 67,
          devicePercent: 56,
        })
      );

      expect(q('metric-uploaded')?.textContent).toContain('8,412');
      expect(q('metric-uploaded')?.textContent).toContain('12,480');
      expect(q('metric-written')?.textContent).toContain('6,977');
      expect(q('metric-staged')?.textContent?.trim()).toContain('5,231');
      expect(q('metric-failed')?.textContent?.trim()).toContain('4');
      expect(q('api-bar-pct')?.textContent?.trim()).toBe('67%');
      expect(q('device-bar-pct')?.textContent?.trim()).toBe('56%');
    });

    it('renders the current file and the capped feed newest-first, as supplied', async () => {
      const feed = [feedEntry(1), feedEntry(2, false), feedEntry(3)];
      await setup(baseVm({ state: 'receiving', feed, currentFile: 'HVSC/a/b/Current.sid' }));

      expect(q('transfer-progress-current-file')?.textContent).toContain('Current.sid');
      const rows = qAll('.feed-row');
      expect(rows.length).toBe(feed.length);
      expect(rows[0].textContent).toContain('file-1.sid');
      expect(rows[1].textContent).toContain('file-2.sid');
      expect(rows[1].querySelector('.feed-row-reason')?.textContent).toContain('device write failed');
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

    it('renders the summary hero from the supplied figures', async () => {
      await setup(baseVm({ state: 'completed', written: 12474, failed: 6, elapsedLabel: '14:22 elapsed' }));

      const summary = q('transfer-progress-summary');
      expect(summary?.textContent).toContain('12,474');
      expect(summary?.textContent).toContain('6');
      expect(summary?.textContent).toContain('14:22 elapsed');
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
  });
});
