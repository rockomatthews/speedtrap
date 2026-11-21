using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

sealed record RigConfig(string Desk, string Name, string? Code, string[] VerifiedPresets, string? SteamApps, bool Simulated, string? IRacingRoot = null);
sealed record RigIdentity(string Id, string Key);
sealed record PollReply(Command? Command);
static class RigWorker
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task Run(string configPath)
    {
        using var runLock = new FileStream(configPath + ".running", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        var config = JsonSerializer.Deserialize<RigConfig>(File.ReadAllText(configPath), Json)
            ?? throw new InvalidOperationException("Rig configuration is missing.");
        var url = new Uri(config.Desk);
        if (url.Scheme != "https" && !(url.Scheme == "http" && url.IsLoopback))
            throw new InvalidOperationException("Remote desks require HTTPS with a trusted certificate.");
        if (config.Simulated && !url.IsLoopback)
            throw new InvalidOperationException("Simulated rigs are allowed only on loopback.");
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
            { BaseAddress = url, Timeout = TimeSpan.FromSeconds(5) };
        var keyPath = configPath + ".identity";
        RigIdentity key;
        if (File.Exists(keyPath))
            key = JsonSerializer.Deserialize<RigIdentity>(File.ReadAllText(keyPath), Json)!;
        else
        {
            using var response = await client.PostAsJsonAsync("/rig/pair", new Pair(config.Code!, config.Name));
            if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Pairing failed. Check the desk URL and get a fresh pairing code.");
            key = await response.Content.ReadFromJsonAsync<RigIdentity>() ?? throw new InvalidOperationException("Desk pairing failed.");
            var temporary = keyPath + ".new";
            File.WriteAllText(temporary, JsonSerializer.Serialize(key, Json));
            File.Move(temporary, keyPath, overwrite: true);
            File.WriteAllText(configPath, JsonSerializer.Serialize(config with { Code = null }, Json));
        }
        client.DefaultRequestHeaders.Authorization = new("Bearer", key.Key);
        Console.WriteLine($"Paired as {config.Name}. Keep this worker in the signed-in driver session.");
        while (true)
        {
            try
            {
                var presets = Available(config);
                var detail = config.Simulated ? "Simulated rig" : presets.Length == 0
                    ? "No verified game preset. Check installation and configured content."
                    : "Local install checked. Confirm actual car, track, and controller on the rig.";
                using var response = await client.PostAsJsonAsync($"/rig/{key.Id}/poll", new Poll(presets, detail));
                if (response.StatusCode == HttpStatusCode.Unauthorized)
                    throw new InvalidOperationException("This rig credential is invalid. Pair again using a new configuration.");
                response.EnsureSuccessStatusCode();
                var poll = await response.Content.ReadFromJsonAsync<PollReply>();
                if (poll?.Command is { } command)
                {
                    var ack = Execute(config, presets, command);
                    using var receipt = await client.PostAsJsonAsync($"/rig/{key.Id}/ack", ack);
                    receipt.EnsureSuccessStatusCode();
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                Console.Error.WriteLine($"Desk connection unavailable: {ex.GetType().Name}");
            }
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }

    static string[] Available(RigConfig config) => Catalog.All.Where(p =>
        (config.VerifiedPresets ?? []).Contains(p.Id) && (config.Simulated || Installed(config, p.Game))).Select(p => p.Id).ToArray();

    static bool Installed(RigConfig config, string game)
    {
        if (!OperatingSystem.IsWindows()) return false;
        if (game == "iracing")
            return (config.IRacingRoot is { } path && Path.IsPathFullyQualified(path) && Directory.Exists(path)) ||
                Directory.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "iRacing")) ||
                Directory.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "iRacing"));
        return config.SteamApps is { Length: > 0 } root && Path.IsPathFullyQualified(root) &&
            File.Exists(Path.Combine(root, game == "rfactor_2" ? "appmanifest_365960.acf" : "appmanifest_244210.acf"));
    }

    static Ack Execute(RigConfig config, string[] presets, Command command)
    {
        if (DateTimeOffset.UtcNow >= command.Expires)
            return new(command.Id, false, "The command expired.");
        if (config.Simulated) return new(command.Id, true, "Simulated command acknowledged.");
        if (command.Action == "stop")
            return new(command.Id, false, "Exit the game at the rig and finish the seat from the desk.");
        if (command.Action != "start" || !presets.Contains(command.Preset))
            return new(command.Id, false, "This rig has not verified the requested preset.");
        var preset = Catalog.Get(command.Preset);
        var appId = preset.Game switch { "rfactor_2" => "365960", "assetto_corsa" => "244210", _ => null };
        if (appId is null) return new(command.Id, false, preset.Instructions);
        try
        {
            using var launch = Process.Start(new ProcessStartInfo($"steam://run/{appId}") { UseShellExecute = true });
            return new(command.Id, true, preset.Instructions);
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return new(command.Id, false, "Windows could not open Steam. Check the rig.");
        }
    }
}
