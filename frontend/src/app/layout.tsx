import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Pixelify_Sans } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { PageTransition } from "@/components/PageTransition";
import { HeaderAction } from "@/components/HeaderAction";
import { AppGate } from "@/components/AppGate";
import { Wallpaper } from "@/components/Wallpaper";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
});

// Silkscreen был только латиницей — кириллические заголовки в нём
// откатывались на системный шрифт. Pixelify Sans закрывает оба алфавита
// и остаётся читаемым в длинных словах вроде «Уведомления».
const pixelFont = Pixelify_Sans({
  variable: "--font-pixel",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "PARAFRAZ",
  description: "PARAFRAZ — сообщества, посты и обсуждения",
};

// Тема и акцент выставляются до первой отрисовки, иначе оба успевают мигнуть.
const APPEARANCE_INIT_SCRIPT = `
  (function () {
    try {
      var root = document.documentElement;
      var theme = localStorage.getItem('parafraz-theme')
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-accent', localStorage.getItem('parafraz-accent') || 'indigo');
      root.setAttribute('data-wallpaper', localStorage.getItem('parafraz-wallpaper') || 'none');
      root.setAttribute('data-plain-bg', localStorage.getItem('parafraz-plain-bg') || '0');
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
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)]">
        {/* Пока нет сессии, AppGate рендерит только экран входа — ни шапки,
            ни навигации, ни контента страницы пользователь не видит. */}
        <AppGate>
          {/* Обои лежат ниже ауроры: узор должен просвечивать сквозь неё,
              а не спорить с цветными пятнами. */}
          <Wallpaper />
          {/* Мягкие цветные пятна под всем интерфейсом: без них стеклу
              нечего размывать и оно выглядит просто серой заливкой. */}
          <div className="aurora" aria-hidden />
          <DesktopSidebar />
          {/* Отступ под таб-бар: его высота плюс домашний индикатор. Бар теперь
              прижат к кромке во всю ширину, а не парит, поэтому запас точный. */}
          <div
            className="flex min-h-screen flex-col md:pb-0 md:pl-20"
            style={{ paddingBottom: 'calc(58px + env(safe-area-inset-bottom))' }}
          >
            <header className="app-header">
              <div className="app-header-veil" aria-hidden />
              {/* Верхний отступ учитывает вырез телефона: env(safe-area-inset-top)
                  на устройствах с монобровью отдаёт её высоту, на остальных — ноль,
                  поэтому одна и та же строчка работает и там, и там. */}
              <div
                className="app-header-inner relative flex items-center justify-end px-4 pb-4"
                style={{ paddingTop: 'calc(14px + env(safe-area-inset-top))' }}
              >
                {/* Трекинг не переопределяем: отрицательный сплющивал пиксельные
                    буквы в сплошную полосу. Кегль крупнее по той же причине. */}
                <Link
                  href="/"
                  className="font-pixel absolute left-1/2 -translate-x-1/2 text-[27px] text-[var(--text)]"
                >
                  PARAFRAZ
                </Link>
                <HeaderAction />
              </div>
            </header>
            <PageTransition>{children}</PageTransition>
            {/* Полоса размытия под баром переехала внутрь BottomNav — она
                должна гаснуть вместе с ним при листании ленты. */}
            <BottomNav />
          </div>
        </AppGate>
      </body>
    </html>
  );
}
