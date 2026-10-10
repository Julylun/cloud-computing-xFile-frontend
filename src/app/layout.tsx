import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
import "@/styles/auth.css";
import "@/styles/workspace.css";
import "@/styles/sharing.css";
import { AppProvider } from "@/components/app-provider";
import { Background, Navigation } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "xFile — File của bạn. Kết nối mọi nơi.", template: "%s | xFile" },
  description: "Chia sẻ file nhanh gọn, riêng tư và luôn trong tầm kiểm soát. Giao diện xFile Prism.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" data-theme="dark" suppressHydrationWarning><body><AppProvider><div className="app-frame"><Background /><Navigation />{children}</div></AppProvider></body></html>;
}
