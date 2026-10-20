using System.Text;
using System.Text.RegularExpressions;
using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.PathSetup;

/// <summary>
/// Puts a marked block in the user's shell startup files on Mac and Linux. It only ever appends, or replaces and
/// deletes its own block; nothing else in a file is rewritten.
/// </summary>
internal sealed partial class ShellProfileStore(PathEnvironment env)
{
    private const string StartMarker = "# >>> trom >>>";
    private const string EndMarker = "# <<< trom <<<";

    private enum Shell { Zsh, Bash, Fish }

    [GeneratedRegex(@"^# >>> trom >>>\r?\n.*?^# <<< trom <<<[ \t]*(?:\r?\n|\z)", RegexOptions.Multiline | RegexOptions.Singleline)]
    private static partial Regex BlockPattern();

    [GeneratedRegex(@"^export PATH=""(?<folder>(?:\\.|[^""\\])*):\$PATH""|^set -gx PATH ""(?<folder>(?:\\.|[^""\\])*)"" \$PATH", RegexOptions.Multiline)]
    private static partial Regex FolderPattern();

    /// <summary>Makes every startup file hold the block for <paramref name="folder"/>: the login shell's file (created when missing) and any other that exists.</summary>
    /// <exception cref="CliException">When no startup file can be chosen.</exception>
    public PathChange Add(string folder)
    {
        var files = AddTargets();

        if (files.Count == 0)
        {
            throw new CliException(CliExitCode.Failed, "Couldn't tell which shell you use, so no startup file was changed. Add the folder to your PATH yourself.");
        }

        var changed = false;

        foreach (var (shell, file) in files)
        {
            var content = File.Exists(file) ? File.ReadAllText(file) : string.Empty;
            var updated = WithBlock(content, BlockFor(shell, folder));

            if (updated == content && File.Exists(file)) continue;

            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            File.WriteAllText(file, updated, new UTF8Encoding(false));
            changed = true;
        }
        return new PathChange(changed, folder, files.Select(target => target.File).ToList());
    }

    /// <summary>Deletes the block from every startup file that has one, and nothing else.</summary>
    public PathChange Remove(string folder)
    {
        var removedFrom = new List<string>();

        foreach (var (_, file) in Candidates().Where(candidate => File.Exists(candidate.File)))
        {
            var content = File.ReadAllText(file);
            var updated = BlockPattern().Replace(content, string.Empty);

            if (updated == content) continue;

            File.WriteAllText(file, updated, new UTF8Encoding(false));
            removedFrom.Add(file);
        }
        return new PathChange(removedFrom.Count > 0, folder, removedFrom);
    }

    /// <summary>Every block found, with the file it is in and the folder it puts on the PATH.</summary>
    public IReadOnlyList<PathEntry> Entries()
    {
        var entries = new List<PathEntry>();

        foreach (var (_, file) in Candidates().Where(candidate => File.Exists(candidate.File)))
        {
            foreach (Match block in BlockPattern().Matches(File.ReadAllText(file)))
            {
                var folder = FolderPattern().Match(block.Value) is { Success: true } found
                    ? Unescape(found.Groups["folder"].Value)
                    : null;

                if (folder is not null) entries.Add(new PathEntry(file, folder, !env.HoldsTrom(folder)));
            }
        }
        return entries;
    }

    private List<(Shell Shell, string File)> AddTargets()
    {
        var targets = new List<(Shell, string)>();

        if (LoginShell() is { } login) targets.Add((login, FileFor(login)));

        targets.AddRange(Candidates().Where(candidate => File.Exists(candidate.File)));

        return targets.DistinctBy(target => target.Item2).ToList();
    }

    private IEnumerable<(Shell Shell, string File)> Candidates() =>
        Enum.GetValues<Shell>().Select(shell => (shell, FileFor(shell)));

    private string FileFor(Shell shell) => shell switch
    {
        Shell.Zsh => Path.Combine(env.Home, ".zshrc"),
        Shell.Bash => Path.Combine(env.Home, env.Platform == PathPlatform.MacOS ? ".bash_profile" : ".bashrc"),
        _ => Path.Combine(env.Home, ".config", "fish", "config.fish")
    };

    private Shell? LoginShell() => Path.GetFileName(env.Shell?.TrimEnd('/')) switch
    {
        "zsh" => Shell.Zsh,
        "bash" => Shell.Bash,
        "fish" => Shell.Fish,
        _ => null
    };

    private static string BlockFor(Shell shell, string folder)
    {
        var line = shell == Shell.Fish
            ? $"set -gx PATH \"{Escape(folder, fish: true)}\" $PATH"
            : $"export PATH=\"{Escape(folder, fish: false)}:$PATH\"";

        return $"{StartMarker}\n{line}\n{EndMarker}\n";
    }

    private static string WithBlock(string content, string block)
    {
        var matches = BlockPattern().Matches(content);

        if (matches.Count == 0)
        {
            return content.Length == 0 || content.EndsWith('\n') ? content + block : content + "\n" + block;
        }

        var first = true;

        return BlockPattern().Replace(content, _ =>
        {
            var replacement = first ? block : string.Empty;
            first = false;
            return replacement;
        });
    }

    private static string Escape(string folder, bool fish)
    {
        var builder = new StringBuilder();

        foreach (var c in folder)
        {
            if (c is '\\' or '"' or '$' || (c == '`' && !fish)) builder.Append('\\');
            builder.Append(c);
        }
        return builder.ToString();
    }

    private static string Unescape(string value) => UnescapePattern().Replace(value, "$1");

    [GeneratedRegex(@"\\(.)")]
    private static partial Regex UnescapePattern();
}
