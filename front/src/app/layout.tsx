import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "読書記録アプリ",
  description: "単一ユーザー向けの読書記録MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
