const $ = id => document.getElementById(id);
let token = "";
let state;
let refreshing = false;
const selections = new Map();
const notice = text => { $("notice").textContent = text; };

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || (response.status === 401 ? "Invalid operator key." : "Desk request failed."));
  return data;
}

async function refresh() {
  if (!token || refreshing) return;
  refreshing = true;
  try {
    state = await api("/desk/state");
    $("operations").hidden = false;
    $("login").hidden = true;
    render();
  } finally { refreshing = false; }
}

const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function button(label, action) {
  const node = make("button", label);
  node.type = "button";
  node.onclick = () => run(action);
  return node;
}
async function run(action) {
  try { await action(); await refresh(); }
  catch (error) { notice(error.message); }
}
function options(element, values) {
  const before = element.value;
  element.replaceChildren(...values.map(([id, label]) => new Option(label, id)));
  if (values.some(([id]) => id === before)) element.value = before;
}
function render() {
  if (document.activeElement?.matches(".rig input")) return;
  options($("preset"), state.presets.map(preset => [preset.id, preset.label]));
  options($("reserve-rig"), state.rigs.map(rig => [rig.id, rig.name]));
  const preset = state.presets.find(item => item.id === $("preset").value);
  $("instructions").textContent = preset.instructions;
  const serverButtons = Object.entries(state.servers).map(([server, running]) => {
    const label = server === "rf2" ? "rFactor 2 server" : "Traffic server";
    return button(running ? "Close " + label : "Open " + label, async () => {
      if (running && !window.confirm("Close " + label + "?")) return;
      await api("/desk/server/" + server + (running ? "/stop" : "/start"), { confirmed: true });
    });
  });
  $("servers").replaceChildren(...serverButtons);
  $("rigs").replaceChildren(...state.rigs.map(rig => rigCard(rig, preset)));
}
function rigCard(rig, preset) {
  const card = make("article", null, "rig");
  const session = rig.session;
  const seconds = session && Math.max(0, Math.ceil((Date.parse(session.ends) - Date.parse(state.now)) / 1000));
  const label = !rig.online ? "Offline" : session ? ({ needs_staff: "Needs staff" }[session.status] ?? session.status) :
    rig.presets.includes(preset.id) ? "Ready" : "Preset unavailable";
  card.append(make("h3", rig.name), make("p", label, "state " + (!rig.online ? "offline" : session?.status ?? "")));
  if (rig.detail) card.append(make("small", rig.detail));
  if (rig.next) card.append(make("p", "Next: " + rig.next.label + " · " + new Date(rig.next.start).toLocaleString()));
  if (session) {
    const seat = session.seats.at(-1);
    const current = seat.driver.name;
    const game = state.presets.find(item => item.id === session.preset);
    card.append(make("p", current + " · " + game.label),
      make("p", seconds ? Math.floor(seconds / 60) + "m " + seconds % 60 + "s remaining" : "Time is up"));
    if (session.detail) card.append(make("p", session.detail));
    const actions = make("div", null, "toolbar");
    const change = body => api("/desk/session/" + session.id, body);
    if (session.status === "needs_staff")
      actions.append(button("Driver on track", () => change({ action: "confirm" })));
    if (session.status === "racing")
      actions.append(button("Rotate driver", async () => {
        const driver = window.prompt("Next driver’s name");
        if (!driver?.trim()) return;
        const entryId = seat.eventId ? window.prompt("Next driver’s competition entry ID")?.trim() : undefined;
        if (seat.eventId && !entryId) return;
        await change({ action: "rotate", driver, entryId });
      }));
    if (["racing", "needs_staff"].includes(session.status))
      actions.append(button("Extend 15 min", () => change({ action: "extend", minutes: 15 })));
    actions.append(button("Finish seat", async () => {
      if (window.confirm("Confirm " + current + " has exited the game on " + rig.name + "."))
        await change({ action: "finish", confirmed: true });
    }));
    card.append(actions);
    return card;
  }
  const entry = selections.get(rig.id) ?? { selected: false, driver: "", entryId: "" };
  selections.set(rig.id, entry);
  const checkbox = make("input");
  checkbox.type = "checkbox";
  checkbox.checked = entry.selected;
  checkbox.disabled = !rig.online || !rig.presets.includes(preset.id);
  checkbox.onchange = () => { entry.selected = checkbox.checked; };
  const selectLabel = make("label", null, "pick");
  selectLabel.append(checkbox, document.createTextNode("Select " + rig.name));
  const driver = make("input");
  driver.value = entry.driver;
  driver.maxLength = 80;
  driver.disabled = checkbox.disabled;
  driver.oninput = () => { entry.driver = driver.value; };
  const driverLabel = make("label", "Driver");
  driverLabel.append(driver);
  card.append(selectLabel, driverLabel);
  if ($("event-id").value.trim()) {
    const entryLabel = make("label", "Competition entry ID");
    const field = make("input");
    field.value = entry.entryId;
    field.maxLength = 36;
    field.disabled = checkbox.disabled;
    field.oninput = () => { entry.entryId = field.value; };
    entryLabel.append(field);
    card.append(entryLabel);
  }
  return card;
}
$("login").onsubmit = event => {
  event.preventDefault();
  token = new FormData(event.currentTarget).get("key").trim();
  run(async () => { await refresh(); notice(""); });
};
$("start").onsubmit = event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const preset = form.get("preset");
  const eventId = form.get("eventId").trim() || null;
  const seats = state.rigs.flatMap(rig => {
    const item = selections.get(rig.id);
    return rig.online && !rig.session && rig.presets.includes(preset) && item?.selected ? [{ rigId: rig.id, driver: item.driver, entryId: eventId ? item.entryId.trim() || null : null, reservationId: rig.next && Date.parse(rig.next.start) <= Date.parse(state.now) ? rig.next.id : null }] : [];
  });
  run(async () => {
    await api("/desk/start", { preset, minutes: Number(form.get("minutes")), seats, eventId });
    for (const seat of seats) selections.delete(seat.rigId);
    notice("Sessions assigned.");
  });
};
$("booking").onsubmit = event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  run(async () => {
    await api("/desk/reservation", { rigId: form.get("rigId"), label: form.get("label"),
      start: new Date(form.get("start")).toISOString(), end: new Date(form.get("end")).toISOString() });
    notice("Reservation saved.");
  });
};
$("preset").onchange = render;
$("event-id").onchange = render;
$("refresh").onclick = () => run(async () => {});
$("pair").onclick = () => run(async () => {
  const { code } = await api("/desk/pair-code", {});
  $("pair-code").textContent = "One-time code (5 minutes): " + code;
});
$("diagnostics").onclick = () => run(async () => {
  const file = new Blob([JSON.stringify(await api("/desk/diagnostics"), null, 2)], { type: "application/json" });
  const link = make("a");
  link.href = URL.createObjectURL(file);
  link.download = "speedtrap-desk-diagnostics.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
setInterval(() => { if (state) refresh().catch(error => notice(error.message)); }, 3000);

$("sessions").onclick = () => run(async () => {
  const file = new Blob([JSON.stringify(await api("/desk/sessions"), null, 2)], { type: "application/json" });
  const link = make("a");
  link.href = URL.createObjectURL(file);
  link.download = "speedtrap-driver-assignments.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
$("queue-status").onclick = () => run(async () => {
  const { queue, configured } = await api("/desk/results");
  $("queue-info").textContent = (configured ? "" : "Competition connection has not been configured.\n") +
    queue.map(item => item.id + " · " + item.status + (item.reason ? " · " + item.reason : "")).join("\n");
});
$("result-upload").onsubmit = event => {
  event.preventDefault();
  const file = new FormData(event.currentTarget).get("result");
  run(async () => {
    if (file.size > 16000) throw new Error("Result upload is too large.");
    const { id } = await api("/desk/results", JSON.parse(await file.text()));
    notice("Queued result " + id);
  });
};
