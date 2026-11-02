using TeensyRom.Cli.Services;

public class Program
{
    /// <summary>
    /// <c>trom</c> alone in a terminal opens the menu; <c>trom</c> alone anywhere else prints the root help. Any
    /// arguments run exactly one command, and the exit code is that command's. Around the command: leftovers of an
    /// earlier update are tidied first, and a newer release is looked up while it runs and mentioned when it ends.
    /// </summary>
    private static async Task<int> Main(string[] args)
    {
        var interactive = !Console.IsInputRedirected && !Console.IsOutputRedirected;
        var host = CliHost.Create();
        var menu = args.Length == 0 && interactive;

        host.Leftovers?.CleanQuietly();
        host.Notifier?.Begin(args, menu);

        try
        {
            if (host.PathOffer is { } pathOffer) await pathOffer.MaybeOfferAsync(args);

            if (menu) return await CliHost.CreateTui(host).RunAsync();

            return await CliHost.CreateSession(host).RunAsync(args.Length == 0 ? ["--help"] : args);
        }
        finally
        {
            if (host.Notifier is { } notifier) await notifier.EndAsync();
        }
    }
}
