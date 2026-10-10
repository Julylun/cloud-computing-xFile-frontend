"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useApp } from "./app-provider";

export type IconName = "file" | "arrow" | "check" | "link" | "copy" | "upload" | "lock" | "team" | "eye" | "plus" | "close" | "home" | "chart" | "settings" | "bell" | "search" | "sun" | "moon" | "logout" | "chevron" | "more" | "download" | "trash";
const homeIcons: Record<string, string> = { file: "imgIconFile1", arrow: "imgIconArrow", check: "imgIconCheck", link: "imgIconLink", copy: "imgIconCopy", upload: "imgIconUpload", lock: "imgIconLock", team: "imgIconTeam" };
const workspaceIcons: Record<string, string> = { home: "imgIconGrid", plus: "imgIconPlus", chart: "imgIconChart", settings: "imgIconSettings", bell: "imgIconBell", search: "imgIconSearch" };
export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  if (name === "sun" || name === "moon") return <span className={`utility-symbol ${className}`} aria-hidden="true">{name === "sun" ? "☀" : "☾"}</span>;
  let src = `/assets/home/${homeIcons[name] || "imgIconFile1"}.svg`;
  if (workspaceIcons[name]) src = `/assets/workspace/5-10/${workspaceIcons[name]}.svg`;
  if (name === "eye") src = "/assets/auth/5-4/imgIconEye.svg";
  if (name === "close") return <span className={`utility-symbol ${className}`} aria-hidden="true">×</span>;
  if (name === "chevron") return <span className={`utility-symbol ${className}`} aria-hidden="true">⌄</span>;
  if (name === "more") return <span className={`utility-symbol ${className}`} aria-hidden="true">···</span>;
  const tone = name === "check" ? "green" : ["upload", "team"].includes(name) ? "cyan" : homeIcons[name] ? "primary" : "neutral";
  return <span className={`icon ${className}`} style={{ minWidth: size }} aria-hidden="true"><img className={`theme-icon theme-icon-${tone}`} src={src} alt="" /></span>;
}
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; variant?: "primary" | "secondary" | "ghost" | "danger"; children: React.ReactNode };
export function Button({ href, variant = "primary", className = "", children, ...props }: ButtonProps) {
  const classes = `button button-${variant} ${className}`;
  if (href) return <Link href={href} className={classes} aria-label={props["aria-label"]}>{children}</Link>;
  return <button className={classes} type="button" {...props}>{children}</button>;
}
export function Panel({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={`panel ${className}`} {...props}>{children}</div>; }
export function Badge({ children, className = "", tone = "cyan" }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "cyan" | "green" | "primary" | "red" }) { return <span className={`badge badge-${tone} ${className}`}>{children}</span>; }
export function Field({ label, error, hint, className = "", id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const generated = useId(); const fieldId = id || generated;
  return <div className={`field ${className}`}><label htmlFor={fieldId}>{label}</label><input id={fieldId} className={`input ${error ? "input-error" : ""}`} aria-invalid={!!error} aria-describedby={error || hint ? `${fieldId}-hint` : undefined} {...props} />{(error || hint) && <p id={`${fieldId}-hint`} className={error ? "field-error" : "field-hint"}>{error || hint}</p>}</div>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return <div className="page-heading">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<div className="page-heading-row"><div><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{children}</div></div>;
}
const workspaceRoutes = ["/dashboard", "/create", "/analytics", "/teams", "/settings", "/notifications", "/ui-states"];
export function Background() {
  const pathname = usePathname(); const home = pathname === "/";
  const isWorkspace = workspaceRoutes.some((route) => pathname.startsWith(route));
  return <div className={`ambient ${home ? "ambient-home" : ""} ${isWorkspace ? "ambient-workspace" : ""}`} aria-hidden="true">
    <img className="ambient-violet" src="/assets/home/imgGlassAmbientViolet.svg" alt="" />
    <img className="ambient-cyan" src="/assets/home/imgGlassAmbientCyan.svg" alt="" />
    <img className="ambient-indigo" src="/assets/home/imgGlassAmbientIndigo.svg" alt="" />
  </div>;
}
export function Brand() {
  return <Link href="/" className="brand" aria-label="xFile – Trang chủ"><span className="brand-mark"><img className="theme-icon theme-icon-ink" alt="" src="/assets/home/imgIconFile.svg" /></span><span>xFile</span></Link>;
}
export function ThemeToggle() {
  const { theme, setTheme } = useApp();
  return <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>;
}
export function Navigation() {
  const pathname = usePathname(); const { user } = useApp();
  if (workspaceRoutes.some((route) => pathname.startsWith(route))) return null;
  return <header className="public-nav"><Brand /><div className="nav-spacer" /><nav aria-label="Điều hướng chính"><Button href={user ? "/settings" : "/login"} variant="ghost">{user ? user.name : "Đăng nhập"}</Button><Button href={user ? "/dashboard" : "/register"}>{user ? "Tổng quan" : "Đăng ký"}</Button></nav><ThemeToggle /></header>;
}
const navItems: { key: string; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "Tổng quan", icon: "home" }, { key: "create", label: "Tạo link mới", icon: "plus" }, { key: "analytics", label: "Phân tích", icon: "chart" }, { key: "teams", label: "Quản lý nhóm", icon: "team" }, { key: "notifications", label: "Thông báo", icon: "bell" }, { key: "settings", label: "Cài đặt", icon: "settings" },
];
export function WorkspaceShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { user, signOut, toast } = useApp(); const router = useRouter(); const [open, setOpen] = useState(false);
  const screen = ({ dashboard: "5-10", analytics: "5-13", teams: "5-14", settings: "5-15", notifications: "5-16" } as Record<string, string>)[active] || "5-10";
  function sidebarAsset(item: (typeof navItems)[number]) {
    const iconName = item.icon === "home" ? "Grid" : item.icon[0].toUpperCase() + item.icon.slice(1);
    if (active === "create") return `/assets/sharing/5-11-imgIcon${iconName}.svg`;
    return `/assets/workspace/${screen}/imgIcon${iconName}.svg`;
  }
  return <div className="workspace-shell">
    <button className="mobile-menu icon-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
    {open && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}><Brand /><nav aria-label="Không gian làm việc">{navItems.map((item) => <Link key={item.key} href={`/${item.key}`} onClick={() => setOpen(false)} className={`sidebar-link ${active === item.key ? "sidebar-link-active" : ""}`} aria-current={active === item.key ? "page" : undefined}><img className={`sidebar-icon theme-icon${active === item.key ? " theme-icon-primary" : ""}`} src={sidebarAsset(item)} alt="" /><span>{item.label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><Panel className="storage-panel"><p>DUNG LƯỢNG LƯU TRỮ</p><h3>1,2 GB <span>/ 5 GB</span></h3><div className="storage-track"><span /></div><p className="storage-caption">Còn 3,8 GB để chia sẻ</p></Panel><div className="sidebar-user"><span className="avatar">ML</span><div><strong>{user?.name || "Minh Lâm"}</strong><small>Tài khoản cá nhân</small></div><button className="icon-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => { signOut(); toast("Đã đăng xuất"); router.push("/"); }}>↪</button></div></div>
    </aside>
    <div className="workspace-main"><header className="workspace-topbar"><p>Không gian cá nhân</p><div className="workspace-topbar-actions"><ThemeToggle /><Link href="/notifications" className="icon-button" aria-label="Thông báo"><Icon name="bell" /><span className="notification-dot" /></Link><Link href="/settings" className="workspace-account">{user?.name || "Minh Lâm"}</Link></div></header><main className="workspace-content">{children}</main></div>
  </div>;
}
