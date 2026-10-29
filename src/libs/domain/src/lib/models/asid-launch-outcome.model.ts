/** Why the ASID player could not be started on a cartridge. */
export type AsidLaunchFailureReason = 'notFound' | 'busy' | 'usbUnreachable' | 'launchFailed';

/** The result of asking a cartridge to start its ASID player. */
export type AsidLaunchOutcome =
  | { readonly launched: true; readonly movedToSerial: boolean }
  | {
      readonly launched: false;
      readonly reason: AsidLaunchFailureReason;
      readonly message: string;
    };
