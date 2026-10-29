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

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();

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
        private static ScriptedCommunicationPort Script(byte[] body, params byte[][] followedBy) =>
            Answer(new ScriptedCommunicationPort(), body, followedBy);

        /// <summary>Scripts the device's answer to one more download request, in its own segment.</summary>
        private static ScriptedCommunicationPort Answer(ScriptedCommunicationPort port, byte[] body, params byte[][] followedBy)
        {
            port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack).Enqueue(U32((uint)body.Length));

            foreach (var bytes in followedBy)
            {
                port.Enqueue(bytes);
            }
            return port;
        }

        /// <summary>The body with the 1,536 bytes after its first 2,048 missing: the shape of a USB loss.</summary>
        private static byte[] WithBlockLost(byte[] body) => [.. body[..2_048], .. body[3_584..]];

        [Fact]
        public async Task Handle_WholeReplyAtOnce_ReturnsTheBody()
        {
            var body = Body(5_000);
            var port = Script(body, Checksum(body), body, Ack);

            var result = await new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

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

            var result = await new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            result.FileData.SequenceEqual(body).Should().BeTrue();
        }

        [Fact]
        public async Task Handle_ChecksumNeverArrivesInTime_ThrowsTimeout()
        {
            var body = Body(1_000);
            var port = Script(body);
            port.EnqueueAfterQuiet(GetFileCommandHandler.ChecksumWaitMs((uint)body.Length) + 1, [.. Checksum(body), .. body, .. Ack]);

            var act = () => new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

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

            var result = await new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

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

            var act = () => new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            await act.Should().ThrowAsync<TimeoutException>()
                .WithMessage($"Read 1000 of 4000 bytes, then nothing arrived for {GetFileCommandHandler.BodyStallMs} ms");
        }

        /// <summary>
        /// Over USB, a port left unread between reads while the device streams the body loses whole packets
        /// of the file. The port gets the whole body in one read, which the serial port serves by reading
        /// back to back; only the length and the checksum are waited for first.
        /// </summary>
        [Fact]
        public async Task Handle_Body_IsReadInOneCallForTheWholeLength_NeverWaitedForFirst()
        {
            var body = Body(4_000);
            var port = Script(body, Checksum(body), body[..1_000]);
            port.EnqueueAfterQuiet(GetFileCommandHandler.BodyStallMs - 1_000, [.. body[1_000..], .. Ack]);

            var result = await new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            const int AckWaitMs = 20_000; // HandleAck's own wait

            result.FileData.SequenceEqual(body).Should().BeTrue();
            port.ReadExactlyCalls.Should().Equal((body.Length, GetFileCommandHandler.BodyStallMs));
            port.WaitTimeoutsMs.Should().Equal(
                AckWaitMs, AckWaitMs, GetFileCommandHandler.LengthWaitMs, GetFileCommandHandler.ChecksumWaitMs((uint)body.Length), AckWaitMs);
        }

        /// <summary>
        /// Over USB a block of the body can be lost on the way while the device still sends the rest and its
        /// closing Ack. The device has finished, so the handler asks once more and returns the second answer.
        /// </summary>
        [Fact]
        public async Task Handle_BodyArrivesShortButEndsWithTheClosingAck_AsksOnceMoreAndReturnsTheBody()
        {
            var body = Body(8_192);
            var port = Script(body, Checksum(body), WithBlockLost(body), Ack);
            Answer(port, body, Checksum(body), body, Ack);

            var result = await new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            result.FileData.SequenceEqual(body).Should().BeTrue();
            port.ReadExactlyCalls.Should().HaveCount(2);
            port.Unread.Should().Be(0);
            _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("arrived 1536 bytes short")), Arg.Any<string?>());
        }

        [Fact]
        public async Task Handle_BodyArrivesShortTwice_ThrowsTimeoutWithoutAskingAThirdTime()
        {
            var body = Body(8_192);
            var port = Script(body, Checksum(body), WithBlockLost(body), Ack);
            Answer(port, body, Checksum(body), WithBlockLost(body), Ack);
            Answer(port, body, Checksum(body), body, Ack);

            var act = () => new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            await act.Should().ThrowAsync<TeensyShortDownloadException>();
            port.ReadExactlyCalls.Should().HaveCount(2);
        }

        /// <summary>
        /// A body that stops before the closing Ack is a device that stopped sending, not bytes lost on the way:
        /// it goes to the command pipeline as a timeout, without asking again.
        /// </summary>
        [Fact]
        public async Task Handle_BodyStallsBeforeTheClosingAck_IsNotAskedAgain()
        {
            var body = Body(4_000);
            var port = Script(body, Checksum(body), body[..1_000]);
            Answer(port, body, Checksum(body), body, Ack);

            var act = () => new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            (await act.Should().ThrowAsync<TeensyReadStalledException>()).Which.BytesRead.Should().Be(1_000);
            port.ReadExactlyCalls.Should().HaveCount(1);
        }

        [Fact]
        public async Task Handle_AlreadyCancelled_ThrowsInsteadOfWaitingForTheFile()
        {
            var body = Body(4_000);
            var port = Script(body, Checksum(body), body[..1_000]);
            using var cts = new CancellationTokenSource();
            cts.Cancel();

            var act = () => new GetFileCommandHandler(_log).Handle(BuildCommand(port), cts.Token);

            await act.Should().ThrowAsync<OperationCanceledException>();
        }

        [Fact]
        public async Task Handle_ChecksumMismatch_Throws()
        {
            var body = Body(1_000);
            var port = Script(body, U32((uint)(body.CalculateChecksum() + 1) & 0xFFFF), body, Ack);

            var act = () => new GetFileCommandHandler(_log).Handle(BuildCommand(port), CancellationToken.None);

            await act.Should().ThrowAsync<TeensyException>().WithMessage("Checksum Mismatch");
        }
    }
}
