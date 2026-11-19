"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Panel, WorkspaceShell } from "@/components/ui";
import { apiRequest, apiRequestFile } from "@/lib/api";
import "@/styles/workspace.css";

type TeamRole = "owner" | "admin" | "member";
type TeamMember = {
  user_id: number;
  email: string;
  display_name: string;
  role: TeamRole;
  joined_at: string;
};
type Team = {
  id: number;
  name: string;
  owner_id: number;
  members: TeamMember[];
  created_at: string;
};
type TeamLink = {
  id: number;
  slug: string;
  access_mode: string;
  expiry_mode: string;
  expires_at: string | null;
  status: string;
  download_count: number;
  full_url: string;
  file: { id: number; original_name: string; size_bytes: string; mime_type: string };
  uploader: { id: number; username: string; display_name: string; email: string };
  shared_at: string;
};
type TeamQr = {
  team_id: number;
  link_id: number;
  slug: string;
  share_url: string;
  download_url: string;
  qr_code: string;
  expires_at: string | null;
};

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

function saveBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function TeamsScreen() {
  const { accessToken, files, toast, user } = useApp();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState("");
  const [links, setLinks] = useState<TeamLink[]>([]);
  const [linksTeamId, setLinksTeamId] = useState<number | null>(null);
  const [teamNameEdit, setTeamNameEdit] = useState<{ teamId: number; value: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [shareLinkId, setShareLinkId] = useState("");
  const [shareExpiry, setShareExpiry] = useState("");
  const [qrContent, setQrContent] = useState("");
  const [qrPassword, setQrPassword] = useState("");
  const [qr, setQr] = useState<TeamQr | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [linksError, setLinksError] = useState<{ teamId: number; message: string } | null>(null);
  const [pending, setPending] = useState("");
  const inviteRef = useRef<HTMLInputElement>(null);
  const userTeams = loadedUserId === user?.id ? teams : [];
  const teamsLoading = !!user && loadedUserId !== user.id && !error;
  const team = userTeams.find(item => String(item.id) === teamId);
  const teamName = teamNameEdit && teamNameEdit.teamId === team?.id ? teamNameEdit.value : team?.name ?? "";
  const currentLinks = linksTeamId === team?.id ? links : [];
  const currentLinksError = linksError && linksError.teamId === team?.id ? linksError.message : "";
  const linksLoading = !!team && linksTeamId !== team.id && !currentLinksError;
  const activeQr = qr?.team_id === team?.id ? qr : null;
  const currentMember = team?.members.find(member => member.user_id === user?.id);
  const isOwner = team?.owner_id === user?.id;
  const isManager = isOwner || currentMember?.role === "admin";
  const availableFiles = files.filter(file =>
    /^\d+$/.test(file.id) && !currentLinks.some(link => link.id === Number(file.id)),
  );

  useEffect(() => {
    if (!user || !accessToken) return;
    let active = true;
    apiRequest<Team[]>("/teams").then(result => {
      if (!active) return;
      setTeams(result);
      setLoadedUserId(user.id);
      setTeamId(current => result.some(item => String(item.id) === current) ? current : String(result[0]?.id ?? ""));
      setError("");
    }).catch(requestError => {
      if (active) setError(errorMessage(requestError, "Không thể tải danh sách nhóm."));
    });
    return () => { active = false; };
  }, [accessToken, user]);

  const selectedTeamId = team?.id;
  useEffect(() => {
    if (selectedTeamId === undefined || !accessToken) return;
    let active = true;
    apiRequest<TeamLink[]>(`/teams/${selectedTeamId}/links`).then(result => {
      if (!active) return;
      setLinks(result);
      setLinksTeamId(selectedTeamId);
      setLinksError(null);
    }).catch(requestError => {
      if (active) setLinksError({ teamId: selectedTeamId, message: errorMessage(requestError, "Không thể tải links của nhóm.") });
    });
    return () => { active = false; };
  }, [accessToken, selectedTeamId]);

  function applyTeam(updated: Team) {
    setTeams(current => current.some(item => item.id === updated.id)
      ? current.map(item => item.id === updated.id ? updated : item)
      : [...current, updated]);
    if (user) setLoadedUserId(user.id);
    setTeamId(String(updated.id));
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    setPending("create");
    setError("");
    try {
      const created = await apiRequest<Team>("/teams", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      applyTeam(created);
      setNewName("");
      setShowCreate(false);
      toast("Đã tạo nhóm.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể tạo nhóm."));
    } finally {
      setPending("");
    }
  }

  async function inviteMember(event: FormEvent) {
    event.preventDefault();
    if (!team) return;
    setPending("invite");
    setError("");
    try {
      const updated = await apiRequest<Team>(`/teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      });
      applyTeam(updated);
      setEmail("");
      toast("Đã thêm thành viên vào nhóm.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể thêm thành viên."));
    } finally {
      setPending("");
    }
  }

  async function changeRole(member: TeamMember, role: "admin" | "member") {
    if (!team) return;
    setPending(`role-${member.user_id}`);
    setError("");
    try {
      const updated = await apiRequest<Team>(`/teams/${team.id}/members/${member.user_id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      applyTeam(updated);
      toast("Đã cập nhật vai trò thành viên.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể cập nhật vai trò."));
    } finally {
      setPending("");
    }
  }

  async function removeMember(member: TeamMember) {
    if (!team || !window.confirm(`Xóa ${member.display_name} khỏi nhóm?`)) return;
    setPending(`remove-${member.user_id}`);
    setError("");
    try {
      const updated = await apiRequest<Team>(`/teams/${team.id}/members/${member.user_id}`, { method: "DELETE" });
      if (member.user_id === user?.id) {
        const remaining = teams.filter(item => item.id !== team.id);
        setTeams(remaining);
        setTeamId(String(remaining[0]?.id ?? ""));
        toast("Bạn đã rời nhóm.");
      } else {
        applyTeam(updated);
        toast("Đã xóa thành viên.");
      }
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể xóa thành viên."));
    } finally {
      setPending("");
    }
  }

  async function transferOwnership(userId: number) {
    if (!team || !window.confirm("Chuyển quyền chủ sở hữu cho thành viên này?")) return;
    setPending("transfer");
    setError("");
    try {
      const updated = await apiRequest<Team>(`/teams/${team.id}/transfer-ownership`, {
        method: "POST",
        body: JSON.stringify({ new_owner_user_id: userId }),
      });
      applyTeam(updated);
      toast("Đã chuyển quyền chủ sở hữu.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể chuyển quyền chủ sở hữu."));
    } finally {
      setPending("");
    }
  }

  async function renameTeam(event: FormEvent) {
    event.preventDefault();
    if (!team) return;
    setPending("rename");
    setError("");
    try {
      const updated = await apiRequest<Team>(`/teams/${team.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: teamName.trim() }),
      });
      applyTeam(updated);
      setTeamNameEdit(null);
      toast("Đã đổi tên nhóm.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể đổi tên nhóm."));
    } finally {
      setPending("");
    }
  }

  async function deleteTeam() {
    if (!team || !window.confirm(`Xóa nhóm "${team.name}"?`)) return;
    setPending("delete");
    setError("");
    try {
      await apiRequest(`/teams/${team.id}`, { method: "DELETE" });
      const remaining = teams.filter(item => item.id !== team.id);
      setTeams(remaining);
      setTeamId(String(remaining[0]?.id ?? ""));
      toast("Đã xóa nhóm.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể xóa nhóm."));
    } finally {
      setPending("");
    }
  }

  async function shareLink(event: FormEvent) {
    event.preventDefault();
    if (!team) return;
    const expiresAt = shareExpiry ? new Date(shareExpiry) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) {
      setError("Thời hạn chia sẻ phải nằm trong tương lai.");
      return;
    }
    setPending("share");
    setError("");
    try {
      const shared = await apiRequest<TeamLink>(`/teams/${team.id}/links`, {
        method: "POST",
        body: JSON.stringify({
          link_id: Number(shareLinkId),
          ...(expiresAt ? { expires_at: expiresAt.toISOString() } : {}),
        }),
      });
      setLinks(current => linksTeamId === team.id ? [shared, ...current] : [shared]);
      setLinksTeamId(team.id);
      setShareLinkId("");
      setShareExpiry("");
      toast("Đã chia sẻ link vào nhóm.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể chia sẻ link vào nhóm."));
    } finally {
      setPending("");
    }
  }

  async function removeLink(link: TeamLink) {
    if (!team || !window.confirm(`Gỡ "${link.file.original_name}" khỏi nhóm? File và link gốc sẽ không bị xóa.`)) return;
    setPending(`unlink-${link.id}`);
    setError("");
    try {
      await apiRequest(`/teams/${team.id}/links/${link.id}`, { method: "DELETE" });
      setLinks(current => current.filter(item => item.id !== link.id));
      setQr(current => current?.link_id === link.id ? null : current);
      toast("Đã gỡ link khỏi nhóm.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể gỡ link khỏi nhóm."));
    } finally {
      setPending("");
    }
  }

  async function showQr(link: TeamLink) {
    if (!team) return;
    setPending(`qr-${link.id}`);
    setError("");
    try {
      const result = await apiRequest<TeamQr>(`/teams/${team.id}/links/${link.id}/qr`);
      setQr(result);
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể tạo mã QR."));
    } finally {
      setPending("");
    }
  }

  async function downloadQrImage() {
    if (!team || !qr) return;
    setPending("qr-image");
    setError("");
    try {
      const { blob } = await apiRequestFile(`/teams/${team.id}/links/${qr.link_id}/qr/image`);
      saveBlob(blob, `qr-team-${team.id}-link-${qr.link_id}.png`);
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể tải ảnh QR."));
    } finally {
      setPending("");
    }
  }

  async function copyQrLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast("Đã sao chép đường dẫn QR.");
    } catch {
      setError("Không thể sao chép đường dẫn.");
    }
  }

  async function downloadByQr(event: FormEvent) {
    event.preventDefault();
    setPending("download-qr");
    setError("");
    try {
      const result = await apiRequestFile("/teams/download-by-qr", {
        method: "POST",
        body: JSON.stringify({ qr_content: qrContent.trim(), ...(qrPassword ? { password: qrPassword } : {}) }),
      });
      saveBlob(result.blob, result.filename || "xfile-download");
      toast("Đã tải file.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Không thể tải file bằng mã QR."));
    } finally {
      setPending("");
    }
  }

  return <WorkspaceShell active="teams"><div className="ws-screen">
    <div className="ws-heading"><div><h1>Làm việc cùng nhau</h1><p>Quản lý thành viên, link chia sẻ và mã QR của các nhóm.</p></div></div>
    {!user || !accessToken ? <Panel className="ws-empty"><h2>Đăng nhập để quản lý nhóm</h2><p>Các tính năng nhóm chỉ dành cho thành viên đã đăng nhập.</p><Button href="/login">Đăng nhập</Button></Panel> : <>
      {error && <Panel className="ws-analytics-error" role="alert"><p>{error}</p></Panel>}
      <div className="ws-team-select"><select aria-label="Chọn nhóm" value={teamId} onChange={event => setTeamId(event.target.value)}><option value="">{teamsLoading ? "Đang tải nhóm…" : "Chọn nhóm"}</option>{userTeams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{team && <span className="ws-badge ws-cyan">{team.members.length} thành viên</span>}<Button className="ws-new-team" onClick={() => setShowCreate(value => !value)}>Tạo nhóm mới</Button></div>
      {showCreate && <Panel className="ws-team-form-panel"><form onSubmit={createTeam}><label> Tên nhóm<input required maxLength={255} value={newName} onChange={event => setNewName(event.target.value)} placeholder="Ví dụ: Nhóm đồ án" /></label><Button type="submit" disabled={pending === "create"}>{pending === "create" ? "Đang tạo…" : "Tạo nhóm"}</Button></form></Panel>}
      {!team ? <Panel className="ws-empty"><h2>{teamsLoading ? "Đang tải danh sách nhóm…" : userTeams.length ? "Chọn một nhóm" : "Chưa có nhóm nào"}</h2><p>{userTeams.length ? "Chọn nhóm phía trên để xem thành viên và links." : "Tạo nhóm đầu tiên để bắt đầu chia sẻ với đồng đội."}</p>{!userTeams.length && <Button onClick={() => setShowCreate(true)}>Tạo nhóm mới</Button>}</Panel> : <>
        <div className="ws-team-columns">
          <Panel className="ws-members-panel"><div className="ws-panel-heading"><h2>Thành viên</h2>{isManager && <Button onClick={() => inviteRef.current?.focus()}>Thêm thành viên</Button>}</div>
            <div className="ws-members">{team.members.map(member => <div className="ws-member" key={member.user_id}><span className="ws-badge ws-cyan ws-initials">{member.display_name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="ws-member-info"><strong>{member.display_name || member.email}</strong><small>{member.email}</small></div>
              {member.role === "owner" ? <span className="ws-owner">Chủ sở hữu</span> : <>
                {isOwner ? <select aria-label={`Vai trò của ${member.display_name}`} value={member.role} disabled={pending === `role-${member.user_id}`} onChange={event => { void changeRole(member, event.target.value as "admin" | "member"); }}><option value="admin">Quản trị viên</option><option value="member">Thành viên</option></select> : <span className="ws-owner">{member.role === "admin" ? "Quản trị viên" : "Thành viên"}</span>}
                {isOwner && <Button variant="ghost" disabled={pending === "transfer"} onClick={() => { void transferOwnership(member.user_id); }}>Chuyển chủ</Button>}
                {(isOwner || member.user_id === user.id || currentMember?.role === "admin" && member.role === "member") && <button className="ws-remove" disabled={pending === `remove-${member.user_id}`} onClick={() => { void removeMember(member); }}>{member.user_id === user.id ? "Rời nhóm" : "Xóa"}</button>}
              </>}
            </div>)}</div>
            {isManager && <form className="ws-invite" onSubmit={inviteMember}><label>Email thành viên<input ref={inviteRef} required type="email" placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Vai trò<select value={inviteRole} onChange={event => setInviteRole(event.target.value as "member" | "admin")}><option value="member">Thành viên</option>{isOwner && <option value="admin">Quản trị viên</option>}</select></label><Button type="submit" disabled={pending === "invite"}>{pending === "invite" ? "Đang thêm…" : "Thêm thành viên"}</Button></form>}
            {!isManager && <small className="ws-subtle">Bạn có thể tự rời khỏi nhóm.</small>}
          </Panel>
          <Panel className="ws-team-storage"><h2>Cài đặt nhóm</h2>{isOwner ? <form className="ws-stack" onSubmit={renameTeam}><label>Tên nhóm<input required maxLength={255} value={teamName} onChange={event => setTeamNameEdit({ teamId: team.id, value: event.target.value })} /></label><Button type="submit" disabled={pending === "rename" || teamName.trim() === team.name}>{pending === "rename" ? "Đang lưu…" : "Lưu tên nhóm"}</Button></form> : <><strong>{team.name}</strong><p>Chỉ chủ sở hữu mới có thể đổi tên nhóm.</p></>}
            <p>{team.members.length} thành viên · Tạo ngày {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(team.created_at))}</p>
            {isOwner && <Button variant="danger" onClick={() => { void deleteTeam(); }} disabled={pending === "delete"}>Xóa nhóm</Button>}
          </Panel>
        </div>
        <Panel className="ws-shared-files ws-team-links"><div className="ws-panel-heading"><h2>Links được chia sẻ trong nhóm</h2><span className="ws-badge ws-cyan">{currentLinks.length} links</span></div>
          {currentLinksError && <p className="ws-error-text" role="alert">{currentLinksError}</p>}
          {currentLinks.map(link => <article className="ws-team-link" key={link.id}><div className="ws-team-file-info"><span className="ws-file-type">{link.file.mime_type.split("/").pop()?.toUpperCase() || "FILE"}</span><div><strong>{link.file.original_name}</strong><small>{formatSize(Number(link.file.size_bytes))} · {link.uploader.display_name} · {link.download_count} lượt tải</small><a href={link.full_url} target="_blank" rel="noreferrer">{link.full_url}</a></div></div><div className="ws-team-link-actions"><span className={`ws-badge ${link.expires_at ? "ws-amber" : "ws-green"}`}>{link.expires_at ? `Hết hạn ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(link.expires_at))}` : "Không giới hạn"}</span><Button variant="secondary" disabled={pending === `qr-${link.id}`} onClick={() => { void showQr(link); }}>Mã QR</Button>{(isManager || link.uploader.id === user.id) && <Button variant="danger" disabled={pending === `unlink-${link.id}`} onClick={() => { void removeLink(link); }}>Gỡ khỏi nhóm</Button>}</div></article>)}
          {!currentLinksError && currentLinks.length === 0 && <div className="ws-empty"><h3>{linksLoading ? "Đang tải links…" : "Chưa có link nào được chia sẻ"}</h3>{!linksLoading && <p>Chọn một link hiện có bên dưới để chia sẻ vào nhóm.</p>}</div>}
          <form className="ws-share-team-link" onSubmit={shareLink}><label>Link của bạn<select value={shareLinkId} onChange={event => setShareLinkId(event.target.value)}><option value="">Chọn link cần chia sẻ</option>{availableFiles.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label><label>ID link khác (dành cho quản trị viên)<input type="number" min={1} value={shareLinkId} onChange={event => setShareLinkId(event.target.value)} placeholder="ID link" /></label><label>Hạn sử dụng (không bắt buộc)<input type="datetime-local" value={shareExpiry} onChange={event => setShareExpiry(event.target.value)} /></label><Button type="submit" disabled={!shareLinkId || linksLoading || pending === "share"}>{pending === "share" ? "Đang chia sẻ…" : "Chia sẻ vào nhóm"}</Button></form>
        </Panel>
        {activeQr && <Panel className="ws-team-qr"><div><h2>Mã QR tải file</h2><p>Thành viên nhóm có thể quét mã để mở link file.</p><a href={activeQr.share_url} target="_blank" rel="noreferrer">{activeQr.share_url}</a><a href={activeQr.download_url} target="_blank" rel="noreferrer">Mở URL tải trực tiếp</a>{activeQr.expires_at && <small>Hết hạn: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeQr.expires_at))}</small>}<div className="ws-team-link-actions"><Button variant="secondary" onClick={() => { void copyQrLink(activeQr.share_url); }}>Sao chép link</Button><Button onClick={() => { void downloadQrImage(); }} disabled={pending === "qr-image"}>{pending === "qr-image" ? "Đang tải…" : "Tải ảnh PNG"}</Button><Button variant="ghost" onClick={() => setQr(null)}>Đóng</Button></div></div><img src={activeQr.qr_code} alt={`Mã QR tải ${currentLinks.find(link => link.id === activeQr.link_id)?.file.original_name || "file"}`} width={220} height={220} /></Panel>}
      </>}
      <Panel className="ws-team-qr-download"><h2>Tải file bằng mã QR</h2><p>Dán nội dung quét được từ QR của link trong nhóm. Có thể nhập mật khẩu nếu link được bảo vệ.</p><form className="ws-share-team-link" onSubmit={downloadByQr}><label>Nội dung hoặc URL mã QR<input required value={qrContent} onChange={event => setQrContent(event.target.value)} placeholder="https://… hoặc 21/files/ten-link" /></label><label>Mật khẩu (nếu có)<input type="password" autoComplete="current-password" value={qrPassword} onChange={event => setQrPassword(event.target.value)} /></label><Button type="submit" disabled={pending === "download-qr"}>{pending === "download-qr" ? "Đang tải file…" : "Tải file"}</Button></form></Panel>
    </>}
  </div></WorkspaceShell>;
}
