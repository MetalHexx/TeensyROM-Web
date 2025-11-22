import {
  Component,
  ViewChild,
  ElementRef,
  inject,
  effect,
  EffectRef,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { DEVICE_LOGS_SERVICE, IDeviceLogsService } from '@teensyrom-nx/domain';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { IconButtonComponent, ScalingCardComponent } from '@teensyrom-nx/ui/components';

@Component({
  selector: 'lib-device-logs',
  templateUrl: './device-logs.component.html',
  styleUrls: ['./device-logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    IconButtonComponent,
    ScalingCardComponent,
  ],
})
export class DeviceLogsComponent {
  private readonly logsService: IDeviceLogsService = inject(DEVICE_LOGS_SERVICE);
  readonly logs = this.logsService.logs;
  readonly isConnected = this.logsService.isConnected;
  private readonly autoScroll = signal(true);

  logEffectRef: EffectRef | undefined = effect(() => {
    const logs = this.logs();
    if (logs.length && this.autoScroll()) {
      queueMicrotask(() => this.scrollToElement());
    }
  });

  @ViewChild('logsContent') logsContentRef!: ElementRef<HTMLDivElement>;

  startLogs() {
    this.logsService.connect();
  }

  stopLogs() {
    this.logsService.disconnect();

    if (this.logEffectRef) this.logEffectRef.destroy();
  }

  clearLogs() {
    this.logsService.clear();
  }

  scrollToElement(): void {
    const element = this.logsContentRef.nativeElement;
    if (element && typeof element.scroll === 'function') {
      element.scroll({
        top: element.scrollHeight,
        left: 0,
        behavior: 'smooth',
      });
    }
  }

  onScroll(): void {
    const element = this.logsContentRef.nativeElement;
    const isAtBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 5;
    this.autoScroll.set(isAtBottom);
  }
}
