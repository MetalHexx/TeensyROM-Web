using System.Text.RegularExpressions;

namespace TeensyRom.Core.Common
{
	public static class StringExtensions
	{
		public static List<string> SplitAtCarriageReturn(this string message)
		{
			string[] delimiters = ["\r\n", "\n", "\r"];
			string[] parts = message.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
			return new List<string>(parts);
		}

		public static string StripCarriageReturnsAndExtraWhitespace(this string input)
		{
			string noCarriageReturnsOrNewLines = Regex.Replace(input, @"\r\n?|\n", " ");
			string cleanedString = Regex.Replace(noCarriageReturnsOrNewLines, @"\s+", " ");
			return cleanedString.Trim();
		}

		/// <summary>
		/// Sanitizes a string for logging by removing control characters and normalizing whitespace.
		/// Useful for cleaning serial port output or other raw data that may contain excessive newlines,
		/// null bytes, and other control characters that would disrupt log formatting.
		/// </summary>
		/// <param name="input">The raw string to sanitize.</param>
		/// <returns>A cleaned string with control characters removed and whitespace normalized to single spaces.</returns>
		public static string SanitizeForLogging(this string input)
		{
			if (string.IsNullOrWhiteSpace(input))
				return input;

			// Remove control characters except basic whitespace (preserves \t, \r, \n for next step)
			var cleaned = Regex.Replace(input, @"[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]", "");
			
			// Replace multiple whitespace characters (including \r\n, \n, \r, spaces, tabs) with a single space
			cleaned = Regex.Replace(cleaned, @"\s+", " ");
			
			// Trim and return
			return cleaned.Trim();
		}

		public static string RemoveFirstOccurrence(this string input, string pattern)
		{
			int index = input.IndexOf(pattern);
			return index < 0 ? input : input.Remove(index, pattern.Length);
		}

		/// <summary>
		/// Validates whether the response string indicates a TeensyROM device.
		/// TeensyROM devices respond with "teensyrom" or "busy" (case-insensitive).
		/// </summary>
		public static bool IsTeensyRom(this string? response)
		{
			if (string.IsNullOrWhiteSpace(response))
			{
				return false;
			}

			var responseLower = response.ToLowerInvariant();
			return responseLower.Contains("teensyrom", StringComparison.OrdinalIgnoreCase) || IsTeensyRomBusy(response);
		}

		public static bool IsTeensyRomBusy(this string? response)
		{
			if (string.IsNullOrWhiteSpace(response))
			{
				return false;
			}
			return response.Contains("busy", StringComparison.OrdinalIgnoreCase);
		}

		public static string DropLastComma(this string message) => message.TrimEnd(',', ' ');
		public static string DropLastNewLine(this string message) => message.TrimEnd('\r', '\n', ' ');

		public static string GetIpAddress(this string endpoint)
		{
			if (string.IsNullOrEmpty(endpoint) || !endpoint.Contains(':'))
				return string.Empty;
			return endpoint.Split(':')[0];
		}

		public static int GetIpPort(this string endpoint)
		{
			if (string.IsNullOrEmpty(endpoint) || !endpoint.Contains(':'))
				return 0;
			var parts = endpoint.Split(':');
			return parts.Length == 2 && int.TryParse(parts[1], out int port) ? port : 0;
		}
	}
}
