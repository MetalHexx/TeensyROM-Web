import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { LiveTransfer } from '@teensyrom-nx/application';
import { TransferJobState, TransferOriginKind } from '@teensyrom-nx/domain';
import { TransferRowComponent } from './transfer-row.component';

const transfer = (overrides: Partial<LiveTransfer> = {}): LiveTransfer => ({
  deviceId: 'device-1',
  jobId: 'job-1',
  origin: { kind: TransferOriginKind.Upload, watchFolderId: null, watchFolderPath: null },
  state: TransferJobState.Receiving,
  filesSent: 8,
  filesReceived: 8,
  totalFiles: 12,
  fileTotal: 12,
  devicePercent: 67,
  bytesPerSecond: 2048,
  startedAt: 0,
  startedHere: true,
  ...overrides,
});

describe('TransferRowComponent', () => {
  let fixture: ComponentFixture<TransferRowComponent>;

  const setup = (value: LiveTransfer = transfer()) => {
    fixture = TestBed.createComponent(TransferRowComponent);
    fixture.componentRef.setInput('transfer', value);
    fixture.componentRef.setInput('deviceName', 'TR-1');
    fixture.componentRef.setInput('originLabel', 'Upload');
    fixture.componentRef.setInput('elapsedLabel', '0:42 elapsed');
    fixture.detectChanges();
  };

  const text = (testId: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();

  it('renders the device, origin, percent and stats it is given', () => {
    setup();

    expect(text('transfer-row-device')).toBe('TR-1');
    expect(text('transfer-row-origin')).toContain('Upload');
    expect(text('transfer-row-percent')).toBe('67%');
    expect(text('transfer-row-files')).toBe('8 of 12 files');
    expect(text('transfer-row-rate')).toBe('2 KB/s');
    expect(text('transfer-row-elapsed')).toBe('0:42 elapsed');
  });

  it('emits showRequested from its expand button', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.showRequested.subscribe(spy);

    fixture.nativeElement.querySelector('[data-testid="transfer-row-show"] button').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
