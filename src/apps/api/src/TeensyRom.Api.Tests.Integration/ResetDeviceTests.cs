using TeensyRom.Api.Endpoints.ResetDevice;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class ResetDeviceTests(EndpointFixture f)
    {
        [Fact]
        public async Task When_Resetting_ValidDevice_ResponseSuccessful()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();

            // Act - TrClient automatically handles enum serialization
            var resetRequest = new ResetDeviceRequest { DeviceId = deviceId };
            var r = await f.Client.PutAsync<ResetDeviceEndpoint, ResetDeviceRequest, ResetDeviceResponse>(resetRequest);

            // Assert
            r.Should().BeSuccessful<ResetDeviceResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();
        }

        [Fact]
        public async Task When_Resetting_WithInvalidDeviceId_ReturnsBadRequest()
        {
            // Act - TrClient automatically handles enum serialization
            // Use a properly formatted but non-existent device ID
            var resetRequest = new ResetDeviceRequest { DeviceId = Guid.NewGuid().ToString().GenerateFilenameSafeHash() };
            var r = await f.Client.PutAsync<ResetDeviceEndpoint, ResetDeviceRequest, string>(resetRequest);

            // Assert
            r.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
            r.Content.Should().Be($"The device {resetRequest.DeviceId} was not found.");
        }
    }
}
