using MediatR;
using System.Diagnostics;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.LaunchAsidPlayer
{
    /// <summary>
    /// Starts the firmware's built-in ASID player. The player turns the network off, so a device on the network is
    /// first moved onto its USB serial port. Nothing here sends a MediatR command: the handler awaits the manager's
    /// occasion while the command gate holds the device's lock.
    /// </summary>
    public class LaunchAsidPlayerHandler(
        ILoggingService log,
        IDeviceConnectionManager devices,
        ConnectionOptions options) : IRequestHandler<LaunchAsidPlayerCommand, LaunchAsidPlayerResult>
    {
        private const string RemoteLaunchReport = "Remote Launch:";

        public async Task<LaunchAsidPlayerResult> Handle(LaunchAsidPlayerCommand r, CancellationToken cancellationToken)
        {
            var device = devices.GetAvailableDevice(r.DeviceId!);

            if (device is null)
            {
                return Disconnected();
            }

            var launchDevice = device;
            var launchPort = device.CommunicationPort;
            var movedToSerial = false;

            if (device.ConnectionType == ConnectionType.Tcp)
            {
                log.Internal($"LaunchAsidPlayerHandler: {device.Cart.Name} is on the network; moving it onto USB serial for the ASID player");
                var outcome = await devices.MoveToSerialAsync(device.DeviceId, cancellationToken);

                switch (outcome.Result)
                {
                    case SerialMoveResult.Moved:
                        movedToSerial = true;
                        launchDevice = outcome.Device!;
                        launchPort = launchDevice.CommunicationPort;
                        break;

                    case SerialMoveResult.AlreadyOnSerial:
                        launchDevice = outcome.Device!;
                        launchPort = launchDevice.CommunicationPort;
                        break;

                    case SerialMoveResult.TransferActive:
                        return new()
                        {
                            IsSuccess = false,
                            ActiveTransferJobId = outcome.ActiveJobId,
                            Error = $"{device.Cart.Name} is busy with a transfer."
                        };

                    case SerialMoveResult.SerialUnreachable:
                        return new()
                        {
                            IsSuccess = false,
                            UsbUnreachable = true,
                            Error = $"{device.Cart.Name} could not be reached over USB, so its ASID player was not started."
                        };

                    default:
                        return Disconnected();
                }
            }

            if (ReferenceEquals(launchPort, r.CommunicationPort))
            {
                return Launch(launchDevice, launchPort, movedToSerial);
            }

            // The gate holds the retired port, and its link recovery would act on it, so nothing may escape from here.
            try
            {
                return Launch(launchDevice, launchPort, movedToSerial);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                log.InternalError($"LaunchAsidPlayerHandler: the ASID launch on {launchDevice.Connection.SerialPortName} failed: {ex.Message}");
                return new()
                {
                    IsSuccess = false,
                    MovedToSerial = movedToSerial,
                    Error = $"{launchDevice.Cart.Name} failed during the ASID player launch: {ex.Message}"
                };
            }
        }

        private LaunchAsidPlayerResult Launch(TeensyRomDevice device, ICommunicationPort port, bool movedToSerial)
        {
            var ack = port.SendLaunch(AsidPlayerEntry.BuiltInMenuDrive, AsidPlayerEntry.Path, log);

            if (ack == TeensyToken.RetryLaunch)
            {
                return new() { IsSuccess = false, MovedToSerial = movedToSerial, Error = "TeensyROM declined the launch." };
            }

            if (!AwaitLaunchReport(port))
            {
                return new()
                {
                    IsSuccess = false,
                    MovedToSerial = movedToSerial,
                    Error = $"{device.Cart.Name} did not report starting its ASID player. Its firmware may not include the built-in player."
                };
            }

            // Not marked busy: the cartridge still answers while the player runs, and a busy record would make the
            // gate reset the C64, ending the player, before the next request.
            device.MarkIdle();
            return new() { MovedToSerial = movedToSerial };
        }

        /// <summary>
        /// Over USB serial the firmware prints <c>Remote Launch:</c> with the directory and entry straight after the
        /// second ack, once both lookups found the entry and before it touches the C64. Reads as the data lands, like
        /// the launch handler's reset-line loop, and stops at the report or <see cref="ConnectionOptions.LaunchSettleMs"/>.
        /// The later boot lines follow a C64 reset and are not waited for.
        /// </summary>
        private bool AwaitLaunchReport(ICommunicationPort port)
        {
            var received = string.Empty;
            var stopwatch = Stopwatch.StartNew();

            while (!IsReport(received))
            {
                var remainingMs = options.LaunchSettleMs - (int)stopwatch.ElapsedMilliseconds;

                if (remainingMs <= 0)
                {
                    break;
                }

                try
                {
                    port.WaitForSerialData(numBytes: 1, timeoutMs: remainingMs);
                }
                catch (TimeoutException)
                {
                    break;
                }

                var buffer = new byte[Math.Max(1, port.BytesToRead)];
                var bytesRead = port.Read(buffer, 0, buffer.Length);

                if (bytesRead <= 0)
                {
                    break;
                }

                received += buffer[..bytesRead].ToUtf8();
            }

            return IsReport(received);
        }

        private static bool IsReport(string text) =>
            text.Contains(RemoteLaunchReport, StringComparison.Ordinal) &&
            text.Contains(AsidPlayerEntry.EntryName, StringComparison.Ordinal);

        private static LaunchAsidPlayerResult Disconnected() =>
            new() { IsSuccess = false, Error = "Disconnected from TeensyROM before the ASID launch." };
    }
}
