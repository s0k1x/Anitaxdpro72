/* =========================================================
   MOTOR 3D · un mini motor WebGL hecho a mano (sin librerías)
   Mundos de bloques, avatares, partículas y cámara.
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

  /* ---------- color ---------- */
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
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      T[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    o.set(T); return o;
  }
  // R = Ry · Rx · Rz, luego escala
  function compose(o, p, r, s) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    o[0] = (cy * cz + sy * sx * sz) * s[0]; o[1] = (cx * sz) * s[0]; o[2] = (-sy * cz + cy * sx * sz) * s[0]; o[3] = 0;
    o[4] = (-cy * sz + sy * sx * cz) * s[1]; o[5] = (cx * cz) * s[1]; o[6] = (sy * sz + cy * sx * cz) * s[1]; o[7] = 0;
    o[8] = (sy * cx) * s[2]; o[9] = (-sx) * s[2]; o[10] = (cy * cx) * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  }
  function perspective(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  }
  function lookAt(o, e, t, up) {
    let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
    return o;
  }

  /* ---------- geometrías (triángulos sueltos, normales planas: estilo low-poly) ---------- */
  let geoId = 0;
  function Geo(pos, nor, col) {
    this.id = ++geoId; this.pos = new Float32Array(pos); this.nor = new Float32Array(nor);
    this.count = pos.length / 3;
    this.col = col ? new Float32Array(col) : null;
    this.bufs = {};
  }
  function triN(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  function builder() {
    const P = [], N = [];
    return {
      tri(a, b, c, n) { n = n || triN(a, b, c); P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); },
      quad(a, b, c, d, n) { n = n || triN(a, b, c); this.tri(a, b, c, n); this.tri(a, c, d, n); },
      done() { return new Geo(P, N); }
    };
  }
  function boxGeo() {
    const b = builder(), h = .5;
    const v = (x, y, z) => [x * h, y * h, z * h];
    b.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), [0, 0, 1]);
    b.quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), [0, 0, -1]);
    b.quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), [1, 0, 0]);
    b.quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), [-1, 0, 0]);
    b.quad(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), [0, 1, 0]);
    b.quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), [0, -1, 0]);
    return b.done();
  }
  function cylGeo(n, rt, rb) {
    const b = builder();
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2;
      const p = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
      const nn = [Math.cos(am), (rb - rt), Math.sin(am)]; const l = Math.hypot(...nn); nn[0] /= l; nn[1] /= l; nn[2] /= l;
      b.quad(p(rb, a0, -.5), p(rb, a1, -.5), p(rt, a1, .5), p(rt, a0, .5), nn);
      if (rt > 0) b.tri([0, .5, 0], p(rt, a0, .5), p(rt, a1, .5), [0, 1, 0]);
      if (rb > 0) b.tri([0, -.5, 0], p(rb, a1, -.5), p(rb, a0, -.5), [0, -1, 0]);
    }
    return b.done();
  }
  function sphereGeo(sub) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(c => c / l * .5); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) {
      const NF = [], cache = {};
      const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] != null) return cache[k]; const m = [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]; const l = Math.hypot(...m); V.push(m.map(c => c / l * .5)); return cache[k] = V.length - 1; };
      for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = NF;
    }
    const b = builder();
    for (const [a, c, d] of F) b.tri(V[a], V[c], V[d]);
    return b.done();
  }
  function octGeo() {
    const b = builder(), h = .5, T0 = [0, h, 0], B0 = [0, -h, 0], R = [[h, 0, 0], [0, 0, h], [-h, 0, 0], [0, 0, -h]];
    for (let i = 0; i < 4; i++) { const a = R[i], c = R[(i + 1) % 4]; b.tri(T0, c, a); b.tri(B0, a, c); }
    return b.done();
  }
  // cuña (para tejados): base cuadrada, arista arriba a lo largo de x
  function wedgeGeo() {
    const b = builder(), h = .5;
    const A = [-h, -h, h], B = [h, -h, h], C = [h, -h, -h], D = [-h, -h, -h], E = [-h, h, 0], F = [h, h, 0];
    b.quad(A, B, F, E); b.quad(C, D, E, F); b.tri(B, C, F); b.tri(D, A, E); b.quad(D, C, B, A, [0, -1, 0]);
    return b.done();
  }
  function torusGeo(n, m, r) {
    const b = builder();
    const p = (i, j) => { const u = i / n * TAU, v = j / m * TAU, R = .5 - r; return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) b.quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1));
    return b.done();
  }
  const geo = {};
  geo.box = boxGeo();
  geo.cyl = cylGeo(12, .5, .5);
  geo.cyl6 = cylGeo(6, .5, .5);
  geo.cyl20 = cylGeo(20, .5, .5);
  geo.cone = cylGeo(10, 0, .5);
  geo.cone4 = cylGeo(4, 0, .5);
  geo.skirt = cylGeo(14, .4, .55);
  geo.ball = sphereGeo(1);
  geo.ball2 = sphereGeo(2);
  geo.oct = octGeo();
  geo.wedge = wedgeGeo();
  geo.torus = torusGeo(28, 8, .11);
  geo.custom = cylGeo;

  /* ---------- nodos ---------- */
  function Node(g, color, o) {
    this.geo = g || null; this.color = rgb(color == null ? 0xffffff : color);
    this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.scl = [1, 1, 1];
    this.children = []; this.parent = null; this.visible = true;
    this.alpha = 1; this.emis = 0; this.additive = false; this.local = m4(); this.world = m4();
    if (o) { for (const k in o) { if (k === 'add') this.additive = !!o.add; else this[k] = o[k]; } }
  }
  Node.prototype.addTo = function (p) { p.add(this); return this; };
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
  // atajo: caja con tamaño, color y posición
  function box(parent, w, h, d, color, x, y, z, o) {
    const n = new Node(geo.box, color, o); n.size(w, h, d); n.at(x || 0, y || 0, z || 0); if (parent) parent.add(n); return n;
  }
  function mesh(parent, g, color, sx, sy, sz, x, y, z, o) {
    const n = new Node(g, color, o); n.size(sx, sy, sz); n.at(x || 0, y || 0, z || 0); if (parent) parent.add(n); return n;
  }

  // Funde todos los hijos de un grupo en una sola malla (1 llamada de dibujo): para el decorado fijo
  function bake(grp) {
    grp.update(null);
    const P = [], N = [], C = [];
    const walk = n => {
      if (!n.visible) return;
      if (n.geo) {
        const m = n.world, g = n.geo, c = n.color;
        for (let i = 0; i < g.count; i++) {
          const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
          P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
          const nx = g.nor[i * 3], ny = g.nor[i * 3 + 1], nz = g.nor[i * 3 + 2];
          let a = m[0] * nx + m[4] * ny + m[8] * nz, b = m[1] * nx + m[5] * ny + m[9] * nz, d = m[2] * nx + m[6] * ny + m[10] * nz;
          const l = Math.hypot(a, b, d) || 1; N.push(a / l, b / l, d / l);
          const gc = g.col ? [g.col[i * 3], g.col[i * 3 + 1], g.col[i * 3 + 2]] : [1, 1, 1];
          C.push(c[0] * gc[0], c[1] * gc[1], c[2] * gc[2]);
        }
      }
      n.children.forEach(walk);
    };
    walk(grp);
    const out = new Node(new Geo(P, N, C), 0xffffff);
    return out;
  }

  /* ---------- renderizador ---------- */
  const VS = `precision highp float;
attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;
uniform mat4 uVP;uniform mat4 uM;
varying vec3 vN;varying vec3 vC;varying vec3 vW;
void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;vN=mat3(uM)*aNor;vC=aCol;gl_Position=uVP*w;}`;
  const FS = `precision mediump float;
varying vec3 vN;varying vec3 vC;varying vec3 vW;
uniform vec3 uColor;uniform vec3 uL;uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uSun;uniform vec3 uFog;uniform vec3 uCam;
uniform float uEmis;uniform float uAlpha;uniform float uFN;uniform float uFF;
void main(){vec3 n=normalize(vN);vec3 base=uColor*vC;
float h=n.y*0.5+0.5;vec3 amb=mix(uGnd,uSky,h);
float d=max(dot(n,uL),0.0);
vec3 col=base*(amb+uSun*d);
float rim=pow(1.0-max(dot(n,normalize(uCam-vW)),0.0),3.0);
col+=base*rim*0.18;
col=mix(col,base,uEmis);
float f=clamp((length(vW-uCam)-uFN)/(uFF-uFN),0.0,1.0);
col=mix(col,uFog,f*(1.0-uEmis*0.6));
gl_FragColor=vec4(col,uAlpha);}`;

  let rid = 0;
  function Renderer(canvas, opts) {
    opts = opts || {};
    this.id = ++rid; this.canvas = canvas; this.dprCap = opts.dpr || 2;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('Sin WebGL');
    this.gl = gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr); this.pr = pr;
    this.a = { pos: gl.getAttribLocation(pr, 'aPos'), nor: gl.getAttribLocation(pr, 'aNor'), col: gl.getAttribLocation(pr, 'aCol') };
    this.u = {}; ['uVP', 'uM', 'uColor', 'uL', 'uSky', 'uGnd', 'uSun', 'uFog', 'uCam', 'uEmis', 'uAlpha', 'uFN', 'uFF'].forEach(k => { this.u[k] = gl.getUniformLocation(pr, k); });
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.white = gl.createBuffer(); this.whiteN = 0;
    this.env = { sky: rgb(0xbfd6ff), gnd: rgb(0x5a4a6a), sun: rgb(0xffffff), light: [.45, .8, .4], fog: rgb(0xbfd6ff), fogNear: 40, fogFar: 140 };
    this.envSun = .75; this.envAmb = .55;
    this.P = m4(); this.V = m4(); this.VP = m4(); this.W = 1; this.H = 1;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
  }
  Renderer.prototype.setEnv = function (o) {
    const e = this.env;
    if (o.sky != null) e.sky = rgb(o.sky); if (o.gnd != null) e.gnd = rgb(o.gnd); if (o.sun != null) e.sun = rgb(o.sun);
    if (o.fog != null) e.fog = rgb(o.fog); if (o.fogNear != null) e.fogNear = o.fogNear; if (o.fogFar != null) e.fogFar = o.fogFar;
    if (o.light) { const l = Math.hypot(...o.light); e.light = o.light.map(v => v / l); }
    if (o.amb != null) this.envAmb = o.amb; if (o.sunK != null) this.envSun = o.sunK;
  };
  Renderer.prototype.resize = function () {
    const c = this.canvas, dpr = Math.min(G.devicePixelRatio || 1, this.dprCap);
    const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
    this.W = w; this.H = h;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    this.gl.viewport(0, 0, pw, ph);
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
    this.resize();
    perspective(this.P, (cam.fov || 50) * Math.PI / 180, this.W / this.H, cam.near || .1, cam.far || 500);
    this.P[8] += cam.shiftX || 0; this.P[9] += cam.shiftY || 0;
    lookAt(this.V, cam.pos, cam.target, cam.up || [0, 1, 0]);
    mul(this.VP, this.P, this.V);
    root.update(null);
    drawList.length = 0; transList.length = 0;
    const collect = n => { if (!n.visible) return; if (n.geo && n.alpha > .003) (n.alpha < 1 || n.additive ? transList : drawList).push(n); for (const c of n.children) collect(c); };
    collect(root);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.pr);
    gl.uniformMatrix4fv(u.uVP, false, this.VP);
    gl.uniform3fv(u.uL, e.light);
    gl.uniform3f(u.uSky, e.sky[0] * this.envAmb, e.sky[1] * this.envAmb, e.sky[2] * this.envAmb);
    gl.uniform3f(u.uGnd, e.gnd[0] * this.envAmb, e.gnd[1] * this.envAmb, e.gnd[2] * this.envAmb);
    gl.uniform3f(u.uSun, e.sun[0] * this.envSun, e.sun[1] * this.envSun, e.sun[2] * this.envSun);
    gl.uniform3fv(u.uFog, e.fog); gl.uniform3fv(u.uCam, cam.pos);
    gl.uniform1f(u.uFN, e.fogNear); gl.uniform1f(u.uFF, e.fogFar);
    gl.enableVertexAttribArray(this.a.pos); gl.enableVertexAttribArray(this.a.nor); gl.enableVertexAttribArray(this.a.col);
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
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.vertexAttribPointer(this.a.nor, 3, gl.FLOAT, false, 0, 0);
    if (b.c) { gl.bindBuffer(gl.ARRAY_BUFFER, b.c); } else { this.ensureWhite(g.count); gl.bindBuffer(gl.ARRAY_BUFFER, this.white); }
    gl.vertexAttribPointer(this.a.col, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(u.uM, false, n.world);
    gl.uniform3fv(u.uColor, n.color); gl.uniform1f(u.uEmis, n.emis); gl.uniform1f(u.uAlpha, n.alpha);
    gl.drawArrays(gl.TRIANGLES, 0, g.count);
  };
  // de 3D a píxeles CSS (para etiquetas de nombre, números de daño...)
  Renderer.prototype.project = function (p) {
    const m = this.VP, x = p[0], y = p[1], z = p[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= .01) return { x: -999, y: -999, vis: false };
    return { x: (cx / cw * .5 + .5) * this.W, y: (1 - (cy / cw * .5 + .5)) * this.H, vis: true };
  };

  /* ---------- partículas ---------- */
  function FX(scene) {
    this.scene = scene; this.list = []; this.pool = []; this.rings = [];
  }
  FX.prototype.spawn = function (g) {
    let n = this.pool.pop();
    if (!n) n = new Node(g || geo.box, 0xffffff); else n.geo = g || geo.box;
    n.visible = true; this.scene.add(n); return n;
  };
  // estallido de cubitos
  FX.prototype.burst = function (p, count, o) {
    o = o || {};
    const cols = (o.colors || [0xffffff]).map(rgb);
    for (let i = 0; i < count; i++) {
      const n = this.spawn(o.geo);
      const a = Math.random() * TAU, el = (o.flat ? .1 : .25) + Math.random() * (o.flat ? .3 : .75), sp = (o.speed || 6) * (.45 + Math.random() * .7);
      n.pos = [p[0] + (Math.random() - .5) * (o.spread || .3), p[1] + (Math.random() - .5) * (o.spread || .3), p[2] + (Math.random() - .5) * (o.spread || .3)];
      n.color = cols[(Math.random() * cols.length) | 0];
      n.emis = o.emis == null ? .7 : o.emis; n.additive = !!o.add; n.alpha = 1;
      const s = (o.size || .22) * (.6 + Math.random() * .8); n.scl = [s, s, s]; n.rot = [Math.random() * 6, Math.random() * 6, 0];
      this.list.push({ n, v: [Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp * (o.up == null ? 1 : o.up) + (o.lift || 0), Math.sin(a) * Math.cos(el) * sp], life: (o.life || .8) * (.6 + Math.random() * .6), max: 0, g: o.grav == null ? 14 : o.grav, s, spin: (Math.random() - .5) * 12, drag: o.drag || 1.5, fade: !!o.fade });
      this.list[this.list.length - 1].max = this.list[this.list.length - 1].life;
    }
  };
  // anillo que se expande (ondas, aterrizajes, impactos)
  FX.prototype.ring = function (p, color, maxR, life, o) {
    o = o || {};
    const n = this.spawn(geo.torus); n.pos = [p[0], p[1], p[2]]; n.color = rgb(color); n.emis = 1; n.additive = o.add !== false; n.alpha = 1; n.rot = [o.tilt || 0, 0, 0];
    this.rings.push({ n, t: 0, life: life || .5, maxR: maxR || 4, thick: o.thick || 1 });
  };
  FX.prototype.update = function (dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i]; q.life -= dt;
      if (q.life <= 0) { this.scene.remove(q.n); this.pool.push(q.n); this.list.splice(i, 1); continue; }
      q.v[1] -= q.g * dt; const d = Math.pow(.5, dt * q.drag); q.v[0] *= d; q.v[2] *= d;
      q.n.pos[0] += q.v[0] * dt; q.n.pos[1] += q.v[1] * dt; q.n.pos[2] += q.v[2] * dt;
      if (q.n.pos[1] < .05 && q.g > 0) { q.n.pos[1] = .05; q.v[1] *= -.3; }
      q.n.rot[0] += q.spin * dt; q.n.rot[1] += q.spin * dt * .7;
      const k = q.life / q.max, s = q.s * (q.fade ? 1 : Math.min(1, k * 1.6)); q.n.scl = [s, s, s];
      if (q.fade || q.n.additive) q.n.alpha = Math.min(1, k * 1.8);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.n); this.pool.push(r.n); this.rings.splice(i, 1); continue; }
      const R = lerp(.4, r.maxR, ease.out(k)) * 2; r.n.scl = [R, r.thick * (1 + k * 2), R]; r.n.alpha = (1 - k) * .95;
    }
  };
  FX.prototype.clear = function () {
    this.list.forEach(q => { this.scene.remove(q.n); this.pool.push(q.n); }); this.list = [];
    this.rings.forEach(r => { this.scene.remove(r.n); this.pool.push(r.n); }); this.rings = [];
  };

  /* ---------- avatar de bloques ---------- */
  // Medidas: pies en y=0, cadera 1.9, hombros 3.8, cabeza ~4.5
  function avatar(o) {
    o = Object.assign({ skin: 0xf6d2bd, shirt: 0x3a6df0, pants: 0x262a40, shoes: 0x1c1c26, hairCol: 0x3a2418, hair: 'short' }, o || {});
    const root = group(), body = group(); root.add(body);
    const P = {};
    // piernas
    const leg = side => { const piv = group().at(side * .5, 1.9, 0); body.add(piv);
      box(piv, .92, 1.6, .95, o.dress ? o.skin : o.pants, 0, -.8, 0);
      box(piv, .98, .36, 1.08, o.shoes, 0, -1.72, .05);
      if (o.dress) box(piv, .96, .14, 1.0, 0xffffff, 0, -1.48, 0); // calcetín
      return piv; };
    P.legL = leg(-1); P.legR = leg(1);
    // torso
    P.torso = group().at(0, 2.85, 0); body.add(P.torso);
    box(P.torso, 2, 1.9, 1, o.shirt, 0, 0, 0);
    if (o.dress) {
      mesh(P.torso, geo.skirt, o.shirt, 2.6, 1.1, 1.75, 0, -1.25, 0);
      box(P.torso, 2.06, .2, 1.06, o.belt || 0xffffff, 0, -.78, 0);
      mesh(P.torso, geo.oct, 0xf2c14e, .26, .26, .12, 0, -.78, .56, { emis: .3 });
    }
    if (o.necklace) { box(P.torso, .9, .05, .04, 0xd8dbe6, 0, .62, .52, { emis: .3 }); mesh(P.torso, geo.oct, 0xf2c14e, .22, .26, .08, 0, .45, .53, { emis: .45 }); }
    if (o.emblem) mesh(P.torso, geo.oct, o.emblem, .5, .62, .16, 0, .15, .52, { emis: .8 });
    // brazos
    const arm = side => { const piv = group().at(side * 1.47, 3.7, 0); body.add(piv);
      box(piv, .9, 1.85, .92, o.sleeves ? o.shirt : o.skin, 0, -.82, 0);
      if (o.sleeves === 'short') box(piv, .94, .7, .96, o.shirt, 0, -.25, 0);
      if (o.bracelet) box(piv, .96, .16, .98, side < 0 ? 0x16161c : 0xc9cbd6, 0, -1.4, 0);
      return piv; };
    P.armL = arm(-1); P.armR = arm(1);
    // cabeza
    P.head = group().at(0, 4.42, 0); body.add(P.head);
    box(P.head, 1.3, 1.25, 1.25, o.skin, 0, 0, 0);
    const eye = x => box(P.head, .15, .24, .05, 0x1b1420, x, .1, .63);
    P.eyes = [eye(-.27), eye(.27)];
    P.mouth = box(P.head, .38, .07, .05, 0x5b2330, 0, -.26, .63);
    if (o.blush) { box(P.head, .2, .08, .04, 0xff9fb0, -.46, -.12, .63, { alpha: .8 }); box(P.head, .2, .08, .04, 0xff9fb0, .46, -.12, .63, { alpha: .8 }); }
    // pelo
    const H = o.hairCol, HL = o.hairHi || H;
    if (o.hair === 'long') {
      box(P.head, 1.42, .34, 1.4, H, 0, .66, -.02);
      box(P.head, 1.44, 2.3, .34, H, 0, -.45, -.6);
      box(P.head, .24, 1.95, 1.2, H, -.71, -.35, -.04); box(P.head, .24, 1.95, 1.2, H, .71, -.35, -.04);
      box(P.head, .3, 1.55, .22, H, -.56, -.15, .62); box(P.head, .3, 1.55, .22, H, .56, -.15, .62);
      box(P.head, .12, 1.5, .24, HL, -.45, -.12, .63); box(P.head, .12, 1.5, .24, HL, .45, -.12, .63);   // mechas claras
      box(P.head, .9, .14, .2, H, 0, .52, .62);
      box(P.head, .14, 1.9, .36, HL, -.4, -.5, -.62); box(P.head, .14, 1.9, .36, HL, .35, -.5, -.62);
    } else {
      box(P.head, 1.4, .38, 1.36, H, 0, .62, -.02);
      box(P.head, 1.4, .8, .3, H, 0, .25, -.6);
      box(P.head, .2, .6, 1.1, H, -.7, .3, -.1); box(P.head, .2, .6, 1.1, H, .7, .3, -.1);
      box(P.head, .7, .2, .24, H, -.2, .5, .62);
    }
    if (o.cap) { box(P.head, 1.46, .32, 1.42, o.cap, 0, .8, 0); box(P.head, 1.1, .1, .6, o.cap, 0, .66, .9); }
    // gafas pixeladas (las de sus fotos)
    if (o.glasses) {
      P.glasses = group().at(0, .12, .66); P.head.add(P.glasses);
      box(P.glasses, 1.5, .3, .07, 0x111116, 0, .02, 0);
      box(P.glasses, .44, .12, .07, 0x111116, -.32, -.18, 0); box(P.glasses, .44, .12, .07, 0x111116, .32, -.18, 0);
      [[-.5, .06], [-.38, -.06], [-.26, .06], [.14, .06], [.26, -.06], [.38, .06]].forEach(([x, y]) => box(P.glasses, .1, .1, .03, 0xffffff, x, y, .045, { emis: .5 }));
      P.lens = [box(P.glasses, .56, .26, .02, o.glassGlow || 0xff4fd8, -.3, 0, .06, { emis: 1, add: true, alpha: 0 }), box(P.glasses, .56, .26, .02, o.glassGlow || 0x7df3ff, .3, 0, .06, { emis: 1, add: true, alpha: 0 })];
    }
    // capa de heroína
    if (o.cape) {
      P.cape = group().at(0, 3.75, -.55); body.add(P.cape);
      box(P.cape, 2.1, 3.0, .12, o.cape, 0, -1.45, 0);
      box(P.cape, 2.12, .2, .14, o.capeTrim || 0xf2c14e, 0, -2.9, 0, { emis: .3 });
    }
    // sombra
    P.shadow = mesh(root, geo.cyl20, 0x000000, 2.4, .02, 2.4, 0, .03, 0, { alpha: .28 });

    const A = { root, body, P, t: Math.random() * 10, walk: 0, blink: 2, pose: null, wave: 0 };
    // anima: speed = cuánto anda (0..1), extra = pose opcional
    A.animate = function (dt, speed, pose) {
      A.t += dt; A.walk += dt * (6 + speed * 6) * (speed > .02 ? 1 : 0);
      const sw = Math.sin(A.walk) * .75 * clamp(speed, 0, 1);
      const idle = Math.sin(A.t * 2.2) * .04;
      P.legL.rot[0] = sw; P.legR.rot[0] = -sw;
      P.armL.rot[0] = -sw * .9; P.armR.rot[0] = sw * .9;
      P.armL.rot[2] = -.06 - idle; P.armR.rot[2] = .06 + idle;
      P.head.rot[0] = 0; P.head.rot[1] = 0;
      body.pos[1] = Math.abs(Math.sin(A.walk)) * .18 * clamp(speed, 0, 1) + idle * .5;
      body.rot[2] = 0; body.rot[0] = 0; body.rot[1] = 0; P.armL.rot[1] = 0; P.armR.rot[1] = 0;
      if (P.cape) P.cape.rot[0] = .12 + speed * .5 + Math.sin(A.t * 6) * .06 * (.3 + speed);
      A.blink -= dt; const b = A.blink < 0; if (A.blink < -.12) A.blink = 1.8 + Math.random() * 2.6;
      P.eyes.forEach(e => { e.scl[1] = b ? .04 : .24; });
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

  G.M3 = { TAU, clamp, lerp, smooth, ease, rgb, geo, Node, group, box, mesh, bake, Renderer, FX, avatar, sfx, Geo };
})(window);
