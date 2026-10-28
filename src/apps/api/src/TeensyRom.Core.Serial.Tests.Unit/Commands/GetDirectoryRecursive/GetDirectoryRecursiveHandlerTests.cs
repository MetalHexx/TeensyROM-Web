using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.Common;
using TeensyRom.Core.Serial.Tests.Unit.Routines;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.GetDirectoryRecursive
{
    /// <summary>
    /// The firmware answers a listing with Ack, Ack, a start token, one JSON line per item and an end
    /// token. A missing folder, or a file, gets a fail token and an error line instead of the second Ack.
    /// </summary>
    public class GetDirectoryRecursiveHandlerTests
    {
        private static readonly DirectoryPath Music = new("/music/");

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();

        private static GetDirectoryRecursiveCommand BuildCommand(ScriptedCommunicationPort port) => new()
        {
            StorageType = TeensyStorageType.SD,
            Path = Music,
            Recursive = false,
            CommunicationPort = port
        };

        /// <summary>The handler never clears the port, so the test makes the scripted reply current itself.</summary>
        private static ScriptedCommunicationPort Listing(params string[] lines)
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.StartDirectoryList);

            foreach (var line in lines)
            {
                port.EnqueueText($"{line}\r\n");
            }

            port.EnqueueToken(TeensyToken.EndDirectoryList);
            port.ClearBuffers();
            return port;
        }

        /// <summary>
        /// An empty folder is the start token straight into the end token. It used to fail as "No data
        /// was returned from the TR." after logging the end token as an item it could not parse.
        /// </summary>
        [Fact]
        public async Task Handle_EmptyFolder_IsAnEmptyListing()
        {
            var port = Listing();

            var result = await new GetDirectoryRecursiveHandler(_log).Handle(BuildCommand(port));

            result.IsSuccess.Should().BeTrue();
            var content = result.DirectoryContent.Should().ContainSingle().Subject!;
            content.Path.Should().Be(Music);
            content.Files.Should().BeEmpty();
            content.Directories.Should().BeEmpty();
            _log.DidNotReceive().InternalError(Arg.Any<string>(), Arg.Any<string?>());
        }

        [Fact]
        public async Task Handle_FileAndFolder_AreBothListed()
        {
            var port = Listing(
                """{"type":"dir","name":"games"}""",
                """{"type":"file","name":"tune.sid","size":1234}""");

            var result = await new GetDirectoryRecursiveHandler(_log).Handle(BuildCommand(port));

            result.IsSuccess.Should().BeTrue();
            var content = result.DirectoryContent.Should().ContainSingle().Subject!;
            content.Directories.Should().ContainSingle();
            var file = content.Files.Should().ContainSingle().Subject;
            file.Name.Should().Be("tune.sid");
            file.Size.Should().Be(1234);
            _log.DidNotReceive().InternalError(Arg.Any<string>(), Arg.Any<string?>());
        }

        [Fact]
        public async Task Handle_MissingFolder_IsDirectoryNotFound()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Fail).EnqueueText("Directory not found. (Error 5)\r\n");
            port.ClearBuffers();

            var result = await new GetDirectoryRecursiveHandler(_log).Handle(BuildCommand(port));

            result.IsSuccess.Should().BeFalse();
            result.ErrorCode.Should().Be(GetDirectoryErrorCode.DirectoryNotFoundError);
        }
    }
}
