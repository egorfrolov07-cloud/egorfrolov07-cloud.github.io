/* ==========================================================================
   Слои — 3D-блюда, которые раскладываются на слои при прокрутке (Three.js).
   Блюда собраны из геометрии и процедурных текстур, без внешних моделей.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('.menu3d__stage');
const canvas = document.querySelector('.menu3d__canvas');
const labelsEl = document.querySelector('.menu3d__labels');
const infos = [...document.querySelectorAll('.menu3d .dish')];
const bar = document.querySelector('.menu3d__progress i');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- сцена ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

const key = new THREE.DirectionalLight(0xffe2c0, 2.6);
key.position.set(3.5, 8, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -4, near: 1, far: 20 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004;
key.shadow.radius = 5;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9db6ff, 1.5);
rim.position.set(-5, 4, -4);
scene.add(rim);
const warm = new THREE.PointLight(0xff7a3d, 7, 14, 2);
warm.position.set(-3.2, 1.6, 3);
scene.add(warm);
scene.add(new THREE.HemisphereLight(0xffe9d6, 0x1a120c, 0.35));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.4 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ---------- процедурные текстуры и помощники ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(size, draw, repeat = 1, color = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}
/* пятнистая «съедобная» поверхность: корочка, мякиш, мясо */
const speckle = (base, dots, n, r0, r1) => (x, s) => {
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    x.globalAlpha = rnd(0.2, 0.85);
    x.fillStyle = dots[i % dots.length];
    const r = rnd(r0, r1);
    x.beginPath(); x.ellipse(rnd(0, s), rnd(0, s), r, r * rnd(0.4, 1), rnd(0, 3), 0, 7); x.fill();
  }
  x.globalAlpha = 1;
};
const bump = (n, r0, r1, repeat = 1) => canvasTex(256, (x, s) => {
  x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    x.fillStyle = `rgba(${v},${v},${v},${rnd(0.15, 0.5)})`;
    x.beginPath(); x.arc(rnd(0, s), rnd(0, s), rnd(r0, r1), 0, 7); x.fill();
  }
}, repeat, false);
const mat = (o) => new THREE.MeshPhysicalMaterial(o);
const noise3 = (x, y, z) => Math.sin(x * 1.7 + z * 2.3) * Math.cos(z * 1.3 - y * 2.1) * 0.5
  + Math.sin(x * 4.1 + y * 3.7 + z * 2.9) * 0.25 + Math.sin(x * 9.3 - z * 7.7 + y * 5.1) * 0.12;
function displace(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
function vertexColors(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, col); c.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
function mesh(geo, m, cast = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; return o; }
/* волнистый диск с толщиной: соус, тесто */
function wavyDisc(R, amp, depth, f1 = 7, f2 = 13) {
  const s = new THREE.Shape(), seg = 180;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const r = R * (1 + amp * Math.sin(a * f1) + amp * 0.6 * Math.sin(a * f2 + 1.3));
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.5, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}
/* Сборщик блюда: слои кладутся друг на друга, у каждого — подпись */
function dishBuilder(gap) {
  const group = new THREE.Group(), layers = [];
  let y = 0;
  return {
    group, layers, gap,
    base(obj) { group.add(obj); return obj; },             /* тарелка — не расслаивается */
    push(obj, h, r, name, note, overlap = 0.9) {
      obj.position.y = y;
      group.add(obj);
      layers.push({ obj, baseY: y, h, r, name, note, rot: obj.rotation.y });
      y += h * overlap;
    },
    lift(dy) { y += dy; },
  };
}

/* ==========================================================================
   1. Бургер шефа
   ========================================================================== */
function burger() {
  const d = dishBuilder(0.46);
  const bunMat = mat({
    map: canvasTex(512, speckle('#c27a32', ['#9a571d', '#d9974a', '#e8b064', '#8a4a16'], 1100, 1, 4.5)),
    roughness: 0.48, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#ffd29a'),
    bumpMap: bump(600, 0.6, 2.2, 2), bumpScale: 0.6,
  });
  const crumbMat = mat({
    map: canvasTex(512, speckle('#ecd2a0', ['#d9b57a', '#f7e6c4', '#c99c58'], 2600, 0.6, 2.6)),
    roughness: 0.95, bumpMap: bump(1800, 0.5, 2, 2), bumpScale: 1.4,
  });

  /* нижняя булочка */
  const bb = new THREE.Group();
  const bprof = [[0, 0], [0.88, 0], [0.98, 0.03], [1.04, 0.1], [1.05, 0.17], [1.02, 0.24], [0.96, 0.28], [0.9, 0.29]].map((p) => new THREE.Vector2(p[0], p[1]));
  bb.add(mesh(new THREE.LatheGeometry(bprof, 96), bunMat));
  const crumb = mesh(new THREE.CircleGeometry(0.9, 96), crumbMat, false);
  crumb.rotation.x = -Math.PI / 2; crumb.position.y = 0.289;
  bb.add(crumb);
  d.push(bb, 0.3, 1.05, 'Бриошь с гриля', 'Обжариваем срез на сливочном масле');

  /* соус */
  d.push(mesh(wavyDisc(0.98, 0.035, 0.022, 9, 14), mat({ color: '#e0862a', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 })),
    0.04, 1.0, 'Соус из копчёного перца', 'Томим 6 часов');

  /* салат: волнистое кольцо с цветовым переходом */
  const lg = new THREE.RingGeometry(0.001, 1.15, 200, 10);
  lg.rotateX(-Math.PI / 2);
  displace(lg, (v) => {
    const r = Math.hypot(v.x, v.z), a = Math.atan2(v.z, v.x), k = (r / 1.15) ** 2;
    v.y += (Math.sin(a * 15) * 0.075 + Math.sin(a * 6 + 1) * 0.04) * k + 0.03;
  });
  vertexColors(lg, (v, c) => c.set('#4f8c25').lerp(new THREE.Color('#b9e06a'), Math.min(1, Math.hypot(v.x, v.z) / 1.15)));
  d.push(mesh(lg, mat({ vertexColors: true, roughness: 0.42, side: THREE.DoubleSide, sheen: 0.6, sheenColor: new THREE.Color('#e3ffad'), clearcoat: 0.3 })),
    0.09, 1.15, 'Салат романо', 'Хрустящие листья с фермы');

  /* томаты */
  const tomTop = canvasTex(256, (x, s) => {
    const c = s / 2;
    x.fillStyle = '#c92d22'; x.fillRect(0, 0, s, s);
    x.fillStyle = '#e8563a'; x.beginPath(); x.arc(c, c, s * 0.44, 0, 7); x.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      x.fillStyle = '#ff8a5c'; x.beginPath(); x.ellipse(c + Math.cos(a) * s * 0.24, c + Math.sin(a) * s * 0.24, s * 0.13, s * 0.08, a, 0, 7); x.fill();
      x.fillStyle = '#f7d36a';
      for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(c + Math.cos(a) * s * (0.2 + k * 0.015), c + Math.sin(a) * s * (0.2 + k * 0.012) + rnd(-6, 6), 3, 0, 7); x.fill(); }
    }
    x.fillStyle = '#d63a28'; x.beginPath(); x.arc(c, c, s * 0.08, 0, 7); x.fill();
  });
  const tomSide = mat({ color: '#c42a1f', roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const tomCap = mat({ map: tomTop, roughness: 0.3, clearcoat: 0.7 });
  const tomatoes = new THREE.Group();
  [[-0.4, 0.18, 0.3], [0.42, -0.22, -0.5], [0.05, 0.45, 1.2]].forEach(([x, z, r]) => {
    const t = mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.07, 64), [tomSide, tomCap, tomCap]);
    t.position.set(x, 0.035, z); t.rotation.y = r; tomatoes.add(t);
  });
  d.push(tomatoes, 0.07, 0.9, 'Томаты «бычье сердце»', 'Режем перед подачей');

  /* котлета */
  const pg = new THREE.CylinderGeometry(1.06, 1.03, 0.34, 120, 12);
  displace(pg, (v) => {
    const n = noise3(v.x * 3.2, v.y * 6, v.z * 3.2);
    const r = Math.hypot(v.x, v.z);
    if (r > 0.25) { const k = 1 + n * 0.028; v.x *= k; v.z *= k; }
    v.y += n * (Math.abs(v.y) > 0.16 ? 0.022 : 0.006);
  });
  pg.translate(0, 0.17, 0);
  d.push(mesh(pg, mat({
    map: canvasTex(512, speckle('#4a2717', ['#2a140b', '#6e3c22', '#3a1d10', '#8a5130'], 3200, 0.6, 3.2)),
    roughness: 0.74, bumpMap: bump(2600, 0.6, 2.4, 2), bumpScale: 3, clearcoat: 0.3, clearcoatRoughness: 0.55,
  })), 0.34, 1.06, 'Мраморная говядина, 200 г', 'Медиум, 4 минуты на гриле');

  /* чеддер: квадрат, углы которого стекают */
  const cg = new THREE.BoxGeometry(1.9, 0.04, 1.9, 56, 1, 56);
  displace(cg, (v) => {
    const dd = Math.max(Math.abs(v.x), Math.abs(v.z)), e = Math.max(0, dd - 0.76);
    v.y -= e * e * 2.2 + e * 0.18;
  });
  cg.rotateY(Math.PI / 4); cg.translate(0, 0.03, 0);
  d.push(mesh(cg, mat({ color: '#f2a114', roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.3, emissive: '#5a2a00', emissiveIntensity: 0.14 })),
    0.06, 1.25, 'Чеддер 12 месяцев', 'Плавим под колпаком');

  /* маринованный лук */
  const onion = new THREE.Group();
  const om = mat({ color: '#c96b9c', roughness: 0.28, clearcoat: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#ffd0e6') });
  [[0.25, 0.1, 0.34], [-0.3, -0.2, 0.28], [0.05, -0.42, 0.22], [-0.15, 0.35, 0.18]].forEach(([x, z, r]) => {
    const t = mesh(new THREE.TorusGeometry(r, 0.032, 14, 64), om);
    t.rotation.x = Math.PI / 2 + rnd(-0.12, 0.12); t.position.set(x, 0.035, z); onion.add(t);
  });
  d.push(onion, 0.06, 0.7, 'Маринованный красный лук', 'В свекольном уксусе');

  /* верхняя булочка с кунжутом */
  const top = new THREE.Group();
  const dome = (a) => [1.07 * Math.cos(a) ** 0.62, 0.82 * Math.sin(a) ** 0.95];
  const tprof = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 48; i++) { const [r, y] = dome((i / 48) * (Math.PI / 2)); tprof.push(new THREE.Vector2(Math.max(r, 0.0001), y)); }
  top.add(mesh(new THREE.LatheGeometry(tprof, 128), bunMat));
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.034, 10, 8), mat({ color: '#f6e4bf', roughness: 0.4, clearcoat: 0.4 }), 140);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 140; i++) {
    const a = rnd(0.18, 1.32), th = rnd(0, Math.PI * 2), [r, y] = dome(a);
    dm.position.set(Math.cos(th) * r, y + 0.006, Math.sin(th) * r);
    dm.lookAt(0, -0.9, 0);
    dm.rotateZ(rnd(0, Math.PI));
    dm.scale.set(1, 0.55, 0.32);
    dm.updateMatrix(); seeds.setMatrixAt(i, dm.matrix);
  }
  seeds.castShadow = true;
  top.add(seeds);
  d.push(top, 0.82, 1.07, 'Бриошь на сливочном масле', 'Печём каждое утро');
  return finish(d, -0.4);
}

/* ==========================================================================
   2. Медовик, 12 слоёв — кусок торта на тарелке
   ========================================================================== */
function medovik() {
  const d = dishBuilder(0.27);
  const pprof = [[0, 0], [1.6, 0], [1.9, 0.05], [2.02, 0.11], [1.98, 0.125], [1.7, 0.07], [0, 0.06]].map((p) => new THREE.Vector2(p[0], p[1]));
  d.base(mesh(new THREE.LatheGeometry(pprof, 128), mat({ color: '#f2eee7', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }), false));
  d.lift(0.07);

  const R = 1.65, TH = 0.78;
  const wedge = (h) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(R, 0); s.absarc(0, 0, R, 0, TH, false); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    g.translate(-Math.cos(TH / 2) * R * 0.5, 0, Math.sin(TH / 2) * R * 0.5);
    return g;
  };
  const sponge = mat({
    map: canvasTex(512, speckle('#c98436', ['#a5641f', '#dfa154', '#8a4f18', '#e9b46a'], 2600, 0.5, 2.4), 2),
    roughness: 0.85, bumpMap: bump(2200, 0.4, 1.6, 3), bumpScale: 2.2,
  });
  const cream = mat({ color: '#eedbb8', roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color('#fff8ea'), clearcoat: 0.2 });
  const crumbTop = mat({
    map: canvasTex(512, speckle('#b9763a', ['#8e5420', '#d39a55', '#f0c68a', '#6e3c12'], 3800, 0.6, 2.8), 2),
    roughness: 0.95, bumpMap: bump(3000, 0.6, 2.4, 3), bumpScale: 4,
  });
  for (let i = 0; i < 6; i++) {
    d.push(mesh(wedge(0.13), sponge), 0.13, 1.1, i === 0 ? '6 коржей на гречишном мёде' : null, 'Раскатываем вручную, 2 мм', 1);
    if (i < 5) d.push(mesh(wedge(0.05), cream), 0.05, 1.1, i === 0 ? 'Крем на сметане 30%' : null, 'Пропитывает коржи сутки', 1);
  }
  d.push(mesh(wedge(0.06), crumbTop), 0.06, 1.1, 'Медовая крошка', 'Из обжаренных коржей', 1);

  /* малина, мята и сусальное золото */
  const deco = new THREE.Group();
  const berryMat = mat({ color: '#a3122e', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: new THREE.Color('#ff7a8f') });
  [[0.1, 0.05], [0.32, -0.06], [-0.14, -0.08]].forEach(([x, z]) => {
    const g = new THREE.IcosahedronGeometry(0.1, 4);
    displace(g, (v) => { const k = 1 + Math.abs(Math.sin(v.x * 60) * Math.sin(v.y * 60) * Math.sin(v.z * 60)) * 0.12; v.multiplyScalar(k); });
    g.scale(1, 1.15, 1);
    const b = mesh(g, berryMat); b.position.set(x, 0.1, z); deco.add(b);
  });
  const goldG = new THREE.PlaneGeometry(0.26, 0.18, 10, 8);
  displace(goldG, (v) => { v.z += Math.sin(v.x * 30) * 0.012 + Math.cos(v.y * 40) * 0.01; });
  const gold = mesh(goldG, mat({ color: '#e0b347', metalness: 1, roughness: 0.22, side: THREE.DoubleSide }));
  gold.rotation.set(-1.2, 0.3, 0.4); gold.position.set(-0.05, 0.23, 0.12); deco.add(gold);
  const mint = mesh(new THREE.SphereGeometry(0.09, 16, 8), mat({ color: '#4f8f2f', roughness: 0.5, sheen: 0.5 }));
  mint.scale.set(1, 0.12, 0.55); mint.rotation.set(0.3, 0.8, 0.2); mint.position.set(0.22, 0.19, 0.06); deco.add(mint);
  d.push(deco, 0.2, 0.6, 'Малина и сусальное золото', 'Последний слой');
  return finish(d, 0.55);
}

/* ==========================================================================
   3. Тартар-башня
   ========================================================================== */
function tartare() {
  const d = dishBuilder(0.5);
  const pprof = [[0, 0], [1.75, 0], [1.95, 0.07], [1.98, 0.11], [1.72, 0.08], [0, 0.07]].map((p) => new THREE.Vector2(p[0], p[1]));
  d.base(mesh(new THREE.LatheGeometry(pprof, 128), mat({
    map: canvasTex(512, speckle('#2b2724', ['#3a3531', '#1d1a18', '#45403b'], 2600, 0.6, 2.4), 2), roughness: 0.88,
  }), false));
  /* капли соуса на тарелке */
  const dotMat = mat({ color: '#5a1d14', roughness: 0.12, clearcoat: 1 });
  [[1.15, 0.3], [1.3, -0.25], [-1.2, 0.5], [-0.9, -0.95], [0.4, 1.25]].forEach(([x, z], i) => {
    const s = mesh(new THREE.SphereGeometry(0.07 + i * 0.012, 20, 12), dotMat);
    s.scale.y = 0.3; s.position.set(x, 0.08, z); d.base(s);
  });
  d.lift(0.08);

  d.push(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 72).translate(0, 0.06, 0), mat({
    map: canvasTex(512, speckle('#d8a256', ['#b77e33', '#ecc485', '#9a6424'], 2200, 0.6, 2.6)), roughness: 0.9,
    bumpMap: bump(1600, 0.5, 2, 2), bumpScale: 2,
  })), 0.12, 0.8, 'Тост на закваске', 'Подсушиваем на углях');

  const ag = new THREE.CylinderGeometry(0.76, 0.77, 0.22, 72, 6);
  displace(ag, (v) => { const n = noise3(v.x * 5, v.y * 8, v.z * 5); const k = 1 + n * 0.02; v.x *= k; v.z *= k; });
  ag.translate(0, 0.11, 0);
  vertexColors(ag, (v, c) => c.set('#6e9a33').lerp(new THREE.Color('#b9d66a'), Math.min(1, Math.hypot(v.x, v.z) / 0.77) * 0.6 + (v.y / 0.22) * 0.4));
  d.push(mesh(ag, mat({ vertexColors: true, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 })), 0.22, 0.78, 'Авокадо с лаймом и чили', 'Мнём вилкой перед подачей');

  const tg = new THREE.CylinderGeometry(0.75, 0.77, 0.38, 80, 14);
  displace(tg, (v) => {
    const n = Math.round(noise3(v.x * 7, v.y * 9, v.z * 7) * 3) / 3;
    const r = Math.hypot(v.x, v.z);
    if (r > 0.2) { const k = 1 + n * 0.045; v.x *= k; v.z *= k; }
    if (v.y > 0.15) v.y += n * 0.035;
  });
  tg.translate(0, 0.19, 0);
  d.push(mesh(tg, mat({
    map: canvasTex(512, speckle('#8c1c1c', ['#b33a2c', '#5e0f12', '#e7c3ab', '#a0241f'], 2800, 0.8, 3.6)),
    roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, bumpMap: bump(1500, 0.8, 3, 2), bumpScale: 2.5,
  })), 0.38, 0.8, 'Вырезка, рубленная ножом', 'Дижонская горчица, оливковое масло');

  /* каперсы и шалот */
  const gar = new THREE.Group();
  const cap = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), mat({ color: '#6b7a2a', roughness: 0.4, clearcoat: 0.5 }), 22);
  const sha = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), mat({ color: '#efe3c7', roughness: 0.3, clearcoat: 0.5 }), 26);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 0.62;
    dm.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r); dm.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); dm.updateMatrix();
    if (i < 22) cap.setMatrixAt(i, dm.matrix);
    sha.setMatrixAt(i, dm.matrix);
  }
  cap.castShadow = sha.castShadow = true;
  gar.add(cap, sha);
  d.push(gar, 0.05, 0.65, 'Каперсы и шалот', 'Режем мелким кубом');

  const yg = new THREE.SphereGeometry(0.28, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  yg.scale(1, 0.78, 1);
  d.push(mesh(yg, mat({ color: '#ffa31a', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, emissive: '#6a2c00', emissiveIntensity: 0.25, sheen: 0.4 })),
    0.22, 0.3, 'Желток, томлённый в масле', '62 °C, 40 минут');

  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 12, 6), mat({ color: '#7fb83a', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#dfffa0'), side: THREE.DoubleSide }), 26);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(0.3, 0.62);
    dm.position.set(Math.cos(a) * r, rnd(0.02, 0.1), Math.sin(a) * r);
    dm.rotation.set(rnd(-0.6, 0.6), -a, rnd(-0.5, 0.5));
    dm.scale.set(1, 0.12, 0.5); dm.updateMatrix(); leaves.setMatrixAt(i, dm.matrix);
  }
  leaves.castShadow = true;
  d.push(leaves, 0.1, 0.62, 'Микрозелень', 'Кресс и амарант');
  return finish(d, -0.2);
}

function finish(d, baseRot) {
  d.height = d.layers.reduce((m, l) => Math.max(m, l.baseY + l.h), 0);
  d.baseRot = baseRot;
  d.group.rotation.y = baseRot;
  d.group.visible = false;
  scene.add(d.group);
  return d;
}

const dishes = [burger(), medovik(), tartare()];

/* ---------- подписи слоёв: точка на слое, ломаная линия, текст в колонке ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
const lines = document.createElementNS(SVGNS, 'svg');
lines.setAttribute('class', 'menu3d__lines');
labelsEl.appendChild(lines);
dishes.forEach((d) => {
  d.labels = d.layers.filter((l) => l.name).map((l) => {
    const dot = document.createElement('i'); dot.className = 'lbl__dot';
    const el = document.createElement('div'); el.className = 'lbl';
    el.innerHTML = `<b>${l.name}</b><small>${l.note || ''}</small>`;
    const path = document.createElementNS(SVGNS, 'path');
    lines.appendChild(path); labelsEl.append(dot, el);
    return { l, el, dot, path };
  });
});

/* ---------- прокрутка → состояние ---------- */
let target = 0, prog = 0, visible = false, W = 1, H = 1;
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);           /* smootherstep */
const range = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));

if (window.gsap && window.ScrollTrigger) {
  ScrollTrigger.create({
    trigger: '.menu3d', start: 'top top', end: 'bottom bottom',
    onUpdate: (s) => { target = s.progress; },
  });
  ScrollTrigger.create({
    trigger: '.menu3d', start: 'top bottom', end: 'bottom top',
    onToggle: (s) => { visible = s.isActive; },
  });
} else { visible = true; target = 0.2; }

/* перетаскивание — поворот блюда с инерцией */
let drag = 0, dragVel = 0, down = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { down = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!down) return; dragVel = (e.clientX - lastX) * 0.012; lastX = e.clientX; });
canvas.addEventListener('pointerup', () => { down = false; });
canvas.addEventListener('pointercancel', () => { down = false; });

function resize() {
  W = stage.clientWidth; H = stage.clientHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);

const camPos = new THREE.Vector3(0, 3, 9), camLook = new THREE.Vector3(0, 0.6, 0);
const v3 = new THREE.Vector3(), clock = new THREE.Clock();
let active = -1;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!visible) return;
  prog += (target - prog) * (RM ? 1 : 0.12);
  const P = Math.min(0.9999, Math.max(0, prog));
  const seg = Math.min(2, Math.floor(P * 3));
  const lp = P * 3 - seg;
  const d = dishes[seg];

  /* какое блюдо активно */
  if (seg !== active) {
    dishes.forEach((x, i) => { x.group.visible = i === seg; x.labels.forEach((lb) => { lb.el.style.opacity = lb.dot.style.opacity = lb.path.style.opacity = 0; }); });
    infos.forEach((el, i) => el.classList.toggle('is-on', i === seg));
    active = seg;
  }

  /* расслоение: собрано → раскрыто → снова собрано и уходит */
  const last = seg === 2;
  const e = ease(range(lp, 0.14, 0.5)) * (last ? 1 : 1 - ease(range(lp, 0.72, 0.9)));
  const sIn = seg === 0 ? 1 : ease(range(lp, 0, 0.12));
  const sOut = last ? 1 : 1 - ease(range(lp, 0.9, 1));
  const s = Math.max(0.0001, Math.min(sIn, sOut));

  dragVel *= 0.94; drag += dragVel;
  const spin = (RM ? 0 : clock.elapsedTime * 0.12) + lp * 1.4 + drag + (1 - sIn) * 2.2;
  d.layers.forEach((l, i) => {
    l.obj.position.y = l.baseY + e * d.gap * i;
    l.obj.rotation.y = l.rot + e * (i % 2 ? 0.32 : -0.32) * Math.min(1, i / 3);
  });
  d.group.rotation.y = d.baseRot + spin;
  d.group.scale.setScalar(s);
  /* узкая раскладка — телефон и любой портретный экран (планшет): блюдо слева, подписи колонкой справа */
  const phone = W < 760, narrow = phone || W / H < 0.9;
  d.group.position.x = narrow ? -0.55 : 0.85;

  /* камера отъезжает, чтобы раскрытое блюдо помещалось в кадр */
  const span = d.height + e * d.gap * (d.layers.length - 1);
  const cy = span * 0.5;
  const fov = (camera.fov * Math.PI) / 180;
  /* на телефоне блюдо занимает левую половину кадра, справа остаётся колонка подписей */
  const byH = (span * 0.5 + 0.8) / Math.tan(fov / 2) / (phone ? 0.46 : narrow ? 0.56 : 0.52);
  const byW = narrow ? (3.1 / camera.aspect) / Math.tan(fov / 2) : (2.8 / camera.aspect) / Math.tan(fov / 2) / 0.62;
  const dist = Math.max(byH, byW, 7.5);
  camPos.lerp(v3.set(narrow ? 0.45 : 0.35, cy + dist * 0.2, dist), 0.08);
  camLook.lerp(v3.set(narrow ? 0.45 : 0.35, cy * (phone ? 1.2 : narrow ? 1.0 : 1.12) + 0.15, 0), 0.08);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  renderer.render(scene, camera);

  /* подписи: точка у края слоя; подписи раздвигаются, чтобы не налезать друг на друга */
  const colX = narrow ? W * 0.6 : W * 0.74, minGap = phone ? 36 : narrow ? 54 : 46, knee = narrow ? 16 : 34;
  const pts = d.labels.map((lb, k) => {
    const l = lb.l;
    v3.set(d.group.position.x + l.r * 0.92 * s, (l.obj.position.y + l.h * 0.5) * s, 0).project(camera);
    return { lb, k, x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
  }).sort((p, q) => p.y - q.y);
  pts.forEach((p, i) => { p.ly = i ? Math.max(p.y, pts[i - 1].ly + minGap) : p.y; });
  for (let i = pts.length - 2; i >= 0; i--) if (pts[i + 1].ly - pts[i].ly < minGap) pts[i].ly = pts[i + 1].ly - minGap;
  pts.forEach(({ lb, k, x, y, ly }) => {
    const a = (ease(range(e, 0.35 + k * 0.07, 0.6 + k * 0.07)) * s).toFixed(3);
    lb.dot.style.opacity = lb.el.style.opacity = lb.path.style.opacity = a;
    lb.dot.style.transform = `translate(${x - 4.5}px, ${y - 4.5}px)`;
    lb.el.style.transform = narrow ? `translate(${colX + 10}px, ${ly}px) translateY(-50%)` : `translate(${colX + 12}px, ${ly - 13}px)`;
    lb.path.setAttribute('d', `M${x.toFixed(1)} ${y.toFixed(1)} L${(colX - knee).toFixed(1)} ${ly.toFixed(1)} L${colX.toFixed(1)} ${ly.toFixed(1)}`);
  });

  if (bar) bar.style.transform = `scaleX(${P.toFixed(4)})`;
}
requestAnimationFrame(frame);
