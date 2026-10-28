using System.Buffers.Binary;
using TeensyRom.Core.Commands.GetFile;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Tests.Unit.Routines;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.GetFile
{
    /// <summary>
    /// The firmware answers a download with Ack, Ack, the length, the checksum, the body and a final Ack.
    /// It reads the whole file to sum it before the checksum goes out, so the checksum can trail the
    /// length by seconds. The fake port runs on virtual time: a late arrival is delivered only to a wait
    /// whose budget covers its gap, and no test actually sleeps.
    /// </summary>
    public class GetFileCommandHandlerTests
    {
        private static readonly byte[] Ack = [(byte)(TeensyToken.Ack.Value & 0xFF), (byte)(TeensyToken.Ack.Value >> 8)];

        private static GetFileCommand BuildCommand(ScriptedCommunicationPort port) => new()
        {
            StorageType = TeensyStorageType.SD,
            FilePath = new FilePath("/games/game.crt"),
            CommunicationPort = port
        };

        private static byte[] Body(int length)
        {
            var body = new byte[length];
            new Random(length).NextBytes(body);
            return body;
        }

        private static byte[] U32(uint value)
        {
            var bytes = new byte[4];
            BinaryPrimitives.WriteUInt32LittleEndian(bytes, value);
            return bytes;
        }

        private static byte[] Checksum(byte[] body) => U32(body.CalculateChecksum());

        /// <summary>
        /// Scripts the two Acks, the length and then <paramref name="followedBy"/>, all readable at once. The
        /// handler's own <c>ClearBuffers</c> makes them current.
        /// </summary>
        private static ScriptedCommunicationPort Script(byte[] body, params byte[][] followedBy)
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack).Enqueue(U32((uint)body.Length));

            foreach (var bytes in followedBy)
            {
                port.Enqueue(bytes);
            }
            return port;
        }

        [Fact]
        public async Task Handle_WholeReplyAtOnce_ReturnsTheBody()
        {
            var body = Body(5_000);
            var port = Script(body, Checksum(body), body, Ack);

            var result = await new GetFileCommandHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.FileData.SequenceEqual(body).Should().BeTrue();
            port.Unread.Should().Be(0);
        }

        /// <summary>
        /// A 2 MB file's checksum arriving 6 s after its length: past the base wait, and far past the
        /// 500 ms a TCP read allows on its own, but inside the wait the file's size earns.
        /// </summary>
        [Fact]
        public async Task Handle_ChecksumArrivesAfterTheBaseWait_WaitsLongerForALargerFile()
        {
            var body = Body(2 * 1_048_576);
            var port = Script(body);
            port.EnqueueAfterQuiet(GetFileCommandHandler.ChecksumBaseWaitMs + 1_000, [.. Checksum(body), .. body, .. Ack]);

            var result = await new GetFileCommandHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.FileData.SequenceEqual(body).Should().BeTrue();
        }

        [Fact]
        public async Task Handle_ChecksumNeverArrivesInTime_ThrowsTimeout()
        {
            var body = Body(1_000);
            var port = Script(body);
            port.EnqueueAfterQuiet(GetFileCommandHandler.ChecksumWaitMs((uint)body.Length) + 1, [.. Checksum(body), .. body, .. Ack]);

            var act = () => new GetFileCommandHandler().Handle(BuildCommand(port), CancellationToken.None);

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Theory]
        [InlineData(0u, 5_000)]
        [InlineData(1_048_576u, 6_000)]
        [InlineData(8 * 1_048_576u, 13_000)]
        [InlineData(10 * 1_048_576u, 15_000)]
        public void ChecksumWaitMs_GrowsWithTheFile(uint fileLength, int expectedMs)
        {
            GetFileCommandHandler.ChecksumWaitMs(fileLength).Should().Be(expectedMs);
        }

        [Fact]
        public async Task Handle_BodyResumesWithinTheStallWait_ReturnsTheBody()
        {
            var body = Body(4_000);
            var port = Script(body, Checksum(body), body[..1_000]);
            port.EnqueueAfterQuiet(GetFileCommandHandler.BodyStallMs - 1_000, [.. body[1_000..], .. Ack]);

            var result = await new GetFileCommandHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.FileData.SequenceEqual(body).Should().BeTrue();
        }

        /// <summary>
        /// The device stops partway through the body. A serial read has no timeout of its own, so before
        /// the stall wait this hung the download for as long as the device stayed quiet.
        /// </summary>
        [Fact]
        public async Task Handle_BodyStallsPastTheStallWait_ThrowsTimeout()
        {
            var body = Body(4_000);
            var port = Script(body, Checksum(body), body[..1_000]);
            port.EnqueueAfterQuiet(GetFileCommandHandler.BodyStallMs + 1, [.. body[1_000..], .. Ack]);

            var act = () => new GetFileCommandHandler().Handle(BuildCommand(port), CancellationToken.None);

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task Handle_AlreadyCancelled_ThrowsInsteadOfWaitingForTheFile()
        {
            var body = Body(4_000);
            var port = Script(body, Checksum(body), body[..1_000]);
            using var cts = new CancellationTokenSource();
            cts.Cancel();

            var act = () => new GetFileCommandHandler().Handle(BuildCommand(port), cts.Token);

            await act.Should().ThrowAsync<OperationCanceledException>();
        }

        [Fact]
        public async Task Handle_ChecksumMismatch_Throws()
        {
            var body = Body(1_000);
            var port = Script(body, U32((uint)(body.CalculateChecksum() + 1) & 0xFFFF), body, Ack);

            var act = () => new GetFileCommandHandler().Handle(BuildCommand(port), CancellationToken.None);

            await act.Should().ThrowAsync<TeensyException>().WithMessage("Checksum Mismatch");
        }
    }
}
