export function venueBookingClient({ baseUrl, key, timeoutMs = 3500 }) {
  const origin = new URL(baseUrl);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["127.0.0.1","localhost","[::1]"].includes(origin.hostname)))
    throw new Error("The venue API requires HTTPS.");
  if (!key || origin.username || origin.password) throw new Error("Use a dedicated website credential.");
  async function call(path, body) {
    const response = await fetch(new URL("/site/v1"+path,origin),{
      method:body === undefined ? "GET" : "POST",
      redirect:"error",cache:"no-store",signal:AbortSignal.timeout(timeoutMs),
      headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(result?.error ?? "Venue API request failed."),{status:response.status});
    return result;
  }
  const booking = id => "/bookings/" + encodeURIComponent(id);
  return {
    catalog: () => call("/catalog"),
    availability: ({start,end,preset}) => call("/availability?"+new URLSearchParams({start,end,...(preset ? {preset} : {})})),
    hold: (reservation) => call("/holds",reservation),
    status: (id) => call(booking(id)),
    confirm: (id) => call(booking(id)+"/confirm",{}),
    release: (id) => call(booking(id)+"/release",{})
  };
}
