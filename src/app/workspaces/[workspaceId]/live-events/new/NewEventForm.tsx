"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Brand = { id: string; name: string };
type Campaign = { id: string; name: string; brandId: string };
type Member = { user: { id: string; name: string | null; email: string } };
type Playbook = { id: string; name: string; description: string | null };

const STEPS = ["Cơ bản", "Nền tảng & rủi ro", "Xác nhận"];

// Đồng bộ với PRODUCT_CATEGORIES ở src/lib/constants.ts + meta hiển thị ở src/lib/crisis/categories.ts
const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "cosmetics", label: "Mỹ phẩm / Làm đẹp" },
  { value: "food", label: "Thực phẩm / Đồ uống" },
  { value: "supplement", label: "Thực phẩm chức năng" },
  { value: "fashion", label: "Thời trang" },
  { value: "electronics", label: "Điện tử / Công nghệ" },
  { value: "home", label: "Gia dụng / Nội thất" },
  { value: "mother_baby", label: "Mẹ & Bé" },
  { value: "other", label: "Khác" },
];

const PLATFORM_META: Record<string, { label: string; cls: string }> = {
  facebook: { label: "Facebook", cls: "pf-facebook" },
  tiktok: { label: "TikTok", cls: "pf-tiktok" },
  shopee: { label: "Shopee Live", cls: "pf-shopee" },
  youtube: { label: "YouTube", cls: "pf-youtube" },
};

export default function NewEventForm({
  workspaceId,
  brands,
  campaigns,
  members,
  playbooks,
}: {
  workspaceId: string;
  brands: Brand[];
  campaigns: Campaign[];
  members: Member[];
  playbooks: Playbook[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [hostUserId, setHostUserId] = useState(members[0]?.user.id ?? "");
  // Sản phẩm dạng list: mỗi dòng 1 mặt hàng + ngành hàng riêng → classifier/simulator nhận đúng claim đặc thù
  const [products, setProducts] = useState<Array<{ name: string; offer: string; category: string }>>([
    { name: "", offer: "", category: "other" },
  ]);
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  // Linkstream: URL phát trực tiếp cho từng nền tảng (kiểm soát xem/tối/NĐT)
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});
  const [riskKeywords, setRiskKeywords] = useState("giao hàng chậm, hàng giả, hoàn tiền");
  const [playbookId, setPlaybookId] = useState<string | null>(playbooks[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCampaigns = useMemo(
    () => campaigns.filter((c) => c.brandId === brandId),
    [campaigns, brandId],
  );

  const keywords = riskKeywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const cleanProducts = products
    .map((p) => ({ name: p.name.trim().slice(0, 120), offer: p.offer.trim().slice(0, 200), category: p.category }))
    .filter((p) => p.name.length > 0);

  const canNext = step === 0 ? name.trim().length >= 3 && !!brandId : platforms.length > 0;

  function updateStreamUrl(platform: string, url: string) {
    setStreamUrls((prev) => ({ ...prev, [platform]: url }));
  }

  function updateProduct(idx: number, patch: Partial<{ name: string; offer: string; category: string }>) {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addProduct() {
    setProducts((prev) => [...prev, { name: "", offer: "", category: "other" }]);
  }
  function removeProduct(idx: number) {
    setProducts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brandId,
          campaignId: campaignId || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          platforms,
          streamUrls: Object.fromEntries(
            Object.entries(streamUrls).filter(([, u]) => u.trim() !== ""),
          ),
          products: cleanProducts.length > 0 ? cleanProducts : null,
          playbookId: playbookId || null,
          riskKeywords: keywords,
          hostUserId: hostUserId || null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `Lỗi ${res.status}`);
      router.push(`/workspaces/${workspaceId}/live-events/${body.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight mb-3">Tạo live event</h1>
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 text-[12.5px] font-semibold ${i <= step ? "" : "text-faint"} ${i < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className="w-[22px] h-[22px] grid place-items-center rounded-full text-[11px]"
                  style={{
                    background: i <= step ? "var(--gradient-brand)" : "var(--surface-2)",
                    border: i > step ? "1px solid var(--border)" : "none",
                    color: i <= step ? "#06121f" : "var(--text-dim)",
                  }}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-[var(--border)]" />}
            </div>
          ))}
        </div>
      </div>

      <div className="surface card-hover p-5">
        {step === 0 && (
          <div className="space-y-4">
            <label className="field">
              <span className="label">Tên livestream *</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Big Sale 9.9 — Beauty Livestream"
                autoFocus
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="field">
                <span className="label">Brand *</span>
                <select className="input" value={brandId} onChange={(e) => { setBrandId(e.target.value); setCampaignId(""); }}>
                  {brands.length === 0 && <option value="">— Chưa có brand —</option>}
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Campaign</span>
                <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">— Không gắn campaign —</option>
                  {filteredCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="field">
                <span className="label">Ngày giờ phát</span>
                <input type="datetime-local" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Host / Producer phụ trách</span>
                <select className="input" value={hostUserId} onChange={(e) => setHostUserId(e.target.value)}>
                  <option value="">— Chưa chọn —</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name ?? m.user.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field">
              <span className="label">Sản phẩm / offer (mỗi dòng 1 mặt hàng)</span>
              <div className="space-y-2">
                {products.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      className="input flex-1"
                      value={p.name}
                      onChange={(e) => updateProduct(idx, { name: e.target.value })}
                      placeholder="Tên sản phẩm, VD: Serum vitamin C 20%"
                    />
                    <input
                      className="input w-40"
                      value={p.offer}
                      onChange={(e) => updateProduct(idx, { offer: e.target.value })}
                      placeholder="Offer (VD: giảm 40%)"
                    />
                    <select
                      className="input w-48"
                      value={p.category}
                      onChange={(e) => updateProduct(idx, { category: e.target.value })}
                      aria-label="Ngành hàng"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeProduct(idx)}
                      disabled={products.length === 1}
                      aria-label="Xoá dòng sản phẩm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost text-[12.5px]" onClick={addProduct}>
                  + Thêm mặt hàng
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="field">
              <span className="label">Nền tảng phát *</span>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(PLATFORM_META).map(([key, meta]) => {
                  const active = platforms.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlatforms((p) => (active ? p.filter((x) => x !== key) : [...p, key]))}
                      className={`btn ${active ? "btn-primary" : "btn-ghost"} text-[12.5px]`}
                    >
                      <span className={`platform-dot ${meta.cls}`} style={{ width: 8, height: 8 }} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {platforms.length > 0 && (
              <div className="field">
                <span className="label">Linkstream (URL phát cho từng nền tảng)</span>
                <div className="space-y-2">
                  {platforms.map((pf) => (
                    <div key={pf} className="flex gap-2 items-center">
                      <span className={`platform-dot ${PLATFORM_META[pf]?.cls ?? ""}`} style={{ width: 8, height: 8 }} />
                      <span className="text-[12.5px] w-24 shrink-0 text-dim">{PLATFORM_META[pf]?.label ?? pf}</span>
                      <input
                        className="input flex-1"
                        value={streamUrls[pf] ?? ""}
                        onChange={(e) => updateStreamUrl(pf, e.target.value)}
                        placeholder={`https://${pf === "shopee" ? "live.shopee.vn/..." : pf + ".com/..."} (tuỳ chọn)`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-faint text-[11.5px] mt-1.5">Tuỳ chọn — dán link stream để đội giám sát mở trực tiếp. Có thể thêm/sửa sau ở trang chi tiết event.</p>
              </div>
            )}
            <label className="field">
              <span className="label">Risk keywords (phân tách bằng dấu phẩy)</span>
              <input className="input" value={riskKeywords} onChange={(e) => setRiskKeywords(e.target.value)} placeholder="giao hàng chậm, hàng giả, hoàn tiền..." />
            </label>
            <div className="field">
              <span className="label">Playbook áp dụng</span>
              {playbooks.length === 0 ? (
                <p className="text-dim text-[12.5px]">Chưa có playbook trong workspace.</p>
              ) : (
                <div className="space-y-2">
                  {playbooks.map((p) => {
                    const active = playbookId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlaybookId(active ? null : p.id)}
                        className={`w-full text-left p-3 rounded-[10px] border text-[13px] transition-colors ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        <div className="font-semibold flex items-center gap-2">
                          {active && <span className="text-ok">✓</span>}
                          {p.name}
                        </div>
                        {p.description && <div className="text-dim text-[12px] mt-0.5">{p.description}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-[13px] text-dim mb-4">Kiểm tra lại thông tin trước khi tạo:</div>
            <Row label="Tên" value={name} />
            <Row label="Brand" value={brands.find((b) => b.id === brandId)?.name ?? "—"} />
            <Row label="Campaign" value={campaigns.find((c) => c.id === campaignId)?.name ?? "—"} />
            <Row label="Thời gian" value={scheduledAt ? new Date(scheduledAt).toLocaleString("vi-VN") : "—"} />
            <Row label="Nền tảng" value={platforms.join(", ")} />
            <Row
              label="Linkstream"
              value={Object.entries(streamUrls)
                .filter(([, u]) => u.trim() !== "")
                .map(([p, u]) => `${p}: ${u}`)
                .join(" · ") || "—"}
            />
            <Row label="Sản phẩm" value={cleanProducts.map((p) => `${p.name} (${CATEGORY_OPTIONS.find((c) => c.value === p.category)?.label ?? p.category})`).join(", ")} />
            <Row label="Risk keywords" value={keywords.join(", ") || "—"} />
            <Row label="Playbook" value={playbooks.find((p) => p.id === playbookId)?.name ?? "—"} />
            <Row
              label="Host"
              value={members.find((m) => m.user.id === hostUserId)?.user.name ?? (hostUserId ? (members.find((m) => m.user.id === hostUserId)?.user.email ?? "—") : "—")}
            />
            <div className="callout callout-info mt-4">
              Event sẽ được tạo ở trạng thái <b>DRAFT</b>. Hoàn tất readiness checklist rồi chuyển sang READY / LIVE.
            </div>
          </div>
        )}

        {error && <div className="callout callout-danger mt-4">{error}</div>}

        <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button className="btn btn-ghost" onClick={() => (step === 0 ? router.back() : setStep(step - 1))} disabled={busy}>
            {step === 0 ? "Huỷ" : "← Quay lại"}
          </button>
          {step < 2 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Tiếp tục →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
              {busy ? "Đang tạo..." : "Tạo event"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 text-[13px] py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-faint">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}