using System.Net;
using Microsoft.AspNetCore.Mvc;
using RadEndpoints.Testing;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Api.Endpoints.Files.GetDirectory;
using TeensyRom.Api.Endpoints.Player.ToggleMusic;
using TeensyRom.Api.Endpoints.ResetDevice;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// A device holding a transfer lease refuses every other device command with the shared 409, while
    /// the other device keeps answering normally.
    /// </summary>
    [Collection("Transfer")]
    public class DeviceBusyEndpointTests(TransferFixture f) : IAsyncLifetime
    {
        private string? _jobId;

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            if (_jobId is not null)
            {
                await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new CancelJobRequest { JobId = _jobId });
            }

            await f.WaitForQuiescenceAsync();
        }

        private async Task<string> StartJobOnDevice0()
        {
            var created = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(new CreateJobRequest
            {
                DeviceId = f.DeviceManager.Devices[0].DeviceId,
                StorageType = TeensyStorageType.SD,
                Body = new CreateJobBody { DestinationDirectory = "/music/incoming" }
            });

            created.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            _jobId = created.Content.JobId;
            return _jobId;
        }

        private static void AssertBusy(RadTestResult<ProblemDetails> response, string deviceId, string jobId)
        {
            response.Should().BeProblem().WithStatusCode(HttpStatusCode.Conflict);
            response.Content.Type.Should().Be(DeviceBusyProblem.Type);
            response.Content.Extensions["code"]!.ToString().Should().Be(DeviceBusyProblem.Code);
            response.Content.Extensions["deviceId"]!.ToString().Should().Be(deviceId);
            response.Content.Extensions["activeJobId"]!.ToString().Should().Be(jobId);
        }

        [Fact]
        public async Task ResetToggleMusicAndCacheMissDirectoryRead_OnTransferringDevice_AnswerTheSharedConflict()
        {
            var deviceId = f.DeviceManager.Devices[0].DeviceId;
            var jobId = await StartJobOnDevice0();

            var reset = await f.Client.PutAsync<ResetDeviceEndpoint, ResetDeviceRequest, ProblemDetails>(
                new ResetDeviceRequest { DeviceId = deviceId });
            var toggle = await f.Client.PostAsync<ToggleMusicEndpoint, ToggleMusicRequest, ProblemDetails>(
                new ToggleMusicRequest { DeviceId = deviceId });
            var directory = await f.Client.GetAsync<GetDirectoryEndpoint, GetDirectoryRequest, ProblemDetails>(new GetDirectoryRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                Path = $"/never-read-{Guid.NewGuid():N}"
            });

            AssertBusy(reset, deviceId, jobId);
            AssertBusy(toggle, deviceId, jobId);
            AssertBusy(directory, deviceId, jobId);
        }

        [Fact]
        public async Task ResetToggleMusicAndDirectoryRead_OnTheOtherDevice_AreNotRefused()
        {
            var otherDeviceId = f.DeviceManager.Devices[1].DeviceId;
            await StartJobOnDevice0();

            var reset = await f.Client.PutAsync<ResetDeviceEndpoint, ResetDeviceRequest, ResetDeviceResponse>(
                new ResetDeviceRequest { DeviceId = otherDeviceId });
            var toggle = await f.Client.PostAsync<ToggleMusicEndpoint, ToggleMusicRequest, ToggleMusicResponse>(
                new ToggleMusicRequest { DeviceId = otherDeviceId });
            var directory = await f.Client.GetAsync<GetDirectoryEndpoint, GetDirectoryRequest, System.Text.Json.JsonElement>(new GetDirectoryRequest
            {
                DeviceId = otherDeviceId,
                StorageType = TeensyStorageType.SD,
                Path = $"/never-read-{Guid.NewGuid():N}"
            });

            reset.Http.StatusCode.Should().Be(HttpStatusCode.OK);
            toggle.Http.StatusCode.Should().Be(HttpStatusCode.OK);
            directory.Http.StatusCode.Should().NotBe(HttpStatusCode.Conflict);
        }
    }
}
