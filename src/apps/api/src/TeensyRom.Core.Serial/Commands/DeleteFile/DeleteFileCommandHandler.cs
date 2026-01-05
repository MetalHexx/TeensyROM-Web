using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands.DeleteFile
{
  public class DeleteFileCommandHandler(IAlertService alert) : IRequestHandler<DeleteFileCommand, DeleteFileResult>
  {
    public async Task<DeleteFileResult> Handle(DeleteFileCommand r, CancellationToken cancellationToken)
    {
      try
      {
        await ProcessDelete(r);
        return new DeleteFileResult();
      }
      catch (Exception ex)
      {
        alert.Publish("Delete Error: TR is busy.  Restarting TR.");

        return new DeleteFileResult
        {
          Error = ex.ToString(),
          IsSuccess = false,
          IsBusy = ex.Message.Contains("busy")
        };
      }
    }

    private async Task<DeleteFileResult> ProcessDelete(DeleteFileCommand r)
    {
      try
      {
        Delete(r);
        return new DeleteFileResult();
      }
      catch (Exception ex)
      {
        if (ex.Message.Contains("busy", StringComparison.OrdinalIgnoreCase))
        {
          alert.Publish("Delete Error: TR is busy.  Restarting TR.");

          var resetResult = await r.CommunicationPort.ReconnectPort();

          if (resetResult is true)
          {
            Delete(r);
            return new DeleteFileResult();
          }
          return new DeleteFileResult
          {
            IsSuccess = false,
            Error = ex.ToString()
          };
        }
        throw;
      }
    }

    private void Delete(DeleteFileCommand r)
    {
      r.CommunicationPort.SendIntBytes(TeensyToken.DeleteFile, 2);
      r.CommunicationPort.HandleAck();
      r.CommunicationPort.SendIntBytes(r.StorageType.GetStorageToken(), 1);
      r.CommunicationPort.Write($"{r.Path}\0");
      r.CommunicationPort.HandleAck();
    }
  }
}
