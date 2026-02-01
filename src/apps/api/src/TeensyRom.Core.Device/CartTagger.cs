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
    /// <summary>
    /// Service for ensuring consistent device tags across all storage types on a TeensyROM device.
    /// </summary>
    public interface ICartTagger
    {
        /// <summary>
        /// Ensures both USB and SD storage have synchronized cart-tag.txt files with consistent DeviceId.
        /// Handles conflict resolution (prefers SD), unavailable storage, and tag creation.
        /// </summary>
        /// <param name="communicationPort">Communication port to the TeensyROM device.</param>
        /// <returns>Result containing canonical DeviceId and individual storage tag results.</returns>
        Task<CartTagResult> EnsureTagsForDevice(ICommunicationPort communicationPort);
    }
    public class CartTagger(ILoggingService log, IMediator mediator) : ICartTagger
    {
        public async Task<CartTagResult> EnsureTagsForDevice(ICommunicationPort communicationPort)
        {
            var methodName = "CartTagger.EnsureTagsForDevice:";
            
            // Step 1: Fetch tags from both storage types
            log.Internal($"{methodName} Fetching /cart-tag.txt from SD storage");
            var sdResult = await mediator.Send(new GetFileCommand
            {
                StorageType = TeensyStorageType.SD,
                FilePath = new FilePath("/cart-tag.txt"),
                CommunicationPort = communicationPort
            });

            log.Internal($"{methodName} Fetching /cart-tag.txt from USB storage");
            var usbResult = await mediator.Send(new GetFileCommand
            {
                StorageType = TeensyStorageType.USB,
                FilePath = new FilePath("/cart-tag.txt"),
                CommunicationPort = communicationPort
            });

            // Step 2: Parse results and determine availability
            CartTag? sdTag = null;
            CartTag? usbTag = null;
            
            if (sdResult.IsSuccess)
            {
                log.Internal($"{methodName} Deserializing cart-tag.txt from SD");
                sdTag = sdResult.FileData.Deserialize<CartTag>();
            }
            
            if (usbResult.IsSuccess)
            {
                log.Internal($"{methodName} Deserializing cart-tag.txt from USB");
                usbTag = usbResult.FileData.Deserialize<CartTag>();
            }

            bool sdAvailable = sdResult.ErrorCode != GetFileErrorCode.StorageUnavailable;
            bool usbAvailable = usbResult.ErrorCode != GetFileErrorCode.StorageUnavailable;

            // Step 3: Apply synchronization logic based on scenario
            string canonicalDeviceId;
            bool needsSaveToSd = false;
            bool needsSaveToUsb = false;

            if (sdTag is not null && usbTag is not null)
            {
                // Both storage types have tags
                if (sdTag.DeviceId == usbTag.DeviceId)
                {
                    // Scenario A: Both exist with matching IDs - perfect state
                    canonicalDeviceId = sdTag.DeviceId;
                    log.InternalSuccess($"{methodName} Both storage types have matching DeviceId: {canonicalDeviceId}");
                }
                else
                {
                    // Scenario B: Conflict - prefer SD, update USB
                    canonicalDeviceId = sdTag.DeviceId;
                    needsSaveToUsb = true;
                    log.InternalWarning($"{methodName} DeviceId mismatch detected. SD: {sdTag.DeviceId}, USB: {usbTag.DeviceId}. Preferring SD and updating USB.");
                }
            }
            else if (sdTag is not null)
            {
                // Only SD has a tag
                canonicalDeviceId = sdTag.DeviceId;
                if (usbAvailable)
                {
                    // Scenario C: SD exists, USB available but empty - propagate to USB
                    needsSaveToUsb = true;
                    log.Internal($"{methodName} Reusing SD DeviceId {canonicalDeviceId} for USB storage");
                }
                else
                {
                    // Scenario G: SD exists, USB unavailable - use SD ID only
                    log.InternalWarning($"{methodName} USB storage unavailable. Using SD DeviceId: {canonicalDeviceId}");
                }
            }
            else if (usbTag is not null)
            {
                // Only USB has a tag
                canonicalDeviceId = usbTag.DeviceId;
                if (sdAvailable)
                {
                    // Scenario D: USB exists, SD available but empty - propagate to SD
                    needsSaveToSd = true;
                    log.Internal($"{methodName} Reusing USB DeviceId {canonicalDeviceId} for SD storage");
                }
                else
                {
                    // Scenario F: USB exists, SD unavailable - use USB ID only
                    log.InternalWarning($"{methodName} SD storage unavailable. Using USB DeviceId: {canonicalDeviceId}");
                }
            }
            else
            {
                // Neither storage has a tag
                if (sdAvailable || usbAvailable)
                {
                    // Scenario E: Generate new DeviceId and save to both available storage
                    canonicalDeviceId = Guid.NewGuid().ToString().GenerateFilenameSafeHash();
                    needsSaveToSd = sdAvailable;
                    needsSaveToUsb = usbAvailable;
                    log.Internal($"{methodName} No existing tags found. Generated new DeviceId: {canonicalDeviceId}");
                }
                else
                {
                    // Scenario H: Both unavailable - cannot establish identity
                    canonicalDeviceId = string.Empty;
                    log.InternalWarning($"{methodName} Both storage types unavailable. Cannot establish device identity.");
                }
            }

            // Step 4: Save tags to storage where needed
            if (needsSaveToSd)
            {
                await SaveTagToStorage(communicationPort, TeensyStorageType.SD, canonicalDeviceId, methodName);
            }

            if (needsSaveToUsb)
            {
                await SaveTagToStorage(communicationPort, TeensyStorageType.USB, canonicalDeviceId, methodName);
            }

            // Step 5: Construct CartStorage objects
            var sdStorage = new CartStorage
            {
                Available = sdAvailable,
                DeviceId = canonicalDeviceId,
                Type = TeensyStorageType.SD
            };

            var usbStorage = new CartStorage
            {
                Available = usbAvailable,
                DeviceId = canonicalDeviceId,
                Type = TeensyStorageType.USB
            };

            // Step 6: Return consolidated result
            return new CartTagResult
            {
                DeviceId = canonicalDeviceId,
                SdStorage = sdStorage,
                UsbStorage = usbStorage
            };
        }

        private async Task SaveTagToStorage(ICommunicationPort communicationPort, TeensyStorageType storageType, string deviceId, string methodName)
        {
            var newTag = new CartTag { DeviceId = deviceId };
            var newTagBuffer = newTag.Serialize();

            if (newTagBuffer is null)
            {
                log.InternalError($"{methodName} Unable to serialize cart tag for {storageType}. Skipping save.");
                return;
            }

            var fileTransferItem = new FileTransferItem
            (
                buffer: newTagBuffer,
                targetFilePath: new DirectoryPath(StorageHelper.Remote_Path_Root).Combine(new FilePath("cart-tag.txt")),
                targetStorage: storageType
            );

            log.Internal($"{methodName} Saving cart-tag.txt to {storageType} with DeviceId: {deviceId}");

            var saveFileCommand = new SaveFilesCommand
            {
                Files = [fileTransferItem],
                CommunicationPort = communicationPort
            };

            var saveFileResult = await mediator.Send(saveFileCommand);

            if (!saveFileResult.IsSuccess)
            {
                log.InternalError($"{methodName} Failed to save cart-tag.txt to {storageType}");
            }
            else
            {
                log.InternalSuccess($"{methodName} Successfully saved cart-tag.txt to {storageType} with DeviceId: {deviceId}");
            }
        }
    }
}
