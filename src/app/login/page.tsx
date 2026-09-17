"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Demo prefill CHỈ ở dev — bản phát hành production không lộ tài khoản mẫu
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(SHOW_DEMO_ACCOUNTS ? "owner@nova.demo" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Đăng nhập thất bại");
        return;
      }
      const me = await fetch("/api/auth/me").then((r) => r.json());
      const ws = me.workspaces?.[0]?.id;
      router.push(ws ? `/workspaces/${ws}/live-events` : "/login");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 mx-auto mb-3 rounded-2xl grid place-items-center text-[22px]"
            style={{ background: "var(--gradient-brand)", color: "#06121f" }}
          >
            ⛑
          </div>
          <h1 className="text-lg font-bold tracking-tight">Livestream Crisis Command Center</h1>
          <p className="text-dim text-[12.5px] mt-1">Đăng nhập để vận hành livestream</p>
        </div>

        <div className="surface card-hover p-6">
          <form onSubmit={submit} className="space-y-4">
            <label className="field">
              <span className="label">Email</span>
              <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span className="label">Mật khẩu</span>
              <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && (
              <div role="alert" className="callout callout-danger text-[12.5px]">{error}</div>
            )}
            <button className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
          <p className="text-dim text-[12.5px] mt-4">
            Chưa có tài khoản? <Link className="link" href="/register">Đăng ký</Link>
          </p>
        </div>

        {SHOW_DEMO_ACCOUNTS && (
          <div className="surface-2 mt-4 p-3.5 text-[11.5px] text-dim leading-relaxed">
            <b className="text-faint text-[10.5px] tracking-wide">DEMO ACCOUNTS</b> (mật khẩu: crisis2026)
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["owner", "crisis_lead", "brand_mgr", "moderator", "cs", "legal", "exec_viewer"].map((r) => (
                <span key={r} className="badge badge-p3 text-[10.5px]">{r}@nova.demo</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
