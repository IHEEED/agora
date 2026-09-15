import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { formatRelativeDate } from '../lib/formatDate';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { ModeratorsPanel } from '../components/ModeratorsPanel';
import { useMe } from '../lib/useMe';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Status = 'open' | 'resolved' | 'dismissed' | 'log' | 'mods';
type Palette = ReturnType<typeof usePalette>;

type Report = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  reporter: { username: string } | null;
  target: { kind: 'post' | 'comment' | 'message' | 'user' | 'gone'; id?: string; title?: string | null; body?: string | null };
  author: { id: string; username: string; verified_at: string | null; banned_until: string | null } | null;
};

/** Строка журнала: одно действие модератора, каким оно осталось в логе. */
type ModAction = {
  id: string;
  action: string;
  reason: string | null;
  banned_until: string | null;
  created_at: string;
  moderator: { id: string; username: string } | null;
  target: { id: string; username: string } | null;
};

const ACTION_LABEL: Record<string, string> = {
  ban: 'Бан', unban: 'Бан снят', delete_post: 'Запись удалена', delete_comment: 'Комментарий удалён',
  dismiss: 'Жалоба отклонена', warn: 'Предупреждение', verify: 'Галочка выдана', unverify: 'Галочка снята',
};

/** Как показать срок бана: вечный отдельно, прочие — датой окончания. */
function banTerm(until: string | null): string | null {
  if (!until) return null;
  if (until.startsWith('infinity')) return 'навсегда';
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return null;
  return `до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

const REASON: Record<string, string> = {
  spam: 'Спам', abuse: 'Оскорбления', false: 'Ложь', violence: 'Насилие',
  impersonation: 'Выдаёт себя за другого', threats: 'Угрозы', other: 'Прочее',
};
const KIND: Record<string, string> = { post: 'Запись', comment: 'Комментарий', message: 'Сообщение', user: 'Человек', gone: 'Удалено' };
const DURATIONS = [
  { key: 'day', label: 'Сутки' }, { key: 'week', label: 'Неделя' }, { key: 'month', label: 'Месяц' }, { key: 'forever', label: 'Навсегда' },
];
const TABS: { key: Status; label: string }[] = [
  { key: 'open', label: 'В очереди' }, { key: 'resolved', label: 'Разобранные' }, { key: 'dismissed', label: 'Отклонённые' }, { key: 'log', label: 'Журнал' },
];

/**
 * Разбор жалоб — очередь и решения, перенесены с веба.
 *
 * Вкладки по состоянию; у каждой жалобы причина, тип цели, время, кто пожаловался
 * и цитата содержимого. Действия: нарушения нет (отклонить), удалить цель,
 * подтвердить/снять галочку автору и забанить на срок.
 */
export function ModerationScreen() {
  const palette = usePalette();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const me = useMe();
  const [status, setStatus] = useState<Status>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [actions, setActions] = useState<ModAction[]>([]);
  const [loading, setLoading] = useState(true);

  const isLog = status === 'log';
  const isMods = status === 'mods';
  const items: (Report | ModAction)[] = isMods ? [] : isLog ? actions : reports;
  const tabs = me?.role === 'admin' ? [...TABS, { key: 'mods' as Status, label: 'Модераторы' }] : TABS;

  const load = useCallback(() => {
    if (status === 'mods') { setLoading(false); return; }
    setLoading(true);
    if (status === 'log') {
      apiFetch<{ actions: ModAction[] }>('/moderation/actions')
        .then((data) => setActions(data.actions ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    apiFetch<{ reports: Report[] }>(`/moderation/reports?status=${status}`)
      .then((data) => setReports(data.reports ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  useFocusEffect(useCallback(() => load(), [load]));

  function remove(id: string) {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar back right="none" />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 40 }}
        scrollIndicatorInsets={{ top: topInset }}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
              {tr('Модерация')}<Text style={{ color: palette.accent }}>.</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tabs.map((t) => {
                const on = status === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setStatus(t.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? palette.accent : palette.surface2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>{tr(t.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {loading && !isMods ? <Text style={{ color: palette.textMuted }}>{tr('Загрузка…')}</Text> : null}
            {isMods ? <ModeratorsPanel meId={me?.id} /> : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !isMods ? (
            <Text style={{ paddingHorizontal: 4, color: palette.textMuted }}>
              {tr(isLog ? 'В журнале пока пусто — действий модерации ещё не было.' : status === 'open' ? 'Очередь пуста — разбирать нечего.' : 'Здесь пока пусто.')}
            </Text>
          ) : null
        }
        renderItem={({ item }) =>
          'action' in item ? (
            <ActionRow palette={palette} action={item} onUser={(id) => navigation.navigate('User', { userId: id })} />
          ) : (
            <ReportCard palette={palette} report={item} active={status === 'open'} onDone={() => remove(item.id)} onUser={(id) => navigation.navigate('User', { userId: id })} />
          )
        }
      />
    </View>
  );
}

function ReportCard({ palette, report, active, onDone, onUser }: { palette: Palette; report: Report; active: boolean; onDone: () => void; onUser: (id: string) => void }) {
  const { t: tr } = useT();
  const [banOpen, setBanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const text = report.target.title
    ? `${report.target.title}${report.target.body ? ' — ' + report.target.body : ''}`
    : report.target.body ?? '';

  const close = (dismiss: boolean, resolution?: string) =>
    apiFetch(`/moderation/reports/${report.id}/close`, { method: 'POST', body: JSON.stringify({ dismiss, resolution }) });

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); onDone(); } catch { setBusy(false); }
  }

  return (
    <View style={{ borderRadius: 16, backgroundColor: palette.surface, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${palette.accent}22` }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.accent }}>{tr(REASON[report.reason] ?? report.reason)}</Text>
        </View>
        <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{tr(KIND[report.target.kind])}</Text>
        <Text style={{ color: palette.textMuted }}>·</Text>
        <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{formatRelativeDate(report.created_at)}</Text>
        {report.reporter ? <Text style={{ fontSize: 12.5, color: palette.textMuted }}>· от {report.reporter.username}</Text> : null}
      </View>

      {text ? (
        <View style={{ borderRadius: 12, backgroundColor: palette.surface2, padding: 12 }}>
          <Text numberOfLines={8} style={{ fontSize: 14, lineHeight: 20, color: palette.text }}>{text}</Text>
        </View>
      ) : (
        <Text style={{ fontSize: 13.5, color: palette.textMuted }}>
          {tr(report.target.kind === 'gone' ? 'Цель уже удалена — смотреть не на что.' : 'Жалоба на человека целиком.')}
        </Text>
      )}

      {report.author?.id ? (
        <Pressable onPress={() => onUser(report.author!.id)}>
          <Text style={{ fontSize: 13, color: palette.textMuted }}>
            Автор: <Text style={{ color: palette.accent }}>{report.author.username}</Text>
            {report.author.verified_at ? ' · подтверждён' : ''}{report.author.banned_until ? ' · уже забанен' : ''}
          </Text>
        </Pressable>
      ) : null}

      {active ? (
        banOpen ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>{tr('На какой срок?')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d.key}
                  onPress={() => act(async () => {
                    await apiFetch('/moderation/ban', { method: 'POST', body: JSON.stringify({ userId: report.author?.id, duration: d.key, reason: REASON[report.reason] ?? report.reason, reportId: report.id }) });
                    await close(false, `Бан: ${d.label.toLowerCase()}`);
                  })}
                  style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: palette.accent }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accentContrast }}>{tr(d.label)}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setBanOpen(false)} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, color: palette.textMuted }}>{tr('Отмена')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn palette={palette} label="Нарушения нет" onPress={() => act(() => close(true, 'Нарушения нет'))} />
            {report.target.kind !== 'user' && report.target.kind !== 'gone' ? (
              <Btn palette={palette} label="Удалить" onPress={() => act(async () => { await apiFetch(`/moderation/reports/${report.id}/delete-target`, { method: 'POST' }); await close(false, 'Удалено'); })} />
            ) : null}
            {report.author?.id ? (
              <Btn palette={palette} label={report.author.verified_at ? 'Снять галочку' : 'Подтвердить'} onPress={() => act(async () => { await apiFetch('/moderation/verify', { method: 'POST', body: JSON.stringify({ userId: report.author?.id, verified: !report.author?.verified_at }) }); await close(false, 'Разобрано'); })} />
            ) : null}
            {report.author?.id ? <Btn palette={palette} label="Забанить" accent onPress={() => setBanOpen(true)} /> : null}
          </View>
        )
      ) : null}
    </View>
  );
}

/** Одна строка журнала: что сделали, с кем и когда. */
function ActionRow({ palette, action, onUser }: { palette: Palette; action: ModAction; onUser: (id: string) => void }) {
  const { t: tr } = useT();
  const label = ACTION_LABEL[action.action] ?? action.action;
  const term = action.action === 'ban' ? banTerm(action.banned_until) : null;
  return (
    <View style={{ borderRadius: 16, backgroundColor: palette.surface, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${palette.accent}22` }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.accent }}>{tr(label)}</Text>
        </View>
        {term ? <Text style={{ fontSize: 12.5, color: palette.textMuted }}>· {term}</Text> : null}
        <Text style={{ color: palette.textMuted }}>·</Text>
        <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{formatRelativeDate(action.created_at)}</Text>
      </View>

      <Text style={{ fontSize: 13.5, color: palette.text }}>
        {action.target ? (
          <Text onPress={() => onUser(action.target!.id)} style={{ color: palette.accent }}>{action.target.username}</Text>
        ) : (
          <Text style={{ color: palette.textMuted }}>{tr('цель не сохранилась')}</Text>
        )}
        {action.moderator ? <Text style={{ color: palette.textMuted }}> · {tr('модератор')} {action.moderator.username}</Text> : null}
      </Text>

      {action.reason ? <Text style={{ fontSize: 13, lineHeight: 19, color: palette.textMuted }}>{action.reason}</Text> : null}
    </View>
  );
}

function Btn({ palette, label, onPress, accent = false }: { palette: Palette; label: string; onPress: () => void; accent?: boolean }) {
  const { t } = useT();
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: accent ? palette.accent : palette.surface2 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: accent ? palette.accentContrast : palette.text }}>{t(label)}</Text>
    </Pressable>
  );
}
