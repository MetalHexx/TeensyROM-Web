using System.Collections.Concurrent;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Endpoints.Transfers.ListJobs;
using TeensyRom.Api.Endpoints.Transfers.SealJob;
using TeensyRom.Api.Models;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// The list endpoint and the all-transfers hub subscription are how a client that did not start a
    /// job still sees it.
    /// </summary>
    [Collection("Transfer")]
    public class TransferListAndHubTests(TransferFixture f) : IAsyncLifetime
    {
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

        private readonly List<HubConnection> _connections = [];

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            foreach (var connection in _connections)
            {
                await connection.DisposeAsync();
            }

            await f.WaitForQuiescenceAsync();
        }

        private async Task<CreateJobResponse> CreateJobAsync(int deviceIndex = 0)
        {
            var response = await f.Client.PostAsync<CreateJobEndpoint, CreateJobRequest, CreateJobResponse>(new CreateJobRequest
            {
                DeviceId = f.DeviceManager.Devices[deviceIndex].DeviceId,
                StorageType = TeensyStorageType.SD,
                Body = new CreateJobBody { DestinationDirectory = "/music/incoming" }
            });

            response.Should().BeSuccessful<CreateJobResponse>();
            return response.Content;
        }

        private Task SealAsync(string jobId) =>
            f.Client.PostAsync<SealJobEndpoint, SealJobRequest, SealJobResponse>(new SealJobRequest { JobId = jobId });

        [Fact]
        public async Task ListJobs_AfterCreate_IncludesTheJobWithUploadOrigin()
        {
            var created = await CreateJobAsync();

            try
            {
                var response = await f.Client.GetAsync<ListJobsEndpoint, ListJobsResponse>();

                response.Should().BeSuccessful<ListJobsResponse>().WithStatusCode(HttpStatusCode.OK);
                var listed = response.Content.Jobs.Single(j => j.JobId == created.JobId);
                listed.Origin.Kind.Should().Be(TransferOriginKind.Upload);
                listed.Origin.WatchFolderId.Should().BeNull();
            }
            finally
            {
                await SealAsync(created.JobId);
            }
        }

        [Fact]
        public async Task SubscribeAll_ReturnsCurrentJobsAndReceivesSnapshotsOfJobsItNeverSubscribedTo()
        {
            var existing = await CreateJobAsync();
            var (connection, snapshots) = await ConnectAsync();

            var current = await connection.InvokeAsync<List<TransferJobDto>>("SubscribeAll");
            current.Should().Contain(j => j.JobId == existing.JobId);

            var later = await CreateJobAsync(deviceIndex: 1);
            await SealAsync(existing.JobId);
            await SealAsync(later.JobId);

            await WaitUntilAsync(
                () => snapshots.Any(s => s.JobId == later.JobId && s.State == TransferJobState.Completed),
                "the all-transfers subscriber to see the later job complete");
            snapshots.Should().Contain(s => s.JobId == existing.JobId);
        }

        private async Task<(HubConnection Connection, ConcurrentQueue<TransferJobDto> Snapshots)> ConnectAsync()
        {
            var connection = new HubConnectionBuilder()
                .WithUrl("http://localhost/api/transferHub", options =>
                {
                    options.HttpMessageHandlerFactory = _ => f.Server.CreateHandler();
                    options.Transports = HttpTransportType.LongPolling;
                })
                .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
                .Build();

            var snapshots = new ConcurrentQueue<TransferJobDto>();
            connection.On<TransferJobDto>("JobSnapshot", snapshots.Enqueue);
            _connections.Add(connection);

            await connection.StartAsync();
            return (connection, snapshots);
        }

        private static async Task WaitUntilAsync(Func<bool> condition, string waitingFor)
        {
            var deadline = DateTime.UtcNow + Timeout;
            while (!condition())
            {
                if (DateTime.UtcNow > deadline) throw new TimeoutException($"Timed out waiting for {waitingFor}.");
                await Task.Delay(50);
            }
        }
    }
}
