using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Commands.Behaviors;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.Behaviors;

public class ExceptionBehaviorTests
{
    private static Task<TeensyCommandResult> HandleThrowing(Exception ex) =>
        new ExceptionBehavior<MediatR.IRequest<TeensyCommandResult>, TeensyCommandResult>(Substitute.For<IAlertService>())
            .Handle(Substitute.For<MediatR.IRequest<TeensyCommandResult>>(), () => throw ex, CancellationToken.None);

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
}
