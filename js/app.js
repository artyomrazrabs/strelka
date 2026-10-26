import { h, render } from 'https://esm.sh/preact@10.24.3';
import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.24.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import * as api from './api.js';

const html = htm.bind(h);

/* ---------- иконки ---------- */
const I = {
  back: 'M15 18l-6-6 6-6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 4-7 8-7s8 3 8 7',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  users: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.7',
  pin: 'M12 22s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  check: 'M5 12l5 5 9-10',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  share: 'M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01'
};
const Icon = ({ d, size = 22, w = 2.2 }) => html`<svg aria-hidden="true" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round"><path d=${d} /></svg>`;

/* ---------- помощники ---------- */
const CATEGORIES = ['Спорт', 'Шахматы', 'Книги', 'Заработок', 'КВН', 'Что? Где? Когда?', 'Киберспорт'];
const PHRASES = ['Го выйдем в…', 'Пошли раз на раз…', 'Спорим, не вывезешь?', 'Проверим, кто круче'];
const PLATFORMS = ['Lichess', 'Steam', 'Zoom', 'Telegram'];

const go = (path) => { location.hash = '#/' + path; };
const roleOf = (c, uid) => (c.author_id === uid ? 'author' : c.opponent_id === uid ? 'opponent' : 'guest');
const nickOf = (p) => (p && p.nick ? '@' + p.nick : null);
const otherNick = (c, uid) => (c.author_id === uid ? nickOf(c.opponent) || (c.target === 'open' ? 'любой желающий' : 'по ссылке') : nickOf(c.author));
const myResult = (c, uid) => (c.author_id === uid ? c.author_result : c.opponent_id === uid ? c.opponent_result : null);
const theirResult = (c, uid) => (c.author_id === uid ? c.opponent_result : c.author_result);
const initial = (s) => (s || '?').replace('@', '').charAt(0) || '?';

function fmtWhen(iso) {
  if (!iso) return 'Время не указано';
  return new Date(iso).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function whereText(c) {
  if (c.mode === 'online') return 'Онлайн' + (c.platform ? ' · ' + c.platform : '');
  return c.place || 'Место не указано';
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function shareUrl(id) {
  return location.origin + location.pathname + '#/c/' + id;
}

function computeStats(list, uid) {
  const finished = list.filter((c) => c.status === 'done' || c.status === 'conflict');
  let wins = 0, losses = 0, conflicts = 0;
  const byCat = {};
  for (const c of finished) {
    byCat[c.category] = byCat[c.category] || { w: 0, l: 0 };
    if (c.status === 'conflict') { conflicts++; continue; }
    if (myResult(c, uid) === 'win') { wins++; byCat[c.category].w++; } else { losses++; byCat[c.category].l++; }
  }
  let streak = 0;
  for (const c of finished) {
    if (c.status !== 'done') continue;
    if (myResult(c, uid) === 'win') streak++; else break;
  }
  return { wins, losses, conflicts, streak, byCat, finished, total: wins + losses };
}

function statusPill(c, uid) {
  const role = roleOf(c, uid);
  if (c.status === 'pending') return role === 'opponent' ? ['Ответь', 'lime'] : ['Ждём ответа', ''];
  if (c.status === 'countered') return role === 'author' ? ['Правки', 'lime'] : ['Правки у автора', ''];
  if (c.status === 'accepted') return myResult(c, uid) ? ['Ждём соперника', ''] : ['Внеси результат', 'lime'];
  if (c.status === 'conflict') return ['Конфликт', 'hot'];
  if (c.status === 'done') return myResult(c, uid) === 'win' ? ['Победа', 'lime'] : ['Поражение', ''];
  if (c.status === 'declined') return ['Отказ', ''];
  return ['Отменена', ''];
}

/* ---------- общие части ---------- */
function Tabs({ active }) {
  const items = [['', 'Главная', I.home], ['explore', 'Стрелки', I.flame], ['stats', 'Статистика', I.chart], ['me', 'Аккаунт', I.user]];
  return html`<nav class="tabs" aria-label="Главное меню">
    ${items.map(([p, label, d]) => html`<a href=${'#/' + p} class=${active === p ? 'on' : ''} aria-current=${active === p ? 'page' : undefined}><span><${Icon} d=${d} w="2" /></span>${label}</a>`)}
  </nav>`;
}

function Top({ title, back = '' }) {
  return html`<header class="top">
    <a href=${'#/' + back} class="iconbtn" aria-label="Назад"><${Icon} d=${I.back} w="2.4" /></a>
    <h1 class="h1">${title}</h1>
  </header>`;
}

function ChallengeCard({ c, uid }) {
  const [label, tone] = statusPill(c, uid);
  return html`<a href=${'#/c/' + c.id} class=${'card' + (tone === 'lime' ? ' strong' : '')}>
    <div class="between"><span class="label">${c.mode === 'online' ? 'Онлайн' : 'Офлайн'} · ${c.category}</span><span class=${'pill ' + tone}>${label}</span></div>
    <span style="font-size:16px;font-weight:800;overflow-wrap:anywhere">${c.call_text}</span>
    <span class="muted">vs ${otherNick(c, uid)} · ${fmtWhen(c.starts_at)}</span>
  </a>`;
}

function Loading() {
  return html`<div class="center"><span class="muted">Загружаем…</span></div>`;
}

/* ---------- вход ---------- */
function Setup() {
  return html`<div class="center">
    <span class="logo"><i></i>СТРЕЛКА</span>
    <p class="big">Приложение ещё не подключено к базе данных.</p>
    <p class="muted">Впиши адрес и ключ проекта Supabase в файл js/config.js.</p>
  </div>`;
}

function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await api.sendLoginLink(email.trim()); setSent(true); }
    catch (x) { setErr('Не получилось отправить письмо. Проверь адрес или попробуй позже.'); }
    setBusy(false);
  };
  return html`<div class="center">
    <span class="logo"><i></i>СТРЕЛКА</span>
    <h1 class="hero">ЗАБИВАЙ.<br />ПРИНИМАЙ.<br />ПОБЕЖДАЙ.</h1>
    ${sent
      ? html`<div class="banner lime"><b>Проверь почту</b><span>Мы отправили ссылку для входа на ${email}. Открой её на этом же устройстве.</span></div>
             <button class="btn link" onClick=${() => setSent(false)}>Ввести другую почту</button>`
      : html`<form class="stack" onSubmit=${submit}>
          <label class="field"><span>Почта</span>
            <input class="input" type="email" required autocomplete="email" placeholder="ты@почта.ру" value=${email} onInput=${(e) => setEmail(e.target.value)} /></label>
          <button class="btn primary" type="submit" disabled=${busy}>${busy ? 'Отправляем…' : 'ВОЙТИ ПО ССЫЛКЕ'}</button>
          ${err && html`<span class="err">${err}</span>`}
          <span class="muted">Пароль не нужен: пришлём ссылку на почту.</span>
        </form>`}
  </div>`;
}

function NickSetup({ uid, onDone }) {
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');
  const clean = nick.trim().toLowerCase().replace(/^@/, '');
  const submit = async (e) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) { setErr('От 3 до 20 символов: латинские буквы, цифры и _'); return; }
    try { onDone(await api.createProfile(uid, clean)); }
    catch (x) { setErr(x.code === '23505' ? 'Этот ник уже занят' : 'Не получилось сохранить ник'); }
  };
  return html`<div class="center">
    <h1 class="hero">КАК ТЕБЯ ЗВАТЬ?</h1>
    <form class="stack" onSubmit=${submit}>
      <label class="field"><span>Ник — по нему тебя будут вызывать</span>
        <input class="input" required placeholder="@nickname" value=${nick} onInput=${(e) => setNick(e.target.value)} /></label>
      <button class="btn primary" type="submit">ПОЕХАЛИ</button>
      ${err && html`<span class="err">${err}</span>`}
    </form>
  </div>`;
}

/* ---------- главный ---------- */
function Home({ me, mine, uid }) {
  const st = computeStats(mine, uid);
  const inbox = mine.filter((c) => (c.opponent_id === uid && c.status === 'pending') || (c.author_id === uid && c.status === 'countered')).length;
  const current = mine.filter((c) => ['accepted', 'conflict', 'countered', 'pending'].includes(c.status));
  const last = st.finished.find((c) => c.status === 'done');
  return html`
    <div class="scroll">
      <div class="between">
        <span class="logo"><i></i>СТРЕЛКА</span>
        <a href="#/inbox" class="iconbtn" aria-label=${'Вызовы, новых: ' + inbox}><${Icon} d=${I.bell} />${inbox > 0 && html`<span class="badge">${inbox}</span>`}</a>
      </div>
      <section class="dark">
        <div class="row">
          <div class="avatar">${initial(me.nick)}</div>
          <div class="stack" style="gap:2px"><span style="font-weight:800;font-size:16px">@${me.nick}</span><span class="muted">${st.total + st.conflicts} стрелок за всё время</span></div>
        </div>
        <div class="grid3">
          <div class="tile"><span class="num lime">${st.wins}</span><span class="muted">побед</span></div>
          <div class="tile"><span class="num">${st.losses}</span><span class="muted">поражений</span></div>
          <div class="tile"><span class="num">×${st.streak}</span><span class="muted">серия побед</span></div>
        </div>
        ${last && html`<a href=${'#/c/' + last.id} class="between" style="border-top:1px solid #2E2E2B;padding-top:14px;color:#fff;text-decoration:none">
          <div class="stack" style="gap:2px;min-width:0"><span class="label">Последняя стрелка</span><span style="font-weight:700">${last.category} vs ${otherNick(last, uid)}</span></div>
          <span class=${'pill ' + (myResult(last, uid) === 'win' ? 'lime' : '')}>${myResult(last, uid) === 'win' ? 'Победа' : 'Поражение'}</span>
        </a>`}
      </section>
      <section class="stack">
        <div class="between"><h2 class="h2">Текущие стрелки</h2><span class="muted">${current.length}</span></div>
        ${current.length
          ? current.map((c) => html`<${ChallengeCard} c=${c} uid=${uid} />`)
          : html`<div class="empty"><span style="font-weight:800">Пока тихо</span><span class="muted">Забей первую стрелку или найди открытую в ленте.</span><a class="btn sm" href="#/explore">Открытые стрелки</a></div>`}
      </section>
    </div>
    <div class="cta"><a href="#/new">
      <div><strong>ЗАБИТЬ СТРЕЛКУ</strong><span style="font-size:13px;font-weight:700">Брось вызов кому угодно</span></div>
      <span class="plus"><${Icon} d=${I.plus} size="26" w="2.6" /></span>
    </a></div>
    <${Tabs} active="" />`;
}

/* ---------- забить стрелку ---------- */
function Create({ uid, onCreated }) {
  const [f, setF] = useState({ text: 'Го выйдем в…', cat: 'Спорт', customCat: '', desc: '', who: 'open', nick: '', mode: 'offline', place: '', platform: '', when: '' });
  const [panel, setPanel] = useState('what');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });
  const pick = (k, v) => () => setF({ ...f, [k]: v });
  const category = f.cat === 'Своя' ? f.customCat.trim() : f.cat;
  const whoLabel = { user: f.nick ? '@' + f.nick.replace(/^@/, '') : 'Игрок по нику', link: 'По ссылке', open: 'Любой желающий' }[f.who];
  const where = f.mode === 'offline' ? (f.place ? f.place : 'Офлайн') : 'Онлайн' + (f.platform ? ' · ' + f.platform : '');
  const tiles = [
    ['what', 'В чём', category || 'Выбери', I.target],
    ['who', 'С кем', whoLabel, I.users],
    ['where', 'Где', where, I.pin],
    ['when', 'Когда', f.when ? fmtWhen(f.when) : 'Выбери', I.clock]
  ];

  const submit = async () => {
    setErr('');
    if (!f.text.trim()) { setErr('Напиши, в чём вызов'); setPanel('what'); return; }
    if (!category) { setErr('Укажи категорию'); setPanel('what'); return; }
    let opponent_id = null;
    setBusy(true);
    try {
      if (f.who === 'user') {
        const nick = f.nick.trim().toLowerCase().replace(/^@/, '');
        const p = nick && await api.findByNick(nick);
        if (!p) { setErr('Игрок с таким ником не найден'); setPanel('who'); setBusy(false); return; }
        if (p.id === uid) { setErr('Себе вызов бросить не выйдет'); setPanel('who'); setBusy(false); return; }
        opponent_id = p.id;
      }
      const row = await api.createChallenge({
        target: f.who, opponent_id, call_text: f.text.trim(), category, description: f.desc.trim() || null,
        mode: f.mode, place: f.mode === 'offline' ? f.place.trim() || null : null,
        platform: f.mode === 'online' ? f.platform || null : null,
        starts_at: f.when ? new Date(f.when).toISOString() : null
      });
      onCreated();
      go('c/' + row.id);
    } catch (x) { setErr('Не получилось отправить. Попробуй ещё раз.'); }
    setBusy(false);
  };

  return html`
    <${Top} title="Забиваем стрелку" />
    <div class="scroll" style="gap:14px;padding-top:8px">
      <div class="stack" style="gap:8px">
        <label class="label" for="call">Твой вызов</label>
        <textarea id="call" class="callinput" rows="2" maxlength="200" value=${f.text} onInput=${set('text')}></textarea>
        <div class="chips scrollx">${PHRASES.map((p) => html`<button type="button" class="chip dash" onClick=${pick('text', p)}>${p}</button>`)}</div>
      </div>
      <div class="grid2">
        ${tiles.map(([k, label, value, d]) => html`<button type="button" class=${'ptile' + (panel === k ? ' on' : '')} onClick=${() => setPanel(k)}><${Icon} d=${d} size="24" /><b>${label}</b><small>${value}</small></button>`)}
      </div>
      <section class="card">
        ${panel === 'what' && html`<div class="stack" style="gap:12px">
          <h2 class="h2">В чём соревнуемся</h2>
          <div class="chips">${[...CATEGORIES, 'Своя'].map((c) => html`<button type="button" class=${'chip' + (f.cat === c ? ' on' : '')} onClick=${pick('cat', c)}>${c === 'Своя' ? '+ Своя' : c}</button>`)}</div>
          ${f.cat === 'Своя' && html`<label class="field"><span>Название своей категории</span><input class="input" maxlength="40" placeholder="Например: планка на время" value=${f.customCat} onInput=${set('customCat')} /></label>`}
          <label class="field"><span>Условия своими словами</span><textarea class="input" rows="3" maxlength="1000" placeholder="Сколько подходов, какие правила, кто судит" value=${f.desc} onInput=${set('desc')}></textarea></label>
        </div>`}
        ${panel === 'who' && html`<div class="stack">
          <h2 class="h2">Кому бросаем</h2>
          ${[['user', 'Игроку в приложении', 'Найдём по нику'], ['link', 'По ссылке', 'Отправишь на почту или в соцсети'], ['open', 'Открытый вызов', 'Принять может кто угодно']].map(([k, t, s]) => html`
            <button type="button" class=${'option' + (f.who === k ? ' on' : '')} onClick=${pick('who', k)}>
              <span class="dot">${f.who === k && html`<${Icon} d=${I.check} size="14" w="3" />`}</span>
              <span class="stack" style="gap:2px"><span style="font-weight:800;font-size:15px">${t}</span><span class="muted">${s}</span></span>
            </button>`)}
          ${f.who === 'user' && html`<input class="input" aria-label="Ник соперника" placeholder="@ник соперника" autocapitalize="off" value=${f.nick} onInput=${set('nick')} />`}
          ${f.who === 'link' && html`<span class="muted">После отправки дадим ссылку и готовый текст для письма или поста.</span>`}
        </div>`}
        ${panel === 'where' && html`<div class="stack" style="gap:12px">
          <h2 class="h2">Где встречаемся</h2>
          <div class="seg"><button type="button" class=${f.mode === 'offline' ? 'on' : ''} onClick=${pick('mode', 'offline')}>Офлайн</button><button type="button" class=${f.mode === 'online' ? 'on' : ''} onClick=${pick('mode', 'online')}>Онлайн</button></div>
          ${f.mode === 'offline'
            ? html`<label class="field"><span>Место</span><input class="input" maxlength="120" placeholder="Например: набережная, турник у моста" value=${f.place} onInput=${set('place')} /></label>`
            : html`<div class="stack"><span style="font-size:13px;font-weight:700">Платформа, если нужна</span>
                <div class="chips">${['', ...PLATFORMS].map((p) => html`<button type="button" class=${'chip' + (f.platform === p ? ' on' : '')} onClick=${pick('platform', p)}>${p || 'Без платформы'}</button>`)}</div>
                <input class="input" maxlength="60" aria-label="Своя платформа" placeholder="Или впиши свою" value=${PLATFORMS.includes(f.platform) ? '' : f.platform} onInput=${set('platform')} /></div>`}
        </div>`}
        ${panel === 'when' && html`<div class="stack" style="gap:12px">
          <h2 class="h2">Когда</h2>
          <input class="input" type="datetime-local" aria-label="Дата и время" value=${f.when} onInput=${set('when')} />
          <span class="muted">Можно не указывать — договоритесь потом.</span>
        </div>`}
      </section>
      ${err && html`<span class="err">${err}</span>`}
    </div>
    <div class="bottom">
      <button class="btn black" style="height:60px;font-size:17px" disabled=${busy} onClick=${submit}>${busy ? 'ОТПРАВЛЯЕМ…' : 'ОТПРАВИТЬ ВЫЗОВ'}<${Icon} d=${I.arrow} size="20" w="2.6" /></button>
      <span class="muted" style="text-align:center;font-size:12px">${f.who === 'open' ? 'Открытый вызов увидят все в ленте' : 'Соперник сможет принять, отказаться или предложить свои условия'} · без насилия и ставок</span>
    </div>`;
}

/* ---------- одна стрелка ---------- */
function ShareBlock({ c }) {
  const url = shareUrl(c.id);
  const text = `Вызываю тебя на стрелку: ${c.call_text} Принимаешь? ${url}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch (e) { setCopied(false); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'Стрелка', text, url }); } catch (e) {} } else copy(); };
  return html`<section class="card strong">
    <span class="label">Позови соперника</span>
    <span style="font-weight:700;line-height:1.4;overflow-wrap:anywhere">${text}</span>
    <div class="grid2">
      <button class="btn sm" onClick=${share}><${Icon} d=${I.share} size="16" />Поделиться</button>
      <a class="btn sm" href=${'mailto:?subject=' + encodeURIComponent('Вызов на стрелку') + '&body=' + encodeURIComponent(text)}><${Icon} d=${I.mail} size="16" />На почту</a>
    </div>
    <button class="btn sm ghost" onClick=${copy}><${Icon} d=${I.copy} size="16" />${copied ? 'Скопировано' : 'Скопировать текст'}</button>
  </section>`;
}

function CounterForm({ c, onSend, onCancel }) {
  const [p, setP] = useState({ category: c.category, place: c.place || '', platform: c.platform || '', when: toLocalInput(c.starts_at), description: c.description || '' });
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const send = () => {
    const out = {};
    if (p.category.trim() && p.category.trim() !== c.category) out.category = p.category.trim();
    if (c.mode === 'offline' && p.place.trim() !== (c.place || '')) out.place = p.place.trim();
    if (c.mode === 'online' && p.platform.trim() !== (c.platform || '')) out.platform = p.platform.trim();
    if (p.when !== toLocalInput(c.starts_at)) out.starts_at = p.when ? new Date(p.when).toISOString() : null;
    if (p.description.trim() !== (c.description || '')) out.description = p.description.trim();
    onSend(out);
  };
  return html`<div class="stack">
    <span class="muted">Поменяй то, что не устраивает. Автор увидит правки и решит.</span>
    <label class="field"><span>В чём</span><input class="input" maxlength="40" value=${p.category} onInput=${set('category')} /></label>
    ${c.mode === 'offline'
      ? html`<label class="field"><span>Где</span><input class="input" maxlength="120" value=${p.place} onInput=${set('place')} /></label>`
      : html`<label class="field"><span>Платформа</span><input class="input" maxlength="60" value=${p.platform} onInput=${set('platform')} /></label>`}
    <label class="field"><span>Когда</span><input class="input" type="datetime-local" value=${p.when} onInput=${set('when')} /></label>
    <label class="field"><span>Условия</span><textarea class="input" rows="3" maxlength="1000" value=${p.description} onInput=${set('description')}></textarea></label>
    <button class="btn black" onClick=${send}>ОТПРАВИТЬ ПРАВКИ</button>
    <button class="btn link" onClick=${onCancel}>Отмена</button>
  </div>`;
}

const PROPOSAL_LABELS = { category: 'В чём', place: 'Где', platform: 'Платформа', starts_at: 'Когда', description: 'Условия' };
const showVal = (k, v) => (k === 'starts_at' ? fmtWhen(v) : v || '—');

function Detail({ id, uid, onChanged, toast }) {
  const [c, setC] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setC(await api.getChallenge(id)); } catch (e) { setC(null); } }, [id]);
  useEffect(() => { load(); }, [load]);

  if (c === undefined) return html`<${Top} title="Стрелка" /><${Loading} />`;
  if (c === null) return html`<${Top} title="Стрелка" /><div class="center"><p class="big">Стрелка не найдена</p><span class="muted">Возможно, её отменили или ссылка неверная.</span></div>`;

  const role = roleOf(c, uid);
  const mineR = myResult(c, uid);
  const theirsR = theirResult(c, uid);
  const act = async (patch, msg) => {
    setBusy(true);
    try { setC(await api.updateChallenge(c.id, patch)); setEditing(false); onChanged(); if (msg) toast(msg); }
    catch (e) { toast('Не получилось. Попробуй ещё раз.'); load(); }
    setBusy(false);
  };
  const conds = [['В чём', c.category], ['Формат', c.mode === 'online' ? 'Онлайн' : 'Офлайн'], ['Где', whereText(c)], ['Когда', fmtWhen(c.starts_at)]];
  const authorNick = nickOf(c.author);
  const oppNick = nickOf(c.opponent) || (c.target === 'open' ? 'Любой' : 'Ждём');
  const canJoin = role === 'guest' && !c.opponent_id && c.status === 'pending' && c.target !== 'user';
  const inGame = (c.status === 'accepted' || c.status === 'conflict') && role !== 'guest';

  return html`
    <${Top} title="Стрелка" />
    <div class="scroll" style="padding-top:8px;gap:14px">
      <section class="dark">
        <span class="label">${c.mode === 'online' ? 'Онлайн' : 'Офлайн'} · ${c.category}</span>
        <div class="vs">
          <div><span class="avatar">${initial(authorNick)}</span>${authorNick}</div>
          <span class="num lime" style="font-size:26px;font-weight:900">VS</span>
          <div><span class="avatar white">${c.opponent ? initial(oppNick) : '?'}</span>${oppNick}</div>
        </div>
        <p class="big" style="text-align:center">${c.call_text}</p>
      </section>

      <section class="card">
        <div class="stack" style="gap:0">
          ${conds.map(([k, v]) => html`<div class="cond"><span>${k}</span><span>${v}</span></div>`)}
        </div>
        ${c.description && html`<span style="font-weight:600;line-height:1.45;white-space:pre-line;overflow-wrap:anywhere">${c.description}</span>`}
      </section>

      ${c.status === 'countered' && c.proposal && html`<section class="card strong">
        <span style="font-weight:800">${role === 'author' ? (nickOf(c.opponent) || 'Соперник') + ' предлагает правки:' : 'Твои правки на рассмотрении:'}</span>
        ${Object.entries(c.proposal).map(([k, v]) => html`<div class="stack" style="gap:4px;background:var(--bg);border-radius:14px;padding:12px">
          <span class="muted">${PROPOSAL_LABELS[k] || k}</span>
          <div class="row" style="flex-wrap:wrap"><s class="muted">${showVal(k, c[k])}</s><${Icon} d=${I.arrow} size="16" /><span class="pill lime">${showVal(k, v)}</span></div>
        </div>`)}
        ${role === 'author'
          ? html`<div class="grid2">
              <button class="btn primary" style="font-size:14px" disabled=${busy} onClick=${() => act({ ...c.proposal, proposal: null, status: 'accepted' }, 'Договорились! Стрелка принята')}>Принять</button>
              <button class="btn" disabled=${busy} onClick=${() => act({ proposal: null, status: 'pending' }, 'Правки отклонены')}>Отклонить</button>
            </div>`
          : html`<button class="btn sm ghost" disabled=${busy} onClick=${() => act({ proposal: null, status: 'pending' })}>Отозвать правки</button>`}
      </section>`}

      ${canJoin && html`<button class="btn primary" style="height:60px;font-size:17px" disabled=${busy} onClick=${() => act({ opponent_id: uid, status: 'accepted' }, 'Ты в деле!')}>ПРИНЯТЬ ВЫЗОВ</button>`}

      ${role === 'opponent' && c.status === 'pending' && (editing
        ? html`<section class="card strong"><${CounterForm} c=${c} onCancel=${() => setEditing(false)} onSend=${(p) => (Object.keys(p).length ? act({ proposal: p, status: 'countered' }, 'Правки отправлены') : setEditing(false))} /></section>`
        : html`<div class="stack" style="gap:8px">
            <button class="btn primary" style="height:58px" disabled=${busy} onClick=${() => act({ status: 'accepted' }, 'Стрелка принята!')}>ПРИНЯТЬ</button>
            <div class="grid2">
              <button class="btn" disabled=${busy} onClick=${() => setEditing(true)}>Свои условия</button>
              <button class="btn ghost" disabled=${busy} onClick=${() => act({ status: 'declined' }, 'Ты отказался')}>Отказаться</button>
            </div>
          </div>`)}

      ${role === 'author' && c.status === 'pending' && html`<div class="stack">
        ${c.target === 'link' && !c.opponent_id && html`<${ShareBlock} c=${c} />`}
        <div class="banner gray"><span>${c.target === 'open' ? 'Вызов висит в ленте. Как только кто-то примет — увидишь здесь.' : 'Ждём ответа соперника.'}</span></div>
        <button class="btn link" disabled=${busy} onClick=${() => act({ status: 'cancelled' }, 'Стрелка отменена')}>Отменить стрелку</button>
      </div>`}

      ${inGame && html`<section class="stack">
        <h2 class="h2">Кто взял верх?</h2>
        <div class="grid2">
          <button class=${'ptile' + (mineR === 'win' ? ' on' : '')} style="align-items:center;justify-content:center" disabled=${busy} onClick=${() => act({ [role === 'author' ? 'author_result' : 'opponent_result']: 'win' })}><${Icon} d=${I.trophy} size="28" /><b>Я победил</b></button>
          <button class=${'ptile' + (mineR === 'lose' ? ' on' : '')} style="align-items:center;justify-content:center" disabled=${busy} onClick=${() => act({ [role === 'author' ? 'author_result' : 'opponent_result']: 'lose' })}><${Icon} d=${I.target} size="28" /><b>Я проиграл</b></button>
        </div>
        <span class="muted">${!mineR ? 'Результат засчитается, когда ответы обоих совпадут.' : !theirsR ? 'Твой ответ записан. Ждём соперника.' : ''}</span>
      </section>`}

      ${c.status === 'conflict' && html`<div class="banner hot">
        <div class="row"><${Icon} d=${I.alert} /><b>КОНФЛИКТ НЕ РАЗРЕШЁН</b></div>
        <span>${mineR === 'win' ? 'Оба считают себя победителями.' : 'Оба записали себе поражение.'} Стрелка не идёт в зачёт, пока вы не договоритесь. Поменяй свой ответ выше, если ошибся.</span>
      </div>`}

      ${c.status === 'done' && html`<div class="banner lime">
        <b>ЗАСЧИТАНО</b>
        <span>${role === 'guest' ? 'Стрелка завершена.' : mineR === 'win' ? '+1 победа. Так держать.' : '+1 поражение. Реванш?'}</span>
        ${role !== 'guest' && mineR === 'lose' && html`<a class="btn sm" style="align-self:flex-start;background:var(--ink);color:var(--lime)" href="#/new">Забить реванш</a>`}
      </div>`}

      ${c.status === 'declined' && html`<div class="banner gray"><span>${role === 'author' ? 'Соперник отказался от вызова.' : 'Ты отказался от вызова.'}</span></div>`}
      ${c.status === 'cancelled' && html`<div class="banner gray"><span>Стрелка отменена.</span></div>`}
      ${role === 'guest' && !canJoin && c.status === 'pending' && html`<div class="banner gray"><span>Этот вызов адресован другому игроку.</span></div>`}
    </div>`;
}

/* ---------- вызовы ---------- */
function Inbox({ mine, uid }) {
  const sections = [
    ['Тебе бросили', mine.filter((c) => c.opponent_id === uid && c.status === 'pending')],
    ['Правки к твоим вызовам', mine.filter((c) => c.author_id === uid && c.status === 'countered')],
    ['Внеси результат', mine.filter((c) => c.status === 'accepted' && !myResult(c, uid))],
    ['Ждут ответа', mine.filter((c) => c.author_id === uid && c.status === 'pending')]
  ].filter(([, list]) => list.length);
  return html`
    <${Top} title="Вызовы" />
    <div class="scroll" style="padding-top:8px">
      ${sections.length
        ? sections.map(([title, list]) => html`<section class="stack"><h2 class="h2">${title} · ${list.length}</h2>${list.map((c) => html`<${ChallengeCard} c=${c} uid=${uid} />`)}</section>`)
        : html`<div class="empty"><span style="font-weight:800">Новых вызовов нет</span><span class="muted">Когда тебе бросят стрелку, она появится здесь.</span></div>`}
    </div>`;
}

/* ---------- лента ---------- */
function Explore({ uid }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('Все');
  const [mode, setMode] = useState('');
  useEffect(() => { api.openChallenges(uid).then(setList).catch(() => setList([])); }, [uid]);
  const ql = q.trim().toLowerCase();
  const allTags = ['Все', ...new Set([...CATEGORIES, ...(list || []).map((c) => c.category)])];
  const tags = ql ? allTags.filter((t) => t !== 'Все' && t.toLowerCase().includes(ql)) : allTags;
  let shown = (list || []).filter((c) => tag === 'Все' || c.category === tag);
  if (ql && tag === 'Все') shown = shown.filter((c) => (c.category + ' ' + c.call_text + ' ' + (c.place || '')).toLowerCase().includes(ql));
  if (mode) shown = shown.filter((c) => c.mode === mode);
  return html`
    <header class="top" style="flex-direction:column;align-items:stretch;gap:12px;padding-top:18px">
      <h1 class="h1" style="font-size:24px">Открытые стрелки</h1>
      <div style="position:relative">
        <span style="position:absolute;left:14px;top:14px"><${Icon} d=${I.search} size="20" w="2.4" /></span>
        <input class="input" style="padding-left:44px;border-width:2.5px" aria-label="Поиск по категории" placeholder="Категория: шахматы, бег, книги…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      </div>
      <div class="chips scrollx">${tags.map((t) => html`<button class=${'chip' + (tag === t ? ' on' : '')} onClick=${() => setTag(t)}>${t}</button>`)}</div>
      <div class="chips">${[['', 'Любой формат'], ['offline', 'Офлайн'], ['online', 'Онлайн']].map(([k, l]) => html`<button class=${'chip dash' + (mode === k ? ' on' : '')} style=${mode === k ? 'border-style:solid' : ''} onClick=${() => setMode(k)}>${l}</button>`)}</div>
    </header>
    <div class="scroll" style="padding-top:6px;gap:12px">
      ${list === null ? html`<span class="muted">Загружаем…</span>` : shown.length
        ? shown.map((c) => html`<a href=${'#/c/' + c.id} class="card strong">
            <div class="row"><span class="avatar sm ink">${initial(c.author && c.author.nick)}</span><span style="flex:1;font-weight:800">${nickOf(c.author)}</span><span class="pill">${c.category}</span></div>
            <p class="big" style="font-size:16px">${c.call_text}</p>
            <div class="row muted" style="flex-wrap:wrap;gap:6px 14px"><span class="row" style="gap:4px"><${Icon} d=${I.pin} size="15" />${whereText(c)}</span><span class="row" style="gap:4px"><${Icon} d=${I.clock} size="15" />${fmtWhen(c.starts_at)}</span></div>
          </a>`)
        : html`<div class="empty"><span style="font-weight:800">Тут пока пусто</span><span class="muted">Никто не бросил такой вызов. Будь первым.</span><a class="btn sm" style="background:var(--ink);color:var(--lime)" href="#/new">Забить стрелку</a></div>`}
    </div>
    <${Tabs} active="explore" />`;
}

/* ---------- статистика ---------- */
function Stats({ mine, uid }) {
  const st = computeStats(mine, uid);
  const rate = st.total ? Math.round((st.wins / st.total) * 100) : 0;
  const cats = Object.entries(st.byCat).filter(([, v]) => v.w + v.l > 0).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l));
  return html`
    <div class="scroll">
      <h1 class="h1" style="font-size:24px">Статистика</h1>
      <section class="dark">
        <span class="label">За всё время · засчитано ${st.total}</span>
        <div class="row" style="align-items:baseline;gap:12px"><span class="num lime" style="font-size:56px;font-weight:900">${st.wins}</span><span class="num" style="color:#77776F">—</span><span class="num" style="font-size:56px;font-weight:900">${st.losses}</span></div>
        <div class="stack" style="gap:6px"><div class="bar"><div style=${'width:' + rate + '%'}></div></div>
          <div class="between muted"><span>${rate}% побед</span><span>Конфликтов: ${st.conflicts}</span></div></div>
      </section>
      ${cats.length > 0 && html`<section class="card" style="gap:14px"><h2 class="h2">По дисциплинам</h2>
        ${cats.map(([name, v]) => html`<div class="stack" style="gap:6px"><div class="between" style="font-weight:800;font-size:14px"><span>${name}</span><span>${v.w} — ${v.l}</span></div><div class="bar"><div style=${'width:' + Math.round((v.w / (v.w + v.l)) * 100) + '%'}></div></div></div>`)}
      </section>`}
      <section class="stack"><h2 class="h2">Прошлые стрелки</h2>
        ${st.finished.length
          ? html`<div class="card" style="padding:4px 16px;gap:0">${st.finished.map((c) => {
              const r = c.status === 'conflict' ? ['c', '?!'] : myResult(c, uid) === 'win' ? ['w', 'WIN'] : ['l', 'LOSE'];
              return html`<a class="hist" href=${'#/c/' + c.id}><span class=${'res ' + r[0]}>${r[1]}</span><span class="stack" style="gap:2px;min-width:0"><span style="font-weight:800;font-size:14px">${c.category} vs ${otherNick(c, uid)}</span><span class="muted" style="font-size:12px">${c.status === 'conflict' ? 'Конфликт не разрешён' : fmtWhen(c.starts_at || c.created_at)}</span></span></a>`;
            })}</div>`
          : html`<div class="empty"><span class="muted">Здесь появятся завершённые стрелки.</span></div>`}
      </section>
    </div>
    <${Tabs} active="stats" />`;
}

/* ---------- аккаунт ---------- */
function Me({ me, email, onProfile }) {
  const [bio, setBio] = useState(me.bio || '');
  const [saved, setSaved] = useState(false);
  const save = async () => { try { onProfile(await api.updateProfile(me.id, { bio: bio.trim() || null })); setSaved(true); } catch (e) {} };
  return html`
    <div class="scroll">
      <h1 class="h1" style="font-size:24px">Аккаунт</h1>
      <section class="card strong">
        <div class="row" style="gap:14px"><span class="avatar" style="width:68px;height:68px;border-radius:22px;font-size:28px;border:2.5px solid var(--ink)">${initial(me.nick)}</span>
          <div class="stack" style="gap:3px;min-width:0"><span style="font-family:var(--display);font-weight:700;font-size:19px">@${me.nick}</span><span class="muted" style="overflow-wrap:anywhere">${email}</span></div></div>
        <label class="field"><span>О себе</span><textarea class="input" rows="2" maxlength="300" placeholder="Чем занимаешься, какие вызовы принимаешь" value=${bio} onInput=${(e) => { setBio(e.target.value); setSaved(false); }}></textarea></label>
        <button class="btn sm" onClick=${save}>${saved ? 'Сохранено' : 'Сохранить'}</button>
      </section>
      <section class="card">
        <h2 class="h2">Правила честной игры</h2>
        <span style="font-weight:600;line-height:1.5">Стрелка — это соревнование, не драка. Никакого насилия, ставок на деньги и унижений. Офлайн встречайтесь в людных местах. Результат честно отмечают оба.</span>
      </section>
      <button class="btn ghost" onClick=${() => api.signOut()}>Выйти</button>
    </div>
    <${Tabs} active="me" />`;
}

/* ---------- приложение ---------- */
function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash.replace(/^#\/?/, '').split('/');
}

function App() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);
  const [mine, setMine] = useState([]);
  const [msg, setMsg] = useState('');
  const route = useHash();
  const uid = session && session.user.id;

  useEffect(() => {
    api.sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = api.sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) { setMe(undefined); return; }
    api.getProfile(uid).then((p) => setMe(p || null)).catch(() => setMe(null));
  }, [uid]);

  const refresh = useCallback(() => { if (uid) api.myChallenges(uid).then(setMine).catch(() => {}); }, [uid]);
  useEffect(() => { refresh(); }, [refresh, route.join('/')]);
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [refresh]);

  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  if (session === undefined) return html`<${Loading} />`;
  if (!session) return html`<${Login} />`;
  if (me === undefined) return html`<${Loading} />`;
  if (me === null) return html`<${NickSetup} uid=${uid} onDone=${setMe} />`;

  const [page, arg] = route;
  let screen;
  if (page === 'new') screen = html`<${Create} uid=${uid} onCreated=${refresh} />`;
  else if (page === 'c' && arg) screen = html`<${Detail} key=${arg} id=${arg} uid=${uid} onChanged=${refresh} toast=${toast} />`;
  else if (page === 'inbox') screen = html`<${Inbox} mine=${mine} uid=${uid} />`;
  else if (page === 'explore') screen = html`<${Explore} uid=${uid} />`;
  else if (page === 'stats') screen = html`<${Stats} mine=${mine} uid=${uid} />`;
  else if (page === 'me') screen = html`<${Me} me=${me} email=${session.user.email} onProfile=${setMe} />`;
  else screen = html`<${Home} me=${me} mine=${mine} uid=${uid} />`;

  return html`${screen}${msg && html`<div class="toast" role="status">${msg}</div>`}`;
}

const root = document.getElementById('app');
root.innerHTML = '';
render(api.configured ? html`<${App} />` : html`<${Setup} />`, root);
