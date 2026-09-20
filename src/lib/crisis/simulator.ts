import { prisma } from "@/lib/db";
import { SIM_MAX_LIFETIME_TICKS, SIM_TICK_MS } from "@/lib/constants";
import type { Priority, RiskType } from "@/lib/constants";
import { RuleBasedClassifier, dedupeKey } from "@/lib/crisis/classifier";
import { computePriority } from "@/lib/crisis/priority";
import { SCENARIOS, currentPhase, messagesForTick, type ScenarioId } from "@/lib/crisis/scenario";

// DemoStreamSimulator — chạy kịch bản demo CỐ ĐỊNH (scripted) tái hiện case
// thật (mặc định: O sầu riêng 10/2024). KHÔNG còn ngẫu nhiên: cùng tick → cùng
// message, cùng tác giả — demo đọc như câu chuyện có mở đầu-cao trào-kết.
// CHỈ chạy in-process; restart server → timer mất, DB simState được đối chiếu lại (reconcile).
// TODO(connector): thay bằng connector nền tảng thật, giữ nguyên interface start/pause/resume/stop.

type SimRuntime = { timer: ReturnType<typeof setInterval> | null; tick: number; startedAt: number };

const g = globalThis as unknown as { __simRegistry?: Map<string, SimRuntime> };
const registry: Map<string, SimRuntime> = (g.__simRegistry ??= new Map());

const classifier = new RuleBasedClassifier();

// Ingest 1 message vào pipeline phân loại + signal — DÙNG CHUNG cho simulator & connector thật.
// externalId phải unique trong event (đã có @@unique(eventId, externalId)) — connector dùng id gốc
// của nền tảng, simulator dùng sim-<tick>-<idx>.
export async function ingestLiveMessage(opts: {
  eventId: string;
  externalId: string;
  text: string;
  platform: string;
  author: string;
  category: string;
  likes?: number;
  simTick?: number;
}) {
  const { eventId, externalId, text, platform, author, category, likes = 0, simTick = 0 } = opts;
  const cls = await classifier.classify({
    externalId,
    platform: platform as Parameters<typeof classifier.classify>[0]["platform"],
    rawText: text,
    authorName: author,
    category,
  });
  const dkey = dedupeKey(platform as Parameters<typeof dedupeKey>[0], text, author);
  const dupe = await prisma.message.findFirst({ where: { eventId, dedupeKey: dkey } });
  if (dupe) return { dupe: true as const, cls };

  const msg = await prisma.message.create({
    data: {
      eventId,
      externalId,
      platform,
      authorName: author,
      rawText: text,
      topic: cls.topic,
      riskType: cls.riskType,
      sentiment: cls.sentiment,
      dedupeKey: dkey,
      simTick,
      engagement: JSON.stringify({ likes, replies: 0, shares: 0 }),
    },
  });

  // Signal grouping: gộp message cùng topic trong cửa sổ 2 phút
  const windowStart = new Date(Date.now() - 2 * 60_000);
  const signal = await prisma.signal.findFirst({
    where: { eventId, topic: cls.topic, lastMessageAt: { gte: windowStart } },
    orderBy: { lastMessageAt: "desc" },
  });
  if (signal) {
    const count = signal.messageCount + 1;
    const minutes = Math.max(0.25, (Date.now() - signal.firstMessageAt.getTime()) / 60_000);
    await prisma.signal.update({
      where: { id: signal.id },
      data: { messageCount: count, velocity: Math.round(count / minutes), lastMessageAt: new Date() },
    });
    await prisma.message.update({ where: { id: msg.id }, data: { signalId: signal.id } });
  } else {
    const s = await prisma.signal.create({
      data: { eventId, topic: cls.topic, riskType: cls.riskType, firstMessageAt: new Date() },
    });
    await prisma.message.update({ where: { id: msg.id }, data: { signalId: s.id } });
  }
  return { dupe: false as const, cls, msg };
}

// Tạo/nâng cấp alert cho risk đang hoạt động (không tạo trùng alert OPEN cùng riskType)
async function maybeAlert(opts: {
  eventId: string;
  workspaceId: string;
  risk: RiskType;
  recentCount: number;
  velocity: number;
  negativeRatio: number;
  title: string;
  reason: string;
}) {
  const { eventId, workspaceId, risk, recentCount, velocity, negativeRatio, title, reason } = opts;
  const sameRisk = await prisma.alert.findFirst({
    where: { eventId, title: { startsWith: `[${risk}]` }, status: { in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] } },
  });
  if (sameRisk) {
    await prisma.alert.update({
      where: { id: sameRisk.id },
      data: { evidenceCount: { increment: recentCount }, velocity },
    });
    return null;
  }
  const policy = await prisma.policyRule.findFirst({
    where: { workspaceId, riskType: risk, enabled: true },
  });
  const priority = computePriority({
    riskType: risk,
    velocity,
    evidenceCount: recentCount,
    sentimentNegativeRatio: negativeRatio,
    policyPriority: (policy?.priority as Priority) ?? null,
  });
  const signal = await prisma.signal.findFirst({
    where: { eventId, riskType: risk },
    orderBy: { lastMessageAt: "desc" },
  });
  return prisma.alert.create({
    data: {
      eventId,
      signalId: signal?.id ?? null,
      title: `[${risk}] ${title}`,
      priority,
      severity: priority,
      reason,
      evidenceCount: recentCount,
      velocity,
      policyMatch: policy?.name ?? null,
    },
  });
}

async function runTick(eventId: string) {
  const rt = registry.get(eventId);
  if (!rt) return;
  rt.tick += 1;
  const tick = rt.tick;
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status !== "LIVE") {
    await stopSimulator(eventId);
    return;
  }
  if (event.simState === "PAUSED") {
    // Tick đang bay lúc pause — bỏ qua tick này, KHÔNG stop (tránh race kill simulator)
    return;
  }
  if (event.simState !== "RUNNING") {
    await stopSimulator(eventId);
    return;
  }
  if (tick > SIM_MAX_LIFETIME_TICKS) {
    await prisma.liveEvent.update({ where: { id: eventId }, data: { simState: "STOPPED" } });
    await stopSimulator(eventId);
    return;
  }

  // Kịch bản demo cố định: category/productHint lấy từ kịch bản (fallback theo sản phẩm event)
  const scenarioId = (event.simScenario as ScenarioId) in SCENARIOS ? (event.simScenario as ScenarioId) : "o_sau_rieng";
  const meta = SCENARIOS[scenarioId];
  const products = safeParseProducts(event.products);
  const category = products[0]?.category ?? meta.category;
  const productHint = (products[0]?.name ?? meta.productHint).toLowerCase();

  const msgs = messagesForTick(tick, scenarioId, productHint);
  for (const [i, m] of msgs.entries()) {
    await ingestLiveMessage({
      eventId,
      externalId: `sim-${tick}-${i}`,
      text: m.text,
      platform: m.platform,
      author: m.author,
      category,
      likes: (tick * 7 + i * 3) % 25, // likes tất định theo tick (không random)
      simTick: tick,
    });
  }

  await runAlertRules(eventId, event.workspaceId);

  await prisma.liveEvent.update({ where: { id: eventId }, data: { simTick: tick } });
}

// Alert rules dùng chung: delivery burst, claim doubt, vạ mồm, spam, volume spike.
// Connector thật gọi sau mỗi lần ingest (throttle trong connector); simulator gọi mỗi tick.
export async function runAlertRules(eventId: string, workspaceId: string) {
  // Velocity theo risk từ DB (messages 2 phút gần nhất)
  const since = new Date(Date.now() - 2 * 60_000);
  const recent = await prisma.message.groupBy({
    by: ["riskType", "sentiment"],
    where: { eventId, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const totalRecent = recent.reduce((s, r) => s + r._count._all, 0);
  const countRisk = (risk: RiskType) =>
    recent.filter((r) => r.riskType === risk).reduce((s, r) => s + r._count._all, 0);

  // Alert rules: delivery burst, claim doubt, spam, volume spike
  const deliveryRecent = countRisk("delivery");
  if (deliveryRecent >= 3) {
    await maybeAlert({
      eventId,
      workspaceId,
      risk: "delivery",
      recentCount: deliveryRecent,
      velocity: Math.round(deliveryRecent / 2),
      negativeRatio: 1,
      title: "Bùng phát khiếu nại giao hàng",
      reason: `${deliveryRecent} complaint giao hàng trong 2 phút — vượt ngưỡng burst`,
    });
  }
  const claimRecent = countRisk("product_claim");
  if (claimRecent >= 2) {
    await maybeAlert({
      eventId,
      workspaceId,
      risk: "product_claim",
      recentCount: claimRecent,
      velocity: claimRecent,
      negativeRatio: 0.8,
      title: "Nghi ngờ claim sản phẩm",
      reason: `${claimRecent} câu hỏi/nghi ngờ về chứng nhận & cam kết sản phẩm`,
    });
  }
  // Phát ngôn host/KOL ('vạ mồm'): người xem trích lời xúc phạm/cam kết sai — ngưỡng thấp
  // vì 1–2 bình luận lan truyền đã đủ gây khủng hoảng niềm tin (bài học case O sầu riêng 10/2024).
  const hostRecent = countRisk("host_statement");
  if (hostRecent >= 1) {
    await maybeAlert({
      eventId,
      workspaceId,
      risk: "host_statement",
      recentCount: hostRecent,
      velocity: hostRecent,
      negativeRatio: 1,
      title: "Phát ngôn host/KOL gây tranh cãi (vạ mồm)",
      reason: `${hostRecent} bình luận trích dẫn/lên án phát ngôn của host hoặc khách mời trong live`,
    });
  }
  const spamRecent = countRisk("spam");
  if (spamRecent >= 3) {
    await maybeAlert({
      eventId,
      workspaceId,
      risk: "spam",
      recentCount: spamRecent,
      velocity: spamRecent,
      negativeRatio: 0,
      title: "Spam link lặp lại",
      reason: `${spamRecent} message spam trùng nội dung — đã dedupe`,
    });
  }
  if (totalRecent >= 15) {
    const normal = countRisk("none");
    if (normal >= 10) {
      await maybeAlert({
        eventId,
        workspaceId,
        risk: "volume_spike",
        recentCount: totalRecent,
        velocity: Math.round(totalRecent / 2),
        negativeRatio: 0,
        title: "Volume cao bất thường (bình luận tích cực)",
        reason: `${totalRecent} messages/2 phút — chủ đạo là topic bình thường`,
      });
    }
  }
}

export async function startSimulator(eventId: string, opts?: { scenario?: ScenarioId; restart?: boolean }) {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.status !== "LIVE") throw new Error("Event chưa LIVE — hãy Start event trước");
  await stopSimulator(eventId);
  // Chọn kịch bản: opts > đang lưu trong event > mặc định (o_sau_rieng)
  const scenarioId =
    opts?.scenario && opts.scenario in SCENARIOS
      ? opts.scenario
      : event.simScenario && event.simScenario in SCENARIOS
        ? (event.simScenario as ScenarioId)
        : "o_sau_rieng";
  const restart = opts?.restart ?? false;
  const startTick = restart ? 0 : event.simTick;
  const rt: SimRuntime = { timer: null, tick: startTick, startedAt: Date.now() };
  registry.set(eventId, rt);
  rt.timer = setInterval(() => {
    void runTick(eventId).catch((e) => console.error("[simulator] tick failed:", e));
  }, SIM_TICK_MS);
  await prisma.liveEvent.update({ where: { id: eventId }, data: { simState: "RUNNING", simScenario: scenarioId, simTick: startTick } });
  return { state: "RUNNING" as const, scenario: scenarioId };
}

export async function pauseSimulator(eventId: string) {
  const rt = registry.get(eventId);
  if (rt?.timer) clearInterval(rt.timer);
  if (rt) rt.timer = null;
  await prisma.liveEvent.updateMany({ where: { id: eventId, simState: "RUNNING" }, data: { simState: "PAUSED" } });
  return { state: "PAUSED" as const };
}

export async function resumeSimulator(eventId: string) {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.simState !== "PAUSED") throw new Error("Simulator không ở trạng thái PAUSED");
  // Tiếp tục từ tick đã lưu trong DB — KHÔNG reset về 0
  await stopSimulator(eventId);
  const rt: SimRuntime = { timer: null, tick: event.simTick, startedAt: Date.now() };
  registry.set(eventId, rt);
  rt.timer = setInterval(() => {
    void runTick(eventId).catch((e) => console.error("[simulator] tick failed:", e));
  }, SIM_TICK_MS);
  await prisma.liveEvent.update({ where: { id: eventId }, data: { simState: "RUNNING" } });
  return { state: "RUNNING" as const };
}

export async function stopSimulator(eventId: string) {
  const rt = registry.get(eventId);
  if (rt?.timer) clearInterval(rt.timer);
  registry.delete(eventId);
  await prisma.liveEvent.updateMany({ where: { id: eventId }, data: { simState: "STOPPED" } });
  return { state: "STOPPED" as const };
}

// Reconcile: DB nói RUNNING nhưng timer không còn (server restart) → đánh dấu PAUSED
export async function getSimulatorState(eventId: string) {
  const event = await prisma.liveEvent.findUnique({
    where: { id: eventId },
    select: { simState: true, simTick: true, dataMode: true, status: true, simScenario: true },
  });
  if (!event) throw new Error("Event not found");
  const alive = registry.get(eventId)?.timer != null;
  if (event.simState === "RUNNING" && !alive) {
    await prisma.liveEvent.update({ where: { id: eventId }, data: { simState: "PAUSED" } });
    return {
      state: "PAUSED" as const,
      tick: event.simTick,
      dataMode: event.dataMode,
      scenario: event.simScenario,
      recovered: true,
    };
  }
  return {
    state: event.simState as "RUNNING" | "PAUSED" | "STOPPED",
    tick: event.simTick,
    dataMode: event.dataMode,
    scenario: event.simScenario,
    recovered: false,
  };
}

export function isSimulatorAlive(eventId: string) {
  return registry.get(eventId)?.timer != null;
}

function safeParseProducts(json: string | null): Array<{ name?: string; category?: string }> {
  try {
    const arr = JSON.parse(json ?? "[]") as Array<{ name?: string; category?: string }>;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export { currentPhase };
