namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Binds <see cref="ConnectionTransitionsTests"/> and <see cref="DiscoveryOccasionsTests"/> to one shared
/// <see cref="HardwareFixture"/> instance. Without this, xUnit's default per-class implicit collection
/// gives each test class its own fixture, and - since different collections run in parallel by default -
/// two independent connections race to open the same physical COM port or TCP socket at once, corrupting
/// the wire and producing exactly the ack-timeout/disconnect failures this collection exists to prevent.
/// Membership in the same collection also serializes both classes' tests, which removes any need to
/// guess at xUnit's undocumented in-class fact ordering.
/// </summary>
[CollectionDefinition(Name)]
public sealed class HardwareCollection : ICollectionFixture<HardwareFixture>
{
    public const string Name = "Hardware";
}
