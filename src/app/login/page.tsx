"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon } from "@/components/icons";

// Demo prefill CHỈ ở dev — bản phát hành production không lộ tài khoản mẫu
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(SHOW_DEMO_ACCOUNTS ? "owner@nova.demo" : "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
      router.push(ws ? `/workspaces/${ws}` : "/login");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lg-hero relative overflow-hidden flex flex-col">
      {/* Slogan góc phải trên */}
      <div className="lg-slogan absolute top-8 right-10 text-right hidden sm:block">
        <div>Safe streams</div>
        <div>Safer communities</div>
        <span className="lg-slogan-line" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative z-10">
        {/* Hero: logo + wordmark + tagline */}
        <div className="text-center mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="LiveGuard" className="w-[74px] h-[74px] mx-auto mb-4 lg-drop" />
          <h1 className="lg-wordmark">
            Live<span>Guard</span>
          </h1>
          <p className="lg-subtitle">Live stream crisis command center</p>
          <p className="lg-pillars">
            Phòng ngừa rủi ro <span>·</span> Giám sát kịp thời <span>·</span> Ứng phó hiệu quả
          </p>
        </div>

        {/* Card đăng nhập */}
        <div className="lg-card w-full max-w-[560px]">
          <h2 className="text-[22px] font-bold tracking-tight">Đăng nhập</h2>
          <p className="text-dim text-[13.5px] mt-1 mb-6">
            Chào mừng bạn trở lại! Vui lòng đăng nhập để tiếp tục.
          </p>

          <form onSubmit={submit} className="space-y-3.5">
            <label className="lg-field">
              <MailIcon size={17} className="lg-field-ico" />
              <input
                className="lg-input"
                type="email"
                placeholder="Email hoặc số điện thoại"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="lg-field">
              <LockIcon size={17} className="lg-field-ico" />
              <input
                className="lg-input"
                type={showPw ? "text" : "password"}
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="lg-eye"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPw ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
              </button>
            </label>

            {error && (
              <div role="alert" className="callout callout-danger text-[12.5px]">
                {error}
              </div>
            )}

            <button className="lg-submit" disabled={loading}>
              {loading ? "Đang đăng nhập…" : (
                <>
                  Đăng nhập <ArrowRightIcon size={17} />
                </>
              )}
            </button>
          </form>

          <div className="lg-divider">
            <span>Hoặc đăng nhập với</span>
          </div>

          <div className="flex justify-center gap-3.5">
            <button type="button" className="lg-social" title="Google (sắp có)" disabled>
              <GoogleMark />
            </button>
            <button type="button" className="lg-social" title="Microsoft (sắp có)" disabled>
              <MicrosoftMark />
            </button>
            <button type="button" className="lg-social" title="Apple (sắp có)" disabled>
              <AppleMark />
            </button>
          </div>

          <p className="text-center mt-5">
            <Link className="lg-forgot" href="/login">
              Quên mật khẩu?
            </Link>
          </p>
        </div>

        {SHOW_DEMO_ACCOUNTS && (
          <div className="surface-2 mt-4 p-3.5 text-[11.5px] text-dim leading-relaxed max-w-[560px] w-full relative z-10">
            <b className="text-faint text-[10.5px] tracking-wide">DEMO ACCOUNTS</b> (mật khẩu: crisis2026)
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["owner", "crisis_lead", "brand_mgr", "moderator", "cs", "legal", "exec_viewer"].map((r) => (
                <span key={r} className="badge badge-p3 text-[10.5px]">
                  {r}@nova.demo
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-dim text-[12.5px] mt-4 relative z-10">
          Chưa có tài khoản?{" "}
          <Link className="link" href="/register">
            Đăng ký
          </Link>
        </p>
      </div>
    </main>
  );
}

/* ---- Brand marks (brand-only glyph, công khai) ---- */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.6Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.7-5l-3.9 3C3.4 21.3 7.4 24 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.8l-3.9-3a12 12 0 0 0 0 10.8l3.9-3Z" />
      <path fill="#EA4335" d="M12 4.7c2.2 0 3.7.9 4.5 1.8l3.3-3.3C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l3.9 3c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}
function MicrosoftMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#e7edf7" aria-hidden>
      <path d="M16.6 12.9c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1 1-3.9 1s-2-1-3.4-1c-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.2-2.5.7-1 1.2-2 1.4-2.6-2.8-1.1-2.8-4.2-2.8-4.3ZM14.1 4.6c.7-.9 1.2-2.1 1.1-3.3-1 .1-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z" />
    </svg>
  );
}
