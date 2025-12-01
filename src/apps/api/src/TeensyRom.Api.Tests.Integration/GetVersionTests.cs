using System.Net;
using System.Text.RegularExpressions;
using FluentAssertions;
using TeensyRom.Api.Endpoints.Version.GetVersion;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class GetVersionTests(EndpointFixture f) : IDisposable
    {
        [Fact]
        public async Task GetVersion_ReturnsVersionString()
        {
            // Act
            var r = await f.Client.GetAsync<GetVersionEndpoint, GetVersionResponse>();

            // Assert
            r.Should().BeSuccessful<GetVersionResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            r.Content.Should().NotBeNull();
            r.Content.Version.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task GetVersion_ReturnsValidSemanticVersion()
        {
            // Act
            var r = await f.Client.GetAsync<GetVersionEndpoint, GetVersionResponse>();

            // Assert
            r.Should().BeSuccessful<GetVersionResponse>();

            var version = r.Content.Version;
            
            // Semantic versioning pattern: Major.Minor.Patch[-prerelease][+build]
            // Examples: 1.0.0, 1.0.0-alpha.1, 1.2.3-beta.2+build.123
            var semverPattern = @"^\d+\.\d+\.\d+(-[\w\.]+(\.[\w\.]+)*)?(\+[\w\.]+)?$";
            
            version.Should().MatchRegex(semverPattern, 
                "version should follow semantic versioning format");
        }

        [Fact]
        public async Task GetVersion_MatchesExpectedVersion()
        {
            // Act
            var r = await f.Client.GetAsync<GetVersionEndpoint, GetVersionResponse>();

            // Assert
            r.Should().BeSuccessful<GetVersionResponse>();

            var version = r.Content.Version;
            
            // The version should match what's in the .csproj file exactly
            version.Should().Be("1.0.0-alpha.1", 
                "version should match the value specified in TeensyRom.Api.csproj");
        }

        public void Dispose()
        {
            // Cleanup if needed
        }
    }
}
