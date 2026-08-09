using TeensyRom.Core.Serial;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Commands;
using TeensyRom.Core.ValueObjects;
using System.Net.Sockets;
using System.Diagnostics;

namespace TeensyRom.TcpDebugger;

class Program
{
	static async Task Main(string[] args)
	{
    var apiBaseUrl = args.Length > 0 ? args[0] : "http://localhost:213";
    var deviceId = args.Length > 1 ? args[1] : "YRTCPIRY";
    await TransferApiBlackBoxHarness.RunAsync(apiBaseUrl, deviceId, fileCount: 5);
    Console.WriteLine();
    Console.WriteLine("Press any key to exit...");
    Console.ReadKey();
    return;

    Console.WriteLine("=== TeensyROM TCP Debugger ===");
		Console.WriteLine();

		string endpoint = args.Length > 0 ? args[0] : "192.168.1.37:2112";
		Console.WriteLine($"Connecting to: {endpoint}");
		Console.WriteLine();

		TcpCommunicationPort? tcpPort = new TcpCommunicationPort(new SimpleLoggingService());

		try
		{
			tcpPort.SetPort(endpoint);
			Console.WriteLine();

			LogHeader("Opening TCP connection...");


			while (true)
			{
				tcpPort.OpenPort();
				LogSuccess($"Connection opened to {endpoint}");
				Console.WriteLine();

				//ExecutePingCommand(tcpPort, "Ping #1 (Version Check)");
				//ExecutePingCommand(tcpPort, "Ping #2");
				// ExecutePingCommand(tcpPort, "Ping #3 (CartTagger)");

				//ExecuteGetFileCommand(tcpPort, "/cart-tag.txt");
				//ExecuteGetFileCommand(tcpPort, "/music/MUSICIANS/C/Corpsicle/playlist.json");
				//ExecuteGetFileCommand(tcpPort, "/music/MUSICIANS/G/Gangstar/playlist.json");
				//ExecuteGetFileCommand(tcpPort, "/music/MUSICIANS/R/Remarque/Worktunes/playlist.json");
				//ExecuteGetFileCommand(tcpPort, "/music/MUSICIANS/S/SFR/Worktunes/playlist.json");
				//ExecuteGetFileCommand(tcpPort, "/playlists/Beat Juggling/playlist.json");
				//ExecuteGetFileCommand(tcpPort, "/playlists/Breakbeats/playlist.json");
				//ExecuteLaunchSidCommand(tcpPort, "/music/MUSICIANS/E/Eclipse/True.sid");


				//ExecutePingCommand(tcpPort, "Ping after first SID - CONNECTION TEST");
				//try
				//{
				//  
				//}
				//catch (Exception ex)
				//{
				//  tcpPort.ClosePort();
				//  tcpPort.OpenPort();
				//}


				var isMinimal = ExecuteMinimalCheckCommand(tcpPort);
				Thread.Sleep(200);


				if (isMinimal)
				{
					ExecuteResetCommand(tcpPort);
					Thread.Sleep(200);
					TryReconnect(tcpPort);
				}
				//ExecuteLaunchCommand(tcpPort, "/Games/180.crt");


				//Thread.Sleep(2000);
				//ExecuteLaunchCommand(tcpPort, "/music/MUSICIANS/M/Manganoid/Le_Shagma.sid");
				//Thread.Sleep(2000);
				//ExecuteLaunchCommand(tcpPort, "/Games/180.crt");
				//Thread.Sleep(2000);
				//ExecutePingCommand(tcpPort, "Ping 2");
				//Thread.Sleep(200);
				//ExecuteLaunchCommand(tcpPort, "/music/MUSICIANS/L/LukHash/Alpha.sid");
				//Thread.Sleep(2000);
				//ExecutePingCommand(tcpPort, "Ping 3");

				//ExecuteLaunchCommand(tcpPort, "/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt");
				//Thread.Sleep(10000);

				//ExecuteLaunchSidCommand(tcpPort, "/Games/180.crt");
				//Thread.Sleep(2000);
				//ExecuteLaunchCommand(tcpPort, "/music/MUSICIANS/L/LukHash/Alpha.sid");
				//Thread.Sleep(2000);
				//ExecuteLaunchCommand(tcpPort, "/music/MUSICIANS/M/Manganoid/Le_Shagma.sid");
				//Thread.Sleep(2000);

				//ExecuteLaunchSidCommand(tcpPort, "/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt");
				//Thread.Sleep(2000);

				//ExecuteGetDirectoryRecursiveCommand(tcpPort, "/", recursive: false);

				//var runSuffix = Guid.NewGuid().ToString("N")[..5];
				//await ExecuteSaveFileCommand(tcpPort, $"/ft-smoke-test/tcpdebug-test-{runSuffix}.txt");

				await TransferPumpHarness.RunAsync(tcpPort, fileCount: 5);

				tcpPort.ClosePort();

				//LogSuccess("=== All steps completed successfully ===");
				//Console.WriteLine();
				//Console.WriteLine("Press any key to run again or Ctrl+C to exit...");
				//Console.ReadKey();
				//Console.WriteLine();

				break;
			}
		}
		catch (Exception ex)
		{
			Console.WriteLine();
			LogError($"ERROR: {ex.GetType().Name} - {ex.Message}");
			Console.WriteLine();
			Console.WriteLine("Stack Trace:");
			Console.WriteLine(ex.StackTrace);
			if (ex.InnerException != null)
			{
				Console.WriteLine();
				Console.WriteLine("Inner Exception:");
				Console.WriteLine($"{ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
				Console.WriteLine(ex.InnerException.StackTrace);
			}
		}
		finally
		{
			Console.WriteLine();
			Log("Cleaning up...");
			tcpPort.ClearBuffers();
			tcpPort.ClosePort();
			tcpPort?.Dispose();
			Console.WriteLine();
			Console.WriteLine("Press any key to exit...");
			Console.ReadKey();
		}
	}

  /// <summary>
	/// Isolation harness for the FILE-TRANSFER-4 ack-timeout bug: drives the real
	/// SaveFileCommandHandler (same code SavePump uses) directly against this TCP port, with none of
	/// TransferPump's queue/reset/staging machinery around it - just the SendFile wire exchange for a
	/// single file, with wall-clock timing around it.
	/// </summary>
	static async Task ExecuteSaveFileCommand(TcpCommunicationPort tcpPort, string targetPath)
  {
    LogHeader($"SaveFile Command (isolated) -> {targetPath}");

    var sourcePath = Path.Combine(Path.GetTempPath(), "tcpdebug-test.txt");
    File.WriteAllText(sourcePath, $"TeensyROM SendFile isolation test - {DateTime.Now:O}{Environment.NewLine}");

    var transfer = StreamedFileTransfer.FromFile(sourcePath, new FilePath(targetPath), TeensyStorageType.SD);
    LogDetail($"Source: {sourcePath}");
    LogDetail($"StreamLength: {transfer.StreamLength}, Checksum: {transfer.Checksum}");

    var handler = new SaveFileCommandHandler(new SimpleLoggingService());
    var sw = Stopwatch.StartNew();

    var result = await handler.Handle(new SaveFileCommand
    {
      File = transfer,
      DeviceId = "TCP-DEBUG",
      CommunicationPort = tcpPort
    }, CancellationToken.None);

    sw.Stop();

    if (result.IsSuccess)
    {
      LogSuccess($"SaveFile succeeded in {sw.ElapsedMilliseconds}ms (Saved={result.Saved})");
    }
    else
    {
      LogError($"SaveFile FAILED in {sw.ElapsedMilliseconds}ms: {result.Error}");
    }
    Console.WriteLine();
  }

  private static void TryReconnect(TcpCommunicationPort tcpPort)
	{
		Stopwatch sw = Stopwatch.StartNew();
		tcpPort.ClosePort();
		while (!tcpPort.IsOpen)
		{
			try
			{
				tcpPort.OpenPort();
			}
			catch { }
		}
		Thread.Sleep(200);
		Console.WriteLine($"Time to reconnect: {sw.Elapsed.TotalMilliseconds}ms");
	}

	static void ExecuteResetCommand(TcpCommunicationPort tcpPort)
	{
		LogHeader("Reset Command");
		LogDetail("SendIntBytes(TeensyToken.Reset, 2)");
		tcpPort.SendIntBytes(TeensyToken.Reset, 2);
		var response = tcpPort.ReadAndLogSerialAsString();
		LogSuccess($"Response: '{response?.Trim()}'");
	}

	static void ExecutePingCommand(TcpCommunicationPort tcpPort, string description)
	{
		LogHeader(description);
		LogDetail("SendIntBytes(TeensyToken.Ping, 2)");
		tcpPort.SendIntBytes(TeensyToken.Ping, 2);
		var response = tcpPort.ReadAndLogSerialAsString();
		LogSuccess($"Response: '{response?.Trim()}'");
		Console.WriteLine();
	}

	static bool ExecuteMinimalCheckCommand(TcpCommunicationPort tcpPort)
	{
		LogHeader("FW Check Command");
		LogDetail("SendIntBytes(TeensyToken.FwCheckToken, 2)");
		tcpPort.SendIntBytes(TeensyToken.FwCheckToken, 2);

		tcpPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);
		byte[] recBuf = new byte[2];
		tcpPort.Read(recBuf, 0, 2);
		ushort result = BitConverter.ToUInt16(recBuf, 0);

		string firmware = result switch
		{
			var _ when result == TeensyToken.FWFullToken.Value => "Full FW",
			var _ when result == TeensyToken.FWMinimalToken.Value => "Minimal FW",
			_ => "Unknown"
		};
		LogSuccess($"Response: {result} ({firmware})");
		Console.WriteLine();
		return result == TeensyToken.FWMinimalToken.Value;
	}

	static void ExecuteGetFileCommand(TcpCommunicationPort tcpPort, string path)
	{
		LogHeader($"GetFile Command ({path})");

		LogDetail("ClearBuffers()");
		tcpPort.ClearBuffers();

		LogDetail("SendIntBytes(TeensyToken.GetFile, 2)");
		tcpPort.SendIntBytes(TeensyToken.GetFile, 2);

		LogDetail("HandleAck (after GetFile token)...");
		HandleAck(tcpPort);

		LogDetail("SendIntBytes(SD storage token, 1)");
		tcpPort.SendIntBytes(TeensyStorageType.SD.GetStorageToken(), 1);

		LogDetail("Write(path + null terminator)");
		tcpPort.Write(path + "\0");

		LogDetail("HandleAck (after path)...");
		try
		{
			HandleAck(tcpPort);
		}
		catch (TeensyException ex)
		{
			LogError($"File not found: {ex.Message}");
			LogSuccess("=== Test complete (file not found) ===");
			return;
		}

		LogDetail("ReadIntBytes(4) for file length");
		var fileLength = tcpPort.ReadIntBytes(4);
		LogSuccess($"File length: {fileLength} bytes");

		LogDetail("ReadIntBytes(4) for checksum");
		var checksum = tcpPort.ReadIntBytes(4);
		LogSuccess($"Checksum: {checksum}");

		LogDetail("Reading file bytes...");
		var buffer = new byte[fileLength];
		int bytesRead = 0;
		int iteration = 0;

		LogDetail($"Starting file read loop - File size: {fileLength} bytes");

		while (bytesRead < fileLength)
		{
			iteration++;
			int bytesToRead = (int)fileLength - bytesRead;
			LogDetail($"  Iteration {iteration}: Trying to read {bytesToRead} bytes (offset: {bytesRead})");

			int chunkSize = tcpPort.Read(buffer, bytesRead, bytesToRead);
			bytesRead += chunkSize;

			LogDetail($"  Iteration {iteration}: Actually read {chunkSize} bytes (total: {bytesRead}/{fileLength})");

			if (chunkSize == 0)
			{
				LogWarning($"Read 0 bytes! Connection might be lost.");
				Thread.Sleep(10);
			}
		}
		LogSuccess($"Read {bytesRead} bytes total in {iteration} iterations");

		LogDetail("HandleAck (final)...");
		HandleAck(tcpPort);

		LogDetail("Verifying checksum...");
		var receivedChecksum = buffer.CalculateChecksum();
		LogSuccess($"Received checksum: {receivedChecksum}");

		if (receivedChecksum != checksum)
		{
			LogError("Checksum Mismatch!");
		}
		else
		{
			LogSuccess("Checksum verified!");
		}

		var fileContent = System.Text.Encoding.UTF8.GetString(buffer);
		Console.WriteLine();
		LogSuccess("=== File Content (JSON) ===");
		Console.WriteLine(fileContent);
		Console.WriteLine("=== End File Content ===");
		Console.WriteLine();
	}

	static void ExecuteGetDirectoryRecursiveCommand(TcpCommunicationPort tcpPort, string path, bool recursive = false)
	{
		LogHeader($"GetDirectoryRecursive Command ({path}) - Recursive: {recursive}");

		var allFiles = new List<(string name, long size, string path)>();
		var allDirectories = new List<string>();
		var totalFiles = 0;
		var totalDirectories = 0;

		// Process starting directory (recursively if specified)
		GetDirectoryRecursive(tcpPort, path, allFiles, allDirectories, ref totalFiles, ref totalDirectories, recursive);

		LogSuccess($"=== Complete directory listing ===");
		LogSuccess($"Total directories indexed: {totalDirectories}");
		LogSuccess($"Total files found: {totalFiles}");
		Console.WriteLine();

		if (allDirectories.Count > 0)
		{
			LogHeader("All Directories:");
			foreach (var dir in allDirectories)
			{
				Console.WriteLine($"  [DIR] {dir}");
			}
			Console.WriteLine();
		}

		if (allFiles.Count > 0)
		{
			LogHeader("All Files:");
			foreach (var file in allFiles)
			{
				Console.WriteLine($"  [FILE] {file.path} ({file.size} bytes)");
			}
			Console.WriteLine();
		}
	}

	static void GetDirectoryRecursive(TcpCommunicationPort tcpPort, string path, List<(string name, long size, string path)> allFiles, List<string> allDirectories, ref int totalFiles, ref int totalDirectories, bool recursive)
	{
		LogHeader($"Indexing: {path}");

		LogDetail("ClearBuffers()");
		tcpPort.ClearBuffers();

		LogDetail("SendIntBytes(TeensyToken.ListDirectory, 2)");
		tcpPort.SendIntBytes(TeensyToken.ListDirectory, 2);

		LogDetail("HandleAck (after ListDirectory token)...");
		HandleAck(tcpPort);

		LogDetail("SendIntBytes(SD storage token, 1)");
		tcpPort.SendIntBytes(TeensyStorageType.SD.GetStorageToken(), 1);

		LogDetail("SendIntBytes(skip: 0, 2)");
		tcpPort.SendIntBytes(0, 2);

		LogDetail("SendIntBytes(take: 9999, 2)");
		tcpPort.SendIntBytes(9999, 2);

		LogDetail($"Write(path: {path}\\0)");
		tcpPort.Write(path + "\0");

		LogDetail("HandleAck (after path)...");
		HandleAck(tcpPort);

		LogDetail("WaitForDirectoryStartToken...");
		var startToken = WaitForDirectoryStartToken(tcpPort);

		if (startToken != TeensyToken.StartDirectoryList)
		{
			var rawResponse = tcpPort.ReadAndLogSerialAsString(100);
			LogError($"Did not receive StartDirectoryList token: {rawResponse}");
			return;
		}

		LogDetail("Reading directory content...");
		var (files, directories) = ReadDirectoryContent(tcpPort, path);

		totalDirectories += directories.Count;
		totalFiles += files.Count;

		LogSuccess($"Found {directories.Count} directories, {files.Count} files in {path}");

		// Add all files to the global list
		foreach (var file in files)
		{
			var fullPath = path == "/"
				? $"/{file.name}"
				: $"{path.TrimEnd('/')}/{file.name}";
			allFiles.Add((file.name, file.size, fullPath));
		}

		// Add all directories to the global list
		foreach (var dir in directories)
		{
			var fullPath = path == "/"
				? $"/{dir}"
				: $"{path.TrimEnd('/')}/{dir}";
			allDirectories.Add(fullPath);
		}

		// Recursively process each subdirectory if recursive flag is set
		if (recursive)
		{
			foreach (var dir in directories)
			{
				var subDirPath = path == "/"
					? $"/{dir}"
					: $"{path.TrimEnd('/')}/{dir}";

				Thread.Sleep(10); // Small delay between directory requests
				GetDirectoryRecursive(tcpPort, subDirPath, allFiles, allDirectories, ref totalFiles, ref totalDirectories, recursive);
			}
		}
	}

	static (List<(string name, long size)> files, List<string> directories) ReadDirectoryContent(TcpCommunicationPort tcpPort, string basePath)
	{
		var files = new List<(string name, long size)>();
		var directories = new List<string>();
		var receivedBytes = new List<byte>(1024);
		var stopwatch = System.Diagnostics.Stopwatch.StartNew();
		var timeout = TimeSpan.FromSeconds(30);

		LogDetail("Reading directory data...");

		while (true)
		{
			if (stopwatch.Elapsed > timeout)
			{
				LogError("Timeout reading directory data");
				break;
			}

			if (tcpPort.BytesToRead > 0)
			{
				var buffer = tcpPort.ReadSerialBytes();
				if (buffer.Length > 0)
				{
					receivedBytes.AddRange(buffer);

					ushort lastToken = CheckForEndToken(receivedBytes);
					if (lastToken == TeensyToken.EndDirectoryList.Value || lastToken == TeensyToken.Fail.Value)
					{
						LogDetail($"End token received: 0x{lastToken:X4}");
						break;
					}
				}
			}
			else
			{
				Thread.Sleep(5);
			}
		}

		// Parse JSON lines
		var data = receivedBytes.ToArray().ToUtf8(trimEndBytes: 2);
		var lines = data.Split(["\r\n", "\r", "\n"], StringSplitOptions.RemoveEmptyEntries);

		LogDetail($"Parsing {lines.Length} JSON lines...");

		foreach (var line in lines)
		{
			if (string.IsNullOrWhiteSpace(line)) continue;

			try
			{
				using var doc = System.Text.Json.JsonDocument.Parse(line);
				var root = doc.RootElement;

				if (!root.TryGetProperty("type", out var typeProperty))
					continue;

				var itemType = typeProperty.GetString();

				if (!root.TryGetProperty("name", out var nameProperty))
					continue;

				var name = nameProperty.GetString();
				if (string.IsNullOrEmpty(name))
					continue;

				if (itemType == "dir")
				{
					directories.Add(name);
					LogDetail($"  [DIR] {name}");
				}
				else if (itemType == "file")
				{
					var size = root.TryGetProperty("size", out var sizeProperty)
						? sizeProperty.GetInt64()
						: 0L;
					files.Add((name, size));
					LogDetail($"  [FILE] {name} ({size} bytes)");
				}
			}
			catch (System.Text.Json.JsonException ex)
			{
				LogWarning($"Failed to parse JSON line: {ex.Message}");
			}
		}

		return (files, directories);
	}

	static ushort CheckForEndToken(List<byte> receivedBytes)
	{
		if (receivedBytes.Count >= 2)
		{
			return (ushort)(receivedBytes[^2] << 8 | receivedBytes[^1]);
		}
		return 0;
	}

	static TeensyToken WaitForDirectoryStartToken(TcpCommunicationPort tcpPort)
	{
		tcpPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);

		byte[] recBuf = new byte[2];
		tcpPort.Read(recBuf, 0, 2);
		ushort recU16 = BitConverter.ToUInt16(recBuf, 0);

		LogDetail($"← Raw bytes: [{recBuf[0]} (0x{recBuf[0]:X2}), {recBuf[1]} (0x{recBuf[1]:X2})]");
		LogDetail($"← Parsed UInt16: {recU16} (0x{recU16:X4})");

		return recU16 switch
		{
			var _ when recU16 == TeensyToken.StartDirectoryList.Value => TeensyToken.StartDirectoryList,
			var _ when recU16 == TeensyToken.Fail.Value => TeensyToken.Fail,
			_ => TeensyToken.Unnknown,
		};
	}

	static void ExecuteLaunchCommand(TcpCommunicationPort tcpPort, string sidPath)
	{
		LogHeader($"Launch SID: {Path.GetFileName(sidPath)}");

		LogDetail("ClearBuffers()");
		tcpPort.ClearBuffers();

		// Send LaunchFile token
		LogDetail("SendIntBytes(TeensyToken.LaunchFile, 2)");
		tcpPort.SendIntBytes(TeensyToken.LaunchFile, 2);

		LogDetail("HandleAck (after LaunchFile token)...");
		var ack1 = HandleAckWithResult(tcpPort);

		if (ack1 != TeensyToken.Ack && ack1 != TeensyToken.RetryLaunch)
		{
			LogError($"Unexpected ACK after LaunchFile token: {ack1}");
			return;
		}

		// Send storage type
		LogDetail("SendIntBytes(SD storage token, 1)");
		tcpPort.SendIntBytes(TeensyStorageType.SD.GetStorageToken(), 1);

		// Send path with null terminator
		LogDetail($"Write(path: {sidPath}\\0)");
		tcpPort.Write(sidPath + "\0");

		LogDetail("HandleAck (after path)...");
		var ack2 = HandleAckWithResult(tcpPort);

		if (ack2 != TeensyToken.Ack && ack2 != TeensyToken.RetryLaunch)
		{
			LogError($"Unexpected ACK after path: {ack2}");
			return;
		}

		// Poll for SID response tokens
		LogDetail("Polling for SID response tokens...");
		var result = PollForSidTokens(tcpPort);

		if (result == SidLaunchResult.GoodSid)
		{
			LogSuccess($"✓ Good SID token received - {sidPath} launched successfully");
		}
		else if (result == SidLaunchResult.BadSid)
		{
			LogError($"✗ Bad SID token received - {sidPath} is incompatible");
		}
		else if (result == SidLaunchResult.ProgramError)
		{
			LogError($"✗ Program error - {sidPath} failed to launch");
		}
		else
		{
			LogSuccess($"✓ No explicit SID token, assuming success - {sidPath}");
		}
		Console.WriteLine();
	}

	static SidLaunchResult PollForSidTokens(TcpCommunicationPort tcpPort)
	{
		List<byte> allBytes = new();

		for (int i = 0; i < 40; i++)
		{
			var responseBytes = tcpPort.ReadSerialBytes(25);
			if (responseBytes.Length > 0)
			{
				allBytes.AddRange(responseBytes);

				var foundTokens = allBytes.ToArray().FindTRTokens();
				if (foundTokens.Contains(TeensyToken.GoodSIDToken))
				{
					LogDetail($"Found GoodSIDToken at iteration {i + 1}");
					return SidLaunchResult.GoodSid;
				}
				if (foundTokens.Contains(TeensyToken.BadSIDToken))
				{
					LogDetail($"Found BadSIDToken at iteration {i + 1}");
					return SidLaunchResult.BadSid;
				}
			}
			Thread.Sleep(25);
		}

		// Check the accumulated bytes for program errors
		var resultString = allBytes.ToArray().ToUtf8();
		if (resultString.Contains("Not enough room", StringComparison.OrdinalIgnoreCase) ||
			resultString.Contains("Unsupported HW Type", StringComparison.OrdinalIgnoreCase))
		{
			LogDetail($"Program error detected: {resultString}");
			return SidLaunchResult.ProgramError;
		}

		if (resultString.Contains("Loading IO handler:", StringComparison.OrdinalIgnoreCase))
		{
			LogDetail("Found 'Loading IO handler' message");
			return SidLaunchResult.Success;
		}

		LogDetail($"No specific tokens found, accumulated response: {resultString}");
		if (allBytes.Count > 0)
		{
			var hexBytes = string.Join(" ", allBytes.Select(b => $"0x{b:X2}"));
			LogDetail($"Raw bytes ({allBytes.Count}): {hexBytes}");
		}
		return SidLaunchResult.NoResponse;
	}

	static TeensyToken HandleAckWithResult(TcpCommunicationPort tcpPort)
	{
		tcpPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);
		byte[] recBuf = new byte[2];
		tcpPort.Read(recBuf, 0, 2);
		ushort recU16 = BitConverter.ToUInt16(recBuf, 0);

		LogDetail($"← Raw bytes: [{recBuf[0]} (0x{recBuf[0]:X2}), {recBuf[1]} (0x{recBuf[1]:X2})]");
		LogDetail($"← Parsed UInt16: {recU16} (0x{recU16:X4})");
		LogDetail($"← Expected ACK: {TeensyToken.Ack.Value} (0x{TeensyToken.Ack.Value:X4})");

		var ackToken = recU16 switch
		{
			var _ when recU16 == TeensyToken.Ack.Value => TeensyToken.Ack,
			var _ when recU16 == TeensyToken.Fail.Value => TeensyToken.Fail,
			var _ when recU16 == TeensyToken.RetryLaunch.Value => TeensyToken.RetryLaunch,
			_ => TeensyToken.Unnknown,
		};

		if (ackToken == TeensyToken.Ack)
		{
			LogDetail($"← ACK (bytes: [{recBuf[0]}, {recBuf[1]}])");
		}
		else if (ackToken == TeensyToken.RetryLaunch)
		{
			LogDetail("← Retry Launch ACK");
		}
		else if (ackToken == TeensyToken.Fail)
		{
			var rawResponse = tcpPort.ReadAndLogSerialAsString(100);
			LogError($"Received FAIL token with data: {rawResponse}");
		}
		else
		{
			var response = tcpPort.ReadAndLogSerialAsString(100);
			LogError($"Received unexpected ACK: {recU16} with data: {response}");
		}

		return ackToken;
	}

	enum SidLaunchResult
	{
		GoodSid,
		BadSid,
		ProgramError,
		Success,
		NoResponse
	}

	static void ReconnectForNextCommand(TcpCommunicationPort tcpPort)
	{
		LogDetail("Reconnecting for next command...");
		tcpPort.ClosePort();
		tcpPort.ClearBuffers();

		tcpPort.OpenPort();
	}

	static void HandleAck(TcpCommunicationPort tcpPort)
	{
		tcpPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);
		byte[] recBuf = new byte[2];
		tcpPort.Read(recBuf, 0, 2);
		ushort recU16 = BitConverter.ToUInt16(recBuf, 0);

		LogDetail($"← Raw bytes: [{recBuf[0]} (0x{recBuf[0]:X2}), {recBuf[1]} (0x{recBuf[1]:X2})]");
		LogDetail($"← Parsed UInt16: {recU16} (0x{recU16:X4})");
		LogDetail($"← Expected ACK: {TeensyToken.Ack.Value} (0x{TeensyToken.Ack.Value:X4})");

		var ackToken = recU16 switch
		{
			var _ when recU16 == TeensyToken.Ack.Value => TeensyToken.Ack,
			var _ when recU16 == TeensyToken.Fail.Value => TeensyToken.Fail,
			var _ when recU16 == TeensyToken.RetryLaunch.Value => TeensyToken.RetryLaunch,
			_ => TeensyToken.Unnknown,
		};

		if (ackToken == TeensyToken.Ack)
		{
			LogDetail($"← ACK (bytes: [{recBuf[0]}, {recBuf[1]}])");
			return;
		}

		if (ackToken == TeensyToken.Fail)
		{
			var rawResponse = tcpPort.ReadAndLogSerialAsString(100);
			throw new TeensyException($"Received FAIL token with data: {rawResponse}");
		}

		if (ackToken == TeensyToken.RetryLaunch)
		{
			LogDetail("← Retry Launch ACK");
			return;
		}

		var response = tcpPort.ReadAndLogSerialAsString(100);
		throw new TeensyException($"Received unexpected ACK: {recU16} with data: {response}");
	}

	internal static void LogHeader(string message)
	{
		var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
		Console.ForegroundColor = ConsoleColor.Cyan;
		Console.WriteLine($"[{timestamp}] {message}");
		Console.ResetColor();
	}

	internal static void LogDetail(string message)
	{
		var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
		Console.ForegroundColor = ConsoleColor.DarkGray;
		Console.WriteLine($"[{timestamp}]   {message}");
		Console.ResetColor();
	}

	internal static void Log(string message)
	{
		var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
		Console.WriteLine($"[{timestamp}] {message}");
	}

	internal static void LogSuccess(string message)
	{
		var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
		Console.ForegroundColor = ConsoleColor.Green;
		Console.WriteLine($"[{timestamp}] {message}");
		Console.ResetColor();
	}

	internal static void LogError(string message)
	{
		var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
		Console.ForegroundColor = ConsoleColor.Red;
		Console.WriteLine($"[{timestamp}] {message}");
		Console.ResetColor();
	}

	internal static void LogWarning(string message)
	{
		var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
		Console.ForegroundColor = ConsoleColor.Yellow;
		Console.WriteLine($"[{timestamp}] {message}");
		Console.ResetColor();
	}

	internal class SimpleLoggingService : TeensyRom.Core.Logging.ILoggingService
	{
		public void External(string message, string? deviceId = null) => Log(message);
		public void ExternalError(string message, string? deviceId = null) => LogError(message);
		public void ExternalSuccess(string message, string? deviceId = null) => LogSuccess(message);
		public void ExternalWarning(string message, string? deviceId = null) => LogWarning(message);
		public void Internal(string message, string? deviceId = null) => Log(message);
		public void InternalError(string message, string? deviceId = null) => LogError(message);
		public void InternalSuccess(string message, string? deviceId = null) => LogSuccess(message);
		public void InternalWarning(string message, string? deviceId = null) => LogWarning(message);

		System.IObservable<string> TeensyRom.Core.Logging.ILoggingService.Logs => throw new System.NotImplementedException();
	}
}
