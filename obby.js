/* =========================================================
   LA HISTORIA EN 3D · animación de inicio
   Cada etapa es un mundo distinto, inspirado en un juego de Roblox
   (mundos propios: sin logos ni personajes de nadie).
   Entre etapa y etapa hay una pantalla de "teletransporte".
   Necesita motor3d.js cargado antes.
   ========================================================= */
(function (G) {
  'use strict';
  const M = G.M3;
  if (!M) return;
  const { TAU, clamp, lerp, smooth, ease, geo, group, box, mesh, bake, FX, Motes, avatar, cloud, flower, tuft, rock, bush, scatter, rgb } = M;

  let current = null;
  function skip() { if (current) current.skip(); }

  /* ---------- los dos protagonistas ---------- */
  const LOOK_HER = { skin: 0xf7d6c4, shirt: 0xc8142a, dress: true, belt: 0xffffff, shoes: 0xf2f2f6, hair: 'long', hairCol: 0x4a2c1c, hairHi: 0xc9a06a, glasses: true, necklace: true, bracelet: true, blush: true };
  const LOOK_ME = { skin: 0xf3cfb3, shirt: 0x3a6df0, sleeves: 'short', pants: 0x262a40, shoes: 0x1c1c26, hair: 'short', hairCol: 0x2a1c14 };

  const POSE = {
    wave: (P, A) => { P.armR.rot[2] = 2.6 + Math.sin(A.t * 9) * .35; P.armR.rot[0] = 0; },
    cheer: (P, A) => { P.armR.rot[2] = 2.7 + Math.sin(A.t * 10) * .2; P.armL.rot[2] = -2.7 - Math.sin(A.t * 10) * .2; },
    clap: (P, A) => { const c = Math.abs(Math.sin(A.t * 9)) * .5; P.armL.rot[0] = -1.3; P.armR.rot[0] = -1.3; P.armL.rot[1] = .7 - c; P.armR.rot[1] = -.7 + c; },
    build: (P, A) => { P.armR.rot[0] = -1.4 - Math.abs(Math.sin(A.t * 7)) * 1.1; P.head.rot[0] = .25; },
    sit: (P, A) => { P.legL.rot[0] = -1.55; P.legR.rot[0] = -1.55; A.body.pos[1] = -.95; },
    sad: (P, A) => { P.head.rot[0] = .45; P.head.rot[1] = 0; P.armL.rot[2] = -.02; P.armR.rot[2] = .02; },
    scared: (P, A) => { P.armL.rot[2] = -2.2; P.armR.rot[2] = 2.2; A.body.rot[2] = Math.sin(A.t * 40) * .05; },
    lantern: P => { P.armR.rot[0] = -1.2; },
    give: P => { P.armR.rot[0] = -1.4; P.armL.rot[0] = -1.4; },
    high: P => { P.armR.rot[2] = 2.9; P.armR.rot[0] = -.3; }
  };

  /* ---------- piezas de decorado ---------- */
  function tree(g, x, z, s, leaf, trunk) {
    s = s || 1; leaf = leaf || 0x56c26a;
    mesh(g, geo.custom(10, .32, .5), trunk || 0x8a5a3a, .9 * s, 3 * s, .9 * s, x, 1.5 * s, z);
    mesh(g, geo.ball, leaf, 3.6 * s, 3.2 * s, 3.6 * s, x, 4.1 * s, z);
    mesh(g, geo.ball, leaf, 2.6 * s, 2.4 * s, 2.6 * s, x + 1.3 * s, 3.5 * s, z + .4 * s);
    mesh(g, geo.ball, leaf, 2.4 * s, 2.3 * s, 2.4 * s, x - 1.2 * s, 3.6 * s, z - .3 * s);
    mesh(g, geo.ball, leaf, 2.2 * s, 2 * s, 2.2 * s, x + .2 * s, 5.3 * s, z - .2 * s);
  }
  function pine(g, x, z, s, snow) {
    s = s || 1;
    mesh(g, geo.cyl, 0x6a4a32, .6 * s, 1.6 * s, .6 * s, x, .8 * s, z);
    [[3.6, 2.4, 2.2], [2.9, 2.2, 3.5], [2.1, 2, 4.7]].forEach(([w, h, y]) => {
      mesh(g, geo.cone, 0x2f7a5a, w * s, h * s, w * s, x, y * s, z);
      if (snow) mesh(g, geo.cone, 0xf4f8ff, w * .62 * s, h * .4 * s, w * .62 * s, x, (y + h * .32) * s, z);
    });
  }
  function house(g, x, z, w, d, wall, roof, ry, o) {
    o = o || {};
    const h = group().at(x, 0, z); h.rot[1] = ry || 0; g.add(h);
    const fl = o.floors || 1, H = 3.2 * fl;
    box(h, w + .3, .4, d + .3, 0xd8d0c8, 0, .2, 0);
    box(h, w, H, d, wall, 0, H / 2 + .3, 0, { r: .12 });
    for (let f = 0; f < fl; f++) box(h, w + .08, .16, d + .08, 0xffffff, 0, 3.2 * (f + 1) + .25, 0, { r: .05 });
    mesh(h, geo.wedge, roof, w + 1, 2, d + 1, 0, H + 1.3, 0, { shine: .45 });
    box(h, .9, 1.6, .9, 0xa85a4a, w * .25, H + 1.6, -d * .15);
    box(h, 1.2, 2.1, .14, 0x7a4a2c, 0, 1.35, d / 2 + .04, { r: .06, shine: .5 });
    mesh(h, geo.ballS, 0xf2c14e, .14, .14, .14, .38, 1.35, d / 2 + .13, { emis: .4 });
    box(h, 1.6, .3, .7, 0xffffff, 0, 2.55, d / 2 + .3, { r: .08 });
    for (let f = 0; f < fl; f++) [-1, 1].forEach(sd => {
      if (f === 0 && Math.abs(sd * w * .3) < 1.2) return;
      const wx = sd * w * .3, wy = 2.1 + f * 3.2;
      box(h, 1.15, 1.05, .12, 0xffffff, wx, wy, d / 2 + .04, { r: .05 });
      box(h, .95, .85, .12, o.lit ? 0xffe9a8 : 0xa8dcff, wx, wy, d / 2 + .08, { r: .03, emis: o.lit ? .9 : .25, shine: 1 });
      box(h, 1.2, .25, .4, 0x8a5a3a, wx, wy - .65, d / 2 + .2, { r: .06 });
      [-.35, 0, .35].forEach(fx => mesh(h, geo.ballS, [0xff7ab8, 0xffd23f, 0xff5a5a][(fx * 10 + 4) % 3 | 0], .26, .22, .26, wx + fx, wy - .45, d / 2 + .25));
    });
    return h;
  }
  // isla flotante: césped con borde, tierra y roca
  function island(g, x, y, z, w, d, top, dirt, o) {
    o = o || {};
    box(g, w, .9, d, top, x, y - .45, z, { r: .4 });
    box(g, w - .3, 1.8, d - .3, dirt || 0x9a6a4a, x, y - 1.6, z, { r: .5 });
    mesh(g, geo.cone6, o.rock || 0x7a6a7a, w * 1.05, o.deep || 5, d * 1.05, x, y - 2.5 - (o.deep || 5) / 2, z, { rot: [Math.PI, .3, 0] });
    for (let i = 0; i < Math.max(4, w / 3); i++) { const a = i / Math.max(4, w / 3) * TAU; rock(g, x + Math.cos(a) * w * .42, y - 3.5, z + Math.sin(a) * d * .42, .9 + (i % 3) * .3, o.rock || 0x7a6a7a); }
  }
  function lamp(g, x, z, col, h) {
    h = h || 4.4;
    mesh(g, geo.cyl, 0x2a2a34, .28, h, .28, x, h / 2, z, { shine: .8 });
    mesh(g, geo.cyl, 0x2a2a34, .7, .2, .7, x, .1, z);
    mesh(g, geo.ballS, col || 0xfff0b0, .75, .75, .75, x, h + .2, z, { emis: 1 });
  }
  function fence(g, x0, x1, z, col) {
    for (let x = x0; x <= x1; x += 1.6) box(g, .3, 1.2, .3, col || 0xffffff, x, .6, z, { r: .1 });
    box(g, x1 - x0 + .3, .2, .16, col || 0xffffff, (x0 + x1) / 2, .9, z, { r: .06 }); box(g, x1 - x0 + .3, .2, .16, col || 0xffffff, (x0 + x1) / 2, .45, z, { r: .06 });
  }
  // capa de nubes que se desplaza despacio
  function cloudLayer(c, list, col, speed) {
    const gr = group();
    list.forEach(([x, y, z, s]) => cloud(gr, x, y, z, s, col));
    const n = bake(gr, 11); n.cast = false; c.scene.add(n);
    return t => { n.pos[0] = Math.sin(t * .05) * 3 + t * (speed || .25); };
  }
  function sun(c, x, y, z, r, col, glow) {
    mesh(c.scene, geo.ball, col, r, r, r, x, y, z, { emis: 1, cast: false });
    mesh(c.scene, geo.ball, glow || col, r * 2.2, r * 2.2, r * 2.2, x, y, z, { emis: 1, add: true, alpha: .22, cast: false });
    mesh(c.scene, geo.ball, glow || col, r * 4, r * 4, r * 4, x, y, z, { emis: 1, add: true, alpha: .08, cast: false });
  }
  function stars(g, n, r, col) {
    const R = M.rng(5);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, e = .08 + R() * 1.2, s = .25 + R() * .6;
      mesh(g, geo.oct, col || 0xffffff, s, s, s, Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, { emis: 1, vary: false });
    }
  }
  const GRASS = [0x5cc96a, 0x6ad478, 0x52bb60];

  /* =========================================================
     MUNDOS
     ========================================================= */
  const WORLDS = {};

  /* 1 · Obby Creator: construir una casa bloque a bloque, y ganar */
  WORLDS.obby = {
    min: 7.5,
    look: { accent: '#ffd23f' },
    sky: 'radial-gradient(60% 40% at 78% 18%,rgba(255,250,220,.95) 0%,rgba(255,250,220,0) 60%),linear-gradient(180deg,#4aa6ff 0%,#8fd0ff 50%,#dff4ff 100%)',
    env: { sky: 0xdff1ff, gnd: 0x6a8a5a, sun: 0xfff3dc, fog: 0xc6e6ff, fogNear: 50, fogFar: 170, light: [.55, .85, .5], amb: .66, sunK: .78, shadowArea: 24 },
    build(c) {
      const st = group();
      island(st, 0, 0, 0, 34, 30, 0x5cc96a, 0x9a6a4a, { deep: 9 });
      // césped en losetas (como el suelo de Roblox) con tonos variados
      for (let x = -15; x <= 15; x += 3) for (let z = -13; z <= 13; z += 3) box(st, 2.9, .12, 2.9, GRASS[(x * 7 + z * 3 & 0xff) % 3], x, .05, z, { r: .05 });
      // la zona de construcción
      box(st, 9, .14, 8, 0xd8cfc0, 0, .1, -2, { r: .1 });
      for (let i = 0; i < 4; i++) box(st, .35, .9, .35, 0xffd23f, -4.2 + (i % 2) * 8.4, .45, -5.8 + (i > 1 ? 7.6 : 0), { r: .12 });
      // árboles, arbustos, flores, rocas
      tree(st, -12, -8, 1.1); tree(st, 12.5, -9, 1); tree(st, -13, 7, .9, 0x6ad478); tree(st, 13, 8, 1.15, 0x4fb05e);
      [[-9, 10], [9, 11], [-15, 1], [15, -1], [6, -12]].forEach(([x, z], i) => bush(st, x, z, .9 + (i % 2) * .3));
      scatter(40, [30, 26], [0, 0, 7, 8], 21, (x, z, R, i) => i % 3 ? flower(st, x, z, [0xff7ab8, 0xffd23f, 0xffffff, 0xb18aff][i % 4], .9) : tuft(st, x, z, 0x4fae5a));
      scatter(6, [30, 26], [0, 0, 8, 9], 4, (x, z, R) => rock(st, x, 0, z, .5 + R() * .4));
      // un obby al fondo: plataformas de colores, cerchas y meta
      const plats = [[-16, 4, -20, 0x7b5cff], [-10, 6, -23, 0xff5ea8], [-4, 8, -25, 0x3ad0ff], [3, 10, -25, 0xffd23f], [10, 12, -23, 0x6ee07a], [16, 14, -19, 0xff8a3a]];
      plats.forEach(([x, y, z, col], i) => {
        box(st, 3.6, .8, 3.6, col, x, y, z, { r: .3, shine: .6 }); box(st, 3.3, .1, 3.3, 0xffffff, x, y + .45, z, { r: .05, alpha: 1 });
        mesh(st, geo.cyl, 0xe8e8f0, .35, y, .35, x, y / 2, z);
        if (i % 2) box(st, 1.6, .2, 1.6, 0xffffff, x, y + .5, z, { r: .08, emis: .3 });
      });
      box(st, 7, .5, 1.6, 0xff2a2a, -13, 5.2, -21.5, { emis: .7 });
      box(st, .4, 5, .4, 0xeeeeee, 16, 16.5, -19); box(st, 2.2, 1.3, .12, 0x2ee86a, 17.1, 18.2, -19, { emis: .5 });
      box(st, 3.6, .3, 3.6, 0x2ee86a, 16, 14.5, -19, { emis: .6 });
      // islas lejanas
      island(st, -34, 6, -40, 12, 10, 0x6ad478, 0x9a6a4a, { deep: 6 }); tree(st, -34, -40, .9);
      island(st, 36, 10, -46, 10, 9, 0x6ad478, 0x9a6a4a, { deep: 5 }); tree(st, 36, -46, .8, 0xffb3d1);
      c.scene.add(bake(st, 1));
      const drift = cloudLayer(c, [[-30, 24, -60, 2.2], [10, 30, -70, 2.8], [40, 22, -55, 2], [-55, 16, -30, 1.8], [55, 18, -25, 1.8]], 0xffffff, .3);
      const bar = box(c.scene, 8, .5, .5, 0xff2a2a, -4, 8.9, -25, { emis: .7 });
      const pad = box(c.scene, 2.4, .5, 2.4, 0x3ad0ff, 0, 0, -22, { r: .25, emis: .3 });
      // la casa que se construye bloque a bloque
      const blocks = [], H = group().at(0, .17, -2); c.scene.add(H);
      const wall = 0xf4e1c1, wall2 = 0xead1a8;
      let k = 0;
      for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) !== 2 && Math.abs(j) !== 2) continue;
        if (j === 2 && i === 0 && row < 2) continue;
        const win = row === 1 && j === 2 && Math.abs(i) === 1;
        const b = box(H, 1, 1, 1, win ? 0x9fdcff : ((i + j + row) % 2 ? wall : wall2), i, row + .5, j, win ? { emis: .4, shine: 1, r: .1 } : { r: .12 });
        blocks.push({ n: b, y: row + .5, t: .3 + (k++) * .1 });
      }
      const roof = mesh(H, geo.wedge, 0x7b5cff, 6, 2.2, 6, 0, 4.1, 0, { shine: .5 }); blocks.push({ n: roof, y: 4.1, t: .3 + k * .1 + .2 });
      const door = box(H, 1, 2, .14, 0x8b5a2b, 0, 1, 2.5, { r: .05 }); blocks.push({ n: door, y: 1, t: .3 + k * .1 + .4 });
      const chim = box(H, .7, 1.4, .7, 0xa85a4a, 1.3, 4.6, -.8); blocks.push({ n: chim, y: 4.6, t: .3 + k * .1 + .55 });
      blocks.forEach(b => { b.n.visible = false; });
      // martillo en la mano de Mario
      const hammer = group(); c.me.P.armR.add(hammer); hammer.at(0, -1.8, .2); hammer.rot[0] = Math.PI / 2;
      box(hammer, .16, 1.3, .16, 0x8a5a3a, 0, .5, 0, { r: .06 }); box(hammer, .7, .32, .32, 0x8a8e9e, 0, 1.15, 0, { r: .08, shine: 1 });
      c.cleanup.push(() => c.me.P.armR.remove(hammer));
      // trofeo de ganador
      const trophy = group(); c.scene.add(trophy);
      mesh(trophy, geo.custom(18, .55, .3), 0xf2c14e, 1.4, 1.1, 1.4, 0, .5, 0, { emis: .25, shine: 1 });
      mesh(trophy, geo.cyl, 0xf2c14e, .3, .6, .3, 0, -.3, 0, { emis: .25, shine: 1 }); box(trophy, 1, .3, 1, 0x6b4426, 0, -.7, 0, { r: .1 });
      mesh(trophy, geo.torus, 0xf2c14e, 1, 1, 1, -.72, .55, 0, { rot: [Math.PI / 2, 0, 0], emis: .25, shine: 1 });
      mesh(trophy, geo.torus, 0xf2c14e, 1, 1, 1, .72, .55, 0, { rot: [Math.PI / 2, 0, 0], emis: .25, shine: 1 });
      mesh(trophy, geo.oct, 0xffffff, .5, .5, .5, 0, .5, .56, { emis: 1 });
      const halo = mesh(trophy, geo.ball, 0xfff2b3, 3, 3, 3, 0, .3, 0, { emis: 1, add: true, alpha: .2, cast: false });
      trophy.visible = false;
      const motes = new Motes(c.scene, { n: 30, area: [26, 8, 18], center: [0, 4, 0], color: 0xfff6c0, size: .1, speed: .5 });
      c.me.root.at(-4, .17, 3); c.me.root.rot[1] = .5;
      c.her.root.at(4, .17, 3); c.her.root.rot[1] = -.5;
      const done = blocks[blocks.length - 1].t + .5;
      let won = false;
      return {
        update(dt, t) {
          drift(t); motes.update(dt, t);
          bar.rot[1] = t * 1.6; pad.pos[1] = 2 + Math.sin(t * 2) * .6;
          blocks.forEach(b => {
            if (t < b.t) return;
            if (!b.n.visible) { b.n.visible = true; c.fx.burst([H.pos[0] + b.n.pos[0], b.y, H.pos[2] + b.n.pos[2]], 4, { colors: [0xffffff, 0xffe9a8], speed: 3, size: .16, life: .45, add: true, grav: 2 }); c.sfx(520 + Math.random() * 200, 700, .05, 'square', .012); }
            const p = clamp((t - b.t) / .35, 0, 1); b.n.pos[1] = b.y + (1 - ease.back(p)) * 2.5; const s = .6 + ease.back(p) * .4; b.n.scl = b.n === roof ? [6 * s, 2.2 * s, 6 * s] : b.n.scl;
          });
          const building = t < done;
          c.me.animate(dt, 0, building ? POSE.build : (won ? POSE.cheer : null));
          c.her.animate(dt, 0, building ? (P, A) => { P.head.rot[1] = -.5; } : POSE.clap);
          if (!building && !won) { won = true; trophy.visible = true; c.fx.burst([-4, 7, 3], 50, { colors: [0xffd23f, 0xff5ea8, 0x3ad0ff, 0xffffff, 0x6ee07a], speed: 10, life: 1.6, size: .3, grav: 9 }); c.fx.ring([-4, 7.2, 3], 0xffd23f, 3, .6, { tilt: Math.PI / 2 }); c.chime(); hammer.visible = false; }
          if (won) {
            const k2 = clamp((t - done) / .6, 0, 1), s = ease.back(k2);
            trophy.at(-4, 7.6 + Math.sin(t * 3) * .2, 3); trophy.scl = [s, s, s]; trophy.rot[1] = t * 2; halo.alpha = .15 + Math.sin(t * 4) * .06;
            c.me.root.pos[1] = .17 + Math.max(0, Math.sin((t - done) * 6)) * .9 * (t - done < 2.2 ? 1 : 0);
            if (Math.random() < dt * 8) c.fx.burst([-4 + (Math.random() - .5) * 2, 8, 3], 1, { colors: [0xffd23f, 0xffffff], speed: 1, life: .8, size: .18, add: true, grav: -1 });
          }
        },
        cam: t => ({ target: [0, 3, 0], yaw: -.38 + t * .05, pitch: .3, dist: 19, fit: 15 })
      };
    }
  };

  /* 2 · Adopt Me: abrir un huevo y que salga una mascota legendaria */
  WORLDS.llamada = {
    min: 7,
    look: { accent: '#ff7ad9' },
    sky: 'radial-gradient(50% 35% at 25% 20%,rgba(255,255,255,.7) 0%,rgba(255,255,255,0) 70%),linear-gradient(180deg,#ff9fd6 0%,#d3bfff 48%,#b6e6ff 100%)',
    env: { sky: 0xffeaf8, gnd: 0x8a74b0, sun: 0xfff2f8, fog: 0xead9ff, fogNear: 45, fogFar: 140, light: [-.45, .85, .55], amb: .68, sunK: .66, shadowArea: 24 },
    build(c) {
      const st = group();
      island(st, 0, 0, 0, 36, 28, 0x8fe39a, 0xb08a6a, { rock: 0x9a84b0, deep: 8 });
      // caminito de baldosas
      for (let z = -12; z <= 13; z += 1.6) box(st, 3.2, .12, 1.3, z % 3.2 ? 0xfff2dc : 0xf6e2c4, 0, .06, z, { r: .1 });
      for (let x = -15; x <= 15; x += 1.6) if (Math.abs(x) > 2) box(st, 1.3, .12, 2.6, 0xfff2dc, x, .06, 5.8, { r: .1 });
      house(st, -9, -8, 8, 6, 0xffd6ea, 0xff7ab8, .25, { floors: 2 });   // la guardería
      box(st, 4.4, 1.1, .25, 0xfff6a8, -7.6, 8.3, -4.5, { emis: .2, rot: [0, .25, 0] });
      house(st, 10, -9, 7, 6, 0xd6f0ff, 0x6aa8ff, -.3);
      // fuente
      mesh(st, geo.cyl20, 0xe8e4f0, 5, .7, 5, 9, .35, 4); mesh(st, geo.cyl20, 0x8fd8ff, 4.4, .1, 4.4, 9, .72, 4, { emis: .3, shine: 1 });
      mesh(st, geo.cyl, 0xe8e4f0, .8, 2.2, .8, 9, 1.4, 4); mesh(st, geo.cyl20, 0xe8e4f0, 2.2, .35, 2.2, 9, 2.5, 4);
      tree(st, -14, 6, 1, 0xffa8d8); tree(st, 15, -2, 1.1, 0xb8f0c8); tree(st, 4, -12, .9, 0xffd6a8); tree(st, -15, -3, .85, 0xc9b6ff);
      [[-11, 11, 0xffb3d1], [12, 11, 0xb8f0c8], [-4, -10, 0xffd6a8], [15, 6, 0xffb3d1]].forEach(([x, z, col]) => bush(st, x, z, 1, col));
      for (let x = -16; x <= 16; x += 1.6) box(st, .3, 1.1, .3, 0xffffff, x, .55, 12.5, { r: .1 });
      box(st, 32.3, .18, .14, 0xffffff, 0, .9, 12.5); box(st, 32.3, .18, .14, 0xffffff, 0, .45, 12.5);
      scatter(46, [32, 24], [0, 2, 6, 7], 8, (x, z, R, i) => i % 4 ? flower(st, x, z, [0xff7ab8, 0xffd23f, 0x9b82ff, 0x7df3ff, 0xffffff][i % 5], 1) : tuft(st, x, z, 0x6ac46a));
      c.scene.add(bake(st, 2));
      const drift = cloudLayer(c, [[-30, 20, -50, 2.4], [20, 26, -60, 2.6], [45, 16, -40, 2], [-50, 14, -20, 1.8]], 0xfff0fa, .25);
      // agua de la fuente que sube
      const jets = [0, 1, 2, 3].map(i => mesh(c.scene, geo.ballS, 0x9fe6ff, .5, .5, .5, 9, 3, 4, { emis: .5, alpha: .8, cast: false }));
      // globos
      const balloons = [[-6, 9, 0xff5ea8], [-5.2, 9.6, 0x7df3ff], [-6.6, 9.8, 0xffd23f]].map(([x, z, col], i) => {
        const b = group().at(x, 0, z); c.scene.add(b);
        mesh(b, geo.ball, col, 1.1, 1.3, 1.1, 0, 4.2 + i * .5, 0, { shine: 1 }); box(b, .03, 3.4 + i * .5, .03, 0xffffff, 0, 2 + i * .25, 0, { r: 0 }); return b;
      });
      // pedestal y huevo
      mesh(c.scene, geo.cyl20, 0xffffff, 2.8, .5, 2.8, 0, .25, 0, { shine: .8 }); mesh(c.scene, geo.cyl20, 0xff9fd6, 2.2, .2, 2.2, 0, .55, 0, { emis: .3 });
      const egg = group().at(0, .65, 0); c.scene.add(egg);
      const shell = mesh(egg, geo.ball2, 0xfff3d6, 1.5, 2, 1.5, 0, 1, 0, { shine: .9 });
      [[.5, 1.3, .5], [-.55, .8, .45], [.1, .5, .72], [-.2, 1.6, -.55], [.6, .7, -.4], [-.6, 1.4, -.2]].forEach(([x, y, z], i) => mesh(egg, geo.ballS, i % 2 ? 0xff7ab8 : 0x9b82ff, .42, .42, .2, x, y, z, { rot: [0, Math.atan2(x, z), 0] }));
      const eggGlow = mesh(egg, geo.ball, 0xffd6f2, 2.6, 3.2, 2.6, 0, 1, 0, { emis: 1, add: true, alpha: 0, cast: false });
      // mascota: un unicornio volador
      const pet = group(); c.scene.add(pet);
      box(pet, 1.5, 1.1, 2.1, 0xfff0fa, 0, 1.1, 0, { r: .4, shine: .6 });
      box(pet, 1.1, 1.05, 1.05, 0xfff0fa, 0, 1.95, .95, { r: .36 });
      box(pet, .7, .5, .4, 0xffd6ea, 0, 1.75, 1.5, { r: .18 });
      mesh(pet, geo.cone, 0xf2c14e, .3, .9, .3, 0, 2.85, 1.1, { emis: .5, shine: 1 });
      [-1, 1].forEach(sd => { box(pet, .16, .26, .06, 0x1b1420, sd * .27, 2.05, 1.49, { r: .05 }); box(pet, .22, .3, .2, 0xffd6ea, sd * .38, 2.55, .8, { r: .08 }); });
      box(pet, .34, .6, .5, 0xb18aff, 0, 2.35, .4, { r: .14 }); box(pet, .3, .4, .4, 0x7df3ff, 0, 1.95, .2, { r: .14 });
      const tail = group().at(0, 1.4, -1.05); pet.add(tail); box(tail, .3, .3, .9, 0xff9fd6, 0, 0, -.4, { r: .14 }); box(tail, .28, .28, .6, 0x7df3ff, 0, -.1, -.85, { r: .13 });
      [[-.45, .7], [.45, .7], [-.45, -.7], [.45, -.7]].forEach(([x, z]) => box(pet, .34, .7, .34, 0xfff0fa, x, .4, z, { r: .14 }));
      const wingL = group().at(-.75, 1.5, 0), wingR = group().at(.75, 1.5, 0); pet.add(wingL, wingR);
      [wingL, wingR].forEach((w, i) => { const sd = i ? 1 : -1; box(w, 1.8, .12, 1, 0xffffff, sd * .9, 0, 0, { r: .05, emis: .3 }); box(w, 1.2, .12, .7, 0xffd6f2, sd * 1.6, .05, -.2, { r: .05, emis: .3 }); });
      pet.visible = false;
      // perrito de Mario
      const dog = group(); c.scene.add(dog);
      box(dog, 1.1, .85, 1.7, 0xd99a5b, 0, .8, 0, { r: .32 }); box(dog, 1, .9, .9, 0xd99a5b, 0, 1.45, .8, { r: .3 });
      box(dog, .5, .35, .35, 0xf2d0a8, 0, 1.3, 1.25, { r: .12 }); box(dog, .2, .14, .1, 0x1b1420, 0, 1.42, 1.43, { r: .05 });
      box(dog, .28, .55, .22, 0x7a4b2a, -.4, 1.8, .6, { r: .1, rot: [0, 0, .3] }); box(dog, .28, .55, .22, 0x7a4b2a, .4, 1.8, .6, { r: .1, rot: [0, 0, -.3] });
      box(dog, .13, .18, .06, 0x1b1420, -.22, 1.6, 1.26, { r: .04 }); box(dog, .13, .18, .06, 0x1b1420, .22, 1.6, 1.26, { r: .04 });
      [[-.32, .5], [.32, .5], [-.32, -.5], [.32, -.5]].forEach(([x, z]) => box(dog, .28, .5, .28, 0xd99a5b, x, .25, z, { r: .1 }));
      const dtail = box(dog, .18, .18, .7, 0x7a4b2a, 0, 1.15, -1, { r: .08 });
      // mariposas
      const flies = [0, 1, 2].map(i => { const f = group(); c.scene.add(f); const a = box(f, .4, .03, .3, [0xff7ab8, 0x7df3ff, 0xffd23f][i], -.2, 0, 0, { r: 0, emis: .4 }), b = box(f, .4, .03, .3, [0xff7ab8, 0x7df3ff, 0xffd23f][i], .2, 0, 0, { r: 0, emis: .4 }); return { f, a, b, ph: i * 2 }; });
      const motes = new Motes(c.scene, { n: 34, area: [24, 8, 16], center: [0, 4, 0], color: 0xffd6f2, size: .12, speed: .6 });
      c.me.root.at(-4.5, 0, 3); c.me.root.rot[1] = .55;
      c.her.root.at(3.6, 0, 3.2); c.her.root.rot[1] = -.6;
      const HATCH = 2.9;
      let hatched = false;
      return {
        update(dt, t) {
          drift(t); motes.update(dt, t);
          jets.forEach((j, i) => { const k = (t * .8 + i / 4) % 1; j.at(9 + Math.sin(i * 1.6) * k * .9, 3 + Math.sin(k * Math.PI) * 1.4, 4 + Math.cos(i * 1.6) * k * .9); j.alpha = .8 * (1 - k); });
          balloons.forEach((b, i) => { b.rot[2] = Math.sin(t * 1.3 + i) * .08; b.pos[1] = Math.sin(t * 1.6 + i) * .2; });
          flies.forEach(q => { const a = t * .7 + q.ph; q.f.at(Math.cos(a) * 9, 2.5 + Math.sin(t * 2 + q.ph), Math.sin(a * 1.3) * 6); q.f.rot[1] = -a; q.a.rot[2] = Math.sin(t * 22) * .9; q.b.rot[2] = -Math.sin(t * 22) * .9; });
          const w = t < HATCH ? Math.sin(t * (6 + t * 4)) * clamp(t / HATCH, 0, 1) * .35 : 0;
          egg.rot[2] = w; egg.rot[0] = w * .4; egg.pos[1] = .65 + Math.max(0, Math.sin(t * 9)) * .15 * clamp(t / HATCH, 0, 1);
          eggGlow.alpha = clamp((t - 1.2) / (HATCH - 1.2), 0, 1) * .35 * (.7 + Math.sin(t * 20) * .3);
          if (t > HATCH - .5 && t < HATCH) shell.emis = (t - (HATCH - .5)) * 2;
          if (t >= HATCH && !hatched) {
            hatched = true; egg.visible = false; pet.visible = true;
            c.fx.burst([0, 2, 0], 26, { colors: [0xfff3d6, 0xff7ab8, 0x9b82ff], speed: 8, life: 1.1, size: .35, emis: .2 });
            c.fx.burst([0, 2.5, 0], 40, { colors: [0xff7ab8, 0xffd23f, 0x7df3ff, 0x9b82ff, 0xffffff], speed: 7, life: 1.5, size: .25, add: true, grav: 1 });
            c.fx.ring([0, .8, 0], 0xffd6f2, 6, .8); c.fx.ring([0, 2.2, 0], 0xffd23f, 4, .6, { tilt: Math.PI / 2, thin: true }); c.chime(true);
          }
          if (hatched) {
            const k = clamp((t - HATCH) / .6, 0, 1), s = ease.back(k);
            const orbit = Math.max(0, t - HATCH - 1.6) * .9, m = smooth(clamp((t - HATCH - 1) / 1.2, 0, 1));
            pet.at(lerp(0, 3.6 + Math.cos(orbit) * 2.8, m), 1.4 + Math.sin(t * 3) * .4 + m * .8, lerp(0, 3.2 + Math.sin(orbit) * 2.8, m)); pet.scl = [s, s, s];
            pet.rot[1] = orbit > 0 ? -orbit + Math.PI : 0; pet.rot[0] = Math.sin(t * 3) * .08;
            wingL.rot[2] = Math.sin(t * 14) * .55; wingR.rot[2] = -Math.sin(t * 14) * .55; tail.rot[1] = Math.sin(t * 5) * .4;
            if (Math.random() < dt * 18) c.fx.burst([pet.pos[0], pet.pos[1] + 1, pet.pos[2]], 1, { colors: [0xff7ab8, 0x7df3ff, 0xffd23f, 0xffffff], speed: 1, life: .9, size: .16, add: true, grav: -1 });
          }
          dog.at(-6.8 + Math.sin(t * 1.3) * .3, Math.abs(Math.sin(t * 6)) * .15, 4.2); dog.rot[1] = .4; dtail.rot[1] = Math.sin(t * 14) * .6;
          c.me.animate(dt, 0, hatched ? POSE.cheer : null);
          c.her.animate(dt, 0, hatched ? POSE.clap : (P, A) => { P.head.rot[1] = .5; });
        },
        cam: t => ({ target: [0, 2.4, 1], yaw: .28 - t * .045, pitch: .27, dist: 18 - Math.min(t, 6) * .35, fit: 13 })
      };
    }
  };

  /* 3 · Brookhaven: un pueblo al atardecer, un paseo en coche */
  WORLDS.corazon = {
    min: 7,
    look: { accent: '#ffb48a' },
    sky: 'radial-gradient(45% 30% at 22% 62%,rgba(255,236,170,.95) 0%,rgba(255,200,140,0) 70%),linear-gradient(180deg,#46307a 0%,#c45a8a 38%,#ff8a7a 62%,#ffc890 82%,#ffe6b8 100%)',
    env: { sky: 0xffcfb8, gnd: 0x5a3a5a, sun: 0xffb27a, fog: 0xffb69a, fogNear: 40, fogFar: 140, light: [-.85, .42, .32], amb: .6, sunK: .95, shadowArea: 26 },
    build(c) {
      const st = group();
      box(st, 140, 1, 70, 0x7bc46a, 0, -.5, 0, { r: 0 });
      box(st, 140, .06, 7, 0x3a3a46, 0, .03, 0, { r: 0, shine: .6 });
      for (let x = -70; x < 70; x += 4) box(st, 2, .06, .25, 0xffe28a, x, .07, 0, { r: 0 });
      for (let x = -3; x <= 3; x += 1.2) box(st, .7, .07, 6.4, 0xffffff, 18 + x, .07, 0, { r: 0 });   // paso de cebra
      [-1, 1].forEach(sd => { box(st, 140, .35, 2.6, 0xc8c2d0, 0, .17, sd * 4.85, { r: .1 }); box(st, 140, .4, .25, 0xa8a2b0, 0, .2, sd * 3.55, { r: .08 }); });
      const cols = [[0xffe0f0, 0xff7ab8], [0xd6f0ff, 0x4a7ad8], [0xfff2c6, 0xd8743a], [0xe2ffd6, 0x4aa86a], [0xf0e0ff, 0x8a5ad8]];
      for (let i = 0; i < 9; i++) { const [w, r] = cols[i % cols.length]; house(st, -40 + i * 10, -12, 7, 5.5, w, r, 0, { floors: 1 + (i % 3 === 1 ? 1 : 0), lit: true }); fence(st, -43.5 + i * 10, -36.5 + i * 10, -8.6, 0xffffff); bush(st, -42 + i * 10, -8, .7, 0x4fae5a); }
      for (let i = 0; i < 7; i++) { tree(st, -36 + i * 12, -19, 1 + (i % 2) * .2, i % 2 ? 0x4fbf6a : 0x3aa85a); }
      for (let i = -40; i <= 40; i += 10) { mesh(st, geo.cyl, 0x30303a, .3, 5, .3, i, 2.5, -6.1, { shine: .8 }); box(st, 1.5, .2, .25, 0x30303a, i + .6, 5, -6.1, { r: .05 }); mesh(st, geo.ballS, 0xfff2b3, .7, .5, .7, i + 1.2, 4.8, -6.1, { emis: 1 }); }
      // heladería con toldo
      house(st, 16, 11, 8, 6, 0xfff6e8, 0x7df3ff, Math.PI, { lit: true });
      for (let i = 0; i < 6; i++) box(st, 1.2, .16, 1.6, i % 2 ? 0xffffff : 0xff7ab8, 13 + i * 1.2, 3.1, 7.6, { r: 0, rot: [-.35, 0, 0] });
      mesh(st, geo.cone, 0xf2c48a, 1, 1.6, 1, 16, 6.9, 11, { rot: [Math.PI, 0, 0] }); mesh(st, geo.ball, 0xff9fd0, 1.4, 1.3, 1.4, 16, 8.1, 11);
      for (let i = 0; i < 5; i++) tree(st, -40 + i * 7, 9, .8, i % 2 ? 0x4fbf6a : 0x5ac876);
      // coches aparcados
      const parked = (x, z, col) => { const g = group().at(x, 0, z); st.add(g); box(g, 5, 1.1, 2.6, col, 0, 1, 0, { r: .45, shine: .9 }); box(g, 2.8, 1, 2.3, col, -.3, 2, 0, { r: .4, shine: .9 }); box(g, 2.6, .8, 2.36, 0x2a3a5a, -.3, 2.05, 0, { r: .35, shine: 1 }); [[-1.6, 1.2], [1.6, 1.2], [-1.6, -1.2], [1.6, -1.2]].forEach(([a, b]) => mesh(g, geo.cyl, 0x1c1c22, 1, .45, 1, a, .5, b, { rot: [Math.PI / 2, 0, 0] })); };
      parked(-24, -4.9, 0xff5a6a); parked(30, 4.9, 0xffd23f);
      c.scene.add(bake(st, 3));
      sun(c, -70, 18, -40, 10, 0xfff0b0, 0xffb070);
      const drift = cloudLayer(c, [[-40, 26, -60, 2.6], [0, 32, -70, 3], [40, 24, -60, 2.4], [70, 20, -40, 2]], 0xffc9b8, .3);
      // el coche
      const car = group(); c.scene.add(car);
      box(car, 6, 1.3, 3, 0x4fd1c5, 0, 1.1, 0, { r: .5, shine: 1 });
      box(car, 3.4, 1.2, 2.8, 0x4fd1c5, -.4, 2.25, 0, { r: .45, shine: 1 });
      box(car, 3.2, 1, 2.86, 0xbfe8ff, -.4, 2.3, 0, { r: .4, alpha: .4, shine: 1 });
      box(car, 6.1, .2, 3.06, 0xe8f8f6, 0, .75, 0, { r: .1, shine: 1 });
      box(car, .2, .4, .7, 0xfff6c0, 3.02, 1.25, .95, { r: .1, emis: 1 }); box(car, .2, .4, .7, 0xfff6c0, 3.02, 1.25, -.95, { r: .1, emis: 1 });
      box(car, .2, .35, .55, 0xff3a4a, -3.02, 1.25, 1, { r: .1, emis: 1 }); box(car, .2, .35, .55, 0xff3a4a, -3.02, 1.25, -1, { r: .1, emis: 1 });
      const beamsL = mesh(car, geo.cone, 0xfff6c0, 3, 7, 3, 6.5, 1.1, 0, { rot: [0, 0, Math.PI / 2], emis: 1, add: true, alpha: .1, cast: false });
      const wheels = [[-2, 1.5], [2, 1.5], [-2, -1.5], [2, -1.5]].map(([x, z]) => { const w = group().at(x, .62, z); car.add(w); mesh(w, geo.cyl20, 0x1c1c22, 1.25, .55, 1.25, 0, 0, 0, { rot: [Math.PI / 2, 0, 0] }); mesh(w, geo.cyl, 0xd8d8e0, .6, .6, .6, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], shine: 1 }); return w; });
      const seatMe = group().at(-.1, .65, .7), seatHer = group().at(-.1, .65, -.7); car.add(seatMe, seatHer);
      c.me.root.scl = [.55, .55, .55]; c.her.root.scl = [.55, .55, .55];
      seatMe.add(c.me.root); seatHer.add(c.her.root);
      c.me.root.rot[1] = Math.PI / 2; c.her.root.rot[1] = Math.PI / 2;
      c.me.P.shadow.visible = c.her.P.shadow.visible = false;
      const motes = new Motes(c.scene, { n: 26, area: [40, 10, 20], center: [0, 5, 0], color: 0xffe0b0, size: .1, speed: .4 });
      const STOP = 2.8;
      let out = false;
      return {
        update(dt, t) {
          drift(t); motes.update(dt, t);
          const k = clamp(t / STOP, 0, 1), x = lerp(-34, 2, 1 - Math.pow(1 - k, 2.4));
          car.at(x, Math.sin(t * 9) * .03 * (1 - k), 2); car.rot[2] = (1 - k) * .02 - (k > .9 && k < 1 ? .03 : 0);
          wheels.forEach(w => { w.rot[2] -= (1 - k) * dt * 12; });
          beamsL.alpha = .08 + Math.sin(t * 3) * .02;
          if (t > STOP + .4 && !out) {
            out = true;
            c.scene.add(c.me.root); c.scene.add(c.her.root);
            c.me.root.scl = [1, 1, 1]; c.her.root.scl = [1, 1, 1];
            c.me.root.at(x - 2.5, 0, 5.5); c.her.root.at(x + 1.5, 0, 5.5);
            c.me.root.rot[1] = .3; c.her.root.rot[1] = -.3;
            c.me.P.shadow.visible = c.her.P.shadow.visible = true;
            c.fx.burst([x, 1, 5.5], 14, { colors: [0xffffff, 0xffe0c0], speed: 3, life: .6, size: .3, emis: .3 });
          }
          c.me.animate(dt, 0, out ? POSE.wave : POSE.sit);
          c.her.animate(dt, 0, out ? (P, A) => { POSE.wave(P, A); P.armR.rot[2] = 2.5 + Math.sin(A.t * 8 + 1) * .3; } : POSE.sit);
          if (out) { const j = t - STOP - .4; c.me.root.pos[1] = Math.max(0, Math.sin(j * 5)) * .6 * (j < .7 ? 1 : 0); c.her.root.pos[1] = Math.max(0, Math.sin(j * 5 - .5)) * .6 * (j > .1 && j < .8 ? 1 : 0); }
          if (Math.random() < dt * 22 * (1 - k)) c.fx.burst([car.pos[0] - 3.2, .5, 2.7], 1, { colors: [0xffffff, 0xe8dcdc], speed: 1, life: .7, size: .4, grav: -2, emis: .2, fade: true });
        },
        cam: t => { const k = clamp(t / 2.8, 0, 1), x = lerp(-34, 2, 1 - Math.pow(1 - k, 2.4)); return { target: [x * .9 + .5, 2.2, 3], yaw: .2, pitch: .23, dist: 15, fit: 12 }; }
      };
    }
  };

  /* 4 · Rieles Muertos: el tren por el desierto al anochecer, y sustos */
  WORLDS.rieles = {
    min: 6.5,
    look: { accent: '#f0c27c' },
    sky: 'radial-gradient(40% 26% at 72% 70%,rgba(255,220,150,.95) 0%,rgba(255,150,80,0) 70%),linear-gradient(180deg,#141038 0%,#4a2458 36%,#c45a3a 70%,#f2a05a 88%,#ffd08a 100%)',
    env: { sky: 0xd88a6a, gnd: 0x4a2a2a, sun: 0xffa060, fog: 0xc8704a, fogNear: 35, fogFar: 140, light: [.85, .32, .25], amb: .55, sunK: 1, shadowArea: 22 },
    build(c) {
      const st = group();
      box(st, 260, 1, 120, 0xd9a066, 0, -.5, 0, { r: 0 });
      for (let i = 0; i < 16; i++) mesh(st, geo.ball, 0xe0aa70, 22 + (i % 3) * 8, 5 + (i % 4), 14, -110 + i * 15, -1.2, (i % 2 ? -1 : 1) * (28 + (i % 3) * 6));
      box(st, 260, .3, 3.4, 0x9a7a5a, 0, .15, 0, { r: .1 });
      [-1, 1].forEach(sd => box(st, 260, .28, .22, 0x9a9aa8, 0, .45, sd * .8, { r: .06, shine: 1 }));
      c.scene.add(bake(st, 4));
      sun(c, 120, 10, -90, 14, 0xffe0a0, 0xff9a50);
      const moving = [];
      const add = (n, sp, w) => { moving.push({ n, sp, w }); return n; };
      for (let i = 0; i < 46; i++) add(box(c.scene, .55, .22, 2.8, 0x5a3a2a, -70 + i * 3, .32, 0, { r: .05 }), 1, 138);
      const decoR = M.rng(9);
      for (let i = 0; i < 16; i++) {
        const g = group().at(-80 + i * 11 + decoR() * 4, 0, (i % 2 ? 1 : -1) * (8 + decoR() * 12)); c.scene.add(g);
        const h = 3.5 + decoR() * 2;
        box(g, 1, h, 1, 0x3f9a4a, 0, h / 2, 0, { r: .45 }); box(g, 1.6, .75, .75, 0x3f9a4a, .7, h * .55, 0, { r: .35 }); box(g, .75, 1.6, .75, 0x3f9a4a, 1.3, h * .55 + .7, 0, { r: .35 });
        if (i % 3 === 0) mesh(g, geo.ballS, 0xff7ab8, .4, .3, .4, 0, h + .1, 0, { emis: .2 });
        rock(g, 2.5, 0, 1, .7, 0xb07a5a);
        add(g, 1, 176);
      }
      for (let i = 0; i < 10; i++) { const g = group().at(-90 + i * 20, 0, -6); c.scene.add(g); mesh(g, geo.cyl, 0x5a3a2a, .3, 7, .3, 0, 3.5, 0); box(g, 2.2, .2, .2, 0x5a3a2a, 0, 6.6, 0, { r: .05 }); add(g, 1, 200); }
      const wires = [0, 1].map(i => box(c.scene, 200, .04, .04, 0x2a1a1a, 0, 6.45 - i * .02, -6 + (i ? .9 : -.9), { r: 0, cast: false }));
      for (let i = 0; i < 7; i++) { const m = group().at(-100 + i * 34, 0, -48 - (i % 2) * 10); c.scene.add(m); const h = 12 + (i % 3) * 5; box(m, 16, h, 10, 0xb5543a, 0, h / 2, 0, { r: 1.2 }); box(m, 17.5, 1.5, 11, 0x9a4430, 0, h + .4, 0, { r: .6 }); box(m, 10, 3, 7, 0xb5543a, 6, 1.5, 6, { r: .8 }); add(m, .35, 238); }
      // el tren
      const train = group().at(0, .6, 0); c.scene.add(train);
      mesh(train, geo.cyl20, 0x2a2a36, 2.7, 7, 2.7, 6, 2.3, 0, { rot: [0, 0, Math.PI / 2], shine: .9 });
      for (let i = 0; i < 4; i++) mesh(train, geo.cyl20, 0xc8a050, 2.85, .2, 2.85, 3.3 + i * 1.8, 2.3, 0, { rot: [0, 0, Math.PI / 2], shine: 1, emis: .15 });
      box(train, 3.4, 4.2, 3.2, 0xa8323a, 1.6, 2.7, 0, { r: .25, shine: .7 }); box(train, 3.9, .45, 3.7, 0x1c1c22, 1.6, 4.95, 0, { r: .15 });
      box(train, .9, .8, .1, 0xffd88a, 1.6, 3.4, 1.62, { r: .08, emis: 1 }); box(train, .9, .8, .1, 0xffd88a, 1.6, 3.4, -1.62, { r: .08, emis: 1 });
      mesh(train, geo.custom(14, .7, .45), 0x1c1c22, 1.3, 1.6, 1.3, 8.2, 4.4, 0);
      mesh(train, geo.wedge, 0x6a6a78, 1.4, 1.4, 3, 9.9, .9, 0, { rot: [0, Math.PI / 2, 0] });
      mesh(train, geo.ballS, 0xfff2b3, .9, .9, .5, 9.5, 2.4, 0, { emis: 1 });
      mesh(train, geo.cone, 0xfff2b3, 2.5, 9, 2.5, 14, 2.4, 0, { rot: [0, 0, Math.PI / 2], emis: 1, add: true, alpha: .1, cast: false });
      box(train, 10, .6, 3.3, 0x6a4a3a, -5, .95, 0, { r: .15 });
      box(train, 10, .7, .22, 0x4a3226, -5, 1.55, 1.58, { r: .08 }); box(train, 10, .7, .22, 0x4a3226, -5, 1.55, -1.58, { r: .08 });
      box(train, 1.4, 1.2, 1.2, 0x8a6a4a, -8.5, 1.85, -.8, { r: .1 }); box(train, 1, .9, 1, 0x7a5a3a, -8.5, 2.9, -.8, { r: .1 });
      const wh = []; [-8, -2, 1.5, 4.5, 7.5].forEach(x => [1.45, -1.45].forEach(z => wh.push(mesh(train, geo.cyl20, 0x2a2a30, 1.4, .3, 1.4, x, .25, z, { rot: [Math.PI / 2, 0, 0], shine: .8 }))));
      const rod = box(train, 6.5, .18, .1, 0xb8b8c8, 4.5, .25, 1.65, { r: 0, shine: 1 });
      const lamp = group(); c.me.P.armR.add(lamp); lamp.at(0, -1.9, .1); c.cleanup.push(() => c.me.P.armR.remove(lamp));
      box(lamp, .45, .55, .45, 0xffd88a, 0, 0, 0, { r: .12, emis: 1 }); box(lamp, .55, .12, .55, 0x1c1c22, 0, .32, 0, { r: .04 });
      const glow = mesh(lamp, geo.ball, 0xffb84a, 3, 3, 3, 0, 0, 0, { emis: 1, add: true, alpha: .22, cast: false });
      train.add(c.me.root); train.add(c.her.root);
      c.me.root.at(-6.5, 1.25, .2); c.her.root.at(-3.5, 1.25, .2); c.me.root.rot[1] = .9; c.her.root.rot[1] = .5;
      const ghosts = [];
      for (let i = 0; i < 4; i++) {
        const g = group(); c.scene.add(g);
        box(g, 1.6, 3.4, 1, 0x15101c, 0, 1.7, 0, { r: .4 }); box(g, 1.2, 1.2, 1.1, 0x15101c, 0, 3.9, 0, { r: .35 });
        box(g, .22, .12, .05, 0xff3030, -.25, 4, .57, { r: 0, emis: 1 }); box(g, .22, .12, .05, 0xff3030, .25, 4, .57, { r: 0, emis: 1 });
        mesh(g, geo.ball, 0xff3030, 1.4, .6, .3, 0, 4, .6, { emis: 1, add: true, alpha: .3, cast: false });
        box(g, .5, 2.2, .5, 0x15101c, -1, 2.6, .5, { r: .2, rot: [-1.3, 0, 0] }); box(g, .5, 2.2, .5, 0x15101c, 1, 2.6, .5, { r: .2, rot: [-1.3, 0, 0] });
        ghosts.push({ g, z: 5 + i * 2.2, x0: -26 - i * 6, ph: i });
      }
      const dust = new Motes(c.scene, { n: 40, area: [40, 6, 20], center: [0, 3, 0], color: 0xffd8a0, size: .12, speed: .3, add: true, alpha: .5 });
      const BOO = 3.2;
      let boo = false;
      return {
        update(dt, t) {
          const v = 16;
          moving.forEach(m => { m.n.pos[0] -= v * m.sp * dt; if (m.n.pos[0] < -m.w / 2 - 10) m.n.pos[0] += m.w; });
          dust.update(dt, t); dust.items.forEach(d => { d.x -= dt * 14; if (d.x < -20) d.x += 40; });
          wh.forEach(w => { w.rot[1] += dt * 12; }); rod.pos[0] = 4.5 + Math.cos(t * 12) * .35; rod.pos[1] = .25 + Math.sin(t * 12) * .35;
          train.pos[1] = .6 + Math.abs(Math.sin(t * 18)) * .04;
          if (Math.random() < dt * 24) c.fx.burst([8.2, 6, 0], 1, { geo: geo.ballS, colors: [0x4a4450, 0x6a6470, 0x8a8490], speed: 1.5, life: 1.8, size: 1.1, grav: -3, emis: .05, fade: true, lift: 2, floor: -99 });
          glow.alpha = .2 + Math.sin(t * 17) * .04;
          ghosts.forEach((q, i) => {
            const k = clamp((t - .3 - i * .25) / 2.6, 0, 1);
            q.g.at(lerp(q.x0, -9 + i * 3, ease.out(k)) + (t > BOO ? -(t - BOO) * 14 : 0), Math.abs(Math.sin(t * 9 + q.ph)) * .3, q.z);
            q.g.rot[1] = Math.PI / 2;
          });
          if (t > BOO && !boo) { boo = true; c.thump(); c.fx.burst([-6, 4, 3], 22, { colors: [0xffd88a, 0xffffff], speed: 8, life: .7, size: .25, add: true }); c.fx.ring([-6, 3, 3], 0xffd88a, 6, .5, { tilt: Math.PI / 2 }); }
          const scared = t > BOO - .9 && t < BOO + .3;
          c.me.animate(dt, 0, scared ? POSE.scared : POSE.lantern);
          c.her.animate(dt, 0, scared ? POSE.scared : (t > BOO + .3 ? POSE.cheer : null));
          c.me.root.pos[1] = 1.25 + (scared ? Math.max(0, Math.sin((t - BOO + .9) * 7)) * .7 : 0);
          c.her.root.pos[1] = 1.25 + (scared ? Math.max(0, Math.sin((t - BOO + .8) * 7)) * .7 : 0);
        },
        cam: t => ({ target: [-2, 2.8, 1], yaw: .58 + Math.sin(t * .3) * .06, pitch: .19, dist: 19, fit: 16 })
      };
    }
  };

  /* 5 · Su juego de terror: un pasillo oscuro... que se llena de monedas */
  WORLDS.exito = {
    min: 7.5,
    look: { accent: '#ff6b7f' },
    sky: 'linear-gradient(180deg,#07060c 0%,#120a14 100%)',
    env: { sky: 0x7a6a8a, gnd: 0x2a1828, sun: 0xffd8a0, fog: 0x07060c, fogNear: 18, fogFar: 56, light: [-.25, .9, -.45], amb: .46, sunK: .45, shadowArea: 18 },
    build(c) {
      const st = group(), L = 46;
      box(st, 9, .4, L, 0x3a2a26, 0, -.2, -L / 2 + 8, { r: 0 });
      for (let z = 8; z > -L + 8; z -= 1.2) box(st, 9, .04, 1.14, z % 2.4 ? 0x4a3430 : 0x42302c, 0, .02, z - .6, { r: 0 });
      box(st, 3.2, .06, L, 0x8a1a2a, 0, .06, -L / 2 + 8, { r: 0 });     // alfombra roja
      box(st, 2.6, .07, L, 0xa82434, 0, .07, -L / 2 + 8, { r: 0 });
      [-1, 1].forEach(sd => {
        box(st, .4, 7, L, 0x4a2c3c, sd * 4.5, 3.5, -L / 2 + 8, { r: 0 });
        for (let z = 7.5; z > -L + 8; z -= 1.2) box(st, .05, 4.2, .5, 0x5a3a4a, sd * 4.27, 4.6, z, { r: 0 });   // papel a rayas
        box(st, .3, 2.4, L, 0x2a1a22, sd * 4.32, 1.2, -L / 2 + 8, { r: 0 });   // zócalo de madera
        box(st, .34, .14, L, 0x8a6a4a, sd * 4.3, 2.45, -L / 2 + 8, { r: 0 });
      });
      for (let z = 4; z > -L + 10; z -= 6) {
        [-1, 1].forEach(sd => {
          box(st, .3, 4.8, 2.8, 0x2a1a14, sd * 4.28, 2.4, z, { r: .05 });
          box(st, .2, 4.4, 2.4, 0x6b4426, sd * 4.22, 2.2, z, { r: .05 });
          box(st, .22, .9, .7, 0xd8c8a0, sd * 4.16, 3.6, z, { r: .05, emis: .1 });
          mesh(st, geo.ballS, 0xd8b04a, .26, .26, .26, sd * 4.05, 2.1, z - .8, { emis: .2 });
        });
        // cuadros entre puertas
        const pz = z - 3, sd = (z / 6 | 0) % 2 ? 1 : -1;
        box(st, .16, 1.6, 2, 0xc89a3a, sd * 4.24, 4.4, pz, { r: .05, shine: 1 }); box(st, .17, 1.3, 1.7, [0x3a4a6a, 0x5a3a2a, 0x2a4a3a][(z / 6 | 0) % 3 + 0 & 3] || 0x3a4a6a, sd * 4.22, 4.4, pz, { r: 0 });
      }
      c.scene.add(bake(st, 5));
      const lamps = [];
      for (let z = 6; z > -12; z -= 7) {
        mesh(c.scene, geo.cyl, 0x1c1c22, .05, 1.2, .05, 0, 6.4, z);
        const sh = mesh(c.scene, geo.custom(14, .25, .7), 0x2a1a1a, 1.2, .6, 1.2, 0, 5.7, z);
        const b = mesh(c.scene, geo.ballS, 0xfff2c0, .6, .6, .6, 0, 5.4, z, { emis: 1 });
        const h = mesh(c.scene, geo.ball, 0xffd8a0, 2.2, 2.2, 2.2, 0, 5.2, z, { emis: 1, add: true, alpha: .1, cast: false });
        lamps.push({ b, h });
      }
      const end = box(c.scene, 3, 5, .25, 0x6b4426, 0, 2.5, -30, { r: .08 });
      const light = box(c.scene, 2.8, 4.8, .1, 0xfff2c0, 0, 2.5, -30.3, { r: 0, emis: 1, alpha: 0, add: true });
      c.me.root.at(-1.6, 0, 2); c.her.root.at(1.6, 0, 2); c.me.root.rot[1] = Math.PI; c.her.root.rot[1] = Math.PI;
      const coins = [];
      for (let i = 0; i < 50; i++) { const n = mesh(c.scene, geo.cyl20, 0xffcf3a, .9, .16, .9, 0, -5, 0, { emis: .2, shine: 1, rot: [Math.PI / 2, 0, 0] }); n.visible = false; coins.push({ n, x: (Math.random() - .5) * 7.5, z: -1 - Math.random() * 10, d: Math.random() * 1.6, vy: 0, y: 9, rest: .1 + Math.random() * .25, sp: (Math.random() - .5) * 10 }); }
      const dust = new Motes(c.scene, { n: 40, area: [7, 6, 18], center: [0, 3.5, -4], color: 0xfff0c8, size: .06, speed: .3, add: true, alpha: .55 });
      const pill = document.createElement('div'); pill.className = 'w3-pill'; pill.innerHTML = '<i></i><span>jugadores</span><b>0</b>'; c.ui.appendChild(pill);
      c.cleanup.push(() => pill.remove());
      const ON = 2.9, fmt = n => Math.round(n).toLocaleString('es-ES');
      let lit = false;
      return {
        update(dt, t) {
          dust.update(dt, t);
          const walk = t < 1.9, z = 2 - smooth(clamp(t / 1.9, 0, 1)) * 7;
          c.me.root.pos[2] = z; c.her.root.pos[2] = z;
          const flick = !lit && (Math.sin(t * 23) > .6 || Math.random() < .08);
          lamps.forEach((l, i) => { const on = lit || !(flick && i % 2); l.b.emis = on ? 1 : .1; l.h.alpha = lit ? .14 : (on ? .1 : .02); l.b.color = rgb(lit ? 0xfff6d8 : (on ? 0xffd8a0 : 0x5a3030)); });
          c.R.envAmb = lit ? .72 : (flick ? .26 : .46);
          if (t > 2.1) { const k = clamp((t - 2.1) / .8, 0, 1); end.rot[1] = -k * 1.4; end.pos[0] = -k * 1.2; light.alpha = k; }
          if (t > ON && !lit) { lit = true; c.R.setEnv({ fog: 0x3a2030, fogNear: 28, fogFar: 90 }); c.cv.style.background = 'radial-gradient(60% 50% at 50% 40%,#7a2a4a 0%,#2a1020 100%)'; c.fx.burst([0, 3, -25], 50, { colors: [0xffcf3a, 0xffffff], speed: 10, life: 1.1, size: .3, add: true }); c.chime(true); pill.classList.add('on'); }
          if (lit) {
            const j = t - ON;
            coins.forEach(q => {
              if (j < q.d) return; q.n.visible = true;
              if (q.y > q.rest) { q.vy -= 26 * dt; q.y = Math.max(q.rest, q.y + q.vy * dt); if (q.y === q.rest) { q.vy = 0; q.n.rot = [0, q.n.rot[1], 0]; } else q.n.rot[2] += q.sp * dt; }
              q.n.at(q.x, q.y, q.z);
            });
            if (Math.random() < dt * 10) c.fx.burst([(Math.random() - .5) * 7, 6, -3 - Math.random() * 6], 1, { colors: [0xff5ea8, 0x7df3ff, 0xffd23f, 0x6ee07a], speed: 1, life: 2, size: .2, grav: 3, emis: .4 });
            pill.querySelector('b').textContent = fmt(Math.pow(clamp(j / 2.6, 0, 1), 2.4) * 312480 + j * 37);
          }
          c.me.animate(dt, walk ? .7 : 0, lit ? POSE.give : (walk ? null : POSE.scared));
          c.her.animate(dt, walk ? .7 : 0, lit ? POSE.cheer : null);
          if (lit) { c.me.root.rot[1] = lerp(c.me.root.rot[1], Math.PI - .5, .06); c.her.root.rot[1] = lerp(c.her.root.rot[1], Math.PI + .2, .06); }
        },
        cam: t => { const z = 2 - smooth(clamp(t / 1.9, 0, 1)) * 7; return { target: [0, 2.6, z], yaw: Math.PI - .2, pitch: .3, dist: 16, fit: 11 }; }
      };
    }
  };

  /* 6 · Dejamos de hablar: dos islas nevadas que se separan */
  WORLDS.distancia = {
    min: 6.5,
    look: { accent: '#cfe0ff' },
    sky: 'radial-gradient(30% 22% at 75% 20%,rgba(230,240,255,.5) 0%,rgba(230,240,255,0) 70%),linear-gradient(180deg,#0a1028 0%,#1e2c58 50%,#4a5a8e 100%)',
    env: { sky: 0xc8d6f8, gnd: 0x2a3050, sun: 0xd8e4ff, fog: 0x2e3e68, fogNear: 30, fogFar: 110, light: [.35, .8, .5], amb: .6, sunK: .6, shadowArea: 26 },
    build(c) {
      const bg = group(); stars(bg, 140, 140); c.scene.add(bake(bg, 6));
      sun(c, 60, 45, -90, 8, 0xeef4ff, 0xc8d8ff);
      // aurora
      const aur = [];
      for (let i = 0; i < 16; i++) aur.push(box(c.scene, 5, 22, .2, i % 2 ? 0x6affc8 : 0x8a7aff, -40 + i * 5, 14, -55, { r: 0, emis: 1, add: true, alpha: .12, cast: false }));
      const mk = sd => {
        const g = group().at(sd * 3.9, 0, 0); c.scene.add(g); const s = group();
        island(s, 0, 0, 0, 8.4, 8.4, 0xf4f8ff, 0x5a6a8a, { rock: 0x5a6a8a, deep: 6 });
        mesh(s, geo.cyl20, 0xffffff, 1.6, .9, 1.6, sd * -2.6, .3, -1.4); mesh(s, geo.custom(10, .1, .5), 0xffd88a, .3, .5, .3, sd * -2.6, 1.1, -1.4, { emis: 1 });
        for (let i = 0; i < 6; i++) mesh(s, geo.ballS, 0xffffff, 1.2, .7, 1.2, Math.cos(i) * 3.4, -.15, Math.sin(i * 1.7) * 3.4);   // nieve que cae por el borde
        pine(s, sd * 2, -2, .75, true); pine(s, sd * -2.3, -2.6, .55, true);
        rock(s, sd * -2, 0, 2.4, .6, 0x8a9ab8); box(s, 1.6, .5, 1.2, 0xffffff, sd * 2.2, .25, 2.2, { r: .25 });
        g.add(bake(s, sd > 0 ? 7 : 8)); return g;
      };
      const A = mk(-1), B = mk(1);
      // islas lejanas
      const far = group(); island(far, -30, -4, -40, 10, 8, 0xf4f8ff, 0x5a6a8a, { rock: 0x4a5a7a }); pine(far, -30, -40, 1, true);
      island(far, 34, 2, -50, 8, 8, 0xf4f8ff, 0x5a6a8a, { rock: 0x4a5a7a }); pine(far, 34, -50, .8, true);
      island(far, -16, -8, -24, 5, 5, 0xf4f8ff, 0x5a6a8a, { rock: 0x4a5a7a, deep: 3 }); island(far, 18, -10, -20, 4, 4, 0xf4f8ff, 0x5a6a8a, { rock: 0x4a5a7a, deep: 3 }); pine(far, 18, -20, .5, true);
      island(far, 0, 10, -60, 12, 9, 0xf4f8ff, 0x5a6a8a, { rock: 0x4a5a7a }); pine(far, -2, -60, 1.1, true); pine(far, 3, -62, .8, true);
      c.scene.add(bake(far, 9));
      const planks = [];
      for (let i = 0; i < 4; i++) planks.push({ n: box(c.scene, .7, .25, 2, 0x8a6a4a, -.75 + i * .5, -.1, 0, { r: .06 }), vy: 0, d: .2 + i * .15 });
      A.add(c.me.root); B.add(c.her.root);
      c.me.root.at(.8, 0, 1); c.her.root.at(-.8, 0, 1); c.me.root.rot[1] = 1.2; c.her.root.rot[1] = -1.2;
      const snow = new Motes(c.scene, { geo: geo.ballS, n: 120, area: [50, 30, 30], center: [0, 6, 0], color: 0xffffff, size: .16, speed: .7, fall: 3, add: false, alpha: .95 });
      const BREAK = 1.6;
      return {
        update(dt, t) {
          snow.update(dt, t); snow.items.forEach(m => { m.n.alpha = .9; });
          aur.forEach((a, i) => { a.alpha = .07 + .07 * Math.sin(t * .8 + i * .6); a.scl[1] = 22 + Math.sin(t * .6 + i) * 4; a.rot[1] = Math.sin(t * .3 + i * .4) * .3; });
          const k = smooth(clamp((t - BREAK) / 5, 0, 1));
          A.at(-3.9 - k * 7, Math.sin(t * .8) * .3, -k * 1.5); B.at(3.9 + k * 7, Math.sin(t * .8 + 2) * .3, -k * 1.5);
          A.rot[1] = -k * .25; B.rot[1] = k * .25;
          planks.forEach(p => { if (t > BREAK + p.d) { p.vy -= 16 * dt; p.n.pos[1] += p.vy * dt; p.n.rot[2] += dt * 2; } });
          if (Math.abs(t - BREAK) < dt) { c.fx.burst([0, 0, 0], 16, { colors: [0x8a6a4a, 0xffffff], speed: 5, life: .8, size: .25, emis: .1, floor: -99 }); c.thump(); }
          const apart = t > BREAK + .4;
          c.me.root.rot[1] = lerp(c.me.root.rot[1], apart ? .2 : 1.2, .04);
          c.her.root.rot[1] = lerp(c.her.root.rot[1], apart ? -.2 : -1.2, .04);
          c.me.animate(dt, 0, apart ? POSE.sad : null);
          c.her.animate(dt, 0, apart ? POSE.sad : null);
        },
        cam: t => ({ target: [0, 1.5, 0], yaw: Math.sin(t * .2) * .1, pitch: .24, dist: 20 + Math.min(t, 7) * .5, fit: 14 + Math.min(t, 7) * 1.6 })
      };
    }
  };

  /* 7 · Mejor que nunca: llegar juntos a lo más alto de la torre */
  WORLDS.reencuentro = {
    min: 7,
    look: { accent: '#7dffd8' },
    sky: 'radial-gradient(30% 20% at 22% 22%,rgba(220,210,255,.45) 0%,rgba(220,210,255,0) 70%),linear-gradient(180deg,#04001a 0%,#160846 45%,#3a1a6a 78%,#6a3a9a 100%)',
    env: { sky: 0xc0b0ff, gnd: 0x2a1a4a, sun: 0xeee6ff, fog: 0x24104e, fogNear: 45, fogFar: 160, light: [.45, .85, .35], amb: .62, sunK: .62, shadowArea: 26 },
    build(c) {
      const st = group();
      const cols = [0xff5ea8, 0x7b5cff, 0x3ad0ff, 0x6ee07a, 0xffd23f, 0xff8a3a];
      for (let i = 0; i < 12; i++) {
        box(st, 10, 3, 10, cols[i % cols.length], 0, -1.5 - i * 3, 0, { r: .3, shine: .5 });
        box(st, 10.6, .35, 10.6, 0xffffff, 0, -3 * i - .1, 0, { r: .15, shine: .8 });
        if (i % 2) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + i; box(st, 2.2, .4, 2.2, cols[(i + 2) % 6], Math.cos(a) * 6.6, -3 * i - 1.5, Math.sin(a) * 6.6, { r: .15 }); }
      }
      box(st, 11, .6, 11, 0xffffff, 0, -.3, 0, { r: .25, shine: .8 });
      for (let i = 0; i < 4; i++) box(st, 2.2, .1, 11, 0xf4f0ff, -3.3 + i * 2.2, .02, 0, { r: 0 });
      stars(st, 200, 140);
      c.scene.add(bake(st, 10));
      mesh(c.scene, geo.ball, 0xf6f0ff, 9, 9, 9, -50, 40, -90, { emis: 1, cast: false }); mesh(c.scene, geo.ball, 0xc8b8ff, 20, 20, 20, -50, 40, -90, { emis: 1, add: true, alpha: .12, cast: false });
      const drift = cloudLayer(c, [[-30, -16, -20, 3], [20, -18, -30, 3.4], [-10, -20, 20, 3], [30, -14, 15, 2.6], [-40, -12, 10, 2.8], [0, -22, -50, 3.6], [45, -20, -40, 3]], 0xc8b0f0, .2);
      const stepsL = [[-9, -6, 2], [-7, -3.5, 3.5], [-5.5, -1.2, 2.2]], stepsR = [[9, -6, -2], [7, -3.5, -3.5], [5.5, -1.2, -2.2]];
      [...stepsL, ...stepsR].forEach(([x, y, z], i) => box(c.scene, 2.6, .6, 2.6, cols[(i + 2) % cols.length], x, y - .3, z, { r: .25, shine: .6 }));
      const flag = group().at(0, 0, -3.5); c.scene.add(flag);
      mesh(flag, geo.cyl, 0xffffff, .25, 6, .25, 0, 3, 0, { shine: 1 }); mesh(flag, geo.ballS, 0xffd23f, .5, .5, .5, 0, 6.1, 0, { emis: .5 });
      const cloth = box(flag, 2.4, 1.4, .1, 0x7dffd8, 1.3, 5.2, 0, { r: .05, emis: .5 });
      const sparkle = new Motes(c.scene, { n: 40, area: [26, 12, 20], center: [0, 6, 0], color: 0xc8f8ff, size: .12, speed: .5 });
      const pathL = [[-11, -6, 3], ...stepsL, [-1.6, 0, 1]], pathR = [[11, -6, -3], ...stepsR, [1.6, 0, 1]];
      const at = (path, t) => {
        const seg = clamp(Math.floor(t / .55), 0, path.length - 2), k = clamp(t / .55 - seg, 0, 1);
        if (t >= (path.length - 1) * .55) return path[path.length - 1].slice();
        const a = path[seg], b = path[seg + 1];
        return [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * 2.2, lerp(a[2], b[2], k)];
      };
      const MEET = (pathL.length - 1) * .55 + .3;
      let fireT = MEET, met = false;
      return {
        update(dt, t) {
          drift(t); sparkle.update(dt, t);
          c.me.root.at(...at(pathL, t)); c.her.root.at(...at(pathR, t));
          c.me.root.rot[1] = t < MEET ? Math.PI / 2 : .9; c.her.root.rot[1] = t < MEET ? -Math.PI / 2 : -.9;
          if (t > MEET && !met) { met = true; c.fx.burst([0, 4.5, 1], 40, { colors: [0x7dffd8, 0xffffff, 0xffd23f], speed: 8, life: 1.1, size: .25, add: true }); c.fx.ring([0, .2, 1], 0x7dffd8, 6, .7); c.chime(true); }
          if (t > fireT) {
            fireT += .5 + Math.random() * .4;
            const p = [(Math.random() - .5) * 28, 13 + Math.random() * 9, -6 - Math.random() * 12];
            const col = [0xff5ea8, 0x7dffd8, 0xffd23f, 0x9b82ff, 0x3ad0ff][(Math.random() * 5) | 0];
            c.fx.burst(p, 40, { colors: [col, 0xffffff], speed: 12, life: 1.4, size: .28, add: true, grav: 4, drag: 2, floor: -99 });
            c.fx.ring(p, col, 6, .8, { tilt: Math.PI / 2, thin: true }); c.pop();
          }
          cloth.rot[1] = Math.sin(t * 3) * .2; cloth.scl[0] = 2.4 + Math.sin(t * 5) * .1;
          const jumping = t < MEET - .3;
          c.me.animate(dt, jumping ? .4 : 0, met ? POSE.high : null);
          c.her.animate(dt, jumping ? .4 : 0, met ? P => { P.armL.rot[2] = -2.9; P.armL.rot[0] = -.3; } : null);
        },
        cam: t => ({ target: [0, 1.5, 0], yaw: -.5 + t * .06, pitch: .3, dist: 21, fit: 17 })
      };
    }
  };

  /* Final · el portal que la lleva al último reto */
  WORLDS.portal = {
    look: { accent: '#c9bcff', id: 'reencuentro' },
    sky: 'radial-gradient(50% 40% at 50% 38%,rgba(160,120,255,.5) 0%,rgba(160,120,255,0) 70%),linear-gradient(180deg,#05001a 0%,#20104a 55%,#4a2a8a 100%)',
    env: { sky: 0xc9bcff, gnd: 0x2a1a4a, sun: 0xe0d8ff, fog: 0x20104a, fogNear: 35, fogFar: 130, light: [.3, .85, .45], amb: .64, sunK: .6, shadowArea: 22 },
    build(c) {
      const st = group();
      island(st, 0, 0, 0, 22, 18, 0x6a5aa8, 0x3a2a6a, { rock: 0x4a3a7a, deep: 8 });
      for (let x = -9; x <= 9; x += 3) for (let z = -7; z <= 7; z += 3) box(st, 2.9, .1, 2.9, (x + z) % 2 ? 0x7a6ab8 : 0x6e5eae, x, .05, z, { r: .05 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; mesh(st, geo.gem, i % 2 ? 0xc9bcff : 0x7df3ff, 1, 2 + (i % 3) * .8, 1, Math.cos(a) * 9.4, 1 + (i % 3) * .4, Math.sin(a) * 7.8, { emis: .5, rot: [.1, a, .15] }); }
      mesh(st, geo.thin, 0x9b82ff, 12, .5, 12, 0, .1, -4, { emis: .8 }); mesh(st, geo.thin, 0x7df3ff, 9, .5, 9, 0, .1, -4, { emis: .8 });
      stars(st, 140, 120);
      island(st, -24, 6, -30, 8, 7, 0x6a5aa8, 0x3a2a6a, { rock: 0x4a3a7a }); island(st, 26, 9, -36, 7, 6, 0x6a5aa8, 0x3a2a6a, { rock: 0x4a3a7a });
      c.scene.add(bake(st, 12));
      const P = group().at(0, 4.6, -4); c.scene.add(P);
      const ring = mesh(P, geo.torus, 0xc9bcff, 8, 8, 8, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: .8, shine: 1 });
      const ring2 = mesh(P, geo.torus, 0x7df3ff, 7.2, 7.2, 7.2, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: 1, add: true, alpha: .7 });
      const disc = mesh(P, geo.cyl20, 0x9b82ff, 7, .1, 7, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: 1, add: true, alpha: .55 });
      const disc2 = mesh(P, geo.cyl20, 0xffffff, 4, .12, 4, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], emis: 1, add: true, alpha: .25 });
      P.scl = [0, 0, 0];
      const motes = new Motes(c.scene, { n: 46, area: [20, 10, 14], center: [0, 5, 0], color: 0xc9bcff, size: .12, speed: .6 });
      c.her.root.at(0, 0, 6); c.her.root.rot[1] = Math.PI;
      c.me.root.at(-5, 0, 7); c.me.root.rot[1] = 2.4;
      const st0 = { walk: false, t0: 0 };
      c.walkIn = () => { st0.walk = true; st0.t0 = c.t; };
      return {
        update(dt, t) {
          motes.update(dt, t);
          const k = ease.back(clamp(t / 1.2, 0, 1)); P.scl = [k, k, k];
          ring.rot[1] = t * .8; ring2.rot[1] = -t * 1.3; disc.alpha = .45 + Math.sin(t * 4) * .12; disc2.alpha = .2 + Math.sin(t * 6) * .1;
          if (Math.random() < dt * 34) { const a = Math.random() * TAU; c.fx.burst([Math.cos(a) * 5, 4.6 + Math.sin(a) * 5, -4], 1, { colors: [0xc9bcff, 0x7df3ff, 0xffffff], speed: 1, life: .7, size: .2, add: true, grav: 0, floor: -99 }); }
          let sp = 0;
          if (st0.walk) { const j = t - st0.t0, z = 6 - j * 5.5; sp = 1; c.her.root.pos[2] = Math.max(-4, z); const s = z < -1 ? clamp(1 - (-1 - z) / 3, 0, 1) : 1; c.her.root.scl = [s, s, s]; }
          c.her.animate(dt, sp, null);
          c.me.animate(dt, 0, POSE.wave);
        },
        cam: t => ({ target: [0, 3.2, 1], yaw: .25, pitch: .2, dist: 20, fit: 15 })
      };
    }
  };


  /* =========================================================
     DIRECTOR
     ========================================================= */
  function play(opts) {
    return new Promise(resolve => {
      const cv = opts.canvas, host = cv.parentElement;
      const names = (opts.scenes && opts.scenes.length) ? opts.scenes : ['obby'];
      const worlds = opts.worlds || [];
      const N = names.length;
      let R;
      try { R = new M.Renderer(cv, { dpr: 2 }); } catch (e) { R = null; }

      let skipFlag = false, running = true, raf = 0, last = 0;
      const tweens = [];
      const tween = (dur, fn) => new Promise(res => { if (skipFlag) { fn(1); res(); return; } tweens.push({ t: 0, dur, fn, res }); });
      current = { skip() { skipFlag = true; tweens.splice(0).forEach(a => { a.fn(1); a.res(); }); } };

      // Sin WebGL: solo las tarjetas
      if (!R) {
        (async () => {
          for (let i = 0; i < N && !skipFlag; i++) { if (opts.onStage) opts.onStage(i); await opts.card.show(i); await opts.card.hide(); }
          current = null; resolve();
        })();
        return;
      }

      // capa de interfaz (nombres, cartel de teletransporte, marcadores)
      const ui = document.createElement('div'); ui.className = 'w3-ui'; host.insertBefore(ui, cv.nextSibling);
      const tag = txt => { const d = document.createElement('div'); d.className = 'w3-tag'; d.textContent = txt; ui.appendChild(d); return d; };
      const tagMe = tag(opts.names && opts.names.me || 'Yo'), tagHer = tag(opts.names && opts.names.her || 'Ella');
      const tp = document.createElement('div'); tp.className = 'w3-tp'; tp.innerHTML = '<div class="w3-tp-spin"></div><p class="w3-tp-k">Teletransportando a</p><p class="w3-tp-w"></p>'; host.appendChild(tp);
      const flash = document.createElement('div'); flash.className = 'w3-flash'; host.appendChild(flash);
      const vig = document.createElement('div'); vig.className = 'w3-vig'; host.insertBefore(vig, ui);

      // sonidos suaves (la música va por encima)
      const S = M.sfx();
      const C = {
        R, cv, ui, fx: null, scene: null, t: 0, cleanup: [],
        me: avatar(LOOK_ME), her: avatar(LOOK_HER),
        sfx: (a, b, d, ty, v) => S.tone(a, b, d, ty, v),
        chime: big => [660, 880, 1320, big ? 1760 : 0].forEach((f, i) => f && S.tone(f, f * 1.01, .16, 'triangle', .035, i * .07)),
        pop: () => { S.noise(.25, .05, 900); S.tone(300, 900, .12, 'sine', .02); },
        thump: () => { S.noise(.3, .12, 300); S.tone(90, 40, .3, 'sine', .12); }
      };
      let world = null, worldT = 0, cardBox = { top: 84, bottom: 300 };
      const cam = { pos: [0, 5, 20], target: [0, 2, 0], fov: 44, shiftY: 0 };
      let camSnap = true;

      function frameCam(spec) {
        const asp = R.W / R.H, vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
        // zona libre debajo de la tarjeta de texto
        let topFree = cardBox.bottom + 8, botFree = R.H - 50;
        if (cardBox.top > R.H * .45) { topFree = 70; botFree = cardBox.top - 8; }
        const avail = clamp((botFree - topFree) / R.H, .3, 1);
        const centerPx = (topFree + botFree) / 2;
        cam.shiftY = clamp(2 * centerPx / R.H - 1, -.65, .65);
        const fitDist = (spec.fit / 2) / Math.tan(hf / 2);
        const d = Math.max(spec.dist, fitDist) * clamp(.72 / avail, .95, 1.75);
        const cp = Math.cos(spec.pitch), yaw = spec.yaw;
        // movimiento de cámara suave, con un ligero balanceo "de mano"
        const sw = [Math.sin(worldT * .7) * .25, Math.sin(worldT * .9 + 1) * .18, 0];
        const want = [spec.target[0] + Math.sin(yaw) * cp * d + sw[0], spec.target[1] + Math.sin(spec.pitch) * d + sw[1], spec.target[2] + Math.cos(yaw) * cp * d];
        const k = camSnap ? 1 : .12; camSnap = false;
        cam.target = cam.target.map((v, i) => lerp(v, spec.target[i], k)); cam.pos = cam.pos.map((v, i) => lerp(v, want[i], k));
      }

      function teardown() {
        if (!world) return;
        C.cleanup.splice(0).forEach(f => { try { f(); } catch (e) {} });
        // devolver a los avatares a su estado normal
        [C.me, C.her].forEach(a => { a.root.scl = [1, 1, 1]; a.root.rot = [0, 0, 0]; a.root.pos = [0, 0, 0]; a.P.shadow.visible = true; if (a.root.parent) a.root.parent.remove(a.root); });
        C.scene.children.forEach(n => n.geo && n.geo.col && R.free(n.geo));
        world = null;
      }
      function buildWorld(name, idx) {
        const W = WORLDS[name] || WORLDS.obby;
        C.scene = group(); C.fx = new FX(C.scene); C.t = 0;
        C.scene.add(C.me.root); C.scene.add(C.her.root);
        R.setEnv(W.env); R.envAmb = W.env.amb; R.envSun = W.env.sunK;
        cv.style.background = W.sky;
        const look = Object.assign({ id: name }, W.look);
        if (opts.onUniverse) opts.onUniverse(look);
        cardBox = opts.cardBox ? opts.cardBox(idx) : cardBox;
        world = W.build(C); worldT = 0; camSnap = true;
      }

      async function goto(name, idx, label) {
        if (world) {
          tp.querySelector('.w3-tp-w').textContent = label || '';
          tp.classList.toggle('no-label', !label);
          tp.classList.add('on'); await tween(.42, () => {});
          teardown();
        }
        buildWorld(name, idx);
        tp.querySelector('.w3-tp-w').textContent = label || '';
        if (skipFlag) return;
        if (!tp.classList.contains('on') && label) { tp.classList.add('on'); tp.classList.toggle('no-label', false); await tween(.6, () => {}); }
        await tween(.35, () => {});
        tp.classList.remove('on');
      }

      function placeTag(el, a, show) {
        if (!show || !a.root.parent) { el.style.opacity = 0; return; }
        const w = a.P.head.world, p = R.project([w[12], w[13] + 1.55 * Math.abs(a.root.world[5] || 1), w[14]]);
        el.style.opacity = p.vis ? 1 : 0;
        el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
      }

      function frame(ts) {
        if (!running) return;
        const dt = Math.min(.05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        for (let i = tweens.length - 1; i >= 0; i--) { const a = tweens[i]; a.t += dt; const p = Math.min(1, a.t / a.dur); a.fn(p); if (p >= 1) { tweens.splice(i, 1); a.res(); } }
        if (world) {
          worldT += dt; C.t = worldT;
          world.update(dt, worldT);
          C.fx.update(dt);
          R.resize();
          frameCam(world.cam(worldT));
          R.render(C.scene, cam);
          const showTags = !tp.classList.contains('on');
          placeTag(tagMe, C.me, showTags); placeTag(tagHer, C.her, showTags);
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      function finish() {
        if (!running) return;
        running = false; cancelAnimationFrame(raf);
        try { teardown(); } catch (e) {}
        ui.remove(); tp.remove(); vig.remove();
        setTimeout(() => flash.remove(), 1400);
        current = null; resolve();
      }

      async function director() {
        for (let i = 0; i < N; i++) {
          if (skipFlag) return;
          await goto(names[i], i, worlds[i]);
          if (skipFlag) return;
          if (opts.onStage) opts.onStage(i);
          const minT = (WORLDS[names[i]] || WORLDS.obby).min || 6;
          await Promise.all([opts.card.show(i), tween(minT, () => {})]);
          await opts.card.hide();
        }
        if (skipFlag) return;
        await goto('portal', N, '');
        if (skipFlag) return;
        await opts.card.showFinal();
        await opts.card.hide();
        if (skipFlag) return;
        if (C.walkIn) C.walkIn();
        await tween(1.9, () => {});
        flash.classList.add('on');
        S.tone(200, 1600, .6, 'sine', .05);
        await tween(.5, () => {});
      }
      director().then(finish, err => { console.error(err); finish(); });
    });
  }

  G.Obby = { play, skip, worlds: Object.keys(WORLDS) };
})(window);
