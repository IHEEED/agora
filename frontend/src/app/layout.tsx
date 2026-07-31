import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Silkscreen } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageTransition } from "@/components/PageTransition";
import { HeaderAction } from "@/components/HeaderAction";
import { AppGate } from "@/components/AppGate";
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
      // data-theme проставляется инлайн-скриптом ниже до гидратации — специально
      // расходится с серверной разметкой, чтобы не было мигания темы при загрузке.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)]">
        {/* Пока нет сессии, AppGate рендерит только экран входа — ни шапки,
            ни навигации, ни контента страницы пользователь не видит. */}
        <AppGate>
          <DesktopSidebar />
          <div className="flex min-h-screen flex-col pb-16 md:pb-0 md:pl-20">
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
                <HeaderAction />
              </div>
            </header>
            <PageTransition>{children}</PageTransition>
            <div className="nav-fade md:hidden" aria-hidden />
            <BottomNav />
          </div>
        </AppGate>
      </body>
    </html>
  );
}
