"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useApp, type DemoFile } from "@/components/app-provider";
import { Badge, Button, Field, Panel, WorkspaceShell } from "@/components/ui";
import "@/styles/sharing.css";

const QRCode = {
  async toDataURL(_text: string, _options?: unknown) {
    return "";
  },
};

type AccessMode = "public" | "private" | "email" | "team";
type ShareSettings = {
  mode: AccessMode;
  team: string;
  teamId?: string;
  email: string;
  password: string;
  passwordEnabled: boolean;
  expiry: string;
  maxViews: number;
  maxDownloads: number;
  slug: string;
  guest?: boolean;
};
type SelectedFile = { name: string; size: string; type: string; sourceUrl?: string; demo?: boolean };
type SharedTeam = { id: string; name: string; members: { email: string }[] };

const SETTINGS_KEY = "xfile-share-settings-v1";
let sessionSettings = "{}";
const defaultSettings: ShareSettings = {
  mode: "team", team: "Design Team", teamId: "design", email: "", password: "demo12345678",
  passwordEnabled: true, expiry: "2026-10-14T23:59", maxViews: 100,
  maxDownloads: 50, slug: "xfile.app/minhlam/brand-kit",
};
const guestExample: SelectedFile = { name: "Project proposal.pdf", size: "12,4 MB", type: "PDF", demo: true };
const registeredExample: SelectedFile = { name: "Brand Guidelines.pdf", size: "24,8 MB", type: "PDF", demo: true };

function SharingAsset({ node, name, alt = "" }: { node: string; name: string; alt?: string }) {
  const tone = name === "IconCheck" ? "green" : ["IconFile1", "IconUpload1", "IconLock1", "IconPlus"].includes(name) ? "primary" : "";
  const iconClass = name.startsWith("Icon") ? ` theme-icon${tone ? ` theme-icon-${tone}` : ""}` : "";
  return <img className={`sharing-asset${iconClass}`} src={`/assets/sharing/${node}-img${name}.svg`} alt={alt} />;
}

function SuccessIcon({ node, locked = false }: { node: string; locked?: boolean }) {
  return <span className={`sharing-success-icon${locked ? " sharing-success-icon-file" : ""}`}><SharingAsset node={node} name={locked ? "IconFile1" : "IconCheck"} /></span>;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`
    : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

function validUrl(value: string) {
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}

function sourceName(url: URL) {
  const name = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
  try { return decodeURIComponent(name); } catch { return name; }
}

function expiryTimestamp(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T23:59:00+07:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return `${value}+07:00`;
  return value;
}

function dateLabel(value: string, includeTime = false) {
  const date = new Date(expiryTimestamp(value));
  if (Number.isNaN(date.getTime())) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function dateTimeInput(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T23:59`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function readSettings(): Record<string, ShareSettings> {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || sessionSettings); } catch { return JSON.parse(sessionSettings); }
}

function saveSettings(id: string, settings: ShareSettings, previousId?: string) {
  const updated = { ...readSettings(), [id]: settings };
  if (previousId && previousId !== id) delete updated[previousId];
  sessionSettings = JSON.stringify(updated);
  try { localStorage.setItem(SETTINGS_KEY, sessionSettings); } catch { /* The demo remains available for this session. */ }
  window.dispatchEvent(new Event("xfile-share-settings"));
}

function subscribeSettings(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("xfile-share-settings", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("xfile-share-settings", callback);
  };
}

function useSavedSettings(id: string) {
  const raw = useSyncExternalStore(subscribeSettings, () => { try { return localStorage.getItem(SETTINGS_KEY) || sessionSettings; } catch { return sessionSettings; } }, () => "{}");
  try { return (JSON.parse(raw) as Record<string, ShareSettings>)[id]; } catch { return undefined; }
}

function useSavedTeams(): SharedTeam[] {
  const raw = useSyncExternalStore(subscribeSettings, () => { try { return localStorage.getItem("xfile-teams") || "null"; } catch { return "null"; } }, () => "null");
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(item => typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.members));
  } catch { /* Keep the design's sample group available. */ }
  return [{ id: "design", name: "Design Team", members: [{ email: "minhlam@example.com" }, { email: "linh@example.com" }, { email: "an@example.com" }, { email: "khoa@example.com" }] }];
}

function FileCard({ file, node = "5-3", status, progress }: { file: SelectedFile; node?: string; status?: string; progress?: number }) {
  return <div className="sharing-file-card">
    <span className="sharing-file-icon"><SharingAsset node={node} name="IconFile1" /></span>
    <div className="sharing-file-info"><p>{file.name}</p><span>{file.size} · {status || (file.demo ? "File mẫu · Sẵn sàng chia sẻ" : "Đã chọn từ thiết bị")}</span>
      {progress !== undefined && progress < 100 && <div className="sharing-progress"><span style={{ width: `${progress}%` }} /></div>}
    </div>
  </div>;
}

function useFileSelection(limit: number, sample: SelectedFile) {
  const { toast } = useApp();
  const [file, setFile] = useState<SelectedFile>(sample);
  const [progress, setProgress] = useState(100);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (progressTimer.current) clearInterval(progressTimer.current); }, []);
  function selectFile(selected?: File) {
    if (!selected) return;
    if (selected.size > limit * 1024 * 1024) { toast(`File vượt quá giới hạn ${limit} MB. Vui lòng chọn file nhỏ hơn.`); return; }
    if (progressTimer.current) clearInterval(progressTimer.current);
    setFile({ name: selected.name, size: formatSize(selected.size), type: selected.name.split(".").pop()?.toUpperCase() || "FILE" });
    setProgress(0);
    let next = 0;
    progressTimer.current = setInterval(() => {
      next += 25;
      setProgress(next);
      if (next >= 100 && progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
    }, 140);
  }
  const input = <input ref={inputRef} type="file" className="sharing-hidden-input" aria-label="Chọn file từ thiết bị" onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />;
  return { file, setFile, progress, selectFile, inputRef, input };
}

export function UploadScreen() {
  const { addFile, toast, user } = useApp();
  const router = useRouter();
  const [source, setSource] = useState<"file" | "link">("file");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const selection = useFileSelection(user ? 500 : 200, guestExample);

  function createLink() {
    setError("");
    if (selection.progress < 100) return;
    let chosen = selection.file;
    if (source === "link" || url.trim()) {
      if (!validUrl(url.trim())) { setError("Vui lòng nhập đường link hợp lệ bắt đầu bằng https:// hoặc http://."); return; }
      const parsed = new URL(url.trim());
      chosen = { name: sourceName(parsed), size: "Đường dẫn", type: "LINK", sourceUrl: url.trim() };
    }
    const id = crypto.randomUUID().slice(0, 8);
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const created: DemoFile = { id, name: chosen.name, size: chosen.size, type: chosen.type, url: chosen.sourceUrl || "", access: "public", views: 0, downloads: 0, createdAt: new Date().toISOString(), expiresAt, status: "active" };
    addFile(created);
    saveSettings(id, { ...defaultSettings, guest: !user, mode: "public", passwordEnabled: false, expiry: expiresAt, slug: id });
    toast("Đã tạo link xem thử. File được mô phỏng trong trình duyệt.");
    router.push(`/share?file=${id}${!user ? "&guest=1" : ""}`);
  }

  return <main className="sharing-guest-page">
    <header className="sharing-guest-heading"><p className="sharing-eyebrow">KHÔNG CẦN TÀI KHOẢN</p><h1>Chia sẻ file trong tích tắc</h1><p>Tải file hoặc dán link. Nhận ngay đường dẫn và mã QR để chia sẻ.</p></header>
    <div className="sharing-guest-grid">
      <Panel className="sharing-upload-panel">
        <div className="sharing-source-tabs" role="tablist" aria-label="Nguồn chia sẻ">
          <Button role="tab" aria-selected={source === "file"} variant={source === "file" ? "primary" : "secondary"} onClick={() => { setSource("file"); setError(""); }}><SharingAsset node="5-3" name="IconUpload" />Tải file lên</Button>
          <Button role="tab" aria-selected={source === "link"} variant={source === "link" ? "primary" : "secondary"} onClick={() => { setSource("link"); setError(""); }}><SharingAsset node="5-3" name="IconLink" />Nhập đường link</Button>
        </div>
        {source === "file" ? <>
          <div className={`sharing-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selection.selectFile(event.dataTransfer.files[0]); }}>
            <SharingAsset node="5-3" name="IconUpload1" /><h2>Kéo thả file vào đây</h2><p>hoặc chọn từ thiết bị · tối đa {user ? 500 : 200} MB</p><Button variant="secondary" onClick={() => selection.inputRef.current?.click()}>Chọn file</Button>
          </div>
          {selection.input}<FileCard file={selection.file} progress={selection.progress} status={selection.progress < 100 ? `Đang chuẩn bị bản xem thử · ${selection.progress}%` : undefined} />
        </> : <div className="sharing-link-intro"><SharingAsset node="5-3" name="IconLink" /><h2>Chia sẻ mọi đường dẫn</h2><p>Dán link tài liệu, thư mục hoặc website mà bạn muốn chia sẻ.</p></div>}
        <Field label={source === "file" ? "Hoặc nhập đường link" : "Đường link cần chia sẻ"} type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" aria-invalid={!!error} aria-describedby={error ? "sharing-url-error" : undefined} />
        {error && <p role="alert" id="sharing-url-error" className="sharing-error">{error}</p>}
        <Button onClick={createLink} disabled={selection.progress < 100} className="sharing-full-button"><SharingAsset node="5-3" name="IconLink1" />Tạo link chia sẻ</Button>
        <p className="sharing-small-text">Đăng nhập để đặt mật khẩu, tùy chỉnh hạn dùng và quản lý link.</p>
      </Panel>
      <Panel className="sharing-benefits-panel"><Badge>NHIỀU QUYỀN KIỂM SOÁT HƠN</Badge><h2>File lớn hơn. <br />Chia sẻ thông minh hơn.</h2>
        <ul>{["Upload file đến 500 MB", "Mật khẩu & giới hạn truy cập", "Theo dõi lượt xem, lượt tải", "Không gian làm việc nhóm"].map(item => <li key={item}><SharingAsset node="5-3" name="IconCheck" /><span>{item}</span></li>)}</ul>
        <Button href="/register" className="sharing-full-button">Đăng ký tài khoản</Button>
      </Panel>
    </div>
    <p className="sharing-demo-note">Bản xem thử giao diện · File chỉ được chọn trên thiết bị, không tải lên máy chủ.</p>
  </main>;
}

export function CreateScreen() {
  const { files, addFile, updateFile, toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params.get("edit") || "";
  const existing = files.find(file => file.id === editingId);
  const saved = useSavedSettings(editingId);
  const teams = useSavedTeams();
  const selection = useFileSelection(500, registeredExample);
  const setSelectedFile = selection.setFile;
  const [settings, setSettings] = useState<ShareSettings>(defaultSettings);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const lastEditing = useRef("");
  useEffect(() => {
    if (!existing || lastEditing.current === existing.id) return;
    const frame = requestAnimationFrame(() => {
      setSelectedFile({ name: existing.name, size: existing.size, type: existing.type, sourceUrl: existing.url || undefined });
      setSettings({ ...(saved || { ...defaultSettings, mode: existing.access === "password" ? "public" : existing.access, passwordEnabled: existing.access === "password", slug: existing.id }), expiry: dateTimeInput(existing.expiresAt) });
      lastEditing.current = existing.id;
    });
    return () => cancelAnimationFrame(frame);
  }, [existing, saved, setSelectedFile]);

  const selectedGroup = teams.find(team => settings.teamId ? team.id === settings.teamId : team.name === settings.team);

  function change<K extends keyof ShareSettings>(key: K, value: ShareSettings[K]) { setSettings(current => ({ ...current, [key]: value })); }
  function resetForm() {
    selection.setFile(registeredExample); setSettings(defaultSettings); setError("");
    if (editingId) router.push("/create");
  }
  function submit() {
    setError("");
    if (selection.progress < 100) return;
    if (settings.mode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) { setError("Nhập email hợp lệ của người nhận."); return; }
    if (settings.mode === "team" && !selectedGroup) { setError("Chọn một nhóm đang hoạt động để chia sẻ file."); return; }
    if (settings.passwordEnabled && settings.password.length < 6) { setError("Mật khẩu cần ít nhất 6 ký tự."); return; }
    if (settings.expiry && new Date(expiryTimestamp(settings.expiry)).getTime() <= Date.now()) { setError("Thời gian hết hạn cần ở trong tương lai."); return; }
    if (![settings.maxViews, settings.maxDownloads].every(value => Number.isSafeInteger(value) && value >= 1 && value <= 1000000)) { setError("Giới hạn lượt xem và lượt tải phải là số nguyên từ 1 đến 1.000.000."); return; }
    const slug = settings.slug.trim().split("/").filter(Boolean).pop() || "";
    if (slug && !/^[a-zA-Z0-9_-]+$/.test(slug)) { setError("Đường dẫn chỉ được chứa chữ, số, dấu gạch ngang và gạch dưới."); return; }
    if (slug.length > 64) { setError("Đường dẫn tùy chỉnh tối đa 64 ký tự."); return; }
    let id = slug || editingId || crypto.randomUUID().slice(0, 8);
    if (!editingId && slug === defaultSettings.slug.split("/").pop() && files.some(file => file.id === id)) id = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
    if (files.some(file => file.id === id && file.id !== editingId)) { setError("Đường dẫn này đã được sử dụng. Hãy chọn một tên khác."); return; }
    const updated: DemoFile = {
      id, name: selection.file.name, size: selection.file.size, type: selection.file.type, url: selection.file.sourceUrl || "",
      access: settings.passwordEnabled ? "password" : settings.mode === "team" ? "private" : settings.mode,
      views: existing?.views || 0, downloads: existing?.downloads || 0, createdAt: existing?.createdAt || new Date().toISOString(),
      expiresAt: settings.expiry ? new Date(expiryTimestamp(settings.expiry)).toISOString() : "", status: "active",
    };
    if (editingId) updateFile(editingId, updated); else addFile(updated);
    saveSettings(id, { ...settings, team: selectedGroup?.name || settings.team, teamId: selectedGroup?.id, slug: id, guest: false }, editingId);
    toast(editingId ? "Đã lưu thay đổi cho link." : "Đã tạo link chia sẻ xem thử.");
    router.push(`/share?file=${encodeURIComponent(id)}`);
  }
  const recipientLabel = settings.mode === "team" ? selectedGroup?.name || "Nhóm không còn khả dụng" : settings.mode === "email" ? settings.email || "Chưa nhập email" : settings.mode === "private" ? "Chỉ bạn" : "Bất kỳ ai có link";

  return <WorkspaceShell active="create"><div className="sharing-create-page">
    <header className="sharing-create-heading"><div><h1>{editingId ? "Chỉnh sửa link chia sẻ" : "Tạo link chia sẻ"}</h1><p>Chọn file, đặt quyền truy cập và chia sẻ theo cách của bạn.</p></div><Button onClick={resetForm}><SharingAsset node="5-11" name="IconPlus1" />Tạo link mới</Button></header>
    <div className="sharing-create-grid">
      <Panel className="sharing-security-panel">
        <FileCard file={selection.file} node="5-11" progress={selection.progress} status={selection.progress < 100 ? `Đang chuẩn bị bản xem thử · ${selection.progress}%` : `${selection.file.demo ? "File mẫu · " : ""}500 MB tối đa · Sẵn sàng chia sẻ`} />
        <div className="sharing-upload-options"><button onClick={() => selection.inputRef.current?.click()}>↑ Thay file khác</button><span>Tối đa 500 MB mỗi file</span>{selection.input}</div>
        <h2>Ai có thể truy cập?</h2><div className="sharing-access-modes" aria-label="Quyền truy cập">
          {([{ mode: "public", label: "Công khai", icon: "IconGlobe" }, { mode: "private", label: "Riêng tư", icon: "IconLock" }, { mode: "email", label: "Email", icon: "IconMail" }, { mode: "team", label: "Nhóm", icon: "IconTeam1" }] as const).map(item => <Button key={item.mode} variant={settings.mode === item.mode ? "primary" : "secondary"} aria-pressed={settings.mode === item.mode} onClick={() => change("mode", item.mode)}><SharingAsset node="5-11" name={item.icon} />{item.label}</Button>)}
        </div>
        <div className="sharing-fields-row"><label className="sharing-field-label">Nhóm được truy cập<select value={selectedGroup?.id || ""} disabled={settings.mode !== "team"} onChange={event => { const chosen = teams.find(team => team.id === event.target.value); if (chosen) setSettings(current => ({ ...current, team: chosen.name, teamId: chosen.id })); }}>{!selectedGroup && <option value="">Chọn nhóm</option>}{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><Field label="Email được mời (khi chọn Email)" type="email" disabled={settings.mode !== "email"} value={settings.email} placeholder="Nhập email người nhận" onChange={event => change("email", event.target.value)} /></div>
        <div className="sharing-password-heading"><SharingAsset node="5-11" name="IconLock1" /><span>Bảo vệ bằng mật khẩu</span><button className={`sharing-status-toggle${settings.passwordEnabled ? " is-on" : ""}`} aria-pressed={settings.passwordEnabled} onClick={() => change("passwordEnabled", !settings.passwordEnabled)}>{settings.passwordEnabled ? "Đang bật" : "Đang tắt"}</button></div>
        <label className="sharing-field-label">Mật khẩu truy cập<div className="sharing-password-input"><input type={showPassword ? "text" : "password"} value={settings.password} disabled={!settings.passwordEnabled} onChange={event => change("password", event.target.value)} minLength={6} autoComplete="new-password" /><button aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword(value => !value)}><SharingAsset node="5-11" name="IconEye" /></button></div></label>
        <div className="sharing-divider" /><div className="sharing-fields-row"><Field label="Hết hạn vào" type="datetime-local" value={settings.expiry} onChange={event => change("expiry", event.target.value)} /><label className="sharing-field-label">Giới hạn lượt xem / tải<div className="sharing-limit-input"><input type="number" aria-label="Giới hạn lượt xem" min={1} value={settings.maxViews} onChange={event => change("maxViews", Number(event.target.value) || 1)} /><span>lượt xem /</span><input type="number" aria-label="Giới hạn lượt tải" min={1} value={settings.maxDownloads} onChange={event => change("maxDownloads", Number(event.target.value) || 1)} /><span>lượt tải</span></div></label></div>
        <Field className="sharing-custom-path" label="Đường dẫn tùy chỉnh" value={settings.slug} onChange={event => change("slug", event.target.value)} placeholder="brand-kit" aria-describedby="sharing-custom-hint" />
        <p className="sharing-small-text" id="sharing-custom-hint">Link sẽ dừng khi đạt một trong các giới hạn đã đặt.</p>
        {error && <p className="sharing-error" role="alert">{error}</p>}
      </Panel>
      <Panel className="sharing-summary-panel"><h2>Tóm tắt chia sẻ</h2><dl>{[["File", selection.file.name], ["Dung lượng", selection.file.size], ["Người nhận", recipientLabel], ["Bảo vệ", settings.passwordEnabled ? "Có mật khẩu" : "Không có mật khẩu"], ["Hết hạn", dateLabel(settings.expiry, true)], ["Giới hạn", `${settings.maxViews} lượt xem · ${settings.maxDownloads} lượt tải`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="sharing-divider" /><Button className="sharing-full-button" onClick={submit} disabled={selection.progress < 100}><SharingAsset node="5-11" name="IconLink" />{editingId ? "Lưu thay đổi" : "Tạo link chia sẻ"}</Button><Button href="/dashboard" variant="ghost" className="sharing-full-button">Hủy</Button><p>Bạn có thể thay đổi quyền hoặc vô hiệu hóa link bất cứ lúc nào.</p></Panel>
    </div><p className="sharing-demo-note">Bản xem thử giao diện · Quyền truy cập và file được mô phỏng trong trình duyệt.</p>
  </div></WorkspaceShell>;
}

export function ShareScreen({ team: isTeamScreen = false }: { team?: boolean }) {
  const { files, toast } = useApp();
  const params = useSearchParams();
  const team = isTeamScreen || params.has("team");
  const teamId = params.get("team") || "design";
  const teams = useSavedTeams();
  const group = teams.find(item => item.id === teamId);
  const teamName = group?.name || "Không gian nhóm";
  const teamUnavailable = team && !group;
  const queryGuest = params.get("guest") === "1";
  const id = params.get("file") || (team ? `team-${teamId}` : queryGuest ? "proposal" : "brand-kit");
  const settings = useSavedSettings(id);
  const fileGroup = settings?.mode === "team" ? teams.find(item => settings.teamId ? item.id === settings.teamId : item.name === settings.team) : undefined;
  const shareGroupUnavailable = teamUnavailable || settings?.mode === "team" && !fileGroup;
  const guest = queryGuest || !!settings?.guest;
  const file = files.find(item => item.id === id);
  const node = team ? "14-56" : guest ? "14-2" : "5-12";
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (shareGroupUnavailable) return;
    let alive = true;
    const shareLink = `${window.location.origin}/g/${encodeURIComponent(id)}${team ? `?team=${encodeURIComponent(teamId)}` : ""}`;
    QRCode.toDataURL(shareLink, { width: 196, margin: 2, color: { dark: "#111827", light: "#ffffff" }, errorCorrectionLevel: "M" }).then(value => { if (alive) { setQr(value); setLink(shareLink); } }).catch(() => { if (alive) setLink(shareLink); });
    return () => { alive = false; };
  }, [id, team, teamId, shareGroupUnavailable]);
  async function copyLink() {
    if (shareGroupUnavailable || !link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); toast("Đã sao chép link chia sẻ."); }
    catch { toast("Không thể sao chép tự động. Hãy chọn đường link và sao chép."); }
  }
  async function shareLink() {
    if (shareGroupUnavailable || !link) return;
    if (navigator.share) { try { await navigator.share({ title: team ? teamName : file?.name || "xFile", url: link }); } catch (error) { if (error instanceof Error && error.name !== "AbortError") await copyLink(); } }
    else await copyLink();
  }
  const fallbackQr = team ? "QrHttpsXfileAppTeamDesign" : guest ? "QrHttpsXfileAppG7Kq2Mx" : "QrHttpsXfileAppMinhlamBrandKit";
  const selected = file || (guest ? guestExample : registeredExample);
  const accessLabel = guest || settings?.mode === "public" || (!settings && file?.access === "public") ? "Chia sẻ công khai" : settings?.mode === "team" ? fileGroup?.name || settings.team : settings?.mode === "email" || file?.access === "email" ? "Chia sẻ qua email" : settings?.mode === "private" || file?.access === "private" ? "Chỉ bạn" : "Design Team";
  const passwordEnabled = settings?.passwordEnabled ?? (file ? file.access === "password" : !guest);
  const status = team ? "Không gian nhóm" : `${accessLabel}${passwordEnabled ? " · Có mật khẩu" : ""}`;

  if (shareGroupUnavailable) return <main className="sharing-success-stage"><Panel className="sharing-success-panel"><SuccessIcon node={node} locked /><h1>Nhóm không còn khả dụng</h1><p className="sharing-success-description">Không gian nhóm này đã được giải tán hoặc không tồn tại trong bản xem thử.</p><Button href="/teams" className="sharing-full-button">Về quản lý nhóm</Button></Panel></main>;

  return <main className={`sharing-success-stage${guest ? " sharing-success-guest" : team ? " sharing-success-team" : ""}`}><Panel className="sharing-success-panel">
    <SuccessIcon node={node} /><h1>Link đã sẵn sàng!</h1><p className="sharing-success-description">{team ? "Mời đồng đội truy cập bằng đường dẫn hoặc mã QR." : "Chia sẻ file bằng đường dẫn hoặc mã QR."}</p>
    <FileCard file={team ? { name: teamName, size: `${group?.members.length || 0} thành viên`, type: "TEAM" } : selected} node={node} status={status} />
    <div className="sharing-qr-box">{qr ? <img className="sharing-dynamic-qr" src={qr} alt="Mã QR mở đường link chia sẻ" width={196} height={196} /> : <SharingAsset node={node} name={fallbackQr} alt="Mã QR chia sẻ" />}</div>
    <div className="sharing-link-box"><SharingAsset node={node} name="IconLink" /><a href={link || "#"} target="_blank" rel="noreferrer">{link || `/g/${id}`}</a><button onClick={copyLink} aria-label="Sao chép đường link" disabled={!link}><SharingAsset node={node} name="IconCopy" /></button></div>
    <p className="sharing-expiry">{team ? "Hết hạn 14/10/2026 · Chỉ thành viên được mời" : guest ? "Không cần tài khoản · Upload file đến 200 MB" : `Hết hạn ${dateLabel(file?.expiresAt || settings?.expiry || defaultSettings.expiry)} · ${settings?.maxViews || 100} lượt xem · ${settings?.maxDownloads || 50} lượt tải`}</p>
    <div className="sharing-success-buttons"><Button onClick={copyLink} disabled={!link}><SharingAsset node={node} name="IconCopy1" />{copied ? "Đã sao chép" : "Sao chép link"}</Button><Button variant="secondary" onClick={shareLink} disabled={!link}><SharingAsset node={node} name="IconArrow" />Chia sẻ</Button></div>
    <Button variant="ghost" className="sharing-full-button" href={team ? "/teams" : guest ? "/upload" : "/dashboard"}>{team ? "Về quản lý nhóm" : guest ? "Tạo link khác" : "Về trang quản lý"}</Button>
  </Panel></main>;
}

export function RecipientScreen({ id }: { id: string }) {
  const { files, updateFile, toast, user } = useApp();
  const params = useSearchParams();
  const team = params.has("team");
  const teamId = params.get("team") || "design";
  const teams = useSavedTeams();
  const group = teams.find(item => item.id === teamId);
  const canOpenGroup = !!user && !!group?.members.some(member => member.email.toLowerCase() === user.email.toLowerCase());
  const file = files.find(item => item.id === id);
  const settings = useSavedSettings(id);
  const accessGroup = settings?.mode === "team" ? teams.find(item => settings.teamId ? item.id === settings.teamId : item.name === settings.team) : undefined;
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [openedAt] = useState(() => Date.now());
  const [countedViewId, setCountedViewId] = useState("");
  const lastCountedView = useRef("");
  const expired = file?.status === "expired" || !!(file?.expiresAt && new Date(expiryTimestamp(file.expiresAt)).getTime() < openedAt);
  const limitReached = !!(settings && file && (file.views >= settings.maxViews && countedViewId !== id || file.downloads >= settings.maxDownloads));
  const accessGroupUnavailable = settings?.mode === "team" && !accessGroup;
  const disabled = file?.status === "disabled" || expired || limitReached || accessGroupUnavailable;
  const passwordRequired = (settings?.passwordEnabled ?? file?.access === "password") && !unlocked;
  const emailRequired = (settings?.mode === "email" || file?.access === "email") && !unlocked;
  const teamDenied = settings?.mode === "team" && !!user && !accessGroup?.members.some(member => member.email.toLowerCase() === user.email.toLowerCase());
  const privateRequired = !user && (settings?.mode === "private" || settings?.mode === "team" || file?.access === "private") || teamDenied;
  const locked = passwordRequired || emailRequired || privateRequired;
  useEffect(() => {
    if (!file || locked || disabled || lastCountedView.current === file.id) return;
    const frame = requestAnimationFrame(() => {
      lastCountedView.current = file.id;
      setCountedViewId(file.id);
      updateFile(file.id, { views: file.views + 1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [file, locked, disabled, updateFile]);

  function unlock() {
    setError("");
    if (passwordRequired && password !== (settings?.password || "demo12345678")) { setError("Mật khẩu chưa đúng. Vui lòng thử lại."); return; }
    if (emailRequired && email.trim().toLowerCase() !== (settings?.email || "minhlam@example.com").trim().toLowerCase()) { setError("Email này không nằm trong danh sách được mời."); return; }
    setUnlocked(true);
  }
  function downloadDemo() {
    if (!file) return;
    if (settings && file.downloads >= settings.maxDownloads) { toast("Link đã đạt giới hạn lượt tải."); return; }
    updateFile(file.id, { downloads: file.downloads + 1 });
    toast("Đã mô phỏng một lượt tải. Bản UI không lưu nội dung file.");
  }

  return <main className="sharing-success-stage"><Panel className="sharing-success-panel sharing-recipient-panel">
    <SuccessIcon node="5-12" locked={disabled || locked} /><h1>{team ? group ? `Tham gia ${group.name}` : "Nhóm không còn khả dụng" : disabled ? "Link không còn khả dụng" : locked ? "File được bảo vệ" : "File được chia sẻ với bạn"}</h1>
    <p className="sharing-success-description">{team ? group ? "Cùng chia sẻ tài liệu và làm việc trong không gian nhóm." : "Không gian nhóm này đã được giải tán." : expired ? "Đường link này đã hết hạn." : limitReached ? "Đường link đã đạt giới hạn truy cập." : accessGroupUnavailable ? "Nhóm được cấp quyền truy cập không còn hoạt động." : disabled ? "Chủ sở hữu đã vô hiệu hóa đường link này." : teamDenied ? "Tài khoản của bạn chưa nằm trong nhóm được cấp quyền." : "Mở file hoặc lưu lại đường dẫn để truy cập sau."}</p>
    {team ? group && <><FileCard file={{ name: group.name, size: `${group.members.length} thành viên`, type: "TEAM" }} node="14-56" status="Không gian nhóm" />{!user || canOpenGroup ? <Button href={canOpenGroup ? "/teams" : `/login?next=${encodeURIComponent(`/g/${id}?team=${teamId}`)}`} className="sharing-full-button">{canOpenGroup ? "Mở không gian nhóm" : "Đăng nhập để tham gia"}</Button> : <p className="sharing-small-text">Tài khoản này chưa được mời vào nhóm. Liên hệ chủ nhóm để được cấp quyền.</p>}</> : !file ? <><p className="sharing-small-text">Link xem thử chỉ có dữ liệu trong trình duyệt đã tạo link. Hãy tạo một link mới để thử giao diện.</p><Button href="/upload">Tạo link chia sẻ</Button></> : <>
      <FileCard file={file} node="5-12" status={file.type === "LINK" ? "Chia sẻ qua xFile" : `${file.type} · Chia sẻ qua xFile`} />
      {!disabled && (privateRequired ? <Button href={teamDenied ? "/teams" : `/login?next=${encodeURIComponent(`/g/${id}`)}`} className="sharing-full-button">{teamDenied ? "Về quản lý nhóm" : "Đăng nhập để truy cập"}</Button> : locked ? <form className="sharing-unlock-form" onSubmit={event => { event.preventDefault(); unlock(); }}>
        {passwordRequired && <Field label="Mật khẩu truy cập" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" required />}
        {emailRequired && <Field label="Email được mời" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required />}
        {error && <p className="sharing-error" role="alert">{error}</p>}<Button type="submit" className="sharing-full-button">Mở file</Button><p className="sharing-small-text">Bản UI mô phỏng quyền truy cập. {passwordRequired && !settings ? "Mật khẩu mẫu: demo12345678." : ""} {emailRequired && !settings ? "Email mẫu: minhlam@example.com." : ""}</p>
      </form> : <><div className="sharing-recipient-details"><span>Hết hạn</span><strong>{dateLabel(file.expiresAt)}</strong></div>{file.url && validUrl(file.url) ? <a className="sharing-external-link" href={file.url} target="_blank" rel="noreferrer">Mở đường link nguồn ↗</a> : <Button onClick={downloadDemo} className="sharing-full-button">Tải file · {file.size}</Button>}<p className="sharing-demo-note">Bản xem thử giao diện · Nội dung file không được lưu trên máy chủ.</p></>)}
    </>}
    <Link className="sharing-text-link" href="/">Chia sẻ file của bạn với xFile</Link>
  </Panel></main>;
}
