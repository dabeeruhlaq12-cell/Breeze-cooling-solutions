import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 980px)').matches;

function makeRenderer(canvas, alpha) {
  try {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
    return null;
  }
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* A Breeze tower AC: white cabinet, louvred outlet up top, blue line, intake grille below. */
function makeTower(scale = 1) {
  const w = 0.58 * scale, h = 1.9 * scale, d = 0.46 * scale;
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f8fb, roughness: 0.42, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24384c, roughness: 0.6 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xc6d1db, roughness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x0b5cc4, roughness: 0.35, metalness: 0.2 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x35c2ee });

  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.05 * scale), white);
  body.position.y = h / 2 + 0.04 * scale;
  g.add(body);

  const front = d / 2 + 0.004;
  const outletH = h * 0.27;
  const outlet = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, outletH, 0.01), dark);
  outlet.position.set(0, h * 0.8, front);
  g.add(outlet);
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.012 * scale, 0.03 * scale), grey);
    l.position.set(0, h * 0.8 - outletH / 2 + (i + 0.6) * (outletH / 6.2), front + 0.012);
    l.rotation.x = -0.35;
    g.add(l);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.03 * scale, 0.012), blue);
  stripe.position.set(0, h * 0.62, front);
  g.add(stripe);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.22, 0.05 * scale), glow);
  display.position.set(0, h * 0.56, front + 0.002);
  g.add(display);
  const intake = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.24, 0.008), grey);
  intake.position.set(0, h * 0.2, front);
  g.add(intake);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.008 * scale, h * 0.22, 0.012), dark);
    s.position.set(-w * 0.31 + i * (w * 0.62 / 8), h * 0.2, front + 0.006);
    g.add(s);
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.05 * scale, d * 0.92), dark);
  plinth.position.y = 0.025 * scale;
  g.add(plinth);
  g.userData.outletY = h * 0.8;
  g.userData.front = front;
  return g;
}

/* ---------- Hero: aluminium hangar cutaway ---------- */
function hangarScene() {
  const canvas = document.getElementById('hangar');
  const renderer = makeRenderer(canvas, false);
  if (!renderer) return;

  const scene = new THREE.Scene();
  const ink = new THREE.Color(0x0b2238);
  scene.background = ink;
  scene.fog = new THREE.Fog(ink, 22, 46);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const target = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xbfe6ff, 0x0b2238, 0.9));
  const sun = new THREE.DirectionalLight(0xffc27a, 1.6);
  sun.position.set(-8, 12, 6);
  scene.add(sun);
  const coolFill = new THREE.PointLight(0x35c2ee, 6, 14, 1.6);
  coolFill.position.set(0, 2.2, 0);
  scene.add(coolFill);

  const W = 10, E = 3.2, R = 4.5, D = 14;
  const alu = new THREE.MeshStandardMaterial({ color: 0xcfd8e0, metalness: 0.75, roughness: 0.32 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 });

  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x12304d, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x23507a, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);

  const rafterLen = Math.hypot(W / 2, R - E);
  const rafterAng = Math.atan2(R - E, W / 2);
  const frames = 7;
  for (let i = 0; i < frames; i++) {
    const z = -D / 2 + (i * D) / (frames - 1);
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, E, 0.22), alu);
      col.position.set(sx * W / 2, E / 2, z);
      scene.add(col);
      const raf = new THREE.Mesh(new THREE.BoxGeometry(rafterLen, 0.2, 0.14), alu);
      raf.position.set(sx * W / 4, (E + R) / 2, z);
      raf.rotation.z = -sx * rafterAng;
      scene.add(raf);
    }
  }
  for (const [x, y] of [[-W / 2, E], [W / 2, E], [0, R], [-W / 4, (E + R) / 2], [W / 4, (E + R) / 2]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, D), alu);
    p.position.set(x, y, 0);
    scene.add(p);
  }
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * W / 4, (E + R) / 2 + 0.06, 0);
    pivot.rotation.z = -sx * rafterAng;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(rafterLen, D), fabric);
    roof.rotation.x = -Math.PI / 2;
    pivot.add(roof);
    scene.add(pivot);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(D, E), fabric);
    wall.position.set(sx * W / 2, E / 2, 0);
    wall.rotation.y = Math.PI / 2;
    scene.add(wall);
  }
  const gableShape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2, E), new THREE.Vector2(0, R), new THREE.Vector2(-W / 2, E)]);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), fabric);
  back.position.z = -D / 2;
  scene.add(back);

  // Stage and dressed tables, so it reads as a venue
  const stage = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 1.8), new THREE.MeshStandardMaterial({ color: 0x163a5c, roughness: 0.7 }));
  stage.position.set(0, 0.25, -D / 2 + 1.2);
  scene.add(stage);
  const cloth = new THREE.MeshStandardMaterial({ color: 0x8c7f70, roughness: 0.95 });
  const tables = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.38, 0.44, 0.7, 20), cloth, 9);
  let k = 0;
  const m = new THREE.Matrix4();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    m.makeTranslation((c - 1) * 2.2, 0.35, -2.4 + r * 2.6);
    tables.setMatrixAt(k++, m);
  }
  scene.add(tables);

  // Tower ACs along both walls, facing in
  const emitters = [];
  for (const sx of [-1, 1]) for (const z of [-4.6, -1.6, 1.4, 4.4]) {
    const t = makeTower(1);
    t.position.set(sx * (W / 2 - 0.45), 0, z);
    t.rotation.y = sx === -1 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(t);
    emitters.push({ x: sx * (W / 2 - 0.45) - sx * (t.userData.front + 0.05), y: t.userData.outletY, z, dir: -sx });
  }

  // Particles: cold air in, hot air outside
  const tex = dotTexture();
  const cyan = new THREE.Color(0x35c2ee), heat = new THREE.Color(0xf0a23a);
  function makeCloud(n, size) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { geo, n, p: geo.attributes.position.array, c: geo.attributes.color.array, v: new Float32Array(n * 3), age: new Float32Array(n), life: new Float32Array(n) };
  }
  const cold = makeCloud(small ? 600 : 1300, 0.24);
  const hot = makeCloud(small ? 220 : 480, 0.55);

  function spawnCold(i) {
    const e = emitters[(Math.random() * emitters.length) | 0];
    const j = i * 3;
    cold.p[j] = e.x; cold.p[j + 1] = e.y + (Math.random() - 0.5) * 0.4; cold.p[j + 2] = e.z + (Math.random() - 0.5) * 0.4;
    cold.v[j] = e.dir * (1.3 + Math.random() * 0.9);
    cold.v[j + 1] = 0.1 + Math.random() * 0.15;
    cold.v[j + 2] = (Math.random() - 0.5) * 0.7;
    cold.age[i] = 0; cold.life[i] = 2.6 + Math.random() * 1.6;
  }
  function spawnHot(i, anywhere) {
    const j = i * 3;
    let x, z;
    do { x = (Math.random() - 0.5) * 30; z = (Math.random() - 0.5) * 28; } while (Math.abs(x) < W / 2 + 0.8 && Math.abs(z) < D / 2 + 0.8 && Math.random() > 0.08);
    const inside = Math.abs(x) < W / 2 && Math.abs(z) < D / 2;
    hot.p[j] = x; hot.p[j + 1] = inside ? R + 0.4 : (anywhere ? Math.random() * 7 : 0.2); hot.p[j + 2] = z;
    hot.v[j] = (Math.random() - 0.5) * 0.1; hot.v[j + 1] = 0.25 + Math.random() * 0.35; hot.v[j + 2] = (Math.random() - 0.5) * 0.1;
    hot.age[i] = anywhere ? Math.random() * 6 : 0; hot.life[i] = 6 + Math.random() * 4;
  }
  for (let i = 0; i < cold.n; i++) { spawnCold(i); cold.age[i] = Math.random() * cold.life[i]; }
  for (let i = 0; i < hot.n; i++) spawnHot(i, true);

  function step(dt, time) {
    for (let i = 0; i < cold.n; i++) {
      const j = i * 3;
      cold.age[i] += dt;
      if (cold.age[i] > cold.life[i]) spawnCold(i);
      cold.v[j] *= 1 - 0.55 * dt;
      cold.v[j + 1] -= 0.32 * dt; // cold air sinks
      cold.p[j] += cold.v[j] * dt; cold.p[j + 1] += cold.v[j + 1] * dt; cold.p[j + 2] += cold.v[j + 2] * dt;
      if (cold.p[j + 1] < 0.15) { cold.p[j + 1] = 0.15; cold.v[j + 1] = 0; }
      const a = cold.age[i] / cold.life[i];
      const f = Math.min(1, a * 6) * (1 - a) * 1.25;
      cold.c[j] = cyan.r * f; cold.c[j + 1] = cyan.g * f; cold.c[j + 2] = cyan.b * f;
    }
    for (let i = 0; i < hot.n; i++) {
      const j = i * 3;
      hot.age[i] += dt;
      if (hot.age[i] > hot.life[i]) spawnHot(i, false);
      hot.p[j] += (hot.v[j] + Math.sin(time * 0.7 + i) * 0.08) * dt;
      hot.p[j + 1] += hot.v[j + 1] * dt;
      hot.p[j + 2] += hot.v[j + 2] * dt;
      const a = hot.age[i] / hot.life[i];
      const f = Math.sin(Math.PI * a) * 0.42;
      hot.c[j] = heat.r * f; hot.c[j + 1] = heat.g * f; hot.c[j + 2] = heat.b * f;
    }
    cold.geo.attributes.position.needsUpdate = true; cold.geo.attributes.color.needsUpdate = true;
    hot.geo.attributes.position.needsUpdate = true; hot.geo.attributes.color.needsUpdate = true;
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let wide = true;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = w / h > 1.15;
    camera.fov = wide ? 34 : 46;
    // Frame the hangar to the right of the copy on wide screens, above it on narrow ones
    if (wide) camera.setViewOffset(w * 1.5, h, 0, 0, w, h);
    else camera.setViewOffset(w, h * 1.6, 0, h * 0.52, w, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function place(time) {
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    const theta = 0.68 + Math.sin(time * 0.07) * 0.22 + pointer.x * 0.25;
    const radius = wide ? 20 : 23;
    camera.position.set(Math.sin(theta) * radius, 7.2 + pointer.y * 1.4, Math.cos(theta) * radius);
    target.set(0, 1.4, 0);
    camera.lookAt(target);
  }

  let visible = true, last = performance.now(), t = 0;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { last = performance.now(); loop(); } }).observe(canvas);

  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    step(dt, t);
    place(t);
    renderer.render(scene, camera);
  }
  let raf = 0;
  function loop() {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    frame();
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); loop(); } });

  if (reduceMotion) {
    for (let i = 0; i < 90; i++) step(1 / 30, i / 30);
    place(0);
    renderer.render(scene, camera);
    new ResizeObserver(() => { resize(); place(0); renderer.render(scene, camera); }).observe(canvas);
  } else {
    loop();
  }
}

/* ---------- Fleet: 4 ton and 2 ton turntable ---------- */
function unitsScene() {
  const canvas = document.getElementById('units');
  const renderer = makeRenderer(canvas, true);
  if (!renderer) return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.35, 5.2);
  camera.lookAt(0, 0.92, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb7c9, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x35c2ee, 1.2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const shadow = new THREE.MeshBasicMaterial({ color: 0x0b2238, transparent: true, opacity: 0.16, depthWrite: false });
  const big = makeTower(1), little = makeTower(0.8);
  const units = [[big, -0.62], [little, 0.62]];
  for (const [u, x] of units) {
    u.position.x = x;
    scene.add(u);
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), shadow);
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.002, 0);
    scene.add(s);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let angle = -0.5, vel = 0, dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; angle += dx * 0.012; vel = dx * 0.012; draw(); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  function draw() {
    for (const [u] of units) u.rotation.y = angle;
    renderer.render(scene, camera);
  }
  let visible = false, raf = 0, last = performance.now();
  function loop() {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!dragging) { vel *= 0.94; angle += vel + (reduceMotion ? 0 : dt * 0.35); }
    draw();
    raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; last = performance.now(); if (visible) loop(); }, { rootMargin: '100px' }).observe(canvas);
  draw();
}

hangarScene();
unitsScene();
