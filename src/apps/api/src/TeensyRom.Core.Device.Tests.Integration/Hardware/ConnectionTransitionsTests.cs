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
/// behaviors. With no hardware attached the test reports skipped, not failed - see
/// <see cref="HardwareFixture.HasHardware"/>.
///
/// Written as one scripted flow rather than independent facts, mirroring <see cref="DiscoveryOccasionsTests"/>:
/// each transition's starting state is the previous transition's end state, and xUnit gives no ordering
/// guarantee between independent <c>[Fact]</c>s in the same class - a real bench run proved this
/// empirically (transitions executed out of declaration order, sending a launch command while the device
/// was mid-operation and hanging the ack). Shares its fixture with <see cref="DiscoveryOccasionsTests"/>
/// via <see cref="HardwareCollection"/> so the two classes never race for the same physical connection.
/// </summary>
[Collection(HardwareCollection.Name)]
public class ConnectionTransitionsTests(HardwareFixture fixture, ITestOutputHelper output)
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
    public async Task ConnectionTransitions_FullMinimalRoundTripsAndReset()
    {
        var device = GivenDevice();
        var handler = BuildLaunchHandler();

        // Transition 1: full -> minimal (large launch).
        await EnsureFullAsync(device);

        var (largeFromFull, largeFromFullElapsed) = await fixture.MeasureAsync(output, "LargeLaunch (full -> minimal)",
            () => handler.Handle(LaunchCommand(device, LargeLaunchItem), CancellationToken.None));

        largeFromFull.LaunchResult.Should().Be(LaunchFileResultType.Success);
        device.Connection.Mode.Should().Be(DeviceMode.Minimal);
        largeFromFullElapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToMinimalMs));

        // Transition 2: minimal -> full (directory listing forces the reboot path).
        var listingHandler = new GetDirectoryRecursiveHandler(fixture.Log);
        var listingCommand = new GetDirectoryRecursiveCommand
        {
            StorageType = TeensyStorageType.SD,
            Path = new DirectoryPath("/"),
            Recursive = false,
            DeviceId = device.DeviceId,
            CommunicationPort = device.CommunicationPort
        };

        var (listing, listingElapsed) = await fixture.MeasureAsync(output, "Minimal -> Full (directory listing)", async () =>
        {
            device.CommunicationPort.ResetFromMinimal(fixture.Log);
            var outcome = await fixture.Recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);
            outcome.Reachable.Should().BeTrue("the device must leave minimal before a listing can be attempted");
            return await listingHandler.Handle(listingCommand, CancellationToken.None);
        });

        listing.IsSuccess.Should().BeTrue();
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        listingElapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToFullMs));

        // Transition 3: minimal -> full (reset-and-recover), then a SID launch settles in full as an IO
        // handler. The firmware can still chain a launch straight through minimal on its own, but the gate
        // (CommunicationPortBehavior) never lets a command reach it that way any more - minimal always earns
        // an explicit reset+recovery first, launches included - so this stage drives the same two steps by
        // hand instead of relying on a chain. Before this amendment, the direct chain measured 8.7-8.8 s on
        // TCP against a ToFullMs + LaunchSettleMs ceiling, and a later bench session's chain attempt never
        // completed at all (see CONNECTION-2-BENCH-RUNBOOK.md's session note) - the reason the chain was
        // dropped, not because it was slow.
        await EnsureMinimalAsync(device);

        var (sidLaunch, sidLaunchElapsed) = await fixture.MeasureAsync(output, "SidLaunch (minimal -> full, reset-and-recover)", async () =>
        {
            await EnsureFullAsync(device);
            return await handler.Handle(LaunchCommand(device, SidLaunchItem), CancellationToken.None);
        });

        sidLaunch.LaunchResult.Should().Be(LaunchFileResultType.Success);
        device.Connection.Mode.Should().BeOneOf(DeviceMode.FullIdle, DeviceMode.FullBusy);
        sidLaunchElapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToFullMs + fixture.Options.LaunchSettleMs));

        // Transition 4: minimal -> full (reset-and-recover) -> minimal (large launch reboots the device to
        // receive it). Same harness-trap fix as transition 3: EnsureFullAsync stands in for the gate's own
        // minimal reset before the large launch is sent. Before this amendment, the direct chain measured
        // 15.2 s on TCP against a ToFullMs + ToMinimalMs + LaunchSettleMs ceiling.
        await EnsureMinimalAsync(device);

        var (largeFromMinimal, largeFromMinimalElapsed) = await fixture.MeasureAsync(output, "LargeLaunch (minimal -> full -> minimal, reset-and-recover)", async () =>
        {
            await EnsureFullAsync(device);
            return await handler.Handle(LaunchCommand(device, LargeLaunchItem), CancellationToken.None);
        });

        largeFromMinimal.LaunchResult.Should().Be(LaunchFileResultType.Success);
        device.Connection.Mode.Should().Be(DeviceMode.Minimal);
        largeFromMinimalElapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Ceilings.ToFullMs + fixture.Ceilings.ToMinimalMs + fixture.Options.LaunchSettleMs));

        // Occasion: reset while full leaves the transport open without invoking recovery.
        await EnsureFullAsync(device);
        fixture.Log.ClearReceivedCalls();

        var resetHandler = new ResetCommandHandler(fixture.Log);
        var resetCommand = new ResetCommand { DeviceId = device.DeviceId, CommunicationPort = device.CommunicationPort };

        var (resetResult, _) = await fixture.MeasureAsync(output, "Reset (full)", () => resetHandler.Handle(resetCommand, CancellationToken.None));

        resetResult.IsSuccess.Should().BeTrue();

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

        device.CommunicationPort.ResetFromMinimal(fixture.Log);
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
