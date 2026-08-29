import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { formatRelativeDate } from '../lib/formatDate';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Status = 'open' | 'resolved' | 'dismissed';
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

const REASON: Record<string, string> = {
  spam: 'Спам', abuse: 'Оскорбления', false: 'Ложь', violence: 'Насилие',
  impersonation: 'Выдаёт себя за другого', threats: 'Угрозы', other: 'Прочее',
};
const KIND: Record<string, string> = { post: 'Запись', comment: 'Комментарий', message: 'Сообщение', user: 'Человек', gone: 'Удалено' };
const DURATIONS = [
  { key: 'day', label: 'Сутки' }, { key: 'week', label: 'Неделя' }, { key: 'month', label: 'Месяц' }, { key: 'forever', label: 'Навсегда' },
];
const TABS: { key: Status; label: string }[] = [
  { key: 'open', label: 'В очереди' }, { key: 'resolved', label: 'Разобранные' }, { key: 'dismissed', label: 'Отклонённые' },
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
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<Status>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
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
        data={reports}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
              Модерация<Text style={{ color: palette.accent }}>.</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TABS.map((t) => {
                const on = status === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setStatus(t.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? palette.accent : palette.surface2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {loading ? <Text style={{ color: palette.textMuted }}>Загрузка…</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={{ paddingHorizontal: 4, color: palette.textMuted }}>
              {status === 'open' ? 'Очередь пуста — разбирать нечего.' : 'Здесь пока пусто.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <ReportCard palette={palette} report={item} active={status === 'open'} onDone={() => remove(item.id)} onUser={(id) => navigation.navigate('User', { userId: id })} />
        )}
      />
    </View>
  );
}

function ReportCard({ palette, report, active, onDone, onUser }: { palette: Palette; report: Report; active: boolean; onDone: () => void; onUser: (id: string) => void }) {
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
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.accent }}>{REASON[report.reason] ?? report.reason}</Text>
        </View>
        <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{KIND[report.target.kind]}</Text>
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
          {report.target.kind === 'gone' ? 'Цель уже удалена — смотреть не на что.' : 'Жалоба на человека целиком.'}
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
            <Text style={{ fontSize: 13, color: palette.textMuted }}>На какой срок?</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accentContrast }}>{d.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setBanOpen(false)} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, color: palette.textMuted }}>Отмена</Text>
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

function Btn({ palette, label, onPress, accent = false }: { palette: Palette; label: string; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: accent ? palette.accent : palette.surface2 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: accent ? palette.accentContrast : palette.text }}>{label}</Text>
    </Pressable>
  );
}
