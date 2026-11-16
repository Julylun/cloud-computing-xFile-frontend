"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Badge, Button, Field, Panel } from "@/components/ui";
import { useApp } from "./app-provider";
import { apiRequest, ApiError, type UserProfile } from "@/lib/api";
import "@/styles/auth.css";

const CONTACT_KEY = "xfile-auth-contact";
const FLOW_KEY = "xfile-auth-flow";
function authAsset(node: string, name: string) {
  return `/assets/auth/${node}/${name}.svg`;
}

function isValidPassword(value: string) {
  return value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value);
}

function maskedContact(value: string) {
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name[0]}•••••@${domain}`;
  }
  return `••••••${value.replace(/\D/g, "").slice(-4)}`;
}

function subscribeContact(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getContactSnapshot() {
  return maskedContact(sessionStorage.getItem(CONTACT_KEY) || "minhlam@example.com");
}

function AuthIntro({ register = false }: { register?: boolean }) {
  return (
    <section className="auth-story" aria-label="Chia sẻ cùng xFile">
      <Badge>xFile / PRISM</Badge>
      <h1>Chia sẻ dễ dàng.<br />An tâm kết nối.</h1>
      <p className="auth-story-description">Một không gian cho những file quan trọng và những người bạn muốn chia sẻ.</p>
      <Panel className="auth-promise">
        <span className="auth-promise-icon">
          <img className="theme-icon theme-icon-cyan" src={authAsset(register ? "5-5" : "5-4", "imgIconLock")} alt="" />
        </span>
        <h2>Quyền truy cập nằm trong tay bạn</h2>
        <p>Chọn người nhận. Đặt hạn dùng. Chia sẻ an tâm.</p>
      </Panel>
    </section>
  );
}

type PasswordFieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  assetNode?: string;
  autoComplete?: string;
  autoFocus?: boolean;
};

function PasswordField({ label, name, placeholder = "••••••••••••", assetNode = "5-4", autoComplete = "current-password", autoFocus = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-password-field">
      <Field label={label} name={name} type={visible ? "text" : "password"} placeholder={placeholder} autoComplete={autoComplete} required minLength={8} autoFocus={autoFocus} className="auth-input auth-password-input" />
      <button type="button" className="auth-password-toggle" aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <img className="theme-icon" src={authAsset(assetNode, "imgIconEye")} alt="" />
      </button>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return message ? <p className="auth-error" role="alert">{message}</p> : null;
}

export function LoginScreen() {
  const router = useRouter();
  const { signIn, toast } = useApp();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contact = String(data.get("contact") || "").trim();
    const password = String(data.get("password") || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return setError("Backend hiện yêu cầu đăng nhập bằng email.");
    if (password.length < 1) return setError("Vui lòng nhập mật khẩu.");
    setError("");
    setPending(true);
    try {
      const result = await apiRequest<{ access_token: string; user: Pick<UserProfile, "id" | "email" | "username" | "display_name"> }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: contact, password }),
      });
      signIn(result.user, result.access_token);
      toast("Đăng nhập thành công. Chào mừng bạn đến với xFile!");
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể đăng nhập.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-layout" data-node-id="5:4">
      <AuthIntro />
      <Panel className="auth-card auth-login-card">
        <p className="auth-eyebrow">CHÀO MỪNG TRỞ LẠI</p>
        <h2>Đăng nhập</h2>
        <p className="auth-description">Tiếp tục chia sẻ và quản lý file của bạn.</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="Email" name="contact" type="email" autoComplete="username" required className="auth-input" />
          <PasswordField label="Mật khẩu" name="password" />
          <Link className="auth-text-link" href="/forgot-password">Quên mật khẩu?</Link>
          <FormError message={error} />
          <Button type="submit" disabled={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
        </form>
        <div className="auth-divider" />
        <Button href="/register" variant="ghost">Tôi chưa có tài khoản</Button>
        <Link className="auth-home-link" href="/">← Quay lại trang chủ</Link>
      </Panel>
    </main>
  );
}

export function RegisterScreen() {
  const router = useRouter();
  const { toast } = useApp();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contact = String(data.get("contact") || "").trim();
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirm") || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return setError("Vui lòng nhập email hợp lệ.");
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return setError("Tên người dùng cần từ 3–30 ký tự, chỉ gồm chữ, số và dấu gạch dưới.");
    if (!isValidPassword(password)) return setError("Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.");
    if (password !== confirm) return setError("Mật khẩu nhập lại chưa khớp.");
    setError("");
    setPending(true);
    try {
      await apiRequest<UserProfile>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: contact, username, display_name: username, password }),
      });
      sessionStorage.setItem(CONTACT_KEY, contact);
      sessionStorage.setItem(FLOW_KEY, "register");
      toast("Tài khoản đã được tạo. Hãy nhập mã OTP trong email để xác thực.");
      router.push("/verify-otp");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tạo tài khoản.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-layout" data-node-id="5:5">
      <AuthIntro register />
      <Panel className="auth-card auth-register-card">
        <p className="auth-eyebrow">BẮT ĐẦU VỚI xFile</p>
        <h2>Tạo tài khoản</h2>
        <p className="auth-description">Chia sẻ file đến 500 MB và quản lý mọi đường link.</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="Email" name="contact" type="email" placeholder="name@example.com" autoComplete="username" required className="auth-input" />
          <Field label="Tên người dùng" name="username" placeholder="minhlam" autoComplete="nickname" required minLength={3} maxLength={30} className="auth-input" />
          <PasswordField label="Mật khẩu" name="password" placeholder="Tạo mật khẩu" assetNode="5-5" autoComplete="new-password" />
          <PasswordField label="Nhập lại mật khẩu" name="confirm" placeholder="Xác nhận mật khẩu" assetNode="5-5" autoComplete="new-password" />
          <p className="auth-terms-consent">Bằng việc đăng ký, bạn đồng ý với <Link href="/terms">Điều khoản sử dụng</Link> của xFile.</p>
          <FormError message={error} />
          <Button type="submit" disabled={pending}>{pending ? "Đang tạo tài khoản…" : "Đăng ký"}</Button>
        </form>
        <Button href="/login" variant="ghost">Tôi đã có tài khoản</Button>
      </Panel>
    </main>
  );
}

export function ForgotPasswordScreen() {
  return (
    <main className="auth-recovery-layout" data-node-id="5:6">
      <Panel className="auth-card auth-recovery-card">
        <Badge>CHƯA ĐƯỢC HỖ TRỢ</Badge>
        <h1>Quên mật khẩu?</h1>
        <p className="auth-description">Backend hiện chưa có API quên hoặc đặt lại mật khẩu. Nếu bạn còn đăng nhập, hãy đổi mật khẩu trong phần Cài đặt.</p>
        <Button href="/login">Quay lại đăng nhập</Button>
      </Panel>
    </main>
  );
}

export function VerifyOtpScreen() {
  const router = useRouter();
  const { toast } = useApp();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const contact = useSyncExternalStore(subscribeContact, getContactSnapshot, () => "m•••••@example.com");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function updateDigit(index: number, value: string) {
    const numbers = value.replace(/\D/g, "");
    setError("");
    if (numbers.length > 1) {
      const updated = [...digits];
      numbers.slice(0, 6 - index).split("").forEach((digit, offset) => { updated[index + offset] = digit; });
      setDigits(updated);
      inputs.current[Math.min(index + numbers.length, 5)]?.focus();
      return;
    }
    setDigits(previous => previous.map((digit, position) => position === index ? numbers : digit));
    if (numbers && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigits(previous => previous.map((digit, position) => position === index - 1 ? "" : digit));
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    updateDigit(pasted.length === 6 ? 0 : index, pasted);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (digits.join("").length < 6) return setError("Vui lòng nhập đủ 6 chữ số.");
    setError("");
    const flow = sessionStorage.getItem(FLOW_KEY);
    if (flow !== "register") {
      setError("Backend hiện chỉ xác thực OTP đăng ký, chưa hỗ trợ OTP khôi phục mật khẩu.");
      return;
    }
    setPending(true);
    try {
      await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: sessionStorage.getItem(CONTACT_KEY), otp: digits.join("") }),
      });
      sessionStorage.removeItem(FLOW_KEY);
      toast("Email đã được xác thực. Hãy đăng nhập để tiếp tục.");
      router.push("/login");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Không thể xác thực mã OTP.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-recovery-layout" data-node-id="5:7">
      <Panel className="auth-card auth-recovery-card">
        <Badge>BƯỚC 2 / 3</Badge>
        <h1>Kiểm tra hộp thư</h1>
        <p className="auth-description">Mã xác thực đã được gửi đến {contact}.</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <p className="auth-otp-label" id="otp-label">Nhập mã OTP gồm 6 chữ số</p>
          <div className="auth-otp-inputs" role="group" aria-labelledby="otp-label">
            {digits.map((digit, index) => (
              <input key={index} ref={element => { inputs.current[index] = element; }} aria-label={`Chữ số ${index + 1}`} className={digit ? "auth-otp-filled" : ""} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? "one-time-code" : "off"} value={digit} placeholder="—" onChange={event => updateDigit(index, event.target.value)} onKeyDown={event => handleKeyDown(event, index)} onPaste={event => handlePaste(event, index)} onFocus={event => event.target.select()} />
            ))}
          </div>
          <p className="auth-resend">Backend chưa hỗ trợ gửi lại mã OTP từ giao diện này.</p>
          <FormError message={error} />
          <Button type="submit" disabled={pending}>{pending ? "Đang xác thực…" : "Xác nhận"}</Button>
        </form>
        <Button href="/forgot-password" variant="ghost">← Thay đổi email / số điện thoại</Button>
      </Panel>
    </main>
  );
}

export function ResetPasswordScreen() {
  return (
    <main className="auth-recovery-layout" data-node-id="5:8">
      <Panel className="auth-card auth-recovery-card auth-reset-card">
        <Badge>CHƯA ĐƯỢC HỖ TRỢ</Badge>
        <h1>Tạo mật khẩu mới</h1>
        <p className="auth-description">Backend hiện chưa có API đặt lại mật khẩu. Chức năng đổi mật khẩu cần đăng nhập trước.</p>
        <Button href="/login">Quay lại đăng nhập</Button>
      </Panel>
    </main>
  );
}

const terms = [
  { id: "su-dung-dich-vu", title: "Sử dụng dịch vụ", content: "xFile giúp bạn tải lên và chia sẻ file bằng đường link. Vui lòng chỉ chia sẻ nội dung mà bạn có quyền sử dụng." },
  { id: "trach-nhiem-tai-khoan", title: "Trách nhiệm tài khoản", content: "Bạn quản lý thông tin đăng nhập và quyền truy cập vào tài khoản của mình. Không chia sẻ mật khẩu với người khác." },
  { id: "file-va-quyen-truy-cap", title: "File và quyền truy cập", content: "Kiểm tra người nhận, thời hạn và giới hạn truy cập trước khi gửi link. Bạn có thể quản lý các link trong trang Tổng quan." },
  { id: "quyen-rieng-tu", title: "Quyền riêng tư", content: "Trước khi tải lên, hãy cân nhắc thông tin cá nhân và dữ liệu nhạy cảm có trong file." },
];

export function TermsScreen() {
  const [active, setActive] = useState(terms[0].id);
  return (
    <main className="terms-page" data-node-id="5:9">
      <header className="terms-heading">
        <p className="auth-eyebrow">xFile / ĐIỀU KHOẢN</p>
        <h1>Rõ ràng trước khi chia sẻ</h1>
        <p>Điều khoản sử dụng · Bản nội dung minh họa cho thiết kế</p>
      </header>
      <div className="terms-layout">
        <Panel className="terms-contents">
          <nav aria-label="Mục lục điều khoản">
            {terms.map((section, index) => <a key={section.id} href={`#${section.id}`} onClick={() => setActive(section.id)} aria-current={active === section.id ? "location" : undefined}><span>{String(index + 1).padStart(2, "0")}</span>{index === 2 ? "File & quyền truy cập" : section.title}</a>)}
          </nav>
          <Button href="/register" variant="secondary">← Quay lại đăng ký</Button>
        </Panel>
        <Panel className="terms-body">
          {terms.map((section, index) => (
            <section key={section.id} id={section.id}>
              <h2>{index + 1}. {section.title}</h2>
              <p>{section.content}</p>
            </section>
          ))}
          <p className="terms-note">Nội dung chính sách chính thức sẽ được cập nhật trước khi phát hành.</p>
        </Panel>
      </div>
    </main>
  );
}
