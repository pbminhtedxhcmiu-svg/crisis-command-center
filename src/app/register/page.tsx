"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", workspaceName: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Đăng ký thất bại");
        return;
      }
      router.push(`/workspaces/${data.workspaceId}/live-events`);
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
            className="w-12 h-12 mx-auto mb-3 rounded-2xl grid place-items-center"
            style={{ background: "var(--gradient-brand)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="LiveGuard" className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Tạo tài khoản</h1>
          <p className="text-dim text-[12.5px] mt-1">Bạn sẽ là OWNER của workspace mới</p>
        </div>

        <div className="surface card-hover p-6">
          <form onSubmit={submit} className="space-y-4">
            <label className="field">
              <span className="label">Tên của bạn</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={1} />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="field">
              <span className="label">Mật khẩu (tối thiểu 8 ký tự)</span>
              <input className="input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </label>
            <label className="field">
              <span className="label">Tên workspace</span>
              <input className="input" value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} placeholder="VD: Nova Beauty" />
            </label>
            {error && <div role="alert" className="callout callout-danger text-[12.5px]">{error}</div>}
            <button className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? "Đang tạo…" : "Tạo tài khoản"}
            </button>
          </form>
          <p className="text-dim text-[12.5px] mt-4">
            Đã có tài khoản? <Link className="link" href="/login">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
