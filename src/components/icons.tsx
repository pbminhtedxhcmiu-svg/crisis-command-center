/**
 * Bộ icon SVG line-style cho sidebar/topbar (thay emoji).
 * Dùng stroke=currentColor nên tự đổi màu theo trạng thái (active/hover).
 */
type IconProps = { size?: number; className?: string };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
}

export function HomeIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

/** Sóng phát trực tiếp (broadcast) — Live Events */
export function BroadcastIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 18.4a9 9 0 0 1 0-12.8" />
      <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
    </svg>
  );
}

/** Tam giác cảnh báo — Incidents */
export function AlertIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Tài liệu soạn thảo — Response Studio */
export function FileTextIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 2.5h8L19 7.5V21.5H6V2.5Z" />
      <path d="M14 2.5V8h5" />
      <path d="M9 12h6M9 15.5h6" />
    </svg>
  );
}

/** Khiên có tick — Audit Logs */
export function ShieldCheckIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2.5 20 5.5v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10v-6l8-3Z" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.5" />
    </svg>
  );
}

/** Chuông thông báo — topbar */
export function BellIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" />
      <path d="M10 19a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

/** Kính lúp — tìm kiếm */
export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Đồng hồ — timestamp trên card */
export function ClockIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Kebab dọc — menu card */
export function KebabIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2.4}>
      <path d="M12 5.5v.01M12 12v.01M12 18.5v.01" />
    </svg>
  );
}

/** Phong bì — input email */
export function MailIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

/** Khoá — input mật khẩu */
export function LockIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Mắt — hiện/ẩn mật khẩu */
export function EyeIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function EyeOffIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.9A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-2.8 3.6M6.6 6.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.7 9.7 0 0 0 4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

/** Mũi tên phải — nút Đăng nhập */
export function ArrowRightIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}
