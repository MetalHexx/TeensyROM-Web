using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.ValueObjects;
using Xunit.Abstractions;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Hardware-backed coverage for every connection transition on the bench's real chip: the reboot round
/// trips recovery times against <see cref="ConnectionOptions"/>'s ceilings. Every command is composed and
/// invoked directly against the fixture's real <see cref="IDeviceConnectionManager"/> and
/// <see cref="IDeviceRecovery"/> - the same dependencies the command pipeline's own handlers take -
/// bypassing MediatR entirely; nothing here exercises storage indexing or the pipeline's cross-cutting
/// behaviors. With no hardware attached every test reports skipped, not failed - see
/// <see cref="HardwareFixture.HasHardware"/>.
/// </summary>
public class ConnectionTransitionsTests(HardwareFixture fixture, ITestOutputHelper output) : IClassFixture<HardwareFixture>
{
    // Real bench SD card content, the same files TeensyRom.Api.Tests.Integration's LaunchFileTests uses:
    // large enough that launching it reboots the device through minimal, small enough (a SID) to settle
    // in full as an IO handler instead.
    private static readonly LaunchableItem LargeLaunchItem = new()
    {
        Name = "Lemmings [EasyFlash].crt",
        Path = new FilePath("/games/Very Large/Lemmings [EasyFlash].crt")
    };

    private static readonly LaunchableItem SidLaunchItem = new()
    {
        Name = "Alpha.sid",
        Path = new FilePath("/music/MUSICIANS/L/LukHash/Alpha.sid")
    };

    [SkippableFact]
    public async Task LargeLaunch_FromFull_EndsInMinimalWithinToMinimalCeiling()
    {
        var device = GivenDevice();
        await EnsureFullAsync(device);

        var handler = BuildLaunchHandler();
        var (result, elapsed) = await fixture.MeasureAsync(output, "LargeLaunch (full -> minimal)",
            () => handler.Handle(LaunchCommand(device, LargeLaunchItem), CancellationToken.None));

        result.LaunchResult.Should().Be(LaunchFileResultType.Success);
        device.Connection.Mode.Should().Be(DeviceMode.Minimal);
        elapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToMinimalMs));
    }

    [SkippableFact]
    public async Task DirectoryListing_FromMinimal_LeavesMinimalAndListsWithinToFullCeiling()
    {
        var device = GivenDevice();
        await EnsureMinimalAsync(device);

        var listingHandler = new GetDirectoryRecursiveHandler(fixture.Log);
        var command = new GetDirectoryRecursiveCommand
        {
            StorageType = TeensyStorageType.SD,
            Path = new DirectoryPath("/"),
            Recursive = false,
            DeviceId = device.DeviceId,
            CommunicationPort = device.CommunicationPort
        };

        var (result, elapsed) = await fixture.MeasureAsync(output, "Minimal -> Full (directory listing)", async () =>
        {
            device.CommunicationPort.ResetDevice(fixture.Log);
            var outcome = await fixture.Recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);
            outcome.Reachable.Should().BeTrue("the device must leave minimal before a listing can be attempted");
            return await listingHandler.Handle(command, CancellationToken.None);
        });

        result.IsSuccess.Should().BeTrue();
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        elapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToFullMs));
    }

    [SkippableFact]
    public async Task SidLaunch_FromMinimal_SettlesInFullWithinToFullPlusSettleCeiling()
    {
        var device = GivenDevice();
        await EnsureMinimalAsync(device);

        var handler = BuildLaunchHandler();
        var (result, elapsed) = await fixture.MeasureAsync(output, "ChainedLaunch (minimal -> SID)",
            () => handler.Handle(LaunchCommand(device, SidLaunchItem), CancellationToken.None));

        result.LaunchResult.Should().Be(LaunchFileResultType.Success);
        device.Connection.Mode.Should().BeOneOf(DeviceMode.FullIdle, DeviceMode.FullBusy);
        elapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToFullMs + fixture.Options.LaunchSettleMs));
    }

    [SkippableFact]
    public async Task LargeLaunch_FromMinimal_EndsBackInMinimalWithinChainedCeiling()
    {
        var device = GivenDevice();
        await EnsureMinimalAsync(device);

        var handler = BuildLaunchHandler();
        var (result, elapsed) = await fixture.MeasureAsync(output, "ChainedLaunch (minimal -> large -> minimal)",
            () => handler.Handle(LaunchCommand(device, LargeLaunchItem), CancellationToken.None));

        result.LaunchResult.Should().Be(LaunchFileResultType.Success);
        device.Connection.Mode.Should().Be(DeviceMode.Minimal);
        elapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToFullMs + fixture.Ceilings.ToMinimalMs + fixture.Options.LaunchSettleMs));
    }

    [SkippableFact]
    public async Task Reset_InFull_LeavesTransportOpenWithoutInvokingRecovery()
    {
        var device = GivenDevice();
        await EnsureFullAsync(device);

        fixture.Log.ClearReceivedCalls();

        var resetHandler = new ResetCommandHandler(fixture.Log);
        var command = new ResetCommand { DeviceId = device.DeviceId, CommunicationPort = device.CommunicationPort };

        var (result, _) = await fixture.MeasureAsync(output, "Reset (full)", () => resetHandler.Handle(command, CancellationToken.None));

        result.IsSuccess.Should().BeTrue();

        // Over TCP nothing announces the reboot, so IsOpen alone would not catch a stale port - a
        // following version command answering is the real proof the transport is still good.
        device.CommunicationPort.IsOpen.Should().BeTrue();
        var reply = fixture.Interrogator.ReadVersion(device.CommunicationPort);
        reply.IsTeensyRom.Should().BeTrue();
        reply.ChipId.Should().Be(device.DeviceId);

        fixture.Log.DidNotReceive().Internal(Arg.Is<string>(s => s.Contains("DeviceRecovery")), Arg.Any<string?>());
    }

    private TeensyRomDevice GivenDevice()
    {
        Skip.If(!fixture.HasHardware, "no TeensyROM attached");
        var device = fixture.Device;
        Skip.If(device is null, $"no device confirmed on {fixture.Transport}");
        return device!;
    }

    private LaunchFileHandler BuildLaunchHandler() =>
        new(fixture.Log, fixture.Recovery, fixture.Manager, fixture.Interrogator, fixture.Options);

    private static LaunchFileCommand LaunchCommand(TeensyRomDevice device, LaunchableItem item) => new()
    {
        StorageType = TeensyStorageType.SD,
        LaunchItem = item,
        DeviceId = device.DeviceId,
        CommunicationPort = device.CommunicationPort
    };

    /// <summary>Brings the device to full firmware if it currently is not, mirroring <c>CommunicationPortBehavior</c>'s own minimal gate.</summary>
    private async Task EnsureFullAsync(TeensyRomDevice device)
    {
        if (device.Connection.Mode is DeviceMode.FullIdle or DeviceMode.FullBusy) return;

        device.CommunicationPort.ResetDevice(fixture.Log);
        var outcome = await fixture.Recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);
        outcome.Reachable.Should().BeTrue("a later phase needs the device to start from a known state");
    }

    /// <summary>Forces the device into minimal firmware via a large launch, unless it is already there.</summary>
    private async Task EnsureMinimalAsync(TeensyRomDevice device)
    {
        if (device.Connection.Mode == DeviceMode.Minimal) return;

        var handler = BuildLaunchHandler();
        var result = await handler.Handle(LaunchCommand(device, LargeLaunchItem), CancellationToken.None);

        result.LaunchResult.Should().Be(LaunchFileResultType.Success, "priming minimal for the next phase requires the large launch to succeed");
        device.Connection.Mode.Should().Be(DeviceMode.Minimal);
    }
}
