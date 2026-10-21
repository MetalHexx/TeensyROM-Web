using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// What the command base classes do before a command runs, on a test noun <c>probe</c> over the real shared registrar.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class DeviceCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected");

    private readonly IDeviceChooser _chooser = Substitute.For<IDeviceChooser>();
    private readonly ISettingsService _savedSettings = Substitute.For<ISettingsService>();
    private readonly Probe _probe = new();
    private readonly TestHost _host;
    private readonly CommandApp _probeApp;

    public DeviceCommandTests()
    {
        _savedSettings.GetSettings().Returns(_ => new TeensySettings { StorageType = TeensyStorageType.SD });
        _chooser.ChooseAsync(Arg.Any<string?>(), Arg.Any<DeviceScope>(), Arg.Any<CancellationToken>()).Returns(Alpha);

        _host = new TestHost(configure: services =>
        {
            services.Replace(ServiceDescriptor.Singleton(_savedSettings));
            services.AddSingleton(_chooser);
            services.AddSingleton(_probe);
            services.AddTransient<EngineProbeCommand>().AddTransient<DeviceProbeCommand>().AddTransient<StorageProbeCommand>();
            services.AddTransient<DeviceSettings>().AddTransient<StorageSettings>().AddTransient<TromSettings>();
        });
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);

        _probeApp = new CommandApp(_host.Composition.Registrar);
        _probeApp.Configure(config =>
        {
            config.PropagateExceptions();
            config.AddBranch("probe", branch =>
            {
                branch.AddCommand<EngineProbeCommand>("engine");
                branch.AddCommand<DeviceProbeCommand>("device");
                branch.AddCommand<StorageProbeCommand>("storage");
            });
        });
    }

    public void Dispose() => _host.Dispose();

    // ---- engine commands --------------------------------------------------------------------------------------------

    [Fact]
    public async Task AnEngineCommand_ReadiesTheEngineBeforeItRuns()
    {
        var exitCode = await _probeApp.RunAsync(["probe", "engine"]);

        exitCode.Should().Be(0);
        await _host.Engine.Received(1).EnsureRunningAsync(Arg.Any<CancellationToken>());
        _probe.Ran.Should().Be(1);
    }

    [Fact]
    public async Task AnEngineCommand_WhenNoEngineCanBeReadied_FailsWithEngineUnavailable_AndNeverRuns()
    {
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Failed("The TeensyROM engine didn't start."));

        var act = () => _probeApp.RunAsync(["probe", "engine"]);

        var error = (await act.Should().ThrowAsync<CliException>()).Which;
        error.Code.Should().Be(CliExitCode.EngineUnavailable);
        error.Message.Should().Be("The TeensyROM engine didn't start.");
        _probe.Ran.Should().Be(0);
    }

    // ---- device commands ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task ADeviceCommand_ChoosesAnOnlineDeviceAfterTheEngine_AndSelectsIt()
    {
        var exitCode = await _probeApp.RunAsync(["probe", "device", "--device", "alpha"]);

        exitCode.Should().Be(0);
        Received.InOrder(() =>
        {
            _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>());
            _chooser.ChooseAsync("alpha", DeviceScope.Online, Arg.Any<CancellationToken>());
            _host.Devices.Select(Alpha);
        });
        _probe.Ran.Should().Be(1);
    }

    [Fact]
    public async Task ADeviceCommand_WhenNoDeviceCanBeChosen_NeverRuns()
    {
        _chooser.ChooseAsync(Arg.Any<string?>(), Arg.Any<DeviceScope>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<DeviceSummary>(new CliException(CliExitCode.NoDevice, "Alpha is offline.")));

        var act = () => _probeApp.RunAsync(["probe", "device"]);

        (await act.Should().ThrowAsync<CliException>()).Which.Code.Should().Be(CliExitCode.NoDevice);
        _host.Devices.DidNotReceiveWithAnyArgs().Select(default!);
        _probe.Ran.Should().Be(0);
    }

    // ---- storage -----------------------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("usb", TeensyStorageType.USB)]
    [InlineData("USB", TeensyStorageType.USB)]
    [InlineData("sd", TeensyStorageType.SD)]
    public async Task AStorageOption_ChoosesTheStorageForThisRun_WithoutSavingIt(string option, TeensyStorageType expected)
    {
        await _probeApp.RunAsync(["probe", "storage", "-s", option]);

        _probe.StorageSeen.Should().Be(expected);
        _savedSettings.DidNotReceiveWithAnyArgs().SaveSettings(default!);
    }

    [Fact]
    public async Task WithoutAStorageOption_TheStorageIsTheOneInTheCliSettings()
    {
        _savedSettings.GetSettings().Returns(_ => new TeensySettings { StorageType = TeensyStorageType.USB });

        await _probeApp.RunAsync(["probe", "storage"]);

        _probe.StorageSeen.Should().Be(TeensyStorageType.USB);
        _savedSettings.DidNotReceiveWithAnyArgs().SaveSettings(default!);
    }

    [Fact]
    public async Task AnInvalidStorage_IsAValidationError()
    {
        var act = () => _probeApp.RunAsync(["probe", "storage", "-s", "floppy"]);

        await act.Should().ThrowAsync<CommandRuntimeException>();
        _probe.Ran.Should().Be(0);
    }

    [Fact]
    public async Task TheMenuAndAPublicCommand_ShareOneStorageService()
    {
        var menu = CliHost.CreateTuiApp(_host.Composition.Registrar);

        await _probeApp.RunAsync(["probe", "storage", "-s", "usb"]);
        var storageSeenByCommand = _probe.Storage;

        var resolved = _host.Composition.Registrar.Build().Resolve(typeof(IStorageService));
        var credits = await menu.RunAsync(["credits"]);

        credits.Should().Be(0, "a menu flow resolves from the same provider the public app already built");
        resolved.Should().BeSameAs(storageSeenByCommand);
        ((IStorageService)resolved!).StorageType.Should().Be(TeensyStorageType.USB);
    }

    // ---- test commands -------------------------------------------------------------------------------------------------------

    private sealed class Probe
    {
        public int Ran { get; set; }
        public IStorageService? Storage { get; set; }
        public TeensyStorageType? StorageSeen { get; set; }
    }

    private sealed class EngineProbeCommand(ICliOutput output, IEngineControl engine, Probe probe) : EngineCommand<TromSettings>(output, engine)
    {
        protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct)
        {
            probe.Ran++;
            return Task.FromResult(0);
        }
    }

    private sealed class DeviceProbeCommand : DeviceCommand<DeviceSettings>
    {
        private readonly Probe _probe;

        public DeviceProbeCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices, IStorageService storage, ISettingsService settings, Probe probe)
            : base(output, engine, chooser, devices, storage, settings) => _probe = probe;

        protected override Task<int> RunAsync(CommandContext context, DeviceSettings settings, CancellationToken ct)
        {
            _probe.Ran++;
            return Task.FromResult(0);
        }
    }

    private sealed class StorageProbeCommand : DeviceCommand<StorageSettings>
    {
        private readonly Probe _probe;
        private readonly IStorageService _storage;

        public StorageProbeCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices, IStorageService storage, ISettingsService settings, Probe probe)
            : base(output, engine, chooser, devices, storage, settings)
        {
            _probe = probe;
            _storage = storage;
        }

        protected override Task<int> RunAsync(CommandContext context, StorageSettings settings, CancellationToken ct)
        {
            _probe.Ran++;
            _probe.Storage = _storage;
            _probe.StorageSeen = _storage.StorageType;
            return Task.FromResult(0);
        }
    }
}
