using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

static class Rf2Results
{
    public static string Read(string file)
    {
        using var stream = File.OpenRead(file);
        if (stream.Length > 8_000_000) throw new InvalidOperationException("Result XML exceeds the pilot size limit.");
        var fingerprint = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        stream.Position = 0;
        using var reader = XmlReader.Create(stream, new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 8_000_000
        });
        var root = XDocument.Load(reader).Root;
        if (root?.Name.LocalName != "rFactorXML") throw new InvalidOperationException("Expected a native rFactor 2 results XML.");
        var session = root.Descendants().FirstOrDefault(x => x.Name.LocalName is "Race" or "Qualify" or "Qualify1" or "Practice")
            ?? throw new InvalidOperationException("No supported race, qualifying, or practice session in this XML.");
        // These are observations. The steward links the game identity and verifies the event before import.
        var drivers = session.Elements("Driver").Select(driver => new
        {
            steamId = Field(driver, "SteamID"),
            driver = Field(driver, "Name"),
            car = Field(driver, "VehName"),
            finishStatus = Field(driver, "FinishStatus"),
            position = PositiveInt(Field(driver, "Position")),
            bestLapMs = LapMs(Field(driver, "BestLapTime"))
        }).ToArray();
        return JsonSerializer.Serialize(new
        {
            source = "rfactor_2", fingerprint,
            session = session.Name.LocalName,
            track = root.Descendants("TrackVenue").FirstOrDefault()?.Value,
            layout = root.Descendants("TrackCourse").FirstOrDefault()?.Value,
            drivers
        }, new JsonSerializerOptions { WriteIndented = true });
    }
    static string? Field(XElement row, string name) => row.Element(name)?.Value.Trim();
    static int? PositiveInt(string? number) => int.TryParse(number, out var value) && value > 0 ? value : null;
    static int? LapMs(string? number) =>
        decimal.TryParse(number, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value) &&
        value is > 0 and <= 86400 ? (int)Math.Round(value * 1000, MidpointRounding.AwayFromZero) : null;
}
