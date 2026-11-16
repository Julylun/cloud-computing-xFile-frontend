"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, toDemoFile, type BackendLink, type UserProfile } from "@/lib/api";

export type DemoFile = {
  id: string; name: string; size: string; type: string; url: string;
  access: "public" | "password" | "email" | "private";
  views: number; downloads: number; createdAt: string; expiresAt: string;
  status: "active" | "expired" | "disabled";
  sharePath?: string; sourceFileId?: number; maxAccessCount?: number;
};
export type User = { id: number; name: string; email: string; username: string };
type Theme = "dark" | "light";
type AppContextValue = {
  theme: Theme; setTheme: (theme: Theme) => void;
  toast: (message: string) => void; user: User | null;
  accessToken: string | null;
  signIn: (profile: Pick<UserProfile, "id" | "email" | "username" | "display_name">, accessToken: string) => void;
  updateUser: (profile: UserProfile) => void;
  signOut: () => void;
  files: DemoFile[]; addFile: (file: DemoFile) => void;
  setFiles: (files: DemoFile[]) => void;
  updateFile: (id: string, partial: Partial<DemoFile>) => void;
  deleteFile: (id: string) => void;
};
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DemoFile[]>([]);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Hydrate persisted browser-only demo data after the server render.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const savedTheme = localStorage.getItem("xfile-theme");
      const savedToken = localStorage.getItem("xfile-access-token");
      if (savedTheme === "light" || savedTheme === "dark") setThemeState(savedTheme);
      if (savedToken) {
        setAccessToken(savedToken);
        const savedUser = localStorage.getItem("xfile-user");
        if (savedUser) {
          const value = JSON.parse(savedUser);
          if (typeof value.name === "string" && typeof value.email === "string" && typeof value.id === "number") setUser(value);
        }
      } else {
        localStorage.removeItem("xfile-user");
      }
    } catch { /* Theme and session state can still be managed in memory. */ }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!ready || !accessToken) return;
    let active = true;
    Promise.all([
      apiRequest<UserProfile>("/users/me"),
      apiRequest<BackendLink[]>("/links"),
    ]).then(([profile, links]) => {
      if (!active) return;
      const nextUser = { id: profile.id, name: profile.display_name, email: profile.email, username: profile.username };
      setUser(nextUser);
      setFiles(links.map(toDemoFile));
      localStorage.setItem("xfile-user", JSON.stringify(nextUser));
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem("xfile-access-token");
        localStorage.removeItem("xfile-user");
        setAccessToken(null);
        setUser(null);
        setFiles([]);
      } else {
        setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu tài khoản.");
        timer.current = setTimeout(() => setMessage(""), 3500);
      }
    });
    return () => { active = false; };
  }, [ready, accessToken]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!ready) return;
    try {
      localStorage.setItem("xfile-theme", theme);
      if (user) localStorage.setItem("xfile-user", JSON.stringify(user));
      else localStorage.removeItem("xfile-user");
    } catch { /* State remains available in this browser session. */ }
  }, [theme, user, files, ready]);
  const toast = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 3500);
  }, []);
  const signIn = useCallback((profile: Pick<UserProfile, "id" | "email" | "username" | "display_name">, token: string) => {
    const nextUser = { id: profile.id, name: profile.display_name, email: profile.email, username: profile.username };
    localStorage.setItem("xfile-access-token", token);
    localStorage.setItem("xfile-user", JSON.stringify(nextUser));
    setAccessToken(token);
    setUser(nextUser);
  }, []);
  const updateUser = useCallback((profile: UserProfile) => {
    const nextUser = { id: profile.id, name: profile.display_name, email: profile.email, username: profile.username };
    setUser(nextUser);
    localStorage.setItem("xfile-user", JSON.stringify(nextUser));
  }, []);
  const signOut = useCallback(() => {
    localStorage.removeItem("xfile-access-token");
    localStorage.removeItem("xfile-user");
    setAccessToken(null);
    setUser(null);
    setFiles([]);
  }, []);
  return <AppContext.Provider value={{
    theme, setTheme: setThemeState, user, accessToken, files, toast, signIn, updateUser, signOut,
    addFile: (file) => setFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]),
    setFiles,
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
