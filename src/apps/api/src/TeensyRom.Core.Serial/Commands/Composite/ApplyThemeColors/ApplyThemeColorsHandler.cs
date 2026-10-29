using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Composite.ApplyThemeColors
{
    /// <summary>
    /// Sends the seven menu colors, then resets the device once so the C64 shows them. Stops at the first
    /// color the device refuses and sends no reset. A busy reply propagates to the gate, which resets the
    /// device and sends the whole command again: every step is idempotent.
    /// </summary>
    public class ApplyThemeColorsHandler(ILoggingService log, ConnectionOptions options, IDeviceConnectionManager devices)
        : IRequestHandler<ApplyThemeColorsCommand, ApplyThemeColorsResult>
    {
        public Task<ApplyThemeColorsResult> Handle(ApplyThemeColorsCommand request, CancellationToken cancellationToken)
        {
            var port = request.CommunicationPort;

            try
            {
                foreach (var (slot, color) in request.Colors.InSlotOrder())
                {
                    port.SetColor(slot, (uint)color);
                }
            }
            catch (TeensyException ex) when (ex is not TeensyBusyException)
            {
                return Task.FromResult(new ApplyThemeColorsResult { IsSuccess = false, Error = ex.Message });
            }

            var boot = port.ResetDevice(log, options.MenuBootTimeoutMs);
            port.ClearBuffers();

            switch (boot)
            {
                case MenuBootOutcome.StillBooting:
                    devices.GetAvailableDevice(request.DeviceId!)?.MarkMenuBootPending();
                    break;
                case MenuBootOutcome.NotStarted:
                    return Task.FromResult(new ApplyThemeColorsResult
                    {
                        IsSuccess = false,
                        Error = "The colors were sent, but the C64 did not come back to its menu after the reset."
                    });
            }
            return Task.FromResult(new ApplyThemeColorsResult());
        }
    }
}
