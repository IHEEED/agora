import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Silkscreen } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageTransition } from "@/components/PageTransition";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
});

const pixelFont = Silkscreen({
  variable: "--font-pixel",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PARAFRAZ",
  description: "PARAFRAZ — сообщества, посты и обсуждения",
};

const THEME_INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem('parafraz-theme');
      var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${bodyFont.variable} ${pixelFont.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)] pb-16">
        <header className="app-header">
          <div className="app-header-veil" aria-hidden />
          <div className="app-header-inner relative flex items-center justify-between px-4 py-5">
            <ThemeToggle />
            <Link
              href="/"
              className="font-pixel absolute left-1/2 -translate-x-1/2 text-lg tracking-wide text-[var(--text)]"
            >
              PARAFRAZ
            </Link>
            <Link
              href="/search"
              aria-label="Поиск"
              className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4.3-4.3" />
              </svg>
            </Link>
          </div>
        </header>
        <PageTransition>{children}</PageTransition>
        <div className="nav-fade" aria-hidden />
        <BottomNav />
      </body>
    </html>
  );
}
