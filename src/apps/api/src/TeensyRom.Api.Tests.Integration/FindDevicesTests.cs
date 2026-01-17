using TeensyRom.Api.Endpoints.FindCarts;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class FindDevicesTests(EndpointFixture f)
    {        


        [Fact]
        public async Task Given_DevicesAvailable_WhenCalled_DevicesReturned()
        {
            // Arrange
            var r = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
            {
              FullScan = false
            });

            // Assert
            r.Should().BeSuccessful<FindDevicesResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            r.Content.Devices.Count.Should().BeGreaterThan(0);
            r.Content.Devices.Should().ContainSingle();
        }
    }
}
