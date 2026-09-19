// Череп коня — реальний скан музейного зразка у вбудованому переглядачі Sketchfab.
// Керуємо камерою через Sketchfab Viewer API, підписи й описи — наші, українською.
// Скан цілісний (одна зшита поверхня), тому окремі кістки не підсвічуються:
// вибір структури повертає камеру на ділянку, де цю структуру треба шукати.

// Дані тягнемо з тією ж міткою версії, що й цей файл (?v=... проставляє build.py),
// інакше вебв'ю Telegram може підхопити новий код зі старими даними.
const {
  PARTS, SPECIES_NOTE, CATEGORY_ORDER, VIEWS, STRUCTURES, ATTRIBUTION, STRUCTURE_ZOOM,
} = await import(`./skull-horse-data.js${new URL(import.meta.url).search}`);

const frame = document.getElementById('api-frame');
const loader = document.getElementById('loader');
const viewButtons = document.getElementById('viewButtons');
const partButtons = document.getElementById('partButtons');
const structureList = document.getElementById('structureList');
const infoCard = document.getElementById('infoCard');
const infoTitle = document.getElementById('infoTitle');
const infoLatin = document.getElementById('infoLatin');
const infoText = document.getElementById('infoText');

const viewById = Object.fromEntries(VIEWS.map(v => [v.id, v]));

let api = null;          // активний Sketchfab API
let center = [0, 0, 0];  // центр моделі (target стартової камери)
let radius = 1;          // відстань стартової камери
let currentPart = PARTS[0].id;
let pendingView = null;  // ракурс, який треба застосувати щойно скан завантажиться
let selectedId = null;
let userChose = false;   // користувачка вже обрала ракурс або структуру сама

// ---------- завантаження скану ----------
function loadPart(partId) {
  const part = PARTS.find(p => p.id === partId);
  if (!part) return;
  currentPart = partId;
  api = null;
  userChose = false;   // новий скан знову вписуємо самі
  loader.hidden = false;
  loader.textContent = `Завантажую скан: ${part.ua.toLowerCase()}…`;
  renderPartButtons();
  buildList();

  const client = new window.Sketchfab(frame);
  client.init(part.uid, {
    success(sfApi) {
      sfApi.start();
      sfApi.addEventListener('viewerready', () => {
        api = sfApi;
        window.__sfApi = sfApi; // для калібрування ракурсів
        loader.hidden = true;
        sfApi.getCameraLookAt((err, camera) => {
          // Центр стартової камери правильний в обох сканів, а от її відстань —
          // ні (у щелепи роздута коробка), тому відстань беремо з даних частини.
          if (!err && camera) center = camera.target.slice();
          radius = part.distance;
          frameAfterLoad(partId);
          // viewerready спрацьовує ще до того, як скан домалювався повністю, і
          // Sketchfab після цього сам переставляє камеру. Тому вписуємо ще раз
          // згодом — але тільки якщо користувачка ще нічого не обрала сама.
          setTimeout(() => frameAfterLoad(partId), 3000);
          setTimeout(() => frameAfterLoad(partId), 9000);
        });
      });
    },
    error() {
      loader.hidden = false;
      loader.textContent = 'Не вдалося завантажити скан. Перевір інтернет і онови сторінку.';
    },
    autostart: 1,
    preload: 1,
    ui_infos: 0,
    ui_stop: 0,
    ui_inspector: 0,
    ui_settings: 0,
    ui_vr: 0,
    ui_ar: 0,
    ui_help: 0,
    ui_hint: 0,
    ui_annotations: 0,
    dnt: 1,
  });
}

// ---------- камера ----------
// Вписує щойно завантажений скан. recenterCamera() приводить до ладу внутрішній
// масштаб переглядача (без нього наш ракурс може дати кістку-крапку), і вже
// після цього ставимо свій загальний ракурс.
function frameAfterLoad(partId) {
  if (!api || partId !== currentPart) return;
  const pv = pendingView;
  if (!pv && userChose) return;   // вона вже сама обрала ракурс — не чіпаємо
  if (pv) { pendingView = null; userChose = true; }
  const view = pv ? pv.view : 'default';
  const zoom = pv ? pv.zoom : 1;

  // Порядок тут важливий і вистражданий. Одразу після завантаження переглядач
  // має зламаний внутрішній масштаб: setCameraLookAt ставить камеру куди треба,
  // але кістка малюється крапкою. Лагодить це тільки recenterCamera() — і вона
  // зберігає напрямок погляду, лише підганяючи відстань. Тому: спершу задаємо
  // напрямок, потім recenter (він і лагодить масштаб, і вписує модель), а тоді
  // ще раз свій ракурс — бо recenter міряє по габаритній коробці, а в щелепи
  // вона роздута. Після першого recenter масштаб лишається справним, і далі
  // кнопки ракурсів працюють без цих танців.
  applyView(view, zoom);
  setTimeout(() => {
    if (!api || partId !== currentPart) return;
    api.recenterCamera();
    setTimeout(() => {
      if (api && partId === currentPart) applyView(view, zoom);
    }, 1400);
  }, 800);
}

function applyView(viewId, zoom = 1) {
  const view = viewById[viewId] ?? viewById.default;
  if (!api || !view?.dir) return;
  const dir = view.dir;
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const dist = radius * zoom;
  const eye = [
    center[0] + (dir[0] / len) * dist,
    center[1] + (dir[1] / len) * dist,
    center[2] + (dir[2] / len) * dist,
  ];
  api.setCameraLookAt(eye, center, 1);
}

// ---------- кнопки частин (череп / щелепа) ----------
function renderPartButtons() {
  partButtons.innerHTML = '';
  for (const part of PARTS) {
    const btn = document.createElement('button');
    btn.className = `part-btn${part.id === currentPart ? ' on' : ''}`;
    btn.textContent = part.ua;
    btn.onclick = () => { if (part.id !== currentPart) loadPart(part.id); };
    partButtons.append(btn);
  }
}

// ---------- кнопки ракурсів ----------
for (const view of VIEWS) {
  const btn = document.createElement('button');
  btn.className = 'view-btn';
  btn.textContent = view.ua;
  btn.onclick = () => { userChose = true; applyView(view.id); };
  viewButtons.append(btn);
}
document.getElementById('resetView').onclick = () => { userChose = true; applyView('default'); };

// ---------- список структур ----------
function selectStructure(structure) {
  selectedId = structure.id;
  infoCard.hidden = false;
  infoTitle.textContent = structure.ua;
  infoLatin.textContent = structure.la;
  infoText.textContent = structure.text;
  for (const btn of structureList.querySelectorAll('.struct-btn')) {
    btn.classList.toggle('active', btn.dataset.id === structure.id);
  }
  if (structure.part !== currentPart) {
    pendingView = { view: structure.view, zoom: STRUCTURE_ZOOM };
    loadPart(structure.part);
  } else {
    userChose = true;
    applyView(structure.view, STRUCTURE_ZOOM);
  }
}

function buildList() {
  structureList.innerHTML = '';
  const byCategory = new Map();
  for (const s of STRUCTURES) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category).push(s);
  }
  const order = [...CATEGORY_ORDER, ...[...byCategory.keys()].filter(c => !CATEGORY_ORDER.includes(c))];
  for (const category of order) {
    const items = byCategory.get(category);
    if (!items?.length) continue;
    const heading = document.createElement('div');
    heading.className = 'cat-heading';
    heading.textContent = category;
    structureList.append(heading);
    for (const s of items) {
      const btn = document.createElement('button');
      btn.className = `struct-btn${s.id === selectedId ? ' active' : ''}`;
      btn.dataset.id = s.id;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = s.ua;
      const la = document.createElement('span');
      la.className = 'la';
      la.textContent = s.la;
      btn.append(name, la);
      if (s.part !== currentPart) {
        const other = document.createElement('span');
        other.className = 'other-part';
        other.textContent = `→ ${PARTS.find(p => p.id === s.part)?.ua ?? ''}`;
        btn.append(other);
      }
      btn.onclick = () => selectStructure(s);
      structureList.append(btn);
    }
  }
}

// ---------- самоперевірка ----------
const quizPanel = document.getElementById('quizPanel');
const quizToggle = document.getElementById('quizToggle');
const quizPrompt = document.getElementById('quizPrompt');
const quizChoices = document.getElementById('quizChoices');
const quizFeedback = document.getElementById('quizFeedback');
const quizScore = document.getElementById('quizScore');
const quizNext = document.getElementById('quizNext');

let quizOn = false;
let asked = 0;
let right = 0;
let currentQuestion = null;

const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

function newQuestion() {
  const target = shuffle(STRUCTURES)[0];
  const others = shuffle(STRUCTURES.filter(s => s.id !== target.id)).slice(0, 3);
  currentQuestion = { target, options: shuffle([target, ...others]) };
  quizPrompt.innerHTML = `Яка структура має назву <b><i>${target.la}</i></b>?`;
  quizFeedback.textContent = '';
  quizFeedback.className = 'quiz-feedback';
  quizChoices.innerHTML = '';
  for (const option of currentQuestion.options) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = option.ua;
    btn.onclick = () => answer(option, btn);
    quizChoices.append(btn);
  }
}

function answer(option, btn) {
  if (!currentQuestion || quizFeedback.textContent) return;
  asked += 1;
  const target = currentQuestion.target;
  if (option.id === target.id) {
    right += 1;
    quizFeedback.textContent = 'Правильно.';
    quizFeedback.className = 'quiz-feedback ok';
    btn.style.background = 'color-mix(in srgb, var(--ok) 20%, transparent)';
  } else {
    quizFeedback.textContent = `Ні, ${target.la} — це ${target.ua.toLowerCase()}.`;
    quizFeedback.className = 'quiz-feedback bad';
    btn.style.background = 'color-mix(in srgb, var(--bad) 18%, transparent)';
  }
  quizScore.textContent = `${right} / ${asked}`;
  selectStructure(target);
}

quizNext.onclick = newQuestion;
quizToggle.onclick = () => {
  quizOn = !quizOn;
  quizToggle.classList.toggle('on', quizOn);
  quizPanel.hidden = !quizOn;
  if (quizOn) newQuestion();
};

// ---------- атрибуція і старт ----------
document.getElementById('introTitle').textContent = SPECIES_NOTE.title;
document.getElementById('introLatin').textContent = SPECIES_NOTE.la;
document.getElementById('introText').textContent = SPECIES_NOTE.intro;
document.getElementById('attribution').innerHTML =
  `3D-скан: <a href="${ATTRIBUTION.authorUrl}" target="_blank" rel="noopener noreferrer">${ATTRIBUTION.author}</a>, `
  + `сканування — ${ATTRIBUTION.scanner}. Зразок ${ATTRIBUTION.specimen} `
  + `(<a href="${ATTRIBUTION.catalogUrl}" target="_blank" rel="noopener noreferrer">каталог музею</a>). `
  + `Ліцензія <a href="${ATTRIBUTION.licenseUrl}" target="_blank" rel="noopener noreferrer">${ATTRIBUTION.license}</a>. `
  + `Підписи структур — за методичкою кафедри (тема T4) і NAV.`;

buildList();
loadPart(PARTS[0].id);
