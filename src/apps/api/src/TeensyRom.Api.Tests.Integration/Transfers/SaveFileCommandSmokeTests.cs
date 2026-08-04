using FluentAssertions;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Tests.Integration.Common;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Proves the fake device satisfies CommunicationPortBehavior's pre-handler firmware/busy checks and
    /// the SaveFile handshake - with no hardware attached and no discovery performed. Everything from
    /// P02 onward is built on this assumption holding.
    /// </summary>
    [Collection("Transfer")]
    public class SaveFileCommandSmokeTests(TransferFixture f) : IDisposable
    {
        private readonly string _sourceFile = CreateSourceFile();

        [Fact]
        public async Task Handle_SaveFileCommand_AgainstFakeDevice_DeliversFileWithNoHardware()
        {
            var device = f.DeviceManager.Devices.First();
            var targetPath = new FilePath("/smoke-test.prg");
            var transfer = StreamedFileTransfer.FromFile(_sourceFile, targetPath, TeensyStorageType.SD);

            using var scope = f.Services.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

            var result = await mediator.Send(new SaveFileCommand
            {
                File = transfer,
                DeviceId = device.DeviceId,
                CommunicationPort = device.CommunicationPort
            });

            result.IsSuccess.Should().BeTrue();
            result.Saved.Should().BeTrue();

            var port = f.DeviceManager.PortFor(device.DeviceId);
            port.Received.Should().ContainSingle(file =>
                file.Path == targetPath.Value &&
                file.DeclaredLength == transfer.StreamLength &&
                file.DeclaredChecksum == transfer.Checksum);
        }

        private static string CreateSourceFile()
        {
            var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.prg");
            File.WriteAllBytes(path, [1, 2, 3, 4, 5, 6, 7, 8]);
            return path;
        }

        public void Dispose()
        {
            if (File.Exists(_sourceFile))
            {
                File.Delete(_sourceFile);
            }
        }
    }
}
