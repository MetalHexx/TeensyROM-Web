using TeensyRom.Core.Common;

namespace TeensyRom.Api.Tests.Integration.Home
{
    /// <summary>
    /// Boots the real <c>Program</c> and checks where its assets go. Shares the "Transfer" collection so it never
    /// runs beside <see cref="TransferFixture"/>'s own boot: both sync into the same test home.
    /// </summary>
    [Collection("Transfer")]
    public class EngineHomeBootTests
    {
        [Fact]
        public void Boot_WhenTheHomeIsStale_RefreshesTheHomeWithoutTouchingTheProgramFolder()
        {
            var packageAssets = Path.Combine(typeof(Program).Assembly.GetPath(), "Assets");
            Directory.Exists(packageAssets).Should().BeTrue("the test output carries the packaged assets the engine syncs from");

            var marker = Path.Combine(TeensyRomHome.ApiPath, "Assets", TeensyRomHome.PackageVersionFileName);
            File.Delete(marker);
            var before = Snapshot(packageAssets);

            using var fixture = new TransferFixture();

            Snapshot(packageAssets).Should().Equal(before);
            File.Exists(marker).Should().BeTrue();
        }

        private static List<string> Snapshot(string folder) => Directory
            .EnumerateFiles(folder, "*", SearchOption.AllDirectories)
            .Select(path => new FileInfo(path))
            .Select(file => $"{Path.GetRelativePath(folder, file.FullName)}|{file.Length}|{file.LastWriteTimeUtc.Ticks}")
            .Order(StringComparer.Ordinal)
            .ToList();
    }
}
