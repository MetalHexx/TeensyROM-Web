using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace TeensyRom.Core.Common
{
    public static class FileHelper 
    {
        public static void DeleteAllFilesStartingWith(string name, string directory)
        {
            if (Directory.Exists(directory))
            {
                var logFiles = Directory.GetFiles(directory, $"{name}*")
                    .Select(f => new FileInfo(f))
                    .Where(f => f.Exists);

                foreach (var file in logFiles)
                {
                    try
                    {
                        file.Delete();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Failed to delete {file.FullName}: {ex.Message}");
                    }
                }
            }
        }

        public static void DeleteFilesOlderThan(DateTime date, string directory)
        {
            if (Directory.Exists(directory))
            {
                var files = Directory.GetFiles(directory)
                    .Select(f => new FileInfo(f))
                    .Where(f => f.Exists && f.LastWriteTime < date);

                foreach (var file in files)
                {
                    try
                    {
                        file.Delete();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Failed to delete {file.FullName}: {ex.Message}");
                    }
                }
            }
        }

        public static string GetFileDateTimeStamp(DateTime date)
        {
            return date.ToString("yyyy-MM-dd_HH-mm-ss");
        }

        // Letters, digits, hyphen, underscore; 1–32 characters. Accepts chip IDs ("19307720"), the display-only
        // "Unknown"/"Unknown-2" stand-ins, and any file-name-safe key. Rejects empty, whitespace, and punctuation.
        public static bool IsValidDeviceId(this string? deviceId)
            => !string.IsNullOrEmpty(deviceId) && Regex.IsMatch(deviceId, @"^[A-Za-z0-9_-]{1,32}$");


        public static string GenerateFilenameSafeHash(this string stringToHash)
        {
            var length = 8;

            using var md5 = MD5.Create();
            byte[] inputBytes = Encoding.UTF8.GetBytes(stringToHash);
            byte[] hashBytes = md5.ComputeHash(inputBytes);

            const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            var builder = new StringBuilder(length);
            int bitIndex = 0;
            int current = 0;
            int bitsLeft = 0;

            foreach (byte b in hashBytes)
            {
                current = (current << 8) | b;
                bitsLeft += 8;

                while (bitsLeft >= 5 && builder.Length < length)
                {
                    bitIndex = (current >> (bitsLeft - 5)) & 31;
                    builder.Append(alphabet[bitIndex]);
                    bitsLeft -= 5;
                }

                if (builder.Length >= length)
                    break;
            }

            return builder.ToString();
        }

    }
}
