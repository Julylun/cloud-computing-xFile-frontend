"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type DemoFile = {
  id: string; name: string; size: string; type: string; url: string;
  access: "public" | "password" | "email" | "private";
  views: number; downloads: number; createdAt: string; expiresAt: string;
  status: "active" | "expired" | "disabled";
};
type User = { name: string; email: string };
type Theme = "dark" | "light";
const seedFiles: DemoFile[] = [
  { id: "brand-kit", name: "Brand Guidelines.pdf", size: "24,8 MB", type: "PDF", url: "xfile.app/minhlam/brand-kit", access: "public", views: 428, downloads: 126, createdAt: "2026-10-07", expiresAt: "2026-10-14", status: "active" },
  { id: "proposal", name: "Project proposal.pdf", size: "12,4 MB", type: "PDF", url: "xfile.app/minhlam/proposal", access: "email", views: 312, downloads: 84, createdAt: "2026-09-22", expiresAt: "2026-09-29", status: "expired" },
  { id: "sprint-assets", name: "Sprint assets.zip", size: "428 MB", type: "ZIP", url: "xfile.app/minhlam/sprint", access: "private", views: 544, downloads: 176, createdAt: "2026-09-26", expiresAt: "2026-10-03", status: "disabled" },
];
type AppContextValue = {
  theme: Theme; setTheme: (theme: Theme) => void;
  toast: (message: string) => void; user: User | null;
  signIn: (name?: string, email?: string) => void; signOut: () => void;
  files: DemoFile[]; addFile: (file: DemoFile) => void;
  updateFile: (id: string, partial: Partial<DemoFile>) => void;
  deleteFile: (id: string) => void;
};
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<DemoFile[]>(seedFiles);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Hydrate persisted browser-only demo data after the server render.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const savedTheme = localStorage.getItem("xfile-theme");
      const savedUser = localStorage.getItem("xfile-user");
      const savedFiles = localStorage.getItem("xfile-files-v1");
      if (savedTheme === "light" || savedTheme === "dark") setThemeState(savedTheme);
      if (savedUser) { const value = JSON.parse(savedUser); if (typeof value.name === "string" && typeof value.email === "string") setUser(value); }
      if (savedFiles) { const value = JSON.parse(savedFiles); if (Array.isArray(value) && value.every((f) => typeof f.id === "string" && typeof f.name === "string")) setFiles(value); }
    } catch { /* A fresh demo also works if storage is unavailable. */ }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!ready) return;
    try {
      localStorage.setItem("xfile-theme", theme);
      localStorage.setItem("xfile-files-v1", JSON.stringify(files));
      if (user) localStorage.setItem("xfile-user", JSON.stringify(user));
      else localStorage.removeItem("xfile-user");
    } catch { /* State remains available in this browser session. */ }
  }, [theme, user, files, ready]);
  const toast = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 3500);
  }, []);
  return <AppContext.Provider value={{
    theme, setTheme: setThemeState, user, files, toast,
    signIn: (name = "Minh Lâm", email) => setUser((current) => ({ name, email: email || current?.email || "minhlam@example.com" })),
    signOut: () => setUser(null),
    addFile: (file) => setFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]),
    updateFile: (id, partial) => setFiles((current) => current.map((item) => item.id === id ? { ...item, ...partial } : item)),
    deleteFile: (id) => setFiles((current) => current.filter((item) => item.id !== id)),
  }}>
    {children}
    <div className={`toast ${message ? "toast-visible" : ""}`} role="status" aria-live="polite">{message}</div>
  </AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
