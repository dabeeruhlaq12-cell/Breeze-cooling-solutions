import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf3f5f7, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4 });
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

/* ---------- Plan section: realistic hangar cutaway ---------- */
function mistMaterial(color, size, tex) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, size: { value: size }, map: { value: tex } },
    vertexShader: `attribute float alpha; varying float vA; uniform float size;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform sampler2D map; varying float vA;
      void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.003) discard; gl_FragColor = vec4(color, a); }`,
    transparent: true, depthWrite: false,
  });
}

function hangarScene() {
  const canvas = document.getElementById('hangar');
  if (!canvas) return;
  const renderer = makeRenderer(canvas, true);
  if (!renderer) return;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.Fog(0xd3cbbd, 30, 70);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const target = new THREE.Vector3(0, 1.3, 0);

  scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x8a7d6a, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sun.position.set(-9, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  scene.add(sun);

  const W = 10, E = 3.4, R = 4.6, D = 14;
  const alu = new THREE.MeshStandardMaterial({ color: 0xe4e8eb, metalness: 0.55, roughness: 0.32 });
  const pvc = new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.75, side: THREE.DoubleSide });
  const valance = new THREE.MeshStandardMaterial({ color: 0x0b5cc4, roughness: 0.7, side: THREE.DoubleSide });

  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0xbdb3a1, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.06, D - 0.2), new THREE.MeshStandardMaterial({ color: 0x7c2431, roughness: 0.96 }));
  carpet.position.y = 0.03;
  carpet.receiveShadow = true;
  scene.add(carpet);

  const add = (mesh, cast = true) => { mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  const rafterLen = Math.hypot(W / 2, R - E);
  const rafterAng = Math.atan2(R - E, W / 2);
  const frames = 7;
  for (let i = 0; i < frames; i++) {
    const z = -D / 2 + (i * D) / (frames - 1);
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, E, 0.3), alu)).position.set(sx * W / 2, E / 2, z);
      const raf = add(new THREE.Mesh(new THREE.BoxGeometry(rafterLen, 0.3, 0.16), alu));
      raf.position.set(sx * W / 4, (E + R) / 2, z);
      raf.rotation.z = -sx * rafterAng;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), alu)).position.set(sx * W / 2, 0.03, z);
    }
  }
  for (const [x, y] of [[-W / 2, E], [W / 2, E], [0, R], [-W / 4, (E + R) / 2], [W / 4, (E + R) / 2]]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, D), alu)).position.set(x, y, 0);
  }
  // Cutaway: keep the far roof slope, far wall and back gable; the near side is opened up
  const pivot = new THREE.Group();
  pivot.position.set(-W / 4, (E + R) / 2 + 0.16, 0);
  pivot.rotation.z = rafterAng;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(rafterLen + 0.1, D + 0.3), pvc);
  roof.rotation.x = -Math.PI / 2;
  roof.castShadow = true; roof.receiveShadow = true;
  pivot.add(roof);
  scene.add(pivot);
  const farWall = add(new THREE.Mesh(new THREE.PlaneGeometry(D, E), pvc));
  farWall.position.set(-W / 2 - 0.1, E / 2, 0);
  farWall.rotation.y = Math.PI / 2;
  const gable = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2, E), new THREE.Vector2(0, R), new THREE.Vector2(-W / 2, E)]);
  add(new THREE.Mesh(new THREE.ShapeGeometry(gable), pvc)).position.z = -D / 2 - 0.1;

  for (const sx of [-1]) {
    const band = add(new THREE.Mesh(new THREE.PlaneGeometry(D + 0.3, 0.45), valance), false);
    band.position.set(sx * (W / 2 + 0.12), E - 0.12, 0);
    band.rotation.y = Math.PI / 2;
  }

  // Stage with backdrop
  add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.6, 1.8), new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.6 }))).position.set(0, 0.3, -D / 2 + 1.1);
  add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.4, 0.1), new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.9 }))).position.set(0, 1.8, -D / 2 + 0.25);

  // Round banquet tables with chairs
  const cloth = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.92 });
  const rattan = new THREE.MeshStandardMaterial({ color: 0xb8975f, roughness: 0.7 });
  const spots = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) spots.push([(c - 1) * 2.5, -2.6 + r * 2.9]);
  const tableGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.76, 28);
  const tables = new THREE.InstancedMesh(tableGeo, cloth, spots.length);
  const seatGeo = new THREE.BoxGeometry(0.42, 0.05, 0.42), backGeo = new THREE.BoxGeometry(0.42, 0.5, 0.05), legGeo = new THREE.BoxGeometry(0.38, 0.45, 0.36);
  const n = spots.length * 8;
  const seats = new THREE.InstancedMesh(seatGeo, rattan, n), backs = new THREE.InstancedMesh(backGeo, rattan, n), legs = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x8f744a, roughness: 0.8, transparent: true, opacity: 0.35 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  spots.forEach(([x, z], i) => {
    tables.setMatrixAt(i, m.makeTranslation(x, 0.44, z));
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      q.setFromAxisAngle(up, -a + Math.PI / 2);
      const cx = x + Math.cos(a) * 1.05, cz = z + Math.sin(a) * 1.05;
      seats.setMatrixAt(k, m.compose(p.set(cx, 0.5, cz), q, one));
      legs.setMatrixAt(k, m.compose(p.set(cx, 0.28, cz), q, one));
      const bx = x + Math.cos(a) * 1.27, bz = z + Math.sin(a) * 1.27;
      backs.setMatrixAt(k, m.compose(p.set(bx, 0.78, bz), q, one));
      k++;
    }
  });
  for (const im of [tables, seats, backs, legs]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // Tower ACs along both long sides, facing in
  const emitters = [];
  for (const sx of [-1, 1]) for (const z of [-4.4, -1.4, 1.6, 4.6]) {
    const t = makeTower(1);
    t.position.set(sx * (W / 2 - 0.55), 0.06, z);
    t.rotation.y = sx === -1 ? Math.PI / 2 : -Math.PI / 2;
    t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(t);
    emitters.push({ x: sx * (W / 2 - 0.55) - sx * (t.userData.front + 0.05), y: t.userData.outletY + 0.06, z, dir: -sx });
  }

  // Cold air: soft mist that throws across and settles low. Heat: faint shimmer above the roof.
  const tex = dotTexture();
  function cloud(count, color, size) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(count), 1));
    const pts = new THREE.Points(geo, mistMaterial(color, size, tex));
    pts.frustumCulled = false;
    scene.add(pts);
    return { geo, count, p: geo.attributes.position.array, al: geo.attributes.alpha.array, v: new Float32Array(count * 3), age: new Float32Array(count), life: new Float32Array(count) };
  }
  const cold = cloud(small ? 500 : 1000, 0x4fb8e6, 0.6);
  const hot = cloud(small ? 60 : 120, 0xffb466, 2.6);
  const spawnCold = (i) => {
    const e = emitters[(Math.random() * emitters.length) | 0], j = i * 3;
    cold.p[j] = e.x; cold.p[j + 1] = e.y + (Math.random() - 0.5) * 0.35; cold.p[j + 2] = e.z + (Math.random() - 0.5) * 0.35;
    cold.v[j] = e.dir * (1.4 + Math.random() * 0.8); cold.v[j + 1] = 0.05 + Math.random() * 0.1; cold.v[j + 2] = (Math.random() - 0.5) * 0.8;
    cold.age[i] = 0; cold.life[i] = 3 + Math.random() * 1.8;
  };
  const spawnHot = (i) => {
    const j = i * 3;
    hot.p[j] = -W / 2 + Math.random() * W * 0.55; hot.p[j + 1] = R + 0.3; hot.p[j + 2] = (Math.random() - 0.5) * D;
    hot.v[j] = (Math.random() - 0.5) * 0.08; hot.v[j + 1] = 0.25 + Math.random() * 0.3; hot.v[j + 2] = (Math.random() - 0.5) * 0.08;
    hot.age[i] = 0; hot.life[i] = 5 + Math.random() * 4;
  };
  for (let i = 0; i < cold.count; i++) { spawnCold(i); cold.age[i] = Math.random() * cold.life[i]; }
  for (let i = 0; i < hot.count; i++) { spawnHot(i); hot.age[i] = Math.random() * hot.life[i]; }

  function step(dt) {
    for (let i = 0; i < cold.count; i++) {
      const j = i * 3;
      cold.age[i] += dt;
      if (cold.age[i] > cold.life[i]) spawnCold(i);
      cold.v[j] *= 1 - 0.6 * dt; cold.v[j + 2] *= 1 - 0.3 * dt;
      cold.v[j + 1] -= 0.38 * dt;
      cold.p[j] += cold.v[j] * dt; cold.p[j + 1] += cold.v[j + 1] * dt; cold.p[j + 2] += cold.v[j + 2] * dt;
      if (cold.p[j + 1] < 0.35) { cold.p[j + 1] = 0.35; cold.v[j + 1] = 0; }
      const a = cold.age[i] / cold.life[i];
      cold.al[i] = Math.min(1, a * 5) * (1 - a) * 0.5;
    }
    for (let i = 0; i < hot.count; i++) {
      const j = i * 3;
      hot.age[i] += dt;
      if (hot.age[i] > hot.life[i]) spawnHot(i);
      hot.p[j] += hot.v[j] * dt; hot.p[j + 1] += hot.v[j + 1] * dt; hot.p[j + 2] += hot.v[j + 2] * dt;
      hot.al[i] = Math.sin(Math.PI * hot.age[i] / hot.life[i]) * 0.07;
    }
    cold.geo.attributes.position.needsUpdate = true; cold.geo.attributes.alpha.needsUpdate = true;
    hot.geo.attributes.position.needsUpdate = true; hot.geo.attributes.alpha.needsUpdate = true;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Gentle auto orbit; drag to look around
  let theta = 0.7, pitch = 0.26, vel = 0, dragging = false, lx = 0, ly = 0, idle = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    vel = dx * 0.006; theta += vel; pitch = Math.min(0.75, Math.max(0.12, pitch + dy * 0.004)); idle = 0;
    if (reduceMotion) draw();
  });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  function place() {
    theta = Math.min(1.35, Math.max(0.05, theta));
    const radius = 12.5 + 11 / Math.max(camera.aspect, 0.5);
    camera.position.set(Math.sin(theta) * Math.cos(pitch) * radius, Math.sin(pitch) * radius + 1.3, Math.cos(theta) * Math.cos(pitch) * radius);
    camera.lookAt(target);
  }
  function draw() { place(); renderer.render(scene, camera); }

  let visible = false, raf = 0, last = performance.now(), t = 0;
  function loop() {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    step(dt);
    if (!dragging) { vel *= 0.92; theta += vel; idle += dt; if (idle > 2) theta = theta + Math.sin(t * 0.12) * 0.0009; }
    draw();
    raf = requestAnimationFrame(loop);
  }
  if (reduceMotion) {
    for (let i = 0; i < 120; i++) step(1 / 30);
    draw();
    new ResizeObserver(() => draw()).observe(canvas);
  } else {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; last = performance.now(); if (visible) loop(); }, { rootMargin: '150px' }).observe(canvas);
    document.addEventListener('visibilitychange', () => { last = performance.now(); loop(); });
    draw();
  }
}

/* ---------- Fleet: 4 ton and 2 ton turntable ---------- */
function unitsScene() {
  const canvas = document.getElementById('units');
  const renderer = makeRenderer(canvas, true);
  if (!renderer) return;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.25, 6.4);
  camera.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb7c9, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
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
