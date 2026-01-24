using MediatR;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Commands.DeleteFile
{
	public class DeleteFileCommandHandler : IRequestHandler<DeleteFileCommand, DeleteFileResult>
	{
		public Task<DeleteFileResult> Handle(DeleteFileCommand r, CancellationToken cancellationToken)
		{
			r.CommunicationPort.SendIntBytes(TeensyToken.DeleteFile, 2);
			r.CommunicationPort.HandleAck();
			r.CommunicationPort.SendIntBytes(r.StorageType.GetStorageToken(), 1);
			r.CommunicationPort.Write($"{r.Path}\0");
			r.CommunicationPort.HandleAck();			
			return Task.FromResult(new DeleteFileResult());			
		}
	}
}
