import { prisma } from "@/lib/db";
import type { Platform } from "@/lib/constants";
import { ingestLiveMessage, runAlertRules } from "@/lib/crisis/simulator";

// ===== Platform Connector — bơm comment THẬT từ livestream vào pipeline phân loại =====
// TikTok:   tiktok-live-connector (unofficial WebSocket) — chỉ cần username của kênh đang live.
//           Username lấy từ linkstream URL người dùng dán (tiktok.com/@username/live).
// Facebook: Graph API polling comment của video đang phát (cần Page Access Token + videoId).
// Shopee/YouTube: chưa hỗ trợ (chỉ cảnh báo khi connect).
//
// Runtime giữ trong globalThis để dev-mode hot-reload không rò rỉ connection.

export type ConnectorState = {
  status: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  platform: Platform | null;
  source: string; // username TikTok hoặc videoId Facebook
  connectedAt: string | null;
  lastMessageAt: string | null;
  ingested: number;
  error: string | null;
};

type TikTokRuntime = {
  conn: unknown; // TikTokLiveConnection
  state: ConnectorState;
  lastAlertRulesAt: number;
  onMessage: ((m: { text: string; author: string; likes: number }) => void) | null;
};

const g = globalThis as unknown as { __connectorRegistry?: Map<string, TikTokRuntime> };
const registry: Map<string, TikTokRuntime> = (g.__connectorRegistry ??= new Map());

/** Trích username TikTok từ linkstream URL hoặc trả về nguyên văn nếu đã là username. */
export function parseTikTokUsername(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  // URL dạng: https://www.tiktok.com/@username/live hoặc tiktok.com/@user/live
  const urlMatch = v.match(/tiktok\.com\/@([\w.\-]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  // Chuỗi có khoảng trắng/ký tự lạ → không hợp lệ
  if (!/^@?[\w.\-]{2,30}$/.test(v)) return null;
  return v.replace(/^@/, "").toLowerCase();
}

/** Trích videoId Facebook từ URL watch/reel/live hoặc trả nguyên văn nếu là số id. */
export function parseFacebookVideoId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const patterns = [
    /facebook\.com\/(?:watch\/?\?v=|live\.php\?|[^/]+\/videos\/|reel\/)(\d{5,})/i,
    /fb\.watch\/[\w\-]+/i, // link rút gọn — không trích được id, báo user dùng link đầy đủ
  ];
  const m = v.match(patterns[0]);
  if (m) return m[1];
  if (/^\d{5,}$/.test(v)) return v;
  if (patterns[1].test(v)) return null; // fb.watch — cần link đầy đủ
  return null;
}

function safeParseStreamUrls(json: string): Record<string, string> {
  try {
    return JSON.parse(json || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function safeParseProducts(json: string | null): Array<{ category?: string }> {
  try {
    return json ? (JSON.parse(json) as Array<{ category?: string }>) : [];
  } catch {
    return [];
  }
}

export function getConnectorState(eventId: string): ConnectorState {
  return (
    registry.get(eventId)?.state ?? {
      status: "DISCONNECTED",
      platform: null,
      source: "",
      connectedAt: null,
      lastMessageAt: null,
      ingested: 0,
      error: null,
    }
  );
}

async function getCategory(eventId: string): Promise<string> {
  const e = await prisma.liveEvent.findUnique({ where: { id: eventId }, select: { products: true } });
  return safeParseProducts(e?.products ?? null)[0]?.category ?? "other";
}

/** Ingest + alert rules có throttle (alert query nặng — tối đa 1 lần/5s mỗi event). */
async function ingestWithThrottledAlerts(rt: TikTokRuntime, eventId: string, workspaceId: string, category: string, opts: { text: string; author: string; externalId: string; likes: number; platform: Platform }) {
  await ingestLiveMessage({
    eventId,
    externalId: opts.externalId,
    text: opts.text,
    platform: opts.platform,
    author: opts.author,
    category,
    likes: opts.likes,
  });
  rt.state.ingested += 1;
  rt.state.lastMessageAt = new Date().toISOString();
  const now = Date.now();
  if (now - rt.lastAlertRulesAt > 5_000) {
    rt.lastAlertRulesAt = now;
    await runAlertRules(eventId, workspaceId);
  }
}

/** Kết nối TikTok Live thật theo username (từ linkstream) hoặc tham số truyền vào. */
export async function connectTikTok(eventId: string, usernameInput?: string): Promise<ConnectorState> {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Không tìm thấy event");
  await disconnectConnector(eventId);

  const urls = safeParseStreamUrls(event.streamUrls);
  const username = parseTikTokUsername(usernameInput ?? urls.tiktok ?? "");
  if (!username) {
    const state: ConnectorState = {
      status: "ERROR",
      platform: "tiktok",
      source: "",
      connectedAt: null,
      lastMessageAt: null,
      ingested: 0,
      error: "Không tìm được username TikTok — dán link stream dạng tiktok.com/@username/live vào Linkstream rồi thử lại",
    };
    registry.set(eventId, { conn: null, state, lastAlertRulesAt: 0, onMessage: null });
    return state;
  }

  const { TikTokLiveConnection, WebcastEvent } = await import("tiktok-live-connector");
  const conn = new TikTokLiveConnection(username, { processInitialData: false });
  const rt: TikTokRuntime = {
    conn,
    state: { status: "CONNECTING", platform: "tiktok", source: `@${username}`, connectedAt: null, lastMessageAt: null, ingested: 0, error: null },
    lastAlertRulesAt: 0,
    onMessage: null,
  };
  registry.set(eventId, rt);

  const category = await getCategory(eventId);

  conn.on(WebcastEvent.CHAT, (data: unknown) => {
    try {
      const d = data as { user?: { nickname?: string; uniqueId?: string }; comment?: string; likes?: number };
      const text = d.comment ?? "";
      const author = d.user?.nickname || d.user?.uniqueId || "viewer";
      if (!text) return;
      void ingestWithThrottledAlerts(rt, eventId, event.workspaceId, category, {
        text,
        author,
        externalId: `tt-${username}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        likes: typeof d.likes === "number" ? d.likes : 0,
        platform: "tiktok",
      }).catch((e) => console.error("[connector/tiktok] ingest failed:", e));
    } catch (e) {
      console.error("[connector/tiktok] chat handler:", e);
    }
  });

  conn.on(WebcastEvent.STREAM_END, () => {
    rt.state.status = "DISCONNECTED";
    rt.state.error = "Stream TikTok đã kết thúc";
  });

  try {
    await conn.connect();
    rt.state.status = "CONNECTED";
    rt.state.connectedAt = new Date().toISOString();
  } catch (e) {
    rt.state.status = "ERROR";
    rt.state.error = e instanceof Error ? e.message : "Kết nối TikTok thất bại (username sai hoặc kênh không live)";
  }
  return rt.state;
}

/** Kết nối Facebook Live comments qua Graph API polling — cần accessToken + videoId. */
export async function connectFacebook(eventId: string, accessToken: string, videoIdInput?: string): Promise<ConnectorState> {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Không tìm thấy event");
  await disconnectConnector(eventId);

  const urls = safeParseStreamUrls(event.streamUrls);
  const videoId = parseFacebookVideoId(videoIdInput ?? urls.facebook ?? "");
  if (!videoId) {
    const state: ConnectorState = {
      status: "ERROR",
      platform: "facebook",
      source: "",
      connectedAt: null,
      lastMessageAt: null,
      ingested: 0,
      error: "Không trích được videoId Facebook — dùng link đầy đủ facebook.com/watch/?v=<id> hoặc <page>/videos/<id>",
    };
    registry.set(eventId, { conn: null, state, lastAlertRulesAt: 0, onMessage: null });
    return state;
  }

  // Kiểm tra token + video ngay khi connect
  const graph = `https://graph.facebook.com/v21.0/${videoId}/comments?fields=id,from,message,like_count,created_time&order=chronological&limit=25&access_token=${encodeURIComponent(accessToken)}`;
  let first: Response;
  try {
    first = await fetch(graph);
  } catch (e) {
    const state: ConnectorState = { status: "ERROR", platform: "facebook", source: videoId, connectedAt: null, lastMessageAt: null, ingested: 0, error: `Lỗi mạng khi gọi Graph API: ${e instanceof Error ? e.message : e}` };
    registry.set(eventId, { conn: null, state, lastAlertRulesAt: 0, onMessage: null });
    return state;
  }
  if (!first.ok) {
    const err = (await first.json().catch(() => ({}))) as { error?: { message?: string } };
    const state: ConnectorState = {
      status: "ERROR",
      platform: "facebook",
      source: videoId,
      connectedAt: null,
      lastMessageAt: null,
      ingested: 0,
      error: `Graph API ${first.status}: ${err.error?.message ?? "token hoặc videoId không hợp lệ"}`,
    };
    registry.set(eventId, { conn: null, state, lastAlertRulesAt: 0, onMessage: null });
    return state;
  }

  const rt: TikTokRuntime = {
    conn: null,
    state: { status: "CONNECTED", platform: "facebook", source: videoId, connectedAt: new Date().toISOString(), lastMessageAt: null, ingested: 0, error: null },
    lastAlertRulesAt: 0,
    onMessage: null,
  };
  registry.set(eventId, rt);
  const category = await getCategory(eventId);

  // Polling loop 5s — dừng khi event END/_DISCONNECT hoặc registry bị xoá
  void (async () => {
    let latestTime: string | null = null;
    while (registry.get(eventId) === rt) {
      try {
        const url = latestTime ? `${graph}&since=${encodeURIComponent(latestTime)}` : graph;
        const res = await fetch(url);
        if (res.ok) {
          const body = (await res.json()) as { data?: Array<{ id: string; message?: string; from?: { name?: string }; like_count?: number; created_time?: string }> };
          for (const c of body.data ?? []) {
            if (!c.message) continue;
            latestTime = c.created_time ?? latestTime;
            await ingestWithThrottledAlerts(rt, eventId, event.workspaceId, category, {
              text: c.message,
              author: c.from?.name ?? "viewer",
              externalId: `fb-${c.id}`,
              likes: c.like_count ?? 0,
              platform: "facebook",
            });
          }
        }
      } catch (e) {
        console.error("[connector/facebook] poll failed:", e);
      }
      await new Promise((r) => setTimeout(r, 5_000));
      const ev = await prisma.liveEvent.findUnique({ where: { id: eventId }, select: { status: true } });
      if (!ev || ev.status !== "LIVE") break;
    }
    if (registry.get(eventId) === rt) rt.state.status = "DISCONNECTED";
  })();

  return rt.state;
}

/** Ngắt kết nối + xoá registry. */
export async function disconnectConnector(eventId: string): Promise<void> {
  const rt = registry.get(eventId);
  if (rt?.conn && typeof (rt.conn as { disconnect?: () => Promise<void> }).disconnect === "function") {
    try {
      await (rt.conn as { disconnect: () => Promise<void> }).disconnect();
    } catch {
      // ignore
    }
  }
  registry.delete(eventId);
}
