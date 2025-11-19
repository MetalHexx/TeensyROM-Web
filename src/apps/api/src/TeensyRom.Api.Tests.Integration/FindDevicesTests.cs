using TeensyRom.Api.Endpoints.ClosePort;
using TeensyRom.Api.Endpoints.FindCarts;
using TeensyRom.Api.Endpoints.ConnectDevice;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class FindDevicesTests(EndpointFixture f) :IDisposable
    {        


        [Fact]
        public async Task Given_DevicesAvailable_WhenCalled_DevicesReturned()
        {
            // Arrange
            var r = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesResponse>();

            // Assert
            r.Should().BeSuccessful<FindDevicesResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            r.Content.Devices.Count.Should().BeGreaterThan(0);
        }

        public void Dispose() => f.Reset();
    }
}
