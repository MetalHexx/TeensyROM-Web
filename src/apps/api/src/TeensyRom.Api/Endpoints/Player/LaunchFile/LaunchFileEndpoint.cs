using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Api.Services;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Player.LaunchFile
{
    public class LaunchFileEndpoint(IFileLaunchService launcher) : RadEndpoint<LaunchFileRequest, LaunchFileResponse>
    {
        public override void Configure()
        {
            Post("/api/devices/{deviceId}/storage/{storageType}/launch")
                .Produces<LaunchFileResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .Produces<string>(StatusCodes.Status404NotFound, "application/json")
                .ProducesProblem(StatusCodes.Status409Conflict)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("LaunchFile")
                .WithSummary("Launch File")
                .WithDescription(
                    "Launches a file given a valid path to a file stored on the TeensyRom.\n\n" +
                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer."
                )
                .WithTags("Player");
        }

        public override async Task Handle(LaunchFileRequest r, CancellationToken ct)
        {
            var outcome = await launcher.LaunchAsync(r.DeviceId, r.StorageType, new FilePath(r.FilePath), ct);

            switch (outcome.Status)
            {
                case FileLaunchStatus.DeviceNotFound:
                case FileLaunchStatus.StorageUnavailable:
                    SendNotFound(outcome.Message);
                    break;
                case FileLaunchStatus.FileNotFound:
                    SendNotFound($"The file {r.FilePath} was not found.");
                    break;
                case FileLaunchStatus.NotLaunchable:
                    SendValidationError($"The file {r.FilePath} is not launchable.");
                    break;
                case FileLaunchStatus.DeviceBusy:
                    SendProblem(DeviceBusyProblem.Create(r.DeviceId, outcome.DeviceName, outcome.ActiveJobId!));
                    break;
                case FileLaunchStatus.LookupFailed:
                case FileLaunchStatus.LaunchFailed:
                    SendExternalError(outcome.Message);
                    break;
                default:
                    // Launched, or launched but not compatible with TeensyROM hardware - both are successes.
                    var isCompatible = outcome.Status is FileLaunchStatus.Launched;
                    var fileDto = FileItemDto.FromLaunchable(outcome.Item!);
                    fileDto.IsCompatible = isCompatible;

                    Response = new()
                    {
                        LaunchedFile = fileDto,
                        IsCompatible = isCompatible,
                        Message = outcome.Message
                    };
                    Send();
                    break;
            }
        }
    }
}
