/** Why the ASID player could not be started on a cartridge. */
export type AsidLaunchFailureReason = 'notFound' | 'busy' | 'usbUnreachable' | 'launchFailed';

/**
 * The result of asking a cartridge to start its ASID player. A failure carries `movedToSerial` when the
 * cartridge had already moved onto USB before the launch failed.
 */
export type AsidLaunchOutcome =
  | { readonly launched: true; readonly movedToSerial: boolean }
  | {
      readonly launched: false;
      readonly reason: AsidLaunchFailureReason;
      readonly message: string;
      readonly movedToSerial?: boolean;
    };
