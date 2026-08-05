using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Transfers.CancelJob;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.GetActiveJob;
using TeensyRom.Api.Endpoints.Transfers.GetJob;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Drives the whole transfer lifecycle through HTTP alone - no SignalR involved - proving a client
    /// can run a transfer end to end by polling <see cref="GetJobEndpoint"/> and
    /// <see cref="GetActiveJobEndpoint"/>.
    /// </summary>
    [Collection("Transfer")]
    public class TransferJobLifecycleEndpointTests(TransferFixture f) : IAsyncLifetime
    {
        public Task InitializeAsync() => Task.CompletedTask;

        /// <summary>
        /// Cancel/Seal return before the pump's background drain finishes releasing the gate/lease -
        /// wait for that drain here so the next test in this shared collection starts from a clean
        /// fixture.
        /// </summary>
        public Task DisposeAsync() => f.WaitForQuiescenceAsync();

        private static CreateJobRequest NewCreateRequest(string deviceId, string destination = "/music/incoming") => new()
        {
            DeviceId = deviceId,
            StorageType = TeensyStorageType.SD,
            Body = new CreateJobBody { DestinationDirectory = destination }
        };

        [Fact]
        public async Task Lifecycle_CreateGetSealGet_JobReachesCompletedWithNoUpload()
        {
            var device = f.DeviceManager.Devices[0];

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId));

            createResponse.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            createResponse.Content.JobId.Should().NotBeNullOrEmpty();
            createResponse.Content.Job.DeviceId.Should().Be(device.DeviceId);
            createResponse.Content.Job.State.Should().Be(TransferJobState.Created);

            var jobId = createResponse.Content.JobId;

            var getResponse = await f.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new GetJobRequest { JobId = jobId });

            getResponse.Should().BeSuccessful<GetJobResponse>().WithStatusCode(HttpStatusCode.OK);
            getResponse.Content.Job.JobId.Should().Be(jobId);
            getResponse.Content.Job.State.Should().Be(TransferJobState.Created);

            var sealResponse = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = jobId });

            sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);

            // TryFinalize runs synchronously in the endpoint, so a job sealed with an empty queue
            // reaches Completed immediately - no worker ever needs to wake for it.
            sealResponse.Content.Job.State.Should().Be(TransferJobState.Completed);

            var finalGetResponse = await f.Client.GetAsync<GetJobEndpoint, GetJobRequest, GetJobResponse>(new GetJobRequest { JobId = jobId });

            finalGetResponse.Content.Job.State.Should().Be(TransferJobState.Completed);

            // Completed is terminal, not Sealed - the empty queue already finalized the job in the
            // first seal call, so a second seal is rejected rather than treated as idempotent.
            var resealResponse = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, ProblemDetails>(new SealJobRequest { JobId = jobId });

            resealResponse.Should().BeProblem().WithStatusCode(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Seal_JobWithPendingFile_StaysSealedAndIsIdempotentUntilDrained()
        {
            var device = f.DeviceManager.Devices[0];

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/pending"));
            var jobId = createResponse.Content.JobId;

            var registry = f.Services.GetRequiredService<ITransferJobRegistry>();
            var job = registry.Get(jobId)!;

            // Simulates a file still in flight by incrementing the pending count directly, rather
            // than driving an actual upload through UploadFileEndpoint.
            job.OnFileReceived(1);

            var sealResponse = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = jobId });

            sealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);
            sealResponse.Content.Job.State.Should().Be(TransferJobState.Sealed);

            // Idempotent: sealing an already-sealed job with work still pending does not error.
            var resealResponse = await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = jobId });

            resealResponse.Should().BeSuccessful<SealJobResponse>().WithStatusCode(HttpStatusCode.OK);
            resealResponse.Content.Job.State.Should().Be(TransferJobState.Sealed);

            // Drain the pending file directly and let the pump's shared TryFinalize complete the job,
            // releasing its lease so this test does not leak state into the next one.
            var pump = f.Services.GetRequiredService<TransferPump>();
            job.OnFileDropped();
            pump.TryFinalize(job);

            job.State.Should().Be(TransferJobState.Completed);
        }

        [Fact]
        public async Task Create_SecondJobForSameDevice_IsRejectedUntilFirstIsTerminal()
        {
            var device = f.DeviceManager.Devices[0];

            var firstCreate = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/first"));

            firstCreate.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            var firstJobId = firstCreate.Content.JobId;

            var secondCreate = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, ProblemDetails>(
                NewCreateRequest(device.DeviceId, "/music/second"));

            secondCreate.Should().BeProblem().WithStatusCode(HttpStatusCode.BadRequest);
            secondCreate.Content.Title.Should().Contain(firstJobId);

            // Sealing the first job with an empty queue reaches Completed immediately, releasing its lease.
            await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = firstJobId });

            var thirdCreate = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/third"));

            thirdCreate.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            thirdCreate.Content.JobId.Should().NotBe(firstJobId);

            await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(
                new CancelJobRequest { JobId = thirdCreate.Content.JobId });
        }

        [Fact]
        public async Task Create_ForDifferentDevices_SucceedsConcurrently()
        {
            var deviceA = f.DeviceManager.Devices[0];
            var deviceB = f.DeviceManager.Devices[1];

            var createA = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(deviceA.DeviceId, "/music/device-a"));
            var createB = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(deviceB.DeviceId, "/music/device-b"));

            createA.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            createB.Should().BeSuccessful<CreateJobResponse>().WithStatusCode(HttpStatusCode.OK);
            createA.Content.JobId.Should().NotBe(createB.Content.JobId);

            await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = createA.Content.JobId });
            await f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = createB.Content.JobId });
        }

        [Fact]
        public async Task Cancel_CalledTwice_IsIdempotent()
        {
            var device = f.DeviceManager.Devices[0];

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/cancel-me"));
            var jobId = createResponse.Content.JobId;

            var firstCancel = await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new CancelJobRequest { JobId = jobId });

            firstCancel.Should().BeSuccessful<CancelJobResponse>().WithStatusCode(HttpStatusCode.OK);
            firstCancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);

            var secondCancel = await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new CancelJobRequest { JobId = jobId });

            secondCancel.Should().BeSuccessful<CancelJobResponse>().WithStatusCode(HttpStatusCode.OK);
            secondCancel.Content.Job.State.Should().Be(TransferJobState.Cancelled);
        }

        [Fact]
        public async Task Cancel_UnknownJobId_ReturnsNotFound()
        {
            var response = await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, string>(
                new CancelJobRequest { JobId = Guid.NewGuid().ToString("N") });

            response.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task GetActive_IdleDevice_ReturnsOkWithNullJob()
        {
            var device = f.DeviceManager.Devices[0];

            var response = await f.Client.GetAsync<GetActiveJobEndpoint, GetActiveJobRequest, GetActiveJobResponse>(
                new GetActiveJobRequest { DeviceId = device.DeviceId });

            response.Should().BeSuccessful<GetActiveJobResponse>().WithStatusCode(HttpStatusCode.OK);
            response.Content.Job.Should().BeNull();
        }

        [Fact]
        public async Task GetActive_DeviceWithActiveJob_ReturnsThatJob()
        {
            var device = f.DeviceManager.Devices[0];

            var createResponse = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(
                NewCreateRequest(device.DeviceId, "/music/active-check"));
            var jobId = createResponse.Content.JobId;

            try
            {
                var response = await f.Client.GetAsync<GetActiveJobEndpoint, GetActiveJobRequest, GetActiveJobResponse>(
                    new GetActiveJobRequest { DeviceId = device.DeviceId });

                response.Should().BeSuccessful<GetActiveJobResponse>().WithStatusCode(HttpStatusCode.OK);
                response.Content.Job.Should().NotBeNull();
                response.Content.Job!.JobId.Should().Be(jobId);
            }
            finally
            {
                await f.Client.PostAsync<CancelJobEndpoint, CancelJobRequest, CancelJobResponse>(new CancelJobRequest { JobId = jobId });
            }
        }

        [Fact]
        public async Task Create_UnknownDeviceId_ReturnsNotFound()
        {
            var deviceId = Guid.NewGuid().ToString().GenerateFilenameSafeHash();

            var response = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, string>(
                NewCreateRequest(deviceId));

            response.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
            response.Content.Should().Contain(deviceId);
        }

        [Fact]
        public async Task Create_InvalidDestinationDirectory_ReturnsBadRequestNotServerError()
        {
            var device = f.DeviceManager.Devices[0];

            var response = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, ProblemDetails>(
                NewCreateRequest(device.DeviceId, "C:\\Windows\\System32"));

            response.Should().BeProblem().WithStatusCode(HttpStatusCode.BadRequest);
        }
    }
}
