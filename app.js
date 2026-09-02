import { GRADES, schedule, due, key } from './sm2.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const view = document.getElementById('view');
const subtitle = document.getElementById('subtitle');
const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
// The semester the timetable belongs to; week 1 and week 2 alternate from here.
const SEMESTER_START = new Date('2025-09-01T00:00:00+03:00');

const store = {
  get(name, fallback) {
    try { return JSON.parse(localStorage.getItem(name)) ?? fallback; }
    catch { return fallback; }
  },
  set(name, value) {
    try { localStorage.setItem(name, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const data = {};
const load = async name => (await fetch(`data/${name}.json`)).json();

async function boot() {
  const [curriculum, schedule_, notes, lesson, quiz, cards] = await Promise.all(
    ['curriculum', 'schedule', 'notes-T1', 'lesson-T1', 'quiz-T1', 'cards-T1'].map(load)
  );
  Object.assign(data, { curriculum, schedule: schedule_, notes, lesson, quiz, cards });
  subtitle.textContent = `${schedule_.groupName} · ${curriculum.title}`;
  document.querySelectorAll('nav button').forEach(button => {
    button.onclick = () => {
      document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b === button));
      render(button.dataset.tab);
      window.scrollTo(0, 0);
    };
  });
  render('today');
}

const weekType = (date = new Date()) =>
  Math.floor((date - SEMESTER_START) / (7 * 86400000)) % 2 === 0 ? 1 : 2;

const universityWeekday = date => (date.getDay() === 0 ? 7 : date.getDay());

const minutes = time => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function render(tab) {
  view.innerHTML = '';
  ({ today: renderToday, drill: renderDrill, topics: renderTopics, notes: renderNotes }[tab])();
}

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

// ---------- Сьогодні ----------

function renderToday() {
  const now = new Date();
  const week = weekType(now);
  const weekday = universityWeekday(now);
  const today = data.schedule.sessions
    .filter(s => s.weekType === week && s.weekday === weekday)
    .sort((a, b) => a.period - b.period);

  const head = el('div', 'card');
  head.append(el('h2', null, `${WEEKDAYS[weekday - 1]} · тиждень ${week}`));
  if (today.length === 0) {
    head.append(el('div', 'muted small', 'Пар немає.'));
  }
  for (const session of today) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const live = nowMinutes >= minutes(session.start) && nowMinutes <= minutes(session.end);
    const row = el('div', `row${live ? ' now' : ''}`);
    row.append(el('span', 'time', session.start));
    row.append(el('span', 'subject',
      session.subject + (session.room ? ` <span class="muted small">· ауд. ${session.room}</span>` : '')));
    head.append(row);
  }
  view.append(head);

  const states = store.get('reviews', {});
  const dueNow = due(data.cards, states);
  const next = nextAnatomy(now, week);

  const revision = el('div', 'card');
  revision.append(el('h2', null, 'Повторення'));
  revision.append(el('div', null,
    dueNow.length
      ? `<b>${dueNow.length}</b> карток чекають${next ? ` · наступна анатомія ${next.when}` : ''}`
      : 'На сьогодні все повторено.' + (next ? ` Наступна анатомія ${next.when}.` : '')));
  const start = el('button', 'wide', dueNow.length ? 'Почати' : 'Повторити наперед');
  start.onclick = () => {
    document.querySelector('nav button[data-tab="drill"]').click();
  };
  revision.append(start);
  view.append(revision);

  const week1 = el('div', 'card');
  week1.append(el('h2', null, 'Тиждень'));
  for (let day = 1; day <= 5; day += 1) {
    const sessions = data.schedule.sessions
      .filter(s => s.weekType === week && s.weekday === day)
      .sort((a, b) => a.period - b.period);
    if (!sessions.length) continue;
    week1.append(el('div', 'small', `<b>${WEEKDAYS[day - 1]}</b>`));
    for (const session of sessions) {
      const row = el('div', 'row small');
      row.append(el('span', 'time', session.start));
      row.append(el('span', 'subject', session.subject));
      week1.append(row);
    }
  }
  view.append(week1);
}

function nextAnatomy(now, week) {
  const subject = 'Анатомія тварин';
  const weekday = universityWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sessions = data.schedule.sessions
    .filter(s => s.subject === subject && s.weekType === week)
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);
  const found = sessions.find(s =>
    s.weekday > weekday || (s.weekday === weekday && minutes(s.start) >= nowMinutes));
  const session = found ?? sessions[0];
  if (!session) return null;
  const label = session.weekday === weekday ? 'сьогодні' : WEEKDAYS[session.weekday - 1].toLowerCase();
  return { session, when: `${label} о ${session.start}` };
}

// ---------- Тренування ----------

let drill = { mode: 'cards', kind: null, index: 0, revealed: false, answers: {} };

function renderDrill() {
  const picker = el('div', 'card');
  picker.append(el('h2', null, 'Що тренуємо'));
  const modes = [
    ['cards', 'Картки'], ['latin', 'Латина'], ['quiz', 'Тест'], ['homework', 'Домашнє'],
  ];
  const buttons = el('div', 'grades');
  for (const [mode, label] of modes) {
    const button = el('button', drill.mode === mode ? '' : 'ghost', label);
    button.onclick = () => {
      drill = { mode, kind: mode === 'latin' ? 'latin' : null, index: 0, revealed: false, answers: {} };
      render('drill');
    };
    buttons.append(button);
  }
  picker.append(buttons);
  view.append(picker);

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
    const show = el('button', 'wide', 'Показати відповідь');
    show.onclick = () => { drill.revealed = true; render('drill'); };
    box.append(show);
  } else {
    const grades = el('div', 'grades');
    for (const [label, grade, cls] of [
      ['Не знаю', GRADES.again, 'again'], ['Важко', GRADES.hard, 'hard'],
      ['Добре', GRADES.good, ''], ['Легко', GRADES.easy, 'easy'],
    ]) {
      const button = el('button', cls, label);
      button.onclick = () => {
        const next = schedule(state, grade);
        states[key(card)] = next;
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
  progress.append(el('h2', null, `Тест · ${answered}/${questions.length}`));
  const bar = el('div', 'bar');
  bar.append(el('i', null, ''));
  bar.firstChild.style.width = `${(answered / questions.length) * 100}%`;
  progress.append(bar);
  if (answered === questions.length) {
    const correct = questions.filter((q, i) => drill.answers[i] === q.correctIndex).length;
    const percent = Math.round((correct / questions.length) * 100);
    progress.append(el('div', null,
      `<b>${percent}%</b> — ${correct} із ${questions.length}` +
      (percent >= 90 ? ' <span class="pill">рівень «відмінно»</span>' : '')));
    const again = el('button', 'wide ghost', 'Пройти ще раз');
    again.onclick = () => { drill.answers = {}; render('drill'); };
    progress.append(again);
  }
  view.append(progress);

  questions.forEach((question, index) => {
    const chosen = drill.answers[index];
    const box = el('div', 'card');
    box.append(el('div', null, `<b>${index + 1}.</b> ${question.prompt}`));
    question.options.forEach((option, optionIndex) => {
      const isChosen = chosen === optionIndex;
      const decided = chosen !== undefined;
      const correct = optionIndex === question.correctIndex;
      const button = el('button',
        'opt' + (decided && correct ? ' correct' : decided && isChosen ? ' wrong' : ''), option);
      button.disabled = decided;
      button.onclick = () => {
        drill.answers[index] = optionIndex;
        store.set('quiz-T1', drill.answers);
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
    box.append(el('h2', null, `Розділ ${section.number}. ${section.title}`));
    for (const topic of section.topics) {
      const row = el('div', 'row small');
      row.append(el('span', 'time', topic.id));
      row.append(el('span', 'subject', topic.title +
        (ready.has(topic.id) ? ' <span class="pill">готово</span>' : '')));
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
    box.append(el('div', 'muted small',
      'У конспекті написано так, а в Nomina Anatomica Veterinaria — так:'));
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
  const lines = data.notes.pages.flatMap(page => page.lines.filter(l => l.trim()));
  const text = ids.map(id => lines[id]).filter(Boolean).join('\n');
  const details = el('details');
  details.append(el('summary', null, `Джерело · ${ids.length} рядк.`));
  details.append(el('div', 'src', text));
  return details;
}

boot();
