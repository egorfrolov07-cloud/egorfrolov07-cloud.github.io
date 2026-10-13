/* Canape Club — «3D-кухня»: закуски в разрезе и конструктор канапе в одной сцене Three.js.
   Каждый слой — объёмная форма, на которую сверху натянут его снимок (img/tex-*.webp, сгенерировал Codex);
   рельеф — кунжут, мякиш, лепестки — берётся из яркости того же снимка. Файлов моделей нет.
   Модуль грузится лениво из app.js. Сцена рисуется, только пока секция видна. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- снимки слоёв: цвет, яркость для рельефа и вырез по чёрному фону ---------- */
const PHOTOS = ['rye', 'cream', 'salmon', 'buntop', 'buncut', 'chicken', 'lettuce', 'sauce', 'tartlet', 'mousse', 'onion', 'macaron', 'baguette', 'prosciutto', 'slate'];
const P = {};
function loadPhoto(name) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const n = img.width, c = document.createElement('canvas');
      c.width = c.height = n;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, n, n).data;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const px = (u) => Math.min(n - 1, Math.max(0, Math.round(u * (n - 1))));
      /* u, v — как у текстуры: v = 1 — верх снимка */
      const at = (u, v) => { const i = (px(1 - v) * n + px(u)) * 4; return (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255; };
      const e = 2 / n;  /* сглаживание по соседям, иначе рельеф «ворсистый» */
      const lum = (u, v) => (at(u, v) * 2 + at(u + e, v) + at(u - e, v) + at(u, v + e) + at(u, v - e)) / 6;
      P[name] = { tex, lum, d, n };
      ok();
    };
    img.onerror = () => ok();  /* без снимка сцены не будет, но панель продолжит работать текстом */
    img.src = `img/tex-${name}-512.webp`;
  });
}
/* прозрачность из яркости: чёрный фон вокруг листа, лука, ветчины исчезает */
function cutout(name) {
  const p = P[name];
  if (p.alpha) return p.alpha;
  const c = document.createElement('canvas');
  c.width = c.height = p.n;
  const x = c.getContext('2d'), im = x.createImageData(p.n, p.n);
  for (let i = 0; i < p.d.length; i += 4) {
    const a = smooth(0.04, 0.11, (p.d[i] * 0.2126 + p.d[i + 1] * 0.7152 + p.d[i + 2] * 0.0722) / 255) * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = a; im.data[i + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return (p.alpha = new THREE.CanvasTexture(c));
}

/* ---------- геометрия ---------- */
/* физический материал (дороже компилируется) — только где нужен лак или бархатистость */
const mat = (o) => ('clearcoat' in o || 'sheen' in o ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o));
const mesh = (geo, m, shadow = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = shadow; o.receiveShadow = true; return o; };
const group = (...objs) => { const g = new THREE.Group(); objs.forEach((o) => g.add(o)); return g; };
const noise3 = (x, y, z) => Math.sin(x * 1.7 + z * 2.3) * Math.cos(z * 1.3 - y * 2.1) * 0.5 + Math.sin(x * 4.1 + y * 3.7 + z * 2.9) * 0.25;
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/* снимок сверху ложится на форму «прямо вниз»: u, v по x и z; fit — какую часть кадра занимает предмет */
function planar(geo, R, fit = 1, sideY = -Infinity) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2), s = 2 * R / fit;
  for (let i = 0; i < p.count; i++) {
    const k = p.getY(i) < sideY ? 0.9 : 1;  /* стенки берут цвет чуть внутри края снимка: на самом краю — чёрный фон */
    uv[i * 2] = p.getX(i) * k / s + 0.5; uv[i * 2 + 1] = 0.5 - p.getZ(i) * k / s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
/* швы lathe и кольца склеиваем, иначе после рельефа по шву видна складка */
const weld = (g) => { g.deleteAttribute('normal'); return mergeVertices(g); };
/* рельеф из яркости снимка для вершин выше minY; у края затухает, чтобы не рвать силуэт */
function relief(g, photo, amp, R, minY = -Infinity) {
  const p = P[photo], pos = g.attributes.position, uv = g.attributes.uv;
  if (!p) { g.computeVertexNormals(); return g; }
  let sum = 0, k = 0;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > minY) { sum += p.lum(uv.getX(i), uv.getY(i)); k++; }
  const mean = k ? sum / k : 0.5;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y <= minY) continue;
    const edge = 1 - smooth(0.82, 1, Math.hypot(pos.getX(i), pos.getZ(i)) / R);
    pos.setY(i, y + (p.lum(uv.getX(i), uv.getY(i)) - mean) * amp * edge);
  }
  g.computeVertexNormals();
  return g;
}
/* «пласт»: круглое тело с боковой стенкой side и верхом top(t), t = r / R (0 — центр, 1 — край) */
function slab(photo, { R, side, top = () => 0, amp = 0, fit = 0.96, m = {}, feet = 0 }) {  /* fit < 1: край снимка — смесь с чёрным фоном */
  const pts = [[0, 0], [R * 0.95, 0], [R, side * 0.3], [R, side]];
  for (let i = 1; i <= 40; i++) { const t = 1 - i / 40; pts.push([R * t, side + top(t)]); }
  const g = weld(planar(lathe(pts, 120), R, fit, side * 0.999));
  /* «юбочка» у макаронса: неровный низ стенки */
  if (feet) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y < side * 0.95 && Math.hypot(x, z) > R * 0.9) { const k = 1 + noise3(x * 40, y * 60, z * 40) * feet; pos.setX(i, x * k); pos.setZ(i, z * k); }
    }
  }
  relief(g, photo, amp, R, side * 0.9);
  const tex = P[photo]?.tex;
  return mesh(g, mat({ map: tex, bumpMap: tex, bumpScale: 1.2, roughness: 0.65, ...m }));
}
/* волнистый лист по вырезу снимка: салат, ветчина, горка лука */
function sheet(photo, { R, fit = 1, wave = 0, waves = 7, dome = 0, amp = 0, m = {} }) {
  const ring = new THREE.RingGeometry(0.0001, R, 96, 36);
  ring.rotateX(-Math.PI / 2);
  const g = weld(planar(ring, R, fit));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), t = Math.hypot(x, z) / R, a = Math.atan2(z, x);
    pos.setY(i, Math.sin(a * waves + t * 3) * wave * t * t + dome * (1 - t * t));
  }
  relief(g, photo, amp, R * 2);  /* края листа не гасим: их и так обрезает вырез */
  const tex = P[photo]?.tex;
  return mesh(g, mat({ map: tex, alphaMap: tex && cutout(photo), alphaTest: 0.5, bumpMap: tex, bumpScale: 1, side: THREE.DoubleSide, roughness: 0.5, ...m }), false);
}
const ball = (r, m, sy = 1) => { const g = new THREE.SphereGeometry(r, 48, 32); g.scale(1, sy, 1); g.translate(0, r * sy, 0); return mesh(g, m); };
const dome = (H, pow = 0.6) => (t) => H * (1 - t * t) ** pow;

/* ---------- слои: { obj, h } — тело и высота, на которую ложится следующий слой ---------- */
const L = {
  rye: () => ({ obj: slab('rye', { R: 0.55, side: 0.15, top: dome(0.01), amp: 0.014, m: { roughness: 0.9 } }), h: 0.16 }),
  cream: (R = 0.47) => ({ obj: slab('cream', { R, side: 0.02, top: (t) => 0.06 * (1 - t ** 4), amp: 0.012, m: { roughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') } }), h: 0.08 }),
  salmon: () => ({ obj: slab('salmon', { R: 0.41, side: 0.02, top: dome(0.25, 0.7), amp: 0.07, fit: 0.93, m: { roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 } }), h: 0.27 }),
  baguette: () => {
    const o = slab('baguette', { R: 0.5, side: 0.16, top: dome(0.01), amp: 0.02, m: { roughness: 0.9 } });
    o.scale.set(1.22, 1, 0.84);
    return { obj: o, h: 0.17 };
  },
  ham: () => ({ obj: sheet('prosciutto', { R: 0.5, fit: 0.95, wave: 0.06, waves: 7, dome: 0.05, amp: 0.03, m: { roughness: 0.4, clearcoat: 0.4 } }), h: 0.12 }),
  mozz: () => ({ obj: ball(0.24, mat({ color: '#f6f3ec', roughness: 0.35, sheen: 0.8, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.3 }), 0.92), h: 0.44 }),
  cherry: () => {
    const leaf = new THREE.CircleGeometry(0.07, 5).rotateX(-Math.PI / 2).translate(0, 0.462, 0);
    return { obj: group(ball(0.23, mat({ color: '#c8231c', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 })), mesh(leaf, mat({ color: '#3f7f2c', roughness: 0.5 }))), h: 0.46 };
  },
  olive: () => ({ obj: ball(0.17, mat({ color: '#6f7d22', roughness: 0.2, clearcoat: 0.9 }), 1.3), h: 0.44 }),
  grape: () => ({ obj: ball(0.2, mat({ color: '#7b2350', roughness: 0.25, clearcoat: 0.6, sheen: 0.8, sheenColor: new THREE.Color('#d9a3c6') }), 1.1), h: 0.44 }),
};

function skewerFlag(len, text) {
  const stick = new THREE.CylinderGeometry(0.016, 0.016, len, 8).translate(0, len / 2, 0);
  const fg = new THREE.PlaneGeometry(0.52, 0.29, 12, 1);
  const p = fg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 0.26) * 7) * 0.02);
  fg.translate(0.27, len - 0.16, 0);
  /* бумажный флажок без бликов, у него две стороны: на обороте надпись отражена, чтобы читалась, а не шла зеркально */
  const front = new THREE.MeshBasicMaterial({ side: THREE.FrontSide }), back = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  const s = group(mesh(stick, mat({ color: '#d9b98c', roughness: 0.7 })), mesh(fg, front), mesh(fg, back));
  s.userData.dispose = () => [front, back].forEach((m) => m.map && m.map.dispose());
  s.userData.text = (t) => {
    s.userData.dispose();
    front.map = flagTexture(t);
    back.map = front.map.clone();
    back.map.repeat.x = -1; back.map.offset.x = 1; back.map.needsUpdate = true;
    front.needsUpdate = back.needsUpdate = true;
  };
  s.userData.text(text);
  return s;
}
function flagTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#f3ede4'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 46;
  do { x.font = `700 ${size}px Manrope, system-ui, sans-serif`; size -= 2; } while (x.measureText(text).width > 230 && size > 14);
  x.scale(1, 1.8); x.fillText(text, 128, 128 / 1.8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- закуски из их меню: слои снизу вверх, подписи — из описаний на canapeclub.ru ---------- */
const MAC = ['#ffffff', '#ffd2de', '#ffabc1', '#f58aa8'];  /* «Градиент»: четыре вкуса в одной гамме — оттенки одного снимка */
let macMats = [];
const DISHES = {
  canape: () => [
    { ...L.rye(), name: 'Бородинский тост' },
    { ...L.cream(), name: 'Крем-сыр' },
    { ...L.salmon(), name: 'Розочка из слабосолёного чилийского лосося' },
  ],
  burger: () => {
    const leaf = sheet('lettuce', { R: 0.5, fit: 0.9, wave: 0.045, waves: 9, amp: 0.02, m: { roughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color('#e6ffb0') } });
    leaf.position.y = 0.1;
    const chicken = slab('chicken', { R: 0.4, side: 0.09, top: dome(0.012, 1), amp: 0.014, m: { roughness: 0.55, clearcoat: 0.25 } });
    return [
      { obj: slab('buncut', { R: 0.44, side: 0.1, top: dome(0.004), amp: 0.006, m: { roughness: 0.85 } }), h: 0.1, name: 'Булочка' },
      { obj: slab('sauce', { R: 0.36, side: 0.012, top: dome(0.01, 1), amp: 0.003, m: { roughness: 0.2, clearcoat: 0.9 } }), h: 0.02, name: 'Соус цезарь' },
      { obj: group(chicken, leaf), h: 0.14, name: 'Цыплёнок' },
      { obj: slab('buntop', { R: 0.44, side: 0.03, top: dome(0.3, 0.55), amp: 0.014, m: { roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.3 } }), h: 0.33, name: 'Булочка 3,5–4 см' },
    ];
  },
  tartlet: () => {
    /* песочная корзинка с рифлёным краем: снимок пустой тарталетки сверху ложится и внутрь, и на стенки */
    const cup = weld(planar(lathe([[0, 0], [0.3, 0], [0.4, 0.12], [0.5, 0.26], [0.52, 0.29], [0.47, 0.28], [0.37, 0.15], [0.27, 0.04], [0, 0.04]], 120), 0.52, 0.96));
    const p = cup.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), k = 1 + Math.abs(Math.sin(Math.atan2(z, x) * 12)) * 0.05 * (p.getY(i) / 0.29);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    cup.computeVertexNormals();
    return [
      { obj: mesh(cup, mat({ map: P.tartlet?.tex, bumpMap: P.tartlet?.tex, bumpScale: 1.5, roughness: 0.75 })), h: 0.1, name: 'Рассыпчатая тарталетка' },
      { obj: slab('mousse', { R: 0.37, side: 0.03, top: (t) => 0.34 * (1 - t) ** 0.85, amp: 0.06, m: { roughness: 0.4, clearcoat: 0.2 } }), h: 0.36, name: 'Сливочный мусс из куриной печени' },
      { obj: sheet('onion', { R: 0.24, fit: 0.75, dome: 0.07, amp: 0.05, m: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 } }), h: 0.08, name: 'Красный лук, карамелизованный с мёдом и бальзамическим кремом' },
    ];
  },
  macaron: () => {
    const shellMat = mat({ map: P.macaron?.tex, bumpMap: P.macaron?.tex, bumpScale: 0.6, roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') });
    const shell = () => { const s = slab('macaron', { R: 0.48, side: 0.06, top: dome(0.15, 0.5), amp: 0.004, feet: 0.05 }); s.material = shellMat; return s; };
    const bottom = shell();
    bottom.rotation.x = Math.PI; bottom.position.y = 0.21;  /* в обёртке: высоту слоя задаёт stackUp */
    macMats = [shellMat];
    return [
      { obj: group(bottom), h: 0.21, name: 'Миндальная ракушка' },
      { obj: mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 64, 2).translate(0, 0.05, 0), mat({ color: '#f6e7ea', roughness: 0.4, sheen: 0.5 })), h: 0.1, name: 'Начинка — один из четырёх вкусов' },
      { obj: shell(), h: 0.21, name: 'Миндальная ракушка' },
    ];
  },
};

/* ингредиенты конструктора */
const ING = {
  rye: ['Бородинский тост', L.rye],
  baguette: ['Багет', L.baguette],
  cream: ['Крем-сыр', () => L.cream(0.42)],
  salmon: ['Лосось', L.salmon],
  ham: ['Пармская ветчина', L.ham],
  mozz: ['Моцарелла', L.mozz],
  cherry: ['Черри', L.cherry],
  olive: ['Оливка', L.olive],
  grape: ['Виноград', L.grape],
};
const MAX_STACK = 6;

/* ==========================================================================
   Сцена
   ========================================================================== */
export async function start(root) {
  const stage = $('[data-stage]', root), canvas = $('canvas', stage), labelsEl = $('[data-labels]', stage);
  await Promise.all(PHOTOS.map(loadPhoto));
  /* без WebGL или без всех снимков сцена не рисуется, но панель работает как текст: составы и конструктор списком */
  let renderer = null;
  if (PHOTOS.every((n) => P[n])) try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { /* остаёмся без сцены */ }
  if (!renderer) stage.classList.add('is-fallback');
  const scene = new THREE.Scene();
  const phone = innerWidth < 760;
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environmentIntensity = 0.45;
  }
  /* свет как на снимках: мягкий тёплый сверху слева, он же даёт тень; холодный контровой сзади */
  const key = new THREE.DirectionalLight(0xffe6c8, 2.6);
  key.position.set(-2.5, 6, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(phone ? 512 : 1024, phone ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 1, far: 14 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa9c0ff, 1.1); rim.position.set(3, 3, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x1a120c, 0.35));
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

  /* каменная подставка со снимка */
  const slate = slab('slate', { R: 1, side: 0.07, amp: 0.004, m: { roughness: 0.85 } });
  slate.position.y = -0.07; slate.castShadow = false;
  scene.add(slate);

  /* текущая закуска: слои, шпажка с флажком, разбор на слои */
  const dish = new THREE.Group();
  scene.add(dish);
  let layers = [], skewer = null, mode = 'anatomy', current = 'canape', flagText = 'Canape Club', mac = 0;
  let explode = 0, explodeTo = 0;
  const built = {};

  function clear() {
    dish.clear();
    if (skewer) { skewer.userData.dispose(); skewer = null; }
    layers = [];
  }
  function stackUp(list, drop) {
    let y = 0;
    list.forEach((l, i) => {
      l.baseY = y; y += l.h * 0.94;
      l.obj.position.y = l.baseY;
      if (drop && i === list.length - 1 && !RM) l.fall = 1;  /* новый слой падает сверху */
      dish.add(l.obj);
    });
    layers = list;
    return y;
  }
  function addSkewer(top) {
    if (skewer) { skewer.userData.dispose(); dish.remove(skewer); }
    skewer = skewerFlag(top + 0.45, flagText);
    skewer.position.set(0.04, -0.02, 0.02);
    dish.add(skewer);
  }
  const tintMac = () => macMats.forEach((m) => m.color.set(MAC[mac]));
  function showDish(name) {
    clear();
    current = name;
    built[name] ??= DISHES[name]();
    const top = stackUp(built[name], false);
    if (name !== 'macaron' && name !== 'tartlet') addSkewer(top);
    if (name === 'macaron') tintMac();
    renderList();
    kick();
  }
  /* конструктор: слой строится при добавлении, геометрия освобождается при удалении */
  const stack = [];
  const free = (l) => l.obj.traverse((o) => o.geometry && o.geometry.dispose());
  function showStack(drop) {
    clear();
    const top = stackUp(stack.slice(), drop);
    if (stack.length) addSkewer(top);
    renderList();
    kick();
  }

  /* ---------- текст для людей и скринридеров: состав списком ---------- */
  const list = $('[data-layers]', root), count = $('[data-count]', root);
  function renderList() {
    const items = layers.map((l) => l.name).reverse();
    if (mode === 'build') {
      count.textContent = stack.length ? `Слоёв: ${stack.length} из ${MAX_STACK}` : 'Выберите, с чего начать: обычно с тоста или багета';
      $('[data-stack]', root).innerHTML = items.map((n) => `<li>${n}</li>`).join('');
      $$('[data-ing]', root).forEach((b) => { b.disabled = stack.length >= MAX_STACK; });
    } else list.innerHTML = items.map((n) => `<li>${n}</li>`).join('');
    /* подписи у слоёв на сцене */
    labelsEl.innerHTML = layers.map((l) => `<span class="lbl"><i></i>${l.name}</span>`).join('');
  }

  /* ---------- управление ---------- */
  $$('[data-dish]', root).forEach((b) => b.addEventListener('change', () => { if (b.checked) showDish(b.value); }));
  $('[data-mac]', root).addEventListener('click', () => {
    mac = (mac + 1) % MAC.length;
    if (current !== 'macaron') { $('[data-dish][value=macaron]', root).checked = true; showDish('macaron'); } else { tintMac(); kick(); }
  });
  const explodeBtn = $('[data-explode]', root);
  explodeBtn.addEventListener('click', () => {
    explodeTo = explodeTo ? 0 : 1;
    explodeBtn.setAttribute('aria-pressed', String(!!explodeTo));
    explodeBtn.textContent = explodeTo ? 'Собрать обратно' : 'Разобрать на слои';
    kick();
  });
  $$('[role=tab]', root).forEach((t) => t.addEventListener('click', () => {
    mode = t.dataset.tab;
    $$('[role=tab]', root).forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$('[data-pane]', root).forEach((p) => { p.hidden = p.dataset.pane !== mode; });
    if (mode === 'build') showStack(false); else showDish(current);
  }));
  $$('[data-ing]', root).forEach((b) => b.addEventListener('click', () => {
    if (stack.length >= MAX_STACK) return;
    const [name, make] = ING[b.dataset.ing];
    stack.push({ ...make(), name });
    showStack(true);
  }));
  $('[data-undo]', root).addEventListener('click', () => { const l = stack.pop(); if (l) free(l); showStack(false); });
  $('[data-reset]', root).addEventListener('click', () => { stack.splice(0).forEach(free); showStack(false); });
  /* надпись на флажке: готовые поводы или своя */
  const own = $('[data-flag-own]', root);
  function setFlag(text) {
    flagText = text.trim().slice(0, 18) || 'Canape Club';
    if (skewer) skewer.userData.text(flagText);
    kick();
  }
  $$('[name=flag]', root).forEach((r) => r.addEventListener('change', () => {
    own.hidden = r.value !== '';
    if (r.value) setFlag(r.value); else { own.focus(); setFlag(own.value); }
  }));
  own.addEventListener('input', () => setFlag(own.value));

  /* вращение пальцем или мышью; короткое нажатие разбирает закуску */
  let yaw = -0.5, vel = 0, down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, t: performance.now(), moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x; down.x = e.clientX; down.moved += Math.abs(dx);
    yaw += dx * 0.012; vel = RM ? 0 : dx * 0.012; kick();
  });
  const up = () => { if (down && down.moved < 6 && performance.now() - down.t < 350) explodeBtn.click(); down = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = null; });

  /* ---------- кадр: рисуем, только пока секция на экране ---------- */
  let visible = false, raf = 0, W = 1, H = 1;
  const clock = new THREE.Clock(), v3 = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 2, 6), camLook = new THREE.Vector3(0, 0.4, 0);
  function resize() {
    if (!renderer) return;
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    kick();
  }
  function kick() { if (renderer && visible && !raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(stage);
  new ResizeObserver(resize).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  function frame() {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    let busy = false;
    /* разбор на слои */
    explode += (explodeTo - explode) * (RM ? 1 : 0.14);
    if (Math.abs(explodeTo - explode) > 0.002) busy = true; else explode = explodeTo;
    const gap = mode === 'build' ? 0.26 : 0.34;
    layers.forEach((l, i) => {
      let y = l.baseY + explode * gap * i;
      if (l.fall) { l.fall = Math.max(0, l.fall - dt * 2.6); y += bounce(l.fall) * 1.6; busy = busy || l.fall > 0; }
      l.obj.position.y = y;
      l.obj.rotation.y = explode * (i % 2 ? 0.35 : -0.35);
    });
    if (skewer) skewer.visible = explode < 0.05;  /* разобранные слои шпажка уже не держит */
    /* инерция и медленный автоповорот; с «уменьшить движение» — ничего */
    if (!RM) { vel *= 0.92; yaw += vel + (down ? 0 : dt * 0.25); busy = true; }
    dish.rotation.y = yaw;

    /* камера держит в кадре и собранную, и разобранную закуску */
    const height = layers.reduce((m, l) => Math.max(m, l.baseY + l.h), 0.4) + explode * gap * Math.max(0, layers.length - 1) + (skewer ? 0.45 : 0);
    const fov = (camera.fov * Math.PI) / 180;
    const narrow = W / H < 1;
    const dist = Math.max((height * 0.5 + 0.25) / Math.tan(fov / 2), (0.7 / camera.aspect) / Math.tan(fov / 2)) * (narrow ? 1.1 : 1);
    /* разобранная закуска уходит влево, справа остаётся место для подписей */
    const sx = explode * (narrow ? 0.35 : 0.6);
    camPos.lerp(v3.set(sx, height * 0.5 + dist * 0.38, dist), RM ? 1 : 0.1);
    camLook.lerp(v3.set(sx, height * 0.4, 0), RM ? 1 : 0.1);
    if (camPos.distanceTo(camera.position) > 0.002) busy = true;
    camera.position.copy(camPos); camera.lookAt(camLook);
    renderer.render(scene, camera);

    /* подписи: справа от слоя, видны, когда закуска разобрана */
    const spans = labelsEl.children;
    layers.forEach((l, i) => {
      const s = spans[i]; if (!s) return;
      v3.set(0.55, l.obj.position.y + l.h * 0.5, 0).project(camera);
      s.style.transform = `translate(${((v3.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v3.y * 0.5 + 0.5) * H).toFixed(1)}px)`;
      s.style.opacity = Math.max(0, explode * 1.4 - 0.4).toFixed(2);
    });
    if (busy) raf = requestAnimationFrame(frame);
  }
  const bounce = (t) => { /* t: 1 → 0; высота над местом с отскоком */ const p = 1 - t; return p < 0.7 ? (1 - p / 0.7) ** 2 : Math.sin((p - 0.7) / 0.3 * Math.PI) * 0.08; };

  if (renderer) stage.classList.add('is-3d');
  resize();
  /* закуску и надпись могли выбрать, пока грузился модуль */
  const flagPick = $('[name=flag]:checked', root);
  if (flagPick && flagPick.value) flagText = flagPick.value;
  showDish($('[data-dish]:checked', root).value);
}
