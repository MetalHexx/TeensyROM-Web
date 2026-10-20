import { Injectable, Inject } from '@angular/core';
import { signal, Signal, WritableSignal, computed } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { IDeviceLogsService, ALERT_SERVICE, IAlertService, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';

const MAX_LOG_LINES = 200;

/**
 * Streams engine log lines over the log hub. Each service instance is its own listener: it subscribes
 * and unsubscribes only its own hub connection, so stopping one listener never stops another's log.
 */
@Injectable()
export class DeviceLogsService implements IDeviceLogsService {
  private readonly alertService: IAlertService;
  private readonly apiConfig: IApiConfig;
  private hubConnection: signalR.HubConnection | null = null;
  private readonly _logLines: WritableSignal<string[]> = signal([]);
  private readonly _isConnected = signal(false);

  readonly isConnected = this._isConnected.asReadonly();
  readonly logs: Signal<string[]> = computed(() => this._logLines());

  constructor(
    @Inject(ALERT_SERVICE) alertService: IAlertService,
    @Inject(API_CONFIG) apiConfig: IApiConfig
  ) {
    this.alertService = alertService;
    this.apiConfig = apiConfig;
  }

  connect() {
    if (this.hubConnection) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiConfig.signalRBasePath}/api/logHub`)
      .withAutomaticReconnect()
      .build();
    this.hubConnection = connection;

    connection.on('LogProduced', (log: string) => {
      this._logLines.update((lines) => [...lines.slice(-(MAX_LOG_LINES - 1)), log]);
    });

    // A reconnect gets a new connection id and loses its group membership, so it has to subscribe again.
    connection.onreconnected(async () => {
      try {
        await connection.invoke('Subscribe');
      } catch (error) {
        this.reportFailure('DeviceLogsService resubscribe error:', error, 'Failed to start device logs');
      }
    });

    void this.start(connection);
  }

  disconnect() {
    const connection = this.hubConnection;
    this.hubConnection = null;
    this._isConnected.set(false);
    if (!connection) return;

    void this.stop(connection);
  }

  clear() {
    this._logLines.set([]);
  }

  private async start(connection: signalR.HubConnection): Promise<void> {
    try {
      await connection.start();
      await connection.invoke('Subscribe');
    } catch (error) {
      // A disconnect that raced the start already tore this connection down.
      if (this.hubConnection !== connection) return;

      this._isConnected.set(false);
      this.hubConnection = null;
      this.reportFailure('Error starting Device Logs connection:', error, 'Failed to start device logs');
      await this.stopQuietly(connection);
      return;
    }

    if (this.hubConnection !== connection) return;

    this._isConnected.set(true);
    logInfo(LogType.Success, 'Device Logs Connection started');
  }

  private async stop(connection: signalR.HubConnection): Promise<void> {
    try {
      await connection.invoke('Unsubscribe');
    } catch (error) {
      this.reportFailure('DeviceLogsService.disconnect Unsubscribe error:', error, 'Failed to stop device logs');
    }

    await this.stopQuietly(connection);
  }

  /** Stopping a connection also removes its server-side subscription; a failure here has nothing left to undo. */
  private async stopQuietly(connection: signalR.HubConnection): Promise<void> {
    try {
      await connection.stop();
    } catch (error) {
      logError('DeviceLogsService connection stop error:', error);
    }
  }

  private reportFailure(context: string, error: unknown, fallbackMessage: string) {
    logError(context, error);
    this.alertService.error(error instanceof Error ? error.message : fallbackMessage);
  }
}
