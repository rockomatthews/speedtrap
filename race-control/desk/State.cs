using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

static class Keys
{
    public static string New() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static bool Match(string input, string hash) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(input)), Encoding.UTF8.GetBytes(hash));
}

sealed class Venue
{
    public List<Rig> Rigs { get; set; } = [];
    public List<Session> Sessions { get; set; } = [];
    public List<Reservation> Reservations { get; set; } = [];
    public List<PairCode> PairCodes { get; set; } = [];
    public List<Command> Commands { get; set; } = [];
    public List<SiteBooking> SiteBookings { get; set; } = [];
    public List<QueuedResult> Results { get; set; } = [];
}
sealed class Rig
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string Name { get; set; }
    public required string SecretHash { get; set; }
    public DateTimeOffset LastSeen { get; set; }
    public string[] Presets { get; set; } = [];
    public string? Detail { get; set; }
}
sealed record PairCode(string Hash, DateTimeOffset Expires);
sealed record Reservation(string RigId, string Label, DateTimeOffset Start, DateTimeOffset End)
{
    public string Id { get; init; } = Guid.NewGuid().ToString();
    public string? SiteBookingId { get; init; }
}
sealed record Driver(string Id, string Name);
sealed record Seat(Driver Driver, DateTimeOffset From, DateTimeOffset? To, Guid? EventId = null, Guid? EntryId = null);
sealed class Session
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string RigId { get; set; }
    public required string Preset { get; set; }
    public string? ReservationId { get; init; }
    public string Status { get; set; } = "starting";
    public DateTimeOffset Ends { get; set; }
    public string? Detail { get; set; }
    public List<Seat> Seats { get; set; } = [];
    public bool Open => Status != "finished";
}
sealed class Command
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string SessionId { get; set; }
    public required string RigId { get; set; }
    public required string Action { get; set; }
    public required string Preset { get; set; }
    public DateTimeOffset Expires { get; set; }
    public bool Sent { get; set; }
    public bool Done { get; set; }
}
sealed record Preset(string Id, string Game, string Label, bool Assisted, string Instructions, string? Server);
static class Catalog
{
    public static readonly Preset[] All = [
        new("rf2-practice", "rfactor_2", "rFactor 2 · Practice", false, "Open rFactor 2, select the verified practice combination, then confirm the driver is on track.", null),
        new("rf2-race", "rfactor_2", "rFactor 2 · Private race", false, "Complete the dedicated server setup wizard, join the listed race from each rig, then confirm the seats.", "rf2"),
        new("ac-hotlap", "assetto_corsa", "Assetto Corsa · Hotlap", false, "Select the verified car and track in Assetto Corsa, then confirm the driver is on track.", null),
        new("ac-traffic", "assetto_corsa", "Assetto Corsa · Traffic", false, "Join the configured AssettoServer traffic lobby with the verified CSP build and content.", "traffic"),
        new("iracing-hosted", "iracing", "iRacing · Hosted race", true, "Use the licensed iRacing operator workflow. Confirm each seat once its driver is on track.", null)
    ];
    public static Preset Get(string id) => All.SingleOrDefault(p => p.Id == id) ?? throw new InvalidOperationException("Unknown preset.");
}

sealed class Store
{
    readonly object gate = new();
    readonly string connection;
    public Store(string file)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file))!);
        connection = new SqliteConnectionStringBuilder { DataSource = file }.ToString();
        using var db = new SqliteConnection(connection);
        db.Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS venue (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
            INSERT OR IGNORE INTO venue VALUES (1, '{}');
            """;
        cmd.ExecuteNonQuery();
    }
    public T Use<T>(Func<Venue,T> action, bool write = true)
    {
        lock (gate)
        {
            using var db = new SqliteConnection(connection);
            db.Open();
            using var tx = db.BeginTransaction(deferred: !write);
            using var cmd = db.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = "SELECT data FROM venue WHERE id=1";
            var venue = JsonSerializer.Deserialize<Venue>((string)cmd.ExecuteScalar()!)!;
            var result = action(venue);
            if (write)
            {
                cmd.CommandText = "UPDATE venue SET data=$data WHERE id=1";
                cmd.Parameters.AddWithValue("$data", JsonSerializer.Serialize(venue));
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
            return result;
        }
    }
}
