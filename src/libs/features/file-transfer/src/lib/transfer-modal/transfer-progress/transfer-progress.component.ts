import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActionButtonComponent, IconLabelComponent, StyledIconComponent } from '@teensyrom-nx/ui/components';
import { TransferFeedEntry, TransferModalState } from '@teensyrom-nx/application';

export interface TransferProgressVm {
  state: TransferModalState;
  deviceName: string;
  destinationLabel: string;
  droppedRootName: string | null;
  scanFound: number;
  scanTotal: number;
  uploaded: number;
  written: number;
  staged: number;
  failed: number;
  apiPercent: number;
  devicePercent: number;
  currentFile: string | null;
  feed: TransferFeedEntry[];
  failures: TransferFeedEntry[];
  failureOverflow: number;
  elapsedLabel: string | null;
  reason: string | null;
}

/** Which family of frame a state renders — several states share the same layout shape. */
type RenderShape = 'scan' | 'busy-refusal' | 'nothing-to-transfer' | 'active' | 'cancelling' | 'terminal';

type BottomBarMode = 'determinate' | 'indeterminate' | null;

const STATE_SHAPES: Record<TransferModalState, RenderShape> = {
  scanning: 'scan',
  starting: 'scan',
  'device-busy': 'busy-refusal',
  failed: 'busy-refusal',
  'nothing-to-transfer': 'nothing-to-transfer',
  receiving: 'active',
  draining: 'active',
  cancelling: 'cancelling',
  completed: 'terminal',
  cancelled: 'terminal',
  aborted: 'terminal',
  abandoned: 'terminal',
};

/**
 * Target dialog width per render shape — the mockup's content-heavy vs. small-state widths, plus
 * the terminal state's wider allowance for full failure paths. Every value clamps to the viewport
 * in `frameWidth` below, so a narrow window never pushes the dialog off-screen.
 */
const SHAPE_WIDTH_PX: Record<RenderShape, number> = {
  scan: 480,
  'busy-refusal': 480,
  'nothing-to-transfer': 480,
  active: 760,
  cancelling: 760,
  terminal: 900,
};

const STATE_TITLES: Record<TransferModalState, (vm: TransferProgressVm) => string> = {
  scanning: () => 'Scanning Files',
  starting: () => 'Starting transfer',
  'device-busy': () => 'Device Busy',
  'nothing-to-transfer': () => 'Nothing to transfer',
  failed: () => "Transfer couldn't start",
  receiving: (vm) => `Transferring to ${vm.deviceName}`,
  // Same wording as `receiving` — the title must not change when the job seals.
  draining: (vm) => `Transferring to ${vm.deviceName}`,
  cancelling: () => 'Cancelling',
  completed: () => 'Transfer Completed',
  cancelled: () => 'Transfer cancelled',
  aborted: () => 'Transfer Stopped: Device Lost',
  abandoned: () => 'Transfer Stopped: Connection Lost',
};

const STATE_BOTTOM_BAR: Record<TransferModalState, BottomBarMode> = {
  scanning: 'indeterminate',
  starting: 'indeterminate',
  'device-busy': null,
  'nothing-to-transfer': null,
  failed: null,
  // The write-bars (API/device) already cover progress for these states, so the modal-level
  // bar underneath the actions would be redundant.
  receiving: null,
  draining: null,
  cancelling: 'indeterminate',
  completed: null,
  cancelled: null,
  aborted: null,
  abandoned: null,
};

const SCAN_CENTER: Partial<Record<TransferModalState, { valueKey: 'scanFound' | 'scanTotal'; label: string }>> = {
  scanning: { valueKey: 'scanFound', label: 'files found' },
  starting: { valueKey: 'scanTotal', label: 'files ready to send' },
};

const TERMINAL_BANNER_TREATMENT: Partial<Record<TransferModalState, 'neutral' | 'error'>> = {
  cancelled: 'neutral',
  aborted: 'error',
  abandoned: 'error',
};

const TERMINAL_BANNER_ICON: Partial<Record<TransferModalState, string>> = {
  cancelled: 'stop_circle',
  aborted: 'link_off',
  abandoned: 'warning',
};

const STATE_ANNOUNCEMENTS: Record<TransferModalState, (vm: TransferProgressVm) => string> = {
  scanning: (vm) => `${vm.scanFound} files found`,
  starting: (vm) => `${vm.scanTotal} files ready to send`,
  'device-busy': (vm) => `${vm.deviceName} is busy. Nothing has been sent.`,
  'nothing-to-transfer': () => 'Nothing to transfer.',
  failed: (vm) => vm.reason ?? "Transfer couldn't start.",
  receiving: (vm) =>
    `${vm.devicePercent}% written to device. ${vm.uploaded} of ${vm.scanTotal} uploaded, ${vm.failed} failed.`,
  draining: (vm) => `${vm.devicePercent}% written to device. Upload complete, ${vm.failed} failed.`,
  cancelling: () => 'Cancelling. Finishing current file.',
  completed: (vm) => `Transfer complete. ${vm.written} written, ${vm.failed} failed.`,
  cancelled: (vm) => `Transfer cancelled. ${vm.written} written, ${vm.failed} failed.`,
  aborted: (vm) => `Transfer stopped. Device lost. ${vm.written} written, ${vm.failed} failed.`,
  abandoned: (vm) => `Transfer wound up. Connection lost. ${vm.written} written, ${vm.failed} failed.`,
};

/** Minimum time between live-region announcements while a state keeps re-emitting the same vm. */
const ANNOUNCE_INTERVAL_MS = 4000;
/** A device-percent swing this large announces immediately, interval notwithstanding. */
const ANNOUNCE_DELTA_PERCENT = 5;

/**
 * Renders every state a transfer can be in, from the indeterminate scan count through both live
 * progress bars to the terminal summary. Purely presentational — inputs in, events out, no store
 * or service injected — so the modal shell that hosts it owns all sequencing and side effects.
 */
@Component({
  selector: 'lib-transfer-progress',
  imports: [DecimalPipe, MatProgressBarModule, ActionButtonComponent, IconLabelComponent, StyledIconComponent],
  templateUrl: './transfer-progress.component.html',
  styleUrl: './transfer-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog has no width of its own (see layout.component.ts) — the host's width drives it,
  // keyed off the render shape, so the shell stays dumb and each shape auto-sizes correctly.
  host: {
    '[style.width]': 'frameWidth()',
  },
})
export class TransferProgressComponent {
  vm = input.required<TransferProgressVm>();
  cancelRequested = output<void>();
  retryRequested = output<void>();
  closeRequested = output<void>();

  private readonly announcement = signal('');
  readonly liveRegionText = this.announcement.asReadonly();

  private lastAnnouncedState: TransferModalState | null = null;
  private lastAnnouncedAt = 0;
  private lastAnnouncedPercent = -1;

  readonly renderShape = computed(() => STATE_SHAPES[this.vm().state]);
  readonly title = computed(() => STATE_TITLES[this.vm().state](this.vm()));
  readonly bottomBarMode = computed(() => STATE_BOTTOM_BAR[this.vm().state]);
  readonly frameWidth = computed(
    () => `min(${SHAPE_WIDTH_PX[this.renderShape()]}px, calc(100vw - 2 * var(--spacing-2xl)))`
  );

  readonly hasSubtitle = computed(() => this.vm().state !== 'nothing-to-transfer');
  readonly subtitle = computed(() => {
    const vm = this.vm();
    if (vm.state === 'scanning' && vm.droppedRootName) {
      return `${vm.droppedRootName} → ${vm.destinationLabel}`;
    }
    return vm.destinationLabel;
  });

  readonly scanCenterValue = computed(() => {
    const cfg = SCAN_CENTER[this.vm().state];
    return cfg ? this.vm()[cfg.valueKey] : 0;
  });
  readonly scanCenterLabel = computed(() => SCAN_CENTER[this.vm().state]?.label ?? '');

  readonly deviceBusyMessage = computed(
    () => `${this.vm().deviceName} already has a transfer in progress. Nothing has been sent.`
  );
  readonly queuedMessage = computed(() => `${this.vm().scanTotal} scanned files are still queued.`);

  readonly uploadedTileSuccess = computed(() => this.vm().state === 'draining');
  readonly apiBarSuccess = computed(() => this.vm().state === 'draining');
  readonly metricsMuted = computed(() => this.vm().state === 'cancelling');

  readonly terminalBannerTreatment = computed(() => TERMINAL_BANNER_TREATMENT[this.vm().state] ?? null);
  readonly terminalBannerIcon = computed(() => TERMINAL_BANNER_ICON[this.vm().state] ?? 'warning');

  constructor() {
    // Throttled so a 60,000-file job's per-file snapshots don't flood a screen reader — announce
    // on a fixed cadence or on a meaningful percent swing, and always on a state transition.
    effect(() => {
      const vm = this.vm();
      const now = Date.now();
      const stateChanged = vm.state !== this.lastAnnouncedState;
      const percentDelta = Math.abs(vm.devicePercent - this.lastAnnouncedPercent);
      const dueForInterval = now - this.lastAnnouncedAt >= ANNOUNCE_INTERVAL_MS;

      if (!stateChanged && !dueForInterval && percentDelta < ANNOUNCE_DELTA_PERCENT) {
        return;
      }

      untracked(() => {
        this.lastAnnouncedState = vm.state;
        this.lastAnnouncedAt = now;
        this.lastAnnouncedPercent = vm.devicePercent;
        this.announcement.set(STATE_ANNOUNCEMENTS[vm.state](vm));
      });
    });
  }

  onCancel(): void {
    this.cancelRequested.emit();
  }

  onRetry(): void {
    this.retryRequested.emit();
  }

  onClose(): void {
    this.closeRequested.emit();
  }
}
