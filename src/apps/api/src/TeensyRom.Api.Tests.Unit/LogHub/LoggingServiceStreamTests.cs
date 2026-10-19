using TeensyRom.Api.Services;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Tests.LogHub;

public class LoggingServiceStreamTests : IDisposable
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    private readonly ILogStream _stream = Substitute.For<ILogStream>();
    private readonly LoggingService _logging;

    public LoggingServiceStreamTests()
    {
        _logging = new LoggingService(_stream);
    }

    public void Dispose() => _logging.StopLogStream();

    [Fact]
    public async Task StartLogStream_WhileRunning_KeepsQueuedLinesAndStartsNoSecondPump()
    {
        var gate = new TaskCompletionSource();
        _stream.Push(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<string>(0) == "gate" ? gate.Task : Task.CompletedTask);

        _logging.StartLogStream();
        _logging.Internal("gate");
        await WaitUntilAsync(() => _stream.ReceivedCalls().Any());

        // The pump is parked inside Push, so this line is still queued when the second start arrives.
        _logging.Internal("queued");
        _logging.StartLogStream();
        _logging.Internal("after");
        gate.SetResult();

        await WaitUntilAsync(() => PushCount("after") > 0);
        await Task.Delay(300);

        PushCount("gate").Should().Be(1);
        PushCount("queued").Should().Be(1);
        PushCount("after").Should().Be(1);
    }

    private int PushCount(string line) =>
        _stream.ReceivedCalls().Count(call => call.GetMethodInfo().Name == nameof(ILogStream.Push) && (string)call.GetArguments()[0]! == line);

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow + Timeout;
        while (!condition())
        {
            if (DateTime.UtcNow > deadline) throw new TimeoutException("Condition was not met in time.");
            await Task.Delay(20);
        }
    }
}
