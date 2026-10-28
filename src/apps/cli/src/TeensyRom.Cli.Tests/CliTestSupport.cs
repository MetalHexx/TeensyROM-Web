using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// A stdout/stderr pair of Spectre test consoles, wrapped the way the CLI sees real ones.
/// </summary>
internal sealed class TestConsoles
{
    public TestConsole Out { get; } = NewConsole();

    public TestConsole Err { get; } = NewConsole();

    public CliConsoles Consoles { get; }

    /// <param name="terminal">Every stream is a terminal, so prompts can be answered (push keys on <see cref="Err"/>.Input).</param>
    public TestConsoles(bool terminal = false)
    {
        if (terminal)
        {
            Out.Interactive();
            Err.Interactive();
        }
        Consoles = new CliConsoles(Out, Err, terminal, terminal, terminal);
    }

    public CliConsoles With(bool outIsTerminal, bool errIsTerminal, bool inIsTerminal) =>
        Consoles with { OutIsTerminal = outIsTerminal, ErrIsTerminal = errIsTerminal, InIsTerminal = inIsTerminal };

    public string StdOut => Out.Output;

    public string StdErr => Err.Output;

    private static TestConsole NewConsole()
    {
        var console = new TestConsole();
        console.Profile.Width = 300;
        return console;
    }
}

/// <summary>Stands in for the transfer-line hub client, so the menu never dials an engine; records how it was driven.</summary>
internal sealed class RecordingTransferLines : ITransferLineStream
{
    private int _starts;
    private int _disposals;

    public int Starts => Volatile.Read(ref _starts);

    public int Disposals => Volatile.Read(ref _disposals);

    /// <summary>What every <see cref="StartAsync"/> call returns; set a task that never completes to model a slow start.</summary>
    public Task StartResult { get; set; } = Task.CompletedTask;

    public Task StartAsync(CancellationToken ct)
    {
        Interlocked.Increment(ref _starts);
        return StartResult;
    }

    public ValueTask DisposeAsync()
    {
        Interlocked.Increment(ref _disposals);
        return ValueTask.CompletedTask;
    }
}

/// <summary>
/// The real public tree on test consoles, with the engine and the devices replaced by substitutes. The real settings
/// and storage services run against the test home.
/// </summary>
internal sealed class TestHost : IDisposable
{
    private readonly IAnsiConsole _originalConsole = AnsiConsole.Console;

    public TestConsoles Consoles { get; }

    public IEngineControl Engine { get; } = Substitute.For<IEngineControl>();

    public IDeviceService Devices { get; } = Substitute.For<IDeviceService>();

    public ServiceCollection Services { get; } = new();

    public CliLoggingService Logging { get; } = new();

    public RecordingTransferLines TransferLines { get; } = new();

    public CliComposition Composition { get; }

    public CliSession Session { get; }

    public TestHost(bool terminal = false, Action<ServiceCollection>? configure = null)
    {
        Consoles = new TestConsoles(terminal);

        var output = new CliOutput(Consoles.Consoles);
        var settings = new SettingsService(Logging);

        Services.AddSingleton<ICliOutput>(output);
        Services.AddSingleton(Engine);
        Services.AddSingleton(Devices);
        Services.AddSingleton<ICliLoggingService>(Logging);
        Services.AddSingleton<ILoggingService>(Logging);
        Services.AddSingleton<ILastLaunchStore, LastLaunchStore>();
        Services.AddSingleton<ISettingsService>(settings);
        Services.AddSingleton<IAlertService>(Substitute.For<IAlertService>());
        Services.AddSingleton(Substitute.For<ITeensyRomApiClient>());
        Services.AddSingleton<IStorageService, StorageService>();
        configure?.Invoke(Services);
        CliHost.RegisterCommands(Services);

        Composition = new CliComposition(Services, new StartupGate(Engine, Devices, new DeviceChooser(Devices, output)), Consoles.Consoles, output, new TypeRegistrar(Services), TransferLines: TransferLines);
        Session = CliHost.CreateSession(Composition);
    }

    public Task<int> RunAsync(params string[] args) => Session.RunAsync(args);

    public void Dispose() => AnsiConsole.Console = _originalConsole;
}
