import { Injectable, Inject, Signal, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { IDjService, VoiceState } from '@teensyrom-nx/domain';
import { ALERT_SERVICE, IAlertService, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { logError } from '@teensyrom-nx/utils';

/**
 * Infrastructure layer service that manages SignalR connection to the DJ hub.
 * Provides real-time, low-latency DJ command execution for audio manipulation.
 *
 * Uses lazy connection pattern: connection is established on first command invocation,
 * then reused for subsequent calls. This minimizes startup time while ensuring
 * the connection is ready when needed.
 */
@Injectable()
export class DjService implements IDjService {
  private hubConnection: signalR.HubConnection | null = null;

  constructor(
    @Inject(ALERT_SERVICE) private alertService: IAlertService,
    @Inject(API_CONFIG) private apiConfig: IApiConfig
  ) {}

  /**
   * Mutes or unmutes individual SID voices on the specified device.
   * Invokes the DJHub.MuteSidVoices method via SignalR.
   *
   * @param deviceId - The device ID to send the command to
   * @param voice1 - Desired state for voice 1 (Enabled/Disabled)
   * @param voice2 - Desired state for voice 2 (Enabled/Disabled)
   * @param voice3 - Desired state for voice 3 (Enabled/Disabled)
   * @returns Signal that completes when command is sent to hub
   */
  muteVoices(
    deviceId: string,
    voice1: VoiceState,
    voice2: VoiceState,
    voice3: VoiceState
  ): Signal<void> {
    const result = signal<void>(undefined);

    this.executeCommand(deviceId, voice1, voice2, voice3)
      .then(() => {
        // Signal completes on success
      })
      .catch((error) => {
        this.handleError(error, 'muteVoices', 'Unable to adjust voice settings. Please try again.');
      });

    return result.asReadonly();
  }

  /**
   * Executes the mute voices command with proper error handling.
   *
   * @private
   */
  private async executeCommand(
    deviceId: string,
    voice1: VoiceState,
    voice2: VoiceState,
    voice3: VoiceState
  ): Promise<void> {
    await this.ensureConnected();

    if (!this.hubConnection) {
      throw new Error('Hub connection failed to initialize');
    }

    await this.hubConnection.invoke('MuteSidVoices', deviceId, voice1, voice2, voice3);
  }

  /**
   * Ensures the SignalR hub connection is established.
   * Uses lazy connection pattern: connection created on first call, then reused.
   * Handles reconnection automatically if connection drops.
   *
   * @private
   * @returns Promise that resolves when connection is ready
   */
  private async ensureConnected(): Promise<void> {
    // Connection already established - return immediately
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Connection in progress - wait for it
    if (this.hubConnection?.state === signalR.HubConnectionState.Connecting) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout'));
        }, 5000);
      });
    }

    // Create and start new connection
    if (!this.hubConnection) {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.apiConfig.signalRBasePath}/api/djHub`)
        .withAutomaticReconnect()
        .build();
    }

    try {
      await this.hubConnection.start();
    } catch (error) {
      this.hubConnection = null;
      throw error;
    }
  }

  /**
   * Handles errors from hub invocations.
   * Logs error and shows user-friendly alert.
   *
   * @private
   * @param error - The error that occurred
   * @param methodName - Name of the method that failed
   * @param friendlyMessage - User-friendly error message specific to the operation
   */
  private handleError(error: unknown, methodName: string, friendlyMessage: string): void {
    logError(`DjService.${methodName} error:`, error);
    this.alertService.error(friendlyMessage);
  }
}
