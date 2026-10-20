using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The real CLI - composition root, session and commands - on a pair of Spectre test consoles, one for stdout and one
/// for stderr. Commands run through <see cref="CliSession"/>, so they get the same pre-parse steps as the real thing.
/// </summary>
/// <remarks>
/// By default every stream is redirected, as in a script: no prompts, plain output. Pass <c>interactive: true</c> for
/// a terminal, and push keys on <see cref="Err"/>.Input (one-shot prompts) or <see cref="Out"/>.Input (the menu's
/// startup gate) before the prompt that reads them.
/// </remarks>
internal sealed class CliHarness : IDisposable
{
    private readonly IAnsiConsole _original = AnsiConsole.Console;
    private readonly CliSession _session;

    public TestConsole Out { get; }

    public TestConsole Err { get; }

    public CliComposition Host { get; }

    public CliHarness(bool interactive = false)
    {
        Out = NewConsole(interactive);
        Err = NewConsole(interactive);
        Host = CliHost.Create(new CliConsoles(Out, Err, interactive, interactive, interactive));
        _session = CliHost.CreateSession(Host);
    }

    /// <summary>
    /// Runs the menu's startup gate, which readies the engine and prompts for a device on the menu's own screen
    /// (<see cref="Out"/>).
    /// </summary>
    public Task<bool> StartAsync()
    {
        AnsiConsole.Console = Out;
        return Host.Gate.EnsureReadyAsync();
    }

    /// <summary>Runs a command line the way <c>trom</c> does and returns its exit code.</summary>
    public Task<int> RunAsync(params string[] args) => _session.RunAsync(args);

    /// <summary>Everything written to stdout.</summary>
    public string Output => Out.Output;

    /// <summary>Everything written to stderr.</summary>
    public string Error => Err.Output;

    public void Dispose() => AnsiConsole.Console = _original;

    public static TestConsole NewConsole(bool interactive = true)
    {
        var console = new TestConsole();
        if (interactive) console.Interactive();
        console.Profile.Width = 300;
        return console;
    }
}

/// <summary>
/// CLI services resolved from a composition that runs no command, for scenarios that call the services directly.
/// </summary>
internal sealed class CliServices : IDisposable
{
    private readonly IAnsiConsole _original = AnsiConsole.Console;
    private readonly ServiceProvider _provider;

    public CliServices()
    {
        var console = CliHarness.NewConsole();
        AnsiConsole.Console = console;
        _provider = CliHost.Create(new CliConsoles(console, console, false, false, false)).Services.BuildServiceProvider();
    }

    public T Get<T>() where T : notnull => _provider.GetRequiredService<T>();

    /// <summary>Makes the device the one the CLI's services work with, as the startup prompt would.</summary>
    public void SelectDevice(CartDto device) => Get<IDeviceService>().Select(
        new DeviceSummary(device.DeviceId, device.Name, true, device.ConnectionType.ToString(), device.DeviceState.ToString()));

    /// <summary>The SD card when the device reports it, else USB; skips the scenario when it reports neither.</summary>
    public static TeensyStorageType AvailableStorageOrSkip(CartDto device)
    {
        Skip.If(!device.SdStorage.Available && !device.UsbStorage.Available, $"{device.Name} reports no available storage");

        return device.SdStorage.Available ? TeensyStorageType.SD : TeensyStorageType.USB;
    }

    public void Dispose()
    {
        _provider.Dispose();
        AnsiConsole.Console = _original;
    }
}
