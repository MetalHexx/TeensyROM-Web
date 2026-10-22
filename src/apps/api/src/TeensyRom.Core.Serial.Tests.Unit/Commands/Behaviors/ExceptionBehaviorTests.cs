using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.Serial.Commands.Behaviors;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.Behaviors;

public class ExceptionBehaviorTests
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private Task<TeensyCommandResult> HandleThrowing(Exception ex, MediatR.IRequest<TeensyCommandResult>? request = null) =>
        new ExceptionBehavior<MediatR.IRequest<TeensyCommandResult>, TeensyCommandResult>(_log)
            .Handle(request ?? Substitute.For<MediatR.IRequest<TeensyCommandResult>>(), () => throw ex, CancellationToken.None);

    [Fact]
    public async Task Handle_LinkException_ReturnsItsMessageVerbatim()
    {
        var result = await HandleThrowing(new TeensyLinkException("Lost the network connection."));

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("Lost the network connection.");
    }

    [Theory]
    [InlineData("")]
    [InlineData("\0\0")]
    [InlineData(" \0 ")]
    public async Task Handle_ExceptionWithBlankOrNulMessage_NeverReturnsAnEmptyError(string message)
    {
        var result = await HandleThrowing(new IOException(message));

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Handle_Timeout_ReturnsANonEmptyError()
    {
        var result = await HandleThrowing(new TimeoutException());

        result.Error.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Handle_LinkException_WritesItsMessageToTheLog()
    {
        await HandleThrowing(new TeensyLinkException("Lost the network connection."));

        _log.Received(1).InternalError("Lost the network connection.", Arg.Any<string?>());
    }

    [Fact]
    public async Task Handle_BusyException_WritesItsMessageToTheLog()
    {
        var result = await HandleThrowing(new TeensyBusyException("Busy."));

        result.IsBusy.Should().BeTrue();
        _log.Received(1).InternalWarning("Busy.", Arg.Any<string?>());
    }

    [Fact]
    public async Task Handle_UnexpectedException_LogsTypeAndStackTraceTaggedWithTheDeviceId()
    {
        var request = Substitute.For<ITeensyCommand<TeensyCommandResult>>();
        request.DeviceId.Returns("abc123");
        Exception thrown;
        try { throw new InvalidOperationException("boom"); }
        catch (Exception ex) { thrown = ex; }

        var result = await new ExceptionBehavior<ITeensyCommand<TeensyCommandResult>, TeensyCommandResult>(_log)
            .Handle(request, () => throw thrown, CancellationToken.None);

        result.Error.Should().Contain("boom");
        _log.Received(1).InternalError(
            Arg.Is<string>(m => m.Contains("boom") && m.Contains(nameof(InvalidOperationException)) && m.Contains(nameof(Handle_UnexpectedException_LogsTypeAndStackTraceTaggedWithTheDeviceId))),
            "abc123");
    }
}
