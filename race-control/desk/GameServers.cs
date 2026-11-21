using System.Diagnostics;
using System.Text.Json;

sealed record ServerInstallation(string Root, string? Profile);
sealed class GameServers(string data)
{
    readonly object gate = new();
    readonly Dictionary<string, Process> processes = new();
    public bool Running(string id)
    {
        lock (gate) return processes.TryGetValue(id, out var process) && !process.HasExited;
    }
    public object Status() => new { rf2 = Running("rf2"), traffic = Running("traffic") };

    public void Start(string id)
    {
        lock (gate)
        {
            if (Running(id)) return;
            if (!OperatingSystem.IsWindows() || id is not ("rf2" or "traffic"))
                throw new InvalidOperationException("This game server requires its approved Windows installation.");
            var file = Path.Combine(data, "server-" + id + ".json");
            if (!File.Exists(file))
                throw new InvalidOperationException("Configure the dedicated server on the desk PC first.");
            ServerInstallation? setup;
            try { setup = JsonSerializer.Deserialize<ServerInstallation>(File.ReadAllText(file), new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
            catch (JsonException) { throw new InvalidOperationException("The local game server configuration is invalid."); }
            if (setup is null || !Path.IsPathFullyQualified(setup.Root))
                throw new InvalidOperationException("Set an absolute game server installation path.");
            var executable = Path.Combine(setup.Root, id == "rf2" ? @"Bin64\rFactor2 Dedicated.exe" : "AssettoServer.exe");
            if (!File.Exists(executable)) throw new InvalidOperationException("Dedicated server executable was not found.");
            var start = new ProcessStartInfo(executable) { WorkingDirectory = Path.GetDirectoryName(executable)!, UseShellExecute = false };
            if (id == "rf2")
            {
                start.ArgumentList.Add("+path=" + setup.Root);
                if (setup.Profile is { Length: > 0 } profile)
                {
                    if (profile.Length > 40 || profile.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-' && c != '_'))
                        throw new InvalidOperationException("Use a simple local server profile name.");
                    start.ArgumentList.Add("+profile=" + profile);
                }
            }
            if (processes.Remove(id, out var previous)) previous.Dispose();
            try
            {
                processes[id] = Process.Start(start) ?? throw new InvalidOperationException("Server did not start.");
            }
            catch (System.ComponentModel.Win32Exception)
            {
                throw new InvalidOperationException("Windows could not open the configured dedicated server.");
            }
        }
    }
    public void Stop(string id)
    {
        lock (gate)
        {
            if (!Running(id)) return;
            var process = processes[id];
            if (!process.CloseMainWindow() || !process.WaitForExit(2500))
                throw new InvalidOperationException("Close the game server in its own window to complete the stop.");
        }
    }
    public void Close()
    {
        lock (gate)
            foreach (var process in processes.Values) process.Dispose();
    }
}
