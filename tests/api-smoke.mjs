// API smoke test — chạy thật qua HTTP: auth, RBAC, lifecycle, tenant isolation, idempotency, simulator
// Usage: node tests/api-smoke.mjs http://localhost:3457
const BASE = process.argv[2] ?? "http://localhost:3000";

let pass = 0;
let failCount = 0;
const failures = [];
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    failCount++;
    failures.push(name);
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function api(method, path, { body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-json */
  }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, setCookie };
}

async function login(email, password) {
  const r = await api("POST", "/api/auth/login", { body: { email, password } });
  const sc = r.setCookie ?? "";
  const m = sc.match(/ccc_session=([^;]+)/);
  return m ? `ccc_session=${m[1]}` : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 30000, interval = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(interval);
  }
  return null;
}

async function main() {
  console.log(`\n=== SMOKE TEST against ${BASE} ===\n`);

  // ---------- 0. Health ----------
  console.log("— HEALTH —");
  const health = await api("GET", "/api/health");
  check("GET /api/health trả 200 + database up", health.status === 200 && health.json?.database === "up", `got ${health.status} ${JSON.stringify(health.json).slice(0, 120)}`);

  // ---------- 1. Auth ----------
  console.log("— AUTH —");
  const uniq = Date.now();
  const reg = await api("POST", "/api/auth/register", {
    body: { email: `smoke${uniq}@nova.demo`, name: "Smoke Tester", password: "Smoke#2026!" },
  });
  check("register trả 201 + userId", reg.status === 201 && Boolean(reg.json?.user?.id), `got ${reg.status} ${JSON.stringify(reg.json).slice(0, 100)}`);
  const smCookie = await login(`smoke${uniq}@nova.demo`, "Smoke#2026!");
  check("login user mới nhận session cookie", Boolean(smCookie));

  const badLogin = await api("POST", "/api/auth/login", { body: { email: `smoke${uniq}@nova.demo`, password: "sai" } });
  check("login sai mật khẩu bị chặn", badLogin.status === 401 || badLogin.status === 400, `got ${badLogin.status}`);

  const meNoAuth = await api("GET", "/api/auth/me");
  check("/me không cookie → UNAUTHENTICATED", meNoAuth.status === 401, `got ${meNoAuth.status}`);

  // ---------- 2. Seeded users + workspace ----------
  console.log("\n— SEEDED WORKSPACE —");
  const ownerCookie = await login("owner@nova.demo", "crisis2026");
  check("seeded owner login OK", Boolean(ownerCookie));
  const execCookie = await login("exec_viewer@nova.demo", "crisis2026");
  check("seeded exec_viewer login OK", Boolean(execCookie));

  const meOwner = await api("GET", "/api/auth/me", { cookie: ownerCookie });
  check("/me trả role OWNER", meOwner.json?.workspaces?.[0]?.role === "OWNER", JSON.stringify(meOwner.json).slice(0, 120));

  const wsId = meOwner.json?.workspaces?.[0]?.id;
  check("/me có workspace seeded", Boolean(wsId), JSON.stringify(meOwner.json).slice(0, 120));

  const events0 = await api("GET", `/api/live-events?workspaceId=${wsId}`, { cookie: ownerCookie });
  const seededEvent = events0.json?.items?.[0];
  check("GET /api/live-events có event seeded", Boolean(seededEvent), JSON.stringify(events0.json).slice(0, 120));

  // ---------- 3. RBAC negative ----------
  console.log("\n— RBAC —");
  const execCreate = await api("POST", "/api/live-events", {
    cookie: execCookie,
    body: { name: "Exec không được tạo event", brandId: seededEvent?.brandId ?? "", platforms: ["facebook"] },
  });
  check("EXEC_VIEWER tạo event → 403", execCreate.status === 403, `got ${execCreate.status}`);

  const noWsEvent = await api("GET", `/api/live-events/${seededEvent?.id}`, { cookie: smCookie });
  check("user ngoài workspace đọc event → 403/404", noWsEvent.status === 403 || noWsEvent.status === 404, `got ${noWsEvent.status}`);

  const brandList = await api("GET", `/api/brands?workspaceId=${wsId}`, { cookie: ownerCookie });
  const brandId = brandList.json?.items?.[0]?.id;
  check("GET /api/brands có brand", Boolean(brandId));

  // ---------- 4. Tạo event + lifecycle ----------
  console.log("\n— EVENT LIFECYCLE —");
  const created = await api("POST", "/api/live-events", {
    cookie: ownerCookie,
    body: {
      name: `Smoke Event ${uniq}`,
      brandId,
      platforms: ["facebook", "tiktok"],
      dataMode: "DEMO",
      hostUserId: meOwner.json?.user?.id,
      oncallUserIds: [],
      riskKeywords: ["lừa đảo", "giao trễ"],
    },
  });
  const eventId = created.json?.id;
  check("POST /api/live-events tạo event DRAFT", created.status === 201 && Boolean(eventId), `${created.status} ${JSON.stringify(created.json).slice(0, 150)}`);

  // ---------- Multi-category: tạo event ngành F&B ----------
  const createdFood = await api("POST", "/api/live-events", {
    cookie: ownerCookie,
    body: {
      name: `Smoke Food Event ${uniq}`,
      brandId,
      platforms: ["tiktok"],
      dataMode: "DEMO",
      products: [{ name: "Yến chưng đường phèn", offer: "Mua 2 tặng 1", category: "food" }],
    },
  });
  const foodEventId = createdFood.json?.id;
  check("POST event với product category=food OK", createdFood.status === 201 && createdFood.json?.products?.[0]?.category === "food", `${createdFood.status} ${JSON.stringify(createdFood.json).slice(0, 150)}`);

  const invalidCat = await api("POST", "/api/live-events", {
    cookie: ownerCookie,
    body: {
      name: `Smoke Invalid Cat ${uniq}`,
      brandId,
      platforms: ["facebook"],
      products: [{ name: "X", category: "khong ton tai" }],
    },
  });
  check("category không hợp lệ bị chặn 422", invalidCat.status === 422 || invalidCat.status === 400, `got ${invalidCat.status}`);

  const detail = await api("GET", `/api/live-events/${eventId}`, { cookie: ownerCookie });
  check("GET detail event đúng tên + readiness", detail.json?.event?.name === `Smoke Event ${uniq}` && Boolean(detail.json?.readiness), JSON.stringify(detail.json).slice(0, 120));

  const ready = await api("POST", `/api/live-events/${eventId}/status`, { cookie: ownerCookie, body: { action: "ready" } });
  check("DRAFT → READY", ready.json?.event?.status === "READY" || ready.json?.status === "READY", JSON.stringify(ready.json).slice(0, 120));

  const readyAgain = await api("POST", `/api/live-events/${eventId}/status`, { cookie: ownerCookie, body: { action: "ready" } });
  check("READY → READY bị chặn (state machine)", readyAgain.status === 409 || readyAgain.status === 400, `got ${readyAgain.status}`);

  const start = await api("POST", `/api/live-events/${eventId}/status`, { cookie: ownerCookie, body: { action: "start" } });
  check("READY → LIVE", start.json?.event?.status === "LIVE" || start.json?.status === "LIVE", JSON.stringify(start.json).slice(0, 120));

  // ---------- 5. Simulator + stream ----------
  console.log("\n— SIMULATOR —");
  const simStart = await api("POST", `/api/live-events/${eventId}/simulator`, { cookie: ownerCookie, body: { action: "start" } });
  check("simulator start OK", simStart.status === 200 || simStart.status === 201, `${simStart.status} ${JSON.stringify(simStart.json).slice(0, 120)}`);

  const msgs = await waitFor(async () => {
    const r = await api("GET", `/api/live-events/${eventId}/stream`, { cookie: ownerCookie });
    return (r.json?.messages?.length ?? 0) >= 5 ? r.json : null;
  }, 25000);
  check("stream có messages chảy", Boolean(msgs), "không nhận đủ 5 message trong 25s");
  check("stream dataMode = DEMO khi sim chạy", msgs?.dataMode === "DEMO", `got ${msgs?.dataMode}`);

  const alertData = await waitFor(async () => {
    const r = await api("GET", `/api/live-events/${eventId}/alerts`, { cookie: ownerCookie });
    return (r.json?.items?.length ?? 0) >= 1 ? r.json.items : null;
  }, 40000);
  check("rule engine sinh alert từ burst", Boolean(alertData));
  const alert = alertData?.[0];
  check("alert có priority hợp lệ", ["P0", "P1", "P2", "P3"].includes(alert?.priority), `got ${alert?.priority}`);

  const simPause = await api("POST", `/api/live-events/${eventId}/simulator`, { cookie: ownerCookie, body: { action: "pause" } });
  check("simulator pause OK", simPause.status === 200, JSON.stringify(simPause.json).slice(0, 100));
  const simResume = await api("POST", `/api/live-events/${eventId}/simulator`, { cookie: ownerCookie, body: { action: "resume" } });
  check("simulator resume OK", simResume.status === 200, JSON.stringify(simResume.json).slice(0, 100));

  // ---------- 6. Alert → incident ----------
  console.log("\n— ALERT → INCIDENT —");
  const ack = await api("POST", `/api/live-events/${eventId}/alerts`, { cookie: ownerCookie, body: { action: "acknowledge", alertId: alert.id } });
  check("acknowledge alert OK", ack.status === 200 && ack.json?.status === "ACKNOWLEDGED", `${ack.status} ${JSON.stringify(ack.json).slice(0, 100)}`);

  const conv = await api("POST", `/api/live-events/${eventId}/alerts`, {
    cookie: ownerCookie,
    body: { action: "create-incident", alertId: alert.id, requestKey: `smoke-conv-${uniq}`, incident: { severity: "P2" } },
  });
  const incidentId = conv.json?.id;
  check("convert alert → incident", (conv.status === 200 || conv.status === 201) && Boolean(incidentId), `${conv.status} ${JSON.stringify(conv.json).slice(0, 150)}`);

  const convReplay = await api("POST", `/api/live-events/${eventId}/alerts`, {
    cookie: ownerCookie,
    body: { action: "create-incident", alertId: alert.id, requestKey: `smoke-conv-${uniq}`, incident: { severity: "P2" } },
  });
  check("idempotency: replay requestKey trả cùng incident", convReplay.json?.id === incidentId, `${convReplay.status}`);

  // ---------- 7. Incident workflow ----------
  console.log("\n— INCIDENT WORKFLOW —");
  const assign = await api("POST", `/api/incidents/${incidentId}/actions`, { cookie: ownerCookie, body: { action: "assign", userId: meOwner.json?.user?.id, role: "owner" } });
  check("assign owner OK", assign.status === 200, `${assign.status} ${JSON.stringify(assign.json).slice(0, 120)}`);

  const ackInc = await api("POST", `/api/incidents/${incidentId}/actions`, { cookie: ownerCookie, body: { action: "ack" } });
  check("ack SLA incident OK", ackInc.status === 200, `${ackInc.status}`);

  const note = await api("POST", `/api/incidents/${incidentId}/actions`, { cookie: ownerCookie, body: { action: "note", body: "Đang kiểm tra với bên vận chuyển" } });
  check("thêm internal note OK", note.status === 200, `${note.status}`);

  const ev = await api("POST", `/api/incidents/${incidentId}/actions`, { cookie: ownerCookie, body: { action: "evidence", kind: "link", content: "https://evidence.example/1" } });
  check("thêm evidence OK", ev.status === 200, `${ev.status}`);

  const incDetail = await api("GET", `/api/incidents/${incidentId}`, { cookie: ownerCookie });
  check("incident detail có timeline + evidence", (incDetail.json?.timeline?.length ?? 0) >= 2 && (incDetail.json?.evidence?.length ?? 0) >= 2, JSON.stringify(incDetail.json).slice(0, 150));

  // ---------- 8. Draft + approval ----------
  console.log("\n— RESPONSE APPROVAL —");
  const tpls = await api("GET", `/api/response-templates?workspaceId=${wsId}`, { cookie: ownerCookie });
  const tpl = tpls.json?.items?.[0];
  check("GET templates có template seeded", Boolean(tpl));

  const draft = await api("POST", "/api/response-templates/drafts", {
    cookie: ownerCookie,
    body: {
      action: "create",
      workspaceId: wsId,
      incidentId,
      templateId: tpl?.id,
      title: `Smoke draft ${uniq}`,
      vars: { customer_name: "An", product_name: "Nova Serum" },
    },
  });
  const draftId = draft.json?.id;
  check("tạo draft từ template OK", draft.status === 201 && Boolean(draftId), `${draft.status} ${JSON.stringify(draft.json).slice(0, 150)}`);

  const reqAppr = await api("POST", "/api/response-templates/drafts", {
    cookie: ownerCookie,
    body: { action: "request-approval", workspaceId: wsId, draftId },
  });
  check("request approval OK", reqAppr.status === 201 || reqAppr.status === 200, `${reqAppr.status} ${JSON.stringify(reqAppr.json).slice(0, 150)}`);

  const approve = await api("POST", `/api/incidents/${incidentId}/approve-response`, {
    cookie: ownerCookie,
    body: { draftId, decision: "APPROVED" },
  });
  check("approve draft OK", approve.status === 200, `${approve.status} ${JSON.stringify(approve.json).slice(0, 150)}`);

  // ---------- 9. Resolve + report ----------
  console.log("\n— RESOLVE + REPORT —");
  const resolve = await api("POST", `/api/incidents/${incidentId}/actions`, { cookie: ownerCookie, body: { action: "resolve", resolution: "Đã hỗ trợ khách xong" } });
  check("resolve incident OK", resolve.status === 200, `${resolve.status}`);

  const closedCheck = await api("POST", `/api/incidents/${incidentId}/actions`, { cookie: ownerCookie, body: { action: "resolve" } });
  check("resolve lại incident đã RESOLVED bị chặn", closedCheck.status === 409 || closedCheck.status === 400, `got ${closedCheck.status}`);

  const end = await api("POST", `/api/live-events/${eventId}/status`, { cookie: ownerCookie, body: { action: "end" } });
  check("LIVE → ENDED", end.status === 200, `${end.status}`);

  const report = await api("GET", `/api/reports/${eventId}`, { cookie: ownerCookie });
  check("report trả metrics + demoData", report.json?.demoData === true && Boolean(report.json?.metrics), JSON.stringify(report.json).slice(0, 150));
  check("report có 3 recommended actions", (report.json?.recommendedActions?.length ?? 0) === 3);

  // ---------- 10. Simulator stop ----------
  console.log("\n— SIMULATOR STOP —");
  const stop = await api("POST", `/api/live-events/${eventId}/simulator`, { cookie: ownerCookie, body: { action: "stop" } });
  check("simulator stop OK", stop.status === 200, `${stop.status}`);
  await sleep(1000);
  const streamAfterStop = await api("GET", `/api/live-events/${eventId}/stream`, { cookie: ownerCookie });
  check("stream sau stop → sim stopped", streamAfterStop.json?.sim?.running === false, JSON.stringify(streamAfterStop.json?.sim).slice(0, 100));

  // ---------- Summary ----------
  console.log(`\n=== ${pass} PASS, ${failCount} FAIL ===`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Smoke crashed:", e);
  process.exit(1);
});
