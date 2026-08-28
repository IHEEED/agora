/**
 * Разделы настроек — те же, в том же порядке и с теми же значками, что в вебе.
 *
 * Плитка каждого раздела красится своим системным оттенком (те же значения
 * --tint-*), значок — тот же контур path, что на сайте. Группы разделены
 * пустотой: аккаунт-приватность-модерация вместе, ниже поведение приложения,
 * внизу «о приложении».
 */

export type SettingsSectionId =
  | 'account'
  | 'privacy'
  | 'moderation'
  | 'notifications'
  | 'content'
  | 'appearance'
  | 'language'
  | 'about';

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  tint: string;
  /** Путь значка; несколько подпутей разделены « M», как в вебе. */
  path: string;
  /** Показывать только модераторам. */
  modOnly?: boolean;
};

const TINT: Record<SettingsSectionId, string> = {
  account: '#34c759',
  privacy: '#007aff',
  moderation: '#ff2d55',
  notifications: '#ff3b30',
  content: '#ff9500',
  appearance: '#5856d6',
  language: '#30b0c7',
  about: '#8e8e93',
};

const PATH: Record<SettingsSectionId, string> = {
  appearance: 'M12 3a9 9 0 1 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1a1.5 1.5 0 0 1 1.11-2.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8Z M7.5 10.5h.01 M10.5 7.5h.01 M14.5 7.5h.01 M17 10.5h.01',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
  moderation: 'M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z M9 12l2 2 4-4',
  notifications: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8 M13.7 21a2 2 0 0 1-3.4 0',
  privacy: 'M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z',
  content: 'M4 6h16 M4 12h16 M4 18h10',
  language: 'M4 6h11 M9 3v3 M12.5 18 16 9l3.5 9 M13.6 15.6h4.8 M11 6c0 5-3 8-7 9',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8h.01',
};

const LABEL: Record<SettingsSectionId, string> = {
  account: 'Аккаунт',
  privacy: 'Приватность',
  moderation: 'Модерация',
  notifications: 'Уведомления',
  content: 'Контент',
  appearance: 'Оформление',
  language: 'Язык',
  about: 'О приложении',
};

function make(id: SettingsSectionId): SettingsSection {
  return { id, label: LABEL[id], tint: TINT[id], path: PATH[id], modOnly: id === 'moderation' };
}

/** Группы разделов — те же, что в вебе. */
export const SETTINGS_GROUPS: SettingsSection[][] = [
  [make('account'), make('privacy'), make('moderation')],
  [make('notifications'), make('content'), make('appearance'), make('language')],
  [make('about')],
];

export function settingsLabel(id: SettingsSectionId): string {
  return LABEL[id];
}
