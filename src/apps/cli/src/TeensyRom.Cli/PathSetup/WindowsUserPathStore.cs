using Microsoft.Win32;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace TeensyRom.Cli.PathSetup;

/// <summary>
/// <c>HKCU\Environment</c> value <c>Path</c>. Never <c>Environment.SetEnvironmentVariable(..., User)</c>: that writes
/// the value expanded and as <c>REG_SZ</c>, breaking every other entry that uses a <c>%VAR%</c>.
/// </summary>
[SupportedOSPlatform("windows")]
internal sealed class WindowsUserPathStore : IUserPathStore
{
    private const string EnvironmentKey = "Environment";
    private const string PathValue = "Path";
    private static readonly IntPtr HwndBroadcast = (IntPtr)0xffff;
    private const uint WmSettingChange = 0x001A;
    private const uint SmtoAbortIfHung = 0x0002;

    public string? Read()
    {
        if (!OperatingSystem.IsWindows()) return null;

        using var key = Registry.CurrentUser.OpenSubKey(EnvironmentKey, writable: false);

        return key?.GetValue(PathValue, null, RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
    }

    public void Write(string value)
    {
        if (!OperatingSystem.IsWindows()) return;

        using (var key = Registry.CurrentUser.CreateSubKey(EnvironmentKey, writable: true))
        {
            key.SetValue(PathValue, value, RegistryValueKind.ExpandString);
        }
        SendMessageTimeout(HwndBroadcast, WmSettingChange, UIntPtr.Zero, EnvironmentKey, SmtoAbortIfHung, 5000, out _);
    }

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}
