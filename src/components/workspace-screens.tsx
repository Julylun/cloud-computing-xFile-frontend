"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useApp, type DemoFile } from "@/components/app-provider";
import { Button, Field, Panel, WorkspaceShell } from "@/components/ui";
import "@/styles/workspace.css";

function Asset({ screen, name, alt = "", className = "" }: { screen: string; name: string; alt?: string; className?: string }) {
  const chart = name === "imgTrafficChartEditableVectors";
  const tone = name === "imgIconPlus1" || name === "imgIconLink" || screen === "14-110" ? "ink" : name === "imgIconClock" ? "amber" : name === "imgIconBell2" ? "red" : name === "imgIconTeam1" ? "cyan" : name === "imgIconCheck" ? "green" : name === "imgIconEye" || name === "imgIconSearch" ? "muted" : "primary";
  // Keep the original export and its geometry in both themes; CSS adjusts color.
  return <img className={`ws-asset ${chart ? "ws-asset-chart" : `theme-icon theme-icon-${tone}`} ${className}`} src={`/assets/workspace/${screen}/${name}.svg`} alt={alt} />;
}

function Chart({ day, setDay }: { day: number | null; setDay: (day: number | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setScale(entries[0].contentRect.width / 1080));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="ws-chart" style={{ height: 250 * scale }} onMouseLeave={() => setDay(null)}><div className="ws-chart-art" style={{ transform: `scale(${scale})` }}><Asset screen="5-13" name="imgTrafficChartEditableVectors" alt="Biểu đồ lượt xem và lượt tải từ ngày 22 đến 28 tháng 9" /></div><div className="ws-chart-hitareas">{[22, 23, 24, 25, 26, 27, 28].map((date, index) => <button key={date} aria-label={`Hoạt động ${date}/09`} onMouseEnter={() => setDay(index)} onFocus={() => setDay(index)} onBlur={() => setDay(null)} onClick={() => setDay(index)} />)}</div>{day !== null && <div className="ws-chart-tooltip" style={{ left: `${Math.min(65, day / 7 * 100)}%` }}>{day + 22}/09 · {[31, 62, 47, 132, 108, 173, 148][day]} lượt xem · {[7, 17, 15, 46, 35, 74, 61][day]} lượt tải</div>}</div>;
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
  const { files, user, updateFile, deleteFile, toast } = useApp();
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
  const [expires, setExpires] = useState("2026-11-07");
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
  const accessLabels = { public: "Công khai", password: "Mật khẩu", email: "Theo email", private: "Nhóm Design" };
  return <WorkspaceShell active="dashboard"><div className="ws-screen">
    <Heading screen="5-10" title="Mọi file. Một không gian." description={`Chào ${user?.name || "Minh Lâm"}, đây là hoạt động chia sẻ của bạn hôm nay.`} />
    <Stats items={[{ label: "LINK ĐANG HOẠT ĐỘNG", value: Math.max(0, 21 + files.length), note: "+4 link trong tuần" }, { label: "LƯỢT XEM", value: files.reduce((sum, file) => sum + file.views, 0).toLocaleString("vi-VN"), note: "↑ 18% so với tuần trước" }, { label: "LƯỢT TẢI", value: files.reduce((sum, file) => sum + file.downloads, 0).toLocaleString("vi-VN"), note: "↑ 12% so với tuần trước" }, { label: "KHÁCH TRUY CẬP", value: "219", note: "↑ 8% so với tuần trước" }]} />
    <div className="ws-expiration"><Asset screen="5-10" name="imgIconClock" /><span>2 link sẽ hết hạn trong 24 giờ tới.</span><Link href="/notifications">Xem thông báo →</Link></div>
    <Panel className="ws-files-panel">
      <div className="ws-toolbar"><h2>File &amp; đường link</h2><label className="ws-search"><Asset screen="5-10" name="imgIconSearch" /><input aria-label="Tìm file" placeholder="Tìm tên file hoặc link..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><Button variant="secondary" className="ws-filter-button" aria-expanded={showFilter} onClick={() => setShowFilter(!showFilter)}>Bộ lọc</Button></div>
      {showFilter && <div className="ws-filters"><label>Trạng thái<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="near-expiry">Sắp hết hạn</option><option value="expired">Hết hạn</option><option value="disabled">Tạm dừng</option></select></label><label>Quyền truy cập<select value={access} onChange={event => { setAccess(event.target.value); setPage(1); }}><option value="all">Tất cả quyền truy cập</option>{Object.entries(accessLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Sắp xếp<select value={sort} onChange={event => setSort(event.target.value)}><option value="original">Mới nhất</option><option value="name">Tên file A–Z</option><option value="views">Lượt xem cao nhất</option></select></label><Button variant="ghost" onClick={() => { setSearch(""); setStatus("all"); setAccess("all"); setSort("original"); }}>Đặt lại</Button></div>}
      <div className="ws-table-scroll"><table className="ws-files-table"><thead><tr><th>TÊN FILE / LINK</th><th>QUYỀN TRUY CẬP</th><th>LƯỢT XEM / TẢI</th><th>HẾT HẠN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{visible.map(file => <tr key={file.id} onClick={() => setSelectedId(file.id)} className={selectedId === file.id ? "ws-row-selected" : ""}><td><div className="ws-file-name"><Asset screen="5-10" name="imgIconFile1" /><div><Link href={`/analytics?file=${encodeURIComponent(file.id)}`}>{file.name}</Link><small>{file.url.replace(/^https?:\/\//, "")}</small></div></div></td><td>{accessLabels[file.access]}</td><td className="ws-views">{file.views} / {file.downloads}</td><td>{formatDate(file.expiresAt)}</td><td><Status file={file} now={now} /></td></tr>)}</tbody></table></div>
      {visible.length === 0 && <div className="ws-empty"><Asset screen="5-17" name="imgIconFile" /><h3>{search || status !== "all" || access !== "all" ? "Không tìm thấy file phù hợp" : "Chưa có file nào"}</h3><p>{search || status !== "all" || access !== "all" ? "Thử tìm kiếm hoặc chọn bộ lọc khác." : "Tạo đường link đầu tiên và bắt đầu chia sẻ."}</p><Button href="/create">Tạo link mới</Button></div>}
      <div className="ws-pagination"><small>Hiển thị {visible.length} trong {search || status !== "all" || access !== "all" ? filtered.length : 21 + files.length} link</small><div><button aria-label="Trang trước" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>←</button>{Array.from({ length: pageCount }, (_, i) => <button key={i} className={currentPage === i + 1 ? "ws-page-active" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button aria-label="Trang sau" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>→</button></div></div>
    </Panel>
    {selected && <Panel className="ws-actions-panel"><p><strong>{selected.name}</strong><span>· Truy cập gần nhất: 5 phút trước</span></p><div className="ws-file-actions"><Button href={`/share?file=${encodeURIComponent(selected.id)}`}><Asset screen="5-10" name="imgIconLink" />Chia sẻ</Button><Button variant="secondary" href={`/create?edit=${encodeURIComponent(selected.id)}`}>Đổi đường dẫn</Button><Button variant="secondary" onClick={() => { setExpires(selected.expiresAt.slice(0, 10)); setModal("extend"); }}>Gia hạn link</Button><Button variant="secondary" onClick={() => { updateFile(selected.id, { status: selected.status === "disabled" ? "active" : "disabled" }); toast(selected.status === "disabled" ? "Đã kích hoạt đường link" : "Đã tạm vô hiệu hóa đường link"); }}>{selected.status === "disabled" ? "Kích hoạt link" : "Tạm vô hiệu hóa"}</Button><Button variant="danger" onClick={() => setModal("delete")}>Xóa link</Button></div></Panel>}
    {modal === "delete" && selected && <Modal title="Xóa đường link này?" onClose={() => setModal(null)}><p>Người nhận sẽ không thể truy cập qua link này sau khi bạn xóa.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setModal(null)}>Giữ lại</Button><Button variant="danger" onClick={() => { deleteFile(selected.id); setSelectedId(""); setModal(null); toast("Đã xóa đường link"); }}>Xóa đường link</Button></div></Modal>}
    {modal === "extend" && selected && <Modal title="Gia hạn đường link" onClose={() => setModal(null)}><p>{selected.name}</p><form className="ws-stack" onSubmit={event => { event.preventDefault(); updateFile(selected.id, { expiresAt: expires, status: "active" }); setModal(null); toast("Đã gia hạn đường link"); }}><Field type="date" label="Thời hạn truy cập mới" value={expires} min={new Date().toISOString().slice(0, 10)} required onChange={event => setExpires(event.target.value)} /><div className="ws-modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(null)}>Hủy</Button><Button type="submit">Lưu thời hạn</Button></div></form></Modal>}
  </div></WorkspaceShell>;
}

export function AnalyticsScreen() {
  const { files } = useApp();
  const params = useSearchParams();
  const file = files.find(item => item.id === params.get("file")) ?? files[0];
  const [day, setDay] = useState<number | null>(null);
  return <WorkspaceShell active="analytics"><div className="ws-screen"><Heading screen="5-13" title="Hiểu cách file được chia sẻ" description={`${file?.name || "Brand Guidelines.pdf"} · ${file?.url.replace(/^https?:\/\//, "") || "xfile.app/minhlam/brand-kit"}`} /><Stats items={[{ label: "LƯỢT XEM", value: file?.views ?? 428, note: "↑ 24% trong 7 ngày" }, { label: "LƯỢT TẢI", value: file?.downloads ?? 126, note: `Tỷ lệ tải ${file?.views ? (file.downloads / file.views * 100).toFixed(1).replace(".", ",") : "29,4"}%` }, { label: "KHÁCH DUY NHẤT", value: 89, note: "32 khách quay lại" }, { label: "TRUY CẬP GẦN NHẤT", value: "5 phút", note: "28/09/2026 · 10:25" }]} />
    <Panel className="ws-chart-panel"><div className="ws-panel-heading"><h2>Hoạt động trong 7 ngày</h2><div className="ws-chart-legend"><span className="ws-badge ws-primary">● Lượt xem</span><span className="ws-badge ws-cyan">● Lượt tải</span></div></div><Chart day={day} setDay={setDay} /><div className="ws-chart-dates">{[22, 23, 24, 25, 26, 27, 28].map(date => <small key={date}>{date}/09</small>)}</div></Panel>
    <div className="ws-two-columns"><Panel className="ws-recent"><h2>Truy cập gần đây</h2>{["10:25   ·   Khách #089   ·   Xem file", "10:18   ·   Khách #088   ·   Tải xuống", "09:46   ·   Khách #087   ·   Xem file"].map(text => <p key={text}>{text}</p>)}</Panel><Panel className="ws-link-controls"><h2>Quản lý đường link</h2><Button variant="secondary" href={`/create?edit=${encodeURIComponent(file?.id ?? "")}`}>Chỉnh sửa quyền truy cập</Button><Button href={`/share?file=${encodeURIComponent(file?.id ?? "")}`}><Asset screen="5-13" name="imgIconLink" />Chia sẻ file</Button></Panel></div>
  </div></WorkspaceShell>;
}

type Member = { id: string; name: string; email: string; role: string };
type Team = { id: string; name: string; members: Member[] };
const defaultTeams: Team[] = [{ id: "design", name: "Design Team", members: [{ id: "minh", name: "Minh Lâm", email: "minhlam@example.com", role: "Chủ nhóm" }, { id: "an", name: "An Nguyễn", email: "an.nguyen@example.com", role: "Quản trị viên" }, { id: "linh", name: "Linh Trần", email: "linh.tran@example.com", role: "Thành viên" }, { id: "huy", name: "Huy Phạm", email: "huy.pham@example.com", role: "Chỉ xem" }] }];

export function TeamsScreen() {
  const { toast, files, user } = useApp();
  const [teams, setTeams] = useState<Team[]>(defaultTeams);
  const [teamId, setTeamId] = useState("design");
  const [teamName, setTeamName] = useState("Design Team");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Thành viên");
  const [createModal, setCreateModal] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [dissolve, setDissolve] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmails, setNewEmails] = useState("");
  const [loaded, setLoaded] = useState(false);
  const inviteRef = useRef<HTMLInputElement>(null);
  // Hydrate browser persistence after the server's deterministic first render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const stored = localStorage.getItem("xfile-teams"); if (stored) { const value = JSON.parse(stored) as Team[]; if (Array.isArray(value) && value.every(team => typeof team.name === "string" && Array.isArray(team.members))) { setTeams(value); setTeamId(value[0]?.id ?? ""); setTeamName(value[0]?.name ?? ""); } } } catch { /* Keep demo data when storage is unavailable or invalid. */ } setLoaded(true); }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("xfile-teams", JSON.stringify(teams)); } catch { /* Keep the group available in this session if storage is unavailable. */ }
    window.dispatchEvent(new Event("xfile-share-settings"));
  }, [teams, loaded]);
  const team = teams.find(item => item.id === teamId) ?? teams[0];
  const sprint = files.find(file => file.name === "Sprint assets.zip");
  function changeMembers(members: Member[]) { setTeams(current => current.map(item => item.id === team?.id ? { ...item, members } : item)); }
  function invite(event: FormEvent) { event.preventDefault(); if (!team) return; if (team.members.some(member => member.email === email.trim())) { toast("Email này đã có trong nhóm"); return; } changeMembers([...team.members, { id: crypto.randomUUID(), name: email.split("@")[0], email: email.trim(), role }]); setEmail(""); toast("Đã thêm thành viên vào nhóm mẫu"); }
  function create(event: FormEvent) { event.preventDefault(); if (!newName.trim()) { toast("Vui lòng nhập tên nhóm"); return; } const emails = newEmails.split(",").map(value => value.trim()).filter(Boolean); if (emails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) { toast("Vui lòng kiểm tra lại email mời"); return; } const newTeam: Team = { id: crypto.randomUUID(), name: newName.trim(), members: [{ id: "minh", name: user?.name || "Minh Lâm", email: user?.email || "minhlam@example.com", role: "Chủ nhóm" }, ...emails.map(value => ({ id: crypto.randomUUID(), name: value.split("@")[0], email: value, role: "Thành viên" }))] }; setTeams(current => [...current, newTeam]); setTeamId(newTeam.id); setTeamName(newTeam.name); setCreateModal(false); setNewName(""); setNewEmails(""); toast("Đã tạo nhóm mới"); }
  return <WorkspaceShell active="teams"><div className="ws-screen"><Heading screen="5-14" title="Làm việc cùng nhau" description="Quản lý thành viên, quyền truy cập và file dùng chung." action={false} /><div className="ws-team-select"><select aria-label="Chọn nhóm" value={team?.id || ""} onChange={event => { setTeamId(event.target.value); setTeamName(teams.find(item => item.id === event.target.value)?.name ?? ""); }}>{teams.length === 0 && <option value="">Chưa có nhóm</option>}{teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="ws-badge ws-cyan">{team?.members.length ?? 0} thành viên</span><Button className="ws-new-team" onClick={() => setCreateModal(true)}><Asset screen="5-14" name="imgIconPlus1" />Tạo nhóm mới</Button></div>
    {team ? <><div className="ws-team-columns"><Panel className="ws-members-panel"><div className="ws-panel-heading"><h2>Thành viên</h2><Button onClick={() => inviteRef.current?.focus()}><Asset screen="5-14" name="imgIconPlus1" />Mời thành viên</Button></div><div className="ws-members">{team.members.map(member => <div className="ws-member" key={member.id}><span className="ws-badge ws-cyan ws-initials">{member.name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="ws-member-info"><strong>{member.name}</strong><small>{member.email}</small></div>{member.role === "Chủ nhóm" ? <span className="ws-owner">Chủ nhóm</span> : <><select aria-label={`Vai trò của ${member.name}`} value={member.role} onChange={event => { changeMembers(team.members.map(item => item.id === member.id ? { ...item, role: event.target.value } : item)); toast("Đã cập nhật vai trò"); }}><option>Quản trị viên</option><option>Thành viên</option><option>Chỉ xem</option></select><button className="ws-remove" onClick={() => setRemoveId(member.id)}>Xóa</button></>}</div>)}</div><form className="ws-invite" onSubmit={invite}><label>Email thành viên mới<input ref={inviteRef} type="email" placeholder="name@example.com" value={email} required onChange={event => setEmail(event.target.value)} /></label><label>Vai trò<select value={role} onChange={event => setRole(event.target.value)}><option>Thành viên</option><option>Quản trị viên</option><option>Chỉ xem</option></select></label>{email && <Button type="submit">Gửi lời mời</Button>}</form><small className="ws-subtle">Chỉ quản trị viên và chủ nhóm được quản lý thành viên.</small></Panel>
    <Panel className="ws-team-storage"><h2>Kho lưu trữ chung</h2><strong className="ws-storage-value">3,2 GB</strong><p>đã dùng trong 10 GB</p><div className="ws-progress"><span style={{ width: "32%" }} /></div><hr /><h3>Cài đặt nhóm</h3><Field label="Tên nhóm" value={teamName} onChange={event => setTeamName(event.target.value)} /><Button variant="secondary" disabled={!teamName.trim()} onClick={() => { setTeams(current => current.map(item => item.id === team.id ? { ...item, name: teamName.trim() } : item)); toast("Đã lưu tên nhóm"); }}>Lưu tên nhóm</Button><Button href={`/share?team=${encodeURIComponent(team.id)}`}><Asset screen="5-14" name="imgIconLink" />Chia sẻ link nhóm</Button><small>Link nhóm có mã QR và thời hạn truy cập.</small><hr /><Button variant="danger" onClick={() => setDissolve(true)}>Giải tán nhóm</Button></Panel></div>
    <Panel className="ws-shared-files"><h2>Link nội bộ nhóm</h2><div className="ws-team-file"><div className="ws-team-file-info"><span className="ws-file-type"><Asset screen="5-14" name="imgIconFile1" /></span><div><strong>Sprint assets.zip</strong><small>428 MB · Linh Trần · Chỉ {team.name}</small></div></div><span className="ws-badge ws-amber">Hết hạn 03/10</span><Button variant="secondary" href={`/analytics?file=${encodeURIComponent(sprint?.id ?? "")}`}>Xem thống kê</Button><Button href={`/share?file=${encodeURIComponent(sprint?.id ?? "")}`}>Chia sẻ</Button></div></Panel></> : <Panel className="ws-empty"><h2>Chưa có nhóm nào</h2><p>Tạo một không gian chung cho file và thành viên của bạn.</p><Button onClick={() => setCreateModal(true)}>Tạo nhóm mới</Button></Panel>}
    {createModal && <Modal title="Tạo nhóm mới" eyebrow="LÀM VIỆC CÙNG NHAU" onClose={() => setCreateModal(false)}><p>Một không gian chung cho file và thành viên của bạn.</p><form className="ws-stack" onSubmit={create}><Field label="Tên nhóm" placeholder="Design Team" value={newName} autoFocus required onChange={event => setNewName(event.target.value)} /><Field label="Mời qua email" placeholder="Nhập email, phân cách bằng dấu phẩy" value={newEmails} onChange={event => setNewEmails(event.target.value)} /><small>Bạn có thể mời thêm thành viên sau khi tạo nhóm.</small><div className="ws-modal-actions"><Button variant="secondary" type="button" onClick={() => setCreateModal(false)}>Hủy</Button><Button type="submit"><Asset screen="14-110" name="imgIconPlus" />Tạo nhóm</Button></div></form></Modal>}
    {removeId && team && <Modal title="Xóa thành viên khỏi nhóm?" onClose={() => setRemoveId(null)}><p>{team.members.find(member => member.id === removeId)?.name} sẽ không thể truy cập file nội bộ của nhóm.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setRemoveId(null)}>Giữ lại</Button><Button variant="danger" onClick={() => { changeMembers(team.members.filter(member => member.id !== removeId)); setRemoveId(null); toast("Đã xóa thành viên khỏi nhóm"); }}>Xóa thành viên</Button></div></Modal>}
    {dissolve && team && <Modal title="Giải tán nhóm này?" onClose={() => setDissolve(false)}><p>Thành viên sẽ không thể truy cập kho lưu trữ của {team.name}.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setDissolve(false)}>Giữ lại</Button><Button variant="danger" onClick={() => { const next = teams.filter(item => item.id !== team.id); setTeams(next); setTeamId(next[0]?.id ?? ""); setTeamName(next[0]?.name ?? ""); setDissolve(false); toast("Đã giải tán nhóm"); }}>Giải tán nhóm</Button></div></Modal>}
  </div></WorkspaceShell>;
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="ws-password-field">{label}<span><input required type={visible ? "text" : "password"} autoComplete={label === "Mật khẩu hiện tại" ? "current-password" : "new-password"} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /><button type="button" aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}><Asset screen="5-15" name="imgIconEye" /></button></span></label>;
}

export function SettingsScreen() {
  const { user, signIn, signOut, theme, setTheme, toast } = useApp();
  const router = useRouter();
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? user?.name ?? "Minh Lâm";
  const [currentPassword, setCurrentPassword] = useState("minhlam2026");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [logout, setLogout] = useState(false);
  function updatePassword(event: FormEvent) { event.preventDefault(); if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) { setError("Sử dụng ít nhất 8 ký tự, gồm chữ và số."); return; } if (password !== confirm) { setError("Mật khẩu xác nhận chưa khớp."); return; } setError(""); setPassword(""); setConfirm(""); setCurrentPassword(""); toast("Đã xác nhận đổi mật khẩu trong bản giao diện mẫu"); }
  return <WorkspaceShell active="settings"><div className="ws-screen"><Heading screen="5-15" title="Cài đặt tài khoản" description="Cập nhật thông tin cá nhân và bảo mật của bạn." /><div className="ws-two-columns"><div className="ws-settings-main"><Panel className="ws-profile"><h2>Thông tin cá nhân</h2><div className="ws-identity"><span className="ws-badge ws-cyan ws-initials">{(user?.name || "Minh Lâm").split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{user?.name || "Minh Lâm"}</strong><small>{user?.email || "minhlam@example.com"}</small></div></div><form className="ws-stack" onSubmit={event => { event.preventDefault(); signIn(name.trim()); toast("Đã lưu thông tin cá nhân"); }}><Field label="Tên hiển thị" value={name} required onChange={event => setEditedName(event.target.value)} /><Button type="submit" className="ws-save-profile" disabled={!name.trim()}>Lưu thay đổi</Button></form></Panel><Panel className="ws-security"><h2>Bảo mật</h2><form className="ws-stack" onSubmit={updatePassword}><PasswordField label="Mật khẩu hiện tại" value={currentPassword} onChange={setCurrentPassword} /><div className="ws-password-columns"><PasswordField label="Mật khẩu mới" placeholder="Nhập mật khẩu mới" value={password} onChange={setPassword} /><PasswordField label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu" value={confirm} onChange={setConfirm} /></div><small className={error ? "ws-error-text" : "ws-subtle"}>{error || "Sử dụng ít nhất 8 ký tự, gồm chữ và số."}</small><Button variant="secondary" type="submit" className="ws-change-password">Đổi mật khẩu</Button></form></Panel><Panel className="ws-theme"><h2>Giao diện</h2><p>Chọn giao diện phù hợp với không gian làm việc của bạn.</p><div className="ws-theme-options"><Button variant={theme === "dark" ? "primary" : "secondary"} onClick={() => setTheme("dark")}>Tối</Button><Button variant={theme === "light" ? "primary" : "secondary"} onClick={() => setTheme("light")}>Sáng</Button></div></Panel></div><Panel className="ws-plan"><span className="ws-badge ws-cyan">TÀI KHOẢN CÁ NHÂN</span><h2>Không gian của bạn</h2><strong className="ws-storage-value">1,8 / 5 GB</strong><p>Dung lượng đã sử dụng</p><hr /><ul>{["File tối đa 500 MB", "Quản lý quyền truy cập", "Thống kê từng file", "Chia sẻ theo nhóm"].map(text => <li key={text}><Asset screen="5-15" name="imgIconCheck" />{text}</li>)}</ul><hr /><Button variant="danger" onClick={() => setLogout(true)}>Đăng xuất</Button><small>Đăng xuất khỏi phiên làm việc này.</small></Panel></div>{logout && <Modal title="Đăng xuất khỏi xFile?" onClose={() => setLogout(false)}><p>Bạn có thể đăng nhập lại để tiếp tục quản lý file.</p><div className="ws-modal-actions"><Button variant="secondary" onClick={() => setLogout(false)}>Hủy</Button><Button variant="danger" onClick={() => { signOut(); router.push("/login"); }}>Đăng xuất</Button></div></Modal>}</div></WorkspaceShell>;
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



