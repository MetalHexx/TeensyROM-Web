using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.Storage.Index;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class MetadataSourceVersionTests : IDisposable
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), "teensyrom-source-version-tests", Guid.NewGuid().ToString("N"));

        [Fact]
        public void Current_IsNonEmpty_WhenEveryLocalSourceIsAbsent()
        {
            var version = new MetadataSourceVersion(_root);

            version.Current.Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public void Current_IsStableAcrossTwoInstances_ReadingTheSameUnchangedInputs()
        {
            SeedGamesFile("original content");

            var first = new MetadataSourceVersion(_root).Current;
            var second = new MetadataSourceVersion(_root).Current;

            second.Should().Be(first);
        }

        [Fact]
        public void Current_Changes_WhenAHashedSourceFilesContentChanges()
        {
            SeedGamesFile("original content");
            var before = new MetadataSourceVersion(_root).Current;

            SeedGamesFile("different content");
            var after = new MetadataSourceVersion(_root).Current;

            after.Should().NotBe(before);
        }

        [Fact]
        public void Current_Changes_WhenTheHvscCsvFileNameChanges()
        {
            SeedHvscFile("SIDlist_82_UTF8.csv");
            var before = new MetadataSourceVersion(_root).Current;

            Directory.Delete(Path.Combine(_root, MusicConstants.SidList_Local_Path), recursive: true);
            SeedHvscFile("SIDlist_83_UTF8.csv");
            var after = new MetadataSourceVersion(_root).Current;

            after.Should().NotBe(before);
        }

        public void Dispose()
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }

        private void SeedGamesFile(string content)
        {
            var path = Path.Combine(_root, GameConstants.Game_Image_Metadata_File_Path);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, content);
        }

        private void SeedHvscFile(string fileName)
        {
            var directory = Path.Combine(_root, MusicConstants.SidList_Local_Path);
            Directory.CreateDirectory(directory);
            File.WriteAllText(Path.Combine(directory, fileName), "irrelevant");
        }
    }
}
