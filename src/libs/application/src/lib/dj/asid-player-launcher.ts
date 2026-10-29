import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ALERT_SERVICE,
  DEVICE_SERVICE,
  type AsidLaunchOutcome,
  type IAlertService,
  type IDeviceService,
} from '@teensyrom-nx/domain';
import { logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeviceStore } from '../device/device-store';
import { DjStore } from './dj-store';
import { DECK_SLOTS, type Slot } from './slot';

/**
 * Starts the ASID player on every bound deck's cartridge, independently, and tells the DJ the
 * outcome. One deck's failure never stops or undoes another's launch.
 */
@Injectable({ providedIn: 'root' })
export class AsidPlayerLauncher {
  private readonly store = inject(DjStore);
  private readonly deviceService: IDeviceService = inject(DEVICE_SERVICE);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly deviceStore = inject(DeviceStore);

  /**
   * Launches the ASID player on each bound deck's cartridge concurrently and raises an error alert
   * naming each deck that failed, and an info alert for each cartridge moved to USB (even when its
   * launch then failed). When any cartridge moved, the device list is refreshed afterwards because the
   * device's connection details changed. Does nothing while a launch is already running or when no
   * deck is bound.
   */
  async launch(): Promise<void> {
    if (this.store.asidLaunching()) {
      return;
    }

    const bound = DECK_SLOTS.flatMap((slot) => {
      const device = this.store.binding(slot)().device;
      return device ? [{ slot, deviceId: device.id }] : [];
    });
    if (bound.length === 0) {
      return;
    }

    this.store.setAsidLaunching({ launching: true });
    logInfo(
      LogType.Start,
      `AsidPlayerLauncher: starting the ASID player on decks ${this.names(bound)}`
    );

    try {
      const outcomes = await Promise.all(
        bound.map(({ slot, deviceId }) => this.launchDeck(slot, deviceId))
      );

      let moved = false;
      outcomes.forEach((outcome, index) => {
        moved = this.report(bound[index].slot, outcome) || moved;
      });

      if (moved) {
        void this.deviceStore.findDevices();
      }
    } finally {
      this.store.setAsidLaunching({ launching: false });
    }
  }

  private async launchDeck(slot: Slot, deviceId: string): Promise<AsidLaunchOutcome> {
    try {
      return await firstValueFrom(this.deviceService.launchAsidPlayer(deviceId));
    } catch (error) {
      logError(`AsidPlayerLauncher: deck ${slot} launch rejected`, error);
      return {
        launched: false,
        reason: 'launchFailed',
        message: 'The ASID player could not be started.',
      };
    }
  }

  /**
   * Raises the alerts for one deck's outcome: an error for a failure, and the info alert whenever its
   * cartridge moved to USB, launched or not. Returns true when the cartridge moved.
   */
  private report(slot: Slot, outcome: AsidLaunchOutcome): boolean {
    if (!outcome.launched) {
      logError(`AsidPlayerLauncher: deck ${slot} failed (${outcome.reason})`, outcome.message);
      this.alertService.error(`Deck ${slot}: ${outcome.message}`);
    } else {
      logInfo(
        LogType.Success,
        `AsidPlayerLauncher: deck ${slot} ASID player started (moved to serial: ${outcome.movedToSerial})`
      );
    }

    const moved = outcome.movedToSerial === true;
    if (moved) {
      this.alertService.info(
        `Deck ${slot}'s cartridge moved to USB for the ASID player; it returns to the network on the next reconnect.`
      );
    }
    return moved;
  }

  private names(bound: { slot: Slot }[]): string {
    return bound.map(({ slot }) => slot).join(', ');
  }
}
