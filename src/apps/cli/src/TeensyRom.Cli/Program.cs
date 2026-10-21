using TeensyRom.Cli.Services;

public class Program
{
    /// <summary>
    /// <c>trom</c> alone in a terminal opens the menu; <c>trom</c> alone anywhere else prints the root help. Any
    /// arguments run exactly one command, and the exit code is that command's.
    /// </summary>
    private static async Task<int> Main(string[] args)
    {
        var interactive = !Console.IsInputRedirected && !Console.IsOutputRedirected;
        var host = CliHost.Create();

        if (host.PathOffer is { } pathOffer) await pathOffer.MaybeOfferAsync(args);

        if (args.Length == 0 && interactive) return await CliHost.CreateTui(host).RunAsync();

        return await CliHost.CreateSession(host).RunAsync(args.Length == 0 ? ["--help"] : args);
    }
}
