import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TransferFeedEntry } from '@teensyrom-nx/application';
import { ConfirmationDialogComponent } from '@teensyrom-nx/ui/components';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { TransferProgressComponent, TransferProgressVm } from '../transfer-modal/transfer-progress/transfer-progress.component';
import { DevDropzoneFixtureComponent } from './dev-dropzone-fixture.component';

interface ProgressFixture {
  label: string;
  vm: TransferProgressVm;
}

const DEVICE_NAME = 'Workbench TR';
const DESTINATION_LABEL = 'SD · /music/';
const DROPPED_ROOT = 'HVSC';

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
    deviceName: DEVICE_NAME,
    destinationLabel: DESTINATION_LABEL,
    droppedRootName: DROPPED_ROOT,
    scanFound: 12480,
    scanTotal: 12480,
    uploaded: 8412,
    written: 6977,
    staged: 5231,
    failed: 4,
    apiPercent: 67,
    devicePercent: 56,
    currentFile: 'HVSC/MUSICIANS/H/Hubbard_Rob/Commando.sid',
    feed: [feedEntry(1), feedEntry(2, false), feedEntry(3)],
    failures: [feedEntry(2, false)],
    failureOverflow: 0,
    elapsedLabel: '14:22 elapsed',
    reason: null,
    ...overrides,
  };
}

export const CONFIRM_CANCEL_FIXTURE = {
  title: 'Cancel transfer?',
  message:
    '5,544 files already written to the device will remain. Files still staged or in flight will be discarded.',
  confirmLabel: 'Cancel transfer',
  cancelLabel: 'Keep transferring',
  confirmIcon: 'close',
  showLabels: true,
};

const SCAN_THROUGH_CANCELLING: ProgressFixture[] = [
  {
    label: 'scanning',
    vm: baseVm({
      state: 'scanning',
      scanFound: 8214,
      scanTotal: 0,
      uploaded: 0,
      written: 0,
      staged: 0,
      failed: 0,
      apiPercent: 0,
      devicePercent: 0,
      currentFile: null,
      feed: [],
      failures: [],
      elapsedLabel: null,
    }),
  },
  {
    label: 'starting',
    vm: baseVm({
      state: 'starting',
      scanFound: 12480,
      scanTotal: 12480,
      uploaded: 0,
      written: 0,
      staged: 0,
      failed: 0,
      apiPercent: 0,
      devicePercent: 0,
      currentFile: null,
      feed: [],
      failures: [],
      elapsedLabel: null,
    }),
  },
  {
    label: 'device-busy',
    vm: baseVm({
      state: 'device-busy',
      scanTotal: 12480,
      uploaded: 0,
      written: 0,
      staged: 0,
      failed: 0,
      currentFile: null,
      feed: [],
      failures: [],
      elapsedLabel: null,
    }),
  },
  {
    label: 'nothing-to-transfer',
    vm: baseVm({
      state: 'nothing-to-transfer',
      scanFound: 42,
      scanTotal: 0,
      uploaded: 0,
      written: 0,
      staged: 0,
      failed: 0,
      currentFile: null,
      feed: [],
      failures: [],
      elapsedLabel: null,
    }),
  },
  {
    label: 'failed',
    vm: baseVm({
      state: 'failed',
      reason: 'The destination directory was rejected by the device.',
      scanTotal: 0,
      uploaded: 0,
      written: 0,
      staged: 0,
      failed: 0,
      currentFile: null,
      feed: [],
      failures: [],
      elapsedLabel: null,
    }),
  },
  {
    label: 'receiving',
    vm: baseVm(),
  },
  {
    label: 'draining',
    vm: baseVm({
      state: 'draining',
      uploaded: 12480,
      written: 11932,
      staged: 0,
      failed: 6,
      apiPercent: 100,
      devicePercent: 96,
      currentFile: 'HVSC/MUSICIANS/H/Hubbard_Rob/Delta.sid',
      elapsedLabel: '21:03 elapsed',
    }),
  },
  {
    label: 'cancelling',
    vm: baseVm({
      state: 'cancelling',
      uploaded: 8412,
      written: 5544,
      staged: 5231,
      failed: 4,
      currentFile: 'HVSC/MUSICIANS/H/Hubbard_Rob/Sanxion.sid',
      elapsedLabel: '16:40 elapsed',
    }),
  },
];

const TERMINAL_STATES: ProgressFixture[] = [
  {
    label: 'completed',
    vm: baseVm({
      state: 'completed',
      reason: null,
      uploaded: 12480,
      written: 12476,
      staged: 0,
      failed: 4,
      apiPercent: 100,
      devicePercent: 100,
      currentFile: null,
      elapsedLabel: '24:18 elapsed',
      failures: [feedEntry(2, false)],
      failureOverflow: 3,
    }),
  },
  {
    label: 'cancelled',
    vm: baseVm({
      state: 'cancelled',
      reason: 'Transfer stopped at your request. Files already written to the device remain.',
      uploaded: 8412,
      written: 5544,
      staged: 0,
      failed: 4,
      apiPercent: 67,
      devicePercent: 44,
      currentFile: null,
      elapsedLabel: '16:40 elapsed',
      failures: [feedEntry(2, false)],
      failureOverflow: 3,
    }),
  },
  {
    label: 'aborted',
    vm: baseVm({
      state: 'aborted',
      reason: 'The device disconnected mid-transfer.',
      uploaded: 5210,
      written: 4188,
      staged: 0,
      failed: 2,
      apiPercent: 42,
      devicePercent: 34,
      currentFile: null,
      elapsedLabel: '9:52 elapsed',
      failures: [feedEntry(7, false)],
      failureOverflow: 1,
    }),
  },
  {
    label: 'abandoned',
    vm: baseVm({
      state: 'abandoned',
      reason:
        'The server stopped hearing from this browser and closed the job. Files staged but not yet written were discarded.',
      uploaded: 2044,
      written: 1602,
      staged: 0,
      failed: 1,
      apiPercent: 16,
      devicePercent: 13,
      currentFile: null,
      elapsedLabel: '4:07 elapsed',
      failures: [feedEntry(3, false)],
      failureOverflow: 0,
    }),
  },
];

/**
 * Throwaway dev-only page — reachable only by typing `/dev/transfer-states` in the browser.
 * Renders every ephemeral file-transfer UI state as a static fixture card so UI refinement work
 * doesn't need a real device/backend to trigger states like `device-busy` or `aborted`.
 */
@Component({
  selector: 'lib-dev-transfer-fixtures',
  imports: [TransferProgressComponent, ConfirmationDialogComponent, DevDropzoneFixtureComponent],
  templateUrl: './dev-transfer-fixtures.component.html',
  styleUrl: './dev-transfer-fixtures.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevTransferFixturesComponent {
  // This route bypasses LayoutComponent, the only place ThemeService is normally injected —
  // without this, ThemeService never constructs and the app's dark-mode class never applies.
  private readonly themeService = inject(ThemeService);

  readonly scanThroughCancelling = SCAN_THROUGH_CANCELLING;
  readonly terminalStates = TERMINAL_STATES;
  readonly confirmCancelFixture = CONFIRM_CANCEL_FIXTURE;
}
