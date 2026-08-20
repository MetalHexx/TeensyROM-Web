using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index.Fixtures;

namespace TeensyRom.Core.Storage.Tests
{
    public class IndexFixtureReaderTests
    {
        [Fact]
        public void ReadHeader_RoundTrips_DeviceIdStorageTypeAndFileCount()
        {
            // Arrange
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=YRTCPIRY\tstorage=sd\tfiles=2\n" +
                "/music/a.sid\ta.sid\t100\n" +
                "/music/b.sid\tb.sid\t200\n");

            try
            {
                // Act
                var header = IndexFixtureReader.ReadHeader(fixturePath);

                // Assert
                header.Version.Should().Be(1);
                header.DeviceId.Should().Be("YRTCPIRY");
                header.StorageType.Should().Be(TeensyStorageType.SD);
                header.FileCount.Should().Be(2);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public void Read_Yields_ExactlyTheRecordsWritten()
        {
            // Arrange
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=YRTCPIRY\tstorage=usb\tfiles=2\n" +
                "/music/a.sid\ta.sid\t100\n" +
                "/music/b.sid\tb.sid\t200\n");

            try
            {
                // Act
                var records = IndexFixtureReader.Read(fixturePath).ToList();

                // Assert
                records.Should().BeEquivalentTo(
                [
                    new IndexFixtureRecord("/music/a.sid", "a.sid", 100),
                    new IndexFixtureRecord("/music/b.sid", "b.sid", 200)
                ]);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public void Read_Yields_NoRecords_WhenFixtureIsEmpty()
        {
            // Arrange
            var fixturePath = WriteFixture("#teensyrom-index-fixture\tv1\tdevice=YRTCPIRY\tstorage=sd\tfiles=0\n");

            try
            {
                // Act
                var records = IndexFixtureReader.Read(fixturePath).ToList();

                // Assert
                records.Should().BeEmpty();
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public void Read_Throws_WithLineNumber_WhenARecordHasTooFewFields()
        {
            // Arrange
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=YRTCPIRY\tstorage=sd\tfiles=1\n" +
                "/music/a.sid\ta.sid\n");

            try
            {
                // Act
                Action act = () => IndexFixtureReader.Read(fixturePath).ToList();

                // Assert
                act.Should().Throw<InvalidDataException>().WithMessage("*line 2*");
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public void Read_Throws_WhenFixtureVersionIsUnknown()
        {
            // Arrange
            var fixturePath = WriteFixture("#teensyrom-index-fixture\tv2\tdevice=YRTCPIRY\tstorage=sd\tfiles=0\n");

            try
            {
                // Act
                Action act = () => IndexFixtureReader.Read(fixturePath).ToList();

                // Assert
                act.Should().Throw<InvalidDataException>().WithMessage("*line 1*");
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public void ReadHeader_Throws_WhenFixtureVersionIsUnknown()
        {
            // Arrange
            var fixturePath = WriteFixture("#teensyrom-index-fixture\tv2\tdevice=YRTCPIRY\tstorage=sd\tfiles=0\n");

            try
            {
                // Act
                Action act = () => IndexFixtureReader.ReadHeader(fixturePath);

                // Assert
                act.Should().Throw<InvalidDataException>().WithMessage("*line 1*");
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        private static string WriteFixture(string contents)
        {
            var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.tsv");
            File.WriteAllText(path, contents);
            return path;
        }
    }
}
