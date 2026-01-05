using MediatR;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Commands
{
    public class CopyFileHandler : IRequestHandler<CopyFileCommand, CopyFileResult>
    {
        public Task<CopyFileResult> Handle(CopyFileCommand request, CancellationToken cancellationToken)
        {
            request.CommunicationPort.SendIntBytes(TeensyToken.CopyFile, 2);
            request.CommunicationPort.HandleAck();
            request.CommunicationPort.SendIntBytes(request.StorageType.GetStorageToken(), 1);
            request.CommunicationPort.Write($"{request.SourcePath}\0");
            request.CommunicationPort.Write($"{request.DestPath}\0");
            request.CommunicationPort.HandleAck();
            return Task.FromResult(new CopyFileResult());
        }
    }
}