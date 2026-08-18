import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Inter, Literata, Pixelify_Sans } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { PageTransition } from "@/components/PageTransition";
import { HeaderAction } from "@/components/HeaderAction";
import { MessagesButton } from "@/components/MessagesButton";
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

// Газетная антиква для знака и заголовков. Раньше здесь стоял Newsreader —
// шрифт красивый, но без кириллицы, поэтому им было набрано ровно одно слово
// в шапке, а все заголовки экранов оставались на гротеске. Literata из того же
// семейства книжно-газетных форм, но с кириллицей: ею можно набрать
// «Уведомления» и «Сообщества», а не только PARAFRAZ.
//
// Какие именно заголовки уходят в антикву, решает стиль оформления
// (--display-family в globals.css): «Хроника», «Ателье» и «Сад» набирают ею
// весь верхний уровень, «Сигнал» и «Полночь» оставляют гротеск.
const displayFont = Literata({
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "PARAFRAZ",
  description: "PARAFRAZ — клубы, посты и обсуждения",
};

// Стиль и тема выставляются до первой отрисовки, иначе оба успевают мигнуть.
// Прежних data-accent, data-wallpaper и data-plain-bg здесь больше нет: всё,
// что они задавали, входит в стиль целиком.
const APPEARANCE_INIT_SCRIPT = `
  (function () {
    try {
      var root = document.documentElement;
      var theme = localStorage.getItem('parafraz-theme')
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-style', localStorage.getItem('parafraz-style') || 'atelier');
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
      className={`${bodyFont.variable} ${pixelFont.variable} ${displayFont.variable} h-full antialiased`}
      // data-theme проставляется инлайн-скриптом ниже до гидратации — специально
      // расходится с серверной разметкой, чтобы не было мигания темы при загрузке.
      suppressHydrationWarning
    >
      <head>
        {/* next/script, а не голый <script>: React ругался на тег скрипта
            внутри компонента и зажигал в разработке значок ошибки. Стратегия
            beforeInteractive оставляет поведение прежним — код уходит в
            изначальную разметку и выполняется до гидратации, поэтому тема
            по-прежнему не успевает мигнуть. */}
        <Script id="parafraz-appearance" strategy="beforeInteractive">
          {APPEARANCE_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)]">
        {/* Пока нет сессии, AppGate рендерит только экран входа — ни шапки,
            ни навигации, ни контента страницы пользователь не видит. */}
        <AppGate>
          {/* Подложка: один источник света сверху и зерно бумаги. Плотность
              обоих назначает выбранный стиль — у половины из них зерна нет
              вовсе. */}
          <Wallpaper />
          <DesktopSidebar />
          {/* Отступ под таб-бар: его высота плюс домашний индикатор. Бар теперь
              прижат к кромке во всю ширину, а не парит, поэтому запас точный. */}
          <div
            // Отступ равен ширине боковой панели: та подросла до 92px, когда
            // под знаками появились подписи.
            // dvh, а не vh. На телефоне 100vh считается от окна с убранной
            // адресной строкой и остаётся таким, пока строка на месте: колонка
            // выходит выше экрана, и всё, что прибито к её низу, оказывается за
            // кромкой. В режиме эмуляции устройства это же расхождение видно
            // сразу при переключении — экран будто уезжает. dvh пересчитывается
            // вместе с окном.
            className="flex min-h-[100dvh] flex-col md:pb-0 md:pl-[92px]"
            style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
          >
            <header className="app-header">
              <div className="app-header-veil" aria-hidden />
              {/* Верхний отступ учитывает вырез телефона: env(safe-area-inset-top)
                  на устройствах с монобровью отдаёт её высоту, на остальных — ноль,
                  поэтому одна и та же строчка работает и там, и там. */}
              <div
                className="app-header-inner relative flex items-center justify-between px-4 pb-4"
                style={{ paddingTop: 'calc(14px + env(safe-area-inset-top))' }}
              >
                <MessagesButton />
                {/* Разрядка обязательна: у антиквы в капители буквы иначе
                    слипаются в слово, а знак должен читаться по буквам. */}
                <Link
                  href="/"
                  aria-label="PARAFRAZ"
                  className="wordmark absolute left-1/2 -translate-x-1/2"
                >
                  PARAFRA<span style={{ color: 'var(--accent)' }}>Z</span>
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
