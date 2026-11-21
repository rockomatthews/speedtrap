using System.Net.Http.Json;
using System.Text.Json;

sealed record ResultUpload(Guid EventId, string SessionId, string DriverId, JsonElement Result);
sealed class QueuedResult
{
    public string Id { get; init; } = Guid.NewGuid().ToString();
    public required Guid EventId { get; init; }
    public required JsonElement Payload { get; init; }
    public string Status { get; set; } = "queued";
    public string? Reason { get; set; }
    public DateTimeOffset RetryAt { get; set; }
}

sealed class CompetitionPublisher(Store store)
{
    readonly string? key = Environment.GetEnvironmentVariable("RACE_COMPETITION_KEY");
    readonly Uri? origin = Resolve(Environment.GetEnvironmentVariable("RACE_COMPETITION_URL"));

    public void Map(WebApplication app)
    {
        app.MapGet("/desk/results", () => store.Use(v => new
        {
            configured = origin is not null && key is { Length: >= 32 },
            queue = v.Results.Select(r => new { r.Id, r.EventId, r.Status, r.Reason })
        }, false));
        app.MapGet("/desk/sessions", () => store.Use(v => v.Sessions.TakeLast(100).ToArray(), false));
        app.MapPost("/desk/results", (ResultUpload input) => store.Use(v =>
        {
            if (v.Results.Count(r => r.Status != "delivered") >= 500)
                throw new InvalidOperationException("Result queue is full. Review failed submissions.");
            var session = v.Sessions.Find(s => s.Id == input.SessionId) ??
                throw new InvalidOperationException("Desk session not found.");
            if (input.EventId == Guid.Empty || input.Result.ValueKind != JsonValueKind.Object ||
                !input.Result.TryGetProperty("occurredAt", out var time) || !TryTime(time, out var occurred) ||
                !input.Result.TryGetProperty("game", out var game) || game.ValueKind != JsonValueKind.String ||
                Catalog.Get(session.Preset).Game != game.GetString())
                throw new InvalidOperationException("Enter a valid event and result for the session’s game.");
            if (!input.Result.TryGetProperty("entryId", out var entry) ||
                entry.ValueKind != JsonValueKind.String || !entry.TryGetGuid(out var entryId))
                throw new InvalidOperationException("A checked-in competition entry ID is required.");
            var seat = session.Seats.Find(s => s.Driver.Id == input.DriverId && s.EventId == input.EventId &&
                s.EntryId == entryId && s.From <= occurred && (s.To is null || occurred < s.To) && occurred <= session.Ends);
            if (seat is null)
                throw new InvalidOperationException("That competition entry was not assigned to this driver and seat at the result time.");
            var result = new QueuedResult { EventId = input.EventId, Payload = input.Result.Clone() };
            v.Results.RemoveAll(r => r.Status == "delivered" && (r.RetryAt < DateTimeOffset.UtcNow.AddDays(-7)));
            v.Results.Add(result);
            return new { result.Id, result.Status };
        }));
    }

    public async Task Run(CancellationToken cancellation)
    {
        if (origin is null || key is not { Length: >= 32 }) return;
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
            { BaseAddress = origin, Timeout = TimeSpan.FromSeconds(10) };
        client.DefaultRequestHeaders.Authorization = new("Bearer", key);
        try
        {
            while (!cancellation.IsCancellationRequested)
            {
                var pending = store.Use(v => v.Results.Find(r =>
                    r.Status == "queued" && r.RetryAt <= DateTimeOffset.UtcNow), false);
                if (pending is not null) await Deliver(client, pending, cancellation);
                await Task.Delay(TimeSpan.FromSeconds(3), cancellation);
            }
        }
        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) {}
    }

    async Task Deliver(HttpClient client, QueuedResult pending, CancellationToken cancellation)
    {
        string? reason = null;
        string status;
        try
        {
            using var response = await client.PostAsJsonAsync($"/api/v1/events/{pending.EventId}/results",
                pending.Payload, cancellation);
            var code = (int)response.StatusCode;
            status = response.IsSuccessStatusCode ? "delivered" : code >= 500 || code == 429 ? "queued" : "needs_review";
            if (!response.IsSuccessStatusCode) reason = $"Competition API returned HTTP {code}.";
        }
        catch (Exception ex) when (!cancellation.IsCancellationRequested && ex is HttpRequestException or TaskCanceledException)
        {
            status = "queued";
            reason = "Competition server unavailable. Will retry.";
        }
        store.Use(v =>
        {
            var item = v.Results.Single(r => r.Id == pending.Id);
            item.Status = status;
            item.Reason = reason;
            item.RetryAt = DateTimeOffset.UtcNow.AddSeconds(30);
            return true;
        });
    }
    static bool TryTime(JsonElement value, out DateTimeOffset time)
    {
        time = default;
        return value.ValueKind == JsonValueKind.String && value.TryGetDateTimeOffset(out time);
    }
    static Uri? Resolve(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        string.IsNullOrEmpty(uri.UserInfo) && (uri.Scheme == "https" || uri.Scheme == "http" && uri.IsLoopback) ? uri : null;
}
