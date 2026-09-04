// Інтерактивна 3D-модель грудного хребця ВРХ. Схематична процедурна геометрія
// (не 3D-скан): форми спрощені для наочності, підписи й описи анатомічно точні.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STRUCTURES, CATEGORY_ORDER, VIEWS, SPECIES_NOTE } from './vertebra-cow-data.js';

const COLOR = {
  bone: 0xEFE6D0, boneDark: 0xD9C9A3, cartilage: 0x6FA8D6,
  ghost: 0xC9BFA6, highlight: 0xFF8A3D, quizHit: 0x2fae66,
  quizMiss: 0xd3453c, quiz: 0x3DA5FF, canal: 0x9FD1E8,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...opts });
}

const structureById = Object.fromEntries(STRUCTURES.map(s => [s.id, s]));
const parts = {}; // id -> THREE.Mesh[]

function addPart(id, mesh, group) {
  mesh.userData.partID = id;
  group.add(mesh);
  if (!parts[id]) parts[id] = [];
  parts[id].push(mesh);
  return mesh;
}

// ---------- геометрія хребця ----------
// ghost: спрощена напівпрозора копія сусіднього хребця (контекст, не клікабельна).
function buildVertebra({ ghost = false, z = 0 } = {}) {
  const group = new THREE.Group();
  group.position.z = z;
  const ghostMat = () => mat(COLOR.ghost, { transparent: true, opacity: 0.28 });
  const boneMat = () => (ghost ? ghostMat() : mat(COLOR.bone));
  const darkMat = () => (ghost ? ghostMat() : mat(COLOR.boneDark));
  const cartMat = () => (ghost ? ghostMat() : mat(COLOR.cartilage));

  const corpus = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 5, 24), boneMat());
  corpus.rotation.x = Math.PI / 2;
  if (ghost) group.add(corpus); else addPart('corpus', corpus, group);

  const caput = new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), boneMat());
  caput.rotation.x = -Math.PI / 2;
  caput.position.z = 2.5;
  if (ghost) group.add(caput); else addPart('caput', caput, group);

  const fossa = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.05, 0.5, 24), darkMat());
  fossa.rotation.x = Math.PI / 2;
  fossa.position.z = -2.75;
  if (ghost) group.add(fossa); else addPart('fossa', fossa, group);

  const wallGeo = new THREE.BoxGeometry(0.6, 3, 5);
  const archM = boneMat();
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(wallGeo, archM);
    wall.position.set(side * 1.6, 3.0, 0);
    wall.rotation.z = -side * 0.26;
    if (ghost) group.add(wall); else addPart('arcus', wall, group);
  }

  if (ghost) return group;

  const crista = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 4.6), darkMat());
  crista.position.set(0, -2.05, 0);
  addPart('crista-ventralis', crista, group);

  const foveaGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.15, 16);
  const foveaCrM = cartMat(), foveaCaM = cartMat();
  for (const side of [-1, 1]) {
    const fc = new THREE.Mesh(foveaGeo, foveaCrM);
    fc.rotation.z = Math.PI / 2;
    fc.position.set(side * 2.05, 0.2, 1.9);
    addPart('fovea-cr', fc, group);
    const fa = new THREE.Mesh(foveaGeo, foveaCaM);
    fa.rotation.z = Math.PI / 2;
    fa.position.set(side * 2.05, 0.2, -1.9);
    addPart('fovea-ca', fa, group);
  }

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 5), darkMat());
  ridge.position.set(0, 4.55, 0);
  addPart('crista-arcus', ridge, group);

  const canal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 5.2, 20, 1, true),
    mat(COLOR.canal, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  canal.rotation.x = Math.PI / 2;
  canal.position.y = 2.55;
  addPart('foramen-vertebrae', canal, group);

  const spinous = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 1.5), boneMat());
  spinous.position.set(0, 8.5, -0.6);
  spinous.rotation.x = -0.35;
  addPart('proc-spinosus', spinous, group);

  const tpGeo = new THREE.BoxGeometry(4, 0.6, 1.8);
  const tipGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16);
  const apGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const facetGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16);
  const mamGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const notchGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14);
  const tpM = boneMat(), tipM = cartMat(), apCrM = boneMat(), apCaM = boneMat(),
    facetM = cartMat(), mamM = boneMat(), notchCrM = darkMat(), notchCaM = darkMat();

  for (const side of [-1, 1]) {
    const tp = new THREE.Mesh(tpGeo, tpM);
    tp.position.set(side * 4.1, 2.3, 0.1);
    addPart('proc-transversus', tp, group);

    const tip = new THREE.Mesh(tipGeo, tipM);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(side * 6.1, 2.3, 0.1);
    addPart('fovea-tp', tip, group);

    const crAP = new THREE.Mesh(apGeo, apCrM);
    crAP.position.set(side * 1.35, 3.3, 2.3);
    addPart('proc-art-cr', crAP, group);
    const crFacet = new THREE.Mesh(facetGeo, facetM);
    crFacet.position.set(side * 1.35, 3.85, 2.3);
    addPart('facies-articularis', crFacet, group);

    const caAP = new THREE.Mesh(apGeo, apCaM);
    caAP.position.set(side * 1.35, 3.3, -2.3);
    addPart('proc-art-ca', caAP, group);
    const caFacet = new THREE.Mesh(facetGeo, facetM);
    caFacet.position.set(side * 1.35, 3.85, -2.3);
    addPart('facies-articularis', caFacet, group);

    const mam = new THREE.Mesh(mamGeo, mamM);
    mam.position.set(side * 1.9, 3.6, 2.7);
    addPart('proc-mamillaris', mam, group);

    const nCr = new THREE.Mesh(notchGeo, notchCrM);
    nCr.rotation.x = Math.PI / 2;
    nCr.position.set(side * 1.7, 1.9, 1.9);
    addPart('incisura-cr', nCr, group);
    const nCa = new THREE.Mesh(notchGeo, notchCaM);
    nCa.rotation.x = Math.PI / 2;
    nCa.position.set(side * 1.7, 1.9, -1.9);
    addPart('incisura-ca', nCa, group);
  }

  return group;
}

// ---------- сцена ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(8, 12, 10);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-8, 4, -6);
scene.add(fillLight);

const root = new THREE.Group();
scene.add(root);
root.add(buildVertebra());
root.add(buildVertebra({ ghost: true, z: 6.6 }));
root.add(buildVertebra({ ghost: true, z: -6.6 }));

const ivfGeo = new THREE.SphereGeometry(0.4, 14, 12);
const ivfCranial = new THREE.Mesh(ivfGeo, mat(0x2b2b2b, { transparent: true, opacity: 0.85 }));
ivfCranial.position.set(1.7, 1.9, 4.2);
addPart('foramen-intervertebrale', ivfCranial, root);
const ivfCaudal = new THREE.Mesh(ivfGeo, mat(0x2b2b2b, { transparent: true, opacity: 0.85 }));
ivfCaudal.position.set(1.7, 1.9, -4.2);
addPart('foramen-intervertebrale', ivfCaudal, root);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 40;
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

// ---------- види, зум, обертання, внутрішні структури ----------
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

let internalOn = false;
const internalBtn = document.getElementById('toggleInternal');
internalBtn.onclick = () => {
  internalOn = !internalOn;
  internalBtn.classList.toggle('on', internalOn);
  for (const id of ['corpus', 'arcus', 'caput', 'fossa']) {
    const meshes = parts[id];
    if (!meshes) continue;
    for (const m of meshes) {
      m.material.transparent = internalOn;
      m.material.opacity = internalOn ? 0.32 : 1;
      m.material.needsUpdate = true;
    }
  }
  const canal = parts['foramen-vertebrae'];
  if (canal) for (const m of canal) m.material.opacity = internalOn ? 0.85 : 0.35;
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
buildList();
