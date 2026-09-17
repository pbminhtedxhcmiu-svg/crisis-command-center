import { prisma } from "@/lib/db";
import { SIM_MAX_LIFETIME_TICKS, SIM_MESSAGES_PER_TICK, SIM_TICK_MS } from "@/lib/constants";
import type { Platform, Priority, RiskType } from "@/lib/constants";
import { RuleBasedClassifier, dedupeKey } from "@/lib/crisis/classifier";
import { computePriority } from "@/lib/crisis/priority";
import { categoryMeta } from "@/lib/crisis/categories";

// DemoStreamSimulator — sinh message theo kịch bản seed cố định (ổn định cho test).
// CHỈ chạy in-process; restart server → timer mất, DB simState được đối chiếu lại (reconcile).
// TODO(connector): thay bằng connector nền tảng thật, giữ nguyên interface start/pause/resume/stop.

type SimRuntime = { timer: ReturnType<typeof setInterval> | null; tick: number; startedAt: number };

const g = globalThis as unknown as { __simRegistry?: Map<string, SimRuntime> };
const registry: Map<string, SimRuntime> = (g.__simRegistry ??= new Map());

const classifier = new RuleBasedClassifier();

// ---- Seeded PRNG (mulberry32) — seed cố định => kịch bản lặp lại được ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = ["Minh", "Lan", "Hùng", "Thảo", "Nam", "Oanh", "Dũng", "Ngọc", "Tuấn", "Mai", "Long", "Hà"];
const PLATFORMS_POOL: Platform[] = ["facebook", "tiktok", "shopee"];

function authorFor(rand: () => number) {
  const name = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  return `${name} ${String.fromCharCode(65 + Math.floor(rand() * 26))}.`;
}

// ---- Kịch bản: mỗi tick sinh messages theo "scene" (đã nén để burst sớm) ----
type Scene = { fromTick: number; toTick: number; texts: string[] };

// Scene 4 (nghi vấn claim) sinh động theo ngành hàng của event — phục vụ nhiều mặt hàng.
function claimSceneFor(category: string, productHint: string): Scene {
  const meta = categoryMeta(category);
  const [b1, b2] = [meta.claimBenefits[0] ?? "cam kết đặc biệt", meta.claimBenefits[1] ?? "cam kết chất lượng"];
  return {
    fromTick: 8,
    toTick: 12,
    texts: [
      `${productHint} có chứng nhận kiểm định không vậy?`,
      `Nghe nói ${productHint} bị ${meta.claimDoubts[0] ?? "không rõ nguồn gốc"}, thật không?`,
      "Hàng giả nhiều lắm, làm sao phân biệt?",
      `Quảng cáo ${b1} là lừa đảo không?`,
      `Có ai kiểm định chứng nhận ${meta.authority} chưa ạ?`,
      `Bạn nào dùng thấy ${b2} chưa? Tôi nghi lắm.`,
    ],
  };
}

function buildScript(category: string, productHint: string): Scene[] {
  return [
    // 1) Comment hỏi giá (normal)
    { fromTick: 1, toTick: 4, texts: ["Sản phẩm này giá bao nhiêu ạ?", `Cho em hỏi giá ${productHint} với ạ`, "Giá tiền bao nhiêu vậy shop?", "Có phí ship không ạ?"] },
    // 2) Hỏi vận chuyển (normal)
    { fromTick: 3, toTick: 6, texts: ["Order khi nào nhận được ạ?", "Cho hỏi vận chuyển Hà Nội bao lâu?", "Phí ship về tỉnh bao nhiêu ạ?", "Ship về Đà Nẵng mấy ngày ạ?"] },
    // 3) Burst complaint giao hàng → ALERT sớm (tick 5)
    { fromTick: 5, toTick: 9, texts: ["Đặt 2 tuần rồi chưa nhận được hàng", "Đơn của tôi giao trễ quá lâu rồi", "Hàng giao sai mẫu, cần đổi trả gấp", "Shipper giao trễ, không ai trả lời", "Chưa nhận được hàng mà đơn đã closed", "Giao trễ 10 ngày rồi, khi nào có hàng?", "Đơn thất lạc rồi shop ơi, xử lý giúp em", "Trả hàng rồi mà chưa được hoàn tiền"] },
    // 4) Nghi ngờ claim sản phẩm — risk cao, sinh theo ngành hàng
    claimSceneFor(category, productHint),
    // 5) Spam/duplicate (dedupe)
    { fromTick: 11, toTick: 14, texts: ["Kiếm tiền online click link ngay: http://bit.ly/zzz", "Kiếm tiền online click link ngay: http://bit.ly/zzz", "Kiếm tiền online click link ngay: http://bit.ly/zzz"] },
    // 6) Topic bình thường nhưng volume cao → volume_spike
    { fromTick: 14, toTick: 20, texts: ["Đẹp quá shop ơi", `Sản phẩm dùng tốt thật sự ạ`, "Yêu shop, ủng hộ chủ shop", "Chất lượng tuyệt vời, đã mua lần 3", "Đẹp quá, chốt đơn ngay", "Hay quá, cho em 1 đơn", "Tuyệt vời, cho em xin mã giảm giá", "Ủng hộ shop nhiều nhé", "Good too good, love this", "Mai còn live không shop?", `Đơn ${productHint} chạy ok lắm mọi người ơi`, "Da em cải thiện rõ sau 2 tuần"] },
  ];
}

function textsForTick(tick: number, script: Scene[]): string[] {
  const scenes = script.filter((s) => tick >= s.fromTick && tick <= s.toTick);
  const out: string[] = [];
  for (const s of scenes) {
    out.push(s.texts[(tick + out.length) % s.texts.length]);
  }
  // nền: message "other" thường lệ để feed không trống
  const AMBIENT = ["Live hôm nay nhiều deal quá ạ", "Xin mã giảm giá với ạ", "Cho em xem lại phần demo sản phẩm"];
  while (out.length < SIM_MESSAGES_PER_TICK) {
    out.push(AMBIENT[(tick + out.length) % AMBIENT.length]);
  }
  return out.slice(0, SIM_MESSAGES_PER_TICK);
}

async function ingestMessage(opts: {
  eventId: string;
  tick: number;
  text: string;
  platform: Platform;
  author: string;
  category: string;
  rand: () => number;
}) {
  const { eventId, tick, text, platform, author, category, rand } = opts;
  const cls = await classifier.classify({
    externalId: `sim-${tick}-${rand().toString(36).slice(2, 8)}`,
    platform,
    rawText: text,
    authorName: author,
    category,
  });
  const dkey = dedupeKey(platform, text, author);
  const dupe = await prisma.message.findFirst({ where: { eventId, dedupeKey: dkey } });
  if (dupe) return { dupe: true as const, cls };

  const msg = await prisma.message.create({
    data: {
      eventId,
      externalId: `sim-${tick}-${rand().toString(36).slice(2, 8)}`,
      platform,
      authorName: author,
      rawText: text,
      topic: cls.topic,
      riskType: cls.riskType,
      sentiment: cls.sentiment,
      dedupeKey: dkey,
      simTick: tick,
      engagement: JSON.stringify({ likes: Math.floor(rand() * 20), replies: 0, shares: 0 }),
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

  const seed = event.simSeed;
  const rand = mulberry32(seed * 7919 + tick);
  // Ngành hàng của event → kịch bản demo + từ khoá claim đặc thù ngành
  const products = safeParseProducts(event.products);
  const category = products[0]?.category ?? "other";
  const productHint = (products[0]?.name ?? "sản phẩm").toLowerCase();
  const script = buildScript(category, productHint);
  const texts = textsForTick(tick, script);

  for (const text of texts) {
    const platform = PLATFORMS_POOL[Math.floor(rand() * PLATFORMS_POOL.length)];
    const author = authorFor(rand);
    await ingestMessage({ eventId, tick, text, platform, author, category, rand });
  }

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
      workspaceId: event.workspaceId,
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
      workspaceId: event.workspaceId,
      risk: "product_claim",
      recentCount: claimRecent,
      velocity: claimRecent,
      negativeRatio: 0.8,
      title: "Nghi ngờ claim sản phẩm",
      reason: `${claimRecent} câu hỏi/nghi ngờ về chứng nhận & cam kết sản phẩm`,
    });
  }
  const spamRecent = countRisk("spam");
  if (spamRecent >= 3) {
    await maybeAlert({
      eventId,
      workspaceId: event.workspaceId,
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
        workspaceId: event.workspaceId,
        risk: "volume_spike",
        recentCount: totalRecent,
        velocity: Math.round(totalRecent / 2),
        negativeRatio: 0,
        title: "Volume cao bất thường (bình luận tích cực)",
        reason: `${totalRecent} messages/2 phút — chủ đạo là topic bình thường`,
      });
    }
  }

  await prisma.liveEvent.update({ where: { id: eventId }, data: { simTick: tick } });
}

export async function startSimulator(eventId: string) {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  if (event.status !== "LIVE") throw new Error("Event chưa LIVE — hãy Start event trước");
  await stopSimulator(eventId);
  const rt: SimRuntime = { timer: null, tick: 0, startedAt: Date.now() };
  registry.set(eventId, rt);
  rt.timer = setInterval(() => {
    void runTick(eventId).catch((e) => console.error("[simulator] tick failed:", e));
  }, SIM_TICK_MS);
  await prisma.liveEvent.update({ where: { id: eventId }, data: { simState: "RUNNING" } });
  return { state: "RUNNING" as const };
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
    select: { simState: true, simTick: true, dataMode: true, status: true },
  });
  if (!event) throw new Error("Event not found");
  const alive = registry.get(eventId)?.timer != null;
  if (event.simState === "RUNNING" && !alive) {
    await prisma.liveEvent.update({ where: { id: eventId }, data: { simState: "PAUSED" } });
    return { state: "PAUSED" as const, tick: event.simTick, dataMode: event.dataMode, recovered: true };
  }
  return {
    state: event.simState as "RUNNING" | "PAUSED" | "STOPPED",
    tick: event.simTick,
    dataMode: event.dataMode,
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
