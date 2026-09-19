// Інтерактивна 3D-модель черепа ВРХ. Схематична процедурна геометрія
// (не 3D-скан): форми спрощені для наочності, підписи й описи анатомічно
// точні (див. skull-cow-data.js за джерела). Череп і нижня щелепа — окремі
// об'єкти: щелепа підвішена на власному шарнірі й відкривається кнопкою,
// так само як у реальному черепі (скронево-нижньощелеповий суглоб).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STRUCTURES, CATEGORY_ORDER, VIEWS, SPECIES_NOTE } from './skull-cow-data.js';

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

// ---------- ЧЕРЕП (нерухома частина) ----------
function buildCranium() {
  const group = new THREE.Group();

  // Потилична кістка — заднє склепіння, навколо великого отвору.
  const occ = new THREE.Mesh(new THREE.SphereGeometry(4.3, 22, 16), boneMat());
  occ.scale.set(1.28, 1.0, 0.62);
  occ.position.set(0, 1.0, -8.4);
  addPart('occipitale', occ, group);

  const foramenRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.24, 10, 20), darkMat());
  foramenRing.position.set(0, -0.4, -9.55);
  addPart('foramen-magnum', foramenRing, group);
  const foramenHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20), mat(0x2a241c));
  foramenHole.position.set(0, -0.4, -9.5);
  addPart('foramen-magnum', foramenHole, group);

  const condyleGeo = new THREE.SphereGeometry(0.55, 12, 10);
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(condyleGeo, boneMat());
    c.scale.set(1, 0.8, 1.35);
    c.position.set(side * 1.35, -1.05, -9.6);
    addPart('condylus-occipitalis', c, group);
  }

  // Тім'яна кістка — пара невеликих пластинок перед потиличною.
  const parGeo = new THREE.BoxGeometry(2.3, 0.65, 2.7);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(parGeo, boneMat());
    p.position.set(side * 2.65, 3.55, -6.3);
    p.rotation.z = -side * 0.16;
    p.rotation.x = 0.08;
    addPart('parietale', p, group);
  }

  // Міжтім'яна кістка — трикутний клин на середній лінії.
  const interP = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.55, 3), darkMat());
  interP.rotation.x = Math.PI / 2;
  interP.rotation.z = Math.PI / 6;
  interP.position.set(0, 3.95, -7.35);
  addPart('interparietale', interP, group);

  // Лобова кістка — найбільша пластинка даху черепа (видова ознака ВРХ).
  const front = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.75, 8.2), boneMat());
  front.position.set(0, 3.75, -2.3);
  addPart('frontale', front, group);
  const frontSlope = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.7, 3.2), boneMat());
  frontSlope.position.set(0, 3.15, 1.4);
  frontSlope.rotation.x = -0.32;
  addPart('frontale', frontSlope, group);

  // Роговий відросток — видова ознака ВРХ: три сегменти, що вигинаються
  // назовні й догори (спрощено в одній площині — без вигину вперед, щоб
  // уникнути накопичення похибки від складених поворотів).
  const hornSegs = [
    { r0: 0.62, r1: 0.48, len: 1.9, pos: [4.55, 4.55, -5.4], rotZ: -1.15 },
    { r0: 0.48, r1: 0.34, len: 1.7, pos: [5.75, 5.85, -5.15], rotZ: -0.55 },
    { r0: 0.34, r1: 0.15, len: 1.5, pos: [6.35, 7.35, -4.85], rotZ: -0.12 },
  ];
  for (const side of [-1, 1]) {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 8, 14), darkMat());
    crown.rotation.y = Math.PI / 2;
    crown.position.set(side * 4.55, 4.55, -5.4);
    addPart('processus-cornualis', crown, group);
    for (const seg of hornSegs) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(seg.r1, seg.r0, seg.len, 12), boneMat());
      mesh.position.set(side * seg.pos[0], seg.pos[1], seg.pos[2]);
      mesh.rotation.z = side * seg.rotZ;
      addPart('processus-cornualis', mesh, group);
    }
  }

  // Вискова кістка — бічний блок каудально, з барабанним міхуром знизу.
  const tempGeo = new THREE.SphereGeometry(1.85, 16, 12);
  const bullaGeo = new THREE.SphereGeometry(0.88, 12, 10);
  for (const side of [-1, 1]) {
    const t = new THREE.Mesh(tempGeo, boneMat());
    t.scale.set(1, 0.8, 1.1);
    t.position.set(side * 5.6, 1.2, -6.7);
    addPart('temporale', t, group);

    const b = new THREE.Mesh(bullaGeo, boneMat());
    b.scale.set(1, 0.85, 1.15);
    b.position.set(side * 5.0, -0.75, -7.35);
    addPart('bulla-tympanica', b, group);
  }

  // Вилична дуга — вигнутий ланцюжок від вискової кістки до верхньої щелепи.
  const zygoPts = [
    [5.6, 0.5, -5.5], [6.0, 0.0, -3.0], [5.6, -0.2, -0.2], [4.2, -0.3, 2.9],
  ];
  for (const side of [-1, 1]) {
    for (let i = 0; i < zygoPts.length - 1; i++) {
      const a = new THREE.Vector3(side * zygoPts[i][0], zygoPts[i][1], zygoPts[i][2]);
      const b = new THREE.Vector3(side * zygoPts[i + 1][0], zygoPts[i + 1][1], zygoPts[i + 1][2]);
      const mid = a.clone().lerp(b, 0.5);
      const len = a.distanceTo(b);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, len, 10), boneMat());
      seg.position.copy(mid);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      addPart('arcus-zygomaticus', seg, group);
    }
  }

  // Очна ямка — кільце на місці зчленування лобової, виличної й слізної кісток.
  const orbitGeo = new THREE.TorusGeometry(1.15, 0.2, 10, 20);
  for (const side of [-1, 1]) {
    const o = new THREE.Mesh(orbitGeo, darkMat());
    o.position.set(side * 5.75, 1.65, -1.4);
    o.rotation.y = Math.PI / 2;
    o.rotation.x = 0.15;
    addPart('orbita', o, group);
  }

  // Клиноподібна кістка — переважно прихована, видно лише клаптик біля ока.
  const sphenoGeo = new THREE.BoxGeometry(0.9, 0.9, 1.3);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(sphenoGeo, darkMat());
    s.position.set(side * 3.0, 0.0, -2.0);
    addPart('sphenoidale', s, group);
  }

  // Носова кістка — звужується рострально, з роздвоєним кінчиком (ознака ВРХ).
  // Один-єдиний поворот навколо X кладе циліндр уздовж Z — той самий прийом,
  // що й у моделі хребця (безпечніше за складання кількох поворотів разом).
  for (const side of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 6.6, 14), boneMat());
    n.rotation.x = Math.PI / 2;
    n.scale.x = 0.55;
    n.position.set(side * 0.8, 3.15, 5.6);
    addPart('nasale', n, group);
    // Роздвоєний ростральний кінчик — маленький додатковий клин.
    const fork = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 8), boneMat());
    fork.rotation.x = Math.PI / 2;
    fork.position.set(side * 0.55, 2.6, 8.75);
    addPart('nasale', fork, group);
  }

  // Слізна кістка — невелика пластинка рострально-вентрально від очної ямки.
  const lacGeo = new THREE.BoxGeometry(0.9, 1.1, 0.4);
  for (const side of [-1, 1]) {
    const l = new THREE.Mesh(lacGeo, boneMat());
    l.position.set(side * 5.85, 0.65, 0.3);
    addPart('lacrimale', l, group);
  }

  // Верхня щелепа — головна бічна стінка морди, з рядом щічних зубів.
  // Проста коробка вздовж Z (без поворотів взагалі) — надійніше за Lathe.
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.3, 7.4), boneMat());
    m.position.set(side * 3.6, -0.9, 3.5);
    addPart('maxilla', m, group);

    toothRow('maxilla', 6, group, {
      start: [side * 3.55, -2.15, 0.6], step: 0.85, size: [0.6, 0.5, 0.7], rot: 0,
    });

    const infra = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), darkMat());
    infra.rotation.z = Math.PI / 2;
    infra.position.set(side * 4.0, -0.2, 3.4);
    addPart('foramen-infraorbitale', infra, group);
  }

  // Різцева кістка — заокруглений ростральний кінчик БЕЗ луночок для зубів
  // (у ВРХ верхніх різців немає — їх замінює зубна подушка).
  const incis = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), boneMat());
  incis.rotation.x = -Math.PI / 2;
  incis.scale.set(0.9, 0.65, 1);
  incis.position.set(0, -1.55, 7.7);
  addPart('incisivum', incis, group);

  return group;
}

// ---------- НИЖНЯ ЩЕЛЕПА (окрема рухома частина) ----------
// Група позиціонована у точці скронево-нижньощелепового суглоба — відкриття
// щелепи це просто обертання всієї групи навколо її локального початку
// координат (rotation.x), без ручного перерахунку кожної кістки.
function buildMandible() {
  const group = new THREE.Group();
  group.position.set(0, -2.0, -5.0);

  for (const side of [-1, 1]) {
    // Гілка нижньої щелепи: вертикальна пластинка + суглобовий і вінцевий відростки.
    const ramus = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.0, 2.0), boneMat());
    ramus.position.set(side * 5.3, 1.1, -0.5);
    addPart('mandibula-ramus', ramus, group);

    const condyle = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), boneMat());
    condyle.position.set(side * 5.3, 2.65, -0.5);
    addPart('mandibula-ramus', condyle, group);

    const coronoid = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.9, 10), boneMat());
    coronoid.position.set(side * 5.1, 2.5, 0.35);
    coronoid.rotation.x = -0.3;
    addPart('mandibula-ramus', coronoid, group);

    // Тіло нижньої щелепи: звужується і сходиться до серединного шва спереду.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.3, 9.0), boneMat());
    body.position.set(side * 2.5, -0.3, 4.3);
    body.rotation.y = -side * 0.16;
    addPart('mandibula-corpus', body, group);

    // Щічні (корінні) зуби — уздовж жувального краю тіла.
    toothRow('mandibula-corpus', 6, group, {
      start: [side * 2.55, 0.35, 1.0], step: 0.85, size: [0.55, 0.4, 0.7],
    });

    // Нижні різці — на самому кінчику, біля серединного шва (на відміну від
    // верхньої щелепи, де різців немає — тут вони є).
    for (let j = 0; j < 4; j++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.4), toothMat());
      t.position.set(side * (0.18 + j * 0.34), 0.15, 8.5 - j * 0.05);
      addPart('mandibula-corpus', t, group);
    }
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
