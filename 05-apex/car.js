/* ==========================================================================
   Апекс — 3D. Одна сцена на всю страницу: машина проявляется светом, камера
   облетает её по прокрутке, в «Разборе» она разлетается на детали, а в
   конфигураторе меняет цвет, открывает двери и пускает камеру в салон.
   Модель: Car Concept — Eric Chadwick / Darmstadt Graphics Group, CC BY 4.0
   (на основе CC0-модели Unity Fan). Логотип Khronos на модели заменён на «Апекс».
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const A = (window.APEX = window.APEX || {});
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LIBS = '../vendor/three/examples/jsm/libs/';
const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (v, a, b) => clamp((v - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const emit = (name, detail) => dispatchEvent(new CustomEvent('apex:' + name, { detail }));

/* ---------- рендер ---------- */
const canvas = $('.scene');
let R;
try {
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  emit('error');
  throw e;
}
const DPR = Math.min(window.devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 2);
R.setPixelRatio(DPR);
R.outputColorSpace = THREE.SRGBColorSpace;
/* PBR Neutral от Khronos: красный остаётся красным, без ухода в оранжевый, как у ACES */
R.toneMapping = THREE.NeutralToneMapping;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);

/* студия для отражений: тёмная комната с длинными софтбоксами — они дают «полосы» на краске */
function studio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(32, 16, 32), new THREE.MeshBasicMaterial({ color: 0x08090b, side: THREE.BackSide }));
  room.position.y = 6;
  s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshBasicMaterial({ color: 0x16181c }));
  floor.rotation.x = -Math.PI / 2;
  s.add(floor);
  const box = (w, h, k, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    s.add(m);
  };
  box(1.3, 16, 7, [-1.4, 9, 0], [Math.PI / 2, 0, 0]); /* два длинных софтбокса над машиной */
  box(1.3, 16, 7, [1.4, 9, 0], [Math.PI / 2, 0, 0]);
  box(18, 1.1, 6, [-11, 2.6, 0], [0, Math.PI / 2, 0]); /* боковые полосы — линия по борту */
  box(18, 1.1, 6, [11, 2.6, 0], [0, Math.PI / 2, 0]);
  box(12, 5, 1.1, [0, 4, 13], [0, Math.PI, 0]); /* мягкий свет спереди и сзади */
  box(12, 5, 0.8, [0, 4, -13], [0, 0, 0]);
  const pm = new THREE.PMREMGenerator(R);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}
scene.environment = studio();
scene.environmentIntensity = RM ? 1 : 0;

const key = new THREE.DirectionalLight(0xffffff, RM ? 1.2 : 0);
key.position.set(-3, 7, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
const sweep = new THREE.DirectionalLight(0xdfe8ff, 0); /* полоса света при появлении */
const fill = new THREE.DirectionalLight(0xe8eeff, RM ? 0.9 : 0); /* заполняющий свет со стороны камеры — для профиля */
fill.position.set(-8, 2.5, 1.5);
scene.add(key, fill, sweep, sweep.target);

/* мягкая тень под машиной */
function shadowPlane() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.85)');
  gr.addColorStop(0.55, 'rgba(0,0,0,.45)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(3.1, 5.6, 1);
  m.position.y = 0.002;
  return m;
}
const shadow = shadowPlane();
scene.add(shadow);
/* настоящая тень от ключевого света ложится на прозрачный «пол» */
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0, depthWrite: false }));
catcher.rotation.x = -Math.PI / 2;
catcher.position.y = 0.001;
catcher.receiveShadow = true;
scene.add(catcher);

/* отражение машины в полу: зеркало видно только там, где есть машина, и гаснет к краям */
let mirror = null;
if (!RM && innerWidth >= 760) {
  mirror = new Reflector(new THREE.CircleGeometry(4.4, 96), {
    textureWidth: Math.round(innerWidth * 0.6), textureHeight: Math.round(innerHeight * 0.6), clipBias: 0.003,
    shader: {
      name: 'FloorReflection',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vR;
        varying vec2 vL;
        void main() {
          vR = textureMatrix * vec4(position, 1.0);
          vL = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        varying vec4 vR;
        varying vec2 vL;
        void main() {
          vec4 c = texture2DProj(tDiffuse, vR);
          float f = 1.0 - smoothstep(0.3, 1.0, length(vL / vec2(2.3, 3.5)));
          gl_FragColor = vec4(c.rgb, c.a * f * 0.3);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  mirror.material.transparent = true;
  mirror.material.depthWrite = false;
  mirror.rotation.x = -Math.PI / 2;
  mirror.renderOrder = -2;
  scene.add(mirror);
}

/* шоурум вокруг машины: проявляется, когда камера садится в салон, — его видно через стёкла */
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = '900 150px Arial Black, Arial, sans-serif';
  g.fillText('АПЕКС', 512, 160);
  g.font = '500 30px Arial, sans-serif';
  g.fillStyle = '#9aa3ad';
  g.fillText('Д И Л Е Р С К И Й   Ц Е Н Т Р', 512, 222);
  g.fillStyle = '#e2213c';
  g.fillRect(352, 178, 320, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function showroom() {
  const g = new THREE.Group(), mats = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, ...o }); mats.push(m); return m; };
  const add = (geo, mat, pos, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.renderOrder = -1;
    g.add(m);
  };
  add(new THREE.PlaneGeometry(44, 44), M({ color: 0x17191d, roughness: 0.3, metalness: 0.2 }), [0, -0.004, 0], [-Math.PI / 2, 0, 0]);
  add(new THREE.BoxGeometry(44, 9, 44), M({ color: 0x0d0f12, roughness: 0.9, side: THREE.BackSide }), [0, 4.5, 0]);
  const glow = M({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 2.2 });
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.26, 0.05, 36), glow, [i * 3.2, 8.95, 0]);
  add(new THREE.PlaneGeometry(12, 3), M({ color: 0x000000, emissive: 0xffffff, emissiveMap: signTexture(), emissiveIntensity: 1.6 }), [0, 5.4, 21.9], [0, Math.PI, 0]);
  for (const x of [-7.4, 7.4]) add(new THREE.BoxGeometry(0.12, 6.5, 0.05), glow, [x, 4.3, 21.9]);
  add(new THREE.BoxGeometry(30, 0.08, 0.05), M({ color: 0x000000, emissive: 0xe2213c, emissiveIntensity: 2 }), [0, 0.6, 21.9]);
  for (const x of [-10, 10]) for (const z of [-9, 9]) add(new THREE.BoxGeometry(0.9, 9, 0.9), M({ color: 0x15171b, roughness: 0.55 }), [x, 4.5, z]);
  add(new THREE.CylinderGeometry(3.5, 3.5, 0.04, 96), M({ color: 0x1f2227, roughness: 0.35, metalness: 0.3 }), [0, -0.02, 0]);
  add(new THREE.TorusGeometry(3.51, 0.016, 8, 160), glow, [0, 0, 0], [Math.PI / 2, 0, 0]);
  g.visible = false;
  scene.add(g);
  return { g, mats };
}
const room = showroom();
/* свет в салоне — включается вместе с видом изнутри */
const cabin = new THREE.PointLight(0xffe7d2, 0, 3, 2);
cabin.position.set(0, 1.0, 0.25);
scene.add(cabin);

/* ---------- ракурсы камеры: p — где камера, t — куда смотрит, sx/sy — сдвиг кадра (доля экрана) ---------- */
const POSES = {
  hero: { p: [-6.2, 1.7, 7.0], t: [0, 0.42, 0.1], fov: 30, sx: 0.06, sy: 0.2 },
  light: { p: [-1.55, 0.78, 3.7], t: [-0.5, 0.5, 1.75], fov: 30, sx: -0.16, sy: 0 },
  wheel: { p: [-3.5, 0.62, 2.7], t: [-0.95, 0.4, 1.22], fov: 30, sx: -0.18, sy: 0 },
  side: { p: [-10.2, 0.9, 0], t: [0, 0.5, 0], fov: 26, sx: 0.17, sy: 0 },
  rear: { p: [-4.6, 1.6, -6.4], t: [0, 0.5, -0.9], fov: 30, sx: -0.2, sy: 0 },
  parts: { p: [-7.4, 5.0, 7.8], t: [0, 0.75, 0], fov: 32, sx: 0.13, sy: 0 },
  config: { p: [-6.2, 1.8, 5.6], t: [0, 0.45, 0], fov: 30, sx: 0.17, sy: 0 },
};
/* на узком экране текст внизу — машину поднимаем и отодвигаем камеру */
const POSES_NARROW = {
  hero: { sx: 0, sy: 0.12 }, light: { sx: 0, sy: 0.16 }, wheel: { sx: 0, sy: 0.16 }, side: { sx: 0, sy: 0.18 },
  rear: { sx: 0, sy: 0.16 }, parts: { sx: 0, sy: -0.06 }, config: { sx: 0, sy: 0.27 },
};
/* голова водителя: чуть впереди подголовника (дальше назад камера попадает внутрь сиденья) */
const INTERIOR = { p: [0, 0.93, -0.02], t: [0, 0.73, 2.78], fov: 62, sx: 0, sy: 0 };

const V = (a) => new THREE.Vector3(...a);
let narrow = false;
function pose(name) {
  const b = POSES[name];
  const o = narrow ? POSES_NARROW[name] : null;
  const p = V(b.p), t = V(b.t);
  /* портретный экран: камера дальше, чтобы машина влезла по ширине */
  const k = narrow ? clamp(1.05 / camera.aspect, 1, 2.3) : 1;
  p.sub(t).multiplyScalar(k).add(t);
  return { p, t, fov: b.fov, sx: o ? o.sx : b.sx, sy: o ? o.sy : b.sy };
}
function mix(a, b, t) {
  return { p: a.p.clone().lerp(b.p, t), t: a.t.clone().lerp(b.t, t), fov: a.fov + (b.fov - a.fov) * t, sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t };
}

/* опорные точки прокрутки: элемент с data-cam в центре экрана → его ракурс */
let anchors = [], partsEl, configEl, endY = Infinity;
function buildAnchors() {
  anchors = [];
  document.querySelectorAll('[data-cam]').forEach((el) => {
    const top = el.getBoundingClientRect().top + scrollY, h = el.offsetHeight, name = el.dataset.cam;
    if (el.hasAttribute('data-cam-span')) anchors.push({ y: top, name }, { y: top + h - innerHeight, name });
    else anchors.push({ y: name === 'hero' ? 0 : top + h / 2 - innerHeight / 2, name });
  });
  anchors.sort((a, b) => a.y - b.y);
  partsEl = $('.parts');
  configEl = $('.config');
  endY = configEl.getBoundingClientRect().top + scrollY + configEl.offsetHeight;
}
function poseAt(y) {
  if (y <= anchors[0].y) return pose(anchors[0].name);
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (y < b.y) return a.name === b.name ? pose(a.name) : mix(pose(a.name), pose(b.name), ease(range(y, a.y, b.y)));
  }
  return pose(anchors[anchors.length - 1].name);
}

/* ---------- загрузка модели ---------- */
const manager = new THREE.LoadingManager();
manager.onProgress = (_, loaded, total) => emit('progress', loaded / total);
const loader = new GLTFLoader(manager)
  .setDRACOLoader(new DRACOLoader().setDecoderPath(LIBS + 'draco/gltf/'))
  .setKTX2Loader(new KTX2Loader().setTranscoderPath(LIBS + 'basis/').detectSupport(R));

const root = new THREE.Group();
scene.add(root);
let car, parser, variants = [], ready = false, readyAt = 0, dash = null;

/* живая приборная панель: рисуется на холсте и обновляется раз в секунду, пока камера в салоне.
   Холст берёт раскладку UV у исходной текстуры панели */
function liveDash(m) {
  const src = m.emissiveMap, c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  ['flipY', 'wrapS', 'wrapT', 'rotation', 'channel'].forEach((k) => { tex[k] = src[k]; });
  tex.repeat.copy(src.repeat);
  tex.offset.copy(src.offset);
  tex.center.copy(src.center);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  m.emissiveMap = tex;
  m.needsUpdate = true;
  const bars = (x, w, n, on) => {
    for (let i = 0; i < n; i++) {
      g.lineWidth = 2;
      g.strokeRect(x, 40 + i * 17, w, 12);
      if (i >= n - on) g.fillRect(x, 40 + i * 17, w, 12);
    }
  };
  const label = (x, t) => { g.font = '18px Arial, sans-serif'; g.fillText(t, x, 225); };
  let last = '';
  return function draw() {
    const now = new Date(), time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (time === last) return;
    last = time;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(160, 18); g.lineTo(860, 18); g.lineTo(1000, 236); g.lineTo(24, 236); g.closePath();
    g.stroke();
    bars(170, 62, 9, 7);
    bars(256, 72, 9, 1);
    label(201, 'заряд 82%');
    label(292, 'мощность');
    g.font = '900 150px Arial Black, Arial, sans-serif';
    g.fillText('0', 520, 172);
    label(520, 'км/ч');
    g.font = '900 64px Arial Black, Arial, sans-serif';
    g.fillText('P', 660, 120);
    label(660, 'паркинг');
    g.font = '700 46px Arial, sans-serif';
    g.fillText(time, 800, 96);
    g.font = '24px Arial, sans-serif';
    g.fillText('запас 512 км', 800, 140);
    label(800, '+14 °C · Москва');
    tex.needsUpdate = true;
  };
}
const parts = [], layers = [], labels = [], lights = [], doors = [];

/* куда разлетается каждая деталь (метры, оси машины: x — влево, y — вверх, z — вперёд) и с какой задержкой */
const RULES = [
  [/^BodyDoorL/, [1.45, 0.35, 0], 0],
  [/^BodyDoorR/, [-1.45, 0.35, 0], 0],
  [/^WheelFrontL$/, [1.55, 0, 0.45], 0.05],
  [/^WheelFrontR$/, [-1.55, 0, 0.45], 0.05],
  [/^WheelRearL$/, [1.55, 0, -0.45], 0.05],
  [/^WheelRearR$/, [-1.55, 0, -0.45], 0.05],
  [/^Engine$/, [0, -0.12, 1.55], 0.08],
  [/^Axles$/, [0, -0.2, 0], 0.1],
  [/^BodyHood$/, [0, 0.85, 1.15], 0.1],
  [/^BodyRearPanels/, [0, 0.85, -1.2], 0.12],
  [/^License/, [0, 0.15, -1.75], 0.12],
  [/^BodyWindshield/, [0, 1.3, 0.65], 0.14],
  [/^BodyRoofPanel$/, [0, 1.85, 0], 0.16],
  [/^BodyPillars$/, [0, 1.35, 0], 0.18],
  [/^BodyPanelsColor2$/, [0, -0.22, 0], 0.18],
  [/^InteriorCage$/, [0, 1.45, -0.3], 0.2],
  [/^InteriorPillar$/, [0, 1.05, -0.45], 0.2],
  [/^InteriorSeats/, [0, 1.0, -0.2], 0.22],
  [/^InteriorSteering(Base|Cylinder|Handle|Dash)/, [0, 1.0, 0.55], 0.24],
  [/^InteriorDash/, [0, 0.75, 0.6], 0.24],
  [/^InteriorPedal/, [0, 0.5, 0.85], 0.26],
  [/^Interior(Floor|Mid)$/, [0, 0.5, 0], 0.28],
  [/^InteriorFloormats$/, [0, 0.3, 0], 0.28],
];
const LABELS = [
  /* четвёртое поле — показывать ли подпись на телефоне */
  ['BodyHood', 'Капот из карбона', 'и матричные LED-фары', 1],
  ['BodyRoofPanel', 'Панорамная крыша', 'стекло с подогревом', 1],
  ['BodyDoorRColor1', 'Двери с доводчиками', 'алюминиевый каркас'],
  ['WheelFrontR', 'Кованые диски 21″', 'шины 265/35 R21', 1],
  ['WheelFrontRBrakeDisc', 'Карбон-керамика', 'с 200 км/ч до нуля — 3,9 с'],
  ['Engine', 'Передний электромотор', 'два мотора · 1 020 л. с.', 1],
  ['InteriorSeatsColor1', 'Ковш из алькантары', 'водитель сидит по центру'],
  ['BodyRearPanelsColor1', 'Активный спойлер', 'выдвигается после 120 км/ч'],
];

/* доводка материалов модели (и тех, что подгружаются при смене цвета) */
const ANISO = Math.min(8, R.capabilities.getMaxAnisotropy());
const tuned = new WeakSet();
function tune(m) {
  if (!m || tuned.has(m)) return;
  tuned.add(m);
  /* текстуры чёткие и под острым углом: швы, протектор, ткань сидений */
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'clearcoatNormalMap'].forEach((k) => { if (m[k]) m[k].anisotropy = ANISO; });
  if (m.transmission > 0) {
    /* стекло с «преломлением» показывало белую пустоту за машиной — делаем обычное тонированное стекло с отражениями */
    m.transmission = 0;
    m.transparent = true;
    m.opacity = 0.3;
    m.color.set(0x0a0d11);
    m.roughness = 0.02;
    m.depthWrite = false;
    m.envMapIntensity = 2.4;
  }
  if (/^Paint/.test(m.name)) {
    /* блёстки мельче и тише: на крупных планах они давали «зерно»; лак — плотный и гладкий */
    if (m.normalMap) m.normalScale.setScalar(0.07);
    m.clearcoat = /^Paint 1/.test(m.name) ? 1 : Math.max(m.clearcoat, 0.6);
    m.clearcoatRoughness = 0.03;
    if (/^Paint 1/.test(m.name)) m.roughness = Math.max(m.roughness, 0.32);
    if (m.iridescence > 0) m.iridescence = Math.min(m.iridescence, 0.3);
    /* «белый перламутр»: белая неметаллическая основа с лёгким перламутровым отливом, без зелёной радуги */
    if (/^Paint 1 Pearl/.test(m.name)) Object.assign(m, { metalness: 0.2, roughness: 0.3, iridescence: 0.18 }), m.color.set(0xf1eee7);
  }
}

const tA = new THREE.Vector3(), tB = new THREE.Vector3();
/* смещение в мировых координатах → в координатах родителя детали */
function localOffset(obj, w) {
  obj.getWorldPosition(tA);
  tB.copy(tA).add(w);
  obj.parent.worldToLocal(tA);
  obj.parent.worldToLocal(tB);
  return tB.sub(tA).clone();
}

loader.load('model/CarConcept.gltf', async (gltf) => {
  car = gltf.scene;
  parser = gltf.parser;
  const ext = gltf.userData.gltfExtensions && gltf.userData.gltfExtensions.KHR_materials_variants;
  variants = ext ? ext.variants.map((v) => v.name) : [];
  car.position.z = -0.24; /* центр машины — в начале координат */
  root.add(car);
  root.updateMatrixWorld(true);

  car.traverse((o) => {
    if (!o.isMesh) return;
    [].concat(o.material).forEach((m) => {
      tune(m);
      if (/^(Headlight|Brakelight|Signallight)$/.test(m.name) && !lights.some((l) => l.m === m)) lights.push({ m, base: m.emissiveIntensity });
      if (m.name === 'Dashboard' && m.emissiveMap) dash = liveDash(m);
    });
    o.castShadow = !o.material.transparent;
  });

  const body = car.getObjectByName('BodyUnderside');
  body.children.forEach((o) => {
    const rule = RULES.find((r) => r[0].test(o.name));
    if (!rule) return;
    parts.push({ o, base: o.position.clone(), off: localOffset(o, V(rule[1])), d: rule[2] });
  });
  /* колёса раскладываются на слои: диск наружу, тормоз и колодка внутрь */
  ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'].forEach((n) => {
    const w = car.getObjectByName(n);
    const s = Math.sign(w.getWorldPosition(tA).x);
    w.children.forEach((c) => {
      const off = /Rim$/.test(c.name) ? [s * 0.55, 0, 0] : /Disc$/.test(c.name) ? [-s * 0.45, 0, 0] : /Pad$/.test(c.name) ? [-s * 0.28, 0.18, 0] : null;
      if (off) layers.push({ o: c, base: c.position.clone(), off: localOffset(c, V(off)) });
    });
  });
  /* двери висят на петле спереди и распахиваются наружу вокруг вертикали.
     Узлы модели повёрнуты (Z-вверх из 3ds Max), поэтому мировая вертикаль переводится в оси родителя двери */
  ['BodyDoorLColor1', 'BodyDoorRColor1'].forEach((n, i) => {
    const o = car.getObjectByName(n);
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(o.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    doors.push({ o, base: o.quaternion.clone(), axis, dir: i ? 1 : -1 });
  });

  /* подписи к деталям: точка-якорь — центр детали в её собственных координатах */
  const box = new THREE.Box3();
  const host = $('.labels'), svg = $('.labels__lines');
  LABELS.forEach(([name, title, sub, mobile]) => {
    const o = car.getObjectByName(name);
    if (!o) return;
    const anchor = o.worldToLocal(box.setFromObject(o).getCenter(new THREE.Vector3()));
    const el = document.createElement('div');
    el.className = 'lbl';
    el.innerHTML = `<b>${title}</b><small>${sub}</small>`;
    const dot = document.createElement('i');
    dot.className = 'lbl__dot';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    host.append(dot, el);
    svg.appendChild(path);
    labels.push({ o, anchor, el, dot, path, w: 0, mobile: !!mobile });
  });

  await selectVariant(variants[0]);
  R.compile(scene, camera);
  const snaps = await snapshots();
  resize();
  ready = true;
  readyAt = performance.now();
  syncLoop();
  emit('ready', { snaps });
}, undefined, () => emit('error'));

/* ---------- цвета кузова (KHR_materials_variants) ---------- */
async function selectVariant(name) {
  const vi = variants.indexOf(name);
  if (vi < 0) return;
  const jobs = [];
  car.traverse((o) => {
    const ext = o.isMesh && o.userData.gltfExtensions && o.userData.gltfExtensions.KHR_materials_variants;
    if (!ext) return;
    if (!o.userData.orig) o.userData.orig = o.material;
    const map = ext.mappings.find((m) => m.variants.includes(vi));
    if (!map) { o.material = o.userData.orig; return; }
    jobs.push(parser.getDependency('material', map.material).then((m) => { o.material = m; parser.assignFinalMaterial(o); tune(o.material); }));
  });
  await Promise.all(jobs);
}

/* ---------- снимки для «В наличии»: та же модель в трёх цветах с двух ракурсов ---------- */
async function snapshots() {
  const W = 760, H = 460, out = {};
  const shots = [
    ['front', { p: V([-4.1, 1.15, 4.2]), t: V([0, 0.45, 0.05]), fov: 30 }],
    ['rear', { p: V([4.2, 1.25, -4.2]), t: V([0, 0.45, -0.1]), fov: 30 }],
  ];
  R.setPixelRatio(1);
  R.setSize(W, H, false);
  camera.aspect = W / H;
  camera.clearViewOffset();
  scene.environmentIntensity = 1;
  key.intensity = 1.2;
  fill.intensity = 0.9;
  catcher.material.opacity = 0.42;
  lights.forEach((l) => { l.m.emissiveIntensity = l.base; });
  for (const v of variants) {
    await selectVariant(v);
    for (const [k, s] of shots) {
      camera.position.copy(s.p);
      camera.lookAt(s.t);
      camera.fov = s.fov;
      camera.updateProjectionMatrix();
      R.render(scene, camera);
      out[v + '|' + k] = canvas.toDataURL('image/webp', 0.86);
    }
  }
  await selectVariant(variants[0]);
  R.setPixelRatio(DPR);
  if (!RM) { scene.environmentIntensity = 0; key.intensity = 0; fill.intensity = 0; }
  return out;
}

/* ---------- состояние, которым управляет страница ---------- */
const S = { doors: false, lights: true, interior: false, explode: false };
A.set = (k, v) => { S[k] = v; };
A.paint = (name) => (car ? selectVariant(name) : Promise.resolve());

/* поворот машины мышью/пальцем в «Разборе» и конфигураторе; в салоне — осмотреться по сторонам */
const pointer = { x: 0, y: 0 }, ptr = { x: 0, y: 0 };
let yaw = 0, yawVel = 0, dragging = false, lastX = 0, lastY = 0, lookYaw = 0, lookPitch = 0, inK = 0;
document.querySelectorAll('[data-drag]').forEach((el) => {
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('form, button, a, input, label')) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
});
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  if (inK > 0.5) {
    /* кабина узкая: обивка дверей в полуметре от головы — обзор ограничен лобовым стеклом и панелью */
    lookYaw = clamp(lookYaw - dx * 0.004, -0.35, 0.35);
    lookPitch = clamp(lookPitch - dy * 0.003, -0.18, 0.2);
    return;
  }
  yawVel = dx * 0.006;
  yaw += yawVel;
}, { passive: true });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointercancel', () => { dragging = false; });

/* ---------- кадр ---------- */
const cam = { p: new THREE.Vector3(), t: new THREE.Vector3(), fov: 30, sx: 0, sy: 0 };
let first = true, E = 0, Ecfg = 0, doorK = 0, lightK = 1;
const qDoor = new THREE.Quaternion();
const right = new THREE.Vector3(), upV = new THREE.Vector3(), proj = new THREE.Vector3();
let headRight = 0;
const meterB = $('[data-explode]'), meterBar = $('.parts__meter > i > i');
const clock = new THREE.Clock();
let raf = 0;

function syncLoop() {
  if (!ready || document.hidden || scrollY > endY) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  } else if (!raf) raf = requestAnimationFrame(frame);
}

function frame() {
  raf = 0;
  if (!ready || document.hidden || scrollY > endY) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const y = scrollY;
  const W = innerWidth, H = innerHeight;

  /* появление: полоса света проходит слева направо, потом загораются фары */
  const rt = RM ? 9 : (performance.now() - readyAt) / 1000;
  scene.environmentIntensity = smooth(range(rt, 0.2, 2.4));
  key.intensity = 1.2 * smooth(range(rt, 0.6, 2.4));
  fill.intensity = 0.9 * smooth(range(rt, 0.6, 2.4));
  sweep.intensity = 6 * Math.sin(Math.PI * range(rt, 0.1, 1.9));
  sweep.position.set(-10 + 20 * range(rt, 0.1, 1.9), 3, 4);
  const lightsOn = (S.lights ? 1 : 0.04) * smooth(range(rt, 1.9, 2.5));
  lightK += (lightsOn - lightK) * 0.12;
  lights.forEach((l) => { l.m.emissiveIntensity = l.base * lightK; });

  /* разбор: по прокрутке секции «Разбор» и по кнопке в конфигураторе */
  const pTop = partsEl.offsetTop, pr = clamp((y - pTop) / (partsEl.offsetHeight - H));
  const Es = Math.min(range(pr, 0.04, 0.42), 1 - range(pr, 0.68, 0.96));
  const cfgAnchor = configEl.offsetTop + configEl.offsetHeight / 2 - H / 2;
  const wCfg = range(y, cfgAnchor - H * 0.6, cfgAnchor);
  Ecfg += ((S.explode ? 1 : 0) - Ecfg) * 0.06;
  E += (Math.max(Es, Ecfg * wCfg) - E) * (RM ? 1 : 0.14);
  parts.forEach((p) => { p.o.position.copy(p.base).addScaledVector(p.off, ease(range(E, p.d, p.d + 0.62))); });
  const lk = ease(range(E, 0.45, 1));
  layers.forEach((l) => { l.o.position.copy(l.base).addScaledVector(l.off, lk); });
  shadow.material.opacity = 1 - E * 0.6;
  if (meterB) {
    meterB.textContent = Math.round(Es * 100) + '%';
    meterBar.style.transform = `scaleX(${Es.toFixed(3)})`;
  }

  /* двери и вид из салона — только у конфигуратора */
  doorK += ((S.doors ? 1 : 0) * wCfg - doorK) * 0.08;
  doors.forEach((d) => { d.o.quaternion.copy(d.base).premultiply(qDoor.setFromAxisAngle(d.axis, d.dir * 1.1 * ease(doorK))); });
  inK += ((S.interior ? 1 : 0) * wCfg - inK) * 0.07;
  if (inK < 0.5) { lookYaw *= 0.9; lookPitch *= 0.9; }

  /* тени, отражение, шоурум и свет в салоне */
  catcher.material.opacity = 0.42 * (key.intensity / 1.2) * (1 - inK);
  if (mirror) mirror.visible = inK < 0.3;
  const roomK = smooth(range(inK, 0.05, 0.6));
  room.g.visible = roomK > 0.001;
  room.mats.forEach((m) => { m.opacity = roomK; });
  cabin.intensity = 2.2 * roomK;
  if (dash && inK > 0.3) dash();

  /* поворот: тянуть можно в «Разборе» и конфигураторе, в остальных местах машина возвращается */
  const canSpin = (pr > 0 && pr < 1) || wCfg > 0.5;
  if (!dragging) {
    yawVel *= 0.93;
    yaw += yawVel;
    if (!canSpin) yaw *= 0.92;
  }
  root.rotation.y = yaw * (1 - inK);

  /* камера: ракурс по прокрутке + лёгкий параллакс от мыши на первом экране */
  let P = poseAt(y);
  if (Ecfg * wCfg > 0.001) P = mix(P, { ...pose('parts'), sx: P.sx, sy: P.sy }, ease(Ecfg * wCfg));
  if (inK > 0.001) {
    /* голова водителя; взгляд поворачивается перетаскиванием */
    const head = V(INTERIOR.p), base = V(INTERIOR.t).sub(head);
    const pitch = Math.atan2(base.y, Math.hypot(base.x, base.z)) + lookPitch, len = base.length();
    const look = new THREE.Vector3(Math.sin(lookYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(lookYaw) * Math.cos(pitch)).multiplyScalar(len).add(head);
    /* на телефоне карточка внизу: кадр шире и сдвинут вверх, чтобы лобовое стекло было в свободной половине экрана */
    P = mix(P, { p: head, t: look, fov: narrow ? 80 : INTERIOR.fov, sx: INTERIOR.sx, sy: narrow ? 0.26 : INTERIOR.sy }, ease(inK));
  }
  const heroK = RM ? 0 : 1 - range(y, 0, H * 0.7);
  ptr.x += (pointer.x - ptr.x) * 0.05;
  ptr.y += (pointer.y - ptr.y) * 0.05;
  const k = first || RM ? 1 : Math.min(1, dt * 7);
  cam.p.lerp(P.p, k);
  cam.t.lerp(P.t, k);
  cam.fov += (P.fov - cam.fov) * k;
  cam.sx += (P.sx - cam.sx) * k;
  cam.sy += (P.sy - cam.sy) * k;
  first = false;
  camera.position.copy(cam.p);
  camera.lookAt(cam.t);
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  upV.setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position.addScaledVector(right, ptr.x * 0.55 * heroK).addScaledVector(upV, -ptr.y * 0.22 * heroK);
  camera.lookAt(cam.t);
  camera.fov = cam.fov;
  camera.setViewOffset(W, H, -cam.sx * W, cam.sy * H, W, H);
  camera.updateProjectionMatrix();

  R.render(scene, camera);
  placeLabels(W, H, pr);
  syncLoop();
}

/* подписи: точка у детали, текст — в стороне; подписи одной стороны не налезают друг на друга */
function placeLabels(W, H, pr) {
  const vis = pr > 0 && pr < 1 ? range(E, 0.72, 0.95) : 0;
  if (!vis) {
    if (labels[0] && labels[0].shown) labels.forEach((l) => { l.el.style.opacity = l.dot.style.opacity = l.path.style.opacity = 0; l.shown = false; });
    return;
  }
  const gap = W < 760 ? 30 : 44, top = W < 760 ? 230 : 280;
  /* левые подписи не заходят на заголовок секции */
  const minLeft = W < 760 ? 16 : headRight + 24;
  labels.forEach((l) => { if (W < 760 && !l.mobile) l.el.style.opacity = l.dot.style.opacity = l.path.style.opacity = 0; });
  const pts = labels.filter((l) => W >= 760 || l.mobile).map((l) => {
    proj.copy(l.anchor);
    l.o.localToWorld(proj).project(camera);
    if (!l.w) l.w = l.el.offsetWidth;
    return { l, x: (proj.x * 0.5 + 0.5) * W, y: (-proj.y * 0.5 + 0.5) * H };
  });
  [pts.filter((p) => p.x < W / 2), pts.filter((p) => p.x >= W / 2)].forEach((side, si) => {
    side.sort((a, b) => a.y - b.y);
    side.forEach((p, i) => { p.ly = Math.max(i ? side[i - 1].ly + gap : top, p.y); });
    for (let i = side.length - 2; i >= 0; i--) if (side[i + 1].ly - side[i].ly < gap) side[i].ly = side[i + 1].ly - gap;
    side.forEach(({ l, x, y, ly }) => {
      const lx = si ? Math.min(W - l.w - 16, x + 70) : Math.max(minLeft + l.w + 8, x - 70);
      const a = vis.toFixed(3);
      l.el.style.opacity = l.dot.style.opacity = l.path.style.opacity = a;
      l.dot.style.transform = `translate(${x - 4.5}px, ${y - 4.5}px)`;
      l.el.style.transform = si ? `translate(${lx + 8}px, ${ly - 16}px)` : `translate(${lx - l.w - 8}px, ${ly - 16}px)`;
      l.el.style.textAlign = si ? 'left' : 'right';
      l.path.setAttribute('d', `M${x.toFixed(1)} ${y.toFixed(1)} L${(si ? lx - 20 : lx + 20).toFixed(1)} ${ly.toFixed(1)} L${lx.toFixed(1)} ${ly.toFixed(1)}`);
      l.shown = true;
    });
  });
}

function resize() {
  R.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  narrow = camera.aspect < 0.8;
  buildAnchors();
  labels.forEach((l) => { l.w = 0; });
  const head = $('.parts__head');
  headRight = head ? head.getBoundingClientRect().right : 0;
}
addEventListener('resize', () => { resize(); syncLoop(); });
addEventListener('scroll', syncLoop, { passive: true });
document.addEventListener('visibilitychange', syncLoop);
addEventListener('load', () => ready && buildAnchors());
document.fonts && document.fonts.ready.then(() => ready && buildAnchors());
A.relayout = () => ready && buildAnchors();
resize();
