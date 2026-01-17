using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Commands.GetFile;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Device
{
    public interface ICartTagger
    {
        Task<CartStorage> EnsureTag(ICommunicationPort communicationPort, TeensyStorageType storageType);
    }
    public class CartTagger(ILoggingService log, IMediator mediator) : ICartTagger
    {
        public async Task<CartStorage> EnsureTag(ICommunicationPort communicationPort, TeensyStorageType storageType)
        {
            var methodName = "CartTagger.EnsureTag:";
			log.Internal($"{methodName}  Fetching /cart-tag.txt from {storageType}");
			var getFileCommand = new GetFileCommand
            {
                StorageType = storageType,
                FilePath = new FilePath("/cart-tag.txt"),
                CommunicationPort = communicationPort
            };
            var getFileResult = await mediator.Send(getFileCommand);

            if (getFileResult.ErrorCode is GetFileErrorCode.StorageUnavailable)
            {
                log.InternalWarning($"{methodName} {storageType} storage is unavailable.");

                return new CartStorage
                {
                    Available = false,
                    Type = storageType
                };
            }
            if (getFileResult.ErrorCode is GetFileErrorCode.FileNotFound)
            {
                log.InternalWarning($"{methodName} Failed to get remote config file from {storageType}");
            }
			if(getFileResult.IsSuccess is false)
			{
				var errorMessage = $"{methodName} Failed to get remote config file from {storageType}.  Unknown error occured.";
				log.InternalWarning(errorMessage);
				throw new TeensyException(errorMessage);
			}
            else
            {
				log.Internal($"{methodName} Deserializing cart-tag.txt for {storageType}");
                var tagFromTr = getFileResult.FileData.Deserialize<CartTag>();

                if (tagFromTr is not null)
                {
                    log.InternalSuccess($"{methodName} Succesfully retrieved tag from {storageType} device.", tagFromTr.DeviceId);
                    return new CartStorage
                    {
                        Available = true,
                        Type = storageType,
                        DeviceId = tagFromTr.DeviceId
                    };
                }
            }			
            var deviceHash = Guid.NewGuid().ToString().GenerateFilenameSafeHash();

            var newTag = new CartTag { DeviceId = deviceHash };
            var newTagBuffer = newTag.Serialize();

            if (newTagBuffer is null)
            {
                log.InternalError($"{methodName} Unable to serialize cart config.  Skipping device.");
                return new CartStorage
                {
                    Available = false,
                    Type = storageType
                };
            }
            var fileTransferItem = new FileTransferItem
            (
                buffer: newTagBuffer,
                targetFilePath: new DirectoryPath(StorageHelper.Remote_Path_Root).Combine(new FilePath("cart-tag.txt")),
                targetStorage: storageType
            );

			log.Internal($"{methodName} Creating a new cart-tag.txt file for {storageType} and saving to TR.");

			var saveFileCommand = new SaveFilesCommand
            {
                Files = [fileTransferItem],
                CommunicationPort = communicationPort
            };
            var saveFileResult = await mediator.Send(saveFileCommand);

            if (saveFileResult.IsSuccess is false)
            {
                log.InternalError($"{methodName} Failed to save remote config file to {storageType}");
                return new CartStorage
                {
                    Available = false,
                    Type = storageType
                };
            }
			log.InternalSuccess($"{methodName} Successfully saved new cart-tag.txt on {storageType} with DeviceId: {deviceHash}");
            return new CartStorage
            {
                Available = true,
                Type = storageType,
                DeviceId = deviceHash
            };
        }
    }
}
