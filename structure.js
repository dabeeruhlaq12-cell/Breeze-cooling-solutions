/*
 * Breeze cooling study — dependency-free WebGL scene.
 * Adapted from the Grand Sameer Events hangar build (same engine, same look):
 * the GSE hangar goes up, the near side opens as a cutaway, Breeze tower units
 * and outdoor condensers are set, then the cooling switches on.
 * Every piece carries its own timing; the whole sequence runs from one uniform (u_t).
 */

export const HANGAR = { span: 20, length: 40, bays: 8, eave: 4.2, rise: 2.6 };
export const UNITS_PER_SIDE = 8;

const M = { ALU: 1, STEEL: 2, ROOF: 3, WALL: 4, DECK: 5, CARPET: 6, DOOR: 7, PERSON: 8, LAMP: 9, UNIT: 10, GRILLE: 11, LED: 12, ODU: 13, FAN: 14, COPPER: 15, TABLE: 16 };

const v3 = (x, y, z) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);

function perspective(fovy, aspect, near, far, shiftX = 0, shiftY = 0) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, shiftX, shiftY, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye, target, up) {
  const z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
function mat4mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

// Vertex: pos3 nrm3 pivot3 dir3 anim4(t0,dur,drop,remove) mat1 uv2
const STRIDE = 19;
class Builder {
  constructor(ts = 1) { this.d = []; this.ts = ts; }
  vert(p, n, a, uv) {
    const ts = a.raw ? 1 : this.ts;
    this.d.push(p[0], p[1], p[2], n[0], n[1], n[2], a.piv[0], a.piv[1], a.piv[2], a.dir[0], a.dir[1], a.dir[2], a.t0 * ts, a.dur * ts, a.drop || 0, a.rm || 0, a.mat, uv[0], uv[1]);
  }
  tri(p0, p1, p2, a, uv0 = [0, 0], uv1 = [1, 0], uv2 = [1, 1], n = null) {
    const nn = n || norm(cross(sub(p1, p0), sub(p2, p0)));
    this.vert(p0, nn, a, uv0); this.vert(p1, nn, a, uv1); this.vert(p2, nn, a, uv2);
  }
  quad(p0, p1, p2, p3, a) {
    this.tri(p0, p1, p2, a, [0, 0], [1, 0], [1, 1]);
    this.tri(p0, p2, p3, a, [0, 0], [1, 1], [0, 1]);
  }
  beam(p0, p1, w, h, a, sideHint = [0, 1, 0]) {
    const ax = norm(sub(p1, p0));
    let s = cross(ax, sideHint);
    if (len(s) < 1e-4) s = cross(ax, [1, 0, 0]);
    s = norm(s);
    const u = norm(cross(s, ax));
    const hw = w / 2, hh = h / 2;
    const c = (p, i, j) => add(p, add(mul(s, i * hw), mul(u, j * hh)));
    const A = [c(p0, -1, -1), c(p0, 1, -1), c(p0, 1, 1), c(p0, -1, 1)];
    const B = [c(p1, -1, -1), c(p1, 1, -1), c(p1, 1, 1), c(p1, -1, 1)];
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; this.quad(A[k], A[k2], B[k2], B[k], a); }
    this.quad(A[3], A[2], A[1], A[0], a);
    this.quad(B[0], B[1], B[2], B[3], a);
  }
  box(min, max, a) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const P = (x, y, z) => [x, y, z];
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), a);
    this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), a);
    this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), a);
    this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), a);
    this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), a);
    this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), a);
  }
  surface(fn, nu, nv, a, up = [0, 1, 0]) {
    const pt = (u, v) => fn(u, v);
    const nrm = (u, v) => {
      const e = 1e-3;
      const n = norm(cross(sub(pt(u + e, v), pt(u - e, v)), sub(pt(u, v + e), pt(u, v - e))));
      return dot(n, up) < 0 ? mul(n, -1) : n;
    };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
      const q = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      const P = q.map(([u, v]) => pt(u, v)), N = q.map(([u, v]) => nrm(u, v));
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) this.vert(P[k], N[k], a, q[k]);
    }
  }
}

/*
 * A floor-standing tower AC (indoor), built facing +f where f is the unit normal
 * in the xz plane. Local frame: r = right, f = front, y = up. Dimensions in metres.
 */
function towerUnit(b, base, f, scale, timing) {
  const W = 0.6 * scale, D = 0.42 * scale, H = 1.86 * scale, ch = 0.045 * scale;
  const r = norm(cross([0, 1, 0], f));
  const P = (x, y, z) => add(base, add(add(mul(r, x), [0, y, 0]), mul(f, z)));
  const a = (mat, extra = {}) => ({ piv: add(base, [0, H * 0.5, 0]), dir: [0, 0, 0], ...timing, ...extra, mat });
  const hw = W / 2, hd = D / 2;
  // chamfered octagonal body: eight vertical faces + top cap
  const ring = [[-hw + ch, hd], [hw - ch, hd], [hw, hd - ch], [hw, -hd + ch], [hw - ch, -hd], [-hw + ch, -hd], [-hw, -hd + ch], [-hw, hd - ch]];
  const y0 = 0.05 * scale, y1 = H;
  for (let i = 0; i < 8; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % 8];
    b.quad(P(x0, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z0), a(M.UNIT));
  }
  const top = ring.map(([x, z]) => P(x, y1, z)), cTop = P(0, y1, 0);
  for (let i = 0; i < 8; i++) b.tri(cTop, top[(i + 1) % 8], top[i], a(M.UNIT), [0.5, 0.5], [0, 0], [1, 0], [0, 1, 0]);
  // dark plinth
  const pl = [P(-hw + 0.02, 0, -hd + 0.02), P(hw - 0.02, y0, hd - 0.02)];
  b.box([Math.min(pl[0][0], pl[1][0]), 0, Math.min(pl[0][2], pl[1][2])], [Math.max(pl[0][0], pl[1][0]), y0, Math.max(pl[0][2], pl[1][2])], a(M.STEEL));
  // louvred outlet (upper front): dark recess + angled slats
  const fz = hd + 0.004 * scale;
  const oy0 = H * 0.66, oy1 = H * 0.94, ow = W * 0.78;
  b.quad(P(-ow / 2, oy0, fz), P(ow / 2, oy0, fz), P(ow / 2, oy1, fz), P(-ow / 2, oy1, fz), a(M.GRILLE));
  const slats = 7;
  for (let i = 0; i < slats; i++) {
    const y = lerp(oy0 + 0.03 * scale, oy1 - 0.02 * scale, i / (slats - 1));
    const p0 = P(-ow / 2 + 0.01, y, fz + 0.004), p1 = P(ow / 2 - 0.01, y, fz + 0.004);
    const tilt = mul([0, -1, 0], 0.012 * scale);
    b.quad(p0, p1, add(add(p1, mul(f, 0.035 * scale)), tilt), add(add(p0, mul(f, 0.035 * scale)), tilt), a(M.UNIT));
  }
  // display window + accent line
  const dy = H * 0.58;
  b.quad(P(-W * 0.12, dy - 0.03 * scale, fz), P(W * 0.12, dy - 0.03 * scale, fz), P(W * 0.12, dy + 0.03 * scale, fz), P(-W * 0.12, dy + 0.03 * scale, fz), a(M.LED));
  b.quad(P(-ow / 2, H * 0.62, fz), P(ow / 2, H * 0.62, fz), P(ow / 2, H * 0.628, fz), P(-ow / 2, H * 0.628, fz), a(M.LED));
  // lower intake grille (vertical slots, shaded procedurally)
  const iy0 = H * 0.08, iy1 = H * 0.34, iw = W * 0.7;
  b.quad(P(-iw / 2, iy0, fz), P(iw / 2, iy0, fz), P(iw / 2, iy1, fz), P(-iw / 2, iy1, fz), a(M.GRILLE, {}));
  return { outlet: P(0, (oy0 + oy1) / 2, fz + 0.05) };
}

/* Outdoor condenser: box with a fan guard on the long face (facing +f). */
function outdoorUnit(b, base, f, scale, timing) {
  const W = 0.95 * scale, D = 0.38 * scale, H = 0.82 * scale;
  const r = norm(cross([0, 1, 0], f));
  const P = (x, y, z) => add(base, add(add(mul(r, x), [0, y, 0]), mul(f, z)));
  const a = (mat) => ({ piv: add(base, [0, H * 0.5, 0]), dir: [0, 0, 0], ...timing, mat });
  const hw = W / 2, hd = D / 2, y0 = 0.08 * scale;
  const c = [P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd), P(-hw, H, -hd), P(hw, H, -hd), P(hw, H, hd), P(-hw, H, hd)];
  b.quad(c[3], c[2], c[6], c[7], a(M.FAN));   // front with fan guard (uv drives the pattern)
  b.quad(c[1], c[0], c[4], c[5], a(M.ODU));
  b.quad(c[0], c[3], c[7], c[4], a(M.ODU));
  b.quad(c[2], c[1], c[5], c[6], a(M.ODU));
  b.quad(c[7], c[6], c[5], c[4], a(M.ODU));
  // feet
  [-hw + 0.08, hw - 0.08].forEach((x) => {
    const p0 = P(x - 0.03, 0, -hd), p1 = P(x + 0.03, y0, hd);
    b.box([Math.min(p0[0], p1[0]), 0, Math.min(p0[2], p1[2])], [Math.max(p0[0], p1[0]), y0, Math.max(p0[2], p1[2])], a(M.STEEL));
  });
  return { port: P(hw * 0.7, H * 0.35, -hd) };
}

function buildHangar(cfg = HANGAR) {
  const { span: S, length: L, bays: NB, eave: H, rise: R } = cfg;
  const B = L / NB, hs = S / 2, ridge = H + R;
  const b = new Builder(0.52); // the GSE build runs in the first half of the timeline
  const UP = v3(0, 1, 0), ZERO = v3(0, 0, 0);
  const frames = [...Array(NB + 1).keys()].map((i) => i * B);
  const slopeDir = (side) => norm(v3(0, -R, side * hs));
  const CUT = 0.53; // near side (+z) opens here

  frames.forEach((x, i) => [-1, 1].forEach((sd) => {
    const c = v3(x, 0.03, sd * hs);
    b.box(v3(x - 0.3, 0, sd * hs - 0.3), v3(x + 0.3, 0.05, sd * hs + 0.3),
      { piv: c, dir: ZERO, t0: 0.05 + i * 0.006 + (sd > 0 ? 0.003 : 0), dur: 0.035, mat: M.STEEL });
  }));

  frames.forEach((x, i) => {
    const tc = 0.115 + i * 0.016;
    [-1, 1].forEach((sd) => {
      const base = v3(x, 0.05, sd * hs), top = v3(x, H, sd * hs), rp = v3(x, ridge, 0);
      b.beam(base, top, 0.32, 0.14, { piv: base, dir: UP, t0: tc + (sd > 0 ? 0.004 : 0), dur: 0.07, mat: M.ALU }, v3(1, 0, 0));
      b.beam(add(top, v3(0, 0.12, 0)), add(rp, v3(0, 0.06, 0)), 0.32, 0.14,
        { piv: top, dir: norm(sub(rp, top)), t0: tc + 0.06, dur: 0.07, drop: 0.9, mat: M.ALU }, v3(1, 0, 0));
      b.beam(add(top, v3(0, -1.0, 0)), add(top, add(mul(norm(sub(rp, top)), 1.3), v3(0, 0.05, 0))), 0.06, 0.08,
        { piv: top, dir: ZERO, t0: tc + 0.11, dur: 0.04, mat: M.ALU }, v3(1, 0, 0));
    });
    if (i === 0 || i === NB) [-hs / 2, hs / 2].forEach((z) => {
      const yTop = ridge - (R * Math.abs(z)) / hs;
      const base = v3(x, 0.05, z);
      b.beam(base, v3(x, yTop, z), 0.2, 0.12, { piv: base, dir: UP, t0: tc + 0.03, dur: 0.07, mat: M.ALU }, v3(1, 0, 0));
    });
  });

  const lines = [];
  [-1, 1].forEach((sd) => [0, 1 / 3, 2 / 3].forEach((f) => lines.push(v3(0, lerp(H, ridge, f) + 0.26, sd * hs * (1 - f)))));
  lines.push(v3(0, ridge + 0.22, 0));
  for (let k = 0; k < NB; k++) {
    const x0 = frames[k], x1 = frames[k + 1];
    lines.forEach((p, j) => {
      const a = v3(x0, p[1], p[2]), c = v3(x1, p[1], p[2]);
      b.beam(a, c, 0.1, 0.1, { piv: a, dir: v3(1, 0, 0), t0: 0.36 + k * 0.011 + j * 0.003, dur: 0.05, mat: M.ALU });
    });
    if (k === 0 || k === NB - 1) {
      [-1, 1].forEach((sd) => {
        const t0 = 0.43 + (k ? 0.02 : 0);
        const e0 = v3(x0, H, sd * hs), e1 = v3(x1, H, sd * hs), r0 = v3(x0, ridge, 0), r1 = v3(x1, ridge, 0);
        const lift = v3(0, 0.25, 0);
        b.beam(add(e0, lift), add(r1, lift), 0.035, 0.035, { piv: add(e0, lift), dir: norm(sub(r1, e0)), t0, dur: 0.05, mat: M.STEEL });
        b.beam(add(e1, lift), add(r0, lift), 0.035, 0.035, { piv: add(e1, lift), dir: norm(sub(r0, e1)), t0, dur: 0.05, mat: M.STEEL });
      });
    }
  }

  // roof membrane; the near slope lifts away for the cutaway
  const roofLift = 0.5, over = 0.25;
  for (let k = 0; k < NB; k++) {
    const x0 = frames[k] - (k === 0 ? over : 0), x1 = frames[k + 1] + (k === NB - 1 ? over : 0);
    [-1, 1].forEach((sd) => {
      const dir = slopeDir(sd);
      const fn = (u, v) => {
        const x = lerp(x0, x1, u);
        const z = sd * (hs + 0.35) * v;
        const y = lerp(ridge, H - R * (0.35 / hs), v) + roofLift;
        const sag = 0.1 * Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, v * 1.15)));
        return v3(x, y - sag, z);
      };
      const piv = v3((x0 + x1) / 2, ridge + roofLift, 0);
      b.surface(fn, 6, 5, { piv, dir, t0: 0.5 + k * 0.014 + (sd > 0 ? 0.006 : 0), dur: 0.075, mat: M.ROOF, rm: sd > 0 ? CUT + (NB - k) * 0.006 : 0 });
    });
  }
  b.beam(v3(-over, ridge + roofLift + 0.04, 0), v3(L + over, ridge + roofLift + 0.04, 0), 0.5, 0.06,
    { piv: v3(-over, ridge + roofLift, 0), dir: v3(1, 0, 0), t0: 0.6, dur: 0.07, mat: M.ROOF });

  b.box(v3(0.2, 0, -hs + 0.25), v3(L - 0.2, 0.22, hs - 0.25), { piv: v3(0.2, 0.1, 0), dir: v3(1, 0, 0), t0: 0.6, dur: 0.08, mat: M.DECK });
  b.box(v3(0.4, 0.22, -hs + 0.7), v3(L - 0.4, 0.25, hs - 0.7), { piv: v3(0.4, 0.23, 0), dir: v3(1, 0, 0), t0: 0.64, dur: 0.08, mat: M.CARPET });

  const wallOff = 0.2;
  for (let k = 0; k < NB; k++) {
    const x0 = frames[k], x1 = frames[k + 1];
    [-1, 1].forEach((sd) => {
      const z = sd * (hs - wallOff);
      const fn = (u, v) => v3(lerp(x0, x1, u), lerp(H + 0.2, 0.05, v), z + sd * 0.07 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
      b.surface(fn, 5, 2, { piv: v3((x0 + x1) / 2, H + 0.2, z), dir: v3(0, -1, 0), t0: 0.7 + k * 0.01 + (sd > 0 ? 0.005 : 0), dur: 0.06, mat: M.WALL, rm: sd > 0 ? CUT + 0.02 + k * 0.004 : 0 }, v3(0, 0, sd));
    });
  }
  const gable = (x, sd, t0, door) => {
    const out = v3(sd, 0, 0), xx = x - sd * 0.12;
    const a = { piv: v3(xx, ridge + 0.3, 0), dir: v3(0, -1, 0), t0, dur: 0.07, mat: M.WALL };
    const yRoof = (z) => ridge + 0.3 - (R * Math.abs(z)) / hs;
    const P = (z, y) => v3(xx, y, z);
    const dw = 3.2, dh = 3.4;
    const strips = door ? [[-hs, -dw], [dw, hs]] : [[-hs, hs]];
    strips.forEach(([z0, z1]) => b.quad(P(z0, 0.05), P(z1, 0.05), P(z1, H + 0.2), P(z0, H + 0.2), a));
    if (door) b.quad(P(-dw, dh), P(dw, dh), P(dw, H + 0.2), P(-dw, H + 0.2), a);
    b.tri(P(-hs, H + 0.2), P(0, H + 0.2), P(0, yRoof(0)), a, [0, 0], [1, 0], [1, 1], out);
    b.tri(P(0, H + 0.2), P(hs, H + 0.2), P(0, yRoof(0)), a, [0, 0], [1, 0], [1, 1], out);
    b.tri(P(-hs, H + 0.2), P(0, yRoof(0)), P(-hs, yRoof(-hs)), a, [0, 0], [1, 1], [0, 1], out);
    b.tri(P(hs, H + 0.2), P(hs, yRoof(hs)), P(0, yRoof(0)), a, [0, 0], [0, 1], [1, 1], out);
    if (door) {
      const fa = { piv: v3(xx, 0.05, 0), dir: UP, t0: t0 + 0.03, dur: 0.05, mat: M.ALU };
      b.beam(v3(xx + sd * 0.06, 0.05, -dw), v3(xx + sd * 0.06, dh, -dw), 0.16, 0.16, fa);
      b.beam(v3(xx + sd * 0.06, 0.05, dw), v3(xx + sd * 0.06, dh, dw), 0.16, 0.16, fa);
      b.beam(v3(xx + sd * 0.06, dh, -dw - 0.08), v3(xx + sd * 0.06, dh, dw + 0.08), 0.16, 0.2, { ...fa, dir: ZERO, piv: v3(xx, dh, 0) });
    }
  };
  gable(0, -1, 0.76, false);
  gable(L, 1, 0.78, false);

  // Breeze units: indoor towers along both long walls, condensers outside, copper lines between
  const units = [];
  for (let i = 0; i < UNITS_PER_SIDE; i++) {
    const x = frames[i] + B / 2;
    [-1, 1].forEach((sd) => {
      const t0 = 0.62 + i * 0.012 + (sd > 0 ? 0.006 : 0);
      const base = v3(x, 0.25, sd * (hs - 0.85));
      const f = v3(0, 0, -sd);
      const tw = towerUnit(b, base, f, 1, { t0, dur: 0.06, drop: 2.2, raw: true });
      const ob = v3(x + 0.6, 0, sd * (hs + 1.15));
      const t1 = 0.75 + i * 0.01 + (sd > 0 ? 0.005 : 0);
      const od = outdoorUnit(b, ob, v3(0, 0, sd), 1, { t0: t1, dur: 0.05, drop: 1.2, raw: true });
      // copper line set: up the outside wall, through at mid height, down to the tower's back
      const p0 = od.port, p1 = v3(p0[0], 1.5, sd * (hs + 0.15)), p2 = v3(x + 0.12, 1.5, sd * (hs - 0.62));
      const ca = { piv: p0, dir: ZERO, t0: t1 + 0.03, dur: 0.04, raw: true, mat: M.COPPER };
      b.beam(p0, p1, 0.05, 0.05, ca); b.beam(p1, p2, 0.05, 0.05, ca);
      units.push(tw.outlet);
    });
  }

  // exterior lamps and people for scale (GSE timing)
  for (let k = 0; k < NB; k++) [-1, 1].forEach((sd) => {
    const x = frames[k] + B / 2 - 1.2, z = sd * (hs + 2.4);
    b.box(v3(x - 0.15, 0, z - 0.12), v3(x + 0.15, 0.22, z + 0.12), { piv: v3(x, 0.1, z), dir: ZERO, t0: 0.86 + k * 0.004, dur: 0.03, mat: M.LAMP });
  });
  const side = hs + 4.2;
  const people = [[-4.5, -1.2], [-5.2, -0.4], [-7.8, 2.6], [-3.1, 4.9], [-9.6, -5.5], [L * 0.22, side], [L * 0.245, side + 0.5], [L * 0.6, side - 0.4], [L * 0.78, -side]];
  people.forEach(([x, z], i) => {
    const h = 1.64 + ((i * 37) % 10) / 60, a = { piv: v3(x, 0, z), dir: ZERO, t0: 0.88 + i * 0.006, dur: 0.04, mat: M.PERSON };
    b.box(v3(x - 0.09, 0, z - 0.17), v3(x + 0.09, h * 0.47, z + 0.17), a);
    b.box(v3(x - 0.13, h * 0.47, z - 0.22), v3(x + 0.13, h * 0.82, z + 0.22), a);
    b.box(v3(x - 0.1, h * 0.84, z - 0.09), v3(x + 0.1, h, z + 0.09), a);
  });

  return { data: new Float32Array(b.d), units };
}

/* Product study: a 4 TR and a 2 TR tower side by side, with an outdoor unit behind. */
function buildUnits() {
  const b = new Builder(1);
  const T = { t0: 0, dur: 0.001, raw: true };
  towerUnit(b, v3(-0.55, 0, 0), v3(0, 0, 1), 1, T);
  towerUnit(b, v3(0.55, 0, 0.05), v3(0, 0, 1), 0.86, T);
  outdoorUnit(b, v3(1.75, 0, -0.55), v3(-0.5, 0, 0.87), 1, T);
  return { data: new Float32Array(b.d), units: [] };
}

const VERT = `
attribute vec3 a_pos, a_nrm, a_piv, a_dir;
attribute vec4 a_anim;
attribute float a_mat;
attribute vec2 a_uv;
uniform mat4 u_vp;
uniform float u_t;
varying vec3 v_wpos, v_nrm;
varying float v_mat;
varying vec2 v_uv;
void main() {
  float p = clamp((u_t - a_anim.x) / max(a_anim.y, 1e-4), 0.0, 1.0);
  float e = 1.0 - pow(1.0 - p, 3.0);
  vec3 d = a_pos - a_piv;
  float along = dot(d, a_dir);
  vec3 perp = d - a_dir * along;
  float s = smoothstep(0.0, 0.18, p);
  vec3 pos = a_piv + perp * s + a_dir * along * e;
  pos.y += (1.0 - e) * a_anim.z;
  if (a_anim.w > 0.0) {                      // cutaway: piece lifts and folds away
    float r = smoothstep(0.0, 1.0, clamp((u_t - a_anim.w) / 0.06, 0.0, 1.0));
    pos = a_piv + (pos - a_piv) * (1.0 - r) + vec3(0.0, 10.0 * r, 0.0);
  }
  v_wpos = pos; v_nrm = a_nrm; v_mat = a_mat; v_uv = a_uv;
  gl_Position = u_vp * vec4(pos, 1.0);
}`;

const COMMON = `
precision highp float;
uniform vec3 u_cam, u_sun, u_bg;
uniform float u_lights, u_cool, u_hs;
vec3 tonemap(vec3 c) { c *= 0.95; return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSrgb(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }
vec3 sky(vec3 r) {
  float h = clamp(r.y, -1.0, 1.0);
  vec3 zen = vec3(0.020, 0.028, 0.036), hor = vec3(0.28, 0.27, 0.27), gnd = vec3(0.015, 0.016, 0.017);
  return h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor * 0.4, gnd, pow(-h, 0.4));
}`;

const FRAG = `${COMMON}
varying vec3 v_wpos, v_nrm;
varying float v_mat;
varying vec2 v_uv;
void main() {
  vec3 N = normalize(v_nrm), V = normalize(u_cam - v_wpos), L = normalize(u_sun);
  if (dot(N, V) < 0.0) N = -N;
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0), wrap = max((dot(N, L) + 0.45) / 1.45, 0.0);
  float dusk = 1.0 - 0.78 * u_lights;
  vec3 sunC = vec3(1.0, 0.84, 0.66) * 2.2 * dusk;
  vec3 hemi = mix(vec3(0.026, 0.025, 0.026), vec3(0.17, 0.19, 0.22), N.y * 0.5 + 0.5) * mix(1.0, 0.6, u_lights);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 warm = vec3(1.0, 0.72, 0.44);
  vec3 cool = vec3(0.30, 0.66, 1.0);
  float inside = step(abs(v_wpos.z), u_hs) * step(0.0, v_wpos.y) * step(v_wpos.y, 4.6);
  vec3 interior = (warm * 0.10 + cool * 0.10 * u_cool) * u_lights * inside;
  float m = v_mat;
  vec3 col;
  if (m < 1.5) {
    vec3 base = vec3(0.62, 0.64, 0.66);
    col = base * (hemi * 0.8 + sunC * ndl * 0.35) + sky(reflect(-V, N)) * mix(0.55, 1.0, fres) + sunC * pow(max(dot(N, H), 0.0), 70.0) * 0.6;
    col += warm * u_lights * 0.05;
  } else if (m < 2.5) {
    col = vec3(0.08) * (hemi * 2.0 + sunC * ndl * 0.6) + sky(reflect(-V, N)) * 0.25;
  } else if (m < 4.5) {
    float seam = smoothstep(0.0, 0.035, v_uv.x) * smoothstep(0.0, 0.035, 1.0 - v_uv.x);
    vec3 base = vec3(0.78, 0.78, 0.76) * mix(0.8, 1.0, seam);
    col = base * (hemi * 1.3 + sunC * wrap * 0.36) * (1.0 - 0.3 * u_lights);
    col += sunC * pow(max(dot(N, H), 0.0), 18.0) * 0.06;
    float glow = (m > 3.5 ? 0.55 + 0.35 * v_uv.y : 0.3) * u_lights;
    col += base * mix(warm, mix(warm, vec3(0.75, 0.88, 1.0), 0.55), u_cool) * glow * mix(0.55, 1.0, seam);
  } else if (m < 5.5) {
    col = vec3(0.16, 0.16, 0.15) * (hemi * 1.6 + sunC * ndl * 0.4);
  } else if (m < 6.5) {                                  // charcoal carpet; cools from the walls inward
    col = vec3(0.055, 0.062, 0.075) * (hemi * 1.8 + sunC * wrap * 0.5) * (1.0 + u_lights * 1.2);
    float fromWall = u_hs - abs(v_wpos.z);
    float reach = mix(0.0, u_hs + 1.0, u_cool);
    float c = (1.0 - smoothstep(reach - 3.5, reach, fromWall)) * u_cool;
    col += cool * c * (0.10 + 0.08 * (1.0 - fromWall / u_hs));
    col += warm * u_lights * 0.035;
  } else if (m < 7.5) {
    col = mix(vec3(0.015), vec3(1.2, 0.85, 0.5), u_lights);
  } else if (m < 8.5) {
    col = vec3(0.035, 0.036, 0.04) * (hemi * 2.0 + sunC * wrap * 0.5);
    col += warm * u_lights * 0.04 * (1.0 - N.y);
  } else if (m < 9.5) {
    col = mix(vec3(0.05), vec3(1.6, 1.1, 0.62), u_lights);
  } else if (m < 10.5) {                                 // tower cabinet: satin white plastic
    vec3 base = vec3(0.80, 0.815, 0.83);
    float spec = pow(max(dot(N, H), 0.0), 40.0);
    col = base * (hemi * 1.5 + sunC * wrap * 0.42) + sunC * spec * 0.12 + sky(reflect(-V, N)) * fres * 0.35;
    col += base * interior * 2.2;
  } else if (m < 11.5) {                                 // outlet recess / intake grille
    float slot = abs(N.y) > 0.5 ? 0.0 : step(0.5, fract(v_uv.x * 34.0));
    float rows = step(0.55, fract(v_uv.y * 9.0));
    vec3 base = mix(vec3(0.03, 0.035, 0.04), vec3(0.11, 0.12, 0.13), max(slot * 0.6, rows * 0.4));
    col = base * (hemi * 2.0 + sunC * wrap * 0.3);
    col += cool * u_cool * 0.08 * rows;
  } else if (m < 12.5) {                                 // display and accent line
    col = mix(vec3(0.02, 0.05, 0.10), vec3(0.25, 0.75, 1.6), u_cool);
  } else if (m < 13.5) {                                 // condenser casing
    vec3 base = vec3(0.58, 0.60, 0.61);
    col = base * (hemi * 1.4 + sunC * wrap * 0.45) + sunC * pow(max(dot(N, H), 0.0), 30.0) * 0.1;
  } else if (m < 14.5) {                                 // condenser front with fan guard
    vec2 q = (v_uv - vec2(0.38, 0.5)) * vec2(2.3, 1.0);
    float r = length(q);
    float guard = step(r, 0.42) * (step(0.5, fract(r * 22.0)) * 0.6 + step(0.92, fract(atan(q.y, q.x) * 1.27)) * 0.4);
    float fan = step(r, 0.42);
    vec3 base = mix(vec3(0.58, 0.60, 0.61), vec3(0.04, 0.045, 0.05), fan * 0.85);
    base = mix(base, vec3(0.35, 0.36, 0.37), guard * 0.6);
    float fins = step(0.62, v_uv.x) * step(0.5, fract(v_uv.y * 30.0));
    base *= 1.0 - fins * 0.25;
    col = base * (hemi * 1.4 + sunC * wrap * 0.45);
  } else if (m < 15.5) {                                 // copper line set (insulated, light)
    col = vec3(0.70, 0.70, 0.68) * (hemi * 1.5 + sunC * wrap * 0.4);
  } else {                                               // table linen
    vec3 base = vec3(0.86, 0.84, 0.80);
    col = base * (hemi * 1.4 + sunC * wrap * 0.3) + base * interior * 2.4;
  }
  float dist = length(u_cam - v_wpos);
  col = mix(col, u_bg, (1.0 - exp(-dist * 0.0045)) * 0.55);
  gl_FragColor = vec4(toSrgb(tonemap(col)), 1.0);
}`;

const GVERT = `
attribute vec2 a_xz;
uniform mat4 u_vp;
varying vec3 v_wpos;
void main() { v_wpos = vec3(a_xz.x, 0.0, a_xz.y); gl_Position = u_vp * vec4(v_wpos, 1.0); }`;

const GFRAG = `${COMMON}
varying vec3 v_wpos;
uniform vec4 u_fp;
uniform vec2 u_center;
uniform float u_radius, u_outline, u_shadow, u_grid, u_gstep;
uniform vec3 u_accent;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float gridLine(vec2 p, float step, float w) {
  vec2 g = abs(fract(p / step - 0.5) - 0.5) * step;
  vec2 fw = fwidth(p) * 1.2;
  vec2 l = 1.0 - smoothstep(vec2(w) - fw, vec2(w) + fw, g);
  return max(l.x, l.y);
}
void main() {
  vec2 p = v_wpos.xz;
  vec2 c = (u_fp.xy + u_fp.zw) * 0.5, hb = (u_fp.zw - u_fp.xy) * 0.5;
  float r = length(p - u_center);
  float fade = 1.0 - smoothstep(u_radius * 0.8, u_radius * 2.8, r);
  vec3 col = vec3(0.045, 0.050, 0.055) * 1.15;
  float g = gridLine(p, u_gstep, 0.012 * u_gstep) * 0.32 + gridLine(p, u_gstep * 5.0, 0.03 * u_gstep) * 0.55;
  col += vec3(0.16, 0.18, 0.20) * g * u_grid * fade;
  float d = sdBox(p - c - vec2(1.2, -1.6) * u_gstep, hb);
  col *= 1.0 - u_shadow * 0.72 * (1.0 - smoothstep(-1.0 * u_gstep, 5.5 * u_gstep, d));
  vec2 q = p - c; vec2 hb2 = hb + 0.9 * u_gstep;
  float edge = abs(sdBox(q, hb2));
  float per = 2.0 * (hb2.x * 2.0 + hb2.y * 2.0);
  float s;
  if (abs(q.y + hb2.y) < 0.6 && abs(q.x) <= hb2.x + 0.6) s = q.x + hb2.x;
  else if (abs(q.x - hb2.x) < 0.6) s = 2.0 * hb2.x + q.y + hb2.y;
  else if (abs(q.y - hb2.y) < 0.6) s = 2.0 * hb2.x + 2.0 * hb2.y + hb2.x - q.x;
  else s = 4.0 * hb2.x + 2.0 * hb2.y + hb2.y - q.y;
  float drawn = step(s / per, u_outline);
  float dash = step(0.45, fract(s / (1.4 * u_gstep)));
  float lw = fwidth(edge) * 1.5 + 0.04 * u_gstep;
  float line = (1.0 - smoothstep(lw * 0.5, lw, edge)) * drawn * dash;
  col = mix(col, u_accent, line * (0.95 - 0.55 * u_shadow));
  float dOut = max(sdBox(q, hb), 0.0);
  float spill = exp(-dOut * 0.42 / u_gstep) * step(0.0, sdBox(q, hb) + 0.1);
  col += mix(vec3(1.0, 0.62, 0.32), vec3(0.35, 0.62, 1.0), u_cool * 0.6) * u_lights * spill * 0.16;
  float dist = length(u_cam - v_wpos);
  col = mix(col, u_bg, (1.0 - exp(-dist * 0.0045)) * 0.55);
  gl_FragColor = vec4(toSrgb(tonemap(col)) * fade, fade);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// Camera: high plan view while the hangar goes up, then down into the cutaway.
const KEYS = [
  { t: 0.0, az: -58, el: 56, dist: 96 },
  { t: 0.3, az: -46, el: 36, dist: 90 },
  { t: 0.56, az: -36, el: 30, dist: 84 },
  { t: 0.8, az: -30, el: 25, dist: 78 },
  { t: 1.0, az: -27, el: 21, dist: 74 },
];
function cameraAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], k = smooth(clamp01((t - a.t) / (b.t - a.t)));
  return { az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), dist: lerp(a.dist, b.dist, k) };
}

/**
 * createScene(canvas, { mode: 'hangar' | 'units', shift })
 * hangar: controller.set({ t, px, py })   t = build progress 0..1
 * units:  controller.set({ az })          orbit angle in degrees
 */
export function createScene(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');
  const deriv = '#extension GL_OES_standard_derivatives : enable\n';
  let prog, gprog;
  try { prog = program(gl, VERT, FRAG); gprog = program(gl, GVERT, deriv + GFRAG); }
  catch (err) { console.warn('[breeze-3d]', err); return null; }

  const mode = opts.mode || 'hangar';
  const built = mode === 'units' ? buildUnits() : buildHangar(HANGAR);
  const count = built.data.length / STRIDE;
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, built.data, gl.STATIC_DRAW);
  const attrs = [['a_pos', 3, 0], ['a_nrm', 3, 3], ['a_piv', 3, 6], ['a_dir', 3, 9], ['a_anim', 4, 12], ['a_mat', 1, 16], ['a_uv', 2, 17]]
    .map(([n, size, off]) => ({ loc: gl.getAttribLocation(prog, n), size, off }));

  const G = mode === 'units' ? 30 : 420;
  const cx = mode === 'units' ? 0 : 20;
  const gbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-G, -G, G, -G, G, G, -G, -G, G, G, -G, G].map((v, i) => v + (i % 2 ? 0 : cx))), gl.STATIC_DRAW);
  const gpos = gl.getAttribLocation(gprog, 'a_xz');

  const U = (p, n) => gl.getUniformLocation(p, n);
  const u = {}, gu = {};
  ['u_vp', 'u_t', 'u_cam', 'u_sun', 'u_bg', 'u_lights', 'u_cool', 'u_hs'].forEach((n) => { u[n] = U(prog, n); });
  ['u_vp', 'u_cam', 'u_sun', 'u_bg', 'u_lights', 'u_cool', 'u_hs', 'u_fp', 'u_center', 'u_radius', 'u_outline', 'u_shadow', 'u_grid', 'u_accent', 'u_gstep'].forEach((n) => { gu[n] = U(gprog, n); });

  const bg = [0.035, 0.042, 0.048];
  const accent = [0.42, 0.66, 1.0];
  const sun = norm(v3(-0.9, 0.62, 0.22));
  const { span: S, length: L, eave: H, rise: R } = HANGAR;

  let state = { t: 0, px: 0, py: 0, az: -30, shift: opts.shift || 0 };
  let vp = null, eye = null, w = 1, h = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, (canvas.clientWidth || 1) < 700 ? 1.6 : 2);
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr)), ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    w = canvas.clientWidth || 1; h = canvas.clientHeight || 1;
  }

  function render() {
    resize();
    const aspect = w / h;
    let target, dist, az, el, fov, lights, cool, shadow, outline, grid, gstep, fp, center, radius, t;
    if (mode === 'units') {
      t = 1; target = v3(0, 0.95, -0.2); az = (state.az * Math.PI) / 180; el = (13 * Math.PI) / 180;
      dist = 6.4 * (aspect < 1 ? 1.25 / aspect : 1); fov = 26;
      lights = 0.25; cool = 1; shadow = 1; outline = 1; grid = 1; gstep = 0.25;
      fp = [-1.0, -1.6, 1.0, 0.4]; center = [0, -0.4]; radius = 2.2;
    } else {
      t = state.t;
      const cam = cameraAt(t);
      const radiusH = 0.5 * Math.hypot(L, S);
      target = v3(L / 2, (H + R) * 0.36, 0);
      az = ((cam.az + state.px * 4) * Math.PI) / 180; el = ((cam.el + state.py * 2.5) * Math.PI) / 180;
      const fit = aspect < 1.45 ? Math.min(1.8, 1.3 / aspect) : 1;
      dist = cam.dist * fit * (radiusH / 22.36); fov = 28;
      lights = smooth(clamp01((t - 0.55) / 0.12));
      cool = smooth(clamp01((t - 0.86) / 0.13));
      shadow = smooth(clamp01((t - 0.26) / 0.1));
      outline = smooth(clamp01(t / 0.06)); grid = 1.0 - 0.45 * shadow; gstep = 1;
      fp = [-0.2, -S / 2 - 0.2, L + 0.2, S / 2 + 0.2]; center = [L / 2, 0]; radius = radiusH;
    }
    eye = add(target, mul(v3(-Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az)), dist));
    const proj = perspective((fov * Math.PI) / 180, aspect, 0.1, 600, aspect > 1.1 ? -state.shift : 0, 0);
    vp = mat4mul(proj, lookAt(eye, target, v3(0, 1, 0)));

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(gprog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(gu.u_vp, false, vp);
    gl.uniform3fv(gu.u_cam, eye); gl.uniform3fv(gu.u_sun, sun); gl.uniform3fv(gu.u_bg, bg);
    gl.uniform1f(gu.u_lights, lights); gl.uniform1f(gu.u_cool, cool); gl.uniform1f(gu.u_hs, S / 2 - 0.3);
    gl.uniform4f(gu.u_fp, fp[0], fp[1], fp[2], fp[3]);
    gl.uniform2f(gu.u_center, center[0], center[1]);
    gl.uniform1f(gu.u_radius, radius);
    gl.uniform1f(gu.u_outline, outline);
    gl.uniform1f(gu.u_shadow, shadow);
    gl.uniform1f(gu.u_grid, grid);
    gl.uniform1f(gu.u_gstep, gstep);
    gl.uniform3fv(gu.u_accent, accent);
    gl.bindBuffer(gl.ARRAY_BUFFER, gbuf);
    gl.enableVertexAttribArray(gpos);
    gl.vertexAttribPointer(gpos, 2, gl.FLOAT, false, 8, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(gpos);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    gl.useProgram(prog);
    gl.uniformMatrix4fv(u.u_vp, false, vp);
    gl.uniform1f(u.u_t, t);
    gl.uniform3fv(u.u_cam, eye); gl.uniform3fv(u.u_sun, sun); gl.uniform3fv(u.u_bg, bg);
    gl.uniform1f(u.u_lights, lights); gl.uniform1f(u.u_cool, cool); gl.uniform1f(u.u_hs, mode === 'units' ? 0 : S / 2 - 0.3);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    attrs.forEach((a) => {
      if (a.loc < 0) return;
      gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, STRIDE * 4, a.off * 4);
    });
    gl.drawArrays(gl.TRIANGLES, 0, count);
    attrs.forEach((a) => { if (a.loc >= 0) gl.disableVertexAttribArray(a.loc); });
  }

  function project(p) {
    if (!vp) return null;
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    const ww = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    if (ww <= 0) return null;
    return { x: ((x / ww) * 0.5 + 0.5) * w, y: (1 - ((y / ww) * 0.5 + 0.5)) * h };
  }

  return {
    set(next) { state = { ...state, ...next }; render(); },
    render,
    project,
    destroy() { gl.deleteBuffer(vbo); gl.deleteBuffer(gbuf); gl.deleteProgram(prog); gl.deleteProgram(gprog); },
  };
}
