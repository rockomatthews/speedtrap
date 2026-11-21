using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

sealed record VmsPilotPage(long After, long VenueId, long CircuitId, long VehicleId, string UtcOffset,
    string Game, string Track, string Car, string Build, string Transmission, Dictionary<string, Guid> DriverEntries);
static class VmsReadAdapter
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task ReadPage(string config)
    {
        var map = JsonSerializer.Deserialize<VmsPilotPage>(await File.ReadAllTextAsync(config), Json)
            ?? throw new InvalidOperationException("VMS mapping is missing.");
        if (map.After < 0 || map.After >= long.MaxValue || map.VenueId <= 0 || map.CircuitId <= 0 || map.VehicleId <= 0 ||
            !TimeSpan.TryParseExact(map.UtcOffset.TrimStart('+','-'), @"hh\:mm", CultureInfo.InvariantCulture, out var utcOffset) ||
            utcOffset > TimeSpan.FromHours(14))
            throw new InvalidOperationException("Check provider IDs, cursor, and the event's verified UTC offset.");
        if (map.UtcOffset.StartsWith('-')) utcOffset = -utcOffset;
        var key = Environment.GetEnvironmentVariable("RACE_VMS_READ_KEY");
        if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Set a partner’s read-only VMS key.");
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
            { Timeout = TimeSpan.FromSeconds(12) };
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("SRL", key);
        using var response = await client.GetAsync($"https://api.simracing.co.uk/v0.1/laps?id={map.After + 1}&order=idasc&count=100&invalid=1",
            HttpCompletionOption.ResponseHeadersRead);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"VMS returned HTTP {(int)response.StatusCode}.");
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = XmlReader.Create(stream, new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 3_000_000
        });
        var root = XDocument.Load(reader).Root;
        if (root?.Name.LocalName != "laps") throw new InvalidOperationException("Expected the VMS laps XML response.");
        var cursor = map.After;
        var candidates = new List<object>();
        foreach (var row in root.Elements("lap"))
        {
            if (!long.TryParse(row.Element("id")?.Value, out var id) || id <= cursor)
                throw new InvalidOperationException("VMS did not return strictly increasing lap IDs.");
            cursor = id;
            if (Value(row, "venue_id") != map.VenueId || Value(row, "circuit_id") != map.CircuitId
                || Value(row, "vehicle_id") != map.VehicleId || row.Element("invalid")?.Value != "0" ||
                row.Element("transmission")?.Value != map.Transmission ||
                !map.DriverEntries.TryGetValue(row.Element("customer_id")?.Value ?? "", out var entryId) ||
                !int.TryParse(row.Element("time_ms")?.Value, out var time) || time <= 0 ||
                !DateTime.TryParseExact(row.Element("date")?.Value, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var local))
                continue;
            candidates.Add(new
            {
                entryId, sourceId = $"vms:{map.VenueId}:{id}", revision = 1, kind = "lap",
                map.Game, map.Track, map.Car, map.Build, occurredAt = new DateTimeOffset(local, utcOffset),
                valid = true, lapMs = time, provenance = "provider_feed",
                evidence = $"Read-only VMS venue {map.VenueId}, lap {id}; staff verified event content mapping."
            });
        }
        Console.WriteLine(JsonSerializer.Serialize(new { candidateNextCursor = cursor, candidates }, Json));
    }

    static long Value(XElement row, string field) => long.TryParse(row.Element(field)?.Value, out var value) ? value : -1;
}
