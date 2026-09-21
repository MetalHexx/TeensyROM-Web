using System.Diagnostics;
using System.Runtime.Versioning;
using TeensyRom.Core.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Usb;
using Xunit.Abstractions;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Composes the connectivity slice by hand - the same types <c>ServiceStartupExtensions.AddTeensyRomServices</c>
/// registers for discovery, recovery, and connection management - and runs <c>ConnectAtStartAsync</c>
/// once per test class. Everything downstream of a real chip's own I/O (storage indexing, game/SID
/// metadata, settings persistence, alerts) is a bystander here and stays a substitute; nothing in these
/// tests exercises it.
///
/// Reads <c>TEENSYROM_BENCH_TRANSPORT</c> ("Serial" or "Tcp", default "Tcp") to pick which transport's
/// device the tests drive, and <c>TEENSYROM_BENCH_CHIP_IDS</c> (comma-separated) to prefer a specific
/// chip when more than one device answers on that transport. Neither variable being set does not fail
/// construction - <see cref="HasHardware"/> is simply false and every test skips.
/// </summary>
public sealed class HardwareFixture : IAsyncLifetime
{
    private ICartFinder _finder = null!;
    private readonly string _cachePath = Path.Combine(Path.GetTempPath(), $"teensyrom-bench-cache-{Guid.NewGuid():N}.json");

    public ConnectionOptions Options { get; } = new();
    public ILoggingService Log { get; } = Substitute.For<ILoggingService>();
    public IDeviceInterrogator Interrogator { get; private set; } = null!;
    public IDeviceRecovery Recovery { get; private set; } = null!;
    public ITeensyPortLocator Locator { get; private set; } = null!;
    public IDeviceTransportFactory Transports { get; private set; } = null!;
    public IDeviceConnectionManager Manager { get; private set; } = null!;

    public ConnectionType Transport { get; }
    public IReadOnlyList<string> ExpectedChipIds { get; }

    /// <summary>True once start connect confirmed at least one device. Every test opens with <c>Skip.If(!fixture.HasHardware, ...)</c>.</summary>
    public bool HasHardware { get; private set; }

    /// <summary>The transport's ceilings from <see cref="Options"/>, for the ceiling assertions the transition tests make.</summary>
    public TransportCeilings Ceilings => Transport == ConnectionType.Tcp ? Options.Tcp : Options.Serial;

    public List<TeensyRomDevice> Devices => Manager.GetAvailableDevices();

    /// <summary>The device under test: on the configured transport, preferring a chip id named in <see cref="ExpectedChipIds"/> when more than one answers there.</summary>
    public TeensyRomDevice? Device
    {
        get
        {
            var onTransport = Devices.Where(d => d.ConnectionType == Transport).ToList();

            if (ExpectedChipIds.Count > 0)
            {
                var preferred = onTransport.FirstOrDefault(d => ExpectedChipIds.Contains(d.DeviceId));
                if (preferred is not null) return preferred;
            }

            return onTransport.FirstOrDefault();
        }
    }

    public HardwareFixture()
    {
        Transport = Enum.TryParse<ConnectionType>(Environment.GetEnvironmentVariable("TEENSYROM_BENCH_TRANSPORT"), ignoreCase: true, out var transport)
            ? transport
            : ConnectionType.Tcp;

        ExpectedChipIds = (Environment.GetEnvironmentVariable("TEENSYROM_BENCH_CHIP_IDS") ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }

    [SupportedOSPlatform("windows")]
    public async Task InitializeAsync()
    {
        Locator = new TeensyPortLocator(BuildDescriptorReaders(), Log);
        Interrogator = new DeviceInterrogator(Log);
        Recovery = new DeviceRecovery(Interrogator, Locator, Options, Log);

        var alert = Substitute.For<IAlertService>();
        Transports = new DeviceTransportFactory(Log, alert);

        var discoveryStrategies = new IDiscoveryStrategy[]
        {
            new SerialDiscoveryStrategy(Log, Transports, Locator, Interrogator),
            new TcpDiscoveryStrategy(Log, Interrogator)
        };

        var storageFactory = new StorageFactory(
            Substitute.For<IMediator>(),
            Substitute.For<IGameMetadataService>(),
            Substitute.For<ISidMetadataService>(),
            Log);

        _finder = new CartFinder(Log, storageFactory, Interrogator, alert, Recovery, discoveryStrategies, Substitute.For<IDeviceSettingsProvider>());

        Manager = BuildManager();

        await Manager.ConnectAtStartAsync(CancellationToken.None);

        HasHardware = Devices.Count > 0;
    }

    /// <summary>
    /// A second, independent <see cref="IDeviceConnectionManager"/> pointed at the same cache file - for
    /// the discovery occasion where a fresh manager reconnects from a cache the first manager wrote.
    /// Disposes the current manager's device ports first: they still hold the COM ports and sockets, and
    /// a second open on a held COM name throws <see cref="UnauthorizedAccessException"/>, which would read
    /// as a miss and trigger the sweep this occasion must not take.
    /// </summary>
    public IDeviceConnectionManager BuildFreshManager()
    {
        foreach (var device in Devices)
        {
            device.CommunicationPort.Dispose();
        }

        return BuildManager();
    }

    private IDeviceConnectionManager BuildManager()
    {
        var cache = new ConnectionRecordCache(Log, _cachePath);
        return new DeviceConnectionManager(_finder, cache, Transports, Interrogator, Locator, Options, Log);
    }

    /// <summary>
    /// The same three descriptor readers <c>ServiceStartupExtensions.AddTeensyRomServices</c> registers;
    /// only <see cref="WindowsRegistryDescriptorReader"/> is platform-gated, and this app is Windows-only
    /// today (see AGENTS.md), so the constructor call site is confined to this one narrowly-annotated
    /// method instead of tagging the whole fixture.
    /// </summary>
    [SupportedOSPlatform("windows")]
    private IUsbSerialDescriptorReader[] BuildDescriptorReaders() =>
    [
        new WindowsRegistryDescriptorReader(Log),
        new MacOsPortNameDescriptorReader(),
        new LinuxSysfsDescriptorReader(Log)
    ];

    /// <summary>Times <paramref name="action"/> and writes <c>name: {ms} ms</c> to <paramref name="output"/> so the numbers land in the runbook's table.</summary>
    public async Task<(T Result, TimeSpan Elapsed)> MeasureAsync<T>(ITestOutputHelper output, string name, Func<Task<T>> action)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await action();
        stopwatch.Stop();
        output.WriteLine($"{name}: {stopwatch.ElapsedMilliseconds} ms");
        return (result, stopwatch.Elapsed);
    }

    public Task DisposeAsync()
    {
        foreach (var device in Devices)
        {
            device.CommunicationPort.Dispose();
        }

        if (File.Exists(_cachePath))
        {
            File.Delete(_cachePath);
        }

        return Task.CompletedTask;
    }
}
