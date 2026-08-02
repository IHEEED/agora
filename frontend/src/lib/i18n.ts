'use client';

import { useEffect, useState } from 'react';

export type Locale = 'ru' | 'en' | 'es';

export const LOCALE_STORAGE_KEY = 'parafraz-locale';

export const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

/**
 * Ключи вынесены плоским словарём: для приложения такого размера
 * это дешевле полноценной библиотеки, а переключение остаётся мгновенным.
 */
const DICTIONARY = {
  ru: {
    'nav.home': 'Главная',
    'nav.communities': 'Сообщества',
    'nav.create': 'Создать',
    'nav.notifications': 'Уведомления',
    'nav.profile': 'Профиль',
    'nav.search': 'Поиск',
    'nav.settings': 'Настройки',

    'feed.whatsNew': 'Что нового?',
    'feed.empty': 'В ленте пока пусто.',
    'feed.findCommunities': 'Найти сообщества',
    'feed.yourStory': 'Ваша история',
    'common.loading': 'Загрузка…',
    'common.cancel': 'Отмена',
    'common.back': 'Назад',
    'common.close': 'Закрыть',
    'common.soon': 'Скоро',

    'communities.title': 'Сообщества',
    'communities.create': '+ Создать',
    'communities.name': 'Название',
    'communities.description': 'Описание (необязательно)',
    'communities.submit': 'Создать',
    'communities.empty': 'Сообществ пока нет.',
    'communities.search': 'Поиск по сообществам',
    'communities.nothing': 'Ничего не нашлось.',

    'search.placeholder': 'Посты, люди, сообщества…',
    'search.all': 'Всё',
    'search.people': 'Люди',
    'search.posts': 'Посты',
    'search.communities': 'Сообщества',
    'search.hint': 'Начните вводить запрос — поиск идёт по людям, заголовкам, текстам и сообществам.',
    'search.nothing': 'Ничего не нашлось.',
    'search.close': 'Закрыть поиск',

    'create.pickCommunity': 'Куда опубликовать?',
    'create.pickHint': 'Выберите сообщество — пост всегда живёт в одном из них.',
    'create.title': 'Новый пост',
    'create.publish': 'Опубликовать',
    'create.publishing': 'Публикуем…',
    'create.titlePlaceholder': 'Заголовок',
    'create.bodyPlaceholder': 'Расскажите подробнее…',
    'create.poll': 'Опрос',
    'create.pollRemove': 'Убрать',
    'create.pollOption': 'Вариант',
    'create.pollAdd': '+ Добавить вариант',
    'create.image': 'Изображение',
    'create.camera': 'Снять на камеру',
    'create.noCommunities': 'Сначала нужно создать сообщество — пост всегда публикуется в одном из них.',

    'poll.noVotes': 'Голосов пока нет',
    'poll.votes': 'голосов',

    'profile.posts': 'Посты',
    'profile.comments': 'Комменты',
    'profile.reposts': 'Репосты',
    'profile.stat.posts': 'постов',
    'profile.stat.followers': 'подписч.',
    'profile.stat.influence': 'influence',
    'profile.emptyPosts': 'Вы пока ничего не опубликовали.',
    'profile.emptyComments': 'Вы пока не оставляли комментариев.',
    'profile.emptyReposts': 'Репостов пока нет.',
    'profile.verifyPrompt': 'Чтобы публиковать посты и комментарии, подтвердите номер телефона.',
    'profile.verifyAction': 'Подтвердить телефон',

    'notifications.title': 'Уведомления',
    'notifications.empty': 'Уведомлений пока нет.',

    'settings.title': 'Настройки',
    'settings.appearance': 'Оформление',
    'settings.theme': 'Тема',
    'settings.theme.light': 'Светлая',
    'settings.theme.dark': 'Тёмная',
    'settings.theme.system': 'Системная',
    'settings.accent': 'Акцентный цвет',
    'settings.wallpaper': 'Обои',
    'settings.wallpaperOff': 'Без',
    'settings.language': 'Язык',
    'settings.account': 'Аккаунт',
    'settings.email': 'Почта',
    'settings.phone': 'Телефон',
    'settings.phoneVerified': 'Подтверждён',
    'settings.phoneNeeded': 'Нужен, чтобы писать посты и комментарии',
    'settings.verify': 'Подтвердить',
    'settings.done': 'Готово',
    'settings.notifications': 'Уведомления',
    'settings.notifyReplies': 'Ответы на мои посты',
    'settings.notifyRepliesHint': 'Когда кто-то комментирует вашу запись',
    'settings.notifyMentions': 'Упоминания',
    'settings.notifyMentionsHint': 'Когда вас отмечают через @',
    'settings.notifyVotes': 'Реакции',
    'settings.notifyVotesHint': 'Когда за вашу запись голосуют',
    'settings.privacy': 'Приватность',
    'settings.privateProfile': 'Закрытый профиль',
    'settings.privateProfileHint': 'Записи видны только подписчикам',
    'settings.showInfluence': 'Показывать influence-очки',
    'settings.showInfluenceHint': 'Другие видят ваш счёт в профиле',
    'settings.content': 'Контент',
    'settings.nsfw': 'Материалы 18+',
    'settings.nsfwHint': 'Показывать записи с пометкой для взрослых',
    'settings.autoplay': 'Автовоспроизведение',
    'settings.autoplayHint': 'Видео запускается само при прокрутке',
    'settings.about': 'О приложении',
    'settings.version': 'Версия',
    'settings.versionHint': 'PARAFRAZ, сборка для разработки',
    'settings.rules': 'Правила сообщества',
    'settings.support': 'Поддержка',
    'settings.signOut': 'Выйти из аккаунта',
    'settings.localOnly':
      'Переключатели уведомлений, приватности и контента пока сохраняются только на этом устройстве — серверной части у них ещё нет.',
  },

  en: {
    'nav.home': 'Home',
    'nav.communities': 'Communities',
    'nav.create': 'Create',
    'nav.notifications': 'Notifications',
    'nav.profile': 'Profile',
    'nav.search': 'Search',
    'nav.settings': 'Settings',

    'feed.whatsNew': "What's new?",
    'feed.empty': 'Your feed is empty.',
    'feed.findCommunities': 'Find communities',
    'feed.yourStory': 'Your story',
    'common.loading': 'Loading…',
    'common.cancel': 'Cancel',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.soon': 'Soon',

    'communities.title': 'Communities',
    'communities.create': '+ Create',
    'communities.name': 'Name',
    'communities.description': 'Description (optional)',
    'communities.submit': 'Create',
    'communities.empty': 'No communities yet.',
    'communities.search': 'Search communities',
    'communities.nothing': 'Nothing found.',

    'search.placeholder': 'Posts, people, communities…',
    'search.all': 'All',
    'search.people': 'People',
    'search.posts': 'Posts',
    'search.communities': 'Communities',
    'search.hint': 'Start typing — search covers people, titles, text and communities.',
    'search.nothing': 'Nothing found.',
    'search.close': 'Close search',

    'create.pickCommunity': 'Where to post?',
    'create.pickHint': 'Pick a community — every post lives in one.',
    'create.title': 'New post',
    'create.publish': 'Publish',
    'create.publishing': 'Publishing…',
    'create.titlePlaceholder': 'Title',
    'create.bodyPlaceholder': 'Tell us more…',
    'create.poll': 'Poll',
    'create.pollRemove': 'Remove',
    'create.pollOption': 'Option',
    'create.pollAdd': '+ Add option',
    'create.image': 'Image',
    'create.camera': 'Take a photo',
    'create.noCommunities': 'Create a community first — every post belongs to one.',

    'poll.noVotes': 'No votes yet',
    'poll.votes': 'votes',

    'profile.posts': 'Posts',
    'profile.comments': 'Comments',
    'profile.reposts': 'Reposts',
    'profile.stat.posts': 'posts',
    'profile.stat.followers': 'followers',
    'profile.stat.influence': 'influence',
    'profile.emptyPosts': "You haven't posted anything yet.",
    'profile.emptyComments': "You haven't commented yet.",
    'profile.emptyReposts': 'No reposts yet.',
    'profile.verifyPrompt': 'Verify your phone number to publish posts and comments.',
    'profile.verifyAction': 'Verify phone',

    'notifications.title': 'Notifications',
    'notifications.empty': 'No notifications yet.',

    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.system': 'System',
    'settings.accent': 'Accent colour',
    'settings.wallpaper': 'Wallpaper',
    'settings.wallpaperOff': 'None',
    'settings.language': 'Language',
    'settings.account': 'Account',
    'settings.email': 'Email',
    'settings.phone': 'Phone',
    'settings.phoneVerified': 'Verified',
    'settings.phoneNeeded': 'Required to write posts and comments',
    'settings.verify': 'Verify',
    'settings.done': 'Done',
    'settings.notifications': 'Notifications',
    'settings.notifyReplies': 'Replies to my posts',
    'settings.notifyRepliesHint': 'When someone comments on your post',
    'settings.notifyMentions': 'Mentions',
    'settings.notifyMentionsHint': 'When someone tags you with @',
    'settings.notifyVotes': 'Reactions',
    'settings.notifyVotesHint': 'When someone votes on your post',
    'settings.privacy': 'Privacy',
    'settings.privateProfile': 'Private profile',
    'settings.privateProfileHint': 'Posts visible to followers only',
    'settings.showInfluence': 'Show influence points',
    'settings.showInfluenceHint': 'Others can see your score',
    'settings.content': 'Content',
    'settings.nsfw': 'Adult content',
    'settings.nsfwHint': 'Show posts marked 18+',
    'settings.autoplay': 'Autoplay',
    'settings.autoplayHint': 'Videos start on scroll',
    'settings.about': 'About',
    'settings.version': 'Version',
    'settings.versionHint': 'PARAFRAZ, development build',
    'settings.rules': 'Community guidelines',
    'settings.support': 'Support',
    'settings.signOut': 'Sign out',
    'settings.localOnly':
      'Notification, privacy and content switches are stored on this device only — there is no server side for them yet.',
  },

  es: {
    'nav.home': 'Inicio',
    'nav.communities': 'Comunidades',
    'nav.create': 'Crear',
    'nav.notifications': 'Notificaciones',
    'nav.profile': 'Perfil',
    'nav.search': 'Buscar',
    'nav.settings': 'Ajustes',

    'feed.whatsNew': '¿Qué hay de nuevo?',
    'feed.empty': 'Tu feed está vacío.',
    'feed.findCommunities': 'Buscar comunidades',
    'feed.yourStory': 'Tu historia',
    'common.loading': 'Cargando…',
    'common.cancel': 'Cancelar',
    'common.back': 'Atrás',
    'common.close': 'Cerrar',
    'common.soon': 'Pronto',

    'communities.title': 'Comunidades',
    'communities.create': '+ Crear',
    'communities.name': 'Nombre',
    'communities.description': 'Descripción (opcional)',
    'communities.submit': 'Crear',
    'communities.empty': 'Aún no hay comunidades.',
    'communities.search': 'Buscar comunidades',
    'communities.nothing': 'No se encontró nada.',

    'search.placeholder': 'Publicaciones, personas, comunidades…',
    'search.all': 'Todo',
    'search.people': 'Personas',
    'search.posts': 'Posts',
    'search.communities': 'Comunid.',
    'search.hint': 'Empieza a escribir: la búsqueda cubre personas, títulos, textos y comunidades.',
    'search.nothing': 'No se encontró nada.',
    'search.close': 'Cerrar búsqueda',

    'create.pickCommunity': '¿Dónde publicar?',
    'create.pickHint': 'Elige una comunidad: cada publicación vive en una.',
    'create.title': 'Nueva publicación',
    'create.publish': 'Publicar',
    'create.publishing': 'Publicando…',
    'create.titlePlaceholder': 'Título',
    'create.bodyPlaceholder': 'Cuéntanos más…',
    'create.poll': 'Encuesta',
    'create.pollRemove': 'Quitar',
    'create.pollOption': 'Opción',
    'create.pollAdd': '+ Añadir opción',
    'create.image': 'Imagen',
    'create.camera': 'Tomar foto',
    'create.noCommunities': 'Primero crea una comunidad: cada publicación pertenece a una.',

    'poll.noVotes': 'Aún no hay votos',
    'poll.votes': 'votos',

    'profile.posts': 'Posts',
    'profile.comments': 'Coment.',
    'profile.reposts': 'Republ.',
    'profile.stat.posts': 'posts',
    'profile.stat.followers': 'seguid.',
    'profile.stat.influence': 'influence',
    'profile.emptyPosts': 'Aún no has publicado nada.',
    'profile.emptyComments': 'Aún no has comentado.',
    'profile.emptyReposts': 'Aún no hay republicaciones.',
    'profile.verifyPrompt': 'Verifica tu número de teléfono para publicar y comentar.',
    'profile.verifyAction': 'Verificar teléfono',

    'notifications.title': 'Notificaciones',
    'notifications.empty': 'Aún no hay notificaciones.',

    'settings.title': 'Ajustes',
    'settings.appearance': 'Apariencia',
    'settings.theme': 'Tema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.system': 'Del sistema',
    'settings.accent': 'Color de acento',
    'settings.wallpaper': 'Fondo',
    'settings.wallpaperOff': 'Sin',
    'settings.language': 'Idioma',
    'settings.account': 'Cuenta',
    'settings.email': 'Correo',
    'settings.phone': 'Teléfono',
    'settings.phoneVerified': 'Verificado',
    'settings.phoneNeeded': 'Necesario para publicar y comentar',
    'settings.verify': 'Verificar',
    'settings.done': 'Listo',
    'settings.notifications': 'Notificaciones',
    'settings.notifyReplies': 'Respuestas a mis publicaciones',
    'settings.notifyRepliesHint': 'Cuando alguien comenta tu publicación',
    'settings.notifyMentions': 'Menciones',
    'settings.notifyMentionsHint': 'Cuando te etiquetan con @',
    'settings.notifyVotes': 'Reacciones',
    'settings.notifyVotesHint': 'Cuando votan tu publicación',
    'settings.privacy': 'Privacidad',
    'settings.privateProfile': 'Perfil privado',
    'settings.privateProfileHint': 'Publicaciones visibles solo para seguidores',
    'settings.showInfluence': 'Mostrar puntos influence',
    'settings.showInfluenceHint': 'Otros ven tu puntuación',
    'settings.content': 'Contenido',
    'settings.nsfw': 'Contenido +18',
    'settings.nsfwHint': 'Mostrar publicaciones marcadas para adultos',
    'settings.autoplay': 'Reproducción automática',
    'settings.autoplayHint': 'Los vídeos se inician al desplazarte',
    'settings.about': 'Acerca de',
    'settings.version': 'Versión',
    'settings.versionHint': 'PARAFRAZ, compilación de desarrollo',
    'settings.rules': 'Normas de la comunidad',
    'settings.support': 'Soporte',
    'settings.signOut': 'Cerrar sesión',
    'settings.localOnly':
      'Los interruptores de notificaciones, privacidad y contenido se guardan solo en este dispositivo: todavía no tienen parte servidor.',
  },
} as const;

export type TranslationKey = keyof (typeof DICTIONARY)['ru'];

export function readLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'ru' || stored === 'en' || stored === 'es') return stored;

  const browser = window.navigator.language.slice(0, 2);
  return browser === 'en' || browser === 'es' ? browser : 'ru';
}

export function applyLocale(locale: Locale) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  // Разослать всем подписанным компонентам без перезагрузки страницы.
  window.dispatchEvent(new CustomEvent('parafraz-locale', { detail: locale }));
}

/**
 * Возвращает переводчик. До гидратации отдаёт русский, чтобы серверная
 * разметка совпала с первой отрисовкой; настоящий язык подставляется
 * сразу после монтирования.
 */
export function useT() {
  const [locale, setLocale] = useState<Locale>('ru');

  useEffect(() => {
    setLocale(readLocale());

    const onChange = (event: Event) => setLocale((event as CustomEvent<Locale>).detail);
    window.addEventListener('parafraz-locale', onChange);
    return () => window.removeEventListener('parafraz-locale', onChange);
  }, []);

  function t(key: TranslationKey): string {
    return DICTIONARY[locale][key] ?? DICTIONARY.ru[key] ?? key;
  }

  return { t, locale, setLocale };
}
