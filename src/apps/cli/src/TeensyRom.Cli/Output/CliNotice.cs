namespace TeensyRom.Cli.Output;

/// <summary>
/// A warning that doesn't change a command's result or exit code: one sentence for people and the same facts for scripts.
/// </summary>
/// <param name="Code">A stable name for the kind of notice, for example <c>indexIncomplete</c>.</param>
/// <param name="Message">The sentence shown on stderr.</param>
/// <param name="Device">The name of the device the notice is about.</param>
/// <param name="DeviceId">The id of that device.</param>
/// <param name="Storage">The storage the notice is about, <c>sd</c> or <c>usb</c>.</param>
/// <param name="Fix">The exact <c>trom</c> command that resolves it.</param>
internal sealed record CliNotice(string Code, string Message, string Device, string DeviceId, string Storage, string Fix);
