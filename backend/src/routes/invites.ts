import { Router } from 'express';
import { supabase } from '../config/supabase';
import { isBanned, requireAuth, requireNotBanned } from '../middleware/auth';

const router = Router();

/**
 * Приглашения.
 *
 * Регистрации в PARAFRAZ не было вовсе: аккаунт заводили руками в панели
 * Supabase и передавали пароль. Теперь у каждого свой запас кодов — сеть растёт
 * сама, но след остаётся: у каждого пришедшего записано, кто его привёл.
 *
 * Запас списывается при выдаче кода, а не при его использовании, и делает это
 * триггер в базе. Списывай мы при использовании — один код раздали бы сотне
 * человек, и первый пришедший обнулил бы очередь остальных.
 */

/** Те же правила, что при смене имени: см. users.ts. */
const USERNAME = /^[a-zA-Z0-9._-]{3,24}$/;

/** Мои коды и сколько осталось. */
router.get('/mine', requireAuth, async (req, res) => {
  const me = req.user!.id;

  // Запрос теперь один. Раньше их было два, и второй спрашивал invites_left —
  // с миграции 026 запас безлимитный, спрашивать нечего.
  const { data: invites, error: invitesError } = await supabase
    .from('invites')
    .select('code, expires_at, created_at, uses:invite_uses (user_id, used_at, user:users (id, username))')
    .eq('issued_by', me)
    .order('created_at', { ascending: false })
    .limit(50);

  if (invitesError) {
    console.error('invites: list failed', invitesError);
    return res.status(500).json({ error: 'Не удалось загрузить приглашения' });
  }

  // invitesLeft оставлен в ответе ради выложенного клиента, который его ещё
  // читает: null там означает «ограничения нет».
  res.json({ invitesLeft: null, invites });
});

/** Выдать код. Запас проверяет триггер — здесь ловим его отказ. */
router.post('/', requireAuth, requireNotBanned, async (req, res) => {
  const { data, error } = await supabase
    .from('invites')
    .insert({ issued_by: req.user!.id })
    .select('code, expires_at')
    .single();

  if (error) {
    // Ветки «приглашения закончились» здесь больше нет: списывать нечего,
    // триггер снят миграцией 026. Проверка на её текст осталась бы ложью,
    // которую однажды пришлось бы разгадывать.
    console.error('invites: create failed', error);
    return res.status(500).json({ error: 'Не удалось создать приглашение' });
  }

  res.status(201).json(data);
});

/**
 * Проверка кода до заполнения формы.
 *
 * Без авторизации: спрашивает тот, у кого аккаунта ещё нет. Отдаёт только
 * «годится или нет» и имя пригласившего — по коду не должно быть видно, кому
 * ещё его выдавали.
 */
router.get('/:code', async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();

  const { data, error } = await supabase
    .from('invites')
    .select('code, used_at, expires_at, issuer:users!invites_issued_by_fkey (username, banned_until)')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('invites: check failed', error);
    return res.status(500).json({ error: 'Не удалось проверить код' });
  }

  if (!data) return res.status(404).json({ valid: false, reason: 'UNKNOWN' });
  if (data.used_at) return res.status(409).json({ valid: false, reason: 'USED' });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ valid: false, reason: 'EXPIRED' });
  }

  const issuer = data.issuer as unknown as { username: string; banned_until: string | null } | null;

  // Бан гасит выданные коды. Иначе забаненный возвращается чужими руками:
  // раздал десяток приглашений, и каждое приводит его же знакомых.
  if (issuer && isBanned(issuer.banned_until)) {
    return res.status(403).json({ valid: false, reason: 'ISSUER_BANNED' });
  }

  res.json({ valid: true, invitedBy: issuer?.username ?? null });
});

/**
 * Регистрация по коду.
 *
 * Порядок шагов продиктован внешними ключами, а не удобством: invites.used_by
 * ссылается на users, а users.id — на auth.users. Значит сначала учётная
 * запись, потом профиль, и только потом код помечается использованным.
 *
 * Последний шаг — единственный, где решается гонка. Два человека с одним кодом
 * доходят сюда одновременно; побеждает тот, чей update застанет used_by пустым.
 * Проигравшему приходится убирать за собой созданную учётную запись — потому
 * пометка кода и стоит последней, а не первой: откатывать одну строку проще,
 * чем половину регистрации.
 */
router.post('/register', async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const username = String(req.body?.username ?? '').trim();

  if (!code) return res.status(400).json({ error: 'Нужен код приглашения' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Проверьте адрес почты' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль от 8 знаков' });
  }
  if (!USERNAME.test(username)) {
    return res.status(400).json({
      error: 'Имя может состоять из 3–24 латинских букв, цифр, точки, дефиса и подчёркивания',
    });
  }

  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('code, issued_by, used_at, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (inviteError) {
    console.error('invites: register lookup failed', inviteError);
    return res.status(500).json({ error: 'Не удалось проверить код' });
  }
  if (!invite) return res.status(404).json({ error: 'Такого кода нет' });
  // Использованность больше не проверяем: с миграции 026 код многоразовый.
  // Ограничивает его только срок — и он же остаётся единственным способом
  // закрыть код, который разошёлся дальше, чем хотелось.
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'Срок кода истёк' });
  }

  // Имя проверяем до создания учётной записи: чаще всего спотыкаются именно
  // здесь, и убирать за собой в этом случае не придётся вовсе.
  const { data: taken } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (taken) return res.status(409).json({ error: 'Это имя уже занято' });

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    // Почту подтверждать некому и незачем: вход и так закрыт кодом, а письмо
    // с подтверждением на этом этапе — лишний способ не дойти до приложения.
    email_confirm: true,
  });

  if (createError || !created.user) {
    if (createError?.message?.toLowerCase().includes('already')) {
      return res.status(409).json({ error: 'Такая почта уже зарегистрирована' });
    }
    console.error('invites: auth user creation failed', createError);
    return res.status(500).json({ error: 'Не удалось создать аккаунт' });
  }

  const userId = created.user.id;

  const cleanup = async () => {
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  };

  /**
   * Профиль дописываем, а не создаём.
   *
   * В базе висит триггер on_auth_user_created: он вставляет строку в
   * public.users сам, как только появилась учётная запись, и берёт ником часть
   * почты до собачки. Обычная вставка натыкалась на эту же строку и падала
   * нарушением уникальности по id — а сообщение об этом говорило «имя занято»,
   * то есть врало про совершенно свободное имя.
   *
   * upsert по id заменяет ником то, что выбрал человек, и заодно проставляет,
   * кто его позвал. Если триггер однажды уберут — строка просто создастся
   * здесь, и менять ничего не придётся.
   */
  const { error: profileError } = await supabase
    .from('users')
    .upsert({ id: userId, email, username, invited_by: invite.issued_by }, { onConflict: 'id' });

  if (profileError) {
    await cleanup();
    if (profileError.code === '23505') {
      // Какое именно поле не уникально — видно только в тексте ошибки: имя
      // ограничения PostgREST отдаёт в details. Разбирать это важно, потому
      // что человеку надо сказать, что менять.
      const detail = `${profileError.message} ${profileError.details ?? ''}`;
      if (detail.includes('username')) {
        return res.status(409).json({ error: 'Это имя уже занято' });
      }
      if (detail.includes('email')) {
        return res.status(409).json({ error: 'Такая почта уже зарегистрирована' });
      }
      return res.status(409).json({ error: 'Такой аккаунт уже есть' });
    }
    console.error('invites: profile creation failed', profileError);
    return res.status(500).json({ error: 'Не удалось создать профиль' });
  }

  /**
   * Отмечаем приход, а не «расходуем код».
   *
   * Раньше здесь был update с условием `used_by is null` — гонка решалась тем,
   * что побеждал первый: второму, дошедшему одновременно, отвечали «код только
   * что использовал кто-то другой». С безлимитным кодом гонки нет вовсе:
   * приходят все, и запись о каждом ложится своей строкой.
   *
   * Ошибку не глушим, но и регистрацию из-за неё не откатываем: человек уже
   * создан и войти может. Потерянная строка в списке приведённых — цена
   * несравнимо меньшая, чем «зарегистрировался и тут же исчез».
   */
  const { error: claimError } = await supabase
    .from('invite_uses')
    .insert({ code, user_id: userId });

  if (claimError) {
    console.error('invites: use record failed', claimError);
  }

  // Пароль в ответ не возвращаем и сессию здесь не открываем: клиент входит
  // обычным signInWithPassword теми же данными, что только что прислал. Так
  // токен появляется там же, где он появляется при всех остальных входах, и
  // отдельной ветки хранения сессии не заводится.
  res.status(201).json({ ok: true, userId, username });
});

export default router;
