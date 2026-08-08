import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { TransferJobDto, TransferFileCompleted } from '@teensyrom-nx/data-access/api-client';
import {
  ITransferHubService,
  TransferJobSnapshot,
  TransferFileCompletion,
  API_CONFIG,
  IApiConfig,
} from '@teensyrom-nx/domain';
import { TransferDtoMapper } from './transfer-dto.mapper';

/**
 * Infrastructure implementation of ITransferHubService.
 *
 * Group membership is per-connection, not per-client: an automatic reconnect drops the
 * client out of the job group even though the connection itself resumes. The `onreconnected`
 * handler re-invokes `Subscribe` for the active job so the client rejoins the group - without
 * it, snapshots silently stop while the transfer continues on the server.
 */
@Injectable()
export class TransferHubService implements ITransferHubService, OnDestroy {
  private readonly snapshotSubject = new Subject<TransferJobSnapshot>();
  private readonly completionSubject = new Subject<TransferFileCompletion>();

  private hubConnection: signalR.HubConnection | null = null;
  private connectingPromise: Promise<signalR.HubConnection> | null = null;
  private activeJobId: string | null = null;

  get snapshots$(): Observable<TransferJobSnapshot> {
    return this.snapshotSubject.asObservable();
  }

  get fileCompletions$(): Observable<TransferFileCompletion> {
    return this.completionSubject.asObservable();
  }

  constructor(@Inject(API_CONFIG) private readonly apiConfig: IApiConfig) {}

  async subscribe(jobId: string): Promise<TransferJobSnapshot> {
    const connection = await this.ensureConnected();
    const dto = await connection.invoke<TransferJobDto>('Subscribe', jobId);
    this.activeJobId = jobId;
    return TransferDtoMapper.toSnapshot(dto);
  }

  async unsubscribe(jobId: string): Promise<void> {
    if (this.activeJobId === jobId) {
      this.activeJobId = null;
    }
    if (!this.hubConnection) return;
    await this.hubConnection.invoke('Unsubscribe', jobId);
  }

  async disconnect(): Promise<void> {
    this.activeJobId = null;
    const connection = this.hubConnection;
    this.hubConnection = null;
    if (connection) {
      try {
        await connection.stop();
      } catch {
        // Ignore errors during teardown - we're already disconnecting.
      }
    }
  }

  /** Starts the hub connection if it is not already running, and returns it. */
  private async ensureConnected(): Promise<signalR.HubConnection> {
    if (this.hubConnection) return this.hubConnection;
    if (!this.connectingPromise) {
      this.connectingPromise = this.buildAndStart();
    }
    try {
      return await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async buildAndStart(): Promise<signalR.HubConnection> {
    const hubUrl = `${this.apiConfig.signalRBasePath}/api/transferHub`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Retry with exponential backoff: 0s, 2s, 10s, 30s, then 60s
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          if (retryContext.previousRetryCount === 3) return 30000;
          return 60000;
        },
      })
      .build();

    connection.on('JobSnapshot', (dto: TransferJobDto) =>
      this.snapshotSubject.next(TransferDtoMapper.toSnapshot(dto))
    );
    connection.on('FileCompleted', (dto: TransferFileCompleted) =>
      this.completionSubject.next(TransferDtoMapper.toFileCompletion(dto))
    );

    // SignalR groups are per-connection: a reconnect lands the client in no group even
    // though the connection resumes. Re-invoking Subscribe rejoins the group so display
    // updates keep flowing. A rejection here means the job reached a terminal state and
    // was evicted by the server's retention sweep before the reconnect landed - an
    // ordinary end-of-job condition, not an error to surface.
    connection.onreconnected(async () => {
      if (!this.activeJobId) return;
      try {
        const dto = await connection.invoke<TransferJobDto>('Subscribe', this.activeJobId);
        this.snapshotSubject.next(TransferDtoMapper.toSnapshot(dto));
      } catch {
        this.activeJobId = null;
      }
    });

    await connection.start();
    this.hubConnection = connection;
    return connection;
  }

  ngOnDestroy(): void {
    void this.disconnect();
  }
}
