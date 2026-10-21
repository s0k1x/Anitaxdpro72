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
  geo.hair = torusGeo(72, 4, .012);
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
  // contorno para todo un grupo (personajes, monstruos...)
  Node.prototype.outlined = function (col, w) {
    const c = rgb(col == null ? 0x14102a : col);
    const walk = n => { if (n.geo && n.alpha >= 1 && !n.additive && n.cast !== false && n.geo !== geo.arc) { n.outline = c; n.outlineW = w || .05; } n.children.forEach(walk); };
    walk(this); return this;
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
  function mergeNodes(list, seed, o) {
    const R = rng(seed || 7);
    let total = 0; for (const n of list) total += n.geo.count;
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
    let k0 = 0;
    for (const n of list) {
      const m = n.world, g = n.geo, k = n.vary ? .92 + R() * .1 : 1, nm = normalMat(new Float32Array(9), m);
      const e = n.emis || 0, cap = e > 0 ? 9 : .999;
      const c = [Math.min(cap, n.color[0] * k), Math.min(cap, n.color[1] * k), Math.min(cap, n.color[2] * k)];
      const f = e > 0 ? 1 + e * 1.4 : 1, gc = g.col;
      for (let i = 0; i < g.count; i++, k0++) {
        const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
        P[k0 * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; P[k0 * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; P[k0 * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        const nx = g.nor[i * 3], ny = g.nor[i * 3 + 1], nz = g.nor[i * 3 + 2];
        let a = nm[0] * nx + nm[3] * ny + nm[6] * nz, bb = nm[1] * nx + nm[4] * ny + nm[7] * nz, d = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const l = Math.hypot(a, bb, d) || 1; N[k0 * 3] = a / l; N[k0 * 3 + 1] = bb / l; N[k0 * 3 + 2] = d / l;
        const v0 = gc ? gc[i * 3] : 1, v1 = gc ? gc[i * 3 + 1] : 1, v2 = gc ? gc[i * 3 + 2] : 1;
        C[k0 * 3] = c[0] * f * v0; C[k0 * 3 + 1] = c[1] * f * v1; C[k0 * 3 + 2] = c[2] * f * v2;
      }
    }
    return new Node(new Geo(P, N, C), 0xffffff, Object.assign({ shine: .22 }, o || {}));
  }
  // Funde el decorado fijo en una sola malla (1 llamada de dibujo). Cada pieza varía un poco de tono.
  function bake(grp, seed) {
    grp.update(null);
    const list = [];
    const walk = n => { if (!n.visible) return; if (n.geo) list.push(n); n.children.forEach(walk); };
    walk(grp);
    return mergeNodes(list, seed);
  }
  // Funde las piezas rígidas opacas de un grupo (p. ej. la cabeza con todo el pelo) en una sola malla
  // y deja intactas las que se animan por separado (skip). Mismo aspecto, muchas menos llamadas de dibujo.
  function bakeInto(g, skip, o) {
    const sv = [g.pos.slice(), g.rot.slice(), g.scl.slice()];
    g.pos = [0, 0, 0]; g.rot = [0, 0, 0]; g.scl = [1, 1, 1]; g.update(null);
    const list = [];
    const walk = n => { for (const c of n.children.slice()) { if (skip && skip.has(c)) continue; if (c.geo && c.alpha >= 1 && !c.additive && c.visible && !c.children.length) list.push(c); else walk(c); } };
    walk(g);
    if (list.length > 1) {
      const node = mergeNodes(list, 3, Object.assign({ vary: false, shine: .4 }, o || {}));
      list.forEach(n => { if (n.parent) n.parent.remove(n); });
      g.add(node);
    }
    g.pos = sv[0]; g.rot = sv[1]; g.scl = sv[2];
    return g;
  }

  /* =========================================================
     RENDERIZADOR
     1) mapa de sombras  2) cielo + escena a una textura
     3) postprocesado: resplandor (bloom) en dos tamaños, desenfoque de
        maqueta (tilt-shift), tono de cine (ACES), color por mundo,
        viñeta, grano y antialiasing (FXAA)
     ========================================================= */
  const HIGH = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
  const VS = `precision highp float;
attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;
uniform mat4 uVP;uniform mat4 uM;uniform mat4 uLVP;uniform mat3 uN;uniform float uWind;uniform float uTime;
varying vec3 vN;varying vec3 vC;varying vec3 vW;varying vec4 vL;
void main(){vec4 w=uM*vec4(aPos,1.0);
if(uWind>0.0){float h=max(aPos.y,0.0);float s=sin(uTime*1.9+w.x*0.31+w.z*0.17)+0.45*sin(uTime*3.7+w.x*0.83-w.z*0.6);w.x+=s*0.32*h*h*uWind;w.z+=s*0.14*h*h*uWind;}
vW=w.xyz;vN=uN*aNor;vC=aCol;vL=uLVP*w;gl_Position=uVP*w;}`;
  const FS = HIGH + `
varying vec3 vN;varying vec3 vC;varying vec3 vW;varying vec4 vL;
uniform vec3 uColor;uniform vec3 uL;uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uSun;uniform vec3 uFog;uniform vec3 uCam;
uniform float uEmis;uniform float uAlpha;uniform float uFN;uniform float uFF;uniform float uShine;uniform float uAoY;
uniform sampler2D uSM;uniform float uSh;uniform float uTx;uniform float uToon;
float unpack(vec4 c){return dot(c,vec4(1.0/16777216.0,1.0/65536.0,1.0/256.0,1.0));}
float tap(vec2 p,float z){return step(z,unpack(texture2D(uSM,p)));}
float shadowF(float ndl){
  if(uSh<0.5)return 1.0;
  vec3 p=vL.xyz/vL.w*0.5+0.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0)return 1.0;
  float z=p.z-(0.0016+0.0045*(1.0-ndl));vec2 t=vec2(uTx);
  float s=tap(p.xy,z)*2.0;
  s+=tap(p.xy+vec2(-0.94,-0.34)*t,z)+tap(p.xy+vec2(0.95,-0.29)*t,z)+tap(p.xy+vec2(-0.09,-0.92)*t,z)+tap(p.xy+vec2(0.34,0.94)*t,z);
  s+=tap(p.xy+vec2(-0.82,0.54)*t,z)+tap(p.xy+vec2(0.54,0.18)*t*1.8,z)+tap(p.xy+vec2(-0.4,0.1)*t*1.9,z)+tap(p.xy+vec2(0.1,-0.5)*t*2.0,z);
  return s/10.0;}
void main(){
  vec3 n=normalize(vN);vec3 base=uColor*vC;
  float glow=max(max(base.r,base.g),base.b)>1.0?1.0:0.0;
  base=min(base,vec3(1.0));
  vec3 V=normalize(uCam-vW);
  if(dot(n,V)<-0.2)n=-n;
  float h=n.y*0.5+0.5;vec3 amb=mix(uGnd,uSky,h*h*(3.0-2.0*h));
  float ndl=dot(n,uL);
  float hl=ndl*0.5+0.5;float warp=hl*hl;
  float sh=shadowF(max(ndl,0.0));
  float ao=mix(1.0,mix(0.55,1.0,clamp((vW.y-uAoY)/1.8,0.0,1.0)),1.0-max(n.y,0.0));
  float lit=warp*mix(0.35,1.0,sh)*smoothstep(-0.1,0.25,ndl+0.15);
  vec3 cool=mix(amb,amb*vec3(0.86,0.92,1.12),0.6);
  vec3 H=normalize(uL+V);
  float spec=pow(max(dot(n,H),0.0),36.0)*uShine*sh;
  float fres=pow(1.0-max(dot(n,V),0.0),4.0);
  if(uToon>0.5){
    // sombreado anime: dos tonos con borde limpio, sombra fría, brillo duro y luz de contorno
    float l=max(ndl,0.0)*mix(0.25,1.0,sh);
    lit=smoothstep(0.08,0.16,l)*0.9+smoothstep(0.62,0.7,l)*0.18;
    ao=mix(0.82,1.0,ao);
    spec=step(0.93,max(dot(n,H),0.0))*uShine*0.8*sh;
    fres=smoothstep(0.56,0.62,1.0-max(dot(n,V),0.0))*0.55*smoothstep(-0.4,0.3,ndl);
  }
  vec3 col=base*(cool*ao+uSun*lit);
  col+=uSun*spec*0.6;
  col+=uSky*fres*(0.12+uShine*0.25)+uSun*fres*max(n.y,0.0)*0.35*sh;
  float e=max(uEmis,glow);
  col=mix(col,base*1.25,e);
  float d=length(vW-uCam);
  float f=clamp((d-uFN)/(uFF-uFN),0.0,1.0);f=f*f*(3.0-2.0*f);
  float hf=exp(-max(vW.y-uAoY,0.0)*0.03);
  col=mix(col,uFog,f*(1.0-e*0.6)*mix(0.75,1.0,hf));
  gl_FragColor=vec4(col,uAlpha);}`;
  const SVS = `precision highp float;attribute vec3 aPos;uniform mat4 uLVP;uniform mat4 uM;void main(){gl_Position=uLVP*uM*vec4(aPos,1.0);}`;
  // contorno de silueta: "casco invertido" algo más grande, dibujado detrás del objeto
  const OVS = `precision highp float;attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uVP;uniform mat4 uM;uniform mat3 uN;uniform float uW;uniform vec3 uCam;
void main(){vec4 w=uM*vec4(aPos,1.0);vec3 n=normalize(uN*aNor);float d=length(uCam-w.xyz);w.xyz+=n*uW*clamp(d/14.0,0.7,2.2);gl_Position=uVP*w;}`;
  const OFS = `precision mediump float;uniform vec3 uC;void main(){gl_FragColor=vec4(uC,1.0);}`;
  const SFS = `precision highp float;
vec4 pack(float d){vec4 r=fract(d*vec4(16777216.0,65536.0,256.0,1.0));r-=r.xxyz*vec4(0.0,1.0/256.0,1.0/256.0,1.0/256.0);return r;}
void main(){gl_FragColor=pack(gl_FragCoord.z);}`;
  // pantalla completa
  const QVS = `precision highp float;attribute vec3 aPos;varying vec2 vUv;void main(){vUv=aPos.xy*0.5+0.5;gl_Position=vec4(aPos.xy,0.9999,1.0);}`;
  // cielo: degradado, sol, nubes y estrellas calculados por píxel
  const SKY = HIGH + `
varying vec2 vUv;uniform mat4 uIVP;uniform vec3 uCam;uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uBot;uniform vec3 uSunDir;uniform vec3 uSunCol;
uniform float uSunK;uniform float uStars;uniform float uClouds;uniform vec3 uCloudCol;uniform float uTime;
float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=noise(p)*a;p=p*2.03+vec2(1.7,9.2);a*=0.5;}return s;}
void main(){
  vec4 q=uIVP*vec4(vUv*2.0-1.0,1.0,1.0);vec3 dir=normalize(q.xyz/q.w-uCam);
  float y=dir.y;
  vec3 col=y>0.0?mix(uMid,uTop,pow(clamp(y,0.0,1.0),0.55)):mix(uMid,uBot,pow(clamp(-y,0.0,1.0),0.45));
  float sd=max(dot(dir,uSunDir),0.0);
  col+=uSunCol*(pow(sd,6.0)*0.35+pow(sd,60.0)*0.6)*uSunK;
  col=mix(col,uSunCol*1.6,smoothstep(0.9993,0.9997,sd)*uSunK);
  if(uStars>0.0&&y>-0.05){vec3 c=floor(dir*260.0);float s=hash(c);float tw=0.6+0.4*sin(uTime*3.0+s*80.0);col+=vec3(step(0.9972,s))*tw*uStars*smoothstep(-0.05,0.25,y);}
  if(uClouds>0.0&&y>0.0){vec2 p=dir.xz/(y+0.1)*0.9+vec2(uTime*0.012,0.0);float n=fbm(p)*0.75+fbm(p*2.7+3.0)*0.25;float c=smoothstep(0.52-uClouds*0.08,0.66,n)*smoothstep(0.0,0.14,y);
    float lit=smoothstep(0.5,0.8,fbm(p-vec2(0.06,0.09)*1.0));vec3 cc=mix(uCloudCol*vec3(0.74,0.8,0.92),uCloudCol*1.12,lit);col=mix(col,cc+uSunCol*pow(sd,5.0)*0.3,c*min(1.0,uClouds*1.2));}
  gl_FragColor=vec4(col,1.0);}`;
  const DOWN = HIGH + `varying vec2 vUv;uniform sampler2D uT;uniform vec2 uPx;uniform float uThr;
void main(){vec3 c=(texture2D(uT,vUv+uPx*vec2(-1,-1)).rgb+texture2D(uT,vUv+uPx*vec2(1,-1)).rgb+texture2D(uT,vUv+uPx*vec2(-1,1)).rgb+texture2D(uT,vUv+uPx*vec2(1,1)).rgb)*0.25;
if(uThr>0.0){float l=dot(c,vec3(0.2126,0.7152,0.0722));float mx=max(max(c.r,c.g),c.b);float sat=mx-min(min(c.r,c.g),c.b);float k=clamp((max(l,mx*0.85)-uThr)/(1.0-uThr+0.001),0.0,1.0);c*=k*k*k*(0.6+sat);}
gl_FragColor=vec4(c,1.0);}`;
  const BLUR = HIGH + `varying vec2 vUv;uniform sampler2D uT;uniform vec2 uDir;
void main(){vec3 c=texture2D(uT,vUv).rgb*0.2270270;
c+=(texture2D(uT,vUv+uDir*1.3846154).rgb+texture2D(uT,vUv-uDir*1.3846154).rgb)*0.3162162;
c+=(texture2D(uT,vUv+uDir*3.2307692).rgb+texture2D(uT,vUv-uDir*3.2307692).rgb)*0.0702703;
gl_FragColor=vec4(c,1.0);}`;
  const COMP = HIGH + `varying vec2 vUv;uniform sampler2D uS;uniform sampler2D uQ;uniform sampler2D uB1;uniform sampler2D uB2;uniform vec2 uPx;uniform vec2 uRes;
uniform float uImpact;uniform float uSpeed;uniform vec2 uSpeedC;
uniform float uExp;uniform float uSat;uniform float uCon;uniform vec3 uTint;uniform vec3 uLift;uniform float uBloom;uniform float uTilt;uniform float uTiltC;uniform float uVig;uniform float uGrain;uniform float uTime;uniform float uFlash;uniform vec3 uFlashCol;
vec3 fxaa(vec2 uv){
  vec3 L=vec3(0.299,0.587,0.114);
  vec3 nw=texture2D(uS,uv+vec2(-1.0,-1.0)*uPx).rgb,ne=texture2D(uS,uv+vec2(1.0,-1.0)*uPx).rgb,sw=texture2D(uS,uv+vec2(-1.0,1.0)*uPx).rgb,se=texture2D(uS,uv+vec2(1.0,1.0)*uPx).rgb,m=texture2D(uS,uv).rgb;
  float lnw=dot(nw,L),lne=dot(ne,L),lsw=dot(sw,L),lse=dot(se,L),lm=dot(m,L);
  float mn=min(lm,min(min(lnw,lne),min(lsw,lse))),mx=max(lm,max(max(lnw,lne),max(lsw,lse)));
  vec2 d=vec2(-((lnw+lne)-(lsw+lse)),((lnw+lsw)-(lne+lse)));
  float red=max((lnw+lne+lsw+lse)*0.03125,0.0078125);float rc=1.0/(min(abs(d.x),abs(d.y))+red);
  d=clamp(d*rc,-8.0,8.0)*uPx;
  vec3 a=0.5*(texture2D(uS,uv+d*(1.0/3.0-0.5)).rgb+texture2D(uS,uv+d*(2.0/3.0-0.5)).rgb);
  vec3 b=a*0.5+0.25*(texture2D(uS,uv-d*0.5).rgb+texture2D(uS,uv+d*0.5).rgb);
  float lb=dot(b,L);return (lb<mn||lb>mx)?a:b;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec3 c=fxaa(vUv);
  vec3 q=texture2D(uQ,vUv).rgb;
  float dy=abs(vUv.y-uTiltC);float k=smoothstep(0.24,0.62,dy)*uTilt*0.8;
  c=mix(c,q,k);
  c+=(texture2D(uB1,vUv).rgb*0.7+texture2D(uB2,vUv).rgb*0.8)*uBloom;
  c=aces(c*uExp);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,uSat);
  c=(c-0.5)*uCon+0.5;c=c*uTint+uLift*(1.0-c);
  vec2 v=(vUv-0.5)*vec2(1.0,1.2);c*=1.0-uVig*smoothstep(0.35,0.95,length(v));
  c+=(rnd(vUv*uRes+uTime)-0.5)*uGrain;
  if(uSpeed>0.0){vec2 d=vUv-uSpeedC;d.x*=uRes.x/uRes.y;float a=atan(d.y,d.x);float r=length(d);
    float id=floor(a*38.0);float n=fract(sin(id*12.9898+floor(uTime*24.0)*7.13)*43758.5453);
    float w=abs(fract(a*38.0)-0.5);float ln=step(0.78,n)*smoothstep(0.5,0.1,w)*smoothstep(0.28+n*0.25,0.75,r);
    c=mix(c,vec3(1.0),ln*uSpeed*0.75);}
  if(uImpact>0.0){float li=dot(c,vec3(0.3,0.59,0.11));vec3 inv=vec3(1.0-smoothstep(0.32,0.46,li));c=mix(c,inv,uImpact);}
  c=mix(c,uFlashCol,uFlash);
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);}`;

  // inversa de una matriz 4x4
  function invert(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7], a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return o; det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  }

  let rid = 0;
  function Renderer(canvas, opts) {
    opts = opts || {};
    this.id = ++rid; this.canvas = canvas; this.dprCap = opts.dpr || 2; this.dprNow = this.dprCap; this.dprMin = opts.dprMin || 1; this.stats = {};
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }) ||
      canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
    if (!gl) throw new Error('Sin WebGL');
    this.gl = gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (v, f, names) => {
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f));
      gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNor'); gl.bindAttribLocation(p, 2, 'aCol'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      p.u = {}; (names || []).forEach(k => { p.u[k] = gl.getUniformLocation(p, k); }); return p;
    };
    this.prog = prog;
    this.pr = prog(VS, FS, ['uToon', 'uWind', 'uTime', 'uVP', 'uM', 'uN', 'uLVP', 'uColor', 'uL', 'uSky', 'uGnd', 'uSun', 'uFog', 'uCam', 'uEmis', 'uAlpha', 'uFN', 'uFF', 'uShine', 'uAoY', 'uSM', 'uSh', 'uTx']);
    this.u = this.pr.u;
    this.olPr = prog(OVS, OFS, ['uVP', 'uM', 'uN', 'uW', 'uCam', 'uC']);
    this.skyPr = prog(QVS, SKY, ['uIVP', 'uCam', 'uTop', 'uMid', 'uBot', 'uSunDir', 'uSunCol', 'uSunK', 'uStars', 'uClouds', 'uCloudCol', 'uTime']);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.white = gl.createBuffer(); this.whiteN = 0;
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW);
    this.env = {
      sky: rgb(0xbfd6ff), gnd: rgb(0x5a4a6a), sun: rgb(0xffffff), light: nrm([.45, .8, .4]), fog: rgb(0xbfd6ff), fogNear: 40, fogFar: 140, aoY: 0, shadowArea: 26,
      skyTop: rgb(0x3a7ad8), skyMid: rgb(0xbfe0ff), skyBot: rgb(0x8ab0d8), sunDir: null, sunCol: rgb(0xfff2d0), sunDisc: 1, stars: 0, clouds: 0, cloudCol: rgb(0xffffff)
    };
    this.grade = { exp: 1.15, sat: 1.08, con: 1.04, tint: [1, 1, 1], lift: [0, 0, 0], bloom: .55, tilt: 0, tiltC: .5, vig: .35, grain: .025, flash: 0, flashCol: [1, 1, 1] };
    this.envSun = .75; this.envAmb = .55;
    this.P = m4(); this.V = m4(); this.VP = m4(); this.IVP = m4(); this.LV = m4(); this.LP = m4(); this.LVP = m4(); this.W = 1; this.H = 1;
    this.lost = false; this.t0 = performance.now();
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    this.shadows = opts.shadows !== false && !G.__pruebaSinSombras;
    try { this.initShadow(gl, prog, opts.shadowSize || 1024); } catch (e) { this.shadows = false; }
    this.post = opts.post !== false;
    try { if (this.post) this.initPost(); } catch (e) { this.post = false; }
    this.ft = 1 / 60; this.lastT = 0; this.slow = 0; this.quality = 2;
  }
  Renderer.prototype.initShadow = function (gl, prog, size) {
    const s = this.sm = { size, prog: prog(SVS, SFS, ['uLVP', 'uM']) };
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
  // destinos de dibujo (texturas) para el postprocesado
  Renderer.prototype.target = function (w, h, depth) {
    const gl = this.gl, t = { w, h, tex: gl.createTexture(), fbo: gl.createFramebuffer() };
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    if (depth) { t.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.rb); }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('target');
    return t;
  };
  Renderer.prototype.dropTarget = function (t) { if (!t) return; const gl = this.gl; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); if (t.rb) gl.deleteRenderbuffer(t.rb); };
  Renderer.prototype.initPost = function () {
    const p = this.pp = {};
    p.down = this.prog(QVS, DOWN, ['uT', 'uPx', 'uThr']);
    p.blur = this.prog(QVS, BLUR, ['uT', 'uDir']);
    p.comp = this.prog(QVS, COMP, ['uImpact', 'uSpeed', 'uSpeedC', 'uS', 'uQ', 'uB1', 'uB2', 'uPx', 'uRes', 'uExp', 'uSat', 'uCon', 'uTint', 'uLift', 'uBloom', 'uTilt', 'uTiltC', 'uVig', 'uGrain', 'uTime', 'uFlash', 'uFlashCol']);
    p.w = 0; p.h = 0;
  };
  Renderer.prototype.sizePost = function (w, h) {
    const p = this.pp; if (p.w === w && p.h === h) return;
    ['scene', 'q', 'q2', 'b', 'b2', 'c', 'c2'].forEach(k => { this.dropTarget(p[k]); p[k] = null; });
    p.w = w; p.h = h;
    const w4 = Math.max(1, w >> 2), h4 = Math.max(1, h >> 2), w8 = Math.max(1, w >> 3), h8 = Math.max(1, h >> 3);
    p.scene = this.target(w, h, true);
    p.q = this.target(w4, h4); p.q2 = this.target(w4, h4);
    p.b = this.target(w4, h4); p.b2 = this.target(w4, h4);
    p.c = this.target(w8, h8); p.c2 = this.target(w8, h8);
  };
  Renderer.prototype.setEnv = function (o) {
    const e = this.env;
    ['sky', 'gnd', 'sun', 'fog', 'skyTop', 'skyMid', 'skyBot', 'sunCol', 'cloudCol'].forEach(k => { if (o[k] != null) e[k] = rgb(o[k]); });
    ['fogNear', 'fogFar', 'aoY', 'shadowArea', 'sunDisc', 'stars', 'clouds'].forEach(k => { if (o[k] != null) e[k] = o[k]; });
    if (o.light) e.light = nrm(o.light);
    if (o.sunDir !== undefined) e.sunDir = o.sunDir ? nrm(o.sunDir) : null;
    if (o.amb != null) this.envAmb = o.amb; if (o.sunK != null) this.envSun = o.sunK;
    if (o.grade) Object.assign(this.grade, o.grade);
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
    if (b && g.dynamic && g.dirty !== b.ver) {
      const gl = this.gl; b.ver = g.dirty;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.c); gl.bufferData(gl.ARRAY_BUFFER, g.col, gl.DYNAMIC_DRAW);
    }
    if (!b) {
      const gl = this.gl; b = { p: gl.createBuffer(), n: gl.createBuffer(), c: null };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.STATIC_DRAW);
      if (g.col) { b.c = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.c); gl.bufferData(gl.ARRAY_BUFFER, g.col, gl.STATIC_DRAW); }
      b.ver = g.dirty; g.bufs[this.id] = b;
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
  Renderer.prototype.fullscreen = function (p) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  Renderer.prototype.pass = function (prog, dst, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
    gl.viewport(0, 0, dst ? dst.w : this.canvas.width, dst ? dst.h : this.canvas.height);
    gl.useProgram(prog); setup(prog.u); this.fullscreen();
  };
  Renderer.prototype.tex = function (unit, t, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(loc, unit); };
  const drawList = [], transList = [], olList = [];
  Renderer.prototype.render = function (root, cam) {
    if (this.lost) return;
    const gl = this.gl, u = this.u, e = this.env;
    this.stats = { draws: 0, tris: 0, shadowDraws: 0, olDraws: 0 };
    // calidad automática según lo que tarda cada fotograma
    const now = performance.now(); if (this.lastT) { const dt = Math.min(.2, (now - this.lastT) / 1000); this.ft = this.ft * .93 + dt * .07; } this.lastT = now;
    // resolución dinámica: si un fotograma tarda más de ~18 ms (menos de 55 FPS) baja la resolución poco a poco;
    // si va sobrado la vuelve a subir. Solo si ya está al mínimo apaga las sombras.
    this.frameN = (this.frameN || 0) + 1;
    if (!G.__pruebaRapida && this.autoDRS !== false) {
      this.drsT = (this.drsT || 0) + 1;
      if (this.ft > .0182) this.slow++; else if (this.ft < .0155) this.slow = Math.max(-200, this.slow - 1); else this.slow = Math.max(0, this.slow - .5);
      if (this.drsT > 45 && this.slow > 30) { this.drsT = 0; this.slow = 0; if (this.dprNow > this.dprMin + .01) this.dprNow = Math.max(this.dprMin, this.dprNow - .15); else if (this.shadows) { this.shadows = false; } else this.quality = Math.max(1, this.quality - 1); }
      else if (this.drsT > 240 && this.slow < -150 && this.dprNow < this.dprCap) { this.drsT = 0; this.slow = 0; this.dprNow = Math.min(this.dprCap, this.dprNow + .1); }
    }
    this.resize();
    perspective(this.P, (cam.fov || 50) * Math.PI / 180, this.W / this.H, cam.near || .2, cam.far || 600);
    this.P[8] += cam.shiftX || 0; this.P[9] += cam.shiftY || 0;
    lookAt(this.V, cam.pos, cam.target, cam.up || [0, 1, 0]);
    mul(this.VP, this.P, this.V); invert(this.IVP, this.VP);
    root.update(null);
    drawList.length = 0; transList.length = 0; olList.length = 0;
    const collect = n => { if (!n.visible) return; if (n.geo && n.alpha > .003) { if (n.alpha < 1 || n.additive) transList.push(n); else { drawList.push(n); if (n.outline) olList.push(n); } } for (const c of n.children) collect(c); };
    collect(root);
    gl.enableVertexAttribArray(0);
    // 1) mapa de sombras
    const useSh = this.shadows && this.sm;
    if (useSh && (this.frameN % (this.shadowEvery || 1) === 0 || !this._shOnce)) {
      this._shOnce = true;
      const s = this.sm, a = e.shadowArea, c = cam.shadowCenter || cam.target, L = e.light;
      const tx = a * 2 / s.size, cx = Math.round(c[0] / tx) * tx, cz = Math.round(c[2] / tx) * tx;
      const eye = [cx + L[0] * 80, c[1] + L[1] * 80, cz + L[2] * 80];
      lookAt(this.LV, eye, [cx, c[1], cz], Math.abs(L[1]) > .98 ? [0, 0, 1] : [0, 1, 0]);
      ortho(this.LP, a, 1, 200); mul(this.LVP, this.LP, this.LV);
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo); gl.viewport(0, 0, s.size, s.size);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(s.prog); gl.uniformMatrix4fv(s.prog.u.uLVP, false, this.LVP);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disable(gl.BLEND);
      for (const n of drawList) {
        if (!n.cast) continue;
        const b = this.buf(n.geo); gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(s.prog.u.uM, false, n.world); gl.drawArrays(gl.TRIANGLES, 0, n.geo.count); this.stats.shadowDraws++;
      }
    }
    // 2) cielo + escena (a una textura si hay postprocesado)
    const usePost = this.post && this.quality > 0;
    if (usePost) { try { this.sizePost(this.canvas.width, this.canvas.height); } catch (err) { this.post = false; } }
    const dst = usePost && this.post ? this.pp.scene : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
    {
      const sp = this.skyPr, su = sp.u, t = (now - this.t0) / 1000; gl.useProgram(sp);
      gl.uniformMatrix4fv(su.uIVP, false, this.IVP); gl.uniform3fv(su.uCam, cam.pos);
      gl.uniform3fv(su.uTop, e.skyTop); gl.uniform3fv(su.uMid, e.skyMid); gl.uniform3fv(su.uBot, e.skyBot);
      gl.uniform3fv(su.uSunDir, e.sunDir || e.light); gl.uniform3fv(su.uSunCol, e.sunCol); gl.uniform1f(su.uSunK, e.sunDisc);
      gl.uniform1f(su.uStars, e.stars); gl.uniform1f(su.uClouds, e.clouds); gl.uniform3fv(su.uCloudCol, e.cloudCol); gl.uniform1f(su.uTime, t);
      this.fullscreen();
    }
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.useProgram(this.pr);
    gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.uniformMatrix4fv(u.uVP, false, this.VP); gl.uniformMatrix4fv(u.uLVP, false, this.LVP);
    gl.uniform3fv(u.uL, e.light);
    gl.uniform3f(u.uSky, e.sky[0] * this.envAmb, e.sky[1] * this.envAmb, e.sky[2] * this.envAmb);
    gl.uniform3f(u.uGnd, e.gnd[0] * this.envAmb, e.gnd[1] * this.envAmb, e.gnd[2] * this.envAmb);
    gl.uniform3f(u.uSun, e.sun[0] * this.envSun, e.sun[1] * this.envSun, e.sun[2] * this.envSun);
    gl.uniform3fv(u.uFog, e.fog); gl.uniform3fv(u.uCam, cam.pos);
    gl.uniform1f(u.uFN, e.fogNear); gl.uniform1f(u.uFF, e.fogFar); gl.uniform1f(u.uAoY, e.aoY);
    gl.uniform1f(u.uSh, useSh ? 1 : 0); gl.uniform1f(u.uTime, (now - this.t0) / 1000); gl.uniform1f(u.uWind, 0); this._wind = 0; gl.uniform1f(u.uToon, 0); this._toon = 0;
    if (useSh) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uSM, 0); gl.uniform1f(u.uTx, 1.3 / this.sm.size); }
    for (const n of drawList) if (!n.outline) this.drawNode(n);
    if (olList.length) {
      const op = this.olPr; gl.useProgram(op); gl.disableVertexAttribArray(2);
      gl.uniformMatrix4fv(op.u.uVP, false, this.VP); gl.uniform3fv(op.u.uCam, cam.pos); gl.depthMask(false);
      for (const n of olList) {
        const b = this.buf(n.geo);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(op.u.uM, false, n.world); gl.uniformMatrix3fv(op.u.uN, false, normalMat(NM, n.world));
        gl.uniform1f(op.u.uW, n.outlineW || .05); gl.uniform3fv(op.u.uC, n.outline);
        gl.drawArrays(gl.TRIANGLES, 0, n.geo.count); this.stats.olDraws++;
      }
      gl.depthMask(true); gl.useProgram(this.pr); gl.enableVertexAttribArray(2); this._toon = -1; this._wind = -1;
      for (const n of olList) this.drawNode(n);
    }
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
    // 3) postprocesado
    if (dst) {
      const p = this.pp, gr = this.grade;
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      const px = t => [1 / t.w, 1 / t.h];
      const tiltOn = gr.tilt > .01;   // sin desenfoque de maqueta se ahorran 3 pasadas
      if (tiltOn) {
        this.pass(p.down, p.q, U => { this.tex(0, p.scene, U.uT); gl.uniform2fv(U.uPx, px(p.scene)); gl.uniform1f(U.uThr, 0); });
        this.pass(p.blur, p.q2, U => { this.tex(0, p.q, U.uT); gl.uniform2f(U.uDir, 1 / p.q.w, 0); });
        this.pass(p.blur, p.q, U => { this.tex(0, p.q2, U.uT); gl.uniform2f(U.uDir, 0, 1 / p.q.h); });
      }
      this.pass(p.down, p.b, U => { this.tex(0, p.scene, U.uT); gl.uniform2fv(U.uPx, px(p.scene)); gl.uniform1f(U.uThr, .8); });
      this.pass(p.blur, p.b2, U => { this.tex(0, p.b, U.uT); gl.uniform2f(U.uDir, 1.4 / p.b.w, 0); });
      this.pass(p.blur, p.b, U => { this.tex(0, p.b2, U.uT); gl.uniform2f(U.uDir, 0, 1.4 / p.b.h); });
      this.pass(p.down, p.c, U => { this.tex(0, p.b, U.uT); gl.uniform2fv(U.uPx, px(p.b)); gl.uniform1f(U.uThr, 0); });
      this.pass(p.blur, p.c2, U => { this.tex(0, p.c, U.uT); gl.uniform2f(U.uDir, 2 / p.c.w, 0); });
      this.pass(p.blur, p.c, U => { this.tex(0, p.c2, U.uT); gl.uniform2f(U.uDir, 0, 2 / p.c.h); });
      this.pass(p.comp, null, U => {
        this.tex(0, p.scene, U.uS); this.tex(1, tiltOn ? p.q : p.scene, U.uQ); this.tex(2, p.b, U.uB1); this.tex(3, p.c, U.uB2);
        gl.uniform2fv(U.uPx, px(p.scene)); gl.uniform2f(U.uRes, p.scene.w, p.scene.h);
        gl.uniform1f(U.uExp, gr.exp); gl.uniform1f(U.uSat, gr.sat); gl.uniform1f(U.uCon, gr.con); gl.uniform3fv(U.uTint, gr.tint); gl.uniform3fv(U.uLift, gr.lift);
        gl.uniform1f(U.uBloom, gr.bloom); gl.uniform1f(U.uTilt, gr.tilt); gl.uniform1f(U.uTiltC, gr.tiltC); gl.uniform1f(U.uVig, gr.vig);
        gl.uniform1f(U.uGrain, gr.grain); gl.uniform1f(U.uTime, (now % 10000) / 1000); gl.uniform1f(U.uFlash, gr.flash); gl.uniform3fv(U.uFlashCol, gr.flashCol); gl.uniform1f(U.uImpact, gr.impact || 0); gl.uniform1f(U.uSpeed, gr.speed || 0); gl.uniform2fv(U.uSpeedC, gr.speedC || [.5, .5]);
      });
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      gl.activeTexture(gl.TEXTURE0);
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
    const wd = n.wind || 0; if (wd !== this._wind) { gl.uniform1f(u.uWind, wd); this._wind = wd; }
    const tn = n.toon ? 1 : 0; if (tn !== this._toon) { gl.uniform1f(u.uToon, tn); this._toon = tn; }
    gl.drawArrays(gl.TRIANGLES, 0, g.count); this.stats.draws++; this.stats.tris += g.count / 3;
  };
  Renderer.prototype.project = function (p) {
    const m = this.VP, x = p[0], y = p[1], z = p[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= .01) return { x: -999, y: -999, vis: false };
    return { x: (cx / cw * .5 + .5) * this.W, y: (1 - (cy / cw * .5 + .5)) * this.H, vis: true };
  };

  /* ---------- terreno orgánico (suelo con relieve suave y manchas de color) ---------- */
  function terrain(w, d, seg, o) {
    o = Object.assign({ a: 0x5cc96a, b: 0x7ad884, c: null, amp: .25, scale: .12, flat: 0, flatR: 0, seed: 1, edge: 0 }, o || {});
    const A = rgb(o.a), B = rgb(o.b), Cc = o.c != null ? rgb(o.c) : null;
    const h2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7 + o.seed * 17.3) * 43758.5453; return s - Math.floor(s); };
    const vn = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
      return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); };
    const fbm = (x, z) => vn(x, z) * .55 + vn(x * 2.1 + 3, z * 2.1 + 7) * .3 + vn(x * 4.3 + 11, z * 4.3 + 1) * .15;
    const H = (x, z) => {
      let hh = (fbm(x * o.scale, z * o.scale) - .5) * 2 * o.amp;
      if (o.flatR) { const r = Math.hypot(x - (o.fx || 0), z - (o.fz || 0)); hh *= smooth(clamp((r - o.flatR) / (o.flatR * .6 + 1), 0, 1)); }
      if (o.flatZ) hh *= smooth(clamp((Math.abs(z) - o.flatZ) / 6, 0, 1));
      if (o.edge) { const ex = Math.max(0, Math.abs(x) - (w / 2 - o.edge)), ez = Math.max(0, Math.abs(z) - (d / 2 - o.edge)); hh -= (ex * ex + ez * ez) * .25; }
      return hh;
    };
    const P = [], N = [], C = [], n = seg;
    const pt = (i, j) => { const x = (i / n - .5) * w, z = (j / n - .5) * d; return [x, H(x, z), z]; };
    const nr = (x, z) => { const e = .3; return nrm([H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)]); };
    const col = (x, z, y) => {
      const t = smooth(clamp(fbm(x * .09 + 40, z * .09 + 9) * 1.6 - .3, 0, 1));
      let c = [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
      if (Cc) { const k = smooth(clamp((vn(x * .25 + 70, z * .25) - .62) * 4, 0, 1)); c = [lerp(c[0], Cc[0], k), lerp(c[1], Cc[1], k), lerp(c[2], Cc[2], k)]; }
      const sh = .94 + y * .15; return [Math.min(.999, c[0] * sh), Math.min(.999, c[1] * sh), Math.min(.999, c[2] * sh)];
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
      for (const k of [0, 1, 2, 0, 2, 3]) { const p = q[k]; P.push(...p); N.push(...nr(p[0], p[2])); C.push(...col(p[0], p[2], p[1])); }
    }
    const g = new Geo(P, N, C); g.height = H; return g;
  }

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
    count = Math.min(count, Math.max(0, (this.max || 320) - this.list.length));
    for (let i = 0; i < count; i++) {
      const n = this.spawn(o.geo || (o.add ? geo.oct : geo.rbox(1, 1, 1, .22)));
      const a = Math.random() * TAU, el = (o.flat ? .1 : .25) + Math.random() * (o.flat ? .3 : .75), sp = (o.speed || 6) * (.45 + Math.random() * .7);
      n.pos = [p[0] + (Math.random() - .5) * (o.spread || .3), p[1] + (Math.random() - .5) * (o.spread || .3), p[2] + (Math.random() - .5) * (o.spread || .3)];
      n.color = cols[(Math.random() * cols.length) | 0];
      n.emis = o.emis == null ? .7 : o.emis; n.additive = !!o.add; n.alpha = o.alpha || 1;
      const s = (o.size || .22) * (.6 + Math.random() * .8); n.scl = [s, s, s]; n.rot = [Math.random() * 6, Math.random() * 6, 0];
      const life = (o.life || .8) * (.6 + Math.random() * .6);
      this.list.push({ n, v: [Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp * (o.up == null ? 1 : o.up) + (o.lift || 0), Math.sin(a) * Math.cos(el) * sp], life, max: life, g: o.grav == null ? 14 : o.grav, s, spin: (Math.random() - .5) * 12, drag: o.drag || 1.5, fade: !!o.fade, floor: o.floor == null ? .05 : o.floor, grow: o.grow || 0, amax: o.alpha || 1 });
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
    n.rot = [tilt || 0, yaw, 0]; n.scl = [r * 2, 2.6, r * 2];
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
      const k = q.life / q.max, s = q.s * (q.fade ? 1 : Math.min(1, k * 1.6)) * (1 + q.grow * (1 - k)); q.n.scl = [s, s, s];
      if (q.fade || q.n.additive) q.n.alpha = Math.min(1, k * 1.8) * q.amax;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.n); this.pool.push(r.n); this.rings.splice(i, 1); continue; }
      if (r.slash) { r.n.rot[1] = r.yaw - .9 + ease.out(k) * 1.5; r.n.alpha = (1 - k); const s = r.maxR * 2 * (.85 + k * .25); r.n.scl = [s, 2.6 * (1 - k * .5), s]; continue; }
      const R = lerp(.4, r.maxR, ease.out(k)) * 2; r.n.scl = [R, r.thick * (1 + k * 2), R]; r.n.alpha = (1 - k) * .95;
    }
  };
  FX.prototype.clear = function () {
    this.list.forEach(q => { this.scene.remove(q.n); this.pool.push(q.n); }); this.list = [];
    this.rings.forEach(r => { this.scene.remove(r.n); this.pool.push(r.n); }); this.rings = [];
  };

  // Motas que flotan en el aire (polen, chispas, nieve...). Todas en UNA sola malla dinámica: 1 llamada de dibujo.
  function Motes(scene, o) {
    o = Object.assign({ n: 40, area: [30, 12, 30], center: [0, 4, 0], color: 0xffffff, size: .12, speed: .6, fall: 0, add: true, alpha: .8 }, o);
    this.o = o; this.items = [];
    const tg = o.geo || geo.oct; this.tg = tg; const vc = tg.count;
    const P = new Float32Array(o.n * vc * 3), N = new Float32Array(o.n * vc * 3), C = new Float32Array(o.n * vc * 3);
    for (let i = 0; i < o.n; i++) for (let v = 0; v < vc; v++) { N.set([tg.nor[v * 3], tg.nor[v * 3 + 1], tg.nor[v * 3 + 2]], (i * vc + v) * 3); }
    const g = new Geo(P, N, C); g.dynamic = true; g.dirty = 1; this.geo = g;
    this.col = rgb(o.color);
    this.node = new Node(g, 0xffffff, { emis: 1, add: o.add, alpha: o.add ? 1 : o.alpha, cast: false }); scene.add(this.node);
    for (let i = 0; i < o.n; i++) this.items.push({ x: (Math.random() - .5) * o.area[0], y: Math.random() * o.area[1], z: (Math.random() - .5) * o.area[2], ph: Math.random() * TAU, s: o.size * (.5 + Math.random()) });
  }
  Motes.prototype.update = function (dt, t) {
    const o = this.o, tg = this.tg, vc = tg.count, P = this.geo.pos, C = this.geo.col, c = this.col;
    for (let i = 0; i < this.items.length; i++) {
      const m = this.items[i];
      m.y -= o.fall * dt; if (m.y < 0) m.y += o.area[1]; if (m.y > o.area[1]) m.y -= o.area[1];
      const x = o.center[0] + m.x + Math.sin(t * o.speed + m.ph) * 1.2, y = o.center[1] + m.y + Math.sin(t * o.speed * 1.3 + m.ph) * .4 - o.area[1] / 2, z = o.center[2] + m.z + Math.cos(t * o.speed + m.ph) * 1.2;
      const b = (o.add ? o.alpha : 1) * (.5 + .5 * Math.sin(t * 2 + m.ph)), s = m.s, base = i * vc * 3;
      for (let v = 0; v < vc; v++) { const k = base + v * 3; P[k] = x + tg.pos[v * 3] * s; P[k + 1] = y + tg.pos[v * 3 + 1] * s; P[k + 2] = z + tg.pos[v * 3 + 2] * s; C[k] = c[0] * b; C[k + 1] = c[1] * b; C[k + 2] = c[2] * b; }
    }
    this.geo.dirty++;
  };

  /* ---------- estela de espada (cinta que sigue a la hoja y se desvanece) ---------- */
  function Trail(scene, color, len) {
    this.len = len || 16; this.pts = []; this.col = rgb(color || 0xffffff); this.on = false; this.fade = 0;
    const n = (this.len - 1) * 6;
    const g = new Geo(new Float32Array(n * 3), new Float32Array(n * 3).fill(0), new Float32Array(n * 3)); g.dynamic = true; g.dirty = 1;
    for (let i = 1; i < g.nor.length; i += 3) g.nor[i] = 1;
    this.geo = g; this.node = new Node(g, 0xffffff, { emis: 1, add: true, cast: false }); scene.add(this.node);
  }
  Trail.prototype.push = function (a, b) { this.pts.unshift([a, b]); if (this.pts.length > this.len) this.pts.pop(); };
  Trail.prototype.update = function (a, b, active, dt) {
    if (active) { this.fade = 1; this.push(a, b); } else { this.fade = Math.max(0, this.fade - dt * 6); if (this.pts.length) { this.pts.pop(); } }
    const g = this.geo, P = g.pos, C = g.col, pts = this.pts; let o = 0;
    for (let i = 0; i < this.len - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      if (!p0 || !p1) { for (let k = 0; k < 18; k++) { P[o * 3 + k % 18] = 0; } for (let k = 0; k < 6; k++) { C[(o + k) * 3] = C[(o + k) * 3 + 1] = C[(o + k) * 3 + 2] = 0; P[(o + k) * 3] = P[(o + k) * 3 + 1] = P[(o + k) * 3 + 2] = 0; } o += 6; continue; }
      const f0 = (1 - i / (this.len - 1)) * this.fade, f1 = (1 - (i + 1) / (this.len - 1)) * this.fade;
      const q = [[p0[0], f0 * .25], [p0[1], f0], [p1[1], f1], [p0[0], f0 * .25], [p1[1], f1], [p1[0], f1 * .25]];
      for (const [v, f] of q) { P[o * 3] = v[0]; P[o * 3 + 1] = v[1]; P[o * 3 + 2] = v[2]; C[o * 3] = this.col[0] * f; C[o * 3 + 1] = this.col[1] * f; C[o * 3 + 2] = this.col[2] * f; o++; }
    }
    g.dirty++; this.node.visible = pts.length > 1;
  };

  /* ---------- hierba alta que se mueve con el viento ---------- */
  function grassField(o) {
    o = Object.assign({ n: 12000, r: 30, inner: 0, h: 1.1, w: .16, root: 0x2f7a2a, tip: 0xa8e66a, seed: 2, height: null, clumps: true }, o);
    const R = rng(o.seed), P = new Float32Array(o.n * 9), N = new Float32Array(o.n * 9), C = new Float32Array(o.n * 9);
    const cr = rgb(o.root), ct = rgb(o.tip);
    for (let i = 0; i < o.n; i++) {
      let a = R() * TAU, r = o.inner + Math.sqrt(R()) * (o.r - o.inner);
      const x = Math.cos(a) * r + (o.cx || 0), z = Math.sin(a) * r + (o.cz || 0);
      const y = o.height ? o.height(x, z) : 0, h = o.h * (.55 + R() * .8) * (o.clumps ? (.7 + .6 * Math.abs(Math.sin(x * .21) * Math.cos(z * .17))) : 1);
      const ang = R() * TAU, bx = Math.cos(ang) * o.w, bz = Math.sin(ang) * o.w, lean = (R() - .5) * .5;
      const tipx = x + Math.cos(ang + 1.57) * lean, tipz = z + Math.sin(ang + 1.57) * lean;
      const v = [[x - bx, y, z - bz, 0], [x + bx, y, z + bz, 0], [tipx, y + h, tipz, 1]];
      const k = .8 + R() * .35;
      for (let j = 0; j < 3; j++) {
        const q = i * 9 + j * 3; P[q] = v[j][0]; P[q + 1] = v[j][1] - (j < 2 ? 0 : 0); P[q + 2] = v[j][2];
        N[q] = 0; N[q + 1] = 1; N[q + 2] = 0;
        const t = v[j][3]; C[q] = Math.min(.999, lerp(cr[0], ct[0], t) * k); C[q + 1] = Math.min(.999, lerp(cr[1], ct[1], t) * k); C[q + 2] = Math.min(.999, lerp(cr[2], ct[2], t) * k);
      }
    }
    // la altura local de cada vértice sobre el suelo se guarda en y relativa (para el viento): usamos un nodo por campo a y=0
    const g = new Geo(P, N, C);
    // viento: el shader usa aPos.y como altura; restamos el suelo para que solo se mueva la punta
    if (o.height) { for (let i = 0; i < o.n; i++) { for (let j = 0; j < 3; j++) { const q = i * 9 + j * 3; g.pos[q + 1] -= 0; } } }
    return new Node(g, 0xffffff, { wind: 1, cast: false, shine: .05, vary: false });
  }

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
    const P = {}, rb = .07, pl = { shine: .38 };
    // piernas 1×2×1 (cadera en y=2)
    const leg = side => {
      const piv = group().at(side * .5, 2, 0); body.add(piv);
      box(piv, 1, 2, 1, o.dress ? o.skin : o.pants, 0, -1, 0, { r: rb, shine: .35 });
      if (o.dress) { box(piv, 1.02, .5, 1.02, 0xffffff, 0, -1.55, 0, { r: .05 }); }
      box(piv, 1.04, .32, 1.1, o.shoes, 0, -1.84, .05, { r: .06, shine: .7 });
      return piv;
    };
    P.legL = leg(-1); P.legR = leg(1);
    // torso 2×2×1 (centro en y=3)
    P.torso = group().at(0, 3, 0); body.add(P.torso);
    box(P.torso, 2, 2, 1, o.shirt, 0, 0, 0, { r: rb, shine: .35 });
    if (o.dress) {
      mesh(P.torso, geo.skirt, o.shirt, 2.7, 1.15, 1.8, 0, -1.2, 0, { shine: .45 });
      box(P.torso, 2.06, .2, 1.06, o.belt || 0xffffff, 0, -.82, 0, { r: .05, shine: .7 });
      mesh(P.torso, geo.oct, 0xf2c14e, .26, .26, .12, 0, -.82, .56, { emis: .3, shine: 1 });
      box(P.torso, 1.1, .12, .05, 0x9a0c1e, 0, .95, .5, { r: .02 });
    } else {
      box(P.torso, .8, .32, .06, 0xffffff, 0, .84, .5, { r: .03 });
      box(P.torso, 2.03, .22, 1.03, 0x1c1c26, 0, -.9, 0, { r: .04 });
      box(P.torso, .26, 1.6, .05, 0x2a4ab0, 0, .05, .51, { r: .02 });
    }
    if (o.necklace) { box(P.torso, .9, .05, .04, 0xd8dbe6, 0, .7, .52, { r: 0, emis: .3 }); mesh(P.torso, geo.oct, 0xf2c14e, .22, .26, .08, 0, .52, .53, { emis: .45, shine: 1 }); }
    // brazos 1×2×1 (hombro en y=3.5)
    const arm = side => {
      const piv = group().at(side * 1.5, 3.5, 0); body.add(piv);
      box(piv, 1, 2, 1, o.sleeves ? o.shirt : o.skin, 0, -.5, 0, { r: rb, shine: .35 });
      if (o.sleeves === 'short') box(piv, 1.03, .85, 1.03, o.shirt, 0, .08, 0, { r: .06 });
      if (o.bracelet) box(piv, 1.05, .16, 1.05, side < 0 ? 0x16161c : 0xc9cbd6, 0, -1.15, 0, { r: .05, shine: .9 });
      return piv;
    };
    P.armL = arm(-1); P.armR = arm(1);
    P.hand = group().at(0, -1.45, 0); P.armR.add(P.hand);
    // cabeza: cubo muy redondeado (como la cabeza clásica de Roblox), cuello en y=4
    P.head = group().at(0, 4, 0); body.add(P.head);
    const H0 = group().at(0, .62, 0); P.head.add(H0); P.hc = H0;
    box(H0, 1.25, 1.22, 1.22, o.skin, 0, 0, 0, { r: .4, shine: .4 });
    const eye = x => { const e = group().at(x, .1, .615); H0.add(e); mesh(e, geo.ballS, 0x141018, .2, .32, .06, 0, 0, 0, { shine: .9 }); mesh(e, geo.ballS, 0xffffff, .07, .08, .03, .03, .07, .03, { emis: 1 }); return e; };
    P.eyes = [eye(-.24), eye(.24)];
    P.mouth = mesh(H0, geo.arc, 0x3a1420, .48, .4, .48, 0, -.17, .58, { rot: [Math.PI / 2, 0, Math.PI * .69], shine: 0 });
    if (o.blush) { mesh(H0, geo.ballS, 0xff9fb0, .22, .1, .04, -.42, -.1, .6, { alpha: .7 }); mesh(H0, geo.ballS, 0xff9fb0, .22, .1, .04, .42, -.1, .6, { alpha: .7 }); }
    // pelo de anime: mechones en punta
    const HC = o.hairCol, HL = o.hairHi || HC;
    const strand = (x, y, z, len, w, rx, rz, col, ry) => mesh(H0, geo.cone4, col, w, len, w * .55, x, y, z, { rot: [rx, ry || 0, rz], shine: .55 });
    box(H0, 1.36, .48, 1.34, HC, 0, .5, -.02, { r: .22, shine: .55 });
    box(H0, 1.34, .9, .3, HC, 0, .25, -.55, { r: .12, shine: .55 });
    if (o.hair === 'long') {
      // flequillo
      [[-.48, .62, .5, -.2], [-.24, .7, .56, -.08], [0, .74, .58, 0], [.24, .7, .56, .08], [.48, .62, .5, .2]].forEach(([x, l, w, rz], i) => strand(x, .2, .62, l, w, Math.PI + .12, rz, i % 2 ? HL : HC));
      // mechones laterales largos
      [-1, 1].forEach(s => { strand(s * .66, -.55, .25, 2.1, .5, Math.PI, s * -.06, HC); strand(s * .7, -.4, -.15, 2.2, .55, Math.PI, s * -.1, s > 0 ? HL : HC); strand(s * .56, -.25, .5, 1.5, .34, Math.PI + .05, s * -.04, HL); });
      // melena de atrás
      for (let i = 0; i < 7; i++) { const x = -.6 + i * .2, l = 2.3 + Math.sin(i * 1.7) * .3; strand(x, -.75, -.66, l, .48, Math.PI - .08, (x) * -.12, i === 2 || i === 5 ? HL : HC); }
      box(H0, 1.4, .3, .5, HC, 0, .62, .2, { r: .14, shine: .55 });
    } else {
      // pelo de punta hacia atrás y arriba
      [[-.45, .15, -.35, 1, -.6, .5], [-.15, .3, -.4, 1.1, -.9, .1], [.2, .25, -.45, 1.05, -.8, -.25], [.5, .1, -.3, .9, -.5, -.6], [0, .45, .1, .9, -.4, 0], [-.4, .4, .2, .8, -.2, .6], [.4, .4, .15, .8, -.25, -.6], [-.25, .0, -.6, .9, -1.6, .2], [.25, 0, -.6, .9, -1.6, -.2]]
        .forEach(([x, y, z, l, rx, rz]) => strand(x, y + .45, z, l, .5, rx, rz, HC));
      [[-.4, -.2], [-.1, -.05], [.22, .1], [.45, .25]].forEach(([x, rz]) => strand(x, .32, .6, .55, .38, Math.PI + .25, rz, HC));
    }
    if (o.cap) { box(H0, 1.46, .32, 1.42, o.cap, 0, .8, 0, { r: .12 }); box(H0, 1.1, .1, .6, o.cap, 0, .66, .9, { r: .04 }); }
    if (o.glasses) {
      P.glasses = group().at(0, .12, .66); H0.add(P.glasses);
      box(P.glasses, 1.5, .3, .07, 0x111116, 0, .02, 0, { r: 0, shine: 1 });
      box(P.glasses, .44, .12, .07, 0x111116, -.32, -.18, 0, { r: 0 }); box(P.glasses, .44, .12, .07, 0x111116, .32, -.18, 0, { r: 0 });
      [[-.5, .06], [-.38, -.06], [-.26, .06], [.14, .06], [.26, -.06], [.38, .06]].forEach(([x, y]) => box(P.glasses, .1, .1, .03, 0xffffff, x, y, .045, { r: 0, emis: .6 }));
      P.lens = [box(P.glasses, .56, .26, .02, o.glassGlow || 0xff4fd8, -.3, 0, .06, { r: 0, emis: 1, add: true, alpha: 0 }), box(P.glasses, .56, .26, .02, o.glassGlow || 0x7df3ff, .3, 0, .06, { r: 0, emis: 1, add: true, alpha: 0 })];
    }
    if (o.cape) {
      // gabardina/capa de dos paneles que ondean (como en los juegos de anime de Roblox)
      P.cape = group().at(0, 3.85, -.55); body.add(P.cape);
      P.capeL = group().at(-.52, 0, 0); P.capeR = group().at(.52, 0, 0); P.cape.add(P.capeL, P.capeR);
      box(P.capeL, 1.05, 3.4, .12, o.cape, 0, -1.65, 0, { r: .04, shine: .5 }); box(P.capeR, 1.05, 3.4, .12, o.cape, 0, -1.65, 0, { r: .04, shine: .5 });
      box(P.capeL, 1.07, .16, .14, o.capeTrim || 0xf2c14e, 0, -3.3, 0, { r: .03, emis: .3 }); box(P.capeR, 1.07, .16, .14, o.capeTrim || 0xf2c14e, 0, -3.3, 0, { r: .03, emis: .3 });
      box(P.cape, 2.3, .3, .5, o.cape, 0, .05, .3, { r: .1 });
    }
    P.shadow = mesh(root, geo.cyl20, 0x000000, 2.6, .02, 2.6, 0, .03, 0, { alpha: .18, cast: false });

    // optimización: cada articulación se dibuja en una sola llamada (antes ~70 piezas sueltas por personaje)
    const keep = new Set([...P.eyes, ...(P.lens || [])]);
    P.eyes.forEach(e => e.children.forEach(n => { n.cast = false; }));
    [P.legL, P.legR, P.torso, P.armL, P.armR, H0].forEach(g => bakeInto(g, keep, { toon: 1 }));
    if (P.cape) { bakeInto(P.capeL, null, { toon: 1 }); bakeInto(P.capeR, null, { toon: 1 }); bakeInto(P.cape, new Set([P.capeL, P.capeR]), { toon: 1 }); }
    if (P.glasses) bakeInto(P.glasses, keep, { toon: 1 });
    const markToon = n => { if (n.geo) n.toon = 1; n.children.forEach(markToon); }; markToon(body);
    const A = { root, body, P, t: Math.random() * 10, walk: 0, blink: 2, look: 0, rate: o.blend || 16, prev: null, capeV: 0, capeA: .12 };
    A.rebakeHead = () => { bakeInto(H0, keep, { toon: 1 }); markToon(H0); };
    const JOINTS = [P.legL, P.legR, P.armL, P.armR, P.head, P.torso, body];
    const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
    A.animate = function (dt, speed, pose) {
      A.t += dt; A.walk += dt * (6.5 + speed * 6.5) * (speed > .02 ? 1 : 0);
      const k = clamp(speed, 0, 1), sw = Math.sin(A.walk) * .85 * k;
      const breathe = Math.sin(A.t * 2.2);
      P.legL.rot = [sw, 0, 0]; P.legR.rot = [-sw, 0, 0];
      P.armL.rot = [-sw * .9, 0, -.06 - breathe * .03 - k * .05]; P.armR.rot = [sw * .9, 0, .06 + breathe * .03 + k * .05];
      P.head.rot = [Math.sin(A.t * .9) * .03 - k * .05, Math.sin(A.t * .5) * .12 * (1 - k), Math.sin(A.t * .7) * .03];
      P.torso.rot = [k * .1, Math.sin(A.walk) * .1 * k, 0];
      P.torso.scl = [1, 1 + breathe * .012, 1];
      body.pos = [0, Math.abs(Math.cos(A.walk)) * .22 * k + breathe * .02, 0];
      body.rot = [k * .08, 0, Math.sin(A.walk) * .035 * k];
      A.blink -= dt; const bl = A.blink < 0; if (A.blink < -.12) A.blink = 1.8 + Math.random() * 2.6;
      P.eyes.forEach(e => { e.scl[1] = bl ? .15 : 1; });
      if (pose) pose(P, A);
      const kb = A.snap || !A.prev ? 1 : 1 - Math.exp(-(A.rateOverride || A.rate) * dt);
      if (!A.prev) A.prev = JOINTS.map(j => ({ r: j.rot.slice(), p: j.pos.slice() }));
      JOINTS.forEach((j, i) => {
        const pv = A.prev[i];
        for (let a = 0; a < 3; a++) { pv.r[a] = pv.r[a] + wrapA(j.rot[a] - pv.r[a]) * kb; j.rot[a] = pv.r[a]; }
        if (j === body) { pv.p[1] += (j.pos[1] - pv.p[1]) * kb; j.pos[1] = pv.p[1]; }
      });
      // capa con muelle (sigue al cuerpo con inercia)
      if (P.cape) {
        const target = .1 + k * .75 + (A.capeKick || 0) + Math.sin(A.t * 7) * .05 * (.4 + k);
        A.capeV += ((target - A.capeA) * 60 - A.capeV * 9) * Math.min(dt, .033); A.capeA += A.capeV * Math.min(dt, .033);
        P.capeL.rot = [A.capeA + Math.sin(A.t * 9) * .04 * k, 0, -.06]; P.capeR.rot = [A.capeA + Math.sin(A.t * 9 + 1) * .04 * k, 0, .06];
        A.capeKick = Math.max(0, (A.capeKick || 0) - dt * 2);
      }
      A.snap = false;
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

  G.M3 = { TAU, clamp, lerp, smooth, ease, rng, rgb, geo, Node, group, box, mesh, bake, bakeInto, Renderer, FX, Motes, avatar, sfx, Geo, cloud, flower, tuft, rock, bush, scatter, terrain, Trail, grassField };
})(window);
