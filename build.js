import { HANGAR, UNITS_PER_SIDE, createScene } from './structure.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Scroll-driven cooling study (same pattern as the GSE build) ---------- */
function coolingStudy() {
  const section = document.getElementById('study');
  const canvas = document.getElementById('studyCanvas');
  if (!section || !canvas) return;
  const steps = [...section.querySelectorAll('.build__step')];
  const froms = steps.map((s) => parseFloat(s.dataset.from));
  const bars = steps.map((s) => s.querySelector('.build__bar span'));
  const label = section.querySelector('.build__dim');

  let scene = null, raf = 0, visible = false;
  let cur = reduced ? 1 : 0, target = cur, px = 0, py = 0, tpx = 0, tpy = 0;

  const readScroll = () => {
    if (reduced) return 1;
    const r = section.getBoundingClientRect();
    const header = document.querySelector('.top')?.offsetHeight || 0;
    const stageH = innerHeight - header;
    return clamp01(clamp01((header - r.top) / Math.max(1, r.height - stageH)) / 0.88);
  };

  const paintSteps = (t) => {
    let active = 0;
    froms.forEach((f, i) => { if (t >= f) active = i; });
    steps.forEach((el, i) => {
      el.classList.toggle('is-done', i < active);
      el.classList.toggle('is-active', i === active);
      const end = i < froms.length - 1 ? froms[i + 1] : 1;
      bars[i].style.transform = `scaleX(${i < active ? 1 : i === active ? clamp01((t - froms[i]) / (end - froms[i])) : 0})`;
    });
    if (label && scene) {
      const p = scene.project([HANGAR.length / 2, 0, HANGAR.span / 2 + 2.6]);
      const o = clamp01((t - 0.02) / 0.04) * (1 - clamp01((t - 0.4) / 0.06));
      label.style.opacity = p ? String(o) : '0';
      if (p) label.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  };

  const frame = () => {
    raf = 0;
    if (!scene) return;
    target = readScroll();
    cur += (target - cur) * 0.14;
    px += (tpx - px) * 0.08; py += (tpy - py) * 0.08;
    if (Math.abs(target - cur) < 0.0005) cur = target;
    scene.set({ t: cur, px, py });
    paintSteps(cur);
    const moving = cur !== target || Math.abs(tpx - px) > 0.001 || Math.abs(tpy - py) > 0.001;
    if (visible && moving) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && visible && scene) raf = requestAnimationFrame(frame); };

  const start = () => {
    if (scene) return;
    scene = createScene(canvas, { mode: 'hangar', shift: matchMedia('(min-width: 1000px)').matches ? 0.26 : 0 });
    if (!scene) { section.classList.add('build--static'); return; }
    cur = target = readScroll();
    scene.set({ t: cur });
    paintSteps(cur);
    kick();
  };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { start(); kick(); } }, { rootMargin: '60% 0px 60% 0px' }).observe(section);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { if (scene) { scene.render(); paintSteps(cur); } });
  if (!reduced) section.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tpx = (e.clientX / innerWidth) * 2 - 1; tpy = (e.clientY / innerHeight) * 2 - 1; kick();
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); section.classList.add('build--static'); });
}

/* ---------- Product study: 4 TR and 2 TR towers with a condenser ---------- */
function productStudy() {
  const canvas = document.getElementById('unitsCanvas');
  if (!canvas) return;
  const scene = createScene(canvas, { mode: 'units' });
  if (!scene) { canvas.closest('figure')?.classList.add('product--static'); return; }
  let az = -62, vel = 0, dragging = false, lx = 0, visible = false, raf = 0, last = performance.now();
  const draw = () => scene.set({ az });
  const loop = () => {
    raf = 0;
    if (!visible) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!dragging) { vel *= 0.93; az += vel + (reduced ? 0 : dt * 6); }
    draw();
    raf = requestAnimationFrame(loop);
  };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lx; lx = e.clientX; az -= dx * 0.35; vel = -dx * 0.35; if (reduced) draw(); });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
  addEventListener('resize', draw);
  draw();
}

coolingStudy();
productStudy();
export { UNITS_PER_SIDE };
