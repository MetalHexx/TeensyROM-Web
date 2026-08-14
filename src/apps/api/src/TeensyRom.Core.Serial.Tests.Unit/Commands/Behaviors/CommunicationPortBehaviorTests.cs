using System.Reflection;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.Serial.Commands.Behaviors;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.Behaviors;

public class CommunicationPortBehaviorTests
{
    private sealed class FakeCommand : ITeensyCommand<TeensyCommandResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }

    /// <summary>
    /// Answers just enough of the pre-handler firmware/busy handshake for
    /// <see cref="CommunicationPortBehavior{TRequest,TResponse}"/> to fall through to <c>next()</c>.
    /// </summary>
    private sealed class StubCommunicationPort : ICommunicationPort
    {
        public bool IsOpen => true;
        public int BytesToRead => 2;

        public void ClearBuffers() { }
        public void SendIntBytes(uint intToSend, short numBytes) { }
        public uint ReadIntBytes(short byteLength) => 0;

        public int Read(byte[] buffer, int offset, int count)
        {
            var bytes = BitConverter.GetBytes(TeensyToken.FWFullToken.Value);
            var toCopy = Math.Min(count, bytes.Length);
            Array.Copy(bytes, 0, buffer, offset, toCopy);
            return toCopy;
        }

        public int ReadByte() => -1;
        public void Write(string text) { }
        public void Write(byte[] buffer, int offset, int count) { }
        public void Write(char[] buffer, int offset, int count) { }
        public System.Reactive.Unit SetPort(string port) => System.Reactive.Unit.Default;
        public string? OpenPort(bool useRetryLoop = true) => "TEST";
        public System.Reactive.Unit ClosePort() => System.Reactive.Unit.Default;
        public string ReadSerialAsString(int msToWait = 0) => string.Empty;
        public string ReadAndLogSerialAsString(int msToWait = 0) => string.Empty;
        public byte[] ReadSerialBytes() => [];
        public byte[] ReadSerialBytes(int msToWait = 0) => [];
        public void WaitForSerialData(int numBytes, int timeoutMs) { }
        public void SendSignedChar(sbyte charToSend) { }
        public void SendSignedShort(short value) { }
        public string GetEndpoint() => "TEST";
        public ConnectionType GetConnectionType() => ConnectionType.Tcp;
        public void Dispose() { }
    }

    /// <summary>
    /// Reproduces the defect directly: a command that legitimately outlives the stale-lock cutoff must
    /// not have its semaphore disposed by a second command's concurrent cleanup pass. Shortens the
    /// private static cutoff via reflection rather than waiting five real minutes - the field itself is
    /// production-only state, not a test hook added to production code.
    /// </summary>
    [Fact]
    public async Task Handle_LongRunningCommandHoldsLock_ConcurrentCleanupPassDoesNotDisposeIt()
    {
        var staleLockField = typeof(CommunicationPortBehavior<FakeCommand, TeensyCommandResult>)
            .GetField("_staleLockMinutes", BindingFlags.NonPublic | BindingFlags.Static)!;
        var original = staleLockField.GetValue(null);
        staleLockField.SetValue(null, TimeSpan.Zero); // every existing lock entry is immediately "stale" by its last-used timestamp

        try
        {
            var log = Substitute.For<ILoggingService>();
            var behaviorA = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(log);
            var behaviorB = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(log);
            var deviceId = Guid.NewGuid().ToString("N");
            var commandA = new FakeCommand { DeviceId = deviceId, CommunicationPort = new StubCommunicationPort() };
            var commandB = new FakeCommand { DeviceId = deviceId, CommunicationPort = new StubCommunicationPort() };
            var aAcquired = new TaskCompletionSource();

            var taskA = behaviorA.Handle(commandA, async () =>
            {
                aAcquired.SetResult();
                await Task.Delay(200);
                return new TeensyCommandResult();
            }, CancellationToken.None);

            await aAcquired.Task;

            // B's Handle call runs CleanupStaleLocks - with the zeroed cutoff, every entry is stale by
            // timestamp alone - while A still holds the semaphore for the same device.
            var resultB = await behaviorB.Handle(
                commandB, () => Task.FromResult(new TeensyCommandResult()), CancellationToken.None);
            var resultA = await taskA;

            resultA.IsSuccess.Should().BeTrue();
            resultB.IsSuccess.Should().BeTrue();
        }
        finally
        {
            staleLockField.SetValue(null, original);
        }
    }
}
