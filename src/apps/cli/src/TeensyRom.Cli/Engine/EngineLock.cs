using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Engine;

/// <summary>Whether an engine holds the single-instance lock for this home.</summary>
internal interface IEngineLock
{
    bool IsHeld();
}

/// <summary>
/// Checks the engine's lock file by trying to open it exclusively and letting go at once; a missing file counts as free.
/// The engine retries its own acquisition for about two seconds, so this momentary probe cannot make a starting engine give up.
/// </summary>
internal sealed class EngineLock(Func<string>? lockPath = null) : IEngineLock
{
    private readonly Func<string> _lockPath = lockPath ?? (() => TeensyRomHome.EngineLockPath);

    public bool IsHeld()
    {
        try
        {
            using var _ = new FileStream(_lockPath(), FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            return false;
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return false;
        }
        catch (IOException)
        {
            return true;
        }
    }
}
