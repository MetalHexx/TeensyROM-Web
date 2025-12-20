using MediatR;
using Microsoft.AspNetCore.SignalR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.MuteSidVoices;

namespace TeensyRom.Api.Endpoints.DJ
{
    /// <summary>
    /// SignalR hub providing low-latency, real-time DJ commands for audio manipulation.
    /// </summary>
    public class DJHub(IMediator mediator, IDeviceConnectionManager deviceManager, ILogger<DJHub> logger) : Hub
    {

    /// <summary>
    /// Mutes or unmutes individual SID voices for real-time audio mixing.
    /// </summary>
    /// <param name="deviceId">The target TeensyROM device identifier.</param>
    /// <param name="voice1Enabled">State of SID voice 1 (Enabled/Disabled).</param>
    /// <param name="voice2Enabled">State of SID voice 2 (Enabled/Disabled).</param>
    /// <param name="voice3Enabled">State of SID voice 3 (Enabled/Disabled).</param>
    /// <returns>A task representing the asynchronous operation.</returns>
    /// <exception cref="HubException">Thrown when the specified device is not found or not connected.</exception>
    public async Task MuteSidVoices(
            string deviceId,
            VoiceState voice1Enabled,
            VoiceState voice2Enabled,
            VoiceState voice3Enabled)
        {
            var device = deviceManager.GetConnectedDevice(deviceId);
            if (device is null)
            {
                logger.LogWarning("DJ command failed: Device {DeviceId} not found", deviceId);
                throw new HubException($"Device not found: {deviceId}");
            }

            var command = new MuteSidVoicesCommand
            {
                DeviceId = deviceId,
                Voice1Enabled = voice1Enabled,
                Voice2Enabled = voice2Enabled,
                Voice3Enabled = voice3Enabled,
                Serial = device.SerialState
            };

            await mediator.Send(command, Context.ConnectionAborted);
        }
    }
}
