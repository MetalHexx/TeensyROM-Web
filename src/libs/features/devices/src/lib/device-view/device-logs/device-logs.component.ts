import {
  Component,
  ViewChild,
  ElementRef,
  inject,
  effect,
  EffectRef,
  ChangeDetectionStrategy,
  signal,
  AfterViewInit,
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
export class DeviceLogsComponent implements AfterViewInit {
  private readonly logsService: IDeviceLogsService = inject(DEVICE_LOGS_SERVICE);
  readonly logs = this.logsService.logs;
  readonly isConnected = this.logsService.isConnected;

  // autoScroll is true by default, disabled when user scrolls up
  readonly autoScroll = signal(true);

  logEffectRef: EffectRef | undefined = effect(() => {
    const logs = this.logs();
    if (logs.length && this.autoScroll()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.scrollToElement());
      });
    }
  });

  @ViewChild('logsContent') logsContentRef!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    // Scroll to bottom on init if there are logs
    if (this.logs().length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.scrollToElement());
      });
    }
  }

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
    if (!this.logsContentRef) return;
    const element = this.logsContentRef.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }

  onScroll(): void {
    if (!this.logsContentRef) return;
    const element = this.logsContentRef.nativeElement;
    const threshold = 100;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.autoScroll.set(distanceFromBottom < threshold);
  }
}
