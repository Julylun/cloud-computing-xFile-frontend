"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useApp, type DemoFile } from "@/components/app-provider";
import { Button, Field, Panel, WorkspaceShell } from "@/components/ui";
import { apiRequest, type LinkAnalytics, type UserProfile } from "@/lib/api";
import "@/styles/workspace.css";

function Asset({ screen, name, alt = "", className = "" }: { screen: string; name: string; alt?: string; className?: string }) {
  const chart = name === "imgTrafficChartEditableVectors";
  const tone = name === "imgIconPlus1" || name === "imgIconLink" || screen === "14-110" ? "ink" : name === "imgIconClock" ? "amber" : name === "imgIconBell2" ? "red" : name === "imgIconTeam1" ? "cyan" : name === "imgIconCheck" ? "green" : name === "imgIconEye" || name === "imgIconSearch" ? "muted" : "primary";
  // Keep the original export and its geometry in both themes; CSS adjusts color.
  return <img className={`ws-asset ${chart ? "ws-asset-chart" : `theme-icon theme-icon-${tone}`} ${className}`} src={`/assets/workspace/${screen}/${name}.svg`} alt={alt} />;
}

function Heading({ title, description, screen, action = true }: { title: string; description: string; screen: string; action?: boolean }) {
  return <div className="ws-heading"><div><h1>{title}</h1><p>{description}</p></div>{action && <Button href="/create" className="ws-create"><Asset screen={screen} name="imgIconPlus1" />Tạo link mới</Button>}</div>;
}

function Stats({ items }: { items: { label: string; value: string | number; note: string }[] }) {
  return <div className="ws-stats">{items.map(item => <Panel className="ws-stat" key={item.label}><p>{item.label}</p><strong>{item.value}</strong><small>{item.note}</small></Panel>)}</div>;
}

function fileStatus(file: DemoFile, now: number): "active" | "near-expiry" | "expired" | "disabled" {
  if (file.status === "disabled") return "disabled";
  const expiresAt = new Date(file.expiresAt).getTime();
  if (file.status === "expired" || expiresAt <= now) return "expired";
  if (expiresAt - now <= 24 * 60 * 60 * 1000) return "near-expiry";
  return "active";
}

function Status({ file, now }: { file: DemoFile; now: number }) {
  const status = fileStatus(file, now);
  const labels = { active: "Hoạt động", "near-expiry": "Sắp hết hạn", expired: "Hết hạn", disabled: "Tạm dừng" };
  return <span className={`ws-badge ${status === "disabled" ? "ws-neutral" : status === "active" ? "ws-green" : "ws-amber"}`}>{labels[status]}</span>;
}

function Modal({ title, children, onClose, eyebrow }: { title: string; children: ReactNode; onClose: () => void; eyebrow?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={dialogRef} className="ws-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><Panel className="ws-modal"><button type="button" className="ws-close" aria-label="Đóng" onClick={onClose}>×</button>{eyebrow && <span className="ws-badge ws-cyan">{eyebrow}</span>}<h2>{title}</h2>{children}</Panel></dialog>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")} thg ${date.getMonth() + 1}`;
}

export function DashboardScreen() {
  const { files, user, deleteFile, toast } = useApp();
  const [now, setNow] = useState(() => new Date().getTime());
  useEffect(() => { const timer = setInterval(() => setNow(new Date().getTime()), 60_000); return () => clearInterval(timer); }, []);
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [status, setStatus] = useState("all");
  const [access, setAccess] = useState("all");
  const [sort, setSort] = useState("original");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [modal, setModal] = useState<"delete" | "extend" | null>(null);
  const [actionError, setActionError] = useState("");
  const filtered = files.filter(file => {
    const actualStatus = fileStatus(file, now);
    const matchesStatus = status === "all" || actualStatus === status || status === "active" && actualStatus === "near-expiry";
    return `${file.name} ${file.url}`.toLowerCase().includes(search.toLowerCase()) && matchesStatus && (access === "all" || file.access === access);
  });
  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "views") filtered.sort((a, b) => b.views - a.views);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 3));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 3, currentPage * 3);
  const selected = files.find(file => file.id === selectedId) ?? visible[0];
  const accessLabels = { public: "Công khai", password: "Mật khẩu", email: "Theo email", private: "Riêng tư" };
  const activeLinks = files.filter(file => fileStatus(file, now) === "active").length;
  const expiringLinks = files.filter(file => fileStatus(file, now) === "near-expiry").length;
  return <WorkspaceShell active="dashboard"><div className="ws-screen">
    <Heading screen="5-10" title="Mọi file. Một không gian." description={`Chào ${user?.name || "Minh Lâm"}, đây là hoạt động chia sẻ của bạn hôm nay.`} />
    <Stats items={[{ label: "LINK ĐANG HOẠT ĐỘNG", value: activeLinks, note: "Theo dữ liệu từ máy chủ" }, { label: "LƯỢT TRUY CẬP", value: files.reduce((sum, file) => sum + file.views, 0).toLocaleString("vi-VN"), note: "Tổng lượt ghi nhận" }, { label: "LƯỢT TẢI", value: files.reduce((sum, file) => sum + file.downloads, 0).toLocaleString("vi-VN"), note: "Tổng lượt tải ghi nhận" }, { label: "SẮP HẾT HẠN", value: expiringLinks, note: "Trong vòng 24 giờ" }]} />
    <div className="ws-expiration"><Asset screen="5-10" name="imgIconClock" /><span>{expiringLinks} link sẽ hết hạn trong 24 giờ tới.</span><Link href="/notifications">Xem thông báo →</Link></div>
    <Panel className="ws-files-panel">
      <div className="ws-toolbar"><h2>File &amp; đường link</h2><label className="ws-search"><Asset screen="5-10" name="imgIconSearch" /><input aria-label="Tìm file" placeholder="Tìm tên file hoặc link..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><Button variant="secondary" className="ws-filter-button" aria-expanded={showFilter} onClick={() => setShowFilter(!showFilter)}>Bộ lọc</Button></div>
      {showFilter && <div className="ws-filters"><label>Trạng thái<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="near-expiry">Sắp hết hạn</option><option value="expired">Hết hạn</option><option value="disabled">Tạm dừng</option></select></label><label>Quyền truy cập<select value={access} onChange={event => { setAccess(event.target.value); setPage(1); }}><option value="all">Tất cả quyền truy cập</option>{Object.entries(accessLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Sắp xếp<select value={sort} onChange={event => setSort(event.target.value)}><option value="original">Mới nhất</option><option value="name">Tên file A–Z</option><option value="views">Lượt xem cao nhất</option></select></label><Button variant="ghost" onClick={() => { setSearch(""); setStatus("all"); setAccess("all"); setSort("original"); }}>Đặt lại</Button></div>}
      <div className="ws-table-scroll"><table className="ws-files-table"><thead><tr><th>TÊN FILE / LINK</th><th>QUYỀN TRUY CẬP</th><th>LƯỢT XEM / TẢI</th><th>HẾT HẠN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{visible.map(file => <tr key={file.id} onClick={() => setSelectedId(file.id)} className={selectedId === file.id ? "ws-row-selected" : ""}><td><div className="ws-file-name"><Asset screen="5-10" name="imgIconFile1" /><div><Link href={`/analytics?file=${encodeURIComponent(file.id)}`}>{file.name}</Link><small>{file.url.replace(/^https?:\/\//, "")}</small></div></div></td><td>{accessLabels[file.access]}</td><td className="ws-views">{file.views} / {file.downloads}</td><td>{formatDate(file.expiresAt)}</td><td><Status file={file} now={now} /></td></tr>)}</tbody></table></div>
      {visible.length === 0 && <div className="ws-empty"><Asset screen="5-17" name="imgIconFile" /><h3>{search || status !== "all" || access !== "all" ? "Không tìm thấy file phù hợp" : "Chưa có file nào"}</h3><p>{search || status !== "all" || access !== "all" ? "Thử tìm kiếm hoặc chọn bộ lọc khác." : "Tạo đường link đầu tiên và bắt đầu chia sẻ."}</p><Button href="/create">Tạo link mới</Button></div>}
      <div className="ws-pagination"><small>Hiển thị {visible.length} trong {filtered.length} link</small><div><button aria-label="Trang trước" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>←</button>{Array.from({ length: pageCount }, (_, i) => <button key={i} className={currentPage === i + 1 ? "ws-page-active" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button aria-label="Trang sau" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>→</button></div></div>
    </Panel>
    {selected && <Panel className="ws-actions-panel"><p><strong>{selected.name}</strong><span>· Lượt truy cập: {selected.views}</span></p><div className="ws-file-actions"><Button href={`/share?file=${encodeURIComponent(selected.id)}`}><Asset screen="5-10" name="imgIconLink" />Chia sẻ</Button><Button variant="secondary" onClick={() => toast("Backend chưa hỗ trợ chỉnh sửa hoặc gia hạn link đã tạo. Hãy tạo link mới với cài đặt mong muốn.")}>Chỉnh quyền / gia hạn</Button><Button variant="danger" onClick={() => { setActionError(""); setModal("delete"); }}>Xóa link</Button></div></Panel>}
    {modal === "delete" && selected && <Modal title="Xóa đường link này?" onClose={() => setModal(null)}><p>Người nhận sẽ không thể truy cập qua link này sau khi bạn xóa.</p>{actionError && <p className="ws-error-text" role="alert">{actionError}</p>}<div className="ws-modal-actions"><Button variant="secondary" onClick={() => setModal(null)}>Giữ lại</Button><Button variant="danger" onClick={async () => { try { await apiRequest(`/links/${Number(selected.id)}`, { method: "DELETE" }); deleteFile(selected.id); setSelectedId(""); setModal(null); toast("Đã xóa đường link"); } catch (error) { setActionError(error instanceof Error ? error.message : "Không thể xóa link."); } }}>Xóa đường link</Button></div></Modal>}
    {modal === "extend" && selected && <Modal title="Gia hạn đường link" onClose={() => setModal(null)}><p>Backend hiện chưa có API gia hạn. Tạo link mới để chọn thời hạn khác.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setModal(null)}>Đóng</Button><Button href="/create">Tạo link mới</Button></div></Modal>}
  </div></WorkspaceShell>;
}

export function AnalyticsScreen() {
  const { files, user } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const analyticsFiles = [...new Map(files.map(item => [item.sourceFileId, item])).values()];
  const selectedFile = analyticsFiles.find(item => item.id === params.get("file")) ?? analyticsFiles[0];
  const [days, setDays] = useState(7);
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const requestKey = selectedFile ? `${selectedFile.id}:${days}` : "";

  useEffect(() => {
    if (!selectedFile) return;
    let active = true;
    apiRequest<LinkAnalytics>(`/links/${Number(selectedFile.id)}/analytics?days=${days}`)
      .then(result => {
        if (!active) return;
        setAnalytics(result);
        setLoadedKey(requestKey);
        setRequestError(null);
      })
      .catch(error => {
        if (!active) return;
        setRequestError({
          key: requestKey,
          message: error instanceof Error ? error.message : "Không thể tải thống kê.",
        });
      });
    return () => { active = false; };
  }, [selectedFile, days, requestKey]);

  const current = loadedKey === requestKey ? analytics : null;
  const error = requestError?.key === requestKey ? requestError.message : "";
  const loading = !!selectedFile && !current && !error;
  const formatDateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Chưa có hoạt động";
  const maxDaily = Math.max(1, ...(current?.daily.map(item => Math.max(item.view_count, item.download_count)) || []));

  return <WorkspaceShell active="analytics"><div className="ws-screen">
    <Heading screen="5-13" title="Phân tích đường link" description={selectedFile?.name || "Chọn một link để xem thống kê"} />
    {user && analyticsFiles.length > 0 && <div className="ws-analytics-controls">
    <label>File<select aria-label="Chọn file xem thống kê" value={selectedFile?.id || ""} onChange={event => router.push(`/analytics?file=${encodeURIComponent(event.target.value)}`)}>{analyticsFiles.map(item => <option key={item.sourceFileId} value={item.id}>{item.name}</option>)}</select></label>
      <label>Khoảng thời gian<select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 ngày</option><option value={30}>30 ngày</option><option value={90}>90 ngày</option></select></label>
    </div>}
    {!user && <Panel className="ws-empty"><h2>Đăng nhập để xem thống kê</h2><p>Thống kê chỉ hiển thị cho chủ sở hữu link.</p><Button href="/login">Đăng nhập</Button></Panel>}
    {user && analyticsFiles.length === 0 && <Panel className="ws-empty"><h2>Chưa có link nào</h2><p>Tạo link để bắt đầu ghi nhận lượt xem và lượt tải.</p><Button href="/create">Tạo link mới</Button></Panel>}
    {selectedFile && <Stats items={[
      { label: "LƯỢT XEM", value: current?.totals.view_count ?? (loading ? "…" : "—"), note: `${days} ngày gần nhất` },
      { label: "LƯỢT TẢI", value: current?.totals.download_count ?? (loading ? "…" : "—"), note: `${days} ngày gần nhất` },
      { label: "NGƯỜI TRUY CẬP DUY NHẤT", value: current?.totals.unique_visitors ?? (loading ? "…" : "—"), note: "Tính theo mã ẩn danh trên trình duyệt" },
      { label: "TRUY CẬP GẦN NHẤT", value: current ? formatDateTime(current.all_time.last_accessed_at) : loading ? "…" : "—", note: "Tính từ hoạt động xem hoặc tải" },
    ]} />}
    {error && <Panel className="ws-analytics-error" role="alert"><p>{error}</p></Panel>}
    {current && <p className="ws-analytics-all-time">Toàn thời gian: {current.all_time.view_count} lượt xem · {current.all_time.download_count} lượt tải · {current.all_time.unique_visitors} người truy cập duy nhất</p>}
    {selectedFile && <Panel className="ws-chart-panel"><div className="ws-panel-heading"><h2>Hoạt động theo ngày</h2><div className="ws-chart-legend"><span className="ws-badge ws-primary">● Lượt xem</span><span className="ws-badge ws-cyan">● Lượt tải</span></div></div>
      {current ? <div className="ws-analytics-chart" role="img" aria-label={`Biểu đồ lượt xem và lượt tải trong ${days} ngày`}>
        {current.daily.map(item => <div className="ws-analytics-day" key={item.date} title={`${item.date}: ${item.view_count} lượt xem, ${item.download_count} lượt tải`}>
          <div className="ws-analytics-bars"><span className="ws-analytics-view-bar" style={{ height: `${item.view_count / maxDaily * 100}%` }} /><span className="ws-analytics-download-bar" style={{ height: `${item.download_count / maxDaily * 100}%` }} /></div>
          <small>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${item.date}T00:00:00Z`))}</small>
          <span className="ws-sr-only">{item.view_count} lượt xem, {item.download_count} lượt tải</span>
        </div>)}
      </div> : loading ? <p className="ws-analytics-placeholder">Đang tải dữ liệu thống kê…</p> : error ? <p className="ws-analytics-placeholder">Không có dữ liệu để hiển thị.</p> : null}
    </Panel>}
    <div className="ws-two-columns">
      {selectedFile && <Panel className="ws-recent"><h2>Hoạt động gần đây</h2>
        {!current && loading && <p>Đang tải hoạt động…</p>}
        {current?.recent_activity.map((activity, index) => <p className="ws-activity-row" key={`${activity.occurred_at}-${activity.event_type}-${index}`}><span>{activity.event_type === "view" ? "Lượt xem link" : "Tải file"}</span><time dateTime={activity.occurred_at}>{formatDateTime(activity.occurred_at)}</time></p>)}
        {current?.recent_activity.length === 0 && <p>Chưa có hoạt động trong kỳ thống kê.</p>}
      </Panel>}
      {selectedFile && <Panel className="ws-link-controls"><h2>Link đang xem</h2><p>{current?.file.share_path || selectedFile.sharePath || selectedFile.url}</p><Button href={`/share?file=${encodeURIComponent(selectedFile.id)}`}><Asset screen="5-13" name="imgIconLink" />Mở trang chia sẻ</Button></Panel>}
    </div>
  </div></WorkspaceShell>;
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="ws-password-field">{label}<span><input required type={visible ? "text" : "password"} autoComplete={label === "Mật khẩu hiện tại" ? "current-password" : "new-password"} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /><button type="button" aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}><Asset screen="5-15" name="imgIconEye" /></button></span></label>;
}

export function SettingsScreen() {
  const { user, updateUser, signOut, theme, setTheme, toast } = useApp();
  const router = useRouter();
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? user?.name ?? "Minh Lâm";
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [logout, setLogout] = useState(false);
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileError("");
    try {
      const profile = await apiRequest<UserProfile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ display_name: name.trim() }),
      });
      updateUser(profile);
      setEditedName(null);
      toast("Đã cập nhật tên hiển thị.");
    } catch (requestError) {
      setProfileError(requestError instanceof Error ? requestError.message : "Không thể cập nhật tên.");
    }
  }
  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) { setError("Sử dụng ít nhất 8 ký tự, gồm chữ và số."); return; }
    if (password !== confirm) { setError("Mật khẩu xác nhận chưa khớp."); return; }
    setError("");
    try {
      await apiRequest("/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPassword, new_password: password, confirm_password: confirm }),
      });
      setPassword("");
      setConfirm("");
      setCurrentPassword("");
      toast("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      signOut();
      router.push("/login");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể đổi mật khẩu.");
    }
  }
  return <WorkspaceShell active="settings"><div className="ws-screen"><Heading screen="5-15" title="Cài đặt tài khoản" description="Cập nhật thông tin cá nhân và bảo mật của bạn." /><div className="ws-two-columns"><div className="ws-settings-main"><Panel className="ws-profile"><h2>Thông tin cá nhân</h2><div className="ws-identity"><span className="ws-badge ws-cyan ws-initials">{(user?.name || "Tài khoản").split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{user?.name || "Tài khoản"}</strong><small>{user?.email || "Chưa đăng nhập"}</small></div></div><form className="ws-stack" onSubmit={saveProfile}><Field label="Tên hiển thị" value={name} required onChange={event => setEditedName(event.target.value)} />{profileError && <small className="ws-error-text" role="alert">{profileError}</small>}<Button type="submit" className="ws-save-profile" disabled={!name.trim()}>Lưu thay đổi</Button></form></Panel><Panel className="ws-security"><h2>Bảo mật</h2><form className="ws-stack" onSubmit={updatePassword}><PasswordField label="Mật khẩu hiện tại" value={currentPassword} onChange={setCurrentPassword} /><div className="ws-password-columns"><PasswordField label="Mật khẩu mới" placeholder="Nhập mật khẩu mới" value={password} onChange={setPassword} /><PasswordField label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu" value={confirm} onChange={setConfirm} /></div><small className={error ? "ws-error-text" : "ws-subtle"} role={error ? "alert" : undefined}>{error || "Sử dụng ít nhất 8 ký tự, gồm chữ và số."}</small><Button variant="secondary" type="submit" className="ws-change-password">Đổi mật khẩu</Button></form></Panel><Panel className="ws-theme"><h2>Giao diện</h2><p>Chọn giao diện phù hợp với không gian làm việc của bạn.</p><div className="ws-theme-options"><Button variant={theme === "dark" ? "primary" : "secondary"} onClick={() => setTheme("dark")}>Tối</Button><Button variant={theme === "light" ? "primary" : "secondary"} onClick={() => setTheme("light")}>Sáng</Button></div></Panel></div><Panel className="ws-plan"><span className="ws-badge ws-cyan">TÀI KHOẢN CÁ NHÂN</span><h2>Không gian của bạn</h2><strong className="ws-storage-value">Tối đa 500 MB / file</strong><p>{user ? user.email : "Chưa đăng nhập"}</p><hr /><ul>{["Quản lý quyền truy cập", "Thống kê số lượt truy cập và tải"].map(text => <li key={text}><Asset screen="5-15" name="imgIconCheck" />{text}</li>)}</ul><hr /><Button variant="danger" onClick={() => setLogout(true)}>Đăng xuất</Button><small>Đăng xuất khỏi phiên làm việc này.</small></Panel></div>{logout && <Modal title="Đăng xuất khỏi xFile?" onClose={() => setLogout(false)}><p>Bạn có thể đăng nhập lại để tiếp tục quản lý file.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setLogout(false)}>Hủy</Button><Button variant="danger" onClick={() => { signOut(); router.push("/login"); }}>Đăng xuất</Button></div></Modal>}</div></WorkspaceShell>;
}

const notificationList = [{ id: "expiry-proposal", title: "Project proposal.pdf sắp hết hạn", description: "Link sẽ hết hạn trong 18 giờ. Gia hạn để người nhận tiếp tục truy cập.", time: "10 phút trước", action: "Gia hạn link", icon: "imgIconClock", kind: "extend" }, { id: "expiry-report", title: "Báo cáo tháng 9.xlsx sắp hết hạn", description: "Link sẽ hết hạn trong 23 giờ. Kiểm tra trước khi gửi cho người nhận mới.", time: "35 phút trước", action: "Xem link", icon: "imgIconClock", kind: "view" }, { id: "reported", title: "Có báo cáo về một đường link", description: "Một người nhận đã báo cáo Sprint assets.zip. Vui lòng kiểm tra nội dung chia sẻ.", time: "1 giờ trước", action: "Xem báo cáo", icon: "imgIconBell2", kind: "report" }, { id: "joined", title: "Linh Trần đã tham gia Design Team", description: "Nhóm hiện có 4 thành viên. Bạn có thể điều chỉnh vai trò trong quản lý nhóm.", time: "Hôm qua", action: "Quản lý nhóm", icon: "imgIconTeam1", kind: "team" }];

export function NotificationsScreen() {
  const { files, updateFile, toast } = useApp();
  const router = useRouter();
  const [read, setRead] = useState<string[]>(["joined"]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("all");
  const [modal, setModal] = useState<"extend" | "report" | "view" | null>(null);
  const [expires, setExpires] = useState("2026-11-07");
  // Hydrate browser persistence after the server's deterministic first render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem("xfile-notifications-read") || "null") as string[] | null; if (Array.isArray(stored)) setRead(stored); } catch { /* Keep initial unread state. */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem("xfile-notifications-read", JSON.stringify(read)); }, [read, loaded]);
  const unread = notificationList.filter(item => !read.includes(item.id)).length;
  const visible = notificationList.filter(item => tab === "all" || !read.includes(item.id));
  const proposal = files.find(file => file.name === "Project proposal.pdf");
  const sprint = files.find(file => file.name === "Sprint assets.zip");
  function action(item: typeof notificationList[number]) { setRead(current => [...new Set([...current, item.id])]); if (item.kind === "team") router.push("/teams"); else setModal(item.kind as "extend" | "report" | "view"); }
  return <WorkspaceShell active="notifications"><div className="ws-screen"><Heading screen="5-16" title="Thông báo" description="Những cập nhật cần bạn chú ý." /><div className="ws-notification-tabs"><Button variant={tab === "all" ? "primary" : "secondary"} onClick={() => setTab("all")}>Tất cả</Button><Button variant={tab === "unread" ? "primary" : "secondary"} onClick={() => setTab("unread")}>Chưa đọc · {unread}</Button><Button variant="ghost" className="ws-mark-read" onClick={() => { setRead(notificationList.map(item => item.id)); toast("Đã đánh dấu tất cả thông báo là đã đọc"); }}>Đánh dấu đã đọc</Button></div><Panel className="ws-notifications">{visible.map(item => <article className={`ws-notification ${read.includes(item.id) ? "ws-read" : ""}`} key={item.id}><span className="ws-notification-icon"><Asset screen="5-16" name={item.icon} /></span><div><h2>{item.title}</h2><p>{item.description}</p><small>{item.time}</small></div><Button variant="secondary" onClick={() => action(item)}>{item.action}</Button></article>)}{visible.length === 0 && <div className="ws-empty"><h2>Bạn đã đọc tất cả thông báo</h2><p>Những cập nhật mới sẽ xuất hiện tại đây.</p><Button variant="secondary" onClick={() => setTab("all")}>Xem tất cả thông báo</Button></div>}</Panel>
    {modal === "extend" && <Modal title="Gia hạn đường link" onClose={() => setModal(null)}><p>Project proposal.pdf</p><form className="ws-stack" onSubmit={event => { event.preventDefault(); if (proposal) updateFile(proposal.id, { expiresAt: expires, status: "active" }); toast("Đã gia hạn đường link"); setModal(null); }}><Field label="Thời hạn truy cập mới" type="date" min={new Date().toISOString().slice(0, 10)} value={expires} required onChange={event => setExpires(event.target.value)} /><div className="ws-modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(null)}>Hủy</Button><Button type="submit">Gia hạn link</Button></div></form></Modal>}
    {modal === "report" && <Modal title="Báo cáo đường link" onClose={() => setModal(null)}><p>Sprint assets.zip · Lý do: Nội dung không phù hợp</p><div className="ws-modal-actions"><Button variant="secondary" href={`/analytics?file=${encodeURIComponent(sprint?.id ?? "")}`}>Xem file</Button><Button variant="danger" onClick={() => { if (sprint) updateFile(sprint.id, { status: "disabled" }); toast("Đã vô hiệu hóa đường link"); setModal(null); }}>Vô hiệu hóa link</Button></div></Modal>}
    {modal === "view" && <Modal title="Báo cáo tháng 9.xlsx" onClose={() => setModal(null)}><p>Link sẽ hết hạn trong 23 giờ.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setModal(null)}>Đóng</Button><Button href="/create">Tạo link mới</Button></div></Modal>}
  </div></WorkspaceShell>;
}

export function UIStatesScreen() {
  const { toast } = useApp();
  const [cancelled, setCancelled] = useState(false);
  const [errorEmail, setErrorEmail] = useState("minhlam@");
  const [deleted, setDeleted] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(errorEmail);
  return <main className="ws-ui-states"><Heading screen="5-17" title="Rõ ràng trong từng tương tác" description="Biểu mẫu, tiến trình tải lên và phản hồi hệ thống." action={false} /><p className="ws-ui-eyebrow">xFile PRISM / TRẠNG THÁI</p><div className="ws-field-states"><Panel><h2>Mặc định</h2><Field label="Email người nhận" placeholder="Nhập email người nhận" /></Panel><Panel><h2>Đang focus</h2><Field label="Email người nhận" defaultValue="minhlam@example.com" className="ws-force-focus" /></Panel><Panel><h2>Có lỗi</h2><Field label="Email người nhận" value={errorEmail} aria-invalid={!valid} className={valid ? "" : "ws-force-error"} onChange={event => setErrorEmail(event.target.value)} />{!valid && <small className="ws-error-text">Vui lòng kiểm tra lại thông tin.</small>}</Panel><Panel><h2>Vô hiệu hóa</h2><Field label="Email người nhận" disabled placeholder="Chọn quyền Email trước" /></Panel></div><div className="ws-upload-states"><Panel><Asset screen="5-17" name="imgIconUpload" /><h2>{cancelled ? "Đã hủy tải lên" : "Đang tải lên · 64%"}</h2><p>Sprint assets.zip · {cancelled ? "0" : "274"} / 428 MB</p><div className="ws-progress ws-upload-progress"><span style={{ width: cancelled ? "0%" : "64%" }} /></div><Button variant="secondary" onClick={() => { setCancelled(!cancelled); toast(cancelled ? "Đã tiếp tục tải lên bản mẫu" : "Đã hủy tải lên"); }}>{cancelled ? "Tải lên lại" : "Hủy tải lên"}</Button></Panel><Panel><h2 className="ws-error-text">File vượt quá giới hạn</h2><p>File 620 MB vượt mức 500 MB của tài khoản. Chọn file nhỏ hơn để tiếp tục.</p><Button variant="secondary" href="/create">Chọn file khác</Button></Panel><Panel><Asset screen="5-17" name="imgIconFile" /><h2>Chưa có file nào</h2><p>Tạo đường link đầu tiên và bắt đầu chia sẻ.</p><Button href="/create">Tạo link mới</Button></Panel></div><div className="ws-confirmation-states"><Panel><h2>{deleted ? "Đã xóa đường link" : "Xóa đường link này?"}</h2><p>Người nhận sẽ không thể truy cập qua link này sau khi bạn xóa.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => { setDeleted(false); toast("Đã giữ lại đường link mẫu"); }}>Giữ lại</Button><Button variant="danger" disabled={deleted} onClick={() => { setDeleted(true); toast("Đã xóa đường link mẫu"); }}>Xóa đường link</Button></div></Panel><Panel><h2>Báo cáo đường link</h2><p>Sprint assets.zip · Lý do: Nội dung không phù hợp</p><div className="ws-modal-actions"><Button variant="secondary" href="/analytics">Xem file</Button><Button variant="danger" onClick={() => toast("Đã vô hiệu hóa đường link mẫu")}>Vô hiệu hóa link</Button></div></Panel></div></main>;
}



