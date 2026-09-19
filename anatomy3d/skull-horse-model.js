// Інтерактивна 3D-модель черепа ВРХ. Схематична процедурна геометрія
// (не 3D-скан): форми спрощені для наочності, підписи й описи анатомічно
// точні (див. skull-cow-data.js за джерела). Череп і нижня щелепа — окремі
// об'єкти: щелепа підвішена на власному шарнірі й відкривається кнопкою,
// так само як у реальному черепі (скронево-нижньощелеповий суглоб).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STRUCTURES, CATEGORY_ORDER, VIEWS, SPECIES_NOTE } from './skull-horse-model-data.js';

const COLOR = {
  bone: 0xEFE6D0, boneDark: 0xD9C9A3, cartilage: 0x6FA8D6,
  tooth: 0xFFFBE8, highlight: 0xFF8A3D, quizHit: 0x2fae66,
  quizMiss: 0xd3453c, quiz: 0x3DA5FF, canal: 0x9FD1E8,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...opts });
}

const structureById = Object.fromEntries(STRUCTURES.map(s => [s.id, s]));
const parts = {}; // id -> THREE.Mesh[]

// Проста процедурна текстура кістки (та сама, що й у моделі хребця).
function boneTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe6d0';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 1.8 + 0.3;
    const dark = Math.random() > 0.5;
    ctx.fillStyle = dark
      ? `rgba(150,130,95,${Math.random() * 0.18})`
      : `rgba(255,250,235,${Math.random() * 0.22})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,100,70,0.05)';
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() * 24 - 12), size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}
const BONE_TEX = boneTexture();

function addPart(id, mesh, group) {
  mesh.userData.partID = id;
  group.add(mesh);
  if (!parts[id]) parts[id] = [];
  parts[id].push(mesh);
  return mesh;
}

const boneMat = () => mat(0xffffff, { map: BONE_TEX });
const darkMat = () => mat(COLOR.boneDark);
const toothMat = () => mat(COLOR.tooth, { roughness: 0.35 });

// Ряд дрібних зубів уздовж краю щелепи — спільний хелпер для верхньої й
// нижньої зубних рядів, щоб не повторювати цикл кожного разу.
function toothRow(id, count, group, { start, step, size, rot = 0 }) {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  for (let i = 0; i < count; i++) {
    const t = new THREE.Mesh(geo, toothMat());
    t.position.set(start[0], start[1], start[2] + i * step);
    t.rotation.z = rot;
    addPart(id, t, group);
  }
}

// ---------- ЧЕРЕП КОНЯ (нерухома частина) ----------
// Пропорції коня: череп довгий і вузький (у натурі ~527 x 193 x 149 мм), тому
// лицевий відділ займає більше половини довжини — на відміну від коротшого й
// ширшого черепа ВРХ. Вісь Z — ростро-каудальна (+Z до носа), Y — дорзо-
// вентральна, X — медіо-латеральна. Мозковий відділ: z -8.5..-2,
// очна ямка ~z -1.5, зубна аркада z +1..+6, беззуба діастема z +7..+11,
// різці z +12..+14 — саме ця довга діастема й робить голову коня «довгою».
function buildCranium() {
  const group = new THREE.Group();

  // Потилична кістка
  const occ = new THREE.Mesh(new THREE.SphereGeometry(2.8, 22, 16), boneMat());
  occ.scale.set(1.1, 1.05, 0.62);
  occ.position.set(0, 0.9, -7.0);
  addPart('occipitale', occ, group);

  // Великий потиличний отвір — у коня круглий
  const fm = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.17, 10, 20), boneMat());
  fm.position.set(0, -0.5, -7.95);
  addPart('foramen-magnum', fm, group);
  const fmHole = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), mat(0x2a2620));
  fmHole.position.set(0, -0.5, -8.02);
  addPart('foramen-magnum', fmHole, group);

  // Потиличні виростки — ними череп сидить на атланті
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), darkMat());
    c.scale.set(1, 0.8, 1.3);
    c.position.set(side * 1.0, -1.0, -8.0);
    addPart('condylus', c, group);
  }

  // Тім'яні кістки — дах мозкової коробки
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.0), boneMat());
    p.position.set(side * 1.35, 2.75, -5.2);
    p.rotation.z = -side * 0.13;
    addPart('parietale', p, group);
  }

  // Зовнішній сагітальний гребінь — видова ознака коня (у ВРХ його немає)
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 3.4), boneMat());
  crest.position.set(0, 3.2, -5.3);
  addPart('crista-sagittalis', crest, group);

  // Лобова кістка: лоб коня плавно переходить у спинку носа
  const fr = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.62, 4.6), boneMat());
  fr.position.set(0, 2.85, -1.7);
  addPart('frontale', fr, group);
  const frSlope = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.58, 2.8), boneMat());
  frSlope.rotation.x = -0.14;
  frSlope.position.set(0, 2.6, 1.2);
  addPart('frontale', frSlope, group);

  // Вискові кістки із зовнішнім слуховим проходом
  for (const side of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), boneMat());
    t.scale.set(1, 0.85, 1.25);
    t.position.set(side * 2.75, 0.9, -5.1);
    addPart('temporale', t, group);
    const meat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10), darkMat());
    meat.rotation.z = Math.PI / 2;
    meat.position.set(side * 3.3, 0.8, -5.7);
    addPart('temporale', meat, group);
  }

  // Очні ямки: у коня кільце замкнене повністю
  for (const side of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.2, 10, 22), boneMat());
    o.rotation.y = Math.PI / 2;
    o.position.set(side * 2.95, 1.6, -1.4);
    addPart('orbita', o, group);
  }

  // Виличні дуги — ланцюжок сегментів між заданими точками
  const zygoPts = [[2.9, 0.6, -4.2], [3.05, 0.15, -2.4], [2.85, -0.15, -0.4], [2.45, -0.4, 1.4]];
  for (const side of [-1, 1]) {
    for (let i = 0; i < zygoPts.length - 1; i++) {
      const a = new THREE.Vector3(side * zygoPts[i][0], zygoPts[i][1], zygoPts[i][2]);
      const b = new THREE.Vector3(side * zygoPts[i + 1][0], zygoPts[i + 1][1], zygoPts[i + 1][2]);
      const dir = new THREE.Vector3().subVectors(b, a);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, dir.length(), 10), boneMat());
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      addPart('arcus-zygomaticus', seg, group);
    }
  }

  // Клиноподібна кістка і криловий канал (у коня з трьома отворами)
  for (const side of [-1, 1]) {
    const sph = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 1.6), boneMat());
    sph.position.set(side * 1.3, -0.7, -2.8);
    addPart('sphenoidale', sph, group);
    const canal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 10), mat(COLOR.canal));
    canal.rotation.x = Math.PI / 2;
    canal.position.set(side * 1.75, -1.05, -2.7);
    addPart('canalis-alaris', canal, group);
  }

  for (const side of [-1, 1]) {
    // Верхня щелепа: зубна частина
    const mx = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3.0, 7.2), boneMat());
    mx.position.set(side * 2.05, -0.4, 3.4);
    addPart('maxilla', mx, group);
    // і беззуба частина — діастема, куди лягають вудила
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 4.6), boneMat());
    bar.position.set(side * 1.7, -0.95, 9.2);
    addPart('maxilla', bar, group);

    // Лицевий ГРЕБІНЬ — головна видова ознака коня проти ВРХ
    const cf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 4.6), boneMat());
    cf.position.set(side * 2.68, -0.35, 3.3);
    addPart('crista-facialis', cf, group);
    const tuber = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), boneMat());
    tuber.position.set(side * 2.68, -0.35, 5.7);
    addPart('crista-facialis', tuber, group);

    // Підочноямковий отвір — трохи вище й попереду початку гребеня
    const fio = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10), darkMat());
    fio.rotation.z = Math.PI / 2;
    fio.position.set(side * 2.5, 0.5, 6.9);
    addPart('foramen-infraorbitale', fio, group);

    // Щічні зуби
    toothRow('dentes', 6, group, {
      start: [side * 1.95, -2.05, 1.2], step: 0.95, size: [0.62, 0.6, 0.8],
    });

    // Слізна кістка — на межі орбіти й лиця
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.5), boneMat());
    l.position.set(side * 2.6, 0.95, 0.2);
    addPart('lacrimale', l, group);

    // Носова кістка: лежить на спинці носа й спускається до загостреного кінця
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 10.2, 14), boneMat());
    n.rotation.x = Math.PI / 2 + 0.085;
    n.scale.x = 0.62;
    n.position.set(side * 0.58, 1.85, 5.9);
    addPart('nasale', n, group);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.4, 10), boneMat());
    tip.rotation.x = Math.PI / 2 + 0.085;
    tip.position.set(side * 0.5, 0.92, 11.4);
    addPart('nasale', tip, group);
  }

  // Різцева кістка: у коня — З луночками для верхніх різців
  const incBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 3.0), boneMat());
  incBody.position.set(0, -1.15, 12.3);
  addPart('incisivum', incBody, group);
  const incNose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), boneMat());
  incNose.scale.set(0.9, 0.72, 0.85);
  incNose.position.set(0, -0.95, 13.5);
  addPart('incisivum', incNose, group);
  for (let i = 0; i < 6; i++) {
    const t = i - 2.5;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, 0.34), toothMat());
    tooth.position.set(t * 0.36, -2.0, 13.4 - Math.abs(t) * 0.16);
    addPart('incisivum', tooth, group);
  }

  return group;
}

// ---------- НИЖНЯ ЩЕЛЕПА (окрема рухома частина) ----------
// Група стоїть у точці скронево-нижньощелепового суглоба, тож «відкрити рот» —
// це просто обертання всієї групи навколо її локального нуля (rotation.x).
function buildMandible() {
  const group = new THREE.Group();
  group.position.set(0, -1.7, -4.6);

  for (const side of [-1, 1]) {
    // Гілка з суглобовим і вінцевим відростками
    const ram = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.0, 1.9), boneMat());
    ram.position.set(side * 2.6, 1.0, -0.2);
    addPart('ramus', ram, group);
    const cond = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), darkMat());
    cond.position.set(side * 2.6, 2.45, -0.3);
    addPart('ramus', cond, group);
    const cor = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.8, 10), boneMat());
    cor.rotation.x = -0.26;
    cor.position.set(side * 2.45, 2.4, 0.8);
    addPart('ramus', cor, group);

    // Корінна частина тіла — дотягується аж до різцевої частини
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 13.4), boneMat());
    body.position.set(side * 1.95, -1.0, 7.5);
    body.rotation.y = -side * 0.055;
    addPart('pars-molaris', body, group);
    const ment = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 10), darkMat());
    ment.rotation.z = Math.PI / 2;
    ment.position.set(side * 2.2, -0.9, 12.3);
    addPart('pars-molaris', ment, group);
    toothRow('pars-molaris', 6, group, {
      start: [side * 1.9, -0.2, 5.9], step: 0.95, size: [0.6, 0.55, 0.8],
    });
  }

  // Різцева частина тіла з нижніми різцями
  const chin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 2.4), boneMat());
  chin.position.set(0, -0.85, 16.3);
  addPart('pars-incisiva', chin, group);
  for (let i = 0; i < 6; i++) {
    const t = i - 2.5;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.68, 0.32), toothMat());
    tooth.position.set(t * 0.34, 0.15, 16.9 - Math.abs(t) * 0.14);
    addPart('pars-incisiva', tooth, group);
  }

  return group;
}

// ---------- сцена ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(10, 14, 12);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-10, 5, -8);
scene.add(fillLight);

const root = new THREE.Group();
// Череп коня довгий, тож зсуваємо його так, щоб середина припала на початок
// координат — тоді обертання, зум і всі ракурси працюють навколо самої кістки.
root.position.z = -3;
scene.add(root);
root.add(buildCranium());
const mandible = buildMandible();
root.add(mandible);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 55;
camera.position.set(...VIEWS[0].position);
controls.update();

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

let autoRotate = false;
function tick() {
  if (autoRotate) root.rotation.y += 0.0035;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ---------- вибір і підсвітка ----------
let selectedID = null;

function setEmissive(id, color, intensity) {
  const meshes = parts[id];
  if (!meshes) return;
  for (const m of meshes) {
    m.material.emissive.set(color);
    m.material.emissiveIntensity = intensity;
  }
}

function clearHighlight() {
  if (selectedID) setEmissive(selectedID, 0x000000, 0);
  selectedID = null;
}

const infoCard = document.getElementById('infoCard');
const infoTitle = document.getElementById('infoTitle');
const infoLatin = document.getElementById('infoLatin');
const infoText = document.getElementById('infoText');
const listEl = document.getElementById('structureList');
const rowByID = {};

function renderInfo(s) {
  infoCard.hidden = false;
  infoTitle.textContent = s.ua;
  infoLatin.textContent = s.la;
  infoText.textContent = s.text;
}

function syncListSelection(id) {
  for (const [key, row] of Object.entries(rowByID)) row.classList.toggle('active', key === id);
}

function selectPart(id) {
  if (quizMode) return handleQuizGuess(id);
  clearHighlight();
  selectedID = id;
  setEmissive(id, COLOR.highlight, 0.55);
  renderInfo(structureById[id]);
  syncListSelection(id);
}

canvas.addEventListener('pointerdown', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(root.children, true)
    .find(i => i.object.userData.partID);
  if (hit) selectPart(hit.object.userData.partID);
});

function toggleVisible(id, eyeBtn) {
  const meshes = parts[id];
  if (!meshes) return;
  const visible = !meshes[0].visible;
  for (const m of meshes) m.visible = visible;
  eyeBtn.classList.toggle('off', !visible);
}

function buildList() {
  for (const cat of CATEGORY_ORDER) {
    const group = STRUCTURES.filter(s => s.category === cat);
    if (!group.length) continue;
    const h = document.createElement('div');
    h.className = 'cat-heading';
    h.textContent = cat;
    listEl.appendChild(h);
    for (const s of group) {
      const row = document.createElement('div');
      row.className = 'struct-row';
      const btn = document.createElement('button');
      btn.className = 'struct-btn';
      btn.innerHTML = `<span class="name">${s.short}</span><span class="la">${s.la}</span>`;
      btn.onclick = () => selectPart(s.id);
      const eye = document.createElement('button');
      eye.className = 'eye-btn';
      eye.setAttribute('aria-label', 'Показати / приховати');
      eye.textContent = '\u{1F441}';
      eye.onclick = (e) => { e.stopPropagation(); toggleVisible(s.id, eye); };
      row.append(btn, eye);
      listEl.appendChild(row);
      rowByID[s.id] = row;
    }
  }
}
buildList();

// ---------- види, зум, обертання ----------
function animateCamera(targetPos, duration = 650) {
  const start = camera.position.clone();
  const target = new THREE.Vector3(...targetPos);
  const t0 = performance.now();
  function step(now) {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(start, target, e);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const viewButtonsEl = document.getElementById('viewButtons');
for (const v of VIEWS) {
  const b = document.createElement('button');
  b.className = 'view-btn';
  b.textContent = v.ua;
  b.onclick = () => animateCamera(v.position);
  viewButtonsEl.appendChild(b);
}

function zoomBy(factor) {
  const dist = THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.setLength(dist);
}
document.getElementById('zoomIn').onclick = () => zoomBy(0.82);
document.getElementById('zoomOut').onclick = () => zoomBy(1.22);

const rotateBtn = document.getElementById('toggleAutoRotate');
rotateBtn.onclick = () => {
  autoRotate = !autoRotate;
  rotateBtn.classList.toggle('on', autoRotate);
};

// ---------- нижня щелепа: відкрити/закрити ----------
let jawOpen = false;
const jawBtn = document.getElementById('toggleJaw');
function animateJaw(open, duration = 550) {
  const start = mandible.rotation.x;
  const target = open ? -0.5 : 0;
  const t0 = performance.now();
  function step(now) {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    mandible.rotation.x = start + (target - start) * e;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
jawBtn.onclick = () => {
  jawOpen = !jawOpen;
  jawBtn.classList.toggle('on', jawOpen);
  jawBtn.textContent = jawOpen ? 'Закрити щелепу' : 'Відкрити щелепу';
  animateJaw(jawOpen);
};

// ---------- внутрішні структури (мозкова коробка напівпрозора) ----------
let internalOn = false;
const internalBtn = document.getElementById('toggleInternal');
internalBtn.onclick = () => {
  internalOn = !internalOn;
  internalBtn.classList.toggle('on', internalOn);
  for (const id of ['occipitale', 'parietale', 'frontale', 'temporale']) {
    const meshes = parts[id];
    if (!meshes) continue;
    for (const m of meshes) {
      m.material.transparent = internalOn;
      m.material.opacity = internalOn ? 0.32 : 1;
      m.material.needsUpdate = true;
    }
  }
  const sphenoid = parts['sphenoidale'];
  if (sphenoid) for (const m of sphenoid) {
    m.material.emissiveIntensity = internalOn && selectedID !== 'sphenoidale' ? 0.25 : m.material.emissiveIntensity;
    m.material.emissive.set(internalOn && selectedID !== 'sphenoidale' ? 0x3da5ff : m.material.emissive);
  }
};

// ---------- режим самоперевірки ----------
let quizMode = false;
let quizTarget = null;
let quizPool = [];
let quizScore = { correct: 0, total: 0 };

const quizPanel = document.getElementById('quizPanel');
const quizPrompt = document.getElementById('quizPrompt');
const quizInput = document.getElementById('quizInput');
const quizFeedback = document.getElementById('quizFeedback');
const quizScoreEl = document.getElementById('quizScore');
const quizChoices = document.getElementById('quizChoices');
const quizToggleBtn = document.getElementById('quizToggle');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalize(str) {
  const stripped = str.toLowerCase().normalize('NFD');
  let out = '';
  for (const ch of stripped) {
    const code = ch.codePointAt(0);
    if (code < 0x0300 || code > 0x036f) out += ch;
  }
  return out.trim();
}

function updateQuizScore() {
  quizScoreEl.textContent = `${quizScore.correct} / ${quizScore.total}`;
}

function renderQuizChoices() {
  quizChoices.innerHTML = '';
  const others = shuffle(STRUCTURES.map(s => s.id).filter(id => id !== quizTarget));
  const choices = shuffle([quizTarget, ...others.slice(0, 3)]);
  for (const id of choices) {
    const b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = structureById[id].short;
    b.onclick = () => submitQuizAnswer(id, true);
    quizChoices.appendChild(b);
  }
}

function nextQuizQuestion() {
  clearHighlight();
  if (!quizPool.length) quizPool = STRUCTURES.map(s => s.id);
  quizTarget = quizPool.splice(Math.floor(Math.random() * quizPool.length), 1)[0];
  selectedID = quizTarget;
  setEmissive(quizTarget, COLOR.quiz, 0.6);
  quizPrompt.textContent = 'Яка це структура (підсвічена синім)? Впиши назву (укр. або лат.) або обери зі списку.';
  quizInput.value = '';
  quizFeedback.textContent = '';
  quizFeedback.className = 'quiz-feedback';
  infoCard.hidden = true;
  renderQuizChoices();
}

function startQuiz() {
  quizPool = STRUCTURES.map(s => s.id)
    .filter(id => !parts[id] || parts[id][0].visible !== false);
  quizScore = { correct: 0, total: 0 };
  updateQuizScore();
  nextQuizQuestion();
}

function checkTextAnswer(raw) {
  const s = structureById[quizTarget];
  const guess = normalize(raw);
  return guess.length > 2 && (normalize(s.ua).includes(guess) || normalize(s.la).includes(guess));
}

function submitQuizAnswer(idOrText, isChoice) {
  const s = structureById[quizTarget];
  const correct = isChoice ? idOrText === quizTarget : checkTextAnswer(idOrText);
  quizScore.total += 1;
  if (correct) quizScore.correct += 1;
  quizFeedback.textContent = correct
    ? `Правильно: ${s.ua} (${s.la}).`
    : `Ні. Правильна відповідь: ${s.ua} (${s.la}).`;
  quizFeedback.className = 'quiz-feedback ' + (correct ? 'ok' : 'bad');
  setEmissive(quizTarget, correct ? COLOR.quizHit : COLOR.quizMiss, 0.7);
  updateQuizScore();
  infoCard.hidden = false;
  infoTitle.textContent = s.ua;
  infoLatin.textContent = s.la;
  infoText.textContent = s.text;
}

function handleQuizGuess(id) {
  submitQuizAnswer(id, true);
}

quizToggleBtn.onclick = () => {
  quizMode = !quizMode;
  quizToggleBtn.classList.toggle('on', quizMode);
  quizPanel.hidden = !quizMode;
  if (quizMode) startQuiz(); else clearHighlight();
};

document.getElementById('quizSubmit').onclick = () => {
  if (!quizInput.value.trim()) return;
  submitQuizAnswer(quizInput.value, false);
};
quizInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('quizSubmit').click();
});
document.getElementById('quizNext').onclick = () => nextQuizQuestion();

// ---------- ініціалізація UI ----------
document.getElementById('introTitle').textContent = SPECIES_NOTE.title;
document.getElementById('introLatin').textContent = SPECIES_NOTE.la;
document.getElementById('introText').textContent = SPECIES_NOTE.intro;
