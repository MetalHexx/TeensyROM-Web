import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { TransferJobDto } from '@teensyrom-nx/data-access/api-client';
import {
  ITransferHubService,
  TransferJobSnapshot,
  API_CONFIG,
  IApiConfig,
} from '@teensyrom-nx/domain';
import { TransferDtoMapper } from './transfer-dto.mapper';

/**
 * Infrastructure implementation of ITransferHubService.
 *
 * Group membership is per-connection, not per-client: an automatic reconnect drops the
 * client out of every group even though the connection itself resumes. The `onreconnected`
 * handler re-invokes `Subscribe` for each subscribed job and `SubscribeAll` when the all-transfers
 * group was joined - without it, snapshots silently stop while transfers continue on the server.
 *
 * The notifier sends each snapshot to the job group and to the all-transfers group, so a
 * connection in both receives every push twice; identical repeats of a job's last push are dropped.
 */
@Injectable()
export class TransferHubService implements ITransferHubService, OnDestroy {
  private readonly snapshotSubject = new Subject<TransferJobSnapshot>();
  private readonly allResyncedSubject = new Subject<TransferJobSnapshot[]>();

  private hubConnection: signalR.HubConnection | null = null;
  private connectingPromise: Promise<signalR.HubConnection> | null = null;
  private readonly subscribedJobIds = new Set<string>();
  private wantsAll = false;
  private readonly lastPushByJob = new Map<string, string>();

  get snapshots$(): Observable<TransferJobSnapshot> {
    return this.snapshotSubject.asObservable();
  }

  get allResynced$(): Observable<TransferJobSnapshot[]> {
    return this.allResyncedSubject.asObservable();
  }

  constructor(@Inject(API_CONFIG) private readonly apiConfig: IApiConfig) {}

  async subscribe(jobId: string): Promise<TransferJobSnapshot> {
    const connection = await this.ensureConnected();
    const dto = await connection.invoke<TransferJobDto>('Subscribe', jobId);
    this.subscribedJobIds.add(jobId);
    return TransferDtoMapper.toSnapshot(dto);
  }

  async unsubscribe(jobId: string): Promise<void> {
    this.subscribedJobIds.delete(jobId);
    if (!this.hubConnection) return;
    await this.hubConnection.invoke('Unsubscribe', jobId);
  }

  async subscribeAll(): Promise<TransferJobSnapshot[]> {
    // Recorded before connecting so that any connection made from here on rejoins the group,
    // even when this call itself fails.
    this.wantsAll = true;
    const connection = await this.ensureConnected(false);
    const dtos = await connection.invoke<TransferJobDto[]>('SubscribeAll');
    return dtos.map((dto) => TransferDtoMapper.toSnapshot(dto));
  }

  async unsubscribeAll(): Promise<void> {
    this.wantsAll = false;
    if (!this.hubConnection) return;
    await this.hubConnection.invoke('UnsubscribeAll');
  }

  async disconnect(): Promise<void> {
    this.subscribedJobIds.clear();
    this.wantsAll = false;
    this.lastPushByJob.clear();
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

  /**
   * Starts the hub connection if it is not already running, and returns it. A freshly built
   * connection rejoins the all-transfers group when wanted, unless the caller is about to join
   * it itself.
   */
  private async ensureConnected(rejoinAll = true): Promise<signalR.HubConnection> {
    if (this.hubConnection) return this.hubConnection;
    if (!this.connectingPromise) {
      this.connectingPromise = this.buildAndStart(rejoinAll);
    }
    try {
      return await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async buildAndStart(rejoinAll: boolean): Promise<signalR.HubConnection> {
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

    connection.on('JobSnapshot', (dto: TransferJobDto) => this.emitSnapshot(dto));

    // SignalR groups are per-connection: a reconnect lands the client in no group even
    // though the connection resumes. Re-invoking Subscribe rejoins each job group so display
    // updates keep flowing. A rejection here means the job reached a terminal state and
    // was evicted by the server's retention sweep before the reconnect landed - an
    // ordinary end-of-job condition, not an error to surface.
    connection.onreconnected(async () => {
      for (const jobId of [...this.subscribedJobIds]) {
        try {
          const dto = await connection.invoke<TransferJobDto>('Subscribe', jobId);
          this.emitSnapshot(dto);
        } catch {
          this.subscribedJobIds.delete(jobId);
        }
      }
      if (this.wantsAll) {
        await this.rejoinAll(connection);
      }
    });

    await connection.start();
    this.hubConnection = connection;
    if (rejoinAll && this.wantsAll) {
      await this.rejoinAll(connection);
    }
    return connection;
  }

  /** Forwards a job push unless it repeats that job's previous push verbatim. */
  private emitSnapshot(dto: TransferJobDto): void {
    const raw = JSON.stringify(dto);
    if (this.lastPushByJob.get(dto.jobId) === raw) return;
    this.lastPushByJob.set(dto.jobId, raw);
    this.snapshotSubject.next(TransferDtoMapper.toSnapshot(dto));
  }

  /**
   * Re-invokes SubscribeAll on a connection that lost its groups and emits the full list.
   * A failure is left for the next connection or reconnect to retry.
   */
  private async rejoinAll(connection: signalR.HubConnection): Promise<void> {
    try {
      const dtos = await connection.invoke<TransferJobDto[]>('SubscribeAll');
      this.allResyncedSubject.next(dtos.map((dto) => TransferDtoMapper.toSnapshot(dto)));
    } catch {
      // The engine may be unreachable or the list unreadable; nothing to surface here.
    }
  }

  ngOnDestroy(): void {
    void this.disconnect();
  }
}
