import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TransferFeedEntry } from '@teensyrom-nx/application';
import { ConfirmationDialogComponent } from '@teensyrom-nx/ui/components';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import {
  TransferProgressComponent,
  TransferProgressVm,
} from '../transfer-modal/transfer-progress/transfer-progress.component';
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
    failed: 4,
    apiPercent: 67,
    devicePercent: 56,
    hasArchive: false,
    expansionPercent: 0,
    expandingArchive: null,
    expansionComplete: false,
    expandedTotal: null,
    filesPerSecond: 9.8,
    bytesPerSecond: 1_400_000,
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

const SCAN_THROUGH_DRAINING: ProgressFixture[] = [
  {
    label: 'scanning',
    vm: baseVm({
      state: 'scanning',
      scanFound: 8214,
      scanTotal: 0,
      uploaded: 0,
      written: 0,
      failed: 0,
      apiPercent: 0,
      devicePercent: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
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
      failed: 0,
      apiPercent: 0,
      devicePercent: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
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
      failed: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
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
      failed: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
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
      failed: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
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
    label: 'receiving — expanding a top-level archive',
    vm: baseVm({
      scanTotal: 1204,
      uploaded: 842,
      written: 0,
      failed: 0,
      apiPercent: 69,
      devicePercent: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
      hasArchive: true,
      expansionPercent: 41,
      expandingArchive: 'HVSC-79.zip',
      feed: [],
      failures: [],
      elapsedLabel: '0:38 elapsed',
    }),
  },
  {
    label: 'receiving — expanding a nested archive',
    vm: baseVm({
      scanTotal: 1204,
      uploaded: 1097,
      written: 0,
      failed: 1,
      apiPercent: 91,
      devicePercent: 0,
      filesPerSecond: 0,
      bytesPerSecond: 0,
      hasArchive: true,
      expansionPercent: 78,
      expandingArchive: 'HVSC-79/DEMOS/oldschool-pack.rar',
      feed: [],
      failures: [],
      elapsedLabel: '2:11 elapsed',
    }),
  },
  {
    label: 'receiving — expansion finished, device writing',
    vm: baseVm({
      scanTotal: 1204,
      uploaded: 1168,
      written: 4318,
      failed: 2,
      apiPercent: 97,
      devicePercent: 34,
      filesPerSecond: 9.8,
      bytesPerSecond: 1_300_000,
      hasArchive: true,
      expansionPercent: 100,
      expansionComplete: true,
      expandedTotal: 12480,
      feed: [
        {
          relativePath: 'HVSC-79/MUSICIANS/H/Hubbard_Rob/Commando.sid',
          fileName: 'Commando.sid',
          success: true,
          reason: null,
        },
        {
          relativePath: 'HVSC-79/DEMOS/oldschool-pack/intro.prg',
          fileName: 'intro.prg',
          success: true,
          reason: null,
        },
        {
          relativePath: 'HVSC-79/DEMOS/oldschool-pack/loader.prg',
          fileName: 'loader.prg',
          success: false,
          reason: 'device write failed — timeout 1',
        },
      ],
      failures: [
        {
          relativePath: 'HVSC-79/DEMOS/oldschool-pack/loader.prg',
          fileName: 'loader.prg',
          success: false,
          reason: 'device write failed — timeout 1',
        },
      ],
      elapsedLabel: '6:04 elapsed',
    }),
  },
  {
    label: 'draining',
    vm: baseVm({
      state: 'draining',
      uploaded: 12480,
      written: 11932,
      failed: 6,
      apiPercent: 100,
      devicePercent: 96,
      filesPerSecond: 9.8,
      bytesPerSecond: 1_400_000,
      elapsedLabel: '21:03 elapsed',
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
      failed: 4,
      apiPercent: 100,
      devicePercent: 100,
      filesPerSecond: 8.6,
      bytesPerSecond: 1_300_000,
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
      failed: 4,
      apiPercent: 67,
      devicePercent: 44,
      filesPerSecond: 5.5,
      bytesPerSecond: 825_000,
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
      failed: 2,
      apiPercent: 42,
      devicePercent: 34,
      filesPerSecond: 7.1,
      bytesPerSecond: 1_050_000,
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
      failed: 1,
      apiPercent: 16,
      devicePercent: 13,
      filesPerSecond: 6.5,
      bytesPerSecond: 950_000,
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

  readonly scanThroughDraining = SCAN_THROUGH_DRAINING;
  readonly terminalStates = TERMINAL_STATES;
  readonly confirmCancelFixture = CONFIRM_CANCEL_FIXTURE;
}
