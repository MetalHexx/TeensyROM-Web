using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TeensyRom.Api.Startup;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands.Behaviors;

namespace TeensyRom.Api.Tests.Unit.Startup;

public class MediatorStartupExtensionsTests
{
    [Fact]
    public void AddTeensyRomMediatR_RegistersTheBehaviorsInPipelineOrder()
    {
        var services = new ServiceCollection();

        services.AddTeensyRomMediatR();

        services
            .Where(d => d.ServiceType == typeof(IPipelineBehavior<,>))
            .Select(d => d.ImplementationType)
            .Should().Equal(
                typeof(LoggingBehavior<,>),
                typeof(ExceptionBehavior<,>),
                typeof(TransferLockoutBehavior<,>),
                typeof(CommunicationPortBehavior<,>));
    }

    [Fact]
    public void AddTeensyRomServices_ResolvesTheLeaseCoordinatorAndTheTransferLeaseToOneInstance()
    {
        var registered = new ServiceCollection().AddTeensyRomServices(registerHostedServices: false);
        var leaseTypes = new[] { typeof(DeviceLeaseCoordinator), typeof(IDeviceLeaseCoordinator), typeof(IDeviceTransferLease) };
        var leaseOnly = new ServiceCollection();

        foreach (var descriptor in registered.Where(d => leaseTypes.Contains(d.ServiceType)))
        {
            leaseOnly.Add(descriptor);
        }

        using var provider = leaseOnly.BuildServiceProvider();
        var coordinator = provider.GetRequiredService<IDeviceLeaseCoordinator>();

        provider.GetRequiredService<IDeviceTransferLease>().Should().BeSameAs(coordinator);
        coordinator.TryAcquire("device-1", "job-1");
        provider.GetRequiredService<IDeviceTransferLease>().GetActiveJobId("device-1").Should().Be("job-1");
    }
}
