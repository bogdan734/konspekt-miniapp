import { GRADES, schedule, due, key } from './sm2.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const view = document.getElementById('view');
const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
const SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
// The semester this timetable belongs to; weeks 1 and 2 alternate from here.
const SEMESTER_START = new Date('2025-09-01T00:00:00+03:00');

// Один сталий колір на предмет: розклад читається периферійним зором.
const SUBJECT_HUE = {
  'Анатомія тварин': 222, 'Гістологія': 168, 'Хімія': 38, 'Латинська мова': 276,
  'Історія України та цивілізаційний процес': 344,
  'Іноземна мова (за професійним спрямуванням)': 142,
  'Антикорупція та доброчесність': 200, 'Основи національного спротиву': 14,
};
const hueOf = subject => SUBJECT_HUE[subject]
  ?? [...subject].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const colorOf = subject => `hsl(${hueOf(subject)} 62% 52%)`;

const ICONS = {
  today: '<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>',
  drill: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  topics: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  notes: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
};
const TABS = [
  ['today', 'Сьогодні'], ['drill', 'Тренування'], ['topics', 'Теми'], ['notes', 'Конспект'],
];

const store = {
  get(name, fallback) {
    try { return JSON.parse(localStorage.getItem(name)) ?? fallback; } catch { return fallback; }
  },
  set(name, value) {
    try { localStorage.setItem(name, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const data = {};
const load = async name => (await fetch(`data/${name}.json`)).json();
const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};
const svg = path =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

let tab = 'today';
let pickedDay = null;

async function boot() {
  const [curriculum, timetable, notes, lesson, quiz, cards] = await Promise.all(
    ['curriculum', 'schedule', 'notes-T1', 'lesson-T1', 'quiz-T1', 'cards-T1'].map(load)
  );
  Object.assign(data, { curriculum, timetable, notes, lesson, quiz, cards });
  buildTabs();
  render('today');
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  for (const [id, label] of TABS) {
    const button = el('button', id === tab ? 'on' : '', `${svg(ICONS[id])}<span>${label}</span>`);
    button.dataset.tab = id;
    button.setAttribute('aria-label', label);
    button.onclick = () => { render(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.append(button);
  }
}

function markTabs() {
  document.querySelectorAll('#tabs button').forEach(button =>
    button.classList.toggle('on', button.dataset.tab === tab));
}

const weekType = (date = new Date()) =>
  Math.floor((date - SEMESTER_START) / (7 * 86400000)) % 2 === 0 ? 1 : 2;
const universityWeekday = date => (date.getDay() === 0 ? 7 : date.getDay());
const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const sessionsOf = (day, week) => data.timetable.sessions
  .filter(s => s.weekday === day && s.weekType === week)
  .sort((a, b) => a.period - b.period);

function render(next) {
  tab = next;
  markTabs();
  view.innerHTML = '';
  ({ today: renderToday, drill: renderDrill, topics: renderTopics, notes: renderNotes }[tab])();
  setHeader();
}

function setHeader() {
  const now = new Date();
  const eyebrow = document.getElementById('eyebrow');
  const badge = document.getElementById('weekBadge');
  const title = document.getElementById('title');
  const headings = {
    today: `${WEEKDAYS[universityWeekday(now) - 1]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    drill: 'Тренування', topics: 'Навчальний план', notes: 'Конспект',
  };
  eyebrow.textContent = tab === 'today'
    ? data.timetable.groupName
    : `${data.timetable.groupName} · Анатомія`;
  badge.textContent = tab === 'today' ? `тиждень ${weekType(now)}` : '';
  badge.style.display = tab === 'today' ? '' : 'none';
  title.textContent = headings[tab];
}

// ---------- Сьогодні ----------

function renderToday() {
  const now = new Date();
  const week = weekType(now);
  const today = universityWeekday(now);
  const day = pickedDay ?? Math.min(today, 5);

  const strip = el('div', 'card flat');
  const week_ = el('div', 'week');
  for (let index = 0; index < 5; index += 1) {
    const number = index + 1;
    const count = sessionsOf(number, week).length;
    const date = new Date(now);
    date.setDate(now.getDate() + (number - today));
    const chip = el('button',
      `day${number === today ? ' today' : ''}${number === day ? ' picked' : ''}${count ? '' : ' empty'}`,
      `<span class="name">${SHORT[index]}</span><span class="num">${date.getDate()}</span>
       <span class="dots">${'<i></i>'.repeat(Math.min(count, 5))}</span>`);
    chip.setAttribute('aria-label', `${WEEKDAYS[index]}, ${count} пар`);
    chip.onclick = () => {
      pickedDay = number;
      tg?.HapticFeedback?.selectionChanged?.();
      render('today');
    };
    week_.append(chip);
  }
  strip.append(week_);
  view.append(strip);

  view.append(dayTimeline(day, week, day === today ? now : null));

  const states = store.get('reviews', {});
  const dueNow = due(data.cards, states);
  const learned = data.cards.length - dueNow.length;
  view.append(revisionCard(dueNow.length, learned, nextAnatomy(now, week)));
}

function dayTimeline(day, week, now) {
  const box = el('div', 'card');
  box.append(el('h2', null, day === universityWeekday(new Date()) ? 'Сьогодні' : WEEKDAYS[day - 1]));
  const sessions = sessionsOf(day, week);

  if (!sessions.length) {
    box.append(el('div', 'empty-day', 'Пар немає — день на повторення.'));
    return box;
  }

  const rail = el('div', 'tl');
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : null;

  sessions.forEach((session, index) => {
    const from = minutes(session.start);
    const to = minutes(session.end);
    const live = nowMinutes !== null && nowMinutes >= from && nowMinutes <= to;
    const past = nowMinutes !== null && nowMinutes > to;

    const previous = sessions[index - 1];
    if (previous) {
      const wait = from - minutes(previous.end);
      if (wait >= 40) rail.append(el('div', 'gap', `вікно ${wait} хв`));
    }

    const slot = el('div', `slot${live ? ' live' : ''}${past ? ' past' : ''}`);
    slot.style.setProperty('--subject', colorOf(session.subject));
    slot.append(el('div', 'at', session.start));
    slot.append(el('div', 'knot'));

    const lesson = el('div', 'lesson');
    if (live) {
      const left = to - nowMinutes;
      lesson.append(el('div', 'now-pill', `<i></i>зараз · ще ${left} хв`));
    }
    lesson.append(el('div', 'name', session.subject));
    lesson.append(el('div', 'meta',
      `${session.start}–${session.end}${session.room ? ` · ауд. ${session.room}` : ''}`));
    slot.append(lesson);
    rail.append(slot);
  });

  box.append(rail);
  return box;
}

function revisionCard(dueCount, learned, next) {
  const total = data.cards.length;
  const done = total - dueCount;
  const circumference = 2 * Math.PI * 26;
  const box = el('div', 'card');
  box.append(el('h2', null, 'Повторення'));

  const line = el('div', 'revise');
  const ring = el('div', 'ring', `
    <svg width="62" height="62" aria-hidden="true">
      <circle cx="31" cy="31" r="26" fill="none" stroke="var(--line)" stroke-width="6"/>
      <circle cx="31" cy="31" r="26" fill="none" stroke="var(--accent)" stroke-width="6"
              stroke-linecap="round" stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference * (1 - done / total)}"/>
    </svg>
    <span class="val">${dueCount || '✓'}</span>`);
  line.append(ring);

  const text = el('div', 'txt');
  text.append(el('b', null, dueCount ? `${dueCount} карток чекають` : 'На сьогодні все'));
  text.append(el('span', null,
    next ? `наступна анатомія ${next.when}` : `вивчено ${done} з ${total}`));
  line.append(text);

  const go = el('button', 'go', dueCount ? 'Почати' : 'Наперед');
  go.onclick = () => render('drill');
  line.append(go);

  box.append(line);
  return box;
}

function nextAnatomy(now, week) {
  const weekday = universityWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sessions = data.timetable.sessions
    .filter(s => s.subject === 'Анатомія тварин' && s.weekType === week)
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);
  const found = sessions.find(s =>
    s.weekday > weekday || (s.weekday === weekday && minutes(s.start) >= nowMinutes));
  const session = found ?? sessions[0];
  if (!session) return null;
  const label = session.weekday === weekday
    ? 'сьогодні' : WEEKDAYS[session.weekday - 1].toLowerCase();
  return { session, when: `${label} о ${session.start}` };
}

// ---------- Тренування ----------

let drill = { mode: 'cards', kind: null, revealed: false, answers: {} };

function renderDrill() {
  const seg = el('div', 'seg');
  for (const [mode, label] of [
    ['cards', 'Картки'], ['latin', 'Латина'], ['quiz', 'Тест'], ['homework', 'Домашнє'],
  ]) {
    const button = el('button', drill.mode === mode ? 'on' : '', label);
    button.onclick = () => {
      drill = { mode, kind: mode === 'latin' ? 'latin' : null, revealed: false, answers: drill.answers };
      tg?.HapticFeedback?.selectionChanged?.();
      render('drill');
    };
    seg.append(button);
  }
  view.append(seg);

  if (drill.mode === 'quiz') return renderQuiz();
  if (drill.mode === 'homework') return renderHomework();
  return renderCards();
}

function renderCards() {
  const states = store.get('reviews', {});
  const queue = due(data.cards, states, Date.now(), drill.kind);

  if (!queue.length) {
    const done = el('div', 'card');
    done.append(el('h2', null, 'Готово'));
    done.append(el('div', 'muted', 'Усі картки цього набору повторені. Повертайся завтра.'));
    return view.append(done);
  }

  const { card, state } = queue[0];
  const box = el('div', 'card');
  const flash = el('div', 'flash');
  flash.append(el('div', 'front', card.front));
  if (drill.revealed) flash.append(el('div', 'back', card.back));
  box.append(flash);

  if (!drill.revealed) {
    const show = el('button', 'go wide', 'Показати відповідь');
    show.onclick = () => { drill.revealed = true; render('drill'); };
    box.append(show);
  } else {
    const grades = el('div', 'grades');
    for (const [label, grade, cls] of [
      ['Не знаю', GRADES.again, 'g-again'], ['Важко', GRADES.hard, 'g-hard'],
      ['Добре', GRADES.good, 'g-good'], ['Легко', GRADES.easy, 'g-easy'],
    ]) {
      const button = el('button', cls, label);
      button.onclick = () => {
        states[key(card)] = schedule(state, grade);
        store.set('reviews', states);
        drill.revealed = false;
        tg?.HapticFeedback?.impactOccurred?.('light');
        render('drill');
      };
      grades.append(button);
    }
    box.append(grades);
  }

  box.append(el('div', 'muted small',
    `Залишилось ${queue.length}${state ? ` · інтервал ${state.intervalDays} дн.` : ' · нова'}`));
  view.append(box);
  view.append(source(card.sourceSegmentIDs));
}

function renderQuiz() {
  const questions = data.quiz.questions;
  const answered = Object.keys(drill.answers).length;

  const progress = el('div', 'card');
  progress.append(el('h2', null, `Тест · ${answered} з ${questions.length}`));
  const bar = el('div', 'bar', '<i></i>');
  bar.firstChild.style.transform = `scaleX(${answered / questions.length})`;
  progress.append(bar);
  if (answered === questions.length) {
    const correct = questions.filter((q, i) => drill.answers[i] === q.correctIndex).length;
    const percent = Math.round((correct / questions.length) * 100);
    progress.append(el('div', 'small', `<b>${percent}%</b> — ${correct} із ${questions.length}`
      + (percent >= 90 ? ' <span class="pill">рівень «відмінно»</span>' : '')));
    const again = el('button', 'go ghost wide', 'Пройти ще раз');
    again.onclick = () => { drill.answers = {}; render('drill'); };
    progress.append(again);
  }
  view.append(progress);

  questions.forEach((question, index) => {
    const chosen = drill.answers[index];
    const box = el('div', 'card');
    box.append(el('div', null, `<b>${index + 1}.</b> ${question.prompt}`));
    question.options.forEach((option, optionIndex) => {
      const decided = chosen !== undefined;
      const correct = optionIndex === question.correctIndex;
      const button = el('button',
        'opt' + (decided && correct ? ' correct' : decided && chosen === optionIndex ? ' wrong' : ''),
        option);
      button.disabled = decided;
      button.onclick = () => {
        drill.answers[index] = optionIndex;
        tg?.HapticFeedback?.notificationOccurred?.(correct ? 'success' : 'error');
        render('drill');
      };
      box.append(button);
    });
    if (chosen !== undefined) {
      box.append(el('div', 'muted small', question.explanation));
      box.append(source(question.sourceSegmentIDs));
    }
    view.append(box);
  });
}

function renderHomework() {
  for (const [index, task] of data.lesson.homework.entries()) {
    const box = el('div', 'card');
    box.append(el('div', null, `<b>Завдання ${index + 1}.</b> ${task.prompt}`));
    const answer = el('details');
    answer.append(el('summary', null, 'Еталонна відповідь і критерії'));
    answer.append(el('div', 'small', task.referenceAnswer));
    const rubric = el('ul', 'muted small');
    for (const item of task.rubric) rubric.append(el('li', null, item));
    answer.append(rubric);
    box.append(answer);
    box.append(source(task.sourceSegmentIDs));
    view.append(box);
  }
}

// ---------- Теми ----------

function renderTopics() {
  const ready = new Set(['T1']);
  for (const section of data.curriculum.sections) {
    const box = el('div', 'card');
    box.append(el('h2', null, `Розділ ${section.number} · ${section.title}`));
    for (const topic of section.topics) {
      const row = el('div', 'row small');
      row.append(el('span', 'time', topic.id));
      row.append(el('span', 'subject',
        topic.title + (ready.has(topic.id) ? ' <span class="pill">готово</span>' : '')));
      row.append(el('span', 'muted', `${topic.hours.lecture + topic.hours.lab} год`));
      box.append(row);
    }
    view.append(box);
  }
}

// ---------- Конспект ----------

function renderNotes() {
  const lesson = data.lesson;
  const head = el('div', 'card');
  head.append(el('h2', null, lesson.title));
  head.append(el('div', 'small', lesson.summary));
  view.append(head);

  for (const section of lesson.sections) {
    const box = el('div', 'card');
    box.append(el('h2', null, section.heading));
    box.append(el('div', 'small', section.body));
    box.append(source(section.sourceSegmentIDs));
    view.append(box);
  }

  const glossary = el('div', 'card');
  glossary.append(el('h2', null, 'Терміни'));
  for (const term of lesson.glossary) {
    glossary.append(el('div', 'small',
      `<b>${term.term}</b>${term.latin ? ` · <i>${term.latin}</i>` : ''}<br>${term.definition}`));
  }
  view.append(glossary);

  if (data.notes.corrections?.length) {
    const box = el('div', 'card');
    box.append(el('h2', null, 'Виправити в зошиті'));
    for (const fix of data.notes.corrections) {
      box.append(el('div', 'small', `<s>${fix.asWritten}</s> → <b>${fix.correct}</b>`));
    }
    view.append(box);
  }

  if (data.notes.checks?.length) {
    const box = el('div', 'card');
    box.append(el('h2', null, 'Звірити з підручником'));
    for (const check of data.notes.checks) box.append(el('div', 'small', `• ${check}`));
    view.append(box);
  }
}

/// Every claim points back at the lines of the notebook it came from.
function source(ids) {
  if (!ids?.length) return el('div');
  const lines = data.notes.pages.flatMap(page => page.lines.filter(line => line.trim()));
  const details = el('details');
  details.append(el('summary', null, `Джерело · ${ids.length} рядк.`));
  details.append(el('div', 'src', ids.map(id => lines[id]).filter(Boolean).join('\n')));
  return details;
}

boot();
