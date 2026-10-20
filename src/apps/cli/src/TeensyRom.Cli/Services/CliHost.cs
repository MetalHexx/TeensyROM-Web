using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Reflection;
using System.Runtime.InteropServices;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.Device;
using TeensyRom.Cli.Commands.Engine;
using TeensyRom.Cli.Commands.File;
using TeensyRom.Cli.Commands.Index;
using TeensyRom.Cli.Commands.Main;
using TeensyRom.Cli.Commands.Main.Asid;
using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Commands.PathCommands;
using TeensyRom.Cli.Commands.Settings;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Help;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.PathSetup;
using TeensyRom.Cli.Progress;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Services;
using TeensyRom.Cli.Tui;
using AssemblyExtensions = TeensyRom.Cli.Common.AssemblyExtensions;

namespace TeensyRom.Cli.Services;

/// <summary>
/// The CLI's service registrations, the registrar both command apps share, and the gate that readies the engine and
/// a device before a menu flow that needs them.
/// </summary>
internal sealed record CliComposition(ServiceCollection Services, StartupGate Gate, CliConsoles Consoles, ICliOutput Output, TypeRegistrar Registrar, PathOffer? PathOffer = null);

/// <summary>
/// One verb of the public command tree. <see cref="Command"/> and <see cref="Settings"/> are what the verb needs
/// registered with the service container before Spectre runs.
/// </summary>
internal sealed record PublicVerb(string Name, Type Command, Type Settings, Action<IConfigurator<CommandSettings>> Configure)
{
    /// <summary>Describes <paramref name="name"/> as a verb run by <typeparamref name="TCommand"/>, shown with one example.</summary>
    /// <param name="example">The arguments of the example, from the noun on: <c>["device", "list"]</c>.</param>
    public static PublicVerb Of<TCommand, TSettings>(string name, string description, string[] example)
        where TCommand : class, ICommand<TSettings>
        where TSettings : CommandSettings =>
        new(name, typeof(TCommand), typeof(TSettings), branch =>
            branch.AddCommand<TCommand>(name).WithDescription(description).WithExample(example));
}

/// <summary>One noun of the public command tree and the verbs under it.</summary>
internal sealed record PublicNoun(string Name, string Description, IReadOnlyList<PublicVerb> Verbs);

/// <summary>
/// Composition root shared by <c>Program</c> and the end-to-end tests.
/// </summary>
internal static class CliHost
{
    /// <summary>
    /// The public command tree: <c>trom &lt;noun&gt; &lt;verb&gt;</c>. It is the one description that both registers the
    /// branches and feeds bare-noun detection, so a task that adds a noun adds it here and nowhere else.
    /// </summary>
    private static readonly PublicNoun[] PublicTree =
    [
        new("engine", "Check on or stop the TeensyROM engine.",
        [
            PublicVerb.Of<EngineStatusCommand, EngineStatusSettings>("status", "Show whether the TeensyROM engine is running and which version.", ["engine", "status"]),
            PublicVerb.Of<EngineStopCommand, EngineStopSettings>("stop", "Stop the TeensyROM engine and the web app it serves.", ["engine", "stop"])
        ]),
        new("device", "List, reconnect, rename, forget, ping or reset TeensyROM devices.",
        [
            PublicVerb.Of<DeviceListCommand, DeviceListSettings>("list", "List the TeensyROM devices tr-web already knows.", ["device", "list"]),
            PublicVerb.Of<DeviceListCommand, DeviceListSettings>(DeviceListCommand.DiscoverVerb, "Scan for TeensyROM devices, then list them.", ["device", DeviceListCommand.DiscoverVerb]),
            PublicVerb.Of<DeviceReconnectCommand, DeviceSettings>("reconnect", "Reconnect a TeensyROM, even one that is offline.", ["device", "reconnect", "--device", "Bench"]),
            PublicVerb.Of<DeviceRenameCommand, DeviceRenameSettings>("rename", "Give a TeensyROM a new name, even one that is offline.", ["device", "rename", "Bench", "--device", "TeensyROM"]),
            PublicVerb.Of<DeviceForgetCommand, DeviceSettings>("forget", "Make tr-web forget a TeensyROM, even one that is offline.", ["device", "forget", "--device", "Bench"]),
            PublicVerb.Of<DevicePingCommand, DeviceSettings>("ping", "Check that an online TeensyROM answers.", ["device", "ping"]),
            PublicVerb.Of<DeviceResetCommand, DeviceSettings>("reset", "Reset an online TeensyROM, which stops whatever it is running.", ["device", "reset"])
        ]),
        new("file", "Browse, search and launch the files on a TeensyROM's storage.",
        [
            PublicVerb.Of<FileLsCommand, FileLsSettings>("ls", "List a directory: its subdirectories, then its files.", ["file", "ls", "/music"]),
            PublicVerb.Of<FileSearchCommand, FileSearchSettings>("search", "Search the indexed files of a storage.", ["file", "search", "commando", "--filter", "music", "--take", "10"]),
            PublicVerb.Of<FileLaunchOneShotCommand, FileLaunchOneShotSettings>("launch", "Launch one file; --player then opens the player on it.", ["file", "launch", "/music/MUSICIANS/T/Tjelta_Geir/Artillery.sid"]),
            PublicVerb.Of<FileRandomOneShotCommand, FileRandomOneShotSettings>("random", "Launch a random file; --player then opens the player on it.", ["file", "random", "--filter", "music", "--directory", "/music"]),
            PublicVerb.Of<FileFavoriteCommand, FilePathsSettings>("favorite", "Tag files as favorites; give paths, or - to read them from stdin.", ["file", "favorite", "/music/Commando.sid", "/music/Delta.sid"]),
            PublicVerb.Of<FileUnfavoriteCommand, FilePathsSettings>("unfavorite", "Untag favorites; give paths, or - to read them from stdin.", ["file", "unfavorite", "/favorites/music/Commando.sid"]),
            PublicVerb.Of<FileBanCommand, FilePathsSettings>("ban", "Ban files so they no longer show up; give paths, or - to read them from stdin.", ["file", "ban", "/music/Commando.sid"])
        ]),
        new("index", "Index a TeensyROM's storage for search and random launches.",
        [
            PublicVerb.Of<IndexBuildCommand, IndexBuildSettings>("build", "Index a directory and everything below it; every available storage unless --storage names one.", ["index", "build", "/music", "--storage", "sd"])
        ]),
        new("path", "Put trom on your PATH, or take it off again.",
        [
            PublicVerb.Of<PathAddCommand, TromSettings>("add", "Add the folder holding trom to your PATH; new terminals will see it.", ["path", "add"]),
            PublicVerb.Of<PathRemoveCommand, TromSettings>("remove", "Take off your PATH exactly what `trom path add` put there.", ["path", "remove"]),
            PublicVerb.Of<PathStatusCommand, TromSettings>("status", "Show whether trom is on your PATH and which entries it manages.", ["path", "status"])
        ]),
        new("settings", "Show or change the CLI's own settings.",
        [
            PublicVerb.Of<SettingsShowCommand, SettingsShowSettings>("show", "Show the CLI's saved settings.", ["settings", "show"]),
            PublicVerb.Of<SettingsSetCommand, SettingsSetSettings>("set", "Change one of the CLI's saved settings.", ["settings", "set", "storage", "usb"])
        ]),
        new("chipsynth", "Generate ASID presets from Chipsynth C64 presets.",
        [
            PublicVerb.Of<GeneratePresetsCommand, GeneratePresetsSettings>("generate", GeneratePresetsSettings.Description, ["chipsynth", "generate", "--clock", "ntsc", "--target", "ASID", "--source", "c:\\your\\preset\\directory"])
        ])
    ];

    /// <summary>The nouns of the public command tree.</summary>
    public static IReadOnlyCollection<string> PublicNouns { get; } = PublicTree.Select(noun => noun.Name).ToArray();

    /// <summary>
    /// Every command and settings type of the menu's private app that the public tree does not also run, with the
    /// settings type each command binds. The menu's flow types are singletons: they rely on <see cref="IClearableSettings"/>
    /// and <see cref="CommandInterceptor"/>. A type the public tree runs (<c>chipsynth generate</c>) is registered there, transient.
    /// </summary>
    private static readonly (Type Command, Type Settings)[] TuiFlows =
    [
        (typeof(LaunchCommand), typeof(LaunchSettings)),
        (typeof(RandomCommand), typeof(RandomSettings)),
        (typeof(NavigateCommand), typeof(NavigateSettings)),
        (typeof(SearchCommand), typeof(SearchSettings)),
        (typeof(FileLaunchCommand), typeof(FileLaunchSettings)),
        (typeof(PlayerCommand), typeof(PlayerSettings)),
        (typeof(IndexCommand), typeof(IndexSettings)),
        (typeof(PortListCommand), typeof(PortListSettings)),
        (typeof(SettingsCommand), typeof(SettingsCommandSettings)),
        (typeof(CreditsCommand), typeof(CreditsSettings))
    ];

    /// <summary>
    /// Builds what commands need as instances, so the device a menu flow selects is the one every command sees, and
    /// registers every command and settings type of both apps up front.
    /// </summary>
    /// <remarks>
    /// The services are not built into a provider here. Spectre registers command and settings types through the
    /// <see cref="ITypeRegistrar"/> during <c>Run</c>, and <see cref="TypeRegistrar"/> ignores registrations once its
    /// provider exists and keeps the first registration of a type: the types are registered first, public ones as
    /// transient so no option value survives into the next run. Both apps must be given the one registrar returned here.
    /// </remarks>
    /// <param name="consoles">Where output goes; the real stdout and stderr when null.</param>
    public static CliComposition Create(CliConsoles? consoles = null)
    {
        consoles ??= CliConsoles.Create();

        var services = new ServiceCollection();
        var output = new CliOutput(consoles);
        var logService = new CliLoggingService();
        var alertService = new CliAlertService(output);
        var settingsService = new SettingsService(logService);

        var settings = settingsService.GetSettings();
        logService.Enabled = settings.EnableDebugLogs;

        var httpClient = new HttpClient(new ApiLoggingHandler(logService))
        {
            BaseAddress = new Uri(EngineAddress.BaseUrl),
            Timeout = Timeout.InfiniteTimeSpan
        };
        var apiClient = new TeensyRomApiClient(httpClient);
        var deviceService = new DeviceService(apiClient);
        var engine = new EngineControl(
            new EngineProbe(),
            new EngineLock(),
            new EngineLocator(AppContext.BaseDirectory),
            new EngineLauncher(),
            new SourceFingerprint(),
            new SystemEngineClock(),
            AssemblyExtensions.GetVersion(Assembly.GetExecutingAssembly()),
            output.Notice);
        var gate = new StartupGate(engine, deviceService);
        var pathRegistrar = PathRegistrar.CreateDefault(settingsService);

        services.AddSingleton<ITeensyRomApiClient>(apiClient);
        services.AddSingleton<IDeviceService>(deviceService);
        services.AddSingleton<IEngineControl>(engine);
        services.AddSingleton(gate);
        services.AddSingleton(consoles);
        services.AddSingleton<ICliOutput>(output);
        services.AddSingleton(pathRegistrar);
        services.AddSingleton<IStdinPaths>(new StdinPaths(Console.In, !Console.IsInputRedirected));
        services.AddSingleton<IDeviceChooser, DeviceChooser>();

        services.AddSingleton<ILoggingService>(logService);
        services.AddSingleton<ICliLoggingService>(logService);
        services.AddSingleton<IAlertService>(alertService);
        services.AddSingleton<ISettingsService>(settingsService);
        services.AddSingleton<IDeviceLogStream>(new DeviceLogStream(deviceService, logService, httpClient.BaseAddress!));
        services.AddSingleton<IStorageService, StorageService>();
        services.AddSingleton<ILaunchService, LaunchService>();
        services.AddSingleton<IPlayerService, PlayerService>();
        services.AddSingleton<ITypeResolver, TypeResolver>();
        services.AddSingleton<IProgressTimer, ProgressTimer>();
        services.AddSingleton<ILaunchHistory, LaunchHistory>();

        RegisterCommands(services);

        return new CliComposition(services, gate, consoles, output, new TypeRegistrar(services),
            new PathOffer(output, settingsService, new EngineLocator(AppContext.BaseDirectory), pathRegistrar));
    }

    /// <summary>
    /// Registers every command and settings type of both apps: the public tree's as transient, the menu's flows as
    /// singletons. Registering them before Spectre does is what makes these lifetimes stick.
    /// </summary>
    internal static void RegisterCommands(IServiceCollection services)
    {
        services.TryAddSingleton(provider => PathRegistrar.CreateDefault(provider.GetRequiredService<ISettingsService>()));

        foreach (var verb in PublicTree.SelectMany(noun => noun.Verbs))
        {
            services.TryAddTransient(verb.Command);
            services.TryAddTransient(verb.Settings);
        }
        foreach (var (command, commandSettings) in TuiFlows)
        {
            services.TryAddSingleton(command);
            services.TryAddSingleton(commandSettings);
        }
    }

    /// <summary>Builds the session that runs one public command line, on the composition's registrar and consoles.</summary>
    public static CliSession CreateSession(CliComposition host) => new(
        CreateApp(host.Registrar, host.Consoles),
        CreateApp(host.Registrar, host.Consoles with { Out = host.Consoles.Err }),
        host.Output,
        host.Consoles,
        PublicNouns);

    /// <summary>Builds the interactive menu on the composition's registrar and consoles.</summary>
    public static TuiHost CreateTui(CliComposition host) =>
        new(CreateTuiApp(host.Registrar), host.Gate, host.Output, host.Consoles);

    /// <summary>
    /// The public app: the <c>trom &lt;noun&gt; &lt;verb&gt;</c> tree and nothing else. Help and the version are written to
    /// <paramref name="consoles"/>' <see cref="CliConsoles.Out"/>.
    /// </summary>
    public static CommandApp CreateApp(ITypeRegistrar registrar, CliConsoles consoles)
    {
        var app = new CommandApp(registrar);

        app.Configure(config =>
        {
            config.PropagateExceptions();
            config.UseStrictParsing();
            config.ConfigureConsole(consoles.Out);

            config.SetApplicationName("trom");
            config.SetApplicationVersion($"trom {AssemblyExtensions.GetVersion(Assembly.GetExecutingAssembly())}\nOS: {RuntimeInformation.OSDescription}\nArchitecture: {RuntimeInformation.OSArchitecture}");

            StyleHelp(config);
            config.SetHelpProvider(new TromHelpProvider(config.Settings));

            foreach (var noun in PublicTree)
            {
                config.AddBranch(noun.Name, branch =>
                {
                    branch.SetDescription(noun.Description);

                    foreach (var verb in noun.Verbs) verb.Configure(branch);
                });
            }
        });

        return app;
    }

    /// <summary>
    /// The menu's private app: today's interactive flows under their existing internal names. It is never reachable
    /// from the command line.
    /// </summary>
    public static CommandApp CreateTuiApp(ITypeRegistrar registrar)
    {
        var app = new CommandApp(registrar);

        app.Configure(config =>
        {
            config.PropagateExceptions();
            config.SetInterceptor(new CommandInterceptor());

            config.SetApplicationName("trom");

            config.AddBranch<LaunchSettings>("launch", launch =>
            {
                launch.SetDefaultCommand<LaunchCommand>();
                config.AddExample(LaunchSettings.Example);
                launch.SetDescription(LaunchSettings.Description);
                launch.AddExample(LaunchSettings.Example);

                config.AddExample(RandomSettings.Example);
                launch.AddCommand<RandomCommand>("random")
                      .WithAlias("r")
                      .WithDescription(RandomSettings.Description)
                      .WithExample(RandomSettings.Example);

                config.AddExample(NavigateSettings.Example);
                launch.AddCommand<NavigateCommand>("nav")
                      .WithAlias("n")
                      .WithDescription(NavigateSettings.Description)
                      .WithExample(NavigateSettings.Example);

                config.AddExample(SearchSettings.Example);
                launch.AddCommand<SearchCommand>("search")
                      .WithAlias("s")
                      .WithDescription(SearchSettings.Description)
                      .WithExample(SearchSettings.Example);

                config.AddExample(FileLaunchSettings.Example);
                launch.AddCommand<FileLaunchCommand>("file")
                      .WithAlias("s")
                      .WithDescription(FileLaunchSettings.Description)
                      .WithExample(FileLaunchSettings.Example);

                launch.AddCommand<PlayerCommand>("player")
                      .IsHidden();
            });

            config.AddExample(IndexSettings.Example);
            config.AddCommand<IndexCommand>("index")
                  .WithAlias("i")
                  .WithDescription(IndexSettings.Description)
                  .WithExample(IndexSettings.Example);

            config.AddExample(PortListSettings.Example);
            config.AddCommand<PortListCommand>("ports")
                  .WithAlias("p")
                  .WithDescription(PortListSettings.Description)
                  .WithExample(PortListSettings.Example);

            config.AddExample(GeneratePresetsSettings.Example);
            config.AddCommand<GeneratePresetsCommand>("chipsynth")
                  .WithAlias("cs")
                  .WithDescription(GeneratePresetsSettings.Description)
                  .WithExample(GeneratePresetsSettings.Example);

            config.AddCommand<SettingsCommand>("settings")
                  .IsHidden();

            config.AddExample(CreditsSettings.Example);
            config.AddCommand<CreditsCommand>("credits")
                  .WithAlias("c")
                  .WithDescription(CreditsSettings.Description)
                  .WithExample(CreditsSettings.Example);
        });

        return app;
    }

    private static void StyleHelp(IConfigurator config)
    {
        var help = config.Settings.HelpProviderStyles;
        help!.Arguments!.Header = new Style(foreground: RadHelper.Theme.Secondary.Color);
        help!.Description!.Header = new Style(foreground: RadHelper.Theme.Secondary.Color);
        help!.Usage!.Header = new Style(foreground: RadHelper.Theme.Secondary.Color);
        help!.Options!.Header = new Style(foreground: RadHelper.Theme.Secondary.Color);
        help!.Examples!.Header = new Style(foreground: RadHelper.Theme.Secondary.Color);
        help!.Commands!.Header = new Style(foreground: RadHelper.Theme.Secondary.Color);
        config.Settings.HelpProviderStyles = help;
    }
}
