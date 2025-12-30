using System.Text;
using TeensyRom.Core.Device;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Generates Markdown reports for TeensyROM device discovery.
/// </summary>
public class TeensyRomDiscoveryReport
{
    private readonly StringBuilder _report = new();
    private readonly string _reportPath;

    public TeensyRomDiscoveryReport(string reportName = "discovery-report.md")
    {
        // Output to the source directory (where test files are) for easy IDE access
        var assemblyLocation = typeof(TeensyRomDiscoveryReport).Assembly.Location;

        // Navigate from bin/Debug/net9.0/ to the source directory
        var reportsDir = Path.GetFullPath(Path.Combine(assemblyLocation, "..", "..", "..", "..", "test-reports"));

        // Create the directory if it doesn't exist
        if (!Directory.Exists(reportsDir))
        {
            Directory.CreateDirectory(reportsDir);
        }

        _reportPath = Path.Combine(reportsDir, reportName);
    }

    public void WriteHeader(string title)
    {
        _report.AppendLine($"# {title}");
        _report.AppendLine();
        _report.AppendLine($"**Generated**: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        _report.AppendLine();
    }

    public void WriteSection(string sectionTitle)
    {
        _report.AppendLine($"## {sectionTitle}");
        _report.AppendLine();
    }

    public void WriteSubsection(string subsectionTitle)
    {
        _report.AppendLine($"### {subsectionTitle}");
        _report.AppendLine();
    }

    public void WriteLine(string text)
    {
        _report.AppendLine(text);
    }

    public void WriteBlankLine()
    {
        _report.AppendLine();
    }

    public void WriteBold(string text)
    {
        _report.AppendLine($"**{text}**");
    }

    public void WriteKeyValue(string key, string value)
    {
        _report.AppendLine($"- **{key}**: {value}");
    }

    public void WriteCodeBlock(string code, string language = "")
    {
        _report.AppendLine($"```{language}");
        _report.AppendLine(code);
        _report.AppendLine("```");
        _report.AppendLine();
    }

    public void WriteList(IEnumerable<string> items)
    {
        foreach (var item in items)
        {
            _report.AppendLine($"- {item}");
        }
        _report.AppendLine();
    }

    public void WriteDeviceTable(IEnumerable<TcpDiscoveredDevice> devices)
    {
        _report.AppendLine("| # | IP Address | Port | Endpoint | Response | Discovered |");
        _report.AppendLine("|---|------------|------|----------|----------|-----------|");

        int index = 1;
        foreach (var device in devices)
        {
            var response = device.Response?.Replace("|", "\\|") ?? "(no response)";
            var shortResponse = response.Length > 50 ? response.Substring(0, 47) + "..." : response;
            _report.AppendLine($"| {index++} | {device.IpAddress} | {device.Port} | {device.Endpoint} | {shortResponse} | {device.DiscoveredAt:yyyy-MM-dd HH:mm:ss} |");
        }

        _report.AppendLine();
    }

    public void WriteEndpointTable(IEnumerable<DiscoveredEndpoint> endpoints)
    {
        _report.AppendLine("| # | Connection Type | Address | Port | Display |");
        _report.AppendLine("|---|-----------------|---------|------|---------|");

        int index = 1;
        foreach (var endpoint in endpoints)
        {
            _report.AppendLine($"| {index++} | {endpoint.ConnectionType} | {endpoint.Address} | {endpoint.Port?.ToString() ?? "(N/A)"} | {endpoint.Display} |");
        }

        _report.AppendLine();
    }

    public void WriteSuccess(string message)
    {
        _report.AppendLine($"✅ {message}");
        _report.AppendLine();
    }

    public void WriteWarning(string message)
    {
        _report.AppendLine($"⚠️ {message}");
        _report.AppendLine();
    }

    public void WriteError(string message)
    {
        _report.AppendLine($"❌ {message}");
        _report.AppendLine();
    }

    public void WriteInfo(string message)
    {
        _report.AppendLine($"ℹ️ {message}");
        _report.AppendLine();
    }

    public void WriteHorizontalRule()
    {
        _report.AppendLine("---");
        _report.AppendLine();
    }

    public void Save()
    {
        File.WriteAllText(_reportPath, _report.ToString());
    }

    public string GetReportPath() => _reportPath;

    public string GetReportContent() => _report.ToString();
}
