using MediatR;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Serial.Commands
{
    public interface ITeensyCommand<T> : IRequest<T> 
    {
        string? DeviceId { get; set; }
        ICommunicationPort CommunicationPort { get; init; }
    }
}
