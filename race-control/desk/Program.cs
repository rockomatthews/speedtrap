using System.Net;
using System.Text.Json;

if (args is ["rig", var configFile])
{
    await RigWorker.Run(configFile);
    return;
}

if (args is ["rf2-results", var xmlFile])
{
    Console.WriteLine(Rf2Results.Read(xmlFile));
    return;
}

if (args is ["vms-page", var configFilePath])
{
    await VmsReadAdapter.ReadPage(configFilePath);
    return;
}

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 128_000);
var app = builder.Build();
var data = Environment.GetEnvironmentVariable("RACE_DESK_DATA") ??
    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SpeedTrap", "Desk");
Directory.CreateDirectory(data);
var keyFile = Path.Combine(data, "operator.txt");
if (!File.Exists(keyFile))
{
    using var stream = new FileStream(keyFile, FileMode.CreateNew);
    using var writer = new StreamWriter(stream);
    writer.Write(Keys.New());
}
var operatorHash = Keys.Hash(File.ReadAllText(keyFile).Trim());
var websiteKey = Environment.GetEnvironmentVariable("RACE_WEBSITE_KEY");
var websiteHash = websiteKey is { Length: >= 32 } ? Keys.Hash(websiteKey) : null;
Console.WriteLine($"Operator key file: {keyFile}");
var store = new Store(Path.Combine(data, "desk.sqlite"));
var servers = new GameServers(data);
var publisher = new CompetitionPublisher(store);
app.Lifetime.ApplicationStarted.Register(() => _ = publisher.Run(app.Lifetime.ApplicationStopping));
app.Lifetime.ApplicationStopping.Register(servers.Close);
app.Use(async (ctx, next) =>
{
    var address = ctx.Connection.RemoteIpAddress;
    var loopback = address is not null && (IPAddress.IsLoopback(address) ||
        (address.IsIPv4MappedToIPv6 && IPAddress.IsLoopback(address.MapToIPv4())));
    if (!ctx.Request.IsHttps && !loopback)
    {
        ctx.Response.StatusCode = 403;
        return;
    }
    ctx.Response.Headers.CacheControl = "no-store";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; base-uri 'none'";
    if (ctx.Request.Path.StartsWithSegments("/desk") && !Keys.Match(Token(ctx), operatorHash))
    {
        ctx.Response.StatusCode = 401;
        return;
    }
    if (ctx.Request.Path.StartsWithSegments("/site/v1") &&
        (websiteHash is null || !Keys.Match(Token(ctx), websiteHash)))
    {
        ctx.Response.StatusCode = 401;
        return;
    }
    try { await next(); }
    catch (InvalidOperationException ex) when (!ctx.Response.HasStarted)
    {
        ctx.Response.StatusCode = 409;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => new { ok = true });
app.MapGet("/desk/state", () => store.Use(v =>
{
    var now = DateTimeOffset.UtcNow;
    SiteApi.PruneHolds(v, now);
    foreach (var command in v.Commands.Where(c => !c.Done && c.Expires <= now))
    {
        command.Done = true;
        var session = v.Sessions.Single(s => s.Id == command.SessionId);
        session.Status = "needs_staff";
        session.Detail = "Rig did not acknowledge before the command expired. Check the rig in person.";
    }
    return new
    {
        now, presets = Catalog.All, servers = servers.Status(),
        rigs = v.Rigs.Select(r => new
        {
            r.Id, r.Name, r.Presets, r.Detail,
            online = IsOnline(r, now),
            session = v.Sessions.LastOrDefault(s => s.RigId == r.Id && s.Open),
            next = v.Reservations.Where(b => b.RigId == r.Id && b.End > now).OrderBy(b => b.Start).FirstOrDefault()
        }).ToArray()
    };
}));
app.MapPost("/desk/pair-code", () => store.Use(v =>
{
    var code = Keys.New()[..12];
    var now = DateTimeOffset.UtcNow;
    v.PairCodes.RemoveAll(p => p.Expires <= now);
    v.PairCodes.Add(new(Keys.Hash(code), now.AddMinutes(5)));
    return new { code };
}));
app.MapPost("/rig/pair", (Pair input) => store.Use(v =>
{
    if (input.Name is null || input.Name.Trim().Length is < 1 or > 50) throw new InvalidOperationException("Enter a rig name of 1–50 characters.");
    var code = v.PairCodes.Find(p => p.Expires > DateTimeOffset.UtcNow && Keys.Match(input.Code ?? "", p.Hash))
        ?? throw new InvalidOperationException("Pairing code is invalid or expired.");
    if (v.Rigs.Any(r => r.Name.Equals(input.Name.Trim(), StringComparison.OrdinalIgnoreCase)))
        throw new InvalidOperationException("That rig name is already in use.");
    v.PairCodes.Remove(code);
    var key = Keys.New();
    var rig = new Rig { Name = input.Name.Trim(), SecretHash = Keys.Hash(key) };
    v.Rigs.Add(rig);
    return new { rig.Id, key };
}));
app.MapPost("/rig/{id}/poll", (string id, Poll input, HttpContext ctx) => store.Use(v =>
{
    var rig = Authenticate(v, id, ctx);
    if (rig is null) return Results.Unauthorized();
    var now = DateTimeOffset.UtcNow;
    rig.LastSeen = now;
    rig.Presets = Catalog.All.Where(p => (input.Presets ?? []).Contains(p.Id)).Select(p => p.Id).ToArray();
    rig.Detail = input.Detail is { Length: <= 240 } ? input.Detail : null;
    var command = v.Commands.FirstOrDefault(c => c.RigId == id && !c.Done && !c.Sent && c.Expires > now);
    if (command is not null) command.Sent = true;
    return Results.Ok(new { command });
}));
app.MapPost("/rig/{id}/ack", (string id, Ack input, HttpContext ctx) => store.Use(v =>
{
    if (Authenticate(v, id, ctx) is null) return Results.Unauthorized();
    var cmd = v.Commands.Find(c => c.Id == input.Id && c.RigId == id && c.Sent);
    if (cmd is null) return Results.NotFound();
    if (cmd.Done || cmd.Expires <= DateTimeOffset.UtcNow) return Results.NoContent();
    cmd.Done = true;
    var session = v.Sessions.Single(s => s.Id == cmd.SessionId);
    session.Detail = input.Detail is { Length: <= 240 } ? input.Detail : null;
    session.Status = !input.Ok || cmd.Action == "start" ? "needs_staff" : "finished";
    if (session.Status == "finished") CloseSeat(session, DateTimeOffset.UtcNow);
    return Results.NoContent();
}));
app.MapPost("/desk/reservation", (Reserve input) => store.Use(v =>
{
    var now = DateTimeOffset.UtcNow;
    SiteApi.PruneHolds(v, now);
    if (input.Start < now || input.End <= input.Start || input.End - input.Start > TimeSpan.FromHours(24))
        throw new InvalidOperationException("Choose a future window of up to 24 hours.");
    var rig = GetRig(v, input.RigId);
    if (v.Reservations.Any(r => r.RigId == rig.Id && r.Start < input.End && r.End > input.Start) ||
        v.Sessions.Any(s => s.RigId == rig.Id && s.Open && s.Ends > input.Start))
        throw new InvalidOperationException("That time overlaps another reservation or session.");
    var item = new Reservation(rig.Id, Name(input.Label), input.Start, input.End);
    v.Reservations.Add(item);
    return item;
}));
app.MapPost("/desk/start", (Start input) => store.Use(v =>
{
    var preset = Catalog.Get(input.Preset);
    var now = DateTimeOffset.UtcNow;
    SiteApi.PruneHolds(v, now);
    if (input.Seats is null || input.Seats.Length is < 1 or > 32 ||
        input.Seats.Select(s => s.RigId).Distinct().Count() != input.Seats.Length)
        throw new InvalidOperationException("Select distinct rigs.");
    if (preset.Server is { } serverId && !servers.Running(serverId))
        throw new InvalidOperationException("Start the configured game server first.");
    var end = End(now, input.Minutes);
    foreach (var selection in input.Seats)
    {
        var rig = GetRig(v, selection.RigId);
        if (!IsOnline(rig, now) || !rig.Presets.Contains(preset.Id))
            throw new InvalidOperationException($"{rig.Name} has not confirmed readiness for that game.");
        if (v.Sessions.Any(s => s.RigId == rig.Id && s.Open))
            throw new InvalidOperationException($"{rig.Name} already has an active session.");
        var booking = selection.ReservationId is null ? null : v.Reservations.Find(r =>
            r.Id == selection.ReservationId && r.RigId == rig.Id && r.Start <= now && r.End >= end &&
            (r.SiteBookingId is null || v.SiteBookings.Any(b => b.ExternalId == r.SiteBookingId && b.Status == "confirmed" && (b.Preset is null || b.Preset == preset.Id))));
        if (selection.ReservationId is not null && booking is null)
            throw new InvalidOperationException($"{rig.Name}: check in during the reservation and use its remaining time.");
        CheckWindow(v, rig.Id, now, end, booking?.Id);
    }
    var sessions = input.Seats.Select(selection =>
    {
        var session = new Session { RigId = selection.RigId, Preset = preset.Id, Ends = end, ReservationId = selection.ReservationId,
            Status = preset.Assisted ? "needs_staff" : "starting", Detail = preset.Instructions,
            Seats = [NewSeat(selection.Driver, now, input.EventId, selection.EntryId)] };
        v.Sessions.Add(session);
        if (!preset.Assisted) Enqueue(v, session, "start", now);
        return session;
    }).ToArray();
    return sessions;
}));
app.MapPost("/desk/session/{id}", (string id, Change input) => store.Use(v =>
{
    var session = v.Sessions.Find(s => s.Id == id && s.Open) ?? throw new InvalidOperationException("Session is already closed.");
    var now = DateTimeOffset.UtcNow;
    SiteApi.PruneHolds(v, now);
    switch (input.Action)
    {
        case "confirm" when session.Status == "needs_staff":
            if (session.Ends <= now) throw new InvalidOperationException("Extend the session before confirming.");
            session.Status = "racing";
            session.Detail = null;
            break;
        case "rotate" when session.Status == "racing" && session.Ends > now:
            CloseSeat(session, now);
            session.Seats.Add(NewSeat(input.Driver, now, session.Seats[^1].EventId, input.EntryId));
            break;
        case "extend" when session.Status is "racing" or "needs_staff":
            var end = End(session.Ends > now ? session.Ends : now, input.Minutes);
            CheckWindow(v, session.RigId, now, end, session.ReservationId);
            session.Ends = end;
            break;
        case "stop" when input.Confirmed && IsOnline(GetRig(v, session.RigId), now) && !Catalog.Get(session.Preset).Assisted:
            if (v.Commands.Any(c => c.SessionId == id && c.Sent && !c.Done && c.Expires > now))
                throw new InvalidOperationException("Wait for the current rig command to finish.");
            CancelPending(v, id);
            session.Status = "stopping";
            Enqueue(v, session, "stop", now);
            break;
        case "finish" when input.Confirmed:
            if (v.Commands.Any(c => c.SessionId == id && c.Sent && !c.Done && c.Expires > now))
                throw new InvalidOperationException("Wait for the current rig command to finish.");
            CancelPending(v, id);
            CloseSeat(session, now);
            session.Status = "finished";
            break;
        default:
            throw new InvalidOperationException("That action is unavailable for the current session state.");
    }
    return session;
}));
app.MapPost("/desk/server/{name}/start", (string name) =>
{
    servers.Start(name);
    return new { running = servers.Running(name) };
});
app.MapPost("/desk/server/{name}/stop", (string name, ServerStop input) => store.Use(v =>
{
    if (!input.Confirmed || v.Sessions.Any(s => s.Open && Catalog.Get(s.Preset).Server == name))
        throw new InvalidOperationException("Finish all assigned seats before stopping this server.");
    servers.Stop(name);
    return new { running = servers.Running(name) };
}));
app.MapGet("/desk/diagnostics", () => store.Use(v => new
{
    generatedAt = DateTimeOffset.UtcNow,
    rigs = v.Rigs.Select(r => new { r.Name, r.LastSeen, r.Presets, r.Detail }),
    active = v.Sessions.Where(s => s.Open).Select(s => new { s.RigId, s.Preset, s.Status, s.Ends, s.Detail }),
    servers = servers.Status()
}, false));
publisher.Map(app);
SiteApi.Map(app, store);
await app.RunAsync();

static string Token(HttpContext ctx)
{
    var value = ctx.Request.Headers.Authorization.ToString();
    return value.StartsWith("Bearer ", StringComparison.Ordinal) && value.Length <= 120 ? value[7..] : "";
}
static Rig? Authenticate(Venue v, string id, HttpContext ctx)
{
    var rig = v.Rigs.Find(r => r.Id == id);
    return rig != null && Keys.Match(Token(ctx), rig.SecretHash) ? rig : null;
}
static Rig GetRig(Venue v, string id) => v.Rigs.Find(r => r.Id == id) ?? throw new InvalidOperationException("Rig not found.");
static bool IsOnline(Rig r, DateTimeOffset now) => r.LastSeen.AddSeconds(12) > now;
static string Name(string? value) => value?.Trim() is { Length: >= 1 and <= 80 } name ? name :
    throw new InvalidOperationException("Enter a name of 1–80 characters.");
static Seat NewSeat(string? name, DateTimeOffset now, Guid? eventId, Guid? entryId)
{
    if ((eventId is null) != (entryId is null) || eventId == Guid.Empty || entryId == Guid.Empty)
        throw new InvalidOperationException("Provide both the competition event and the driver’s check-in entry, or leave both blank.");
    return new(new Driver(Guid.NewGuid().ToString(), Name(name)), now, null, eventId, entryId);
}
static DateTimeOffset End(DateTimeOffset start, int minutes) => minutes is >= 1 and <= 240 ? start.AddMinutes(minutes) :
    throw new InvalidOperationException("Choose a duration from 1 to 240 minutes.");
static void CheckWindow(Venue v, string rigId, DateTimeOffset start, DateTimeOffset end, string? ownReservation)
{
    if (v.Reservations.Any(r => r.RigId == rigId && r.Id != ownReservation && r.Start < end && r.End > start))
        throw new InvalidOperationException($"{GetRig(v, rigId).Name} has a conflicting reservation.");
}
static void CloseSeat(Session s, DateTimeOffset end)
{
    var seat = s.Seats[^1];
    if (seat.To is null) s.Seats[^1] = seat with { To = end };
}
static void CancelPending(Venue v, string sessionId)
{
    foreach (var item in v.Commands.Where(c => c.SessionId == sessionId && !c.Done)) item.Done = true;
}
static void Enqueue(Venue v, Session s, string action, DateTimeOffset now) =>
    v.Commands.Add(new() { SessionId = s.Id, RigId = s.RigId, Preset = s.Preset, Action = action, Expires = now.AddSeconds(45) });

record Pair(string Code, string Name);
record Poll(string[] Presets, string? Detail);
record Ack(string Id, bool Ok, string? Detail);
record Reserve(string RigId, string Label, DateTimeOffset Start, DateTimeOffset End);
record StartSeat(string RigId, string Driver, string? ReservationId, Guid? EntryId);
record Start(string Preset, int Minutes, StartSeat[] Seats, Guid? EventId);
record Change(string Action, string? Driver, int Minutes, bool Confirmed, Guid? EntryId);
record ServerStop(bool Confirmed);
