import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { TransferJobSnapshot } from '../models/transfer-job-snapshot.model';

/**
 * Service contract for the live transfer hub connection: joining a job's SignalR group,
 * receiving throttled snapshot pushes, and re-establishing group membership after an
 * automatic reconnect.
 */
export interface ITransferHubService {
  /** Joins the job group and returns the server's current snapshot synchronously. */
  subscribe(jobId: string): Promise<TransferJobSnapshot>;

  /** Leaves the job group. Only call once the client is genuinely done with the job. */
  unsubscribe(jobId: string): Promise<void>;

  /** Complete job snapshots pushed by the server, including the one seeded by `subscribe`. */
  readonly snapshots$: Observable<TransferJobSnapshot>;

  /** Stops the hub connection and releases resources. */
  disconnect(): Promise<void>;
}

/** Injection token for ITransferHubService to enable dependency injection by interface. */
export const TRANSFER_HUB_SERVICE = new InjectionToken<ITransferHubService>('TRANSFER_HUB_SERVICE');
