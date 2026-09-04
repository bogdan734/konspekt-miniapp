// Інтерактивна 3D-модель хребця ВРХ, з перемиканням між відділами хребта.
// Шийний і поперековий відділи — гібридний режим (реальний 3D-скан кістки як
// візуальна оболонка + окремі клікабельні маркери-"хотспоти" на анатомічних
// орієнтирах). Грудний, крижовий і хвостовий — процедурна геометрія (кожна
// структура — окремий меш, тому можна ховати частини й бачити внутрішні
// структури; для сканів це технічно неможливо на єдиній зшитій поверхні).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { REGIONS, REGION_ORDER, VIEWS, ATTRIBUTIONS } from './vertebra-regions.js';

const COLOR = {
  bone: 0xEFE6D0, boneDark: 0xD9C9A3, cartilage: 0x6FA8D6,
  ghost: 0xC9BFA6, highlight: 0xFF8A3D, quizHit: 0x2fae66,
  quizMiss: 0xd3453c, quiz: 0x3DA5FF, canal: 0x9FD1E8, hotspot: 0x3DA5FF,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...opts });
}

// ---------- стан поточного відділу (мутується при перемиканні) ----------
let structureById = {};
let currentStructures = [];
let currentCategoryOrder = [];
let currentMode = 'procedural';
let currentRegionId = null;
const parts = {}; // id -> THREE.Mesh[], перебудовується щоразу при зміні відділу

// Проста процедурна текстура кістки (плямистість + поздовжні волокна), щоб
// поверхня не виглядала пластиковою. Ніяких зовнішніх файлів — усе canvas'ом.
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

// ---------- ГРУДНИЙ ВІДДІЛ: процедурна геометрія ----------
// ghost: спрощена напівпрозора копія сусіднього хребця (контекст, не клікабельна).
function buildVertebra({ ghost = false, z = 0 } = {}) {
  const group = new THREE.Group();
  group.position.z = z;
  const ghostMat = () => mat(COLOR.ghost, { transparent: true, opacity: 0.28 });
  const boneMat = () => (ghost ? ghostMat() : mat(0xffffff, { map: BONE_TEX }));
  const darkMat = () => (ghost ? ghostMat() : mat(COLOR.boneDark));
  const cartMat = () => (ghost ? ghostMat() : mat(COLOR.cartilage));

  // Тіло не циліндр, а «талія»: вужче посередині, ширше на кінцях (як у
  // реальних грудних хребців ВРХ) — профіль обертання (Lathe) замість Cylinder.
  const bodyProfile = [
    new THREE.Vector2(1.95, 0.0), new THREE.Vector2(2.1, 0.35),
    new THREE.Vector2(1.88, 1.2), new THREE.Vector2(1.72, 2.5),
    new THREE.Vector2(1.88, 3.8), new THREE.Vector2(2.1, 4.65),
    new THREE.Vector2(1.95, 5.0),
  ];
  const corpus = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 28), boneMat());
  corpus.geometry.translate(0, -2.5, 0);
  corpus.rotation.x = Math.PI / 2;
  corpus.scale.y = 0.92;
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

  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 5, 12), darkMat());
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, 4.5, 0);
  addPart('crista-arcus', ridge, group);

  const canal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 5.2, 20, 1, true),
    mat(COLOR.canal, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  canal.rotation.x = Math.PI / 2;
  canal.position.y = 2.55;
  addPart('foramen-vertebrae', canal, group);

  // Остистий відросток — не рівний брусок, а звужений догори і вигнутий
  // каудально «шаблею»: чотири складені сегменти замість одного прямого.
  const spineSegs = [
    { w: 0.62, h: 2.3, d: 1.6, y: 4.75, z: -0.05, rot: -0.08 },
    { w: 0.50, h: 2.3, d: 1.35, y: 6.75, z: -0.42, rot: -0.20 },
    { w: 0.38, h: 2.1, d: 1.05, y: 8.65, z: -1.05, rot: -0.34 },
    { w: 0.24, h: 1.7, d: 0.7, y: 10.25, z: -1.85, rot: -0.48 },
  ];
  for (const s of spineSegs) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), boneMat());
    seg.position.set(0, s.y, s.z);
    seg.rotation.x = s.rot;
    addPart('proc-spinosus', seg, group);
  }

  // Поперечний відросток звужується до кінчика — конус, сплюснутий дорзовентрально.
  const tpGeo = new THREE.CylinderGeometry(0.4, 0.85, 4, 14);
  const tipGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16);
  // Суглобові відростки — не кубики, а витягнуті горбки (еліпсоїди).
  const apGeo = new THREE.SphereGeometry(0.55, 12, 10);
  const facetGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16);
  const mamGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const notchGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14);
  const tpM = boneMat(), tipM = cartMat(), apCrM = boneMat(), apCaM = boneMat(),
    facetM = cartMat(), mamM = boneMat(), notchCrM = darkMat(), notchCaM = darkMat();

  for (const side of [-1, 1]) {
    const tp = new THREE.Mesh(tpGeo, tpM);
    tp.rotation.z = -side * Math.PI / 2;
    tp.scale.x = 0.45; // сплюснутий дорзовентрально
    tp.position.set(side * 4.1, 2.3, 0.1);
    addPart('proc-transversus', tp, group);

    const tip = new THREE.Mesh(tipGeo, tipM);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(side * 6.1, 2.3, 0.1);
    addPart('fovea-tp', tip, group);

    const crAP = new THREE.Mesh(apGeo, apCrM);
    crAP.scale.set(1, 0.8, 1.15);
    crAP.position.set(side * 1.35, 3.3, 2.3);
    addPart('proc-art-cr', crAP, group);
    const crFacet = new THREE.Mesh(facetGeo, facetM);
    crFacet.position.set(side * 1.35, 3.85, 2.3);
    addPart('facies-articularis', crFacet, group);

    const caAP = new THREE.Mesh(apGeo, apCaM);
    caAP.scale.set(1, 0.8, 1.15);
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

// Обгортає основний хребець + 2 напівпрозорих сусідніх + маркери міжхребцевого
// отвору в ОДНУ групу, яку можна цілком додати/прибрати при зміні відділу.
function buildThoracicScene() {
  const group = new THREE.Group();
  group.add(buildVertebra());
  group.add(buildVertebra({ ghost: true, z: 6.6 }));
  group.add(buildVertebra({ ghost: true, z: -6.6 }));

  const ivfGeo = new THREE.SphereGeometry(0.4, 14, 12);
  const ivfCranial = new THREE.Mesh(ivfGeo, mat(0x2b2b2b, { transparent: true, opacity: 0.85 }));
  ivfCranial.position.set(1.7, 1.9, 4.2);
  addPart('foramen-intervertebrale', ivfCranial, group);
  const ivfCaudal = new THREE.Mesh(ivfGeo, mat(0x2b2b2b, { transparent: true, opacity: 0.85 }));
  ivfCaudal.position.set(1.7, 1.9, -4.2);
  addPart('foramen-intervertebrale', ivfCaudal, group);

  return group;
}

// ---------- КРИЖОВИЙ ВІДДІЛ: процедурна геометрія (5 зрощених сегментів) ----------
function buildSacrum() {
  const group = new THREE.Group();
  const boneMat = () => mat(0xffffff, { map: BONE_TEX });
  const darkMat = () => mat(COLOR.boneDark);
  const nSeg = 5, segLen = 2.1, total = segLen * nSeg;

  // Тіло — зрощені сегменти, що звужуються каудально (крижова кістка ширша
  // й масивніша краніально, де вона несе основне навантаження від тазу).
  const profile = [];
  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    const r = THREE.MathUtils.lerp(2.35, 0.95, t);
    const notch = (i > 0 && i < nSeg) ? 0.85 : 1; // легке звуження між сегментами
    profile.push(new THREE.Vector2(r * notch, i * segLen));
  }
  const corpus = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), boneMat());
  corpus.rotation.x = Math.PI / 2;
  corpus.position.z = total / 2;
  corpus.scale.y = 0.72; // сплюснута дорзовентрально
  addPart('corpus', corpus, group);

  // Крило крижа — велика трикутна пластинка на краніальному кінці, для
  // зчленування з клубовою кісткою (facies auricularis), спрямована
  // краніолатерально й трохи дорзально.
  const alaShape = new THREE.Shape();
  alaShape.moveTo(0, -1.3);
  alaShape.lineTo(4.4, 1.4);
  alaShape.lineTo(3.2, 3.2);
  alaShape.lineTo(0, 1.5);
  alaShape.closePath();
  for (const side of [-1, 1]) {
    const alaGeo = new THREE.ExtrudeGeometry(alaShape, { depth: 0.6, bevelEnabled: false });
    alaGeo.translate(0, 0, -0.3);
    const ala = new THREE.Mesh(alaGeo, boneMat());
    ala.scale.x = side * 0.95;
    ala.rotation.y = -side * 0.18;
    ala.position.set(side * 2.15, 0.35, total - segLen * 1.15);
    addPart('ala', ala, group);
  }

  // Серединний крижовий гребінь — зубчастий гребінь по дорзальній лінії,
  // утворений злиттям остистих відростків, знижується каудально.
  for (let i = 0; i < nSeg; i++) {
    const h = 0.95 - i * 0.13;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.32, Math.max(h, 0.3), segLen * 0.8), darkMat());
    crest.position.set(0, 1.65 + h / 2, total - segLen / 2 - i * segLen);
    addPart('crista-sacralis', crest, group);
  }

  // Крижовий канал — порожнистий по всій довжині зрощеної кістки.
  const canal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.5, total, 20, 1, true),
    mat(COLOR.canal, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  canal.rotation.x = Math.PI / 2;
  canal.position.set(0, 1.15, total / 2);
  addPart('canalis-sacralis', canal, group);

  // Дорзальні й вентральні крижові отвори — по 4 пари, між сусідніми сегментами.
  const foramenGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 14);
  for (let i = 1; i < nSeg; i++) {
    const zc = total - i * segLen;
    for (const side of [-1, 1]) {
      const fd = new THREE.Mesh(foramenGeo, darkMat());
      fd.position.set(side * 1.05, 1.55, zc);
      addPart('foramina-dorsalia', fd, group);
      const fv = new THREE.Mesh(foramenGeo, darkMat());
      fv.position.set(side * 1.25, -0.55, zc);
      addPart('foramina-ventralia', fv, group);
    }
  }

  return group;
}

// ---------- ХВОСТОВИЙ ВІДДІЛ: процедурна геометрія (3 сегменти, що звужуються) ----------
// У ВРХ хвостові хребці спрощуються каудально: дуга й відростки чітко виражені
// лише в проксимальних сегментах, дистальні — практично гладкі кісткові стрижні.
function buildCaudal() {
  const group = new THREE.Group();
  const boneMat = () => mat(0xffffff, { map: BONE_TEX });
  const darkMat = () => mat(COLOR.boneDark);
  const segLen = 3.2;
  const radii = [1.25, 0.8, 0.48, 0.3];
  let zCursor = 0;

  for (let i = 0; i < 3; i++) {
    const r0 = radii[i], r1 = radii[i + 1];
    const profile = [
      new THREE.Vector2(r0 * 0.88, 0), new THREE.Vector2(r0, 0.35),
      new THREE.Vector2((r0 + r1) / 2, segLen / 2), new THREE.Vector2(r1, segLen - 0.35),
      new THREE.Vector2(r1 * 0.88, segLen),
    ];
    const corpus = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), boneMat());
    corpus.rotation.x = Math.PI / 2;
    corpus.position.z = zCursor;
    corpus.scale.y = 0.82;
    addPart('corpus', corpus, group);

    // Дуга й відростки — лише на перших двох (проксимальних) сегментах; у
    // дистальних хвостових хребцях ВРХ дуга редукується до кісткової пластинки.
    if (i < 2) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(r0 * 1.15, 0.5, segLen * 0.7), boneMat());
      arch.position.set(0, r0 * 0.8, zCursor + segLen / 2);
      addPart('arcus', arch, group);

      const tpGeo = new THREE.CylinderGeometry(0.16, 0.34, segLen * 0.65, 10);
      for (const side of [-1, 1]) {
        const tp = new THREE.Mesh(tpGeo, boneMat());
        tp.rotation.z = -side * Math.PI / 2.3;
        tp.position.set(side * r0 * 1.7, -0.05, zCursor + segLen / 2);
        addPart('proc-transversus', tp, group);
      }

      // Гемальний відросток/дуга — вентрально, захищає хвостову артерію/вену;
      // добре виражений лише в перших хвостових хребцях.
      const hemGeo = new THREE.BoxGeometry(0.28, 0.85, segLen * 0.45);
      for (const side of [-1, 1]) {
        const hem = new THREE.Mesh(hemGeo, darkMat());
        hem.position.set(side * 0.32, -r0 * 0.9, zCursor + segLen / 2);
        hem.rotation.z = side * 0.16;
        addPart('proc-hemalis', hem, group);
      }
    }
    zCursor += segLen * 0.82;
  }

  return group;
}

// ---------- ШИЙНИЙ / ПОПЕРЕКОВИЙ ВІДДІЛИ: гібридний режим (скан + хотспоти) ----------
const gltfLoader = new GLTFLoader();

function loadScanGroup(region) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(region.asset, (gltf) => {
      const group = new THREE.Group();
      const shell = gltf.scene;
      shell.traverse((child) => {
        if (child.isMesh) {
          // Після децимації нормалі скану можуть бути відсутні/пошкоджені —
          // без них MeshStandardMaterial виглядає суцільно чорним (dot(N,L)=0).
          child.geometry.computeVertexNormals();
          child.material = mat(0xffffff, { map: BONE_TEX, side: THREE.DoubleSide });
          // Оболонка скану — суцільна зшита поверхня без окремих структур,
          // тому вимикаємо для неї raycast: клік завжди «проходить крізь»
          // і влучає у маркер-хотспот, а не в поверхню під ним.
          child.raycast = () => {};
        }
      });
      group.add(shell);

      const hotspotGeo = new THREE.SphereGeometry(0.42, 14, 12);
      for (const s of region.structures) {
        if (!s.position) continue;
        const hs = new THREE.Mesh(hotspotGeo, mat(COLOR.hotspot, { transparent: true, opacity: 0.55 }));
        hs.position.set(...s.position);
        addPart(s.id, hs, group);
      }
      resolve(group);
    }, undefined, reject);
  });
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
let rowByID = {};

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
  if (!structureById[id]) return;
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
    .find(i => i.object.userData.partID && parts[i.object.userData.partID]);
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
  listEl.innerHTML = '';
  rowByID = {};
  const cats = (currentCategoryOrder && currentCategoryOrder.length) ? currentCategoryOrder : [null];
  for (const cat of cats) {
    const group = cat ? currentStructures.filter(s => s.category === cat) : currentStructures;
    if (!group.length) continue;
    if (cat) {
      const h = document.createElement('div');
      h.className = 'cat-heading';
      h.textContent = cat;
      listEl.appendChild(h);
    }
    for (const s of group) {
      const row = document.createElement('div');
      row.className = 'struct-row';
      const btn = document.createElement('button');
      btn.className = 'struct-btn';
      btn.innerHTML = `<span class="name">${s.short || s.ua}</span><span class="la">${s.la}</span>`;
      btn.onclick = () => selectPart(s.id);
      row.append(btn);
      if (currentMode !== 'scan') {
        const eye = document.createElement('button');
        eye.className = 'eye-btn';
        eye.setAttribute('aria-label', 'Показати / приховати');
        eye.textContent = '\u{1F441}';
        eye.onclick = (e) => { e.stopPropagation(); toggleVisible(s.id, eye); };
        row.append(eye);
      }
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
  if (internalBtn.disabled) return;
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
  const canal = parts['foramen-vertebrae'] || parts['canalis-sacralis'];
  if (canal) for (const m of canal) m.material.opacity = internalOn ? 0.85 : 0.35;
};

// ---------- перемикач відділів хребта + атрибуція ----------
const regionTabsEl = document.getElementById('regionTabs');
const attributionEl = document.getElementById('attribution');
const regionTabButtons = {};

for (const id of REGION_ORDER) {
  const region = REGIONS[id];
  const b = document.createElement('button');
  b.className = 'region-btn';
  b.textContent = region.short;
  b.onclick = () => loadRegion(id);
  regionTabsEl.appendChild(b);
  regionTabButtons[id] = b;
}

function syncRegionTabs() {
  for (const [id, btn] of Object.entries(regionTabButtons)) btn.classList.toggle('on', id === currentRegionId);
}

function updateAttribution(regionId) {
  const a = ATTRIBUTIONS.find(x => x.region === regionId);
  if (!a) { attributionEl.hidden = true; attributionEl.innerHTML = ''; return; }
  attributionEl.hidden = false;
  attributionEl.innerHTML = `3D-скан кістки: <a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.author}</a> `
    + `(${a.source}), ліцензія ${a.license}.`;
}

function clearRegion() {
  clearHighlight();
  selectedID = null;
  infoCard.hidden = true;
  while (root.children.length) {
    const obj = root.children.pop();
    root.remove(obj);
    obj.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
  }
  for (const k of Object.keys(parts)) delete parts[k];
}

let loadToken = 0;

async function loadRegion(regionId) {
  const region = REGIONS[regionId];
  if (!region) return;
  const token = ++loadToken;

  currentStructures = region.structures;
  currentCategoryOrder = region.categoryOrder || [];
  structureById = Object.fromEntries(currentStructures.map(s => [s.id, s]));
  currentMode = region.mode;

  let group;
  if (region.mode === 'scan') {
    try {
      group = await loadScanGroup(region);
    } catch (err) {
      console.error('Не вдалося завантажити 3D-скан для відділу', regionId, err);
      if (token !== loadToken) return;
      clearRegion();
      currentRegionId = regionId;
      infoCard.hidden = false;
      infoTitle.textContent = 'Помилка завантаження';
      infoLatin.textContent = '';
      infoText.textContent = 'Не вдалося завантажити 3D-модель цього відділу. Перевір з’єднання й спробуй ще раз.';
      syncRegionTabs();
      return;
    }
    if (token !== loadToken) return; // користувач уже перемкнув на інший відділ
  } else if (region.builder === 'thoracic') {
    group = buildThoracicScene();
  } else if (region.builder === 'sacral') {
    group = buildSacrum();
  } else if (region.builder === 'caudal') {
    group = buildCaudal();
  }

  clearRegion();
  currentRegionId = regionId;
  root.add(group);

  const isScan = region.mode === 'scan';
  internalBtn.disabled = isScan;
  internalBtn.classList.toggle('disabled', isScan);
  if (isScan && internalOn) {
    internalOn = false;
    internalBtn.classList.remove('on');
  }

  document.getElementById('introTitle').textContent = region.intro.title;
  document.getElementById('introLatin').textContent = region.intro.la;
  document.getElementById('introText').textContent = region.intro.text;
  updateAttribution(regionId);

  buildList();
  syncRegionTabs();
  camera.position.set(...VIEWS[0].position);
  controls.target.set(0, 0, 0);
  controls.update();

  if (quizMode) startQuiz();
}

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
  const others = shuffle(currentStructures.map(s => s.id).filter(id => id !== quizTarget));
  const choices = shuffle([quizTarget, ...others.slice(0, 3)]);
  for (const id of choices) {
    const b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = structureById[id].short || structureById[id].ua;
    b.onclick = () => submitQuizAnswer(id, true);
    quizChoices.appendChild(b);
  }
}

function nextQuizQuestion() {
  clearHighlight();
  if (!quizPool.length) quizPool = currentStructures.map(s => s.id);
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
  quizPool = currentStructures.map(s => s.id)
    .filter(id => !parts[id] || parts[id][0].visible !== false);
  if (!quizPool.length) quizPool = currentStructures.map(s => s.id);
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

// ---------- ініціалізація ----------
loadRegion('thoracic');
