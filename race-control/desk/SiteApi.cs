sealed class SiteBooking
{
    public required string ExternalId { get; init; }
    public required string[] RigIds { get; init; }
    public DateTimeOffset Start { get; init; }
    public DateTimeOffset End { get; init; }
    public DateTimeOffset Expires { get; init; }
    public string? Preset { get; init; }
    public string Status { get; set; } = "held";
}
sealed record Hold(string ExternalId, string[] RigIds, DateTimeOffset Start, DateTimeOffset End, string? Preset);

static class SiteApi
{
    public static void Map(WebApplication app, Store store)
    {
        var routes = app.MapGroup("/site/v1");
        routes.MapGet("/catalog", () => store.Use(v => Catalog.All.Where(p => v.Rigs.Any(r => r.Presets.Contains(p.Id)))
            .Select(p => new { p.Id, p.Game, p.Label }).ToArray(), false));
        routes.MapGet("/availability", (DateTimeOffset start, DateTimeOffset end, string? preset) => store.Use(v =>
        {
            var now = DateTimeOffset.UtcNow;
            ValidateWindow(start, end, now);
            PruneHolds(v, now);
            if (preset is not null) Catalog.Get(preset);
            return v.Rigs.Where(r => (preset is null || r.Presets.Contains(preset)) && Available(v, r.Id, start, end))
                .Select(r => new { r.Id, r.Name }).ToArray();
        }));
        routes.MapPost("/holds", (Hold input) => store.Use(v =>
        {
            if (input.ExternalId is null || !ValidId(input.ExternalId) ||
                input.RigIds is null || input.RigIds.Length is < 1 or > 32 || input.RigIds.Distinct().Count() != input.RigIds.Length)
                throw new InvalidOperationException("Provide one external booking ID and distinct rig IDs.");
            var now = DateTimeOffset.UtcNow;
            PruneHolds(v, now);
            var ids = input.RigIds.Order(StringComparer.Ordinal).ToArray();
            var existing = v.SiteBookings.Find(x => x.ExternalId == input.ExternalId);
            if (existing is not null)
            {
                if (existing.Start != input.Start || existing.End != input.End || existing.Preset != input.Preset || !existing.RigIds.SequenceEqual(ids))
                    throw new InvalidOperationException("That booking ID already belongs to a different reservation.");
                return existing;
            }
            ValidateWindow(input.Start, input.End, now);
            if (input.Preset is not null) Catalog.Get(input.Preset);
            if (ids.Any(id => !v.Rigs.Any(r => r.Id == id && (input.Preset is null || r.Presets.Contains(input.Preset))) ||
                !Available(v, id, input.Start, input.End)))
                throw new InvalidOperationException("One of the requested rigs is unavailable.");
            var booking = new SiteBooking { ExternalId = input.ExternalId, RigIds = ids,
                Start = input.Start, End = input.End, Expires = now.AddMinutes(10), Preset = input.Preset };
            v.SiteBookings.Add(booking);
            var label = input.Preset is null ? "Website reservation" : $"Website · {Catalog.Get(input.Preset).Label}";
            foreach (var id in ids)
                v.Reservations.Add(new(id, label, input.Start, input.End) { SiteBookingId = input.ExternalId });
            return booking;
        }));
        routes.MapGet("/bookings/{id}", (string id) => store.Use(v =>
        {
            PruneHolds(v, DateTimeOffset.UtcNow);
            return Results.Ok(Find(v, id));
        }));
        routes.MapPost("/bookings/{id}/confirm", (string id) => store.Use(v =>
        {
            PruneHolds(v, DateTimeOffset.UtcNow);
            var booking = Find(v, id);
            if (booking.Status is not ("held" or "confirmed"))
                throw new InvalidOperationException("That booking has expired or been released.");
            booking.Status = "confirmed";
            return booking;
        }));
        routes.MapPost("/bookings/{id}/release", (string id) => store.Use(v =>
        {
            PruneHolds(v, DateTimeOffset.UtcNow);
            var booking = Find(v, id);
            if (v.Reservations.Any(r => r.SiteBookingId == id &&
                v.Sessions.Any(s => s.ReservationId == r.Id && s.Open)))
                throw new InvalidOperationException("Finish the assigned sessions before releasing this booking.");
            if (booking.Status != "expired") booking.Status = "released";
            v.Reservations.RemoveAll(r => r.SiteBookingId == id);
            return booking;
        }));
    }

    public static void PruneHolds(Venue v, DateTimeOffset now)
    {
        foreach (var booking in v.SiteBookings.Where(b => b.Status == "held" && b.Expires <= now))
        {
            booking.Status = "expired";
            v.Reservations.RemoveAll(r => r.SiteBookingId == booking.ExternalId);
        }
    }

    static bool ValidId(string id) => id.Length is >= 1 and <= 80 &&
        id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');
    static SiteBooking Find(Venue v, string id) =>
        v.SiteBookings.Find(booking => booking.ExternalId == id)
        ?? throw new InvalidOperationException("Website booking not found.");
    static bool Available(Venue v, string id, DateTimeOffset start, DateTimeOffset end) =>
        !v.Reservations.Any(r => r.RigId == id && r.Start < end && r.End > start) &&
        !v.Sessions.Any(s => s.RigId == id && s.Open && (s.Ends > start || s.Ends <= DateTimeOffset.UtcNow && start < DateTimeOffset.UtcNow.AddMinutes(5)));
    static void ValidateWindow(DateTimeOffset start, DateTimeOffset end, DateTimeOffset now)
    {
        if (start < now || end <= start || end - start > TimeSpan.FromHours(24))
            throw new InvalidOperationException("Choose a future window of up to 24 hours.");
    }
}
