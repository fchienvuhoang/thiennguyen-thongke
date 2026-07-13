import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({ variable: "--font-app", subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Thiện Pháp — Quản lý dòng tiền minh bạch",
  description: "Đồng bộ và phân loại giao dịch thiện nguyện",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${font.variable} antialiased`}>{children}</body></html>;
}
