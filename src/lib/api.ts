export type UserProfile = {
  id: number;
  email: string;
  username: string;
  display_name: string;
  storage_used_bytes: string;
};

export type BackendLink = {
  id: number;
  slug: string;
  title: string | null;
  access_mode: "public" | "private" | "password";
  status: "active" | "disabled" | "deleted";
  expiry_mode: "none" | "time" | "access_count";
  expires_at: string | null;
  max_access_count: number | null;
  share_path: string;
  access_count: number;
  download_count: number;
  view_count: number;
  allowed_emails?: string[];
  file: {
    id: number;
    original_name: string;
    size_bytes: string;
    mime_type: string;
    created_at: string;
  };
  created_at: string;
};

export type LinkAnalytics = {
  file_id: number;
  file: { id: number; name: string; title: string | null; share_path: string };
  period: { days: number; from: string; to: string };
  totals: {
    view_count: number;
    download_count: number;
    unique_visitors: number;
    last_accessed_at: string | null;
  };
  all_time: {
    view_count: number;
    download_count: number;
    unique_visitors: number;
    last_accessed_at: string | null;
  };
  daily: { date: string; view_count: number; download_count: number }[];
  recent_activity: { event_type: "view" | "download"; occurred_at: string }[];
};

type ApiErrorResponse = {
  message?: string | string[];
  error?: string;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (typeof FormData === "undefined" || !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("xfile-access-token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-analytics-visitor-id", getAnalyticsVisitorId());
  }

  let response: Response;
  try {
    response = await fetch(`/api/backend${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Không thể kết nối máy chủ. Hãy kiểm tra backend đang chạy.", 0);
  }

  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status}).`;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadSharedFile(path: string, password?: string) {
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("xfile-access-token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-analytics-visitor-id", getAnalyticsVisitorId());
  }
  if (password) headers.set("x-link-password", password);

  let response: Response;
  try {
    response = await fetch(`/api/backend${path}/download`, { headers });
  } catch {
    throw new ApiError("Không thể kết nối máy chủ. Hãy kiểm tra backend đang chạy.", 0);
  }
  if (!response.ok) {
    let message = `Không thể tải file (${response.status}).`;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new ApiError(message, response.status);
  }
  return response.blob();
}

function getAnalyticsVisitorId() {
  const key = "xfile-analytics-visitor-id";
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

export function toDemoFile(link: BackendLink) {
  const bytes = Number(link.file.size_bytes);
  const access = link.allowed_emails?.length
    ? "email"
    : link.access_mode === "password"
      ? "password"
      : link.access_mode;
  const expiresAt = link.expires_at || "";
  const expired = !!expiresAt && new Date(expiresAt).getTime() <= Date.now();

  return {
    id: String(link.id),
    name: link.title || link.file.original_name,
    size: Number.isFinite(bytes) ? formatSize(bytes) : "—",
    type: link.file.mime_type.split("/").pop()?.toUpperCase() || "FILE",
    url: link.share_path,
    sharePath: link.share_path,
    sourceFileId: link.file.id,
    maxAccessCount: link.max_access_count ?? undefined,
    access,
    views: link.view_count,
    downloads: link.download_count,
    createdAt: link.created_at,
    expiresAt,
    status: link.status === "disabled" ? "disabled" : expired ? "expired" : "active",
  } as const;
}
