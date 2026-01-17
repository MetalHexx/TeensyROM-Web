using FluentAssertions;
using NSubstitute;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;
using Xunit;

namespace TeensyRom.Core.Serial.Tests.Unit
{
  public class CommunicationPortExtensionTests
  {
    private readonly ILoggingService _mockLog = Substitute.For<ILoggingService>();

    [Fact]
    public void SimpleObservableSerialPort_GetEndpoint_ReturnsPortName()
    {
      // Arrange
      var port = new SerialCommunicationPort(_mockLog);
      
      // Act - SerialPort may have a default port name
      var endpoint = port.GetEndpoint();

      // Assert - Should return a string (could be default port name or empty)
      endpoint.Should().NotBeNull();
    }

    [Fact]
    public void SimpleObservableSerialPort_GetConnectionType_ReturnsSerial()
    {
      // Arrange
      var port = new SerialCommunicationPort(_mockLog);

      // Act
      var connectionType = port.GetConnectionType();

      // Assert
      connectionType.Should().Be(ConnectionType.Serial);
    }

    [Fact]
    public void TcpObservablePort_GetEndpoint_ReturnsEndpoint()
    {
      // Arrange
      var port = new TcpCommunicationPort(_mockLog);

      // Act - endpoint not set yet
      var endpointEmpty = port.GetEndpoint();

      // Assert
      endpointEmpty.Should().Be(string.Empty);
    }

    [Fact]
    public void TcpObservablePort_GetEndpoint_ReturnsEndpointAfterSetPort()
    {
      // Arrange
      var port = new TcpCommunicationPort(_mockLog);
      var expectedEndpoint = "192.168.1.42:80";

      // Act
      port.SetPort(expectedEndpoint);
      var endpoint = port.GetEndpoint();

      // Assert
      endpoint.Should().Be(expectedEndpoint);
    }

    [Fact]
    public void TcpObservablePort_GetConnectionType_ReturnsTcp()
    {
      // Arrange
      var port = new TcpCommunicationPort(_mockLog);

      // Act
      var connectionType = port.GetConnectionType();

      // Assert
      connectionType.Should().Be(ConnectionType.Tcp);
    }
  }
}
