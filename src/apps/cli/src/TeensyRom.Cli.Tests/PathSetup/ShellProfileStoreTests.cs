using TeensyRom.Cli.Errors;
using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Tests.PathSetup;

public sealed class ShellProfileStoreTests : IDisposable
{
    private readonly PathSandbox _sandbox = new();

    public void Dispose() => _sandbox.Dispose();

    private ShellProfileStore Store(PathPlatform platform, string? shell) =>
        new(_sandbox.Environment("/unused", platform, shell));

    private string Read(string relative) => File.ReadAllText(_sandbox.HomeFile(relative));

    private void Write(string relative, string content)
    {
        var path = _sandbox.HomeFile(relative);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
    }

    [Fact]
    public void Add_Zsh_CreatesZshrc_WithTheMarkedBlock()
    {
        var change = Store(PathPlatform.Linux, "/bin/zsh").Add("/opt/trom");

        change.Changed.Should().BeTrue();
        Read(".zshrc").Should().Be("# >>> trom >>>\nexport PATH=\"/opt/trom:$PATH\"\n# <<< trom <<<\n");
        change.Locations.Should().Equal(_sandbox.HomeFile(".zshrc"));
    }

    [Fact]
    public void Add_Fish_UsesFishSyntax_InConfigFish()
    {
        Store(PathPlatform.Linux, "/usr/bin/fish").Add("/opt/trom");

        Read(".config/fish/config.fish").Should().Be("# >>> trom >>>\nset -gx PATH \"/opt/trom\" $PATH\n# <<< trom <<<\n");
    }

    [Theory]
    [InlineData(false, ".bashrc", ".bash_profile")]
    [InlineData(true, ".bash_profile", ".bashrc")]
    public void Add_Bash_PicksTheFileOfThePlatform(bool mac, string expected, string other)
    {
        Store(mac ? PathPlatform.MacOS : PathPlatform.Linux, "/bin/bash").Add("/opt/trom");

        File.Exists(_sandbox.HomeFile(expected)).Should().BeTrue();
        File.Exists(_sandbox.HomeFile(other)).Should().BeFalse();
    }

    [Fact]
    public void Add_AlsoUpdatesOtherStartupFilesThatAlreadyExist()
    {
        Write(".zshrc", "alias ll='ls -l'\n");

        var change = Store(PathPlatform.Linux, "/bin/bash").Add("/opt/trom");

        Read(".bashrc").Should().Contain("/opt/trom");
        Read(".zshrc").Should().StartWith("alias ll='ls -l'\n").And.Contain("export PATH=\"/opt/trom:$PATH\"");
        change.Locations.Should().HaveCount(2);
    }

    [Fact]
    public void Add_AppendsAfterExistingContent_WithoutRewritingIt()
    {
        Write(".zshrc", "export EDITOR=vim");

        Store(PathPlatform.Linux, "/bin/zsh").Add("/opt/trom");

        Read(".zshrc").Should().Be("export EDITOR=vim\n# >>> trom >>>\nexport PATH=\"/opt/trom:$PATH\"\n# <<< trom <<<\n");
    }

    [Fact]
    public void Add_Twice_NeverDuplicatesTheBlock_AndReportsNoChange()
    {
        var store = Store(PathPlatform.Linux, "/bin/zsh");
        store.Add("/opt/trom");

        var again = store.Add("/opt/trom");

        again.Changed.Should().BeFalse();
        Read(".zshrc").Split("# >>> trom >>>").Should().HaveCount(2);
    }

    [Fact]
    public void Add_FromANewFolder_ReplacesTheFolderInTheExistingBlock()
    {
        Write(".zshrc", "before\n# >>> trom >>>\nexport PATH=\"/old/trom:$PATH\"\n# <<< trom <<<\nafter\n");

        var change = Store(PathPlatform.Linux, "/bin/zsh").Add("/new/trom");

        change.Changed.Should().BeTrue();
        Read(".zshrc").Should().Be("before\n# >>> trom >>>\nexport PATH=\"/new/trom:$PATH\"\n# <<< trom <<<\nafter\n");
    }

    [Fact]
    public void Remove_DeletesExactlyTheBlock()
    {
        Write(".zshrc", "before\n");
        var store = Store(PathPlatform.Linux, "/bin/zsh");
        store.Add("/opt/trom");

        var change = store.Remove("/opt/trom");

        change.Changed.Should().BeTrue();
        Read(".zshrc").Should().Be("before\n");
    }

    [Fact]
    public void Remove_WithNoBlock_ChangesNothing()
    {
        Write(".zshrc", "before\n");

        var change = Store(PathPlatform.Linux, "/bin/zsh").Remove("/opt/trom");

        change.Changed.Should().BeFalse();
        change.Locations.Should().BeEmpty();
        Read(".zshrc").Should().Be("before\n");
    }

    [Theory]
    [InlineData("/bin/zsh", ".zshrc")]
    [InlineData("/usr/bin/fish", ".config/fish/config.fish")]
    public void Add_QuotesAFolderWithSpacesAndSpecialCharacters_AndTheBlockReadsBack(string shell, string file)
    {
        var folder = "/Users/Jo Smith/My $Tools/\"trom\"";
        var store = Store(PathPlatform.MacOS, shell);

        store.Add(folder);

        var entry = store.Entries().Should().ContainSingle().Subject;
        entry.Folder.Should().Be(folder);
        entry.Location.Should().Be(_sandbox.HomeFile(file));
    }

    [Fact]
    public void Entries_MarksABlockWhoseFolderNoLongerHoldsTromAsStale()
    {
        var present = _sandbox.InstallFolder("here", PathPlatform.Linux);
        var gone = _sandbox.EmptyFolder("gone");
        var store = Store(PathPlatform.Linux, "/bin/zsh");

        store.Add(present);
        store.Entries().Single().Stale.Should().BeFalse();

        store.Add(gone);
        store.Entries().Single().Stale.Should().BeTrue();
    }

    [Fact]
    public void Add_WithAnUnknownShellAndNoStartupFiles_FailsWithoutWritingAnything()
    {
        var act = () => Store(PathPlatform.Linux, "/bin/tcsh").Add("/opt/trom");

        act.Should().Throw<CliException>();
        Directory.GetFileSystemEntries(_sandbox.Home).Should().BeEmpty();
    }
}
