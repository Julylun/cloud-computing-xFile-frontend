"use client";

import Link from "next/link";
import { useApp } from "./app-provider";
import { Badge, Button, Panel } from "./ui";

export function HomeScreen() {
  const { toast } = useApp();
  const asset = (name: string) => <img className={`theme-icon theme-icon-${name === "imgIconCheck" ? "green" : ["imgIconUpload", "imgIconTeam"].includes(name) ? "cyan" : "primary"}`} src={`/assets/home/${name}.svg`} alt="" />;
  async function copy() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/g/brand-kit`); toast("Đã sao chép link chia sẻ"); }
    catch { toast("Bạn có thể sao chép: xfile.app/minhlam/brand-kit"); }
  }
  return <main className="home-screen">
    <section className="hero">
      <div className="hero-message"><Badge className="hero-badge">CHIA SẺ KHÔNG GIỚI HẠN KHOẢNG CÁCH</Badge><h1>File của bạn.<br />Kết nối mọi nơi.</h1><p className="hero-description">Gửi một file. Chia sẻ một đường link.<br />Nhanh gọn, riêng tư và luôn trong tầm kiểm soát.</p><div className="hero-actions"><Button href="/upload">{asset("imgIconArrow")}Dùng thử ngay</Button><Button href="/register" variant="secondary">Tạo tài khoản</Button></div><p className="hero-note">Không cần tài khoản · Upload miễn phí đến 200 MB</p></div>
      <Panel className="sharing-preview"><h2>Một link, mọi kết nối</h2><div className="preview-file"><span className="file-type">{asset("imgIconFile1")}</span><div><strong>Brand Guidelines.pdf</strong><small>PDF&nbsp; · &nbsp;24,8 MB&nbsp; · &nbsp;Đã tải lên</small></div></div><div className="preview-status"><span className="status-check">{asset("imgIconCheck")}</span><div><h3>Sẵn sàng để chia sẻ</h3><p>Bạn chọn ai có thể truy cập.</p></div></div><button className="preview-link" onClick={copy} aria-label="Sao chép link chia sẻ">{asset("imgIconLink")}<span>xfile.app/minhlam/brand-kit</span>{asset("imgIconCopy")}</button><div className="preview-badges"><Badge>Có mật khẩu</Badge><Badge tone="green">Hết hạn sau 7 ngày</Badge></div></Panel>
    </section>
    <section className="benefits" aria-label="Lợi ích của xFile">{[
      { icon: "imgIconUpload", title: "Bắt đầu trong vài giây", description: "Khách tải file đến 200 MB. Đăng ký để chia sẻ file đến 500 MB." },
      { icon: "imgIconLock", title: "Quyền riêng tư do bạn chọn", description: "Giới hạn người nhận, đặt mật khẩu và thời gian hết hạn." },
      { icon: "imgIconTeam", title: "Chia sẻ cùng đội nhóm", description: "Lưu trữ chung, phân quyền thành viên và theo dõi lượt truy cập." },
    ].map((item) => <Panel key={item.title} className="benefit-card">{asset(item.icon)}<h3>{item.title}</h3><p>{item.description}</p></Panel>)}</section>
    <footer className="home-footer"><p>© 2026 xFile</p><Link href="/terms">Điều khoản sử dụng</Link></footer>
  </main>;
}
