import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { Caveat, Inter, Pixelify_Sans, Unbounded } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { PageTransition } from "@/components/PageTransition";
import { HeaderAction } from "@/components/HeaderAction";
import { NotificationsButton } from "@/components/NotificationsButton";
import { AppGate } from "@/components/AppGate";
import { Wallpaper } from "@/components/Wallpaper";
import { Wordmark } from "@/components/Wordmark";
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

// Шрифт крупных надписей. Здесь по очереди стояли Newsreader (красивый, но без
// кириллицы — им было набрано ровно одно слово в шапке) и Literata, книжно-
// газетная антиква с кириллицей.
//
// Теперь Unbounded, и это смена не начертания, а интонации. Антиква говорила
// «издание»: заголовок выглядел вынесенным из газетной полосы. Приложение,
// которое здоровается знаком «:P», обещает другое, и заголовок обязан обещать
// то же самое. Unbounded — гротеск с характером: широкий, геометричный,
// узнаваемый с одного взгляда и совершенно не нейтральный.
//
// Лицензия SIL OFL, кириллица родная (шрифт русский, Gaslight). Запасной ряд
// поэтому санс, а не Georgia: подставить антикву вместо гротеска — значит
// показать другой шрифт, а не похожий.
//
// Какие заголовки уходят в него, решает стиль оформления (--display-family в
// globals.css): «Хроника», «Ателье», «Сад» и «Гламур» набирают им весь верхний
// уровень, «Сигнал» и «Полночь» остаются на шрифте текста.
const displayFont = Unbounded({
  variable: "--font-display",
  // Без тонких начертаний: Unbounded широкий, и на 300 крупная надпись
  // расползается в линию, которую глаз читает по буквам, а не целиком.
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

// Рукописный — только для подписей в историях.
//
// В интерфейсе ему делать нечего: рукописное плохо читается мелко и врёт о
// назначении — кнопка, подписанная от руки, выглядит запиской, а не кнопкой.
// А в истории это ровно та интонация, которой не хватало: снимок с подписью
// от руки читается личным, а не свёрстанным.
//
// Caveat, лицензия SIL OFL, кириллица родная. Одно начертание: у рукописного
// вес — часть характера, и второй только размыл бы его.
const handFont = Caveat({
  variable: "--font-hand",
  weight: ["600"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "PARAFRAZ",
  description: "PARAFRAZ — клубы, посты и обсуждения",
  /**
   * Заявка на то, чтобы с экрана «Домой» открываться приложением.
   *
   * Манифест (app/manifest.ts) для этого обязателен, но Safari его одного не
   * слушает: display: standalone он читает только вместе со своей меткой
   * apple-mobile-web-app-capable. Без неё значок на экране появится, а нажатие
   * откроет обычную вкладку — с адресной строкой и панелью, которые встанут
   * ровно поверх шапки и бара.
   *
   * statusBarStyle: строка состояния прозрачная, содержимое уходит под неё.
   * Отступ под чёлку берут на себя safe-area-inset (см. viewportFit ниже),
   * поэтому закрашивать полосу отдельно не нужно, а на смене темы она
   * перекрашивается вместе со всем остальным, а не остаётся чужой.
   */
  appleWebApp: {
    capable: true,
    title: "PARAFRAZ",
    statusBarStyle: "black-translucent",
  },
};

/**
 * Настройки окна. Главное здесь — viewport-fit.
 *
 * Без него Safari на iPhone отдаёт env(safe-area-inset-*) нулями: страница
 * рисуется в «безопасном» прямоугольнике, вырез и домашний индикатор для неё не
 * существуют. Нижний бар при этом честно встаёт на 10 пикселей от кромки
 * layout-вьюпорта — то есть ровно под панель самого Safari, и на телефоне его
 * просто не видно. Отсюда «стеклянного бара не появилось»: он был, но за чужой
 * панелью.
 *
 * cover растягивает страницу на весь экран, включая вырез, и отступы начинают
 * приходить настоящими — те самые, под которые везде посчитаны поля.
 *
 * themeColor красит строку состояния и панель Safari в цвет приложения: без
 * него над шапкой остаётся белая (или чёрная) полоса, из-за которой стекло
 * сверху выглядит наклейкой на чужом фоне. Два значения — под светлую и тёмную
 * системную тему, потому что оформление по умолчанию системное.
 *
 * maximumScale и userScalable не трогаем: запрещать масштаб — значит отнимать
 * у человека возможность разглядеть мелкое, и Safari всё равно это игнорирует.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
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
      className={`${bodyFont.variable} ${pixelFont.variable} ${displayFont.variable} ${handFont.variable} h-full antialiased`}
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
                className="app-header-inner relative z-10 flex items-center justify-between px-4 pb-4"
                style={{ paddingTop: 'calc(14px + env(safe-area-inset-top))' }}
              >
                <NotificationsButton />
                {/* Разрядка обязательна: у антиквы в капители буквы иначе
                    слипаются в слово, а знак должен читаться по буквам. */}
                <Link
                  href="/"
                  aria-label="PARAFRAZ"
                  className="absolute left-1/2 -translate-x-1/2"
                >
                  <Wordmark />
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
