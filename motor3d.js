/* =========================================================
   MOTOR 3D · mini motor WebGL hecho a mano (sin librerías)
   - Piezas con bordes redondeados y sombreado suave
   - Sombras reales (mapa de sombras con suavizado)
   - Luz de cielo/suelo, brillo especular, contorno y oclusión falsa
   - Calidad automática: si el móvil va justo, baja sombras y resolución
   Lo usan la historia (obby.js), el combate (juego.js) y el regalo (regalo3d.js).
   ========================================================= */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    elastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1
  };
  // aleatorio con semilla (para que el decorado salga siempre igual)
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

  function rgb(c) {
    if (Array.isArray(c)) return c.slice(0, 3);
    if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
    if (typeof c !== 'number' || isNaN(c)) c = 0xffffff;
    return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
  }

  /* ---------- matrices (column-major) ---------- */
  const m4 = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  const T = new Float32Array(16);
  function mul(o, a, b) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      T[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    o.set(T); return o;
  }
  function compose(o, p, r, s) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    o[0] = (cy * cz + sy * sx * sz) * s[0]; o[1] = (cx * sz) * s[0]; o[2] = (-sy * cz + cy * sx * sz) * s[0]; o[3] = 0;
    o[4] = (-cy * sz + sy * sx * cz) * s[1]; o[5] = (cx * cz) * s[1]; o[6] = (sy * sz + cy * sx * cz) * s[1]; o[7] = 0;
    o[8] = (sy * cx) * s[2]; o[9] = (-sx) * s[2]; o[10] = (cy * cx) * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  }
  // matriz de normales (inversa traspuesta de la parte 3x3, sin dividir por el determinante)
  function normalMat(o, m) {
    const a0 = m[0], a1 = m[1], a2 = m[2], b0 = m[4], b1 = m[5], b2 = m[6], c0 = m[8], c1 = m[9], c2 = m[10];
    o[0] = b1 * c2 - b2 * c1; o[1] = b2 * c0 - b0 * c2; o[2] = b0 * c1 - b1 * c0;
    o[3] = c1 * a2 - c2 * a1; o[4] = c2 * a0 - c0 * a2; o[5] = c0 * a1 - c1 * a0;
    o[6] = a1 * b2 - a2 * b1; o[7] = a2 * b0 - a0 * b2; o[8] = a0 * b1 - a1 * b0;
    return o;
  }
  const NM = new Float32Array(9);
  function perspective(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  }
  function ortho(o, a, n, f) {
    o.fill(0); o[0] = 1 / a; o[5] = 1 / a; o[10] = -2 / (f - n); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  }
  function lookAt(o, e, t, up) {
    let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
    return o;
  }

  /* ---------- geometrías ---------- */
  let geoId = 0;
  function Geo(pos, nor, col) {
    this.id = ++geoId; this.pos = pos instanceof Float32Array ? pos : new Float32Array(pos);
    this.nor = nor instanceof Float32Array ? nor : new Float32Array(nor);
    this.count = this.pos.length / 3; this.col = col ? (col instanceof Float32Array ? col : new Float32Array(col)) : null; this.bufs = {};
  }
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  function faceN(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    return nrm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
  }
  function builder() {
    const P = [], N = [];
    return {
      // na/nb/nc opcionales: normales por vértice (sombreado suave)
      tri(a, b, c, na, nb, nc) { if (!na) { na = nb = nc = faceN(a, b, c); } P.push(...a, ...b, ...c); N.push(...na, ...(nb || na), ...(nc || na)); },
      done() { return new Geo(P, N); }
    };
  }
  function sharpBox() {
    const b = builder(), h = .5, v = (x, y, z) => [x * h, y * h, z * h];
    const q = (a, c, d, e, n) => { b.tri(a, c, d, n, n, n); b.tri(a, d, e, n, n, n); };
    q(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), [0, 0, 1]); q(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), [0, 0, -1]);
    q(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), [1, 0, 0]); q(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), [-1, 0, 0]);
    q(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), [0, 1, 0]); q(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), [0, -1, 0]);
    return b.done();
  }
  // Caja con bordes redondeados para unas medidas concretas, guardada como cubo unidad
  // (así se puede escalar como una caja normal y el borde sigue viéndose redondo).
  const rboxCache = {};
  function rboxGeo(w, h, d, r) {
    w = Math.max(w, .001); h = Math.max(h, .001); d = Math.max(d, .001);
    r = Math.min(r, w / 2 - .0005, h / 2 - .0005, d / 2 - .0005);
    const key = w.toFixed(2) + '|' + h.toFixed(2) + '|' + d.toFixed(2) + '|' + r.toFixed(2);
    if (rboxCache[key]) return rboxCache[key];
    const H = [w / 2, h / 2, d / 2], S = [w, h, d];
    const fine = Math.min(w, h, d) > 1.6;
    const samp = k => { const a = H[k]; return fine ? [-a, -a + r * .3, -a + r, a - r, a - r * .3, a] : [-a, -a + r, a - r, a]; };
    const P = [], N = [];
    const vert = p => {
      const inner = [clamp(p[0], -H[0] + r, H[0] - r), clamp(p[1], -H[1] + r, H[1] - r), clamp(p[2], -H[2] + r, H[2] - r)];
      let n = [p[0] - inner[0], p[1] - inner[1], p[2] - inner[2]]; n = nrm(n);
      const q = [inner[0] + n[0] * r, inner[1] + n[1] * r, inner[2] + n[2] * r];
      // normal en el espacio del cubo unidad (se corrige con la inversa traspuesta al dibujar)
      return { p: [q[0] / S[0], q[1] / S[1], q[2] / S[2]], n: nrm([n[0] * S[0], n[1] * S[1], n[2] * S[2]]) };
    };
    // cada cara: ejes (u, v) y eje fijo con signo
    const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [2, 1, 0, 1], [2, 1, 0, -1], [0, 2, 1, 1], [0, 2, 1, -1]];
    for (const [u, v, f, sgn] of faces) {
      const su = samp(u), sv = samp(v);
      for (let i = 0; i < su.length - 1; i++) for (let j = 0; j < sv.length - 1; j++) {
        const mk = (a, b) => { const p = [0, 0, 0]; p[u] = su[a]; p[v] = sv[b]; p[f] = sgn * H[f]; return vert(p); };
        const A = mk(i, j), B = mk(i + 1, j), C = mk(i + 1, j + 1), D = mk(i, j + 1);
        for (const t of [[A, B, C], [A, C, D]]) for (const x of t) { P.push(...x.p); N.push(...x.n); }
      }
    }
    return rboxCache[key] = new Geo(P, N);
  }
  // cilindro/cono con lados suaves
  function cylGeo(n, rt, rb, flat) {
    const b = builder();
    const p = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const sn = a => nrm([Math.cos(a), (rb - rt), Math.sin(a)]);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      if (flat) { const nn = sn((a0 + a1) / 2); b.tri(p(rb, a0, -.5), p(rb, a1, -.5), p(rt, a1, .5), nn, nn, nn); b.tri(p(rb, a0, -.5), p(rt, a1, .5), p(rt, a0, .5), nn, nn, nn); }
      else { b.tri(p(rb, a0, -.5), p(rb, a1, -.5), p(rt, a1, .5), sn(a0), sn(a1), sn(a1)); b.tri(p(rb, a0, -.5), p(rt, a1, .5), p(rt, a0, .5), sn(a0), sn(a1), sn(a0)); }
      if (rt > 0) b.tri([0, .5, 0], p(rt, a0, .5), p(rt, a1, .5), [0, 1, 0], [0, 1, 0], [0, 1, 0]);
      if (rb > 0) b.tri([0, -.5, 0], p(rb, a1, -.5), p(rb, a0, -.5), [0, -1, 0], [0, -1, 0], [0, -1, 0]);
    }
    return b.done();
  }
  function sphereGeo(sub, flat) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => nrm(v).map(c => c * .5));
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) {
      const NF = [], cache = {};
      const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] != null) return cache[k]; V.push(nrm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]).map(c => c * .5)); return cache[k] = V.length - 1; };
      for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = NF;
    }
    const b = builder();
    for (const [a, c, d] of F) flat ? b.tri(V[a], V[c], V[d]) : b.tri(V[a], V[c], V[d], nrm(V[a]), nrm(V[c]), nrm(V[d]));
    return b.done();
  }
  function octGeo() {
    const b = builder(), h = .5, T0 = [0, h, 0], B0 = [0, -h, 0], R = [[h, 0, 0], [0, 0, h], [-h, 0, 0], [0, 0, -h]];
    for (let i = 0; i < 4; i++) { const a = R[i], c = R[(i + 1) % 4]; b.tri(T0, c, a); b.tri(B0, a, c); }
    return b.done();
  }
  function wedgeGeo() {
    const b = builder(), h = .5;
    const A = [-h, -h, h], B = [h, -h, h], C = [h, -h, -h], D = [-h, -h, -h], E = [-h, h, 0], F = [h, h, 0];
    const q = (a, c, d, e) => { const n = faceN(a, c, d); b.tri(a, c, d, n, n, n); b.tri(a, d, e, n, n, n); };
    q(A, B, F, E); q(C, D, E, F); b.tri(B, C, F); b.tri(D, A, E); q(D, C, B, A);
    return b.done();
  }
  // toro (arco = fracción de vuelta, para los cortes de los golpes)
  function torusGeo(n, m, r, arc) {
    arc = arc || 1; const b = builder(), R = .5 - r;
    const p = (i, j) => { const u = i / n * TAU * arc, v = j / m * TAU; return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]; };
    const q = (i, j) => { const u = i / n * TAU * arc, v = j / m * TAU; return [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { b.tri(p(i, j), p(i + 1, j), p(i + 1, j + 1), q(i, j), q(i + 1, j), q(i + 1, j + 1)); b.tri(p(i, j), p(i + 1, j + 1), p(i, j + 1), q(i, j), q(i + 1, j + 1), q(i, j + 1)); }
    return b.done();
  }
  const geo = {};
  geo.box = sharpBox();
  geo.rbox = (w, h, d, r) => rboxGeo(w, h, d, r);
  geo.cyl = cylGeo(16, .5, .5);
  geo.cyl6 = cylGeo(6, .5, .5, true);
  geo.cyl20 = cylGeo(28, .5, .5);
  geo.cone = cylGeo(14, 0, .5);
  geo.cone4 = cylGeo(4, 0, .5, true);
  geo.cone6 = cylGeo(6, 0, .5, true);
  geo.skirt = cylGeo(20, .4, .55);
  geo.ball = sphereGeo(2);
  geo.ball2 = sphereGeo(2);
  geo.ballS = sphereGeo(1);
  geo.gem = sphereGeo(0, true);
  geo.rock = sphereGeo(1, true);
  geo.oct = octGeo();
  geo.wedge = wedgeGeo();
  geo.torus = torusGeo(36, 10, .11);
  geo.thin = torusGeo(40, 6, .04);
  geo.arc = torusGeo(18, 6, .07, .38);
  geo.custom = cylGeo;

  /* ---------- nodos ---------- */
  function Node(g, color, o) {
    this.geo = g || null; this.color = rgb(color == null ? 0xffffff : color);
    this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.scl = [1, 1, 1];
    this.children = []; this.parent = null; this.visible = true;
    this.alpha = 1; this.emis = 0; this.additive = false; this.shine = .35; this.cast = true; this.vary = true;
    this.local = m4(); this.world = m4();
    if (o) { for (const k in o) { if (k === 'add') this.additive = !!o.add; else if (k === 'r') { /* radio: lo usa box() */ } else this[k] = o[k]; } }
  }
  Node.prototype.add = function (...cs) { for (const c of cs) { if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); } return cs[0]; };
  Node.prototype.remove = function (c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } };
  Node.prototype.at = function (x, y, z) { this.pos[0] = x; this.pos[1] = y; this.pos[2] = z; return this; };
  Node.prototype.size = function (x, y, z) { this.scl[0] = x; this.scl[1] = y == null ? x : y; this.scl[2] = z == null ? x : z; return this; };
  Node.prototype.turn = function (x, y, z) { this.rot[0] = x || 0; this.rot[1] = y || 0; this.rot[2] = z || 0; return this; };
  Node.prototype.setColor = function (c) { this.color = rgb(c); return this; };
  Node.prototype.update = function (pw) {
    compose(this.local, this.pos, this.rot, this.scl);
    if (pw) mul(this.world, pw, this.local); else this.world.set(this.local);
    for (const c of this.children) c.update(this.world);
  };
  Node.prototype.wpos = function () { return [this.world[12], this.world[13], this.world[14]]; };
  const group = () => new Node(null);
  // caja redondeada (o.r = radio; 0 = esquinas vivas)
  function box(parent, w, h, d, color, x, y, z, o) {
    const r = o && o.r != null ? o.r : Math.min(.32, Math.min(w, h, d) * .24);
    const g = r > .012 && Math.min(w, h, d) > .03 ? rboxGeo(w, h, d, r) : geo.box;
    const n = new Node(g, color, o); n.size(w, h, d); n.at(x || 0, y || 0, z || 0); if (parent) parent.add(n); return n;
  }
  function mesh(parent, g, color, sx, sy, sz, x, y, z, o) {
    const n = new Node(g, color, o); n.size(sx, sy, sz); n.at(x || 0, y || 0, z || 0); if (parent) parent.add(n); return n;
  }

  // Funde el decorado fijo en una sola malla (1 llamada de dibujo). Cada pieza varía un poco de tono.
  function bake(grp, seed) {
    grp.update(null);
    const R = rng(seed || 7);
    let total = 0; const list = [];
    const walk = n => { if (!n.visible) return; if (n.geo) { list.push(n); total += n.geo.count; } n.children.forEach(walk); };
    walk(grp);
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
    let o = 0;
    for (const n of list) {
      const m = n.world, g = n.geo, k = n.vary ? .92 + R() * .1 : 1, nm = normalMat(new Float32Array(9), m);
      const e = n.emis || 0, cap = e > 0 ? 9 : .999;
      const c = [Math.min(cap, n.color[0] * k), Math.min(cap, n.color[1] * k), Math.min(cap, n.color[2] * k)];
      for (let i = 0; i < g.count; i++, o++) {
        const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
        P[o * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; P[o * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; P[o * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        const nx = g.nor[i * 3], ny = g.nor[i * 3 + 1], nz = g.nor[i * 3 + 2];
        let a = nm[0] * nx + nm[3] * ny + nm[6] * nz, b = nm[1] * nx + nm[4] * ny + nm[7] * nz, d = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const l = Math.hypot(a, b, d) || 1; N[o * 3] = a / l; N[o * 3 + 1] = b / l; N[o * 3 + 2] = d / l;
        // los objetos que brillan se guardan con un "plus" de color (el shader lo trata como emisivo)
        const f = e > 0 ? 1 + e * 1.4 : 1; C[o * 3] = c[0] * f; C[o * 3 + 1] = c[1] * f; C[o * 3 + 2] = c[2] * f;
      }
    }
    return new Node(new Geo(P, N, C), 0xffffff, { shine: .22 });
  }

  /* ---------- renderizador ---------- */
  const VS = `precision highp float;
attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;
uniform mat4 uVP;uniform mat4 uM;uniform mat4 uLVP;uniform mat3 uN;
varying vec3 vN;varying vec3 vC;varying vec3 vW;varying vec4 vL;
void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;vN=uN*aNor;vC=aCol;vL=uLVP*w;gl_Position=uVP*w;}`;
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vN;varying vec3 vC;varying vec3 vW;varying vec4 vL;
uniform vec3 uColor;uniform vec3 uL;uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uSun;uniform vec3 uFog;uniform vec3 uCam;
uniform float uEmis;uniform float uAlpha;uniform float uFN;uniform float uFF;uniform float uShine;uniform float uAoY;
uniform sampler2D uSM;uniform float uSh;uniform float uTx;
float unpack(vec4 c){return dot(c,vec4(1.0/16777216.0,1.0/65536.0,1.0/256.0,1.0));}
float shadowF(float ndl){
  if(uSh<0.5)return 1.0;
  vec3 p=vL.xyz/vL.w*0.5+0.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0)return 1.0;
  float b=0.0012+0.003*(1.0-ndl);float z=p.z-b;float s=0.0;
  s+=step(z,unpack(texture2D(uSM,p.xy)));
  s+=step(z,unpack(texture2D(uSM,p.xy+vec2(uTx,0.0))));
  s+=step(z,unpack(texture2D(uSM,p.xy-vec2(uTx,0.0))));
  s+=step(z,unpack(texture2D(uSM,p.xy+vec2(0.0,uTx))));
  s+=step(z,unpack(texture2D(uSM,p.xy-vec2(0.0,uTx))));
  s+=step(z,unpack(texture2D(uSM,p.xy+vec2(uTx,uTx)*0.7)));
  s+=step(z,unpack(texture2D(uSM,p.xy-vec2(uTx,uTx)*0.7)));
  return s/7.0;}
void main(){
  vec3 n=normalize(vN);vec3 base=uColor*vC;
  float glow=max(max(base.r,base.g),base.b)>1.0?1.0:0.0;
  base=min(base,vec3(1.0));
  vec3 V=normalize(uCam-vW);
  float h=n.y*0.5+0.5;vec3 amb=mix(uGnd,uSky,h);
  float ndl=max(dot(n,uL),0.0);
  float sh=shadowF(ndl);
  float ao=mix(1.0,mix(0.6,1.0,clamp((vW.y-uAoY)/1.8,0.0,1.0)),1.0-max(n.y,0.0));
  vec3 col=base*(amb*ao+uSun*ndl*sh);
  float spec=pow(max(dot(n,normalize(uL+V)),0.0),28.0)*uShine*sh;
  col+=uSun*spec*0.55;
  float rim=pow(1.0-max(dot(n,V),0.0),3.0);
  col+=mix(uSky,base,0.5)*rim*0.22;
  float e=max(uEmis,glow);
  col=mix(col,base*1.08,e);
  float f=clamp((length(vW-uCam)-uFN)/(uFF-uFN),0.0,1.0);
  col=mix(col,uFog,f*f*(1.0-e*0.5));
  gl_FragColor=vec4(col,uAlpha);}`;
  const SVS = `precision highp float;attribute vec3 aPos;uniform mat4 uLVP;uniform mat4 uM;void main(){gl_Position=uLVP*uM*vec4(aPos,1.0);}`;
  const SFS = `precision highp float;
vec4 pack(float d){vec4 r=fract(d*vec4(16777216.0,65536.0,256.0,1.0));r-=r.xxyz*vec4(0.0,1.0/256.0,1.0/256.0,1.0/256.0);return r;}
void main(){gl_FragColor=pack(gl_FragCoord.z);}`;

  let rid = 0;
  function Renderer(canvas, opts) {
    opts = opts || {};
    this.id = ++rid; this.canvas = canvas; this.dprCap = opts.dpr || 2; this.dprNow = this.dprCap;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('Sin WebGL');
    this.gl = gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNor'); gl.bindAttribLocation(p, 2, 'aCol'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    this.pr = prog(VS, FS);
    this.u = {}; ['uVP', 'uM', 'uN', 'uLVP', 'uColor', 'uL', 'uSky', 'uGnd', 'uSun', 'uFog', 'uCam', 'uEmis', 'uAlpha', 'uFN', 'uFF', 'uShine', 'uAoY', 'uSM', 'uSh', 'uTx'].forEach(k => { this.u[k] = gl.getUniformLocation(this.pr, k); });
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.white = gl.createBuffer(); this.whiteN = 0;
    this.env = { sky: rgb(0xbfd6ff), gnd: rgb(0x5a4a6a), sun: rgb(0xffffff), light: [.45, .8, .4], fog: rgb(0xbfd6ff), fogNear: 40, fogFar: 140, aoY: 0, shadowArea: 26 };
    this.envSun = .75; this.envAmb = .55;
    this.P = m4(); this.V = m4(); this.VP = m4(); this.LV = m4(); this.LP = m4(); this.LVP = m4(); this.W = 1; this.H = 1;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    // sombras
    this.shadows = opts.shadows !== false && !G.__pruebaSinSombras;
    try { this.initShadow(gl, prog, opts.shadowSize || 1024); } catch (e) { this.shadows = false; }
    // calidad automática
    this.ft = 1 / 60; this.lastT = 0; this.slow = 0; this.quality = 2;
  }
  Renderer.prototype.initShadow = function (gl, prog, size) {
    const s = this.sm = { size, prog: prog(SVS, SFS) };
    s.uLVP = gl.getUniformLocation(s.prog, 'uLVP'); s.uM = gl.getUniformLocation(s.prog, 'uM');
    s.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    s.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, s.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
    s.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, s.tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, s.rb);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('fbo');
  };
  Renderer.prototype.setEnv = function (o) {
    const e = this.env;
    if (o.sky != null) e.sky = rgb(o.sky); if (o.gnd != null) e.gnd = rgb(o.gnd); if (o.sun != null) e.sun = rgb(o.sun);
    if (o.fog != null) e.fog = rgb(o.fog); if (o.fogNear != null) e.fogNear = o.fogNear; if (o.fogFar != null) e.fogFar = o.fogFar;
    if (o.light) e.light = nrm(o.light);
    if (o.aoY != null) e.aoY = o.aoY; if (o.shadowArea != null) e.shadowArea = o.shadowArea;
    if (o.amb != null) this.envAmb = o.amb; if (o.sunK != null) this.envSun = o.sunK;
  };
  Renderer.prototype.resize = function () {
    const c = this.canvas, dpr = Math.min(G.devicePixelRatio || 1, this.dprNow);
    const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
    this.W = w; this.H = h;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  };
  Renderer.prototype.buf = function (g) {
    let b = g.bufs[this.id];
    if (!b) {
      const gl = this.gl; b = { p: gl.createBuffer(), n: gl.createBuffer(), c: null };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.STATIC_DRAW);
      if (g.col) { b.c = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.c); gl.bufferData(gl.ARRAY_BUFFER, g.col, gl.STATIC_DRAW); }
      g.bufs[this.id] = b;
    }
    return b;
  };
  Renderer.prototype.ensureWhite = function (n) {
    if (n <= this.whiteN) return;
    const gl = this.gl, a = new Float32Array(n * 3).fill(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.white); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); this.whiteN = n;
  };
  Renderer.prototype.free = function (g) {
    const b = g.bufs[this.id]; if (!b) return; const gl = this.gl;
    gl.deleteBuffer(b.p); gl.deleteBuffer(b.n); if (b.c) gl.deleteBuffer(b.c); delete g.bufs[this.id];
  };
  const drawList = [], transList = [];
  Renderer.prototype.render = function (root, cam) {
    if (this.lost) return;
    const gl = this.gl, u = this.u, e = this.env;
    // calidad automática según lo que tarda cada fotograma
    const now = performance.now(); if (this.lastT) { const dt = Math.min(.2, (now - this.lastT) / 1000); this.ft = this.ft * .93 + dt * .07; } this.lastT = now;
    if (this.ft > .028) { this.slow += 1; if (this.slow > 90 && this.quality > 0) { this.quality--; this.slow = 0; if (this.quality === 1) this.dprNow = Math.min(this.dprNow, 1.5); else { this.shadows = false; this.dprNow = 1.2; } } } else this.slow = Math.max(0, this.slow - 1);
    this.resize();
    perspective(this.P, (cam.fov || 50) * Math.PI / 180, this.W / this.H, cam.near || .2, cam.far || 500);
    this.P[8] += cam.shiftX || 0; this.P[9] += cam.shiftY || 0;
    lookAt(this.V, cam.pos, cam.target, cam.up || [0, 1, 0]);
    mul(this.VP, this.P, this.V);
    root.update(null);
    drawList.length = 0; transList.length = 0;
    const collect = n => { if (!n.visible) return; if (n.geo && n.alpha > .003) (n.alpha < 1 || n.additive ? transList : drawList).push(n); for (const c of n.children) collect(c); };
    collect(root);
    gl.enableVertexAttribArray(0);
    // 1) mapa de sombras
    const useSh = this.shadows && this.sm;
    if (useSh) {
      const s = this.sm, a = e.shadowArea, c = cam.shadowCenter || cam.target, L = e.light;
      const tx = a * 2 / s.size, cx = Math.round(c[0] / tx) * tx, cz = Math.round(c[2] / tx) * tx;
      const eye = [cx + L[0] * 80, c[1] + L[1] * 80, cz + L[2] * 80];
      lookAt(this.LV, eye, [cx, c[1], cz], Math.abs(L[1]) > .98 ? [0, 0, 1] : [0, 1, 0]);
      ortho(this.LP, a, 1, 200); mul(this.LVP, this.LP, this.LV);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo); gl.viewport(0, 0, s.size, s.size);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(s.prog); gl.uniformMatrix4fv(s.uLVP, false, this.LVP);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disable(gl.BLEND);
      for (const n of drawList) {
        if (!n.cast) continue;
        const b = this.buf(n.geo); gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(s.uM, false, n.world); gl.drawArrays(gl.TRIANGLES, 0, n.geo.count);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // 2) escena
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.pr);
    gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.uniformMatrix4fv(u.uVP, false, this.VP); gl.uniformMatrix4fv(u.uLVP, false, this.LVP);
    gl.uniform3fv(u.uL, e.light);
    gl.uniform3f(u.uSky, e.sky[0] * this.envAmb, e.sky[1] * this.envAmb, e.sky[2] * this.envAmb);
    gl.uniform3f(u.uGnd, e.gnd[0] * this.envAmb, e.gnd[1] * this.envAmb, e.gnd[2] * this.envAmb);
    gl.uniform3f(u.uSun, e.sun[0] * this.envSun, e.sun[1] * this.envSun, e.sun[2] * this.envSun);
    gl.uniform3fv(u.uFog, e.fog); gl.uniform3fv(u.uCam, cam.pos);
    gl.uniform1f(u.uFN, e.fogNear); gl.uniform1f(u.uFF, e.fogFar); gl.uniform1f(u.uAoY, e.aoY);
    gl.uniform1f(u.uSh, useSh ? 1 : 0);
    if (useSh) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uSM, 0); gl.uniform1f(u.uTx, 1.2 / this.sm.size); }
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const n of drawList) this.drawNode(n);
    if (transList.length) {
      const cp = cam.pos;
      transList.forEach(n => { const w = n.world; n._d = (w[12] - cp[0]) ** 2 + (w[13] - cp[1]) ** 2 + (w[14] - cp[2]) ** 2; });
      transList.sort((a, b) => b._d - a._d);
      gl.enable(gl.BLEND); gl.depthMask(false);
      for (const n of transList) {
        if (n.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.drawNode(n);
      }
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
  };
  Renderer.prototype.drawNode = function (n) {
    const gl = this.gl, u = this.u, g = n.geo, b = this.buf(g);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    if (b.c) gl.bindBuffer(gl.ARRAY_BUFFER, b.c); else { this.ensureWhite(g.count); gl.bindBuffer(gl.ARRAY_BUFFER, this.white); }
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(u.uM, false, n.world); gl.uniformMatrix3fv(u.uN, false, normalMat(NM, n.world));
    gl.uniform3fv(u.uColor, n.color); gl.uniform1f(u.uEmis, n.emis); gl.uniform1f(u.uAlpha, n.alpha); gl.uniform1f(u.uShine, n.shine);
    gl.drawArrays(gl.TRIANGLES, 0, g.count);
  };
  Renderer.prototype.project = function (p) {
    const m = this.VP, x = p[0], y = p[1], z = p[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= .01) return { x: -999, y: -999, vis: false };
    return { x: (cx / cw * .5 + .5) * this.W, y: (1 - (cy / cw * .5 + .5)) * this.H, vis: true };
  };

  /* ---------- partículas ---------- */
  function FX(scene) { this.scene = scene; this.list = []; this.pool = []; this.rings = []; }
  FX.prototype.spawn = function (g) {
    let n = this.pool.pop();
    if (!n) n = new Node(g || geo.box, 0xffffff); else n.geo = g || geo.box;
    n.visible = true; n.cast = false; this.scene.add(n); return n;
  };
  FX.prototype.burst = function (p, count, o) {
    o = o || {};
    const cols = (o.colors || [0xffffff]).map(rgb);
    for (let i = 0; i < count; i++) {
      const n = this.spawn(o.geo || (o.add ? geo.oct : geo.rbox(1, 1, 1, .22)));
      const a = Math.random() * TAU, el = (o.flat ? .1 : .25) + Math.random() * (o.flat ? .3 : .75), sp = (o.speed || 6) * (.45 + Math.random() * .7);
      n.pos = [p[0] + (Math.random() - .5) * (o.spread || .3), p[1] + (Math.random() - .5) * (o.spread || .3), p[2] + (Math.random() - .5) * (o.spread || .3)];
      n.color = cols[(Math.random() * cols.length) | 0];
      n.emis = o.emis == null ? .7 : o.emis; n.additive = !!o.add; n.alpha = 1;
      const s = (o.size || .22) * (.6 + Math.random() * .8); n.scl = [s, s, s]; n.rot = [Math.random() * 6, Math.random() * 6, 0];
      const life = (o.life || .8) * (.6 + Math.random() * .6);
      this.list.push({ n, v: [Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp * (o.up == null ? 1 : o.up) + (o.lift || 0), Math.sin(a) * Math.cos(el) * sp], life, max: life, g: o.grav == null ? 14 : o.grav, s, spin: (Math.random() - .5) * 12, drag: o.drag || 1.5, fade: !!o.fade, floor: o.floor == null ? .05 : o.floor });
    }
  };
  FX.prototype.ring = function (p, color, maxR, life, o) {
    o = o || {};
    const n = this.spawn(o.thin ? geo.thin : geo.torus); n.pos = [p[0], p[1], p[2]]; n.color = rgb(color); n.emis = 1; n.additive = o.add !== false; n.alpha = 1; n.rot = [o.tilt || 0, o.yaw || 0, 0];
    this.rings.push({ n, t: 0, life: life || .5, maxR: maxR || 4, thick: o.thick || 1 });
  };
  // corte curvo (para los golpes): un arco brillante que barre y se desvanece
  FX.prototype.slash = function (p, yaw, color, r, life, tilt) {
    const n = this.spawn(geo.arc); n.pos = [p[0], p[1], p[2]]; n.color = rgb(color); n.emis = 1; n.additive = true; n.alpha = 1;
    n.rot = [tilt || 0, yaw, 0]; n.scl = [r * 2, 1.6, r * 2];
    this.rings.push({ n, t: 0, life: life || .22, maxR: r, thick: 1.6, slash: true, yaw });
  };
  FX.prototype.update = function (dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i]; q.life -= dt;
      if (q.life <= 0) { this.scene.remove(q.n); this.pool.push(q.n); this.list.splice(i, 1); continue; }
      q.v[1] -= q.g * dt; const d = Math.pow(.5, dt * q.drag); q.v[0] *= d; q.v[2] *= d;
      q.n.pos[0] += q.v[0] * dt; q.n.pos[1] += q.v[1] * dt; q.n.pos[2] += q.v[2] * dt;
      if (q.n.pos[1] < q.floor && q.g > 0) { q.n.pos[1] = q.floor; q.v[1] *= -.3; }
      q.n.rot[0] += q.spin * dt; q.n.rot[1] += q.spin * dt * .7;
      const k = q.life / q.max, s = q.s * (q.fade ? 1 : Math.min(1, k * 1.6)); q.n.scl = [s, s, s];
      if (q.fade || q.n.additive) q.n.alpha = Math.min(1, k * 1.8);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.n); this.pool.push(r.n); this.rings.splice(i, 1); continue; }
      if (r.slash) { r.n.rot[1] = r.yaw - .9 + ease.out(k) * 1.5; r.n.alpha = (1 - k); const s = r.maxR * 2 * (.85 + k * .25); r.n.scl = [s, 1.6 * (1 - k * .5), s]; continue; }
      const R = lerp(.4, r.maxR, ease.out(k)) * 2; r.n.scl = [R, r.thick * (1 + k * 2), R]; r.n.alpha = (1 - k) * .95;
    }
  };
  FX.prototype.clear = function () {
    this.list.forEach(q => { this.scene.remove(q.n); this.pool.push(q.n); }); this.list = [];
    this.rings.forEach(r => { this.scene.remove(r.n); this.pool.push(r.n); }); this.rings = [];
  };

  // Motas que flotan en el aire (polen, chispas, nieve...): dan vida a la escena
  function Motes(scene, o) {
    o = Object.assign({ n: 40, area: [30, 12, 30], center: [0, 4, 0], color: 0xffffff, size: .12, speed: .6, fall: 0, add: true, alpha: .8 }, o);
    this.o = o; this.items = [];
    for (let i = 0; i < o.n; i++) {
      const n = new Node(o.geo || geo.oct, o.color, { emis: 1, add: o.add, alpha: o.alpha, cast: false });
      const s = o.size * (.5 + Math.random()); n.scl = [s, s, s]; scene.add(n);
      this.items.push({ n, x: (Math.random() - .5) * o.area[0], y: Math.random() * o.area[1], z: (Math.random() - .5) * o.area[2], ph: Math.random() * TAU });
    }
  }
  Motes.prototype.update = function (dt, t) {
    const o = this.o;
    for (const m of this.items) {
      m.y -= o.fall * dt; if (m.y < 0) m.y += o.area[1]; if (m.y > o.area[1]) m.y -= o.area[1];
      m.n.pos = [o.center[0] + m.x + Math.sin(t * o.speed + m.ph) * 1.2, o.center[1] + m.y + Math.sin(t * o.speed * 1.3 + m.ph) * .4 - o.area[1] / 2, o.center[2] + m.z + Math.cos(t * o.speed + m.ph) * 1.2];
      m.n.rot[1] = t + m.ph; m.n.alpha = o.alpha * (.5 + .5 * Math.sin(t * 2 + m.ph));
    }
  };

  /* ---------- decorado reutilizable ---------- */
  function cloud(g, x, y, z, s, col) {
    const c = col || 0xffffff;
    [[0, 0, 0, 1.6], [1.3, -.2, .2, 1.2], [-1.4, -.25, -.1, 1.15], [.5, .5, -.3, 1.2], [-.5, .35, .4, 1.0], [2.3, -.45, 0, .8], [-2.3, -.4, .1, .75]]
      .forEach(([a, b, d, r]) => mesh(g, geo.ball, c, r * 2 * s, r * 1.7 * s, r * 2 * s, x + a * s, y + b * s, z + d * s, { emis: .35, shine: 0, vary: false }));
  }
  function flower(g, x, z, col, s) {
    s = s || 1;
    box(g, .08 * s, .6 * s, .08 * s, 0x3e8a4a, x, .3 * s, z, { r: 0 });
    mesh(g, geo.gem, col, .62 * s, .2 * s, .62 * s, x, .64 * s, z, { rot: [0, x, 0] });
    mesh(g, geo.gem, 0xffe27a, .22 * s, .2 * s, .22 * s, x, .72 * s, z);
  }
  function tuft(g, x, z, col, s) {
    s = s || 1;
    for (let i = 0; i < 3; i++) mesh(g, geo.cone6, col, .22 * s, (.6 + i * .15) * s, .22 * s, x + (i - 1) * .14 * s, (.3 + i * .07) * s, z + (i % 2) * .1, { rot: [(i - 1) * .25, 0, (i - 1) * .3] });
  }
  function rock(g, x, y, z, s, col) { mesh(g, geo.rock, col || 0x8a8698, s * 1.3, s, s * 1.1, x, y + s * .3, z, { rot: [0, x * 3 + z, 0] }); }
  function bush(g, x, z, s, col) { col = col || 0x4fae5a; mesh(g, geo.ballS, col, 1.6 * s, 1.3 * s, 1.6 * s, x, .55 * s, z); mesh(g, geo.ballS, col, 1.1 * s, .9 * s, 1.1 * s, x + .6 * s, .45 * s, z + .3 * s); mesh(g, geo.ballS, col, 1.1 * s, 1 * s, 1.1 * s, x - .6 * s, .45 * s, z - .2 * s); }
  // reparte cosas por una zona, evitando un hueco (para no tapar a los personajes)
  function scatter(n, area, avoid, seed, fn) {
    const R = rng(seed || 3);
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const x = (R() - .5) * area[0] + (area[2] || 0), z = (R() - .5) * area[1] + (area[3] || 0);
      if (avoid && Math.abs(x - avoid[0]) < avoid[2] && Math.abs(z - avoid[1]) < avoid[3]) continue;
      fn(x, z, R, i); i++;
    }
  }

  /* ---------- avatar ---------- */
  function avatar(o) {
    o = Object.assign({ skin: 0xf6d2bd, shirt: 0x3a6df0, pants: 0x262a40, shoes: 0x1c1c26, hairCol: 0x3a2418, hair: 'short' }, o || {});
    const root = group(), body = group(); root.add(body);
    const P = {};
    const leg = side => {
      const piv = group().at(side * .5, 1.9, 0); body.add(piv);
      box(piv, .9, 1.6, .94, o.dress ? o.skin : o.pants, 0, -.8, 0, { r: .2 });
      box(piv, .98, .4, 1.14, o.shoes, 0, -1.72, .07, { r: .17, shine: .6 });
      box(piv, 1.0, .1, 1.16, 0xffffff, 0, -1.88, .07, { r: .04 });
      if (o.dress) box(piv, .94, .16, .98, 0xffffff, 0, -1.44, 0, { r: .07 });
      return piv;
    };
    P.legL = leg(-1); P.legR = leg(1);
    P.torso = group().at(0, 2.85, 0); body.add(P.torso);
    box(P.torso, 2, 1.9, 1, o.shirt, 0, 0, 0, { r: .26 });
    if (o.dress) {
      mesh(P.torso, geo.skirt, o.shirt, 2.6, 1.1, 1.75, 0, -1.25, 0, { shine: .5 });
      box(P.torso, 2.06, .2, 1.06, o.belt || 0xffffff, 0, -.78, 0, { r: .08, shine: .7 });
      mesh(P.torso, geo.oct, 0xf2c14e, .26, .26, .12, 0, -.78, .56, { emis: .3, shine: 1 });
      box(P.torso, 1.2, .14, .06, o.shirt, 0, .9, .5, { r: .05 });
    } else {
      box(P.torso, .7, .3, .08, 0xffffff, 0, .78, .5, { r: .1 });     // cuello
      box(P.torso, 2.04, .24, 1.04, 0x1c1c26, 0, -.86, 0, { r: .1 }); // cinturón
      mesh(P.torso, geo.ball, 0xffd23f, .3, .3, .1, 0, .1, .52, { emis: .4 });
    }
    if (o.necklace) { box(P.torso, .9, .05, .04, 0xd8dbe6, 0, .62, .52, { r: 0, emis: .3 }); mesh(P.torso, geo.oct, 0xf2c14e, .22, .26, .08, 0, .45, .53, { emis: .45, shine: 1 }); }
    const arm = side => {
      const piv = group().at(side * 1.47, 3.7, 0); body.add(piv);
      box(piv, .88, 1.85, .9, o.sleeves ? o.shirt : o.skin, 0, -.82, 0, { r: .26 });
      if (o.sleeves === 'short') box(piv, .94, .72, .96, o.shirt, 0, -.25, 0, { r: .22 });
      if (o.bracelet) box(piv, .96, .16, .98, side < 0 ? 0x16161c : 0xc9cbd6, 0, -1.4, 0, { r: .07, shine: .9 });
      return piv;
    };
    P.armL = arm(-1); P.armR = arm(1);
    P.head = group().at(0, 4.42, 0); body.add(P.head);
    box(P.head, 1.32, 1.26, 1.26, o.skin, 0, 0, 0, { r: .36 });
    const eye = x => { const e = group().at(x, .08, .63); P.head.add(e); box(e, .17, .27, .06, 0x1b1420, 0, 0, 0, { r: .07, shine: .9 }); box(e, .06, .07, .03, 0xffffff, .03, .06, .035, { r: 0, emis: 1 }); return e; };
    P.eyes = [eye(-.27), eye(.27)];
    box(P.head, .22, .05, .04, o.hairCol, -.27, .3, .63, { r: 0, rot: [0, 0, .12] }); box(P.head, .22, .05, .04, o.hairCol, .27, .3, .63, { r: 0, rot: [0, 0, -.12] });
    P.mouth = mesh(P.head, geo.arc, 0x5b2330, .5, .4, .5, 0, -.18, .6, { rot: [Math.PI / 2, 0, Math.PI * .69], shine: 0 });
    if (o.blush) { mesh(P.head, geo.ball, 0xff9fb0, .22, .1, .04, -.46, -.12, .63, { alpha: .75 }); mesh(P.head, geo.ball, 0xff9fb0, .22, .1, .04, .46, -.12, .63, { alpha: .75 }); }
    const H = o.hairCol, HL = o.hairHi || H, hs = { shine: .55 };
    if (o.hair === 'long') {
      box(P.head, 1.46, .4, 1.42, H, 0, .62, -.02, { r: .2, shine: .55 });
      box(P.head, 1.46, 2.3, .38, H, 0, -.45, -.6, { r: .18, shine: .55 });
      box(P.head, .26, 1.95, 1.22, H, -.72, -.35, -.04, { r: .12, shine: .55 }); box(P.head, .26, 1.95, 1.22, H, .72, -.35, -.04, { r: .12, shine: .55 });
      box(P.head, .3, 1.55, .24, H, -.57, -.15, .62, { r: .12, shine: .55 }); box(P.head, .3, 1.55, .24, H, .57, -.15, .62, { r: .12, shine: .55 });
      box(P.head, .12, 1.5, .26, HL, -.46, -.12, .63, { r: .05, shine: .7 }); box(P.head, .12, 1.5, .26, HL, .46, -.12, .63, { r: .05, shine: .7 });
      box(P.head, .9, .16, .22, H, 0, .52, .62, { r: .07 });
      box(P.head, .14, 1.9, .38, HL, -.4, -.5, -.64, { r: .06, shine: .7 }); box(P.head, .14, 1.9, .38, HL, .35, -.5, -.64, { r: .06, shine: .7 });
      box(P.head, 1.3, .5, .3, H, 0, -1.6, -.52, { r: .14, shine: .55, rot: [.25, 0, 0] });
    } else {
      box(P.head, 1.44, .44, 1.4, H, 0, .6, -.02, { r: .2, shine: .5 });
      box(P.head, 1.44, .82, .32, H, 0, .25, -.6, { r: .14, shine: .5 });
      box(P.head, .22, .62, 1.12, H, -.71, .3, -.1, { r: .1 }); box(P.head, .22, .62, 1.12, H, .71, .3, -.1, { r: .1 });
      box(P.head, .76, .24, .26, H, -.2, .52, .62, { r: .1, rot: [0, 0, .12] }); box(P.head, .5, .2, .24, H, .38, .55, .6, { r: .08, rot: [0, 0, -.2] });
    }
    if (o.glasses) {
      P.glasses = group().at(0, .12, .67); P.head.add(P.glasses);
      box(P.glasses, 1.5, .3, .07, 0x111116, 0, .02, 0, { r: 0, shine: 1 });
      box(P.glasses, .44, .12, .07, 0x111116, -.32, -.18, 0, { r: 0 }); box(P.glasses, .44, .12, .07, 0x111116, .32, -.18, 0, { r: 0 });
      [[-.5, .06], [-.38, -.06], [-.26, .06], [.14, .06], [.26, -.06], [.38, .06]].forEach(([x, y]) => box(P.glasses, .1, .1, .03, 0xffffff, x, y, .045, { r: 0, emis: .6 }));
      P.lens = [box(P.glasses, .56, .26, .02, o.glassGlow || 0xff4fd8, -.3, 0, .06, { r: 0, emis: 1, add: true, alpha: 0 }), box(P.glasses, .56, .26, .02, o.glassGlow || 0x7df3ff, .3, 0, .06, { r: 0, emis: 1, add: true, alpha: 0 })];
    }
    if (o.cape) {
      P.cape = group().at(0, 3.75, -.55); body.add(P.cape);
      box(P.cape, 2.1, 3.0, .14, o.cape, 0, -1.45, 0, { r: .06, shine: .6 });
      box(P.cape, 2.12, .2, .16, o.capeTrim || 0xf2c14e, 0, -2.9, 0, { r: .05, emis: .3, shine: 1 });
      mesh(P.cape, geo.ball, o.capeTrim || 0xf2c14e, .34, .34, .2, -.85, .05, .14, { emis: .4 }); mesh(P.cape, geo.ball, o.capeTrim || 0xf2c14e, .34, .34, .2, .85, .05, .14, { emis: .4 });
    }
    P.shadow = mesh(root, geo.cyl20, 0x000000, 2.4, .02, 2.4, 0, .03, 0, { alpha: .16, cast: false });

    const A = { root, body, P, t: Math.random() * 10, walk: 0, blink: 2, look: 0 };
    A.animate = function (dt, speed, pose) {
      A.t += dt; A.walk += dt * (6 + speed * 6) * (speed > .02 ? 1 : 0);
      const k = clamp(speed, 0, 1), sw = Math.sin(A.walk) * .75 * k;
      const breathe = Math.sin(A.t * 2.2);
      P.legL.rot = [sw, 0, 0]; P.legR.rot = [-sw, 0, 0];
      P.armL.rot = [-sw * .9, 0, -.07 - breathe * .03 - k * .05]; P.armR.rot = [sw * .9, 0, .07 + breathe * .03 + k * .05];
      P.head.rot = [Math.sin(A.t * .9) * .03, Math.sin(A.t * .5) * .12 * (1 - k), Math.sin(A.t * .7) * .03];
      P.torso.rot = [k * .08, Math.sin(A.walk) * .08 * k, 0];
      P.torso.scl = [1, 1 + breathe * .012, 1];
      body.pos = [0, Math.abs(Math.sin(A.walk)) * .2 * k + breathe * .02, 0];
      body.rot = [0, 0, Math.sin(A.walk) * .03 * k];
      if (P.cape) P.cape.rot[0] = .12 + k * .6 + Math.sin(A.t * 6) * .06 * (.3 + k);
      A.blink -= dt; const b = A.blink < 0; if (A.blink < -.12) A.blink = 1.8 + Math.random() * 2.6;
      P.eyes.forEach(e => { e.scl[1] = b ? .15 : 1; });
      if (pose) pose(P, A);
    };
    return A;
  }

  /* ---------- sonidos sintetizados ---------- */
  function sfx() {
    let ac = null, master = null;
    const ensure = () => { if (!ac) { try { ac = new (G.AudioContext || G.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .9; master.connect(ac.destination); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    const tone = (f0, f1, dur, type, vol, delay) => {
      const a = ensure(); if (!a) return;
      try {
        const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .03);
      } catch (e) {}
    };
    const noise = (dur, vol, f, delay) => {
      const a = ensure(); if (!a) return;
      try {
        const t = a.currentTime + (delay || 0), len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
        fl.type = 'lowpass'; fl.frequency.value = f || 1200; g.gain.value = vol;
        s.buffer = buf; s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
      } catch (e) {}
    };
    return { unlock: ensure, tone, noise };
  }

  G.M3 = { TAU, clamp, lerp, smooth, ease, rng, rgb, geo, Node, group, box, mesh, bake, Renderer, FX, Motes, avatar, sfx, Geo, cloud, flower, tuft, rock, bush, scatter };
})(window);
