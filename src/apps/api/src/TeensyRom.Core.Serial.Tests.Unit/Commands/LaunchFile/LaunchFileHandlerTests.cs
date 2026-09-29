using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Tests.Unit.Routines;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.LaunchFile
{
    public class LaunchFileHandlerTests
    {
        private const string ChipId = "19307720";
        private const string DeviceId = "device-1";

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();
        private readonly IDeviceRecovery _recovery = Substitute.For<IDeviceRecovery>();
        private readonly IDeviceConnectionManager _devices = Substitute.For<IDeviceConnectionManager>();
        private readonly IDeviceInterrogator _interrogator = Substitute.For<IDeviceInterrogator>();

        // Two iterations of the watch loop's 25 ms tick: enough for "empty read, then data" scripting
        // without spending real test time - the fake port never actually sleeps.
        private static ConnectionOptions FastOptions() => new() { LaunchSettleMs = 50 };

        // The default settle time, so a cart's after-load line can be scripted past the 100 ms
        // back-to-menu window (virtual time: the fake port never sleeps).
        private static ConnectionOptions CartLoadOptions() => new() { LaunchSettleMs = 2_000 };

        private static LaunchFileCommand BuildCommand(ScriptedCommunicationPort port, string? deviceId = null, string path = "/games/game.crt", long size = 900_000) => new()
        {
            StorageType = TeensyStorageType.SD,
            LaunchItem = new LaunchableItem { Path = new FilePath(path), Size = size },
            CommunicationPort = port,
            DeviceId = deviceId
        };

        private TeensyRomDevice BuildDevice(ScriptedCommunicationPort port, DeviceMode mode)
        {
            var cart = new Cart { DeviceId = ChipId };
            var connection = new DeviceConnectionRecord(ChipId);

            if (mode == DeviceMode.FullBusy)
            {
                // Confirm rejects FullBusy directly - start FullIdle, then mark busy, so a later
                // MarkIdle() call is provable by the mode flipping back.
                connection.Confirm(ConnectionType.Serial, "COM7", DeviceMode.FullIdle);
                connection.MarkBusy();
            }
            else
            {
                connection.Confirm(ConnectionType.Serial, "COM7", mode);
            }

            var device = new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>(), connection);
            _devices.GetAvailableDevice(DeviceId).Returns(device);
            return device;
        }

        private LaunchFileHandler BuildHandler() => BuildHandler(FastOptions());

        private LaunchFileHandler BuildHandler(ConnectionOptions options) => new(_log, _recovery, _devices, _interrogator, options);

        private const string ResetLine = "Resetting C64\r\n";

        [Fact]
        public async Task Handle_SidLaunch_GoodSIDTokenOnSecondRead_ReturnsSuccessWithoutInterrogatorOrRecovery()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.NewSegment().EnqueueToken(TeensyToken.GoodSIDToken);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, path: "/music/tune.sid"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// Over USB serial the firmware also prints text the TCP side never gets - the launch itself at
        /// once, the cart's IO handler once it has loaded - none of it a reset line, so a cart launched
        /// from the menu still owes one, and the one it gets proves the load.
        /// </summary>
        [Fact]
        public async Task Handle_CartLaunchOverSerial_UsbOnlyTextThenResetLine_ReturnsSuccessWithoutConfirm()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(5, "Remote Launch:\nP:/games/\nF:game.crt\n");
            port.EnqueueTextAfterQuiet(300, "Loading IO handler: EasyFlash\n" + ResetLine);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            var handler = BuildHandler(CartLoadOptions());

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// The reported defect's shape: over TCP the firmware's "Loading IO handler:" text never arrives
        /// (it is USB-serial-only), so the watch window sees silence and the version reply says full - but
        /// the running cart still owns the IO handler, so the record must not be called idle.
        /// </summary>
        [Fact]
        public async Task Handle_CartLaunchOverTcp_SilenceThenFullVersionReply_MarksDeviceBusy()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty with { IsTeensyRom = true, IsMinimalFirmware = false });
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/5th Gear.crt"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// A SID launched while a cart runs: the firmware resets back to the menu and plays it there, so
        /// the busy record the cart left must not survive - the next pause would reset the C64.
        /// </summary>
        [Fact]
        public async Task Handle_SidLaunchWhileACartRuns_GoodSIDToken_MarksDeviceIdle()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.NewSegment().EnqueueText(ResetLine).EnqueueToken(TeensyToken.GoodSIDToken);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/music/tune.sid"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
        }

        /// <summary>A SID the player rejects still leaves the C64 in the menu, so a cart's busy record goes too.</summary>
        [Fact]
        public async Task Handle_SidLaunchWhileACartRuns_BadSIDToken_ReturnsSidErrorAndMarksDeviceIdle()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.NewSegment().EnqueueText(ResetLine).EnqueueToken(TeensyToken.BadSIDToken);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/music/tune.sid"), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.SidError);
            device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
        }

        /// <summary>A SID keeps playing under the TeensyROM handler, so the device stays reachable and idle.</summary>
        [Fact]
        public async Task Handle_SidLaunch_SilenceThenFullVersionReply_MarksDeviceIdle()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty with { IsTeensyRom = true, IsMinimalFirmware = false });
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/music/tune.sid"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        }

        [Fact]
        public async Task Handle_LargeLaunchOverTcp_SilenceThenEmptyVersionReply_RecoversWithLargeLaunchReason()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.FromSeconds(1), null));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.Received(1).RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>());
        }

        [Fact]
        public async Task Handle_LargeLaunchOverTcp_RecoveryReturnsFullIdle_ReturnsDidNotTakeError()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.FullIdle, TimeSpan.Zero, TimeSpan.FromSeconds(1), "expected Minimal, device is in FullIdle"));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.Error);
            result.Error.Should().Be("The launch did not take: the device came back in full firmware.");
        }

        [Fact]
        public async Task Handle_LargeLaunchOverTcp_RecoveryReturnsUnreachable_ReturnsDisconnected()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Unreachable, TimeSpan.Zero, TimeSpan.FromSeconds(1), "no reply"));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.Disconnected);
        }

        [Fact]
        public async Task Handle_LargeLaunchOverSerial_PortClosedOnNextRead_RecoversWithoutCallingInterrogator()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.ThrowOnNextRead(new InvalidOperationException("The port is closed"));
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.FromSeconds(1), null));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.Received(1).RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// The firmware says nothing more about an image, text or program once it has accepted the path,
        /// and none of them can drop the transport - so the launch is done at the ack, with no watch window
        /// and no version confirm (bench: a .kla answered after 2.77 s, the firmware was done in 1 ms).
        /// This case and the next cover both halves: a program ends busy, an image or text ends idle.
        /// From the menu nothing more is owed, so the handler reads nothing after the ack.
        /// </summary>
        [Theory]
        [InlineData("/games/game.prg")]
        [InlineData("/games/game.p00")]
        public async Task Handle_ProgramLaunch_ReturnsSuccessAtTheAckAndMarksDeviceBusy(string path)
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.NewSegment().EnqueueText("next command's reply");
            var device = BuildDevice(port, DeviceMode.FullIdle);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, path), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy, "a running program owns the IO handler, as a cart does");
            port.Unread.Should().Be("next command's reply".Length, "a launch from the menu owes no reset line, so nothing is waited for");
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// Launched while a cart runs, a program first sends the C64 back to the menu, and the firmware
        /// prints the reset line a moment after the ack: the launch reads it, so the next command does
        /// not take it for its ack.
        /// </summary>
        [Fact]
        public async Task Handle_ProgramLaunchWhileACartRuns_ReadsTheBackToMenuResetLine()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/demos/demo.prg"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
        }

        /// <summary>
        /// The C64 menu shows an image or text under the TeensyROM handler, so the firmware keeps answering:
        /// the record ends idle, even when a running game had left it busy. Leaving that game costs the
        /// back-to-menu reset line, which the launch reads.
        /// </summary>
        [Theory]
        [InlineData("/images/HA_Sugar_Skull.kla")]
        [InlineData("/images/pic.koa")]
        [InlineData("/images/pic.art")]
        [InlineData("/images/pic.aas")]
        [InlineData("/images/pic.hpi")]
        [InlineData("/docs/readme.txt")]
        [InlineData("/docs/story.seq")]
        public async Task Handle_ImageOrTextLaunch_ReturnsSuccessAtTheAckAndMarksDeviceIdle(string path)
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, path), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// A HEX starts a firmware update, and the firmware answers nothing until it has flashed and
        /// rebooted: the launch is done at the ack and the device is left busy, with no version request
        /// and no recovery to report a disconnect in the middle of the update.
        /// </summary>
        [Fact]
        public async Task Handle_HexLaunch_ReturnsSuccessAtTheAckAndMarksDeviceBusy()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/firmware/TeensyROM+_0.8.0.11_full.hex"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// A CRT of at most 128 KB of chips plus its 64-byte header always fits the firmware's RAM1 cart
        /// buffer, so it can never reboot into minimal: the launch is done at the ack and the running cart
        /// leaves the device busy. 8,272 bytes is an 8 KB cart; 131,136 is the limit itself. From the menu
        /// the firmware prints one reset line once the cart has loaded, and the launch reads it.
        /// </summary>
        [Theory]
        [InlineData(8_272)]
        [InlineData(131_136)]
        public async Task Handle_CertainFitCrtLaunch_ReturnsSuccessAtTheAckAndMarksDeviceBusy(long size)
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Ace 2088.crt", size), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// The reported 502: launched while a cart runs, a cart owes two reset lines - back to the menu
        /// at once, and again once it has loaded (bench: +10 ms and +735 ms) - and the second used to
        /// reach the next launch as its ack. Both are read here, the line ending included, which can
        /// trail its text by ~50 ms.
        /// </summary>
        [Fact]
        public async Task Handle_CertainFitCrtLaunchWhileACartRuns_ReadsBothResetLines()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, "Resetting C64");
            port.EnqueueTextAfterQuiet(10, "\r\n");
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Ace 2088.crt", 82_144), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
        }

        /// <summary>
        /// The record said a cart ran, but only one reset line comes (the C64 was reset by hand, so the
        /// firmware was already in the menu): the launch stops waiting at the settle time and still
        /// succeeds - a cart this size cannot drop the transport, so there is nothing to confirm.
        /// </summary>
        [Fact]
        public async Task Handle_CertainFitCrtLaunch_FewerResetLinesThanOwed_StillSucceedsWithoutConfirm()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Ace 2088.crt", 82_144), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// One byte over the limit, the cart may spill into RAM2 and reboot into minimal, so silence after
        /// the ack still ends in the version confirm.
        /// </summary>
        [Fact]
        public async Task Handle_CrtLaunchOverTheCertainFit_SilenceFallsBackToTheVersionConfirm()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty with { IsTeensyRom = true, IsMinimalFirmware = false });
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, size: 131_137), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>());
        }

        /// <summary>
        /// A larger cart that fits resets the C64 into itself once loaded, and the reset line proves it
        /// loaded in place: no version confirm (bench, TCP: After the War, 131,392 bytes, +277 ms from the
        /// menu). The record starts idle, as from the menu, and ends busy.
        /// </summary>
        [Fact]
        public async Task Handle_LargerCartLaunchFromTheMenu_AfterLoadResetLine_ReturnsSuccessWithoutConfirm()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(277, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            var handler = BuildHandler(CartLoadOptions());

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/After the War.crt", 131_392), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// Launched while a cart runs, the larger cart owes two lines - back to the menu at once, then the
        /// load (bench, TCP: Chase HQ II, +9 ms and +819 ms) - with the first line's ending trailing its text.
        /// </summary>
        [Fact]
        public async Task Handle_LargerCartLaunchWhileACartRuns_BothResetLines_ReturnsSuccessWithoutConfirm()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, "Resetting C64");
            port.EnqueueTextAfterQuiet(50, "\r\n");
            port.EnqueueTextAfterQuiet(800, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            var handler = BuildHandler(CartLoadOptions());

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Chase HQ II.crt", 262_720), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// A cart too big for the full firmware reboots into minimal while its chips load: only the
        /// back-to-menu line comes, then silence (bench, TCP: Last Ninja 3, 541,792 bytes), so the launch
        /// confirms, finds no full firmware and recovers.
        /// </summary>
        [Fact]
        public async Task Handle_LargerCartLaunchWhileACartRuns_OnlyTheBackToMenuLine_ConfirmsAndRecovers()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.FromSeconds(1), null));
            var handler = BuildHandler(CartLoadOptions());

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Last Ninja 3.crt", 541_792), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.Received(1).RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>());
        }

        /// <summary>
        /// The record says the menu, but a cart ran - started from the C64's own menu. The line that comes
        /// at once is the back-to-menu one, not the load: the cart that goes on to drop must still be
        /// recovered.
        /// </summary>
        [Fact]
        public async Task Handle_LargerCartLaunch_RecordSaysMenuButACartRan_EarlyLineOnly_ConfirmsAndRecovers()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.FromSeconds(1), null));
            var handler = BuildHandler(CartLoadOptions());

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Last Ninja 3.crt", 541_792), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.Received(1).RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>());
        }

        /// <summary>The same wrong record with a cart that fits: both lines come, and the second proves the load.</summary>
        [Fact]
        public async Task Handle_LargerCartLaunch_RecordSaysMenuButACartRan_BothResetLines_ReturnsSuccessWithoutConfirm()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.EnqueueTextAfterQuiet(10, ResetLine);
            port.EnqueueTextAfterQuiet(800, ResetLine);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            var handler = BuildHandler(CartLoadOptions());

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/Chase HQ II.crt", 262_720), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            port.Unread.Should().Be(0);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
        }

        [Fact]
        public async Task Handle_RetryLaunchToken_ReturnsDeclinedWithoutRecovery()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.RetryLaunch);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.Declined);
            result.Error.Should().NotBeNullOrEmpty();
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }
    }
}
